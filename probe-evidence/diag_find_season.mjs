/**
 * 一次性：找一个带 ugc_season 的视频，用于测合集解析。跑完即删。
 * 用搜索接口多取几页，逐个 view/detail 探 ugc_season —— 比猜 BV 号可靠。
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const H = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' }
const V = 'https://api.bilibili.com'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function j(url) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: H })
    const t = await res.text()
    if (!t.trimStart().startsWith('<')) {
      const o = JSON.parse(t)
      if (o.code === 0) return o.data
      if (o.code !== -412 && o.code !== -799) return null
    }
    await sleep(1200 * (i + 1))
  }
  return null
}

// 番剧/合集类关键词更容易命中 ugc_season
const keywords = ['罗翔 刑法', '合集 教程', '电视剧 解说 合集']
const seen = new Set()
outer:
for (const kw of keywords) {
  for (let page = 1; page <= 2; page++) {
    const d = await j(`${V}/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=${page}`)
    const list = d?.result ?? []
    console.log(`kw=${kw} page=${page} -> ${list.length} 条`)
    for (const v of list) {
      if (!v.bvid || seen.has(v.bvid)) continue
      seen.add(v.bvid)
      const det = await j(`${V}/x/web-interface/view/detail?bvid=${v.bvid}`)
      const View = det?.View
      if (View?.ugc_season) {
        const sec = View.ugc_season
        console.log(`\n*** 找到合集视频: ${v.bvid} ***`)
        console.log(`标题: ${View.title}`)
        console.log(`合集名: ${sec.title} id=${sec.id} sections=${sec.sections?.length}`)
        for (const s of sec.sections ?? []) {
          console.log(`  section「${s.title}」episodes=${s.episodes?.length}`)
          for (const e of (s.episodes ?? []).slice(0, 2)) {
            console.log(`    ep bvid=${e.bvid} aid=${e.aid} title=${e.title}`)
          }
        }
        break outer
      }
      await sleep(400)
    }
  }
}
