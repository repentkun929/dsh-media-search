/**
 * P7 前置探测：playurl 音频流到底能不能用、字节与时长怎么换算。
 *
 * 只跑探测，不写任何插件代码 —— 先把不确定的地方测清楚。
 *
 * 要回答的 4 个问题：
 *   Q1 playurl 现在还能不能匿名拿到 dash.audio[]？（此前只测过一次，可能有变）
 *   Q2 三条流的真实比特率是多少？从 backupUrl / 响应头能否推出？
 *   Q3 Range 请求的字节数 -> 时长换算关系是什么？能否用 Content-Range 反推总时长？
 *   Q4 切在音频帧中间的片段，ASR 引擎（ffmpeg/whisper）能否正常解码？
 *
 * 用法: node tools/probe_audio.mjs [bvid]
 * 默认 bvid 用 BV1GJ411x7h7（索尼音乐中国，duration=213s，短视频便于推算）
 */
import { readFileSync } from 'node:fs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const bvid = process.argv[2] ?? 'BV1GJ411x7h7'

const j = async (url, init = {}) => {
  const res = await fetch(url, {
    ...init,
    headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/', ...(init.headers ?? {}) },
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 200)
  }
  return { status: res.status, headers: res.headers, body }
}

console.log(`探测对象: ${bvid}\n`)

/* ---------------- Q1: 详情拿 cid ---------------- */
const detail = await j(
  `https://api.bilibili.com/x/web-interface/view/detail?bvid=${bvid}`,
)
if (detail.body?.code !== 0) {
  console.error('view/detail 失败:', detail.status, JSON.stringify(detail.body).slice(0, 300))
  process.exit(1)
}
const View = detail.body.data.View
const cid = View.cid
const aid = View.aid
console.log(`[Q1] 详情 OK  标题=${View.title.slice(0, 30)}  duration=${View.duration}s  aid=${aid}  cid=${cid}`)

/* ---------------- Q1: playurl 拿 dash.audio ---------------- */
const pu = await j(
  `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64&fnval=16`,
)
console.log(`[Q1] playurl HTTP ${pu.status}  code=${pu.body?.code}  message=${pu.body?.message ?? ''}`)

const dash = pu.body?.data?.dash
if (!dash) {
  console.error('拿不到 dash，响应片段:', JSON.stringify(pu.body).slice(0, 500))
  process.exit(1)
}

const audios = dash.audio ?? []
console.log(`[Q1] dash.audio 共 ${audios.length} 条，dash.duration=${dash.duration}s`)
console.log(`     另有 flac=${dash.flac ? 'yes' : 'no'}  dolby=${dash.dolby ? 'yes' : 'no'}`)
console.log('')
console.log('      id      码率(bandwidth)   编码          mimeType                 体积估算(按dash.duration)')
for (const a of audios) {
  const est = a.bandwidth && dash.duration ? ((a.bandwidth * dash.duration) / 8 / 1024 / 1024).toFixed(1) + ' MB' : '?'
  console.log(
    `      ${String(a.id).padEnd(7)} ${String(a.bandwidth).padEnd(16)} ${String(a.codecs).padEnd(12)} ${String(a.mimeType).padEnd(24)} ${est}`,
  )
}

/* ---------------- Q2/Q3: 选最低码率流，实测 Range ---------------- */
// 挑 bandwidth 最小的那一条（最省流量，转写够用）
const pick = [...audios].sort((x, y) => (x.bandwidth ?? 0) - (y.bandwidth ?? 0))[0]
console.log('')
console.log(`[Q2] 选中最低码率流: id=${pick.id}  bandwidth=${pick.bandwidth}  codecs=${pick.codecs}`)
console.log(`     baseUrl 主机: ${new URL(pick.baseUrl).host}  path=${new URL(pick.baseUrl).pathname.slice(0, 40)}...`)
console.log(`     有 backupUrl: ${(pick.backupUrl ?? []).length} 条`)

/** 发一次 Range 请求，返回状态/头部/首 16 字节（用于判 m4a 魔数） */
const probeRange = async (rangeHeader) => {
  const res = await fetch(pick.baseUrl, {
    headers: {
      'user-agent': UA,
      referer: 'https://www.bilibili.com/',
      range: rangeHeader,
    },
  })
  const buf = new Uint8Array(await res.arrayBuffer())
  return { status: res.status, headers: res.headers, bytes: buf.length, head: buf.slice(0, 16) }
}

console.log('')
console.log('[Q3] Range 请求实测（不落盘）')
const cases = [
  ['bytes=0-1048575', '约 1 MB，测能否流式取'],
  ['bytes=0-99999', '约 100 KB，测极小片段'],
  ['bytes=1000000-1099999', '从中间取 100 KB，测任意偏移'],
]
const results = []
for (const [range, note] of cases) {
  try {
    const r = await probeRange(range)
    const cr = r.headers.get('content-range')
    const cl = r.headers.get('content-length')
    results.push({ range, note, ...r, cr, cl })
    console.log(`     ${range.padEnd(24)} HTTP ${r.status}  ${String(r.bytes).padStart(8)} bytes  content-range=${cr}`)
    console.log(`       ${' '.repeat(24)} content-length=${cl}  accept-ranges=${r.headers.get('accept-ranges')}`)
  } catch (e) {
    console.log(`     ${range.padEnd(24)} 失败: ${e.message}`)
  }
}

/* ---------------- 字节 -> 时长 换算 ---------------- */
console.log('')
console.log('[Q3] 字节 → 时长 换算关系')
const total = dash.duration
if (total && pick.bandwidth) {
  const bytesPerSec = pick.bandwidth / 8
  console.log(`     按 bandwidth=${pick.bandwidth} bit/s 推算: 每秒 ${bytesPerSec.toFixed(0)} 字节`)
  console.log(`     视频总时长 ${total}s -> 全程音频约 ${((bytesPerSec * total) / 1024 / 1024).toFixed(1)} MB`)
  for (const sec of [60, 300, 600, 1800]) {
    console.log(`       前 ${String(sec).padStart(4)}s ≈ ${((bytesPerSec * sec) / 1024 / 1024).toFixed(2)} MB`)
  }
  const first = results.find((r) => r.status === 206 && r.bytes > 100000)
  if (first) {
    const impliedSec = first.bytes / bytesPerSec
    console.log(`     实测校验: ${first.range} 实收 ${first.bytes} 字节 -> 推算约 ${impliedSec.toFixed(1)}s`)
  }
} else {
  console.log('     缺少 duration 或 bandwidth，无法换算')
}

/* ---------------- Q4: 首 16 字节判容器格式 ---------------- */
console.log('')
console.log('[Q4] 音频容器格式（决定 ffmpeg/whisper 能否解码）')
for (const r of results) {
  if (r.status !== 200 && r.status !== 206) continue
  const hex = [...r.head].map((b) => b.toString(16).padStart(2, '0')).join(' ')
  const ascii = [...r.head].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')
  console.log(`     ${r.range.padEnd(24)} ${hex}`)
  console.log(`       ${' '.repeat(24)} |${ascii}|`)
  // m4a/mp4 的 ftyp box 在第 4-8 字节
  if (ascii.includes('ftyp')) console.log(`       -> 检出 ftyp box，是 MP4/M4A 容器（含 moov 索引，可被 ffmpeg 解码）`)
}
console.log('')
console.log('探测完成。注意：以上只发了 4 次小请求，未下载完整音频。')
