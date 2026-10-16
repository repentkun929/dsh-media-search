/**
 * 第四诊断：找现役的搜索端点，并确认它的分页/字段。
 * search/all/v2 的 result 组数为 0，必须换。跑完即删。
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const H = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' }
const V = 'https://api.bilibili.com'
const KW = encodeURIComponent('猫')

const cases = [
  ['search/type (video, 无签名)', `/x/web-interface/search/type?search_type=video&keyword=${KW}&page=1`],
  ['search/type (video, order=click)', `/x/web-interface/search/type?search_type=video&keyword=${KW}&page=1&order=click`],
  ['search/type (video, page=2)', `/x/web-interface/search/type?search_type=video&keyword=${KW}&page=2`],
  ['search/wbi/type', `/x/web-interface/wbi/search/type?search_type=video&keyword=${KW}&page=1`],
  ['search/all/v2 (复核)', `/x/web-interface/search/all/v2?keyword=${KW}&page=1`],
  ['search/square', `/x/web-interface/search/square?limit=5`],
]

for (const [label, path] of cases) {
  try {
    const res = await fetch(`${V}${path}`, { headers: H })
    const text = await res.text()
    if (text.trimStart().startsWith('<')) {
      console.log(`${label.padEnd(34)} HTTP ${res.status} HTML`)
      continue
    }
    const j = JSON.parse(text)
    const n = Array.isArray(j.data?.result) ? j.data.result.length : '-'
    const pg = j.data?.page
    console.log(`${label.padEnd(34)} code=${j.code} result[${n}] page=${pg ?? '-'} numResults=${j.data?.numResults ?? '-'} numPages=${j.data?.numPages ?? '-'}`)
    if (j.code === 0 && Array.isArray(j.data?.result) && j.data.result[0]) {
      const v = j.data.result[0]
      console.log('   字段:', Object.keys(v).join(','))
      console.log('   值:', JSON.stringify({
        bvid: v.bvid, aid: v.aid, title: v.title, author: v.author, mid: v.mid,
        play: v.play, danmaku: v.video_review, duration: v.duration,
        pubdate: v.pubdate, typename: v.typename, tag: v.tag,
        pic: v.pic, description: (v.description ?? '').slice(0, 30),
      }, null, 2))
    }
  } catch (e) {
    console.log(`${label.padEnd(34)} 异常 ${e.message}`)
  }
  await new Promise((r) => setTimeout(r, 600))
}
