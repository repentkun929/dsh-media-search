/**
 * B 站适配器：全部匿名可用（实测，见 B站公开接口匿名探测报告）。
 *
 * ## 端点选择（每一个都是实测比较后的结论，不是照抄文档）
 *
 * - 搜索   `/x/web-interface/search/all/v2`
 *   **不用** `search/type`：实测 `search/type` 纯 UA 下 3/6 次返回 HTTP 412 风控页，
 *   而 `all/v2` 同环境 6/6 成功。两者的 video 字段完全一样（bvid/aid/title/author/
 *   mid/play/video_review/review/favorites/like/duration/pubdate/typename/tag/pic），
 *   `all/v2` 只是多一层 `result[]` 分组（见下方 search() 的注释）。
 *   注意 `search/type` 的「偶尔成功」会骗过冒烟测试 —— 绿灯不代表稳定。
 *
 * - 详情   `/x/web-interface/view/detail`
 *   **不用** `view`：`view` 在部分出口 IP 上会被**无差别** -412（实测换个 bvid、
 *   换成 aid、带不带 buvid3 全是 412），而 `view/detail` 同 IP 下稳定 200。
 *   它一次返回 `{View, Card, Tags, Reply, Related, Spec}`，比 view 还多。
 *
 * - 评论   `/x/v2/reply/main`，oid **直接传 bvid**
 *   实测 oid=aid 与 oid=bvid 返回完全相同的 rpid/点赞/游标（非法 oid 会 code=12002），
 *   所以不需要为了拿 aid 先请求一次 view —— 这正是上面 view 被墙时评论仍可用的原因。
 *   游标翻页：`cursor.next`，结束标志 `cursor.is_end`。
 *
 * - UP 主  `card` + `relation/stat`（card 给昵称/头像/签名/等级，relation 给粉丝/关注）
 * - 相关   `archive/related`（数组，约 40 条，owner/stat 是嵌套结构）
 * - 热门   `popular`（list 数组，同样 owner/stat 嵌套）
 *
 * ## 字段清洗上的两个坑
 * - `title`/`author`/`tag` 带 `<em class="keyword">` 高亮，必须 stripEm；
 * - `pic` 是 `//i2.hdslb.com/...` 协议相对地址，必须 fixPicUrl 补 https:；
 * - `duration` 在搜索结果里是 `"8:9"` 这种**秒不进位**的字符串，
 *   durationToSec 能正确解析成 489 秒，但显示时要按原样或用统一格式，别当 `08:09`。
 */
import {
  arr,
  num,
  obj,
  str,
  type BiliTransport,
} from '../http.ts'
import {
  durationToSec,
  extractBvid,
  fixPicUrl,
  stripEm,
  toISO,
  videoUrl,
  type PageItem,
  type ReplyItem,
  type SeasonInfo,
  type SeasonSection,
  type UserItem,
  type VideoDetail,
  type VideoItem,
} from '../fragment.ts'
import type { ListPage, MediaAdapter, ReplyPage } from './types.ts'
import type { AudioStreamInfo } from '../asr.ts'

/** 搜索结果的 duration 既可能是 "8:9"，也可能是秒数。统一成人读串 + 秒数。 */
function normalizeDuration(v: unknown): { duration: string; durationSec: number } {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const sec = Math.max(0, Math.floor(v))
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    const p = (n: number) => String(n).padStart(2, '0')
    return {
      duration: h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`,
      durationSec: sec,
    }
  }
  const s = str(v)
  return { duration: s, durationSec: durationToSec(s) }
}

/** 搜索结果的一条 video 结果 -> VideoItem。 */
function toVideoItem(raw: unknown): VideoItem | undefined {
  const o = obj(raw)
  const bvid = extractBvid(str(o.bvid))
  if (!bvid) return undefined
  const { duration, durationSec } = normalizeDuration(o.duration)
  const pubdate = num(o.pubdate)
  return {
    bvid,
    aid: num(o.aid),
    title: stripEm(o.title),
    author: stripEm(o.author),
    mid: num(o.mid),
    play: num(o.play),
    danmaku: num(o.video_review),
    reply: num(o.review),
    favorite: num(o.favorites),
    like: num(o.like),
    duration,
    durationSec,
    pubdate,
    pubdateISO: toISO(pubdate),
    tname: str(o.typename),
    tag: stripEm(o.tag),
    pic: fixPicUrl(o.pic),
    url: videoUrl(bvid),
  }
}

/**
 * view/detail 里的 View 对象 -> VideoItem（用于「相关推荐里排除自己」等场景）。
 * related/popular 的条目结构与 search 不同（owner/stat 嵌套），单独走这里。
 */
function nestedToVideoItem(raw: unknown): VideoItem | undefined {
  const o = obj(raw)
  const bvid = extractBvid(str(o.bvid))
  if (!bvid) return undefined
  const stat = obj(o.stat)
  const owner = obj(o.owner)
  const pubdate = num(o.pubdate)
  const { duration, durationSec } = normalizeDuration(o.duration)
  return {
    bvid,
    aid: num(o.aid),
    title: stripEm(o.title),
    author: stripEm(owner.name) || stripEm(o.author),
    mid: num(owner.mid) || num(o.mid),
    play: num(stat.view),
    danmaku: num(stat.danmaku),
    reply: num(stat.reply),
    favorite: num(stat.favorite),
    like: num(stat.like),
    duration,
    durationSec,
    pubdate,
    pubdateISO: toISO(pubdate),
    tname: str(o.tname),
    tag: '',
    pic: fixPicUrl(o.pic),
    url: videoUrl(bvid),
  }
}

/** view/detail 的一条 page -> PageItem。 */
function toPageItem(raw: unknown): PageItem {
  const o = obj(raw)
  return { cid: num(o.cid), page: num(o.page), part: str(o.part), duration: num(o.duration) }
}

/** 合集（ugc_season）解析。无合集返回 null。 */
function toSeason(raw: unknown): SeasonInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const o = obj(raw)
  const id = num(o.id)
  const title = str(o.title)
  if (!id && !title) return null
  const sections: SeasonSection[] = []
  for (const s of arr(o.sections)) {
    const so = obj(s)
    const episodes: SeasonSection['episodes'] = []
    for (const e of arr(so.episodes)) {
      const eo = obj(e)
      const bvid = extractBvid(str(eo.bvid))
      if (!bvid) continue
      episodes.push({ title: stripEm(eo.title), bvid, aid: num(eo.aid) })
    }
    sections.push({ title: str(so.title), episodes })
  }
  return { id, title, sections }
}

/** reply/main 的一条 reply -> ReplyItem。 */
function toReplyItem(raw: unknown): ReplyItem | undefined {
  const o = obj(raw)
  const rpid = str(o.rpid)
  if (!rpid) return undefined
  const member = obj(o.member)
  const content = obj(o.content)
  const ctime = num(o.ctime)
  return {
    rpid,
    author: str(member.uname),
    mid: num(member.mid),
    content: str(content.message),
    like: num(o.like),
    rcount: num(o.rcount),
    ctime,
    ctimeISO: toISO(ctime),
  }
}

export function makeBilibiliAdapter(tp: BiliTransport): MediaAdapter {
  return {
    name: 'bilibili',

    /**
     * 关键词搜索：走 `/x/web-interface/search/all/v2`，从 result 分组里取出 `video` 组。
     *
     * **为什么不用 `search/type`**（曾经用过，被实测否掉）：`search/type` 在纯 UA 下
     * **会被高频 412 风控**。同一时刻连打 6 次对比：
     *   - `search/type`   → 412 HTML、412 HTML、200、200、200、412   （3/6 失败）
     *   - `search/all/v2` → 200 ×6                                   （6/6 成功）
     * 这意味着 `search/type` 有一半概率直接失败 —— 而它「偶尔成功」恰好会让冒烟测试
     * 绿灯通过，把间歇性故障伪装成正常。`all/v2` 才是稳定可用的那个端点。
     *
     * `all/v2` 的代价是返回结构多一层：`result[]` 是按 `result_type` 分组（video /
     * media_bangumi / live / article …），要挑出 `result_type === 'video'` 那一组的
     * `data[]`。这里只取 video 组，其余分组（番剧/直播/专栏）本插件不提供。
     *
     * 不接收排序参数：接口的 `order` 经实测**不能作为排序控制使用**（前三位不随它变化，
     * 后面位置的差异方向也不可信），固定走综合排序。
     */
    async search(q, page, limit): Promise<ListPage> {
      const d = obj(await tp.get('/x/web-interface/search/all/v2', {
        keyword: q,
        page: Math.max(1, page),
      }))
      // result 是分组数组，挑出 result_type === 'video' 的那组
      const videoGroup = arr(d.result).find((g) => str(obj(g).result_type) === 'video')
      const videoData = arr(obj(videoGroup).data)
      const items: VideoItem[] = []
      for (const v of videoData) {
        const item = toVideoItem(v)
        if (item) items.push(item)
      }
      const numResults = num(d.numResults)
      const numPages = num(d.numPages)
      return {
        items: items.slice(0, Math.max(1, limit)),
        nextPage: page + 1,
        // numPages 有时给 0（接口抽风），此时退回「本页取满就还有下一页」
        hasMore: numPages > 0 ? page < numPages : videoData.length > 0,
        total: numResults,
      }
    },

    /**
     * 视频详情：走 `view/detail`（view 在该出口 IP 被无差别 412）。
     * 返回值里最有用的是 `View`；`Card`/`Tags`/`Related` 本插件暂不用，但保留读取路径。
     */
    async detail(id): Promise<VideoDetail> {
      const bvid = extractBvid(id)
      const d = obj(obj(await tp.get('/x/web-interface/view/detail', { bvid })).View)
      const stat = obj(d.stat)
      const owner = obj(d.owner)
      const pages = arr(d.pages).map(toPageItem)
      const pubdate = num(d.pubdate)
      return {
        bvid: extractBvid(str(d.bvid)) || bvid,
        aid: num(d.aid),
        cid: num(d.cid) || (pages[0]?.cid ?? 0),
        title: stripEm(d.title),
        desc: str(d.desc),
        pages,
        stat: {
          view: num(stat.view),
          danmaku: num(stat.danmaku),
          reply: num(stat.reply),
          favorite: num(stat.favorite),
          coin: num(stat.coin),
          like: num(stat.like),
          share: num(stat.share),
        },
        owner: { mid: num(owner.mid), name: str(owner.name), face: fixPicUrl(owner.face) },
        tname: str(d.tname),
        pubdate,
        pubdateISO: toISO(pubdate),
        durationSec: num(d.duration),
        pic: fixPicUrl(d.pic),
        url: videoUrl(extractBvid(str(d.bvid)) || bvid),
        season: toSeason(d.ugc_season),
        copyright: num(d.copyright),
      }
    },

    /**
     * 评论：oid 直接传 **bvid**（实测与 aid 等价），省掉一次 view 请求 ——
     * 这层解耦让「view 被风控」不再连带评论一起失效。
     * mode=3 是热门排序，`next` 是游标（1、2、3…递增），`is_end` 结束。
     */
    async replies(id, page, limit): Promise<ReplyPage> {
      const bvid = extractBvid(id)
      const d = obj(await tp.get('/x/v2/reply/main', {
        oid: bvid,
        type: 1,
        mode: 3,
        next: Math.max(1, page),
      }))
      const cursor = obj(d.cursor)
      const items: ReplyItem[] = []
      for (const r of arr(d.replies)) {
        const item = toReplyItem(r)
        if (item) items.push(item)
      }
      const isEnd = cursor.is_end === 1 || cursor.is_end === true
      return {
        items: items.slice(0, Math.max(1, limit)),
        allCount: num(cursor.all_count),
        hasMore: !isEnd && num(cursor.next) > 0,
      }
    },

    /** UP 主资料：card 拿昵称/头像/签名/等级，relation/stat 拿关注/粉丝。 */
    async user(id): Promise<UserItem> {
      const mid = Number(String(id).replace(/[^\d]/g, '')) || 0
      const d = obj(await tp.get('/x/web-interface/card', { mid }))
      const card = obj(d.card)
      const level = num(obj(card.level_info).current_level)
      // card 的 follower 与 relation/stat 的 follower 实测一致；relation 更权威
      let fans = num(d.follower)
      let following = 0
      try {
        const rel = obj(await tp.get('/x/relation/stat', { vmid: mid }))
        fans = num(rel.follower, fans)
        following = num(rel.following)
      } catch {
        // relation/stat 失败不影响资料主体
      }
      return {
        mid: num(card.mid, mid),
        name: str(card.name),
        face: fixPicUrl(card.face),
        sign: str(card.sign),
        fans,
        following,
        likes: num(card.like_num),
        level,
      }
    },

    /** 相关视频。返回约 40 条，owner/stat 是嵌套结构，走 nestedToVideoItem。 */
    async related(id, limit): Promise<ListPage> {
      const bvid = extractBvid(id)
      const data = await tp.get('/x/web-interface/archive/related', { bvid })
      const items: VideoItem[] = []
      for (const r of arr(data)) {
        const item = nestedToVideoItem(r)
        if (item) items.push(item)
      }
      return { items: items.slice(0, Math.max(1, limit)), nextPage: 0, hasMore: false, total: items.length }
    },

    /** 热门视频。ps 上限 50，pn 翻页；owner/stat 同样是嵌套结构。 */
    async popular(page, limit): Promise<ListPage> {
      const d = obj(await tp.get('/x/web-interface/popular', {
        ps: Math.max(1, Math.min(50, limit)),
        pn: Math.max(1, page),
      }))
      const raw = arr(d.list)
      const items: VideoItem[] = []
      for (const r of raw) {
        const item = nestedToVideoItem(r)
        if (item) items.push(item)
      }
      // popular 接口无稳定的 next 字段；实测翻到底会返回空 list，据此判断
      const hasMore = raw.length > 0
      return {
        items: items.slice(0, Math.max(1, limit)),
        nextPage: hasMore ? page + 1 : 0,
        hasMore,
        total: 0,
      }
    },

    /**
     * 取音频流地址：走 `/x/player/playurl`，**必须带 `fnval=16`**。
     *
     * `fnval=16` 是拿 DASH 格式的关键：不带它返回的是老的 `durl` 分段（整段 flv/mp4），
     * 没有 `dash.audio[]`，也就没有 sidx 索引可用来按时长精确切片段。
     *
     * 匿名可用（实测 200 + code=0），返回的 `baseUrl` 是**带签名的临时地址**，
     * 必须拿到后立刻用 —— 隔久了会 403。
     *
     * 本方法只负责「拿到流列表」，不负责下载音频：下载与切片段在 asr.ts 里
     * （那边需要 Range 请求与 sidx 解析，属于另一层关注点）。
     */
    async audioStreams(bvid: string, cid: number): Promise<AudioStreamInfo[]> {
      const d = obj(await tp.get('/x/player/playurl', {
        bvid,
        cid,
        qn: 64,
        fnval: 16,
        fourk: 1,
      }))
      const dash = obj(d.dash)
      const rawList = arr(dash.audio)
      const out: AudioStreamInfo[] = []
      for (const raw of rawList) {
        const a = obj(raw)
        const baseUrl = str(a.baseUrl) || str(a.base_url)
        if (!baseUrl) continue
        // backupUrl 是一串备用地址；主地址失效时可依次重试
        const backups = arr(a.backupUrl ?? a.backup_url).map((u) => str(u)).filter(Boolean)
        out.push({
          id: num(a.id),
          baseUrl,
          backupUrls: backups,
          bandwidth: num(a.bandwidth),
          mimeType: str(a.mimeType) || str(a.mime_type),
          codecs: str(a.codecs),
        })
      }
      return out
    },
  }
}
