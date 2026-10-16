/**
 * B 站 HTTP 传输层：负责「发出请求 + 判别响应形态 + 412 回退 + 错误分类」。
 *
 * 这一层的存在理由是一个实测踩过的坑（设计方案 §4.3）：
 * B 站风控返回的是 **HTTP 412 + text/html**，直接 JSON.parse 会抛
 * `Unexpected token '<'`，把「风控」误报成「接口坏了」。
 * 所以解析前必须先判 content-type / 首字符，并区分三种错误形态。
 */
import type { JsonObject } from './fragment.ts'

export const BILI_API = 'https://api.bilibili.com'

export type TransportErrorKind = 'risk-control' | 'not-found' | 'api-error' | 'network' | 'bad-response'

/** 带分类的传输错误：工具层据此给用户可读原因，而不是 `Unexpected token <`。 */
export class TransportError extends Error {
  readonly kind: TransportErrorKind
  readonly status: number
  constructor(kind: TransportErrorKind, message: string, status = 0) {
    super(message)
    this.name = 'TransportError'
    this.kind = kind
    this.status = status
  }
}

export interface TransportOptions {
  userAgent: string
  timeoutMs: number
  proxyUrl?: string
  /** 可选登录态 SESSDATA。 */
  sessdata?: string
  /** 412 时是否带匿名 buvid3 重试一次。 */
  buvid3Fallback: boolean
  fetchImpl?: typeof fetch
  /** 代理 dispatcher 工厂；默认动态加载 undici 的 ProxyAgent。测试可注入替身。 */
  proxyDispatcherFactory?: (uri: string) => Promise<unknown>
}

export interface BiliTransport {
  /** GET 一个 B 站 JSON 接口，返回 `data` 字段。失败一律抛 TransportError。 */
  get<T = unknown>(path: string, params: Record<string, string | number>): Promise<T>
  /** 取一个匿名 buvid3（用于 412 回退与风控缓解）。失败返回空串。 */
  ensureBuvid3(): Promise<string>
}

/**
 * 不能带任何 cookie 的端点白名单（实测结论，见 B站公开接口匿名探测报告）。
 *
 * `/x/v2/reply/main` 带上 buvid3 后**必定**返回 `replies: []` + `cursor.is_end: true`，
 * 也就是「看起来成功了，其实一条评论都没有」。实测矩阵（5 个视频交叉验证）：
 *   无 cookie 成功 4/5（各返回 19-20 条）；带 cookie 成功 0/5（全 0 条）。
 * 同一视频无 cookie 连打 3 次都稳定返回 20 条，排除了时序偶然。
 *
 * 这种「失败伪装成成功」最危险 —— 工具层会如实报告「0 条评论」，
 * 用户以为视频没评论。所以这里硬编码禁用，而不是靠调用方自觉。
 */
const COOKIELESS_PATHS = ['/x/v2/reply/main', '/x/v2/reply']

/** 该端点是否必须无 cookie。 */
function mustStayCookieless(path: string): boolean {
  return COOKIELESS_PATHS.some((p) => path.startsWith(p))
}

/** undici 的最小结构声明：只用到 ProxyAgent，且必须传对象（v7 起不再接受字符串）。 */
type ProxyAgentCtor = new (options: { uri: string }) => unknown
interface UndiciModule {
  ProxyAgent?: ProxyAgentCtor
}

/**
 * 用变量持有 specifier，避免 TS 在编译期去解析 'undici'、也避免被打包器内联。
 *
 * undici **不是**本插件的依赖：
 * - desktop profile 顶层有 undici（createRequire 实测可解析，ProxyAgent 是 function）；
 * - web profile 可能没有（MODULE_NOT_FOUND）；
 * - Node 24 也没有 `node:undici` 内置模块。
 * 所以只能运行时按需加载：没配 proxyUrl 就永远不碰它，配了但加载不到就给可读错误。
 */
const UNDICI_SPECIFIER = 'undici'

async function defaultDispatcherFactory(uri: string): Promise<unknown> {
  let mod: UndiciModule
  try {
    mod = (await import(UNDICI_SPECIFIER)) as UndiciModule
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    throw new TransportError(
      'network',
      `配置了 proxyUrl 但当前环境加载不到 undici（${why}）。`
      + '请在插件所在 profile 里安装 undici，或清空 proxyUrl 改为直连。',
    )
  }
  if (typeof mod.ProxyAgent !== 'function') {
    throw new TransportError('network', '配置了 proxyUrl 但当前 undici 没有导出 ProxyAgent，请升级 undici 或清空 proxyUrl。')
  }
  return new mod.ProxyAgent({ uri })
}

/** 判别响应是不是 HTML（而不是 JSON）。风控页/404 页都是 HTML。 */
function looksLikeHtml(text: string, contentType: string): boolean {
  if (contentType.includes('text/html')) return true
  const head = text.slice(0, 200).trimStart().toLowerCase()
  return head.startsWith('<!doctype') || head.startsWith('<html')
}

export function makeTransport(opts: TransportOptions): BiliTransport {
  const fetchImpl = opts.fetchImpl ?? fetch
  const userAgent = opts.userAgent || 'Mozilla/5.0'
  const proxyUrl = (opts.proxyUrl ?? '').trim()

  let dispatcher: Promise<unknown> | undefined
  function getDispatcher(): Promise<unknown> {
    if (!dispatcher) {
      const factory = opts.proxyDispatcherFactory ?? defaultDispatcherFactory
      dispatcher = factory(proxyUrl)
    }
    return dispatcher
  }

  /** 一次原始请求：返回 { status, contentType, text }。网络异常包装成 TransportError。 */
  async function rawGet(url: string, cookie: string): Promise<{ status: number; contentType: string; text: string }> {
    const init: { method: string; headers?: Record<string, string>; signal?: AbortSignal; dispatcher?: unknown } = {
      method: 'GET',
    }
    if (proxyUrl) init.dispatcher = await getDispatcher()
    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://www.bilibili.com/',
    }
    if (cookie) headers['Cookie'] = cookie
    init.headers = headers
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs)
    init.signal = ac.signal
    try {
      const res = await fetchImpl(url, init as RequestInit)
      const text = await res.text()
      return { status: res.status, contentType: res.headers.get('content-type') ?? '', text }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const aborted = ac.signal.aborted
      throw new TransportError(
        'network',
        aborted ? `请求超时（${opts.timeoutMs}ms）` : `网络请求失败：${msg}`,
      )
    } finally {
      clearTimeout(timer)
    }
  }

  /** cookie 串：SESSDATA（可选）+ buvid3（回退时）。 */
  function cookieOf(buvid3: string): string {
    const parts: string[] = []
    if (opts.sessdata) parts.push(`SESSDATA=${opts.sessdata}`)
    if (buvid3) parts.push(`buvid3=${buvid3}`)
    return parts.join('; ')
  }

  let buvid3Cache = ''
  let buvid3Tried = false

  async function ensureBuvid3Inner(): Promise<string> {
    if (buvid3Cache) return buvid3Cache
    if (buvid3Tried) return '' // 只尝试一次，失败就不再打这个接口
    buvid3Tried = true
    try {
      const res = await fetchImpl(`${BILI_API}/x/frontend/finger/spi`, {
        method: 'GET',
        headers: { 'User-Agent': userAgent, 'Referer': 'https://www.bilibili.com/' },
      })
      const j = (await res.json()) as { code?: number; data?: { b_3?: string } }
      if (j.code === 0 && typeof j.data?.b_3 === 'string' && j.data.b_3) {
        buvid3Cache = j.data.b_3
      }
    } catch {
      // buvid3 只是「风控缓解」，拿不到就退回纯匿名，不该让整个请求失败
    }
    return buvid3Cache
  }

  async function get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    const url = `${BILI_API}${path}${qs ? `?${qs}` : ''}`

    // 评论类端点必须保持「零 cookie」：带 buvid3 会让它返回空列表且 is_end=true
    // （伪装成「这个视频没有评论」），实测 0/5 成功率 vs 无 cookie 的 4/5。
    const cookieless = mustStayCookieless(path)

    // 第一次：带 SESSDATA（若有），不带 buvid3
    let res = await rawGet(url, cookieless ? '' : cookieOf(''))

    // 412 风控 -> 带匿名 buvid3 重试一次（实测能显著降低 412）
    //
    // 注意这里**只对 HTTP 412 生效**。另有一类风控是 HTTP 200 但 body 里
    // code=-412，那种重试同样救不了（实测 view 端点在该出口 IP 上就是这种，
    // 换 buvid3 无效，只能换端点 —— 见 adapters/bilibili.ts 的 view/detail）。
    let buvid3TriedForThis = false
    if (!cookieless && res.status === 412 && opts.buvid3Fallback) {
      const b = await ensureBuvid3Inner()
      if (b) {
        buvid3TriedForThis = true
        res = await rawGet(url, cookieOf(b))
      }
    }

    // 形态判别必须在 JSON.parse 之前 —— 这是本文件存在的核心理由
    if (looksLikeHtml(res.text, res.contentType)) {
      if (res.status === 412) {
        // 区分「已经带 buvid3 试过了还是 412」和「buuid3 没拿到/没开回退」，
        // 因为两者的下一步动作不同：前者基本只能换出口 IP，后者可以先重试。
        const hint = buvid3TriedForThis
          ? '已尝试匿名 buvid3 回退仍然 412，说明该出口 IP 被拦得比较彻底：建议配 proxyUrl 换出口 IP，或填 sessdata 换身份。'
          : '稍后重试，或在插件配置里填 sessdata、或配 proxyUrl 换出口 IP。'
        throw new TransportError(
          'risk-control',
          `触发 B 站安全风控（HTTP 412）。${hint}`,
          412,
        )
      }
      if (res.status === 404) {
        throw new TransportError('not-found', `接口不存在（HTTP 404）：${path}`, 404)
      }
      throw new TransportError(
        'bad-response',
        `B 站返回了 HTML 而不是 JSON（HTTP ${res.status}），通常是风控或接口下线。`,
        res.status,
      )
    }

    let j: unknown
    try {
      j = JSON.parse(res.text)
    } catch {
      throw new TransportError(
        'bad-response',
        `B 站响应不是 JSON（HTTP ${res.status}，${res.text.length} 字节）`,
        res.status,
      )
    }

    const o = j as Record<string, unknown>
    const code = typeof o.code === 'number' ? o.code : 0
    if (code !== 0) {
      // 只对已知 code 给可读解释，其余原样带出 code + message
      const message = typeof o.message === 'string' ? o.message : ''
      if (code === -404) {
        throw new TransportError('not-found', `B 站接口返回 -404：${message || '资源不存在（视频被删/仅登录可见）'}`, res.status)
      }
      if (code === -400) {
        throw new TransportError('api-error', `B 站接口返回 -400 参数错误：${message}`, res.status)
      }
      if (code === -412 || code === -799) {
        throw new TransportError('risk-control', `B 站接口返回 ${code}（请求被拦截）：${message}`, res.status)
      }
      throw new TransportError('api-error', `B 站接口返回 code=${code}${message ? `：${message}` : ''}`, res.status)
    }
    return o.data as T
  }

  return { get, ensureBuvid3: ensureBuvid3Inner }
}

/** 小工具：把 unknown 安全转 string/number（接口字段经常缺失或改型）。 */
export function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : fallback
}
export function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

export type { JsonObject }
