/**
 * 第三诊断：search 首条 video 的真实形状 + view/detail 能否替代 view。
 * 前一个脚本里 search 那一行输出是全空的，怀疑是组结构判断写错或字段确实为空，
 * 必须打印原始结构确认，而不是猜。跑完即删。
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const H = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' }
const V = 'https://api.bilibili.com'
const BVID = 'BV1GJ411x7h7'

const s = await (await fetch(`${V}/x/web-interface/search/all/v2?keyword=${encodeURIComponent('猫')}&page=1`, { headers: H })).json()
console.log('search code =', s.code)
console.log('result 组数 =', (s.result ?? []).length)
for (const g of s.result ?? []) {
  console.log(`  组 result_type=${JSON.stringify(g.result_type)} data=${Array.isArray(g.data) ? `array[${g.data.length}]` : typeof g.data}`)
}
const vg = (s.result ?? []).find((g) => g.result_type === 'video')
console.log('video 组找到?', Boolean(vg), '条数=', vg?.data?.length)
if (vg?.data?.[0]) {
  const v0 = vg.data[0]
  console.log('首条字段:', Object.keys(v0).join(','))
  console.log('首条关键值:', JSON.stringify({
    bvid: v0.bvid, aid: v0.aid, title: v0.title, author: v0.author, mid: v0.mid,
    play: v0.play, danmaku: v0.video_review, duration: v0.duration,
    pubdate: v0.pubdate, typename: v0.typename, tag: v0.tag, pic: v0.pic,
  }, null, 2))
}

// view/detail 的结构：它能不能当 view 的替身？
const d = await (await fetch(`${V}/x/web-interface/view/detail?bvid=${BVID}`, { headers: H })).json()
console.log('\nview/detail code =', d.code)
const data = d.data ?? {}
console.log('顶层 keys:', Object.keys(data).join(','))
const View = data.View ?? {}
console.log('View keys:', Object.keys(View).join(','))
console.log('View 关键值:', JSON.stringify({
  bvid: View.bvid, aid: View.aid, cid: View.cid, title: View.title, desc: (View.desc ?? '').slice(0, 40),
  tname: View.tname, pubdate: View.pubdate, duration: View.duration, copyright: View.copyright,
  stat: View.stat, owner: View.owner, pages: Array.isArray(View.pages) ? View.pages.length : null,
  ugc_season: View.ugc_season ? Object.keys(View.ugc_season) : null,
}, null, 2))

// reply/main 用 bvid 当 oid 是否真能取到评论（还是返回空壳）
for (const oid of [View.aid, BVID]) {
  const r = await (await fetch(`${V}/x/v2/reply/main?oid=${oid}&type=1&mode=3&next=1`, { headers: H })).json()
  console.log(`reply/main oid=${oid} code=${r.code} replies=${r.data?.replies?.length ?? 0} all_count=${r.data?.cursor?.all_count ?? '-'}`)
}
