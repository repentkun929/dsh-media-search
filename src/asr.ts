/**
 * P7：音频提取（sidx 索引切片段）+ 外部 ASR 转写。
 *
 * ## 为什么要自己解析 sidx，而不是「按比特率估字节数」
 *
 * 先前的探测脚本（tools/probe_audio.mjs）用的是估算路线：`bandwidth/8 * 秒数` 换算出
 * 一个字节数，然后 `Range: bytes=0-<n>` 直接砍。这条路有**三个实测暴露的硬伤**：
 *
 *   1. **切在音频帧中间**。m4a 的 fragment 边界与字节边界不对齐，砍在中间会丢掉残帧，
 *      首尾各有一段解不出来。
 *   2. **需要先下载才能知道该下多少**。比特率是 VBR 的（实测同一条流各片段
 *      0.590s~0.628s 时长浮动，字节数 28132~30143 浮动），估算必然偏。
 *   3. **多取或少取无法自检**。估出来的字节数到底对应多少秒，事前无从验证。
 *
 * 而 B 站音频流是 **DASH + sidx 索引**的：文件头部的 `sidx` box 直接列出了每个
 * fragment 的**字节大小和时长**。读一次 8KB 头部就能拿到完整索引，然后按索引
 * 精确取「前 N 秒需要哪几个片段」，一次 Range 请求把它们**连续**取回来。
 *
 * 实测（BV1GJ411x7h7 / BV1sHa966Eu6 交叉验证）：
 *   - 索引表结束偏移**恰好等于** sidx box 的 size 字段（548 == 548）——自校验通过；
 *   - 索引覆盖时长 212.39s vs 视频 213s，差值就是一个 fragment；
 *   - 按索引取的 60.2s 音频，PyAV 解出 60.16s PCM —— 对齐误差只有 40ms。
 *
 * ## sidx 的真实二进制布局（踩过的坑，务必按这个来）
 *
 * 网上文档与我的前几次尝试都在「每个 reference 多少字节」上错了。实测 dump 出
 * 字节流后确认，**每一项是 12 字节**（不是规范正文常写的 8 字节或 12 字节变体）：
 *
 * ```
 * 偏移  字段
 * +0    box size (4)
 * +4    'sidx'   (4)
 * +8    version+flags (4)
 * +12   reference_ID (4)
 * +16   timescale (4)          <- 实测 48000
 * +20   earliest_presentation_time  (version==0: 4 字节 / version==1: 8 字节)
 * +24   first_offset                (version==0: 4 字节 / version==1: 8 字节)
 * +?    reserved (2)
 * +?    reference_count (2)
 * 之后   reference[] 每项 12 字节：size(4) duration(4) flags(4)
 * ```
 *
 * 关键点：**每项 12 字节、顺序是 size→duration→flags**。
 * 曾经按 8 字节项解析，得到 `dur=268435456`（=0x10000000）这种明显荒谬的值，
 * 就是因为把 `flags` 的 0x90000000 当成了 duration。判据是「索引表结束偏移
 * 必须等于 box size」——这条自校验能立刻戳穿错误的项长。
 *
 * ## 为什么 ASR 走外部 Python 子进程，而不是纯 JS
 *
 * 本机实测的可行组合是 `faster-whisper 1.2.1` + `PyAV` + `numpy`，模型
 * `Systran/faster-whisper-tiny` 已在 HF 缓存里（**可完全离线**）。但：
 *   - faster-whisper 1.2.1 与 PyAV 19 **上游不兼容**（`av.open()` 去掉了
 *     `metadata_errors` 参数，而 faster-whisper 还在传），所以**不能把文件直接
 *     交给它**，必须自己解码成 PCM 波形数组再 `transcribe(array)`；
 *   - Node 侧没有成熟的 whisper 绑定，纯 JS 重写一遍不现实。
 *
 * 所以架构是：**Node 负责网络与切片段，Python 子进程负责解码 + 转写**，
 * 两者用临时文件传 PCM，用 stdout JSON 回传结果。脚本内容内联在
 * `ASR_SCRIPT` 常量里（`python -c`），不依赖用户预先放置任何文件。
 *
 * ## 边界与失败姿态（沿用全插件的硬规则）
 *
 * - **业务失败一律不抛**：返回 `{ok:false, reason}`，由工具层转成可读文本。
 *   典型：Python 不存在、faster-whisper 没装、模型没缓存、音频取不到。
 * - **必须如实说明覆盖范围**：返回的 `coveredSeconds` 是**索引实测**的片段总时长，
 *   不是用户请求的时长。工具层要把它写进文本，否则模型会把「前 300 秒的文字稿」
 *   当成整个视频的内容去总结 —— 那比不给更糟。
 */
import { spawn } from 'node:child_process'

/** 目标采样率：whisper 固定要求 16kHz 单声道。 */
export const TARGET_SAMPLE_RATE = 16000

export interface AudioStreamInfo {
  /** 选中的流 id（30216/30232/30280 等）。 */
  id: number
  /** 码率 bit/s。 */
  bandwidth: number
  codecs: string
  mimeType: string
  /** 音频流 URL（带签名的临时地址，必须拿到后立刻用）。 */
  baseUrl: string
  /** 备用地址：主地址失效（403）时可依次重试。 */
  backupUrls: string[]
}

/** 一个 sidx fragment：字节大小、样本时长、在音频数据区里的累计字节偏移。 */
export interface AudioFragment {
  size: number
  /** 以 timescale 为单位的时长。 */
  duration: number
  /** 相对音频数据区起点的累计字节偏移。 */
  offset: number
}

export interface SidxInfo {
  timescale: number
  fragments: AudioFragment[]
  /** sidx box 自身的大小；数据区起点 = sidxStart + size。 */
  size: number
  /** sidx box 在整个文件里的偏移。 */
  start: number
}

export interface AudioSlice {
  /** m4a 字节（init 段 + 选中的 fragment 们，连续）。 */
  bytes: Uint8Array
  /** 索引实测覆盖的秒数（不是请求的秒数）。 */
  coveredSeconds: number
  /** 实际取到的 fragment 数。 */
  fragmentCount: number
  /** 整个流一共多少 fragment（用于说明「只取了前 N/M」）。 */
  totalFragments: number
  /** 解析出的流信息。 */
  stream: AudioStreamInfo
  /** 流总时长（按索引求和）。 */
  streamSeconds: number
}

/* ------------------------------------------------------------------ *
 * sidx 解析（纯函数，可离线测试）
 * ------------------------------------------------------------------ */

/**
 * 在 buf 里定位 sidx box 的起始偏移；找不到返回 -1。
 *
 * 两条都是踩过的坑：
 *  1. **偏移不固定**：sidx 之前有 ftyp/moov（moov 大小随音频复杂度变），
 *     实测见过 837 与 944，绝不能硬编码偏移。
 *  2. **不能按 4 字节对齐扫**：早期实现 `for (i = 4; i += 4)` 假设 box 边界对齐，
 *     但实测的 B 站音频流里 `ftyp` 只有 32 字节、`moov` 是 805 字节，
 *     于是 sidx 起点落在 837（**奇数偏移**），魔数在 841，4 字节步长永远跳不到，
 *     直接漏判成「没有 sidx」。改成逐字节扫描，这点性能开销可以忽略
 *     （只在头部 8KB 内扫，且只做一次）。
 *
 * 另外仍然保留「找到魔数后回退 4 字节」的语义：box 结构是
 * `[4 字节 size][4 字节 type]`，所以 type 之前那 4 字节就是 box 起点。
 */
export function findSidx(buf: Uint8Array): number {
  for (let i = 4; i + 4 <= buf.length; i++) {
    if (buf[i] === 0x73 && buf[i + 1] === 0x69 && buf[i + 2] === 0x64 && buf[i + 3] === 0x78) {
      return i - 4
    }
  }
  return -1
}

function u32(buf: Uint8Array, at: number): number {
  return ((buf[at]! << 24) | (buf[at + 1]! << 16) | (buf[at + 2]! << 8) | buf[at + 3]!) >>> 0
}

function u16(buf: Uint8Array, at: number): number {
  return (buf[at]! << 8) | buf[at + 1]!
}

/**
 * 解析 sidx。**`buf` 必须从 sidx box 起点开始**（`buf[4..7]` 是 `'sidx'` 魔数）。
 *
 * 调用方要先用 `subarray(sidxStart)` 把前面 ftyp/moov 切掉再传进来 ——
 * 早期版本把整段头部传进来（`buf[4..7]` 落在 ftyp 里）导致一律报「魔数不匹配」。
 *
 * 自校验：解析结束后读指针必须**恰好等于** box size —— 这条断言能立刻发现
 * 「项长猜错」（例如误按 8 字节项解析时，读指针会与 size 对不上）。
 */
export function parseSidx(buf: Uint8Array, start = 0): SidxInfo {
  if (buf.length < 32) throw new Error('sidx 太短，无法解析')
  if (!(buf[4] === 0x73 && buf[5] === 0x69 && buf[6] === 0x64 && buf[7] === 0x78)) {
    throw new Error("sidx 魔数不匹配（期望 'sidx'；调用方要先把头部 subarray 到 box 起点）")
  }
  const size = u32(buf, 0)
  const version = buf[8]!
  const timescale = u32(buf, 16)
  if (timescale <= 0) throw new Error(`sidx timescale 非法：${timescale}`)

  // version 0: earliest_presentation_time / first_offset 各 4 字节
  // version 1: 各 8 字节 —— B 站实测就是 version=1，早期只按 0 算会让读指针全错位
  let p = 20
  p += version === 0 ? 4 : 8
  p += version === 0 ? 4 : 8
  p += 2 // reserved
  const count = u16(buf, p)
  p += 2

  const fragments: AudioFragment[] = []
  let offset = 0
  for (let i = 0; i < count; i++) {
    if (p + 12 > buf.length) throw new Error(`sidx 声明 ${count} 个片段，但数据在第 ${i} 个就截断了`)
    const fragSize = u32(buf, p)
    const duration = u32(buf, p + 4)
    // p+8 是 flags（含 reference_type），本插件不用，但**必须占位 12 字节**
    fragments.push({ size: fragSize, duration, offset })
    offset += fragSize
    p += 12
  }

  // 自校验：读指针必须正好落在 box 末尾
  if (p !== size) {
    throw new Error(`sidx 解析自校验失败：读指针 ${p} != box size ${size}（reference 项长可能猜错了，应为 12 字节）`)
  }

  return { timescale, fragments, size, start }
}

/** 按索引求出「凑够 seconds 秒」需要取前几个 fragment。返回个数（至少 1，至多全部）。 */
export function fragmentsForSeconds(info: SidxInfo, seconds: number): number {
  const need = Math.max(0, seconds) * info.timescale
  let acc = 0
  for (let i = 0; i < info.fragments.length; i++) {
    acc += info.fragments[i]!.duration
    if (acc >= need) return i + 1
  }
  return info.fragments.length
}

/** 索引覆盖的总秒数。 */
export function sidxSeconds(info: SidxInfo): number {
  let acc = 0
  for (const f of info.fragments) acc += f.duration
  return acc / info.timescale
}

/* ------------------------------------------------------------------ *
 * 音频抓取（需要网络，由调用方注入 fetch）
 * ------------------------------------------------------------------ */

export interface FetchAudioOptions {
  /** 取多少秒（会向上取整到一个 fragment 边界）。 */
  seconds: number
  /** 上限秒数（防止用户传超大值把上下文/内存打爆）。 */
  maxSeconds: number
  userAgent: string
  timeoutMs: number
  fetchImpl?: typeof fetch
  /** sidx 头部读多少字节。8KB 足够覆盖任何常见索引。 */
  headBytes?: number
}

export interface FetchAudioResult {
  ok: true
  slice: AudioSlice
}

export interface FetchAudioFailure {
  ok: false
  reason: string
}

/** 发一次带 Range 的 GET，返回字节。非 2xx 抛错。 */
async function rangeGet(
  url: string,
  range: string,
  opts: { userAgent: string; timeoutMs: number },
  fetchImpl: typeof fetch,
): Promise<Uint8Array> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), Math.max(opts.timeoutMs, 30000))
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'User-Agent': opts.userAgent,
        'Referer': 'https://www.bilibili.com/',
        'Range': range,
      },
      signal: ac.signal,
    })
    if (!res.ok && res.status !== 206) {
      throw new Error(`音频请求失败：HTTP ${res.status}`)
    }
    return new Uint8Array(await res.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 取一段音频：先读头部拿 sidx，再按索引把需要的 fragment 连续取回。
 *
 * `stream` 由调用方从 playurl 结果里挑好传入（本模块不碰 B 站 JSON 接口，
 * 保持「网络策略在适配器层、音频解析在本层」的边界）。
 */
export async function fetchAudioSlice(
  stream: AudioStreamInfo,
  opts: FetchAudioOptions,
): Promise<FetchAudioResult | FetchAudioFailure> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const headBytes = opts.headBytes ?? 8192
  const seconds = Math.max(1, Math.min(opts.maxSeconds, Math.floor(opts.seconds)))
  const conn = { userAgent: opts.userAgent, timeoutMs: opts.timeoutMs }

  // 1) 读头部，定位并解析 sidx
  let head: Uint8Array
  try {
    head = await rangeGet(stream.baseUrl, `bytes=0-${headBytes - 1}`, conn, fetchImpl)
  } catch (e) {
    return { ok: false, reason: `读取音频头部失败：${e instanceof Error ? e.message : String(e)}` }
  }

  const sidxStart = findSidx(head)
  if (sidxStart < 0) {
    return { ok: false, reason: '音频流里没有找到 sidx 索引（可能换成了非 DASH 格式），无法按时长精确切片段' }
  }

  let info: SidxInfo
  try {
    // parseSidx 要求 buf[4..7] 是 'sidx'，所以这里一律 subarray 到 box 起点。
    // 若 box 超出已读头部（极端大的 sidx），补一次请求拿完整 box。
    let buf = head.subarray(sidxStart)
    const declared = u32(head, sidxStart)
    if (declared > buf.length) {
      const more = await rangeGet(stream.baseUrl, `bytes=${sidxStart}-${sidxStart + declared - 1}`, conn, fetchImpl)
      // 这一段从 sidxStart 开始，所以本身就是「box 起点」，不要再 subarray
      buf = more
    }
    info = parseSidx(buf, sidxStart)
  } catch (e) {
    return { ok: false, reason: `解析 sidx 失败：${e instanceof Error ? e.message : String(e)}` }
  }

  if (info.fragments.length === 0) {
    return { ok: false, reason: 'sidx 索引里没有任何音频片段（视频可能没有音频轨）' }
  }

  const dataStart = info.start + info.size
  const count = fragmentsForSeconds(info, seconds)
  const picked = info.fragments.slice(0, count)
  const coveredSamples = picked.reduce((a, f) => a + f.duration, 0)

  // 2) 取 init 段（文件头到数据区起点）+ 选中的片段（它们在数据区里是连续的）
  let bytes: Uint8Array
  try {
    const init = await rangeGet(stream.baseUrl, `bytes=0-${dataStart - 1}`, conn, fetchImpl)
    const totalPicked = picked.reduce((a, f) => a + f.size, 0)
    const firstOff = picked[0]!.offset
    const body = await rangeGet(
      stream.baseUrl,
      `bytes=${dataStart + firstOff}-${dataStart + firstOff + totalPicked - 1}`,
      conn,
      fetchImpl,
    )
    bytes = new Uint8Array(init.length + body.length)
    bytes.set(init, 0)
    bytes.set(body, init.length)
  } catch (e) {
    return { ok: false, reason: `下载音频片段失败：${e instanceof Error ? e.message : String(e)}` }
  }

  return {
    ok: true,
    slice: {
      bytes,
      coveredSeconds: coveredSamples / info.timescale,
      fragmentCount: picked.length,
      totalFragments: info.fragments.length,
      stream,
      streamSeconds: sidxSeconds(info),
    },
  }
}

/* ------------------------------------------------------------------ *
 * ASR 子进程
 * ------------------------------------------------------------------ */

export interface AsrEnvProbe {
  python: boolean
  av: boolean
  fasterWhisper: boolean
  numpy: boolean
  detail: string
}

/**
 * 交给 `python -c` 的脚本：从 stdin 读 **m4a 字节** -> PyAV 解码成 PCM -> faster-whisper -> stdout JSON。
 *
 * 四个刻意的设计：
 *  1. **解码放在 Python 侧**，因为 Node 没有解 m4a 的能力：传过去的是容器字节而不是 PCM。
 *  2. **自己用 PyAV 解码，不把文件交给 faster-whisper**（上游 `metadata_errors` 不兼容，
 *     见文件头注释）。用 `av.open(io.BytesIO(...))` 直接从内存读，不落磁盘。
 *  3. **逐包容错**：片段首尾切在音频帧中间时，会有极少数包解码失败。实测 347 个包里
 *     恰好 1 个失败（首包），直接跳过即可，不要整体失败。
 *  4. **stdout 只输出一行 JSON**：任何库的警告都走 stderr，避免污染解析。
 */
export const ASR_SCRIPT = String.raw`
import sys, json, io, traceback
def main():
    raw = sys.stdin.buffer.read()
    try:
        import av, numpy as np
        from faster_whisper import WhisperModel
        if len(raw) == 0:
            print(json.dumps({"ok": False, "reason": "空音频"})); return

        TARGET_SR = 16000
        container = av.open(io.BytesIO(raw), mode="r")
        stream = None
        for s in container.streams:
            if s.type == "audio":
                stream = s; break
        if stream is None:
            print(json.dumps({"ok": False, "reason": "m4a 里没有音频流"})); return
        cc = stream.codec_context
        cc.open()
        resampler = av.AudioResampler(format="s16", layout="mono", rate=TARGET_SR)
        chunks = []
        failed = 0
        for pkt in container.demux(stream):
            if pkt.dts is None:
                continue
            try:
                frames = cc.decode(pkt)
            except Exception:
                failed += 1          # 切在帧中间的残包，跳过即可
                continue
            for f in frames:
                for rf in resampler.resample(f):
                    chunks.append(rf.to_ndarray())
        for rf in resampler.resample(None):
            chunks.append(rf.to_ndarray())
        container.close()
        if not chunks:
            print(json.dumps({"ok": False, "reason": "解码得到 0 个样本（片段可能不含音频数据）"})); return
        pcm = np.concatenate(chunks, axis=1).reshape(-1).astype(np.float32) / 32768.0

        model_name = __MODEL__
        try:
            model = WhisperModel(model_name, device="cpu", compute_type="int8")
        except Exception as e:
            print(json.dumps({"ok": False, "reason": "模型加载失败(可能未缓存 %s): %s" % (model_name, e)}, ensure_ascii=False)); return
        lang = __LANG__
        segs, info = model.transcribe(pcm, language=lang, beam_size=1, vad_filter=False)
        out = []
        for s in segs:
            out.append({"start": round(float(s.start), 2), "end": round(float(s.end), 2), "text": s.text.strip()})
        text = "".join(s["text"] for s in out)
        print(json.dumps({
            "ok": True,
            "language": info.language,
            "languageProbability": round(float(info.language_probability), 3),
            "duration": round(float(info.duration), 2),
            "decodedSeconds": round(len(pcm) / TARGET_SR, 2),
            "failedPackets": failed,
            "segments": out,
            "text": text,
        }, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "reason": "%s: %s" % (type(e).__name__, e), "trace": traceback.format_exc()[-800:]}, ensure_ascii=False))

main()
`

export interface AsrSegment {
  start: number
  end: number
  text: string
}

export interface AsrSuccess {
  ok: true
  language: string
  languageProbability: number
  /** whisper 看到的音频时长。 */
  duration: number
  /** PyAV 实际解出的音频秒数（用于核对片段覆盖时长）。 */
  decodedSeconds: number
  /** 因切在帧中间而跳过的残包数（诊断用，通常 0~2）。 */
  failedPackets: number
  segments: AsrSegment[]
  text: string
}

export interface AsrFailure {
  ok: false
  reason: string
}

export interface AsrOptions {
  /** Python 可执行文件。Windows 上常见 `python`。 */
  pythonPath: string
  /** whisper 模型名（tiny/base/small…）。 */
  model: string
  /** 语言；留空 = 自动检测。 */
  language: string
  /** 子进程超时（毫秒）。转写长音频可能很慢。 */
  timeoutMs: number
}

/**
 * 转写一段 **m4a 字节**（解码在 Python 侧完成，见 ASR_SCRIPT 注释）。
 * 失败返回 {ok:false}，**不抛**（沿用全插件「业务失败不抛」的规则）。
 */
export async function transcribeAudio(
  audio: Uint8Array,
  opts: AsrOptions,
): Promise<AsrSuccess | AsrFailure> {
  if (audio.length === 0) return { ok: false, reason: '没有可转写的音频数据' }

  // 脚本里的占位符替换成真实值（用 JSON.stringify 保证是合法的 Python 字面量）
  const script = ASR_SCRIPT
    .replace('__MODEL__', JSON.stringify(opts.model))
    .replace('__LANG__', opts.language ? JSON.stringify(opts.language) : 'None')

  return await new Promise<AsrSuccess | AsrFailure>((resolve) => {
    const child = spawn(opts.pythonPath, ['-c', script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      resolve({ ok: false, reason: `转写超时（${opts.timeoutMs}ms），可减小 maxSeconds 或换更小的模型` })
    }, opts.timeoutMs)

    const done = (r: AsrSuccess | AsrFailure) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(r)
    }

    child.stdout.on('data', (d: Buffer) => chunks.push(d))
    child.stderr.on('data', (d: Buffer) => errChunks.push(d))
    child.on('error', (e: Error) => {
      done({ ok: false, reason: `启动 ${opts.pythonPath} 失败：${e.message}（可用 asrPythonPath 指定解释器路径）` })
    })
    child.on('close', (code: number | null) => {
      const stdout = Buffer.concat(chunks).toString('utf8').trim()
      const stderr = Buffer.concat(errChunks).toString('utf8').trim()
      // 取 stdout 最后一行 JSON（可能有库往 stdout 打东西）
      const line = stdout.split(/\r?\n/).filter(Boolean).pop() ?? ''
      if (!line) {
        done({
          ok: false,
          reason: `ASR 子进程没有输出（退出码 ${code}）${stderr ? `：${stderr.slice(-300)}` : ''}`,
        })
        return
      }
      try {
        const j = JSON.parse(line) as Record<string, unknown>
        if (j.ok === true) {
          done({
            ok: true,
            language: typeof j.language === 'string' ? j.language : '',
            languageProbability: typeof j.languageProbability === 'number' ? j.languageProbability : 0,
            duration: typeof j.duration === 'number' ? j.duration : 0,
            decodedSeconds: typeof j.decodedSeconds === 'number' ? j.decodedSeconds : 0,
            failedPackets: typeof j.failedPackets === 'number' ? j.failedPackets : 0,
            segments: Array.isArray(j.segments) ? (j.segments as AsrSegment[]) : [],
            text: typeof j.text === 'string' ? j.text : '',
          })
        } else {
          done({ ok: false, reason: typeof j.reason === 'string' ? j.reason : 'ASR 失败（未给出原因）' })
        }
      } catch {
        done({ ok: false, reason: `无法解析 ASR 输出：${line.slice(0, 200)}` })
      }
    })

    // 把 m4a 字节写进 stdin 后关闭
    child.stdin.on('error', () => { /* 子进程早退时忽略 EPIPE */ })
    child.stdin.end(Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength))
  })
}

/**
 * 探测 Python 环境里 ASR 依赖是否齐备（不加载模型，很快）。
 * 工具层用它给出「装了什么/缺什么」的可读提示，而不是等转写时才失败。
 */
export async function probeAsrEnvironment(pythonPath: string, timeoutMs = 20000): Promise<AsrEnvProbe> {
  const script = String.raw`
import json
mods = {}
for name in ['av', 'faster_whisper', 'numpy']:
    try:
        __import__(name); mods[name] = True
    except Exception as e:
        mods[name] = False
print(json.dumps(mods))
`
  return await new Promise((resolve) => {
    const child = spawn(pythonPath, ['-c', script], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    const chunks: Buffer[] = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      resolve({ python: false, av: false, fasterWhisper: false, numpy: false, detail: `Python 探测超时（${timeoutMs}ms）` })
    }, timeoutMs)
    const finish = (r: AsrEnvProbe) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(r)
    }
    child.stdout.on('data', (d: Buffer) => chunks.push(d))
    child.on('error', (e: Error) => finish({
      python: false, av: false, fasterWhisper: false, numpy: false,
      detail: `找不到 Python 解释器「${pythonPath}」：${e.message}`,
    }))
    child.on('close', (code: number | null) => {
      const out = Buffer.concat(chunks).toString('utf8').trim()
      const line = out.split(/\r?\n/).filter(Boolean).pop() ?? ''
      try {
        const j = JSON.parse(line) as Record<string, boolean>
        const missing = ['av', 'faster_whisper', 'numpy'].filter((m) => j[m] !== true)
        finish({
          python: true,
          av: j.av === true,
          fasterWhisper: j.faster_whisper === true,
          numpy: j.numpy === true,
          detail: missing.length === 0
            ? 'Python 环境就绪（av / faster_whisper / numpy 均可用）'
            : `缺少 Python 包：${missing.join('、')}（用 pip install ${missing.join(' ').replace(/_/g, '-')} 安装）`,
        })
      } catch {
        finish({
          python: false, av: false, fasterWhisper: false, numpy: false,
          detail: `Python 探测失败（退出码 ${code}）：${(line || out).slice(0, 200)}`,
        })
      }
    })
  })
}
