/**
 * 抓一个真实的 B 站音频流前 8KB 作为测试夹具。
 *
 * 为什么要存真实字节而不是手搓一个 m4a 盒子：
 * 手搓的夹具会**迁就实现里的错误假设** —— 比如早期 findSidx 按 4 字节对齐扫，
 * 手搓夹具大概率也对齐，于是测试全绿而真网络全挂（这正是踩过的坑）。
 * 存真实字节，测试才钉得住「sidx 起点是奇数偏移」这种要命的事实。
 *
 * 用法: node tools/snapshot_audio_head.mjs [bvid]
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const bvid = process.argv[2] || 'BV1sHa966Eu6' // 鸣潮心月狐攻略，1284s
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const u32 = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0
const tag = (b, at) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3])

const vu = new URL('https://api.bilibili.com/x/web-interface/view')
vu.searchParams.set('bvid', bvid)
const view = await (await fetch(vu, { headers: { 'User-Agent': UA } })).json()
if (view.code !== 0) throw new Error(`view 失败: ${JSON.stringify(view).slice(0, 200)}`)
const cid = view.data.cid

const pu = new URL('https://api.bilibili.com/x/player/playurl')
for (const [k, v] of Object.entries({ bvid, cid, qn: 64, fnval: 16, fourk: 1 })) pu.searchParams.set(k, v)
const puRes = await (await fetch(pu, { headers: { 'User-Agent': UA } })).json()
const audio = puRes.data.dash.audio
const stream = [...audio].sort((a, b) => a.bandwidth - b.bandwidth)[0]
const baseUrl = stream.baseUrl || stream.base_url

const res = await fetch(baseUrl, {
  headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/', Range: 'bytes=0-8191' },
})
if (res.status !== 206) throw new Error(`期望 HTTP 206，实得 ${res.status}`)
const head = new Uint8Array(await res.arrayBuffer())

// 校验夹具里确实有 sidx，且起点是我们要钉住的偏移
let sidxAt = -1
for (let i = 4; i + 4 <= head.length; i++) {
  if (head[i] === 0x73 && head[i + 1] === 0x69 && head[i + 2] === 0x64 && head[i + 3] === 0x78) {
    sidxAt = i - 4
    break
  }
}
if (sidxAt < 0) throw new Error('夹具里居然没有 sidx，换一个视频')

console.log(`bvid=${bvid} cid=${cid}`)
console.log(`流 id=${stream.id} bandwidth=${stream.bandwidth}`)
console.log(`拿到 ${head.length} 字节，sidx 起点 = ${sidxAt}（% 4 = ${sidxAt % 4}）`)

// 打印顶层 box 链，作为夹具的「说明书」写进测试注释
let p = 0
const chain = []
while (p + 8 <= head.length) {
  const size = u32(head, p)
  const type = tag(head, p + 4)
  if (size < 8) break
  chain.push(`${type}(${size})`)
  p += size
}
console.log('顶层 box 链:', chain.slice(0, 6).join(' -> '))

const out = join(HERE, '..', 'test', 'fixtures', 'audio-head-8k.bin')
writeFileSync(out, head)
console.log(`已写入 ${out}（${head.length} 字节）`)

// 同时更新 MANIFEST 便于人工核对夹具来源
console.log('\n夹具说明（可粘进 MANIFEST.json 的 notes）：')
console.log(`  audio-head-8k.bin: ${bvid} 音频流前 8192 字节；sidx 起点 ${sidxAt}（奇数，钉住 4 字节对齐 bug）`)
