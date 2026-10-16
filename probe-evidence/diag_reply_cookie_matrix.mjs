/**
 * 确认「带 buvid3 导致 reply/main 空返回」是**系统性**的，而不是这一个视频的偶然。
 * 用 5 个不同视频 × 带/不带 cookie 交叉验证。跑完即删。
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const V = 'https://api.bilibili.com'
const base = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' }

const r = await fetch(`${V}/x/frontend/finger/spi`, { headers: base })
const buvid3 = (await r.json()).data?.b_3 ?? ''
console.log('buvid3 =', buvid3.slice(0, 10) + '…\n')

const BVIDS = ['BV1GJ411x7h7', 'BV1JE411V765', 'BV1zW411G7Dx', 'BV1RSpp62Ev9', 'BV1ctJC6kEtQ']

let noCookieOk = 0, withCookieOk = 0
for (const bvid of BVIDS) {
  const results = {}
  for (const withCookie of [false, true]) {
    const headers = { ...base }
    if (withCookie) headers.Cookie = `buvid3=${buvid3}`
    try {
      const res = await fetch(`${V}/x/v2/reply/main?oid=${bvid}&type=1&mode=3&next=1`, { headers })
      const t = await res.text()
      const j = t.trimStart().startsWith('<') ? { code: 'HTML' } : JSON.parse(t)
      results[withCookie ? 'cookie' : 'plain'] = `${j.code}/${j.data?.replies?.length ?? 0}条`
    } catch (e) {
      results[withCookie ? 'cookie' : 'plain'] = `异常`
    }
    await new Promise((x) => setTimeout(x, 600))
  }
  const okPlain = results.plain.endsWith('条') && Number(results.plain.split('/')[1].replace('条', '')) > 0
  const okCookie = results.cookie.endsWith('条') && Number(results.cookie.split('/')[1].replace('条', '')) > 0
  if (okPlain) noCookieOk++
  if (okCookie) withCookieOk++
  console.log(`${bvid.padEnd(14)} 无cookie=${results.plain.padEnd(12)} 带cookie=${results.cookie}`)
}

console.log(`\n汇总：无 cookie 成功 ${noCookieOk}/${BVIDS.length}，带 cookie 成功 ${withCookieOk}/${BVIDS.length}`)

// 同一视频重复 3 次无 cookie，确认不是「最后一次才灵」的时序问题
console.log('\n同一视频（BV1GJ411x7h7）无 cookie 连打 3 次：')
for (let i = 1; i <= 3; i++) {
  const res = await fetch(`${V}/x/v2/reply/main?oid=BV1GJ411x7h7&type=1&mode=3&next=1`, { headers: base })
  const j = await res.json()
  console.log(`  第 ${i} 次 replies=${j.data?.replies?.length ?? 0} is_end=${j.data?.cursor?.is_end}`)
  await new Promise((x) => setTimeout(x, 800))
}
