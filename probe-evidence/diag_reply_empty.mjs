/**
 * 诊断：reply/main 现在是不是「带 buvid3 才给评论」？
 * 之前匿名探测（diag_reply_oid.mjs）拿到过 20 条，抓夹具时却全是空，
 * 差别可能在于：抓夹具时带了 Cookie（buvid3），而探测时没带。
 * 也可能是 oid 传 bvid 在**某些视频**上才有效。跑完即删。
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const V = 'https://api.bilibili.com'
const base = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' }

let buvid3 = ''
try {
  const r = await fetch(`${V}/x/frontend/finger/spi`, { headers: base })
  const j = await r.json()
  buvid3 = j.data?.b_3 ?? ''
} catch { /* ignore */ }
console.log('buvid3 =', buvid3 ? buvid3.slice(0, 10) + '…' : '(空)')

async function tryReply(label, oid, { withCookie, mode = 3, next = 1 } = {}) {
  const headers = { ...base }
  if (withCookie && buvid3) headers.Cookie = `buvid3=${buvid3}`
  const url = `${V}/x/v2/reply/main?oid=${oid}&type=1&mode=${mode}&next=${next}`
  try {
    const res = await fetch(url, { headers })
    const t = await res.text()
    if (t.trimStart().startsWith('<')) {
      console.log(`${label.padEnd(46)} HTTP ${res.status} HTML`)
      return
    }
    const j = JSON.parse(t)
    console.log(`${label.padEnd(46)} HTTP ${res.status} code=${j.code} replies=${j.data?.replies?.length ?? 0} all=${j.data?.cursor?.all_count ?? '-'} is_end=${j.data?.cursor?.is_end}`)
  } catch (e) {
    console.log(`${label.padEnd(46)} 异常 ${e.message}`)
  }
  await new Promise((r) => setTimeout(r, 700))
}

const BVID = 'BV1GJ411x7h7'          // Rick Astley，23 万评论
const OID_AID = '80433022'

console.log('\n--- reply/main，oid=bvid，mode 与 cookie 组合 ---')
await tryReply('oid=bvid mode=3 next=1 无cookie', BVID, { withCookie: false })
await tryReply('oid=bvid mode=3 next=1 带cookie', BVID, { withCookie: true })
await tryReply('oid=bvid mode=2 next=1 无cookie', BVID, { withCookie: false, mode: 2 })
await tryReply('oid=bvid mode=2 next=1 带cookie', BVID, { withCookie: true, mode: 2 })
await tryReply('oid=bvid mode=0 next=1 无cookie', BVID, { withCookie: false, mode: 0 })

console.log('\n--- oid=aid 对照 ---')
await tryReply('oid=aid  mode=3 next=1 无cookie', OID_AID, { withCookie: false })
await tryReply('oid=aid  mode=3 next=1 带cookie', OID_AID, { withCookie: true })

console.log('\n--- 另一个视频（BV1JE411V765，6383万播放）---')
await tryReply('BV1JE411V765 mode=3 无cookie', 'BV1JE411V765', { withCookie: false })
await tryReply('BV1JE411V765 mode=2 无cookie', 'BV1JE411V765', { withCookie: false, mode: 2 })

console.log('\n--- 老接口 /x/v2/reply（pn 翻页）---')
for (const [lbl, url] of [
  ['reply?type=1&oid=bvid&pn=1&sort=2 无cookie', `${V}/x/v2/reply?type=1&oid=${BVID}&pn=1&sort=2`],
  ['reply?type=1&oid=aid&pn=1&sort=2 无cookie', `${V}/x/v2/reply?type=1&oid=${OID_AID}&pn=1&sort=2`],
]) {
  try {
    const res = await fetch(url, { headers: base })
    const t = await res.text()
    if (t.trimStart().startsWith('<')) { console.log(`${lbl.padEnd(46)} HTML`); continue }
    const j = JSON.parse(t)
    console.log(`${lbl.padEnd(46)} code=${j.code} replies=${j.data?.replies?.length ?? 0} all=${j.data?.page?.count ?? j.data?.cursor?.all_count ?? '-'}`)
  } catch (e) { console.log(`${lbl.padEnd(46)} 异常 ${e.message}`) }
  await new Promise((r) => setTimeout(r, 700))
}
