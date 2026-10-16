/**
 * 定位 sidx 到底在哪：B 站 DASH 音频流的前 8KB 里找不到 sidx。
 *
 * 假设：sidx 在 moov box **之后**，而 moov 可能很大（含 stbl 表），
 * 所以 sidx 偏移远超 8KB。本脚本扫描多个偏移区间，找出真实位置。
 *
 * 用法: node tools/find_sidx.mjs [bvid]
 */
const bvid = process.argv[2] || 'BV1sHa966Eu6'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const u32 = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0
const tag = (b, at) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3])

async function rangeGet(url, range) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/', Range: range },
  })
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

// 1. 拿音频流地址
const vu = new URL('https://api.bilibili.com/x/web-interface/view')
vu.searchParams.set('bvid', bvid)
const view = await (await fetch(vu, { headers: { 'User-Agent': UA } })).json()
const cid = view.data.cid

const pu = new URL('https://api.bilibili.com/x/player/playurl')
for (const [k, v] of Object.entries({ bvid, cid, qn: 64, fnval: 16, fourk: 1 })) pu.searchParams.set(k, v)
const puRes = await (await fetch(pu, { headers: { 'User-Agent': UA } })).json()
const audio = puRes.data.dash.audio
const stream = [...audio].sort((a, b) => a.bandwidth - b.bandwidth)[0]
const baseUrl = stream.baseUrl || stream.base_url
console.log(`bvid=${bvid} cid=${cid} 流 id=${stream.id} bandwidth=${stream.bandwidth}`)

// 2. 读前 256KB，遍历顶层 box 结构
const SIZE = 256 * 1024
const head = await rangeGet(baseUrl, `bytes=0-${SIZE - 1}`)
console.log(`\n读了前 ${head.length} 字节，遍历顶层 box：`)
console.log('offset     size        type')
let p = 0
const topBoxes = []
while (p + 8 <= head.length) {
  const size = u32(head, p)
  const type = tag(head, p + 4)
  if (size === 0) { console.log(`  ${p}  到文件末尾      ${type}`); topBoxes.push({ off: p, size: head.length - p, type }); break }
  if (size === 1) {
    // 64 位 size：接下来 8 字节
    const hi = u32(head, p + 8), lo = u32(head, p + 12)
    const big = hi * 4294967296 + lo
    console.log(`  ${p}  ${big} (64位)  ${type}`)
    topBoxes.push({ off: p, size: big, type })
    p += big
    continue
  }
  if (size < 8) { console.log(`  ${p}  非法 size=${size}  ${type}`); break }
  console.log(`  ${p}  ${size}  ${type}${p + size > head.length ? '  (超出已读范围)' : ''}`)
  topBoxes.push({ off: p, size, type })
  p += size
  if (topBoxes.length > 20) break
}

console.log('\n各 box 类型汇总:', topBoxes.map((b) => b.type).join(' -> '))

// 3. 在所有已知 box 里找 sidx 魔数
const hits = []
for (let i = 0; i + 4 <= head.length; i++) {
  if (head[i] === 0x73 && head[i + 1] === 0x69 && head[i + 2] === 0x64 && head[i + 3] === 0x78) {
    hits.push(i - 4)
  }
}
console.log(`\n在已读的 ${head.length} 字节里，'sidx' 魔数命中 ${hits.length} 处`)
for (const h of hits.slice(0, 10)) {
  const size = u32(head, h)
  console.log(`   起点 ${h}, box size=${size}, version=${head[h + 8]}, timescale=${u32(head, h + 16)}`)
}

// 4. 如果没找到，再往后读一段（moov 可能超大）
if (hits.length === 0) {
  console.log('\n前 256KB 内没有 sidx，向后继续找（读下一段 256KB）：')
  const far = await rangeGet(baseUrl, `bytes=${SIZE}-${SIZE * 2 - 1}`)
  console.log(`  这一段前几个字节: ${Array.from(far.slice(0, 16)).map((x) => x.toString(16).padStart(2, '0')).join(' ')}`)
  const hits2 = []
  for (let i = 0; i + 4 <= far.length; i++) {
    if (far[i] === 0x73 && far[i + 1] === 0x69 && far[i + 2] === 0x64 && far[i + 3] === 0x78) hits2.push(SIZE + i - 4)
  }
  console.log(`  这一段里 'sidx' 命中 ${hits2.length} 处`, hits2.slice(0, 5))
  // 打印这一段开头的 box 链
  let q = 0
  console.log('  这一段开头的 box：')
  for (let n = 0; n < 8 && q + 8 <= far.length; n++) {
    const size = u32(far, q)
    const type = tag(far, q + 4)
    if (size < 8) break
    console.log(`    +${q}  ${size}  ${type}`)
    q += size
  }
}
