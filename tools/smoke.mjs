/**
 * 真网络冒烟测试：用真实传输层 + 真实适配器打一遍所有端点。
 *
 * 与 test/contract.test.mjs 的分工：
 * - contract.test.mjs 用夹具，离线、验证映射逻辑；
 * - 本脚本打真接口，验证「夹具所描述的世界仍然存在」。
 * 两者都要有：夹具测不出接口下线，真网络测不出边界条件的确定性。
 *
 * 用法: node tools/smoke.mjs
 */
import { makeTransport } from '../src/http.ts'
import { makeBilibiliAdapter } from '../src/adapters/bilibili.ts'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const tp = makeTransport({
  userAgent: UA,
  timeoutMs: 15000,
  buvid3Fallback: true,
})
const bili = makeBilibiliAdapter(tp)

let pass = 0
let fail = 0
const problems = []

async function check(name, fn) {
  process.stdout.write(`  ${name} ... `)
  try {
    const detail = await fn()
    console.log(`OK ${detail ?? ''}`)
    pass++
  } catch (e) {
    console.log(`FAIL ${e.message}`)
    problems.push(`${name}: ${e.message}`)
    fail++
  }
}

console.log('B 站端点冒烟测试\n')

await check('search 搜索「猫」', async () => {
  const r = await bili.search('猫', 1, 5)
  if (r.items.length === 0) throw new Error('返回 0 条')
  const v = r.items[0]
  if (!v.bvid) throw new Error('首条缺 bvid')
  if (v.title.includes('<em')) throw new Error('标题没剥掉 <em>')
  if (!v.pic.startsWith('https://')) throw new Error('pic 没补 https:')
  if (!(v.durationSec > 0)) throw new Error('durationSec 没解析出来')
  return `${r.items.length} 条，首条「${v.title.slice(0, 18)}」${v.duration}/${v.durationSec}s 播放 ${v.play}`
})

await check('search 翻第 2 页', async () => {
  const r = await bili.search('猫', 2, 5)
  if (r.items.length === 0) throw new Error('第 2 页返回 0 条')
  return `${r.items.length} 条`
})

await check('search 按播放量排序（order=click）', async () => {
  const r = await bili.search('猫', 1, 3, 'click')
  if (r.items.length === 0) throw new Error('返回 0 条')
  return `首条播放 ${r.items[0].play}`
})

await check('detail 视频详情（view/detail）', async () => {
  const d = await bili.detail('BV1GJ411x7h7')
  if (!d.title) throw new Error('缺标题')
  if (!(d.stat.view > 0)) throw new Error('播放量没解析出来')
  if (!(d.cid > 0)) throw new Error('缺 cid')
  return `「${d.title.slice(0, 20)}」播放 ${d.stat.view} 分P ${d.pages.length} 合集 ${d.season ? '有' : '无'}`
})

await check('detail 合集解析', async () => {
  const d = await bili.detail('BV1UQxhefEqs')
  if (!d.season) throw new Error('该视频应带合集但没解析出来')
  const total = d.season.sections.reduce((n, s) => n + s.episodes.length, 0)
  return `合集「${d.season.title}」${d.season.sections.length} 个分区 ${total} 集`
})

await check('replies 评论（oid=bvid，无 cookie）', async () => {
  const r = await bili.replies('BV1GJ411x7h7', 1, 5)
  // 这条最关键：带 cookie 会返回 0 条，必须确认现在是真拿到了
  if (r.items.length === 0) throw new Error('返回 0 条评论（可能又被 cookie 规则影响）')
  const c = r.items[0]
  if (!c.content) throw new Error('首条缺评论正文')
  if (!c.author) throw new Error('首条缺作者')
  return `${r.items.length} 条 / 共 ${r.allCount}，首条「${c.content.slice(0, 16)}」by ${c.author}`
})

await check('replies 翻页（next=2）', async () => {
  const r = await bili.replies('BV1GJ411x7h7', 2, 5)
  if (r.items.length === 0) throw new Error('第 2 页返回 0 条')
  return `${r.items.length} 条`
})

await check('user UP 主资料', async () => {
  const u = await bili.user('546195')
  if (!u.name) throw new Error('缺昵称')
  if (!(u.fans > 0)) throw new Error('粉丝数没解析出来')
  return `「${u.name}」粉丝 ${u.fans} 关注 ${u.following}`
})

await check('related 相关视频', async () => {
  const r = await bili.related('BV1GJ411x7h7', 5)
  if (r.items.length === 0) throw new Error('返回 0 条')
  if (!r.items[0].bvid) throw new Error('首条缺 bvid')
  if (!(r.items[0].play > 0)) throw new Error('stat.view 没映射到 play')
  return `${r.items.length} 条，首条「${r.items[0].title.slice(0, 16)}」`
})

await check('popular 热门', async () => {
  const r = await bili.popular(1, 5)
  if (r.items.length === 0) throw new Error('返回 0 条')
  return `${r.items.length} 条，首条「${r.items[0].title.slice(0, 16)}」`
})

// 注意：别用 BV1xx411c7mD 当「不存在的视频」—— 它其实是 aid=2 的真实稿件（字幕君交流场所）。
// 实测的失败形态有三种，各自分类不同：
//   BV1xxxxxxxxx -> -404 -> not-found
//   BV1111111111 -> -400 -> api-error（参数错误）
//   BV1GJ411x7h8 -> 62002 -> api-error（稿件不可见）
await check('错误分类：不存在的视频应给 not-found', async () => {
  try {
    await bili.detail('BV1xxxxxxxxx')
    throw new Error('本该失败却成功了')
  } catch (e) {
    if (e.message === '本该失败却成功了') throw e
    if (e.kind !== 'not-found') throw new Error(`错误分类是 ${e.kind}，期望 not-found（消息：${e.message}）`)
    return `正确分类为 ${e.kind}`
  }
})

await check('错误分类：不可见稿件应给 api-error 且带出原始 code', async () => {
  try {
    await bili.detail('BV1GJ411x7h8')
    throw new Error('本该失败却成功了')
  } catch (e) {
    if (e.message === '本该失败却成功了') throw e
    if (e.kind !== 'api-error') throw new Error(`错误分类是 ${e.kind}，期望 api-error`)
    if (!e.message.includes('62002')) throw new Error(`消息该带出 code 62002：${e.message}`)
    return `正确分类为 ${e.kind} 并带出 code`
  }
})

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
if (problems.length) {
  console.log('\n失败项：')
  for (const p of problems) console.log(`  - ${p}`)
}
process.exit(fail > 0 ? 1 : 0)
