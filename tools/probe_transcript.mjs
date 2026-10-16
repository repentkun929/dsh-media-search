/**
 * P7 真网络端到端探测：playurl -> sidx 精确切片 -> ASR -> 文字稿。
 *
 * 这条链路要验证两件事：
 *   Q1 「按 sidx 索引精确切前 N 秒」真的走得通吗？（不是按比特率估算字节数）
 *   Q2 Python 侧从 stdin 解码 m4a 稳定吗？（不落盘，片段首尾切在帧中间会怎样）
 *
 * 注意：本脚本**刻意内联**了 sidx 解析逻辑，而不是 import src/asr.ts ——
 * 因为探测的目的是验证「网络与解码的真实行为」，用一份独立实现去核对，
 * 万一 src 里的解析写错了，这里的数字不会跟着一起错。
 *
 * 用法: node tools/probe_transcript.mjs [bvid] [seconds] [model]
 * 默认 BV1sHa966Eu6（鸣潮心月狐攻略，约 21 分钟）前 60 秒。
 */
import { spawn } from 'node:child_process'

const bvid = process.argv[2] || 'BV1sHa966Eu6'
const seconds = Number(process.argv[3] || 60)
const model = process.argv[4] || 'base'

const t0 = Date.now()
const step = (name) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${name}`)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function api(path, params) {
  const u = new URL('https://api.bilibili.com' + path)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v))
  const res = await fetch(u, {
    headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' },
  })
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/html')) throw new Error(`HTTP ${res.status} 返回 HTML（风控页或接口不存在）`)
  return await res.json()
}

async function rangeGet(url, range) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/', 'Range': range },
  })
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)
  return {
    status: res.status,
    contentRange: res.headers.get('content-range'),
    bytes: new Uint8Array(await res.arrayBuffer()),
  }
}

/* ---- sidx 解析（内联独立实现，用于交叉核对 src/asr.ts） ---- */
function u32(b, at) { return ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0 }
function u16(b, at) { return (b[at] << 8) | b[at + 1] }

function findSidx(buf) {
  // 逐字节扫描（**不能**按 4 字节对齐：实测 sidx 起点是 837 这种奇数偏移）
  for (let i = 4; i + 4 <= buf.length; i++) {
    if (buf[i] === 0x73 && buf[i + 1] === 0x69 && buf[i + 2] === 0x64 && buf[i + 3] === 0x78) return i - 4
  }
  return -1
}

function parseSidx(buf, start = 0) {
  if (buf[4] !== 0x73 || buf[5] !== 0x69 || buf[6] !== 0x64 || buf[7] !== 0x78) {
    throw new Error("sidx 魔数不匹配")
  }
  const size = u32(buf, 0)
  const version = buf[8]
  const timescale = u32(buf, 16)
  let p = 20
  p += version === 0 ? 4 : 8
  p += version === 0 ? 4 : 8
  p += 2
  const count = u16(buf, p)
  p += 2
  const fragments = []
  let offset = 0
  for (let i = 0; i < count; i++) {
    const fragSize = u32(buf, p)
    const duration = u32(buf, p + 4)
    fragments.push({ size: fragSize, duration, offset })
    offset += fragSize
    p += 12
  }
  if (p !== size) throw new Error(`自校验失败：读指针 ${p} != box size ${size}`)
  return { timescale, fragments, size, start }
}

function fragmentsForSeconds(info, sec) {
  const need = Math.max(0, sec) * info.timescale
  let acc = 0
  for (let i = 0; i < info.fragments.length; i++) {
    acc += info.fragments[i].duration
    if (acc >= need) return i + 1
  }
  return info.fragments.length
}

function totalSeconds(info) {
  return info.fragments.reduce((a, f) => a + f.duration, 0) / info.timescale
}

/* ------------------------------ 主流程 ------------------------------ */

step(`1. view?bvid=${bvid}`)
const view = await api('/x/web-interface/view', { bvid })
if (view.code !== 0) {
  console.log('   失败:', JSON.stringify(view).slice(0, 300))
  process.exit(1)
}
const { cid, aid, duration: totalSec, title } = view.data
console.log(`   ${title}`)
console.log(`   cid=${cid} aid=${aid} duration=${totalSec}s`)

step('2. playurl?fnval=16 -> dash.audio[]')
const pu = await api('/x/player/playurl', { bvid, cid, qn: 64, fnval: 16, fourk: 1 })
console.log('   code =', pu.code)
const audio = pu.data?.dash?.audio ?? []
console.log(`   音频流 ${audio.length} 条:`)
for (const a of audio) {
  console.log(`     id=${a.id} bandwidth=${a.bandwidth} (${(a.bandwidth / 1000).toFixed(0)}kbps) codecs=${a.codecs} mime=${a.mimeType}`)
}
if (audio.length === 0) { console.log('   没有 dash.audio！'); process.exit(1) }

const stream = [...audio].sort((a, b) => a.bandwidth - b.bandwidth)[0]
const baseUrl = stream.baseUrl || stream.base_url
console.log(`   选中最低码率 id=${stream.id} bandwidth=${stream.bandwidth}`)

step('3. Range 读头部 8KB')
const head = await rangeGet(baseUrl, 'bytes=0-8191')
console.log(`   HTTP ${head.status}（应 206）· ${head.bytes.length} 字节 · Content-Range=${head.contentRange}`)

step('4. 解析 sidx')
const sidxStart = findSidx(head.bytes)
console.log('   sidx 起点 =', sidxStart)
if (sidxStart < 0) { console.log('   找不到 sidx！'); process.exit(1) }
const info = parseSidx(head.bytes.subarray(sidxStart), sidxStart)
console.log(`   timescale=${info.timescale} fragments=${info.fragments.length} boxSize=${info.size}`)
console.log(`   流总时长（按索引求和） = ${totalSeconds(info).toFixed(1)}s（接口给的 duration=${totalSec}s）`)
const fragDur = info.fragments[0].duration / info.timescale
console.log(`   单个 fragment 时长 ≈ ${fragDur.toFixed(2)}s（这是切片精度）`)

const count = fragmentsForSeconds(info, seconds)
const picked = info.fragments.slice(0, count)
const covered = picked.reduce((a, f) => a + f.duration, 0) / info.timescale
console.log(`   取前 ${count} 个 fragment -> 覆盖 ${covered.toFixed(2)}s（请求 ${seconds}s）`)
console.log(`   字节量 = ${(picked.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(2)} MB`)

step('5. 下载 init 段 + 选中片段')
const dataStart = info.start + info.size
const init = await rangeGet(baseUrl, `bytes=0-${dataStart - 1}`)
const totalPicked = picked.reduce((a, f) => a + f.size, 0)
const firstOff = picked[0].offset
const body = await rangeGet(baseUrl, `bytes=${dataStart + firstOff}-${dataStart + firstOff + totalPicked - 1}`)
const bytes = new Uint8Array(init.bytes.length + body.bytes.length)
bytes.set(init.bytes, 0)
bytes.set(body.bytes, init.bytes.length)
console.log(`   init=${init.bytes.length}B + body=${body.bytes.length}B = ${bytes.length}B（${(bytes.length / 1024 / 1024).toFixed(2)} MB）`)

step(`6. Python 解码 + faster-whisper(${model}) 转写`)
const script = `
import sys, json, io, traceback
raw = sys.stdin.buffer.read()
try:
    import av, numpy as np
    from faster_whisper import WhisperModel
    TARGET_SR = 16000
    container = av.open(io.BytesIO(raw), mode="r")
    stream = None
    for s in container.streams:
        if s.type == "audio":
            stream = s; break
    cc = stream.codec_context; cc.open()
    resampler = av.AudioResampler(format="s16", layout="mono", rate=TARGET_SR)
    chunks = []; failed = 0
    for pkt in container.demux(stream):
        if pkt.dts is None: continue
        try:
            frames = cc.decode(pkt)
        except Exception:
            failed += 1; continue
        for f in frames:
            for rf in resampler.resample(f):
                chunks.append(rf.to_ndarray())
    for rf in resampler.resample(None):
        chunks.append(rf.to_ndarray())
    container.close()
    pcm = np.concatenate(chunks, axis=1).reshape(-1).astype(np.float32) / 32768.0
    m = WhisperModel("${model}", device="cpu", compute_type="int8")
    segs, info = m.transcribe(pcm, language="zh", beam_size=1, vad_filter=False)
    out = [{"start": round(float(s.start),2), "end": round(float(s.end),2), "text": s.text.strip()} for s in segs]
    print(json.dumps({"ok": True, "decodedSeconds": round(len(pcm)/TARGET_SR,2), "failedPackets": failed,
                      "segments": out, "text": "".join(s["text"] for s in out)}, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"ok": False, "reason": "%s: %s" % (type(e).__name__, e),
                      "trace": traceback.format_exc()[-800:]}, ensure_ascii=False))
`
const r = await new Promise((resolve) => {
  const child = spawn('python', ['-c', script], { stdio: ['pipe', 'pipe', 'pipe'] })
  const out = []; const err = []
  child.stdout.on('data', (d) => out.push(d))
  child.stderr.on('data', (d) => err.push(d))
  child.on('close', (code) => resolve({
    code,
    out: Buffer.concat(out).toString('utf8'),
    err: Buffer.concat(err).toString('utf8'),
  }))
  child.stdin.end(Buffer.from(bytes))
})
const line = r.out.trim().split(/\r?\n/).filter(Boolean).pop() || ''
if (!line) {
  console.log('   子进程无输出，退出码', r.code)
  console.log(r.err.slice(-1000))
  process.exit(1)
}
const j = JSON.parse(line)
if (!j.ok) { console.log('   ASR 失败:', j.reason); console.log(j.trace || ''); process.exit(1) }

console.log(`   解码得到 ${j.decodedSeconds}s（覆盖 ${covered.toFixed(2)}s）`)
console.log(`   解码失败包数 = ${j.failedPackets}`)
console.log(`   分段 ${j.segments.length} 个`)
console.log('   ---------- 文字稿 ----------')
console.log(j.text)
console.log('   ---------- 前 10 段明细 ----------')
for (const s of j.segments.slice(0, 10)) console.log(`   [${s.start} → ${s.end}] ${s.text}`)
step('完成')

// 把音频落一份，方便人工听一下切出来的片段是否完整
const { writeFileSync } = await import('node:fs')
writeFileSync('tmp_probe_slice.m4a', Buffer.from(bytes))
console.log(`\n音频已存到 tmp_probe_slice.m4a（${(bytes.length / 1024 / 1024).toFixed(2)} MB），可用播放器验证片段完整性`)
