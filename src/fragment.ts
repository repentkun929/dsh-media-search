/**
 * 共享契约纯函数与类型：Node 端算、浏览器端渲染、测试钉死，三方共用。
 *
 * 这一层刻意只放**纯函数 + 类型**，不放网络逻辑：
 * - Node 端 api.ts 产出这些结构；
 * - 浏览器端 Toolview 消费同一批类型；
 * - 测试直接 import 这些纯函数做契约断言（不需要真网络）。
 */

/** 工具 items 元素类型：output schema 的 items 是 `{type:'object',additionalProperties:true}`，
 *  InferValue 推出的就是 `Record<string, JsonValue>`，execute 返回值必须严格匹配它。 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = Record<string, JsonValue>

/* ------------------------------------------------------------------ *
 * B 站条目
 * ------------------------------------------------------------------ */

/** 视频条目（search / related / popular 共用同一形状，字段已清洗）。 */
export interface VideoItem {
  bvid: string
  aid: number
  title: string
  /** 剥掉 <em class="keyword"> 后的纯标题。 */
  author: string
  mid: number
  /** 播放量。 */
  play: number
  /** 弹幕数。 */
  danmaku: number
  /** 评论数。 */
  reply: number
  /** 收藏数。 */
  favorite: number
  /** 点赞数。 */
  like: number
  /** 人读时长，如 "21:24"。 */
  duration: string
  /** 秒数，供排序用（duration 是字符串，不能直接比大小）。 */
  durationSec: number
  /** Unix 秒。 */
  pubdate: number
  /** ISO 时间串。 */
  pubdateISO: string
  tname: string
  /** 标签串（search 接口是逗号分隔的字符串）。 */
  tag: string
  /** 封面图，已补 https: 前缀。 */
  pic: string
  /** 统一输出 https://www.bilibili.com/video/<bvid>。 */
  url: string
}

/** 视频分 P。 */
export interface PageItem {
  cid: number
  page: number
  part: string
  duration: number
}

/** 合集（ugc_season）里的一个分节。 */
export interface SeasonSection {
  title: string
  episodes: { title: string; bvid: string; aid: number }[]
}

/** 合集信息。 */
export interface SeasonInfo {
  id: number
  title: string
  sections: SeasonSection[]
}

/** 视频详情（view + archive/desc 合并后的结果）。 */
export interface VideoDetail {
  bvid: string
  aid: number
  cid: number
  title: string
  /** 简介全文（archive/desc 拿到的更完整，优先用它）。 */
  desc: string
  pages: PageItem[]
  /** 六项互动数据。 */
  stat: { view: number; danmaku: number; reply: number; favorite: number; coin: number; like: number; share: number }
  owner: { mid: number; name: string; face: string }
  tname: string
  pubdate: number
  pubdateISO: string
  durationSec: number
  pic: string
  url: string
  /** 无合集时为 null。 */
  season: SeasonInfo | null
  /** 版权标记：1=自制 2=转载。 */
  copyright: number
}

/** 评论条目。 */
export interface ReplyItem {
  rpid: string
  author: string
  mid: number
  content: string
  like: number
  /** 楼中楼数。 */
  rcount: number
  ctime: number
  ctimeISO: string
}

/** UP 主资料。 */
export interface UserItem {
  mid: number
  name: string
  face: string
  sign: string
  /** 粉丝数。 */
  fans: number
  /** 关注数。 */
  following: number
  /** 获赞数（card 接口可能缺，缺时为 0）。 */
  likes: number
  level: number
}

/**
 * 音频转写结果的一条。
 *
 * 注意这里**不叫 Segment**：`segments` 是 whisper 的原始分段（秒级起止 + 文字），
 * 而 Toolview 需要的是「一个视频的转写结论」—— 覆盖了多久、是不是只有片段、
 * 语言是什么。把两者合成一条，卡片才有一个稳定的渲染单元。
 */
export interface TranscriptItem {
  bvid: string
  title: string
  page: number
  cid: number
  /** 本次实际覆盖的秒数（按 sidx 索引实测，不是请求值）。 */
  coveredSeconds: number
  /** 视频总时长（秒）；未知为 0。 */
  videoSeconds: number
  /** 是否只覆盖了视频的一部分 —— 卡片必须显著提示，否则会被当成完整内容。 */
  truncated: boolean
  language: string
  languageProbability: number
  /** whisper 的原始分段。 */
  segments: { start: number; end: number; text: string }[]
  /** 合并后的全文。 */
  text: string
}

/* ------------------------------------------------------------------ *
 * 浏览器端 meta 契约
 * ------------------------------------------------------------------ */

/** 每种 kind 承载列表的字段名。Toolview 校验时必须按这张表取，
 *  否则会出现「某个 kind 永远校验失败、卡片静默退化成纯文本」的 bug。 */
export const META_LIST_FIELD = {
  'bili-search': 'items',
  'bili-detail': 'pages',
  'bili-replies': 'items',
  'bili-related': 'items',
  'bili-user': 'items',
  'bili-popular': 'items',
  'bili-transcript': 'items',
} as const

export type MediaMeta =
  | { kind: 'bili-search'; keyword: string; page: number; hasMore: boolean; total: number; items: VideoItem[] }
  | { kind: 'bili-detail'; bvid: string; detail: VideoDetail }
  | {
      kind: 'bili-replies'
      bvid: string
      aid: number
      page: number
      hasMore: boolean
      allCount: number
      items: ReplyItem[]
    }
  | { kind: 'bili-related'; bvid: string; items: VideoItem[] }
  | { kind: 'bili-user'; mid: number; items: UserItem[] }
  | { kind: 'bili-popular'; page: number; hasMore: boolean; items: VideoItem[] }
  | {
      kind: 'bili-transcript'
      bvid: string
      title: string
      coveredSeconds: number
      videoSeconds: number
      language: string
      truncated: boolean
      items: TranscriptItem[]
    }

/** 结构化数据 -> 可持久化的 JSON 对象（供 presentationMeta 投影，满足 JsonValue 约束）。 */
export function toJsonObjects<T extends object>(list: T[]): Record<string, JsonValue>[] {
  return list as unknown as Record<string, JsonValue>[]
}

/** 单个对象 -> 可持久化 JSON 对象（detail 这类整体结构用）。 */
export function toJsonObject<T extends object>(o: T): Record<string, JsonValue> {
  return o as unknown as Record<string, JsonValue>
}

/** 从持久化 meta 还原结构化数据（浏览器端 Toolview 入口）。
 *  校验规则跟随 META_LIST_FIELD：每个 kind 只认自己那张表里声明的数组字段。
 *  注意 bili-detail 的列表字段是 `pages`，且它挂在 `detail` 子对象上 ——
 *  这里对 detail 做单独判定，不套用通用的顶层数组检查。 */
export function mediaMetaFrom(meta: unknown): MediaMeta | undefined {
  if (!meta || typeof meta !== 'object') return undefined
  const m = meta as Record<string, unknown>
  const kind = m.kind
  if (typeof kind !== 'string' || !kind.startsWith('bili-')) return undefined
  if (kind === 'bili-detail') {
    const d = m.detail
    if (!d || typeof d !== 'object') return undefined
    if (!Array.isArray((d as Record<string, unknown>).pages)) return undefined
    return m as unknown as MediaMeta
  }
  const field = (META_LIST_FIELD as Record<string, string | undefined>)[kind]
  if (field === undefined) return undefined
  if (!Array.isArray(m[field])) return undefined
  return m as unknown as MediaMeta
}

/* ------------------------------------------------------------------ *
 * 字段清洗纯函数（契约测试直接钉死）
 * ------------------------------------------------------------------ */

/** 剥掉 B 站搜索接口标题里的 `<em class="keyword">…</em>` 高亮标签，并解实体。 */
export function stripEm(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s
    .replace(/<\/?em[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/** 给 `//i2.hdslb.com/...` 这类协议相对地址补上 `https:`；已是绝对地址则原样返回。 */
export function fixPicUrl(u: unknown): string {
  if (typeof u !== 'string' || !u) return ''
  if (u.startsWith('//')) return `https:${u}`
  if (u.startsWith('http://')) return `https://${u.slice(7)}`
  return u
}

/** "21:24" / "1:02:33" -> 秒数；解析不出时返回 0。 */
export function durationToSec(d: unknown): number {
  if (typeof d === 'number' && Number.isFinite(d)) return Math.max(0, Math.floor(d))
  if (typeof d !== 'string' || !d) return 0
  const parts = d.split(':')
  if (parts.length < 2 || parts.length > 3) return 0
  let total = 0
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return 0
    total = total * 60 + Number(p)
  }
  return total
}

/** Unix 秒 -> ISO 串；无效值返回空串（不抛）。 */
export function toISO(ts: unknown): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return ''
  const d = new Date(ts * 1000)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

/** Unix 秒 -> 本地可读时间 `YYYY-MM-DD HH:mm`；无效值返回空串。 */
export function formatTime(ts: number): string {
  if (!ts || ts <= 0) return ''
  const d = new Date(ts * 1000)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 播放量等大数 -> 人读串（40584 -> "4.1万"）。 */
export function countText(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return '0'
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}万`
  return String(Math.floor(v))
}

/** 从 BV 号串 / 完整链接里提取 bvid。认 `BV` + 10 位字母数字。 */
export function extractBvid(raw: string): string {
  if (!raw) return ''
  const m = /(BV[0-9A-Za-z]{10})/.exec(raw)
  if (m) return m[1]!
  // av 号链接兜底：不转 bvid（转换要额外请求），交给调用方处理
  return ''
}

/** 从 av 号串 / 链接里提取 aid（纯数字）。 */
export function extractAid(raw: string): number {
  if (!raw) return 0
  const m = /\/av(\d+)/i.exec(raw) ?? /^av(\d+)$/i.exec(raw)
  if (!m) return 0
  const n = Number(m[1])
  return Number.isFinite(n) ? n : 0
}

export function videoUrl(bvid: string): string {
  return `https://www.bilibili.com/video/${bvid}`
}
