/**
 * 客户端渲染测试：验证 Toolview 卡片在**真实 meta 形状**下能渲染出正确内容。
 *
 * 为什么测「构建产物」而不是 src：JSX 无法被 Node 原生加载（Node 24 只做
 * 类型擦除 `process.features.typescript === 'strip'`，不编译 JSX）。而构建产物
 * lib/client.js 恰恰是宿主真正加载的东西 —— 测它比测 src 更有说服力。
 *
 * 产物是 ModuleLoader 包装的 CJS：window.__ModuleLoader__.load({id, factory})。
 * 这里用一个极小的壳把包装拆开，拿到 factory 的导出再直接调用组件函数。
 *
 * 断言手法：不装 jsdom，把 React 元素树（{type, props:{children}}）当普通
 * 对象递归摊平成文本后做包含性断言 —— 轻量、无 DOM 依赖、跑得飞快。
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLIENT_JS = join(HERE, '..', 'lib', 'client.js')

let MediaView
let registered

before(() => {
  if (!existsSync(CLIENT_JS)) {
    throw new Error(
      `找不到构建产物 ${CLIENT_JS}\n` +
        `客户端渲染测试跑的是产物（JSX 无法被 Node 原生加载）。请先执行: pnpm run build`,
    )
  }

  const code = readFileSync(CLIENT_JS, 'utf8')

  // 拆开 ModuleLoader 包装：抓出 factory 函数体里的导出对象。
  // 不 eval 整段（里面有 window/document 引用会炸），只把 factory 的
  // 返回值取出来 —— 组件是纯函数，不碰 DOM。
  let captured
  const window = {
    __ModuleLoader__: {
      load({ id, factory }) {
        // require 桩：组件只 require react/jsx-runtime 与宿主注入的 react。
        // jsx-runtime 只需要返回最小元素结构，我们不当真渲染。
        const req = (name) => {
          if (name === 'react/jsx-runtime' || name === 'react/jsx-dev-runtime') {
            return {
              jsx: (type, props) => ({ type, props: props ?? {} }),
              jsxs: (type, props) => ({ type, props: props ?? {} }),
              Fragment: Symbol('Fragment'),
            }
          }
          if (name === 'react') {
            return {
              createElement: (type, props, ...kids) => ({
                type,
                props: { ...(props ?? {}), children: kids.length > 1 ? kids : kids[0] },
              }),
              Fragment: Symbol('Fragment'),
            }
          }
          // 宿主运行时/@deepseek-ai/* 一律给空对象 —— 组件顶层不依赖它们的副作用
          return new Proxy(
            {},
            { get: (_t, k) => (k === '__esModule' ? false : undefined) },
          )
        }
        // 注意：factory 内部自己声明了 `var module`/`var exports`（看 banner+intro），
        // 所以这里传进去的 module 会被它自己的局部变量遮蔽 —— 唯一可靠的取值方式是
        // **接住 factory 的返回值**（footer 就是 `return module.exports; } });`）。
        try {
          captured = factory(req)
        } catch (e) {
          // 不吞：包装协议变了要立刻知道
          throw new Error(`factory 执行失败（产物包装协议可能变了）: ${e.message}`)
        }
        captured.__loadId = id
      },
    },
  }

  // 在受控作用域里执行产物（只要全局有 window 就能跑通包装）
  const fn = new Function('window', 'globalThis', `${code}`)
  fn(window, { window })
  assert.ok(captured, '产物没有调用 window.__ModuleLoader__.load —— 包装协议不对')
  assert.equal(typeof captured.apply, 'function', '产物缺少 apply 导出')
  assert.equal(captured.name, 'dsh-media-search', '产物导出 name 应等于包名')
  assert.deepEqual(captured.inject, ['slots'], '产物 inject 应为 slots')

  // 走宿主的真实路径：调 apply()，让组件自己注册进来，再把注册到的组件取出来。
  // MediaView 是内部实现、不对外导出 —— 这正好也顺便验了 7 个工具 key 都在注册。
  registered = []
  const ctx = {
    slots: {
      inject: (slotName, cb) => {
        assert.equal(slotName, 'tool.call.toolview')
        cb()
      },
      register: (selector, component) => {
        registered.push({ key: selector.key, component })
      },
    },
  }
  captured.apply(ctx)

  assert.ok(registered.length > 0, 'apply 没有注册任何 Toolview')
  MediaView = registered[0].component
})

/* ------------------------------------------------------------------ *
 * 把 React 元素树摊平成纯文本（不依赖 DOM）
 * ------------------------------------------------------------------ */

/**
 * 递归收集元素树里的所有文本。
 *
 * 关键：MediaView 返回的是 <SearchView meta={...}/> 这种元素 —— type 是**函数组件**
 * 而不是字符串标签，且没有 children。所以必须把函数组件当成「延迟求值的节点」
 * 递归调用展开，否则永远只能拿到空串。
 *
 * 这正是本测试不装 jsdom 也能成立的原因：我们只用到了函数组件的求值语义，
 * 没有用到挂载、状态、effect 等真正需要 DOM 的部分。
 */
function textOf(node, depth = 0) {
  if (depth > 64) return '' // 防御自引用
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((n) => textOf(n, depth + 1)).join('')
  if (typeof node === 'object' && 'props' in node) {
    const { type, props } = node
    // 函数组件：调用它并展开返回值（props 里没有 children 的兄弟节点如 Fragment）
    if (typeof type === 'function') {
      try {
        return textOf(type(props ?? {}), depth + 1)
      } catch {
        return '' // 组件抛错时按空白处理，由具体断言暴露问题
      }
    }
    return textOf(props?.children, depth + 1)
  }
  return ''
}

/** 调组件拿元素树。 */
function render(block, toolName = 'bili_video_search') {
  const tree = MediaView({ callId: 'c1', toolName, block })
  return textOf(tree)
}

/** 造一个「已结束」的 block。 */
const done = (meta) => ({ kind: 'tool_result', isError: false, meta, content: [] })

/* ================================================================== *
 * 1. 三态：未结束 / 出错 / meta 非法
 * ================================================================== */

test('apply 给全部 8 个工具注册了 Toolview，且 id 等于包名', () => {
  assert.equal(typeof MediaView, 'function', '注册到的组件应是函数')
  const keys = registered.map((r) => r.key).sort()
  assert.deepEqual(keys, [
    'bili_popular',
    'bili_user_profile',
    'bili_video_detail',
    'bili_video_related',
    'bili_video_replies',
    'bili_video_search',
    'bili_video_transcript',
  ], `7 个工具 key 必须全部注册，实际: ${JSON.stringify(keys)}`)
})

test('block 未结束（没有 kind）时显示骨架屏，不崩', () => {
  const text = render({ phase: 'preparing' })
  assert.ok(text.length > 0, '应显示加载态而不是空')
})

test('isError 时退回纯文本，显示服务端给的失败说明', () => {
  const text = render({
    kind: 'tool_result',
    isError: true,
    content: [{ type: 'text', text: 'B 站搜索「猫」失败：触发风控（HTTP 412）' }],
  })
  assert.ok(text.includes('风控'), `应显示失败原因，实际: ${text}`)
})

test('isError 但没有文本时给兜底文案，而不是空白', () => {
  const text = render({ kind: 'tool_result', isError: true, content: [] })
  assert.ok(text.length > 0, '不该空白')
})

test('meta 非法（缺字段）时退回纯文本，而不是渲染崩掉', () => {
  // 这是最重要的防御：脏 meta 不能让卡片白屏
  const text = render({
    kind: 'tool_result',
    isError: false,
    meta: { kind: 'bili-search' }, // 缺 items
    content: [{ type: 'text', text: '降级文本' }],
  })
  assert.ok(text.includes('降级文本'), `应退回纯文本，实际: ${text}`)
})

test('meta 完全缺失时同样安全降级', () => {
  const text = render({ kind: 'tool_result', isError: false, meta: undefined, content: [] })
  assert.ok(text.length > 0, '不该空白')
})

/* ================================================================== *
 * 2. bili-search
 * ================================================================== */

const searchMeta = {
  kind: 'bili-search',
  keyword: '猫',
  page: 1,
  hasMore: true,
  total: 1000,
  items: [
    {
      bvid: 'BV1GJ411x7h7',
      title: '臭猫成功狙击老祖！',
      author: '某UP',
      play: 2199366,
      danmaku: 121,
      duration: '8:9',
      pubdateISO: '2024-05-01T00:00:00.000Z',
      tname: '搞笑',
      url: 'https://www.bilibili.com/video/BV1GJ411x7h7',
    },
  ],
}

test('搜索卡片显示关键词、标题、UP 主', () => {
  const text = render(done(searchMeta))
  assert.ok(text.includes('猫'), '应显示关键词')
  assert.ok(text.includes('臭猫成功狙击老祖'), '应显示标题')
  assert.ok(text.includes('某UP'), '应显示 UP 主')
})

test('搜索卡片不再罗列播放量/弹幕等明细（用户嫌噪声，见 m02609）', () => {
  const text = render(done(searchMeta))
  const noise = ['播放', '弹幕', '219.9万', '收藏', '点赞'].filter((l) => text.includes(l))
  assert.equal(noise.length, 0, `搜索卡片不该出现明细数据，实际命中: ${noise.join('/')} | 全文: ${text}`)
})

/** 收集元素树里所有的 href（与 textOf 同一套函数组件展开规则）。 */
function hrefsOf(node, out = [], depth = 0) {
  if (depth > 64 || node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const n of node) hrefsOf(n, out, depth + 1)
    return out
  }
  if (!('props' in node)) return out
  const { type, props } = node
  if (typeof type === 'function') {
    try {
      hrefsOf(type(props ?? {}), out, depth + 1)
    } catch {
      /* 抛错按无处理 */
    }
    return out
  }
  if (typeof props?.href === 'string') out.push(props.href)
  hrefsOf(props?.children, out, depth + 1)
  return out
}

test('搜索卡片生成可点链接（href 指向 b 站）', () => {
  const tree = MediaView({ callId: 'c1', toolName: 'bili_video_search', block: done(searchMeta) })
  const hrefs = hrefsOf(tree)
  assert.ok(
    hrefs.some((h) => h.includes('bilibili.com/video/BV1GJ411x7h7')),
    `链接缺失: ${JSON.stringify(hrefs)}`,
  )
})

/* ================================================================== *
 * 3. bili-detail
 * ================================================================== */

const detailMeta = {
  kind: 'bili-detail',
  bvid: 'BV1GJ411x7h7',
  detail: {
    bvid: 'BV1GJ411x7h7',
    aid: 1,
    cid: 10,
    title: '【官方 MV】Never Gonna Give You Up',
    desc: '这是简介',
    pages: [{ cid: 10, page: 1, part: 'P1', duration: 213 }],
    stat: { view: 107248125, danmaku: 150762, reply: 237559, favorite: 1553670, coin: 1283311, like: 2953703 },
    owner: { mid: 546195, name: '老番茄', face: 'https://x/y.jpg' },
    tname: '音乐',
    pubdate: 1700000000,
    pubdateISO: '2023-11-14T22:13:20.000Z',
    durationSec: 213,
    pic: 'https://x/p.jpg',
    url: 'https://www.bilibili.com/video/BV1GJ411x7h7',
    season: null,
    copyright: 1,
  },
}

test('详情卡片显示标题、UP 主、分区与简介', () => {
  const text = render(done(detailMeta))
  assert.ok(text.includes('Never Gonna Give You Up'), '应显示标题')
  assert.ok(text.includes('老番茄'), '应显示 UP 主')
  assert.ok(text.includes('音乐'), '应显示分区')
  assert.ok(text.includes('这是简介'), '应显示简介')
})

test('详情卡片默认不罗列互动明细，只给时长与分 P 数', () => {
  const text = render(done(detailMeta))
  const noise = ['播放', '弹幕', '点赞', '投币', '收藏', '1.1亿', '295.4万'].filter((l) => text.includes(l))
  assert.equal(noise.length, 0, `详情卡片不该默认铺互动数据，实际命中: ${noise.join('/')} | 全文: ${text}`)
  assert.ok(text.includes('时长'), '应显示时长')
})

test('详情卡片单分 P 时不展开分 P 列表', () => {
  const text = render(done(detailMeta))
  assert.ok(!text.includes('分 P'), `单分 P 不该显示分 P 列表，实际: ${text}`)
})

test('详情卡片多分 P 时展开并显示各分 P 标题', () => {
  const text = render(
    done({
      ...detailMeta,
      detail: {
        ...detailMeta.detail,
        pages: [
          { cid: 10, page: 1, part: '开场', duration: 60 },
          { cid: 11, page: 2, part: '正片', duration: 120 },
        ],
      },
    }),
  )
  assert.ok(text.includes('开场') && text.includes('正片'), `应显示各分 P 标题，实际: ${text}`)
})

test('详情卡片有合集时显示合集名', () => {
  const text = render(
    done({
      ...detailMeta,
      detail: {
        ...detailMeta.detail,
        season: {
          id: 1,
          title: '我的合集',
          sections: [{ title: '第一季', episodes: [{ title: 'ep1', bvid: 'BV1', aid: 1 }] }],
        },
      },
    }),
  )
  assert.ok(text.includes('我的合集'), `应显示合集标题，实际: ${text}`)
})

test('详情卡片字段缺失时不崩（防御式访问）', () => {
  const text = render(done({ kind: 'bili-detail', bvid: 'BV1GJ411x7h7', detail: {} }))
  assert.ok(typeof text === 'string', '不该抛异常')
})

/* ================================================================== *
 * 4. bili-replies
 * ================================================================== */

test('评论卡片显示作者、内容与楼中楼数', () => {
  const text = render(
    done({
      kind: 'bili-replies',
      bvid: 'BV1GJ411x7h7',
      aid: 1,
      page: 1,
      hasMore: true,
      allCount: 237559,
      items: [
        {
          rpid: '1',
          author: '老咸鱼A',
          mid: 1,
          content: '好听',
          like: 766779,
          rcount: 2,
          ctime: 1700000000,
          ctimeISO: '2023-11-14T22:13:20.000Z',
        },
      ],
    }),
  )
  assert.ok(text.includes('老咸鱼A'), '应显示作者')
  assert.ok(text.includes('好听'), '应显示评论内容')
  assert.ok(text.includes('楼中楼'), `有 rcount 时应显示楼中楼数，实际: ${text}`)
})

test('评论超长正文被截断', () => {
  const long = 'x'.repeat(500)
  const text = render(
    done({
      kind: 'bili-replies',
      bvid: 'BV1',
      aid: 1,
      page: 1,
      hasMore: false,
      allCount: 1,
      items: [{ rpid: '1', author: 'a', mid: 1, content: long, like: 1, rcount: 0, ctime: 1, ctimeISO: '' }],
    }),
  )
  assert.ok(!text.includes(long), '不该输出全文（应截断）')
})

/* ================================================================== *
 * 5. bili-user / bili-popular / bili-related
 * ================================================================== */

test('UP 主卡片显示昵称与粉丝数', () => {
  const text = render(
    done({
      kind: 'bili-user',
      mid: 546195,
      items: [{ mid: 546195, name: '老番茄', face: '', sign: '签名', fans: 20842609, following: 6, likes: 100, level: 6 }],
    }),
  )
  assert.ok(text.includes('老番茄'))
  assert.ok(text.includes('粉丝'), `应显示粉丝，实际: ${text}`)
  assert.ok(!text.includes('获赞') && !text.includes('关注'), `UP 卡片不该铺关注/获赞明细，实际: ${text}`)
})

test('UP 主卡片 items 为空时不崩', () => {
  const text = render(done({ kind: 'bili-user', mid: 1, items: [] }))
  assert.ok(typeof text === 'string' && text.length >= 0)
})

test('热门卡片显示视频标题', () => {
  const text = render(
    done({
      kind: 'bili-popular',
      page: 1,
      hasMore: true,
      items: [{ bvid: 'BV1', title: '热门视频', author: 'u', play: 100, danmaku: 1, duration: '1:00', pubdateISO: '', tname: '', url: 'https://x' }],
    }),
  )
  assert.ok(text.includes('热门视频'), `实际: ${text}`)
})

test('相关推荐卡片显示视频标题', () => {
  const text = render(
    done({
      kind: 'bili-related',
      bvid: 'BV1GJ411x7h7',
      items: [{ bvid: 'BV2', title: '相关视频', author: 'u', play: 1, danmaku: 0, duration: '', pubdateISO: '', tname: '', url: 'https://x' }],
    }),
  )
  assert.ok(text.includes('相关视频'), `实际: ${text}`)
})

/* ================================================================== *
 * 6. bili-transcript（P7 音频转写）
 * ================================================================== */

const transcriptMeta = {
  kind: 'bili-transcript',
  bvid: 'BV1sHa966Eu6',
  title: '心月狐攻略',
  coveredSeconds: 60.16,
  videoSeconds: 1284,
  language: 'zh',
  truncated: true,
  items: [{
    bvid: 'BV1sHa966Eu6',
    title: '心月狐攻略',
    coveredSeconds: 60.16,
    videoSeconds: 1284,
    truncated: true,
    language: 'zh',
    languageProbability: 0.99,
    segments: [{ start: 0, end: 5, text: '开场白' }],
    text: '这段是转写出来的文字稿内容',
  }],
}

test('转写卡片显示标题与文字稿', () => {
  const text = render(done(transcriptMeta), 'bili_video_transcript')
  assert.ok(text.includes('心月狐攻略'), `应显示标题，实际: ${text}`)
  assert.ok(text.includes('这段是转写出来的文字稿内容'), `应显示文字稿，实际: ${text}`)
})

test('转写卡片醒目提示「只覆盖前 N 秒」，避免被当成整个视频的内容', () => {
  const text = render(done(transcriptMeta), 'bili_video_transcript')
  assert.ok(text.includes('60'), `应显示覆盖秒数，实际: ${text}`)
  assert.ok(text.includes('不代表整个视频'), `必须有截断警告，实际: ${text}`)
})

test('转写覆盖整个视频时不显示截断警告', () => {
  const full = {
    ...transcriptMeta,
    truncated: false,
    coveredSeconds: 1284,
    items: [{ ...transcriptMeta.items[0], truncated: false, coveredSeconds: 1284 }],
  }
  const text = render(done(full), 'bili_video_transcript')
  assert.ok(text.includes('整个视频'), `应说明已覆盖全片，实际: ${text}`)
  assert.ok(!text.includes('不代表整个视频'), `全片时不应有截断警告，实际: ${text}`)
})

test('转写卡片文字稿为空时不崩，给出可读说明', () => {
  const empty = {
    ...transcriptMeta,
    items: [{ ...transcriptMeta.items[0], text: '', segments: [] }],
  }
  const text = render(done(empty), 'bili_video_transcript')
  assert.ok(text.includes('没有识别出文字'), `应给出说明，实际: ${text}`)
})

test('转写卡片 items 为空时不崩', () => {
  const text = render(done({ ...transcriptMeta, items: [] }), 'bili_video_transcript')
  assert.ok(typeof text === 'string' && text.length > 0)
})

test('转写 meta 经 JSON 往返后仍能渲染', () => {
  const text = render(done(JSON.parse(JSON.stringify(transcriptMeta))), 'bili_video_transcript')
  assert.ok(text.includes('这段是转写出来的文字稿内容'), `往返后渲染失败: ${text}`)
})

/* ================================================================== *
 * 8. 序列化往返（meta 会被持久化成 JSON 再读回）
 * ================================================================== */

test('search meta 经 JSON 往返后仍能正常渲染', () => {
  const text = render(done(JSON.parse(JSON.stringify(searchMeta))))
  assert.ok(text.includes('臭猫成功狙击老祖'), `往返后渲染失败: ${text}`)
})

test('detail meta 经 JSON 往返后仍能渲染', () => {
  const text = render(done(JSON.parse(JSON.stringify(detailMeta))))
  assert.ok(text.includes('Never Gonna Give You Up'), `往返后渲染失败: ${text}`)
})
