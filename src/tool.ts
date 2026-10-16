/**
 * 工具层：6 个默认工具（bili_video_search / bili_video_detail / bili_video_replies /
 * bili_video_related / bili_user_profile / bili_popular）+ 1 个可选工具
 * `bili_video_transcript`（`asrEnabled` 默认 true，本机 ASR 环境实测可用；
 * 没装环境时它会返回可读说明而不报错）。
 *
 * 本插件只做 B 站。其他平台（抖音/快手/小红书等）的内容检索不在范围里：
 * 抖音搜索撞登录墙（status_code 2483）、详情 403 网关墙，唯一可用的热榜价值有限；
 * 与其提供一个半残能力，不如明确不提供。
 *
 * 两条贯穿全文件的硬规则（沿用贴吧插件已验证的规则）：
 * 1. **业务失败一律返回 `{text, items:[]}`，绝不 throw** —— throw 只留给参数错误。
 * 2. OUTPUT_SCHEMA 是 `additionalProperties:false`，execute 只能返回 `{text, items}`；
 *    所有额外字段（标题、总数、hasMore…）一律走 presentationMeta。
 */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { Config } from './config.ts'
import { makeTransport } from './http.ts'
import { makeBilibiliAdapter } from './adapters/bilibili.ts'
import {
  fetchAudioSlice,
  probeAsrEnvironment,
  transcribeAudio,
  type AudioStreamInfo,
  type AsrSuccess,
} from './asr.ts'
import {
  countText,
  extractBvid,
  formatTime,
  toJsonObject,
  toJsonObjects,
  type JsonValue,
} from './fragment.ts'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string', required: true },
    items: {
      type: 'array',
      required: true,
      items: { type: 'object', additionalProperties: true },
    },
  },
} as const

function ok(text: string, items: object[]): { text: string; items: Record<string, JsonValue>[] } {
  return { text, items: toJsonObjects(items) }
}

function fail(text: string): { text: string; items: Record<string, JsonValue>[] } {
  return { text, items: [] }
}

/**
 * 搜索排序：**故意不暴露给模型**。
 *
 * 接口确实接受 `order`（totalrank/click/pubdate/dm/stow），但实测它**不能作为排序控制使用**：
 * 同一关键词下六个取值的**前三位 bvid 完全相同**（综合排序是主导的），只有更靠后的位置
 * 才出现差异，而且差异方向不可信 —— 传 `order=click` 时第 5 位出现的是播放 165 的视频，
 * 而不传参时第 5 位是播放 126163 的视频。也就是说它既不是「播放量降序」，也不是稳定的
 * 另一种排序，把它暴露出去会让模型以为自己能按播放量取结果，反而误导用户。
 *
 * 所以搜索固定走默认综合排序（不传 order）。原始实测见 DEVELOPMENT.md 与探测报告。
 */

/** 把任意异常转成给用户看的一句话（TransportError 已经带了可读原因）。 */
function reason(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** 提取条数上限。 */
function clamp(n: unknown, lo: number, hi: number, dflt: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : dflt
  return Math.max(lo, Math.min(hi, v))
}

export function mediaTools(config: Config): ToolDefinition[] {
  const transport = makeTransport({
    userAgent: config.userAgent,
    timeoutMs: config.timeoutMs,
    proxyUrl: config.proxyUrl || undefined,
    sessdata: config.sessdata || undefined,
    buvid3Fallback: config.buvid3Fallback,
  })
  const bili = makeBilibiliAdapter(transport)

  /**
   * 一行视频摘要，三个列表工具共用同一格式。
   * 故意只保留「标题 / UP主 / 时长 / 日期 / 链接」：播放量、弹幕、评论、点赞、
   * 投币、收藏这些明细数据对用户是噪声（用户 m02609 明确说「完全没必要展示」），
   * 需要热度时让模型自己再调一次详情。url 必须渲染出来：否则模型只能报标题，
   * 用户点不回原页面，而模型一旦「补」链接就会编出重复/错误的 BV（实测踩过这个坑）。
   */
  const videoLine = (i: number, v: {
    title: string
    url: string
    author: string
    danmaku: number
    duration: string
    pubdateISO: string
  }) =>
    `${i + 1}. ${v.title} · ${v.author || '未知UP'} · ${v.duration || '未知时长'}`
    + `${v.pubdateISO ? ` · ${v.pubdateISO.slice(0, 10)}` : ''}`
    + `${v.url ? `\n   ${v.url}` : ''}`

  /* ---------------------------------------------------------------- *
   * 1. bili_video_search
   * ---------------------------------------------------------------- */
  const videoSearch = defineTool({
    name: 'bili_video_search',
    description:
      '按关键词搜索 B 站视频（返回 bvid/标题/UP主/播放/弹幕/评论/收藏/点赞/时长/发布时间/分区/标签/封面/链接）。'
      + '当用户说「B 站上搜/找某个视频」「某话题在 B 站有什么内容」时使用。'
      + '按B站综合排序返回，支持 page 翻页（每页 20 条）。'
      + '注意：单次默认只返回 10 条——结果过长会被宿主从中截断，中间的视频链接会一起丢失；'
      + '需要更多结果请翻页（page=2/3…），不要一次要满 20 条。',
    parameters: {
      keyword: { type: 'string', required: true, description: '搜索关键词，如「鸣潮 心月狐」' },
      page: { type: 'number', description: '页码，从 1 开始，默认 1；每页 20 条' },
      limit: { type: 'number', description: `本页最多返回条数，默认 ${config.maxItems}` },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (args, value) => {
        const first = value.items[0] as Record<string, unknown> | undefined
        return {
          kind: 'bili-search',
          keyword: typeof args.keyword === 'string' ? args.keyword : '',
          page: typeof first?.page === 'number' ? first.page : 1,
          hasMore: first?.hasMore === true,
          total: typeof first?.total === 'number' ? first.total : 0,
          items: value.items,
        }
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const keyword = typeof args.keyword === 'string' ? args.keyword.trim() : ''
      if (!keyword) throw new Error('bili_video_search: keyword 是必填参数')
      const page = clamp(args.page, 1, 50, 1)
      const limit = clamp(args.limit, 1, 50, config.maxItems)
      try {
        const r = await bili.search(keyword, page, limit)
        if (r.items.length === 0) {
          return fail(`B 站没有搜到与「${keyword}」相关的视频（第 ${page} 页；换个更短的关键词试试）`)
        }
        const lines = r.items.map((v, i) => videoLine(i, v))
        const nav = r.hasMore
          ? `还有下一页：继续调用本工具并传 page=${page + 1}`
          : `已经是最后一页（第 ${page} 页）`
        const total = r.total > 0 ? `（共约 ${countText(r.total)} 条结果）` : ''
        const text = [
          `B 站搜索「${keyword}」第 ${page} 页，返回 ${r.items.length} 条${total}：`,
          ...lines,
          nav,
        ].join('\n')
        return ok(text, r.items.map((v) => ({ ...v, page, hasMore: r.hasMore, total: r.total })))
      } catch (e) {
        return fail(`B 站搜索「${keyword}」失败：${reason(e)}`)
      }
    },
    presentCall: () => ({ card: 'generic', title: 'B 站搜索', kind: 'other' }),
    presentResult(_args, result) {
      if (result.isError) return undefined
      const meta = result.meta as { items?: unknown[] } | undefined
      const n = Array.isArray(meta?.items) ? meta.items.length : 0
      return { card: 'generic', title: `B 站搜索 · ${n} 条`, kind: 'other' }
    },
  })

  /* ---------------------------------------------------------------- *
   * 2. bili_video_detail
   * ---------------------------------------------------------------- */
  const videoDetail = defineTool({
    name: 'bili_video_detail',
    description:
      '读取一个 B 站视频的详情：标题、简介、分 P 列表、合集结构、UP 主、互动数据、分区、发布时间。'
      + '当用户给了 BV 号或 bilibili.com/video/BV... 链接、或要「总结某个视频讲了什么」时使用（第一步就调它）。'
      + '注意：CC 字幕匿名拿不到（接口的 subtitles 恒为空），本插件不提供字幕。',
    parameters: {
      bvid: { type: 'string', required: true, description: 'BV 号，或 https://www.bilibili.com/video/BV... 完整链接' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (args, value) => {
        // detail 是整体结构（不是列表），放在 meta.detail 上，由 mediaMetaFrom 单独校验。
        // 注意走 toJsonObject 转换：JsonValue 是递归联合类型，VideoDetail 不能直接赋值上去。
        const first = value.items[0] as Record<string, JsonValue> | undefined
        const bvid = typeof first?.bvid === 'string'
          ? first.bvid
          : (typeof args.bvid === 'string' ? extractBvid(args.bvid) : '')
        return { kind: 'bili-detail', bvid, detail: first ?? {} }
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const raw = typeof args.bvid === 'string' ? args.bvid.trim() : ''
      const bvid = extractBvid(raw)
      if (!bvid) {
        throw new Error('bili_video_detail: bvid 是必填参数（BV 号或含 BV... 的链接）')
      }
      try {
        const d = await bili.detail(bvid)
        if (!d.title) return fail(`视频 ${bvid} 没有取到详情（可能已被删除、仅登录可见，或 BV 号有误）`)
        const desc = d.desc.length > config.maxDescChars
          ? `${d.desc.slice(0, config.maxDescChars)}…（简介已截断，原文 ${d.desc.length} 字）`
          : d.desc
        const lines = [
          `标题：${d.title}`,
          `UP 主：${d.owner.name}（mid ${d.owner.mid}） · 分区：${d.tname || '未知'}`,
          `时长 ${Math.floor(d.durationSec / 60)}分${d.durationSec % 60}秒 · 发布 ${formatTime(d.pubdate)}`
          + ` · ${d.copyright === 1 ? '自制' : d.copyright === 2 ? '转载' : '版权未知'}`,
          `链接：${d.url}`,
        ]
        if (d.pages.length > 1) {
          lines.push(`分 P（共 ${d.pages.length} 个）：`)
          for (const p of d.pages.slice(0, 30)) {
            lines.push(`  P${p.page} ${p.part}（${Math.floor(p.duration / 60)}分${p.duration % 60}秒）`)
          }
        }
        if (d.season) {
          lines.push(`合集《${d.season.title}》：`)
          for (const s of d.season.sections) {
            lines.push(`  ${s.title}（${s.episodes.length} 集）`)
            for (const ep of s.episodes.slice(0, 20)) lines.push(`    ${ep.title}`)
          }
        }
        if (desc) lines.push(`简介：${desc}`)
        return ok(lines.join('\n'), [{ ...toJsonObject(d), bvid: d.bvid }])
      } catch (e) {
        return fail(`读取视频 ${bvid} 详情失败：${reason(e)}`)
      }
    },
    presentCall: () => ({ card: 'generic', title: 'B 站视频详情', kind: 'other' }),
    presentResult(_args, result) {
      if (result.isError) return undefined
      const meta = result.meta as { detail?: { title?: string } } | undefined
      return { card: 'generic', title: meta?.detail?.title ? `视频 · ${meta.detail.title}` : 'B 站视频详情', kind: 'other' }
    },
  })

  /* ---------------------------------------------------------------- *
   * 3. bili_video_replies
   * ---------------------------------------------------------------- */
  const videoReplies = defineTool({
    name: 'bili_video_replies',
    description:
      '读取一个 B 站视频的评论（昵称/内容/点赞/楼中楼数/总评论数）。'
      + '当用户想了解观众反馈、要看「评论区在说什么」、或要配合详情总结一个视频时使用。'
      + '注意：评论数可能上万，本工具按热度排序抽样返回前 N 条，不要把全部评论塞进上下文；可用 page 翻页。',
    parameters: {
      bvid: { type: 'string', required: true, description: 'BV 号，或含 BV... 的完整链接' },
      page: { type: 'number', description: '翻页游标页码，从 1 开始，默认 1；每页约 20 条' },
      limit: { type: 'number', description: `本页最多返回条数，默认 ${config.maxReplies}` },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (args, value) => {
        const first = value.items[0] as Record<string, unknown> | undefined
        return {
          kind: 'bili-replies',
          bvid: typeof args.bvid === 'string' ? extractBvid(args.bvid) : '',
          aid: typeof first?.aid === 'number' ? first.aid : 0,
          page: typeof first?.page === 'number' ? first.page : 1,
          hasMore: first?.hasMore === true,
          allCount: typeof first?.allCount === 'number' ? first.allCount : 0,
          items: value.items,
        }
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const raw = typeof args.bvid === 'string' ? args.bvid.trim() : ''
      const bvid = extractBvid(raw)
      if (!bvid) throw new Error('bili_video_replies: bvid 是必填参数（BV 号或含 BV... 的链接）')
      const page = clamp(args.page, 1, 100, 1)
      const limit = clamp(args.limit, 1, 50, config.maxReplies)
      try {
        const r = await bili.replies(bvid, page, limit)
        if (r.items.length === 0) {
          return fail(`视频 ${bvid} 第 ${page} 页没有取到评论（可能已翻到底、评论已关闭，或视频被删）`)
        }
        const lines = r.items.map(
          (c, i) => `${i + 1}. ${c.author}（赞 ${countText(c.like)}${c.rcount ? ` · 楼中楼 ${c.rcount}` : ''}）`
            + `：${c.content.slice(0, 200)}`,
        )
        const count = r.allCount > r.items.length
          ? `（全视频共约 ${countText(r.allCount)} 条，本页取前 ${r.items.length} 条）`
          : `（共 ${r.items.length} 条）`
        const nav = r.hasMore
          ? `还有下一页：继续调用本工具并传 page=${page + 1}`
          : `已经是最后一页`
        const text = [`视频 ${bvid} 的评论${count}：`, ...lines, nav].join('\n')
        return ok(text, r.items.map((c) => ({ ...c, aid: 0, page, hasMore: r.hasMore, allCount: r.allCount })))
      } catch (e) {
        return fail(`读取视频 ${bvid} 评论失败：${reason(e)}`)
      }
    },
    presentCall: () => ({ card: 'generic', title: 'B 站评论', kind: 'other' }),
    presentResult(_args, result) {
      if (result.isError) return undefined
      const meta = result.meta as { items?: unknown[] } | undefined
      const n = Array.isArray(meta?.items) ? meta.items.length : 0
      return { card: 'generic', title: `B 站评论 · ${n} 条`, kind: 'other' }
    },
  })

  /* ---------------------------------------------------------------- *
   * 4. bili_video_related
   * ---------------------------------------------------------------- */
  const videoRelated = defineTool({
    name: 'bili_video_related',
    description:
      '读取一个 B 站视频的相关推荐视频（同搜索结果的字段）。'
      + '当用户看完一个视频想找同类内容、或想知道「这个 UP/这个题材还有什么」时使用。'
      + '注意：默认只返回 10 条，结果过长会被宿主从中截断导致中间链接丢失；需要更多请自行翻页或分次查询。',
    parameters: {
      bvid: { type: 'string', required: true, description: 'BV 号，或含 BV... 的完整链接' },
      limit: { type: 'number', description: `最多返回条数，默认 ${config.maxItems}（接口约给 40 条）` },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (args, value) => ({
        kind: 'bili-related',
        bvid: typeof args.bvid === 'string' ? extractBvid(args.bvid) : '',
        items: value.items,
      }),
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const raw = typeof args.bvid === 'string' ? args.bvid.trim() : ''
      const bvid = extractBvid(raw)
      if (!bvid) throw new Error('bili_video_related: bvid 是必填参数（BV 号或含 BV... 的链接）')
      const limit = clamp(args.limit, 1, 50, config.maxItems)
      try {
        // related 在 MediaAdapter 上是可选方法（未来接其他平台时可能没有），这里显式判空而不是用 `!`
        if (!bili.related) return fail('当前适配器不支持相关推荐')
        const r = await bili.related(bvid, limit)
        if (r.items.length === 0) return fail(`视频 ${bvid} 没有取到相关推荐（可能视频被删或接口变动）`)
        const lines = r.items.map((v, i) => videoLine(i, v))
        const text = [`视频 ${bvid} 的相关推荐，返回 ${r.items.length} 条：`, ...lines].join('\n')
        return ok(text, r.items)
      } catch (e) {
        return fail(`读取视频 ${bvid} 相关推荐失败：${reason(e)}`)
      }
    },
    presentCall: () => ({ card: 'generic', title: 'B 站相关推荐', kind: 'other' }),
    presentResult(_args, result) {
      if (result.isError) return undefined
      const meta = result.meta as { items?: unknown[] } | undefined
      const n = Array.isArray(meta?.items) ? meta.items.length : 0
      return { card: 'generic', title: `相关推荐 · ${n} 条`, kind: 'other' }
    },
  })

  /* ---------------------------------------------------------------- *
   * 5. bili_user_profile
   * ---------------------------------------------------------------- */
  const userProfile = defineTool({
    name: 'bili_user_profile',
    description:
      '读取一个 B 站 UP 主的资料（昵称/粉丝/关注/获赞/等级/签名/头像）。'
      + '当用户问某个 UP 主是谁、有多少粉丝、或要判断一个视频作者的分量时使用。',
    parameters: {
      mid: { type: 'string', required: true, description: 'UP 主的 mid（数字 id），或 space.bilibili.com/<mid> 链接' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (args, value) => {
        const first = value.items[0] as Record<string, unknown> | undefined
        const mid = typeof first?.mid === 'number'
          ? first.mid
          : Number(String(args.mid ?? '').replace(/[^\d]/g, '')) || 0
        return { kind: 'bili-user', mid, items: value.items }
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const raw = typeof args.mid === 'string' ? args.mid.trim() : ''
      const mid = raw.replace(/[^\d]/g, '')
      if (!mid) throw new Error('bili_user_profile: mid 是必填参数（数字 id 或 space.bilibili.com/<mid> 链接）')
      try {
        const u = await bili.user(mid)
        if (!u.name) return fail(`UP 主 ${mid} 没有取到资料（mid 是否正确？账号可能已注销）`)
        const text = [
          `UP 主：${u.name}（mid ${u.mid}）`,
          `粉丝 ${countText(u.fans)} · 等级 Lv${u.level}`,
          u.sign ? `签名：${u.sign}` : '',
          `主页：https://space.bilibili.com/${u.mid}`,
        ].filter(Boolean).join('\n')
        return ok(text, [u])
      } catch (e) {
        return fail(`读取 UP 主 ${mid} 资料失败：${reason(e)}`)
      }
    },
    presentCall: () => ({ card: 'generic', title: 'B 站 UP 主', kind: 'other' }),
    presentResult(_args, result) {
      if (result.isError) return undefined
      const meta = result.meta as { items?: { name?: string }[] } | undefined
      const name = Array.isArray(meta?.items) ? meta.items[0]?.name : undefined
      return { card: 'generic', title: name ? `UP 主 · ${name}` : 'B 站 UP 主', kind: 'other' }
    },
  })

  /* ---------------------------------------------------------------- *
   * 6. bili_popular
   * ---------------------------------------------------------------- */
  const popular = defineTool({
    name: 'bili_popular',
    description:
      '读取 B 站当前热门视频榜。当用户说「B 站上现在什么火」「今天有什么热门视频」时使用。'
      + '注意：只提供全站榜（多分区榜单需要用分区 id，与站点体系不一致，实测不可靠）。'
      + '默认只返回 10 条，避免结果过长被宿主截断导致中间链接丢失。',
    parameters: {
      page: { type: 'number', description: '页码，从 1 开始，默认 1' },
      limit: { type: 'number', description: `本页最多返回条数，默认 ${config.maxItems}` },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (args, value) => ({
        kind: 'bili-popular',
        page: typeof args.page === 'number' ? Math.floor(args.page) : 1,
        hasMore: value.items.length > 0,
        items: value.items,
      }),
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const page = clamp(args.page, 1, 20, 1)
      const limit = clamp(args.limit, 1, 50, config.maxItems)
      try {
        if (!bili.popular) return fail('当前适配器不支持热门榜')
        const r = await bili.popular(page, limit)
        if (r.items.length === 0) return fail(`B 站热门榜第 ${page} 页没有取到内容（可能已翻到底或接口变动）`)
        const lines = r.items.map((v, i) => videoLine(i, v))
        const text = [`B 站热门视频榜 第 ${page} 页，返回 ${r.items.length} 条（当前快照，不是完整趋势）：`, ...lines].join('\n')
        return ok(text, r.items)
      } catch (e) {
        return fail(`读取 B 站热门榜第 ${page} 页失败：${reason(e)}`)
      }
    },
    presentCall: () => ({ card: 'generic', title: 'B 站热门', kind: 'other' }),
    presentResult(_args, result) {
      if (result.isError) return undefined
      const meta = result.meta as { items?: unknown[] } | undefined
      const n = Array.isArray(meta?.items) ? meta.items.length : 0
      return { card: 'generic', title: `B 站热门 · ${n} 条`, kind: 'other' }
    },
  })

  /* ---------------------------------------------------------------- *
   * 7. bili_video_transcript（音频转写）
   * ---------------------------------------------------------------- */

  /** 依次试几个常见 Python 解释器名，返回第一个能用的。 */
  async function resolvePython(configured: string): Promise<string> {
    if (configured.trim()) return configured.trim()
    for (const cand of ['python', 'python3', 'py']) {
      const probe = await probeAsrEnvironment(cand, 8000)
      if (probe.python) return cand
    }
    return 'python'
  }

  /** 按带宽挑一条音频流。**挑最低码率**：转写只在乎可懂度，拿最小流最快。 */
  function pickStream(streams: AudioStreamInfo[]): AudioStreamInfo | undefined {
    if (streams.length === 0) return undefined
    return [...streams].sort((a, b) => (a.bandwidth || 0) - (b.bandwidth || 0))[0]
  }

  /** 把秒数说成人话。 */
  const secText = (s: number) => {
    const t = Math.max(0, Math.round(s))
    return t >= 60 ? `${Math.floor(t / 60)} 分 ${t % 60} 秒` : `${t} 秒`
  }

  const videoTranscript = defineTool({
    name: 'bili_video_transcript',
    description:
      '把一个 B 站视频的**音频转写成文字稿**（取前若干秒，默认 300 秒）。'
      + '当用户要「这个视频讲了什么」、而简介/分P/评论不足以回答、必须听内容时使用。'
      + '注意三点：(1) B 站 CC 字幕匿名拿不到，本工具是下载音频后做本地语音识别，不是读字幕；'
      + '(2) 默认只覆盖视频开头若干秒，返回文本会写明覆盖范围，**不要把片段内容当成整个视频的内容**；'
      + '(3) 需要本地装好 Python + faster-whisper，未开启时本工具会说明如何启用，而不是报错。',
    parameters: {
      bvid: { type: 'string', required: true, description: 'BV 号，或含 BV... 的完整链接' },
      maxSeconds: {
        type: 'number',
        description: `从视频开头取多少秒来转写，默认 ${config.asrMaxSeconds}（上限 1800）`,
      },
      page: { type: 'number', description: '分 P 序号，从 1 开始，默认 1' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (args, value) => {
        const first = value.items[0] as Record<string, unknown> | undefined
        return {
          kind: 'bili-transcript',
          bvid: typeof first?.bvid === 'string'
            ? first.bvid
            : (typeof args.bvid === 'string' ? extractBvid(args.bvid) : ''),
          title: typeof first?.title === 'string' ? first.title : '',
          coveredSeconds: typeof first?.coveredSeconds === 'number' ? first.coveredSeconds : 0,
          videoSeconds: typeof first?.videoSeconds === 'number' ? first.videoSeconds : 0,
          language: typeof first?.language === 'string' ? first.language : '',
          truncated: first?.truncated === true,
          items: value.items,
        }
      },
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const rawBvid = typeof args.bvid === 'string' ? args.bvid.trim() : ''
      const bvid = extractBvid(rawBvid)
      if (!bvid) throw new Error('bili_video_transcript: bvid 是必填参数（BV 号或含 BV... 的链接）')
      const page = clamp(args.page, 1, 999, 1)
      const wantSeconds = clamp(args.maxSeconds, 10, 1800, config.asrMaxSeconds)

      /* --- 未开启：给出如何启用的说明，不报错 --- */
      if (!config.asrEnabled) {
        return fail(
          '音频转写未启用（当前 asrEnabled=false）。\n'
          + '本插件不自带 ASR 引擎，需要本地环境：\n'
          + '  1. 装 Python 3.9+\n'
          + '  2. pip install faster-whisper av\n'
          + '  3. 在插件配置里设 asrEnabled=true\n'
          + '在此之前，可以用 bili_video_detail 拿简介/分P/合集结构，'
          + '配合 bili_video_replies 看评论，多数「这视频讲什么」的问题已能回答。',
        )
      }

      /* --- 1. 拿 cid + 标题 --- */
      let cid = 0
      let title = ''
      let videoSeconds = 0
      try {
        const d = await bili.detail(bvid)
        title = d.title
        videoSeconds = d.durationSec
        const p = d.pages.find((x) => x.page === page) ?? d.pages[0]
        cid = p?.cid ?? 0
        if (!cid) return fail(`视频 ${bvid} 没有取到 cid（分 P ${page} 是否存在？）`)
        if (p && p.page !== page) {
          return fail(`视频 ${bvid} 没有第 ${page} 个分 P（共 ${d.pages.length} 个）`)
        }
      } catch (e) {
        return fail(`读取视频 ${bvid} 信息失败：${reason(e)}`)
      }

      /* --- 2. Python 环境 --- */
      const pythonPath = await resolvePython(config.asrPythonPath)
      const env = await probeAsrEnvironment(pythonPath)
      if (!env.python) {
        return fail(`音频转写不可用：${env.detail}\n（可用 asrPythonPath 指定解释器路径，例如 C:\\Python312\\python.exe）`)
      }
      if (!env.av || !env.fasterWhisper) {
        return fail(`音频转写环境不完整：${env.detail}`)
      }

      /* --- 3. 拿音频流地址（带签名的临时地址，拿到后立刻用） --- */
      if (!bili.audioStreams) return fail('当前适配器不支持音频流')
      let streams: AudioStreamInfo[]
      try {
        streams = await bili.audioStreams(bvid, cid)
      } catch (e) {
        return fail(`取视频 ${bvid} 的音频流失败：${reason(e)}`)
      }
      const stream = pickStream(streams)
      if (!stream) return fail(`视频 ${bvid} 没有可用的音频流（可能是无声视频）`)

      /* --- 4. 按 sidx 索引精确取前 N 秒音频 --- */
      const fetched = await fetchAudioSlice(stream, {
        seconds: wantSeconds,
        maxSeconds: 1800,
        userAgent: config.userAgent,
        timeoutMs: config.timeoutMs,
      })
      if (!fetched.ok) {
        return fail(`取视频 ${bvid} 的音频片段失败：${fetched.reason}`)
      }
      const slice = fetched.slice

      /* --- 5. 本地 ASR --- */
      const asr = await transcribeAudio(slice.bytes, {
        pythonPath,
        model: config.asrModel,
        language: config.asrLanguage,
        timeoutMs: config.asrTimeoutMs,
      })
      if (!asr.ok) {
        return fail(`视频 ${bvid} 音频转写失败：${asr.reason}`)
      }

      const covered = Math.round(slice.coveredSeconds)
      const wholeVideo = videoSeconds > 0 && covered >= videoSeconds - 2
      const head = [
        `视频：${title || bvid}（${bvid}，分 P ${page}）`,
        wholeVideo
          ? `覆盖范围：整个视频（约 ${secText(videoSeconds)}）`
          : `覆盖范围：**仅前 ${secText(covered)}**`
            + (videoSeconds > 0 ? `（视频全长 ${secText(videoSeconds)}）` : '')
            + '，以下是这段音频的转写',
        `识别语言：${asr.language || '未知'}（置信度 ${(asr.languageProbability * 100).toFixed(0)}%）`
        + ` · 模型 ${config.asrModel} · 音频 ${slice.fragmentCount}/${slice.totalFragments} 个片段`,
      ]
      const body = asr.text.trim()
        ? asr.text.trim()
        : '（这段音频没有识别出文字：可能是纯音乐、无人声，或片段不含有效语音）'

      const text = [
        ...head,
        '',
        body,
        '',
        wholeVideo
          ? '说明：以上覆盖了整个视频。'
          : `说明：以上**只是视频前 ${secText(covered)} 的内容**，不要把它当作整个视频的总结。`
            + `需要更多时可调大 maxSeconds（上限 1800 秒）重试。`,
      ].join('\n')

      const meta: Record<string, JsonValue> = {
        bvid,
        title,
        page,
        cid,
        coveredSeconds: covered,
        videoSeconds,
        language: asr.language,
        languageProbability: asr.languageProbability,
        truncated: !wholeVideo,
        segments: toJsonObjects(asr.segments as unknown as object[]),
        text: asr.text,
      }
      return ok(text, [meta])
    },
    presentCall: () => ({ card: 'generic', title: 'B 站音频转写', kind: 'other' }),
    presentResult(_args, result) {
      if (result.isError) return undefined
      const meta = result.meta as { title?: string; coveredSeconds?: number } | undefined
      const t = meta?.title ? ` · ${meta.title}` : ''
      const c = typeof meta?.coveredSeconds === 'number' ? ` · ${Math.round(meta.coveredSeconds)}s` : ''
      return { card: 'generic', title: `音频转写${t}${c}`, kind: 'other' }
    },
  })

  const tools = [videoSearch, videoDetail, videoReplies, videoRelated, userProfile, popular]
  // asrEnabled=false 时**不注册**转写工具：模型列表里不出现它，就不会去调一个注定要解释禁用的工具。
  if (config.asrEnabled) tools.push(videoTranscript)
  return tools
}
