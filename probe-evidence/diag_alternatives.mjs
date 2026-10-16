/**
 * 第二诊断：确认 view 全挂时，哪些「替代数据源」仍然可用。
 *
 * 动机：view 无差别 -412，而 detail（标题/简介/分P/六项数据）和 replies（需要 aid）
 * 都依赖它。如果存在可用替身，插件就不该整体残废。
 * 跑完即删的诊断脚本。
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const H = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' }

async function probe(label, url) {
  try {
    const res = await fetch(url, { headers: H })
    const text = await res.text()
    if (text.trimStart().startsWith('<')) {
      console.log(`${label.padEnd(34)} HTTP ${res.status} HTML(风控)`)
      return null
    }
    const j = JSON.parse(text)
    const ok = j.code === 0
    const n = ok && j.data
      ? (Array.isArray(j.data) ? `array[${j.data.length}]` : `keys=${Object.keys(j.data).slice(0, 6).join(',')}`)
      : ''
    console.log(`${label.padEnd(34)} HTTP ${res.status} code=${j.code} ${n}`)
    return ok ? j.data : null
  } catch (e) {
    console.log(`${label.padEnd(34)} 异常 ${e.message}`)
    return null
  }
}

const BVID = 'BV1GJ411x7h7'
const AID = '911440945'
const V = 'https://api.bilibili.com'

// 1) view 相关：有没有别的端点也能拿视频元数据？
await probe('web-interface/view', `${V}/x/web-interface/view?bvid=${BVID}`)
await probe('web-interface/viewinfo', `${V}/x/web-interface/viewinfo?bvid=${BVID}`)
await probe('web-interface/view/detail', `${V}/x/web-interface/view/detail?bvid=${BVID}`)
await probe('web-interface/archive/stat', `${V}/x/web-interface/archive/stat?bvid=${BVID}`)
await probe('pgc/view/web/season(非番剧)', `${V}/pgc/view/web/season?ep_id=1`)
await probe('player/wbi/playurl(无签名)', `${V}/x/player/playurl?bvid=${BVID}&cid=1&qn=16`)

// 2) 评论：oid 用 aid 还是 bvid？有没有不需要 aid 的入口？
await probe('reply/main oid=aid', `${V}/x/v2/reply/main?oid=${AID}&type=1&mode=3&next=1`)
await probe('reply/main oid=bvid(错法验证)', `${V}/x/v2/reply/main?oid=${BVID}&type=1&mode=3&next=1`)
await probe('reply?type=1&oid=aid', `${V}/x/v2/reply?type=1&oid=${AID}&pn=1&sort=2`)
await probe('reply/wbi/main(无签名)', `${V}/x/v2/reply/wbi/main?oid=${AID}&type=1&mode=3&next=1`)

// 3) 搜索能不能顺带拿到 aid（这样评论就不必依赖 view）
const s = await probe('search/all/v2(含aid?)', `${V}/x/web-interface/search/all/v2?keyword=%E7%8C%AB&page=1`)
if (s) {
  const g = (s.result ?? []).find((x) => x.result_type === 'video')
  const v0 = g?.data?.[0]
  console.log(`  -> 首条 video 有 aid=${v0?.aid} bvid=${v0?.bvid} 播放=${v0?.play}`)
}

// 4) 相关推荐（related）里也带 aid
const rel = await probe('archive/related', `${V}/x/web-interface/archive/related?bvid=${BVID}`)
if (Array.isArray(rel)) {
  console.log(`  -> related 首条 aid=${rel[0]?.aid} bvid=${rel[0]?.bvid}`)
}

// 5) 换出口：直连 vs 常见代理端口是否存在（只探测端口，不猜协议）
await probe('finger/spi(buvid3)', `${V}/x/frontend/finger/spi`)
