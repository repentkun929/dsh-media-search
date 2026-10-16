/**
 * 第五诊断：reply/main 的 oid 到底能不能直接传 bvid（省掉一次 view 请求）。
 * 前次输出 all_count 相同、replies=20，看起来能用，但必须确认返回的是**同一批**评论，
 * 而不是「空壳 + 巧合的计数」。同时确认分页是否仍靠 next 游标。跑完即删。
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const H = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' }
const V = 'https://api.bilibili.com'
const BVID = 'BV1GJ411x7h7'

const detail = await (await fetch(`${V}/x/web-interface/view/detail?bvid=${BVID}`, { headers: H })).json()
const aid = detail.data?.View?.aid
console.log('aid =', aid)

const get = async (oid, next) => {
  const j = await (await fetch(`${V}/x/v2/reply/main?oid=${oid}&type=1&mode=3&next=${next}`, { headers: H })).json()
  const rs = j.data?.replies ?? []
  return {
    code: j.code,
    n: rs.length,
    all: j.data?.cursor?.all_count,
    cursorNext: j.data?.cursor?.next,
    isEnd: j.data?.cursor?.is_end,
    firstRpid: rs[0]?.rpid,
    firstLike: rs[0]?.like,
    firstMsg: (rs[0]?.content?.message ?? '').slice(0, 24),
    firstUser: rs[0]?.member?.uname,
  }
}

console.log('\n--- oid = aid ---')
for (const next of [1, 2]) console.log(`next=${next}`, JSON.stringify(await get(aid, next)))
console.log('\n--- oid = bvid ---')
for (const next of [1, 2]) console.log(`next=${next}`, JSON.stringify(await get(BVID, next)))

// 空壳判别：一个几乎不可能有评论的 oid
console.log('\n--- oid = 1（空壳对照）---')
console.log(JSON.stringify(await get(1, 1)))

// reply/main 里 top / top_replies 的结构（置顶评论会出现在列表外）
const top = await (await fetch(`${V}/x/v2/reply/main?oid=${aid}&type=1&mode=3&next=1`, { headers: H })).json()
console.log('\ntop 条数 =', (top.data?.top ?? null)?.replies?.length ?? 0, ' top_replies =', top.data?.top_replies?.length ?? 0)
console.log('cursor keys =', Object.keys(top.data?.cursor ?? {}).join(','))
