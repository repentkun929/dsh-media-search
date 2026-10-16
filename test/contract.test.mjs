/**
 * 契约测试：钉死「接口响应 -> 本插件数据结构」的映射。
 *
 * 测试原则（为什么这样写）：
 * - **夹具全部来自真实响应**（tools/snapshot_fixtures.mjs 抓取脱敏），
 *   所以这些断言验的是真实字段名，不是我想象的字段名。
 * - 每个测试只注入 fetchImpl，不碰真网络 —— 离线可跑、CI 稳定。
 * - 断言的是**行为**（剥 em、补 https、解析时长、失败分类），不是实现细节。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { makeTransport, TransportError } from '../src/http.ts'
import { makeBilibiliAdapter } from '../src/adapters/bilibili.ts'
import {
  stripEm,
  fixPicUrl,
  durationToSec,
  countText,
  extractBvid,
  toISO,
  mediaMetaFrom,
} from '../src/fragment.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', name), 'utf8'))
const fixtureText = (name) => readFileSync(join(HERE, 'fixtures', name), 'utf8')

/* ------------------------------------------------------------------ *
 * 假 fetch：按 URL 片段路由到夹具
 * ------------------------------------------------------------------ */

/**
 * 造一个 fetchImpl，把请求路由到夹具。
 * 记录每次调用的 URL，供「oid 是否用了 bvid」这类断言行验证。
 *
 * 返回值刻意做得像真的 Response：**必须有 json()**。
 * http.ts 的 ensureBuvid3 走 res.json()，只给 text() 会让它静默走进 catch。
 */
function fakeFetch(routes, calls = []) {
  return async (url) => {
    const u = String(url)
    calls.push(u)
    for (const [fragment, handler] of Object.entries(routes)) {
      if (u.includes(fragment)) {
        const r = typeof handler === 'function' ? handler(u) : handler
        if (r instanceof Error) throw r
        const { body, status = 200, contentType = 'application/json' } = r
        return {
          status,
          headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
          text: async () => body,
          json: async () => JSON.parse(body),
        }
      }
    }
    // 未路由到的请求：返回一个明确的 404，避免静默走空
    const body = JSON.stringify({ code: -404, message: `未路由: ${u}` })
    return {
      status: 404,
      headers: { get: () => 'application/json' },
      text: async () => body,
      json: async () => JSON.parse(body),
    }
  }
}

function makeBili(routes, calls = []) {
  const tp = makeTransport({
    userAgent: 'test-agent',
    timeoutMs: 1000,
    buvid3Fallback: false,
    fetchImpl: fakeFetch(routes, calls),
  })
  return { adapter: makeBilibiliAdapter(tp), calls }
}

const json = (o) => ({ body: JSON.stringify(o) })

/* ================================================================== *
 * 1. 纯函数契约（fragment.ts）
 * ================================================================== */

test('stripEm 剥掉 <em class="keyword"> 并解 HTML 实体', () => {
  assert.equal(stripEm('臭<em class="keyword">猫</em>成功狙击老祖'), '臭猫成功狙击老祖')
  // 同一条标题里多处高亮
  assert.equal(
    stripEm('背上的<em class="keyword">猫</em>包是开着的，方便<em class="keyword">猫</em>包'),
    '背上的猫包是开着的，方便猫包',
  )
  assert.equal(stripEm('A &amp; B &lt;tag&gt; &quot;q&quot; &#39;s&#39;&nbsp;end'), 'A & B <tag> "q" \'s\' end')
  // 非字符串输入不抛
  assert.equal(stripEm(undefined), '')
  assert.equal(stripEm(123), '')
})

test('fixPicUrl 给协议相对地址补 https:', () => {
  assert.equal(fixPicUrl('//i1.hdslb.com/bfs/archive/a.jpg'), 'https://i1.hdslb.com/bfs/archive/a.jpg')
  assert.equal(fixPicUrl('http://i0.hdslb.com/x.jpg'), 'https://i0.hdslb.com/x.jpg')
  assert.equal(fixPicUrl('https://i2.hdslb.com/y.jpg'), 'https://i2.hdslb.com/y.jpg')
  assert.equal(fixPicUrl(''), '')
  assert.equal(fixPicUrl(null), '')
})

test('durationToSec 解析三种真实形态，含不进位的 "8:9"', () => {
  // search/type 真实返回过 "8:9"（秒不进位），必须解析成 8*60+9=489
  assert.equal(durationToSec('8:9'), 489)
  assert.equal(durationToSec('21:24'), 1284)
  assert.equal(durationToSec('1:02:33'), 3753)
  assert.equal(durationToSec('0:00'), 0)
  // 数字形态（related/popular 的 duration 是秒数）
  assert.equal(durationToSec(213), 213)
  // 垃圾输入 -> 0，不抛
  assert.equal(durationToSec('abc'), 0)
  assert.equal(durationToSec(''), 0)
  assert.equal(durationToSec(undefined), 0)
})

test('extractBvid 从 BV 号与链接里取 bvid', () => {
  assert.equal(extractBvid('BV1GJ411x7h7'), 'BV1GJ411x7h7')
  assert.equal(extractBvid('https://www.bilibili.com/video/BV1GJ411x7h7/?spm_id_from=333'), 'BV1GJ411x7h7')
  assert.equal(extractBvid('https://www.bilibili.com/video/BV1GJ411x7h7'), 'BV1GJ411x7h7')
  // av 号不转（转换需要额外请求），返回空串让调用方处理
  assert.equal(extractBvid('av80433022'), '')
  assert.equal(extractBvid(''), '')
})

test('countText 万/亿折叠', () => {
  assert.equal(countText(40584), '4.1万')
  assert.equal(countText(107248125), '1.1亿')
  assert.equal(countText(161), '161')
  assert.equal(countText(0), '0')
  assert.equal(countText(undefined), '0')
  assert.equal(countText(-5), '0')
})

test('toISO 对无效时间返回空串而不是抛', () => {
  assert.equal(toISO(1700000000), new Date(1700000000 * 1000).toISOString())
  assert.equal(toISO(0), '')
  assert.equal(toISO(-1), '')
  assert.equal(toISO(undefined), '')
})

/* ================================================================== *
 * 2. 搜索适配器（search/all/v2）
 *
 * 端点从 search/type 改成 all/v2 的原因见 src/adapters/bilibili.ts：实测
 * search/type 纯 UA 下 3/6 次 HTTP 412，all/v2 同环境 6/6 成功。
 * 断点形状随之从「扁平 result[]」变成「result[] 分组，取 video 组」。
 * ================================================================== */

/**
 * 把夹具的扁平 result[] 包成 all/v2 的分组形状（真实响应就是这个结构）。
 * 顺带可选插入干扰分组，验证适配器确实只取 video 组。
 */
function allV2(data, extraGroups = []) {
  return {
    code: 0,
    data: {
      ...data,
      result: [{ result_type: 'video', data: data.result ?? [] }, ...extraGroups],
    },
  }
}

test('search 走 all/v2 端点（不用 search/type），并正确映射字段', async () => {
  const fx = fixture('search-type.json')
  const { adapter, calls } = makeBili({ 'all/v2': json(allV2(fx.data)) })
  const page = await adapter.search('猫', 1, 20)

  // 端点选择是实测结论，钉死防止以后改回 search/type（它会 412）
  assert.ok(calls[0].includes('/x/web-interface/search/all/v2'), `应请求 all/v2，实际: ${calls[0]}`)
  assert.ok(!calls[0].includes('search/type'), `不该走 search/type，实际: ${calls[0]}`)
  // 不接收排序参数：order 实测不能可靠控制排序
  assert.ok(!calls[0].includes('order='), `不该带 order，实际: ${calls[0]}`)

  assert.equal(page.items.length, fx.data.result.length)
  const [a, b, c] = page.items
  const [fa, fb, fc] = fx.data.result

  // <em> 高亮已剥掉（夹具里确实带 <em>，否则这条测试没意义）
  assert.ok(fa.title.includes('<em'), '前提：夹具首条标题应带 <em>，否则测不到 stripEm')
  assert.ok(!a.title.includes('<em'), `标题不该含 <em>，实际: ${a.title}`)
  assert.ok(!b.title.includes('<em'), `标题不该含 <em>，实际: ${b.title}`)
  assert.ok(a.title.includes('猫'))

  // pic 已补 https:
  assert.ok(a.pic.startsWith('https://'), `pic 应补 https:，实际: ${a.pic}`)
  assert.ok(fa.pic.startsWith('//'), '前提：夹具 pic 应是协议相对地址，否则测不到 fixPicUrl')

  // duration 字符串形态 -> 秒数（期望值从夹具的 duration 反推，不写死）
  assert.equal(a.duration, '8:9')
  assert.equal(a.durationSec, 489, '"8:9" 必须解析成 489（秒不进位）')
  assert.equal(b.duration, '21:24')
  assert.equal(b.durationSec, 1284)
  assert.equal(c.duration, '1:02:33')
  assert.equal(c.durationSec, 3753)

  // 字段映射：video_review -> danmaku，review -> reply，favorites -> favorite
  assert.equal(a.danmaku, fa.video_review)
  assert.equal(a.reply, fa.review)
  assert.equal(a.favorite, fa.favorites)
  assert.equal(a.like, fa.like)
  assert.equal(a.play, fa.play)
  // 这几个字段确实存在且非零，避免「映射到了 undefined」也算通过
  assert.ok(a.danmaku > 0 && a.reply > 0 && a.favorite > 0 && a.play > 0)

  // url 统一由 bvid 拼
  assert.equal(a.url, `https://www.bilibili.com/video/${a.bvid}`)
  assert.ok(a.pubdateISO.endsWith('Z'))

  // 分页信息
  assert.equal(page.total, fx.data.numResults)
  assert.equal(page.hasMore, true, '第 1 页应还有下一页')
})

test('search 只取 video 分组，忽略番剧/直播等其他分组', async () => {
  const fx = fixture('search-type.json')
  const { adapter } = makeBili({
    'all/v2': json(allV2(fx.data, [
      { result_type: 'media_bangumi', data: [{ title: '番剧条目', bvid: 'BV1zzzzzzzzzz' }] },
      { result_type: 'live', data: [{ title: '直播条目' }] },
    ])),
  })
  const page = await adapter.search('猫', 1, 20)
  assert.equal(page.items.length, fx.data.result.length, '不该把其他分组的条目算进视频')
  assert.ok(
    page.items.every((v) => v.bvid && /^BV[0-9A-Za-z]{10}$/.test(v.bvid)),
    '返回的每一条都应是视频（带 bvid）',
  )
})

test('search 的 result 里没有 video 组时返回空列表，而不是崩', async () => {
  const { adapter } = makeBili({
    'all/v2': json({
      code: 0,
      data: { numResults: 0, numPages: 0, result: [{ result_type: 'live', data: [{ title: 'x' }] }] },
    }),
  })
  const page = await adapter.search('不存在的词', 1, 20)
  assert.equal(page.items.length, 0)
  assert.equal(page.hasMore, false)
})

test('search 最后一页 hasMore=false', async () => {
  const { adapter } = makeBili({
    'all/v2': json(allV2({
      page: 50, numResults: 1000, numPages: 50, result: fixture('search-type.json').data.result,
    })),
  })
  const page = await adapter.search('猫', 50, 20)
  assert.equal(page.hasMore, false, '第 50/50 页不该说还有下一页')
})

test('search 不给适配器开排序口子（order 已从契约移除）', () => {
  // 断言签名只接受 3 个参数：多传的第 4 个不该出现在请求里
  const r = json(allV2(fixture('search-type.json').data))
  const a = makeBili({ 'all/v2': r })
  return a.adapter.search('猫', 1, 20).then(() => {
    assert.ok(!a.calls[0].includes('order='), `不该带 order，实际: ${a.calls[0]}`)
  })
})

test('search 跳过没有 bvid 的脏条目', async () => {
  const { adapter } = makeBili({
    'all/v2': json(allV2({
      page: 1, numResults: 2, numPages: 1,
      result: [
        { title: '没有 bvid 的条目', play: 1 },   // 应被跳过
        { bvid: 'BV1GJ411x7h7', title: '正常', play: 2, duration: '1:00', pubdate: 1700000000 },
        { bvid: '', title: '空 bvid', play: 3 },  // 应被跳过
      ],
    })),
  })
  const page = await adapter.search('x', 1, 20)
  assert.equal(page.items.length, 1, '只有 1 条有合法 bvid')
  assert.equal(page.items[0].bvid, 'BV1GJ411x7h7')
})

/* ================================================================== *
 * 3. 详情适配器（view/detail）
 * ================================================================== */

test('detail 走 view/detail 端点（不是 view），并读取 View 子对象', async () => {
  const fx = fixture('view-detail.json')
  const { adapter, calls } = makeBili({ 'view/detail': json(fx) })
  const d = await adapter.detail('BV1GJ411x7h7')

  assert.ok(calls[0].includes('/x/web-interface/view/detail'), `应请求 view/detail，实际: ${calls[0]}`)
  // 这条断言是本插件最重要的端点决策：view 在该出口 IP 上无差别 412
  assert.ok(!/\/x\/web-interface\/view\?/.test(calls[0]), '不该请求裸 view 端点')

  const View = fx.data.View
  assert.equal(d.bvid, View.bvid)
  assert.equal(d.title, View.title)
  assert.equal(d.aid, View.aid)
  assert.equal(d.cid, View.cid)

  // 六项互动数据（期望值取自夹具，因为播放量这类计数每次抓取都不同）
  assert.equal(d.stat.view, View.stat.view)
  assert.equal(d.stat.danmaku, View.stat.danmaku)
  assert.equal(d.stat.reply, View.stat.reply)
  assert.equal(d.stat.favorite, View.stat.favorite)
  assert.equal(d.stat.coin, View.stat.coin)
  assert.equal(d.stat.like, View.stat.like)
  // 确认真的映射到了正数，而不是两边都是 undefined
  assert.ok(d.stat.view > 0 && d.stat.danmaku > 0 && d.stat.reply > 0)
  assert.ok(d.stat.favorite > 0 && d.stat.coin > 0 && d.stat.like > 0)

  // owner.face 也走 fixPicUrl
  assert.ok(d.owner.face.startsWith('https://'), `owner.face 应补 https:，实际: ${d.owner.face}`)
  assert.ok(d.owner.name.length > 0)

  assert.equal(d.copyright, View.copyright)
  assert.ok(d.url.includes(d.bvid))
  // 该样本无合集
  assert.equal(d.season, null)
})

test('detail 解析 ugc_season 合集结构', async () => {
  const { adapter } = makeBili({
    'view/detail': json(fixture('view-detail-season.json')),
  })
  const d = await adapter.detail('BV1UQxhefEqs')

  assert.ok(d.season, '该样本应解析出合集')
  assert.ok(d.season.id > 0)
  assert.equal(d.season.title, 'season_placeholder')
  assert.equal(d.season.sections.length, 1)
  const sec = d.season.sections[0]
  assert.equal(sec.title, 'section_1')
  assert.equal(sec.episodes.length, 3)
  // episode 必须带 bvid，否则用户点不进去
  for (const ep of sec.episodes) {
    assert.ok(ep.bvid.startsWith('BV'), `episode 应带 bvid，实际: ${JSON.stringify(ep)}`)
  }
})

test('detail 无合集时 season 为 null 而不是抛', async () => {
  const { adapter } = makeBili({
    'view/detail': json({ code: 0, data: { View: { bvid: 'BV1GJ411x7h7', title: 't', pages: [] } } }),
  })
  const d = await adapter.detail('BV1GJ411x7h7')
  assert.equal(d.season, null)
})

test('detail 对分 P 列表正确映射', async () => {
  const { adapter } = makeBili({
    'view/detail': json({
      code: 0,
      data: {
        View: {
          bvid: 'BV1GJ411x7h7', aid: 1, cid: 10, title: 'multi',
          pages: [
            { cid: 10, page: 1, part: 'P1', duration: 60 },
            { cid: 11, page: 2, part: 'P2', duration: 120 },
          ],
        },
      },
    }),
  })
  const d = await adapter.detail('BV1GJ411x7h7')
  assert.equal(d.pages.length, 2)
  assert.deepEqual(d.pages[0], { cid: 10, page: 1, part: 'P1', duration: 60 })
  // cid 缺失时退回第一分 P 的 cid
  assert.equal(d.cid, 10)
})

/* ================================================================== *
 * 4. 评论适配器（reply/main，oid 用 bvid）
 * ================================================================== */

test('replies 用 bvid 当 oid（省掉 view 请求），并正确映射评论', async () => {
  const fx = fixture('reply.json')
  // 前提：夹具必须非空，否则这条测试测不到映射
  assert.ok(fx.data.replies.length > 0, '前提：reply 夹具应为非空（否则只测了个空循环）')

  const { adapter, calls } = makeBili({ 'reply/main': json(fx) })
  const page = await adapter.replies('BV1GJ411x7h7', 1, 20)

  // 核心断言：oid 必须是 bvid，且不该为了拿 aid 去请求 view
  const replyCall = calls.find((c) => c.includes('reply/main'))
  assert.ok(replyCall, '应请求 reply/main')
  assert.ok(replyCall.includes('oid=BV1GJ411x7h7'), `oid 应是 bvid，实际: ${replyCall}`)
  assert.ok(!calls.some((c) => c.includes('/x/web-interface/view?')), '不该请求裸 view 端点（这正是解耦的意义）')

  assert.equal(page.items.length, fx.data.replies.length)
  for (let i = 0; i < page.items.length; i++) {
    const got = page.items[i]
    const want = fx.data.replies[i]
    assert.equal(got.author, want.member.uname, 'member.uname -> author')
    assert.equal(got.content, want.content.message, 'content.message -> content')
    assert.equal(got.rpid, want.rpid)
    assert.equal(got.like, want.like)
    assert.ok(got.ctimeISO.endsWith('Z'))
  }

  assert.equal(page.allCount, fx.data.cursor.all_count)
  // is_end 为 true 时 hasMore 必须是 false，反之 true
  assert.equal(page.hasMore, !(fx.data.cursor.is_end === 1 || fx.data.cursor.is_end === true))
})

test('replies 在 is_end=1 时 hasMore=false', async () => {
  const { adapter } = makeBili({
    'reply/main': json({
      code: 0,
      data: {
        cursor: { all_count: 20, is_end: 1, next: 0 },
        replies: fixture('reply.json').data.replies,
      },
    }),
  })
  const page = await adapter.replies('BV1GJ411x7h7', 1, 20)
  assert.equal(page.hasMore, false)
})

test('replies 跳过没有 rpid 的脏评论', async () => {
  const { adapter } = makeBili({
    'reply/main': json({
      code: 0,
      data: {
        cursor: { all_count: 3, is_end: 1, next: 0 },
        replies: [
          { content: { message: 'no rpid' } },
          { rpid: '1', member: { uname: 'u' }, content: { message: 'ok' }, like: 1 },
          { rpid: '', content: { message: 'empty rpid' } },
        ],
      },
    }),
  })
  const page = await adapter.replies('BV1GJ411x7h7', 1, 20)
  assert.equal(page.items.length, 1)
  assert.equal(page.items[0].content, 'ok')
})

/* ================================================================== *
 * 5. 相关 / 热门 / UP 主
 * ================================================================== */

test('related 映射嵌套的 owner/stat 结构', async () => {
  const { adapter, calls } = makeBili({
    'archive/related': json(fixture('related.json')),
  })
  const page = await adapter.related('BV1GJ411x7h7', 20)
  assert.ok(calls[0].includes('archive/related'))
  assert.equal(page.items.length, 3)
  const v = page.items[0]
  // owner.name -> author，owner.mid -> mid
  assert.equal(v.author, 'up_0002')
  assert.ok(v.mid > 0)
  // stat.view -> play
  assert.ok(v.play > 0, 'stat.view 应映射到 play')
  assert.ok(v.bvid.startsWith('BV'))
})

test('popular 映射嵌套结构并正确传 ps/pn', async () => {
  const { adapter, calls } = makeBili({
    popular: json(fixture('popular.json')),
  })
  const page = await adapter.popular(1, 20)
  assert.ok(calls[0].includes('ps=20'))
  assert.ok(calls[0].includes('pn=1'))
  assert.equal(page.items.length, 3)
  assert.ok(page.items[0].play > 0)
  assert.equal(page.hasMore, true)
})

test('popular 空 list 时 hasMore=false', async () => {
  const { adapter } = makeBili({ popular: json({ code: 0, data: { list: [] } }) })
  const page = await adapter.popular(99, 20)
  assert.equal(page.items.length, 0)
  assert.equal(page.hasMore, false)
})

test('user 合并 card + relation/stat', async () => {
  const { adapter, calls } = makeBili({
    'web-interface/card': json(fixture('card.json')),
    'relation/stat': json(fixture('relation.json')),
  })
  const u = await adapter.user('546195')
  assert.equal(u.mid, 546195)
  assert.equal(u.name, 'up_0001')
  assert.equal(u.sign, 'signature_placeholder')
  assert.ok(u.fans > 0, '粉丝数应来自 relation/stat')
  assert.ok(u.following > 0)
  assert.ok(typeof u.level === 'number')
  assert.ok(u.face.startsWith('https://'))
  assert.ok(calls.some((c) => c.includes('relation/stat')))
})

test('user 在 relation/stat 失败时仍返回 card 主体（粉丝退回 card.follower）', async () => {
  const { adapter } = makeBili({
    'web-interface/card': json(fixture('card.json')),
    'relation/stat': { body: 'Server Error', status: 500 },
  })
  const u = await adapter.user('546195')
  assert.equal(u.name, 'up_0001', 'relation 失败不该让整个资料失败')
  assert.ok(u.fans > 0, '应退回 card 的 follower')
  assert.equal(u.following, 0, 'relation 拿不到时 following 为 0')
})

/* ================================================================== *
 * 6. 传输层错误分类（http.ts 存在的核心理由）
 * ================================================================== */

test('HTTP 412 + HTML 被判为风控，而不是 JSON 解析错误', async () => {
  const { adapter } = makeBili({
    'all/v2': {
      body: fixtureText('err-html.html'),
      status: 412,
      contentType: 'text/html',
    },
  })
  await assert.rejects(
    () => adapter.search('x', 1, 20),
    (e) => {
      assert.ok(e instanceof TransportError, `应是 TransportError，实际: ${e}`)
      assert.equal(e.kind, 'risk-control')
      assert.equal(e.status, 412)
      // 消息要能指导用户，而不是 "Unexpected token <"
      assert.ok(e.message.includes('风控'), `消息应提到风控: ${e.message}`)
      assert.ok(!e.message.includes('Unexpected token'), '不该暴露 JSON 解析错误')
      return true
    },
  )
})

test('code=-412 的 JSON 响应同样被归为风控', async () => {
  const { adapter } = makeBili({
    'all/v2': json(fixture('err-412.json')),
  })
  await assert.rejects(
    () => adapter.search('x', 1, 20),
    (e) => {
      assert.ok(e instanceof TransportError)
      assert.equal(e.kind, 'risk-control')
      return true
    },
  )
})

test('code=-404 被判为 not-found（视频被删/仅登录可见）', async () => {
  const { adapter } = makeBili({
    'view/detail': json(fixture('err-notfound.json')),
  })
  await assert.rejects(
    () => adapter.detail('BV1GJ411x7h7'),
    (e) => {
      assert.ok(e instanceof TransportError)
      assert.equal(e.kind, 'not-found')
      return true
    },
  )
})

test('评论 oid 非法（12002）被判为 api-error 并带出原始 code', async () => {
  const { adapter } = makeBili({
    'reply/main': json(fixture('err-reply-oid.json')),
  })
  await assert.rejects(
    () => adapter.replies('BV1GJ411x7h7', 1, 20),
    (e) => {
      assert.ok(e instanceof TransportError)
      assert.equal(e.kind, 'api-error')
      assert.ok(e.message.includes('12002'), `消息应含 code: ${e.message}`)
      return true
    },
  )
})

test('HTML 但非 412/404 -> bad-response', async () => {
  const { adapter } = makeBili({
    'all/v2': { body: '<html>oops</html>', status: 503, contentType: 'text/html' },
  })
  await assert.rejects(
    () => adapter.search('x', 1, 20),
    (e) => {
      assert.equal(e.kind, 'bad-response')
      return true
    },
  )
})

test('非 JSON 非 HTML 响应 -> bad-response', async () => {
  const { adapter } = makeBili({
    'all/v2': { body: 'plain text not json', status: 200, contentType: 'text/plain' },
  })
  await assert.rejects(
    () => adapter.search('x', 1, 20),
    (e) => {
      assert.equal(e.kind, 'bad-response')
      return true
    },
  )
})

test('网络异常 -> network，且消息可读', async () => {
  const { adapter } = makeBili({
    'all/v2': new Error('connect ECONNREFUSED'),
  })
  await assert.rejects(
    () => adapter.search('x', 1, 20),
    (e) => {
      assert.equal(e.kind, 'network')
      assert.ok(e.message.includes('ECONNREFUSED'), `应带出底层原因: ${e.message}`)
      return true
    },
  )
})

test('412 时若开启 buvid3Fallback，会带 buvid3 重试一次', async () => {
  let searchHits = 0
  let sawCookie = false
  const mockResponse = (body, status = 200, contentType = 'application/json') => ({
    status,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
    // http.ts 的 ensureBuvid3 走的是 res.json()，fake 必须实现它，
    // 否则会静默走进 catch、拿不到 buvid3、回退被跳过（这正是之前测试假失败的原因）
    json: async () => JSON.parse(body),
  })

  const tp = makeTransport({
    userAgent: 'ua',
    timeoutMs: 1000,
    buvid3Fallback: true,
    fetchImpl: async (url, init) => {
      const u = String(url)
      const headers = init?.headers ?? {}
      if (u.includes('finger/spi')) {
        return mockResponse(JSON.stringify({ code: 0, data: { b_3: 'FAKE-BUVID3' } }))
      }
      searchHits++
      if (headers.Cookie?.includes('buvid3=FAKE-BUVID3')) {
        sawCookie = true
        return mockResponse(JSON.stringify({ code: 0, data: { page: 1, numResults: 0, numPages: 0, result: [] } }))
      }
      return mockResponse('<html>412</html>', 412, 'text/html')
    },
  })
  const adapter = makeBilibiliAdapter(tp)
  await adapter.search('x', 1, 20)
  assert.equal(searchHits, 2, '应重试一次')
  assert.ok(sawCookie, '重试应带上 buvid3 cookie')
})

test('带 buvid3 重试后仍 412 时，错误消息点明「只能换出口 IP」', async () => {
  const mockResponse = (body, status = 200, contentType = 'application/json') => ({
    status,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
    json: async () => JSON.parse(body),
  })
  const tp = makeTransport({
    userAgent: 'ua',
    timeoutMs: 1000,
    buvid3Fallback: true,
    fetchImpl: async (url) => {
      const u = String(url)
      if (u.includes('finger/spi')) {
        return mockResponse(JSON.stringify({ code: 0, data: { b_3: 'FAKE-BUVID3' } }))
      }
      // 无论带不带 cookie 都 412
      return mockResponse('<html>412</html>', 412, 'text/html')
    },
  })
  const adapter = makeBilibiliAdapter(tp)
  await assert.rejects(
    () => adapter.search('x', 1, 20),
    (e) => {
      assert.equal(e.kind, 'risk-control')
      // 这条区分很重要：已经试过回退还 412，说明该换出口 IP 而不是「稍后重试」
      assert.ok(e.message.includes('proxyUrl'), `应建议换出口 IP: ${e.message}`)
      return true
    },
  )
})

test('未开启 buvid3Fallback 时，412 不给「已试过回退」的误导提示', async () => {
  const { adapter } = makeBili({
    'all/v2': { body: '<html>412</html>', status: 412, contentType: 'text/html' },
  })
  await assert.rejects(
    () => adapter.search('x', 1, 20),
    (e) => {
      assert.equal(e.kind, 'risk-control')
      assert.ok(!e.message.includes('已尝试匿名 buvid3'), `没试过就不该那么说: ${e.message}`)
      assert.ok(e.message.includes('稍后重试'))
      return true
    },
  )
})

/* ================================================================== *
 * 7. 前端 meta 契约（防「卡片静默退化成纯文本」）
 * ================================================================== */

test('评论端点绝不带 cookie（带 buvid3 会让它返回空评论的伪成功）', async () => {
  // 实测：reply/main 带 buvid3 恒返回 replies:[] + is_end:true，5 视频交叉 0/5 成功；
  // 无 cookie 4/5 成功。这条测试锁住这个反直觉但关键的规则。
  const seenCookies = []
  const tp = makeTransport({
    userAgent: 'ua',
    timeoutMs: 1000,
    buvid3Fallback: true, // 即便开了回退，评论端点也不该带
    sessdata: 'FAKE-SESSDATA', // 连 SESSDATA 也不该发
    fetchImpl: async (url, init) => {
      seenCookies.push(init?.headers?.Cookie ?? '<无>')
      const body = JSON.stringify(fixture('reply.json'))
      return {
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => body,
        json: async () => JSON.parse(body),
      }
    },
  })
  const adapter = makeBilibiliAdapter(tp)
  await adapter.replies('BV1GJ411x7h7', 1, 20)
  assert.equal(seenCookies.length, 1)
  assert.equal(seenCookies[0], '<无>', `评论请求不该带任何 cookie，实际带了: ${seenCookies[0]}`)
})

test('评论端点遇到 412 也不做 buvid3 回退（回退会带 cookie，反而毁掉响应）', async () => {
  let fingerCalled = false
  let hits = 0
  const tp = makeTransport({
    userAgent: 'ua',
    timeoutMs: 1000,
    buvid3Fallback: true,
    fetchImpl: async (url) => {
      const u = String(url)
      if (u.includes('finger/spi')) {
        fingerCalled = true
        const body = JSON.stringify({ code: 0, data: { b_3: 'X' } })
        return { status: 200, headers: { get: () => 'application/json' }, text: async () => body, json: async () => JSON.parse(body) }
      }
      hits++
      return { status: 412, headers: { get: () => 'text/html' }, text: async () => '<html>412</html>' }
    },
  })
  const adapter = makeBilibiliAdapter(tp)
  await assert.rejects(() => adapter.replies('BV1GJ411x7h7', 1, 20))
  assert.equal(hits, 1, '评论端点不该重试（重试必然带 cookie）')
  assert.equal(fingerCalled, false, '不该为评论端点去取 buvid3')
})

test('非评论端点仍然照常带 cookie（只有评论被特殊对待）', async () => {
  const seen = []
  const tp = makeTransport({
    userAgent: 'ua',
    timeoutMs: 1000,
    buvid3Fallback: false,
    sessdata: 'FAKE-SESSDATA',
    fetchImpl: async (url, init) => {
      seen.push(init?.headers?.Cookie ?? '<无>')
      const body = JSON.stringify(fixture('search-type.json'))
      return {
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => body,
        json: async () => JSON.parse(body),
      }
    },
  })
  const adapter = makeBilibiliAdapter(tp)
  await adapter.search('猫', 1, 20)
  assert.ok(seen[0].includes('SESSDATA=FAKE-SESSDATA'), `搜索应带 SESSDATA，实际: ${seen[0]}`)
})

test('mediaMetaFrom 接受合法的各 kind', () => {
  assert.ok(mediaMetaFrom({ kind: 'bili-search', items: [] }))
  assert.ok(mediaMetaFrom({ kind: 'bili-replies', items: [] }))
  // bili-detail 的列表字段挂在 detail.pages 上
  assert.ok(mediaMetaFrom({ kind: 'bili-detail', detail: { pages: [] } }))
})

test('mediaMetaFrom 拒绝缺字段的脏 meta（触发兜底而不是渲染崩掉）', () => {
  assert.equal(mediaMetaFrom(undefined), undefined)
  assert.equal(mediaMetaFrom(null), undefined)
  assert.equal(mediaMetaFrom({}), undefined)
  assert.equal(mediaMetaFrom({ kind: 'unknown-kind', items: [] }), undefined)
  // items 不是数组
  assert.equal(mediaMetaFrom({ kind: 'bili-search', items: 'nope' }), undefined)
  assert.equal(mediaMetaFrom({ kind: 'bili-search' }), undefined)
  // bili-detail 缺 detail.pages
  assert.equal(mediaMetaFrom({ kind: 'bili-detail', detail: {} }), undefined)
  assert.equal(mediaMetaFrom({ kind: 'bili-detail' }), undefined)
  // 抖音 kind 已随抖音整体移除，必须被拒绝
  assert.equal(mediaMetaFrom({ kind: 'douyin-hot', items: [] }), undefined)
})

test('search 夹具经过适配器后仍能满足 meta 契约（端到端一致性）', async () => {
  const { adapter } = makeBili({ 'all/v2': json(allV2(fixture('search-type.json').data)) })
  const page = await adapter.search('猫', 1, 20)
  // 模拟 tool.ts 的 presentationMeta 投影
  const meta = { kind: 'bili-search', keyword: '猫', page: 1, hasMore: page.hasMore, total: page.total, items: page.items }
  const parsed = mediaMetaFrom(meta)
  assert.ok(parsed, '适配器输出应能通过前端 meta 校验')
  assert.equal(parsed.kind, 'bili-search')
  // 序列化往返后仍合法（meta 会被持久化成 JSON）
  assert.ok(mediaMetaFrom(JSON.parse(JSON.stringify(meta))))
})

test('detail 夹具经过适配器后仍能满足 meta 契约', async () => {
  const { adapter } = makeBili({ 'view/detail': json(fixture('view-detail.json')) })
  const d = await adapter.detail('BV1GJ411x7h7')
  const meta = { kind: 'bili-detail', bvid: d.bvid, detail: d }
  assert.ok(mediaMetaFrom(meta))
  assert.ok(mediaMetaFrom(JSON.parse(JSON.stringify(meta))))
})
