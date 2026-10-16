/**
 * 夹具抽取器：打真实接口 -> 脱敏 -> 只保留本插件用到的字段 -> 写 test/fixtures/*.json
 *
 * 为什么要有这个脚本（而不是手写夹具）：
 * 手写的「假响应」只能验证代码能跑，验证不了**真实字段名**。
 * 这个插件的全部字段映射都是从实测响应里抄的，夹具必须同源，
 * 否则接口改字段名时测试仍全绿，线上却返回空数据。
 *
 * 端点选择必须与 src/adapters/bilibili.ts 保持一致：
 *   search/type（不是 search/all/v2）、view/detail（不是 view）、reply/main oid=bvid。
 * 这里刻意不「顺手」用别的端点，否则夹具就测不到适配器真正走的路径。
 *
 * 脱敏规则：用户名、评论正文、签名、mid/aid/cid 全部替换成稳定假值。
 * 保留的是**结构**：字段名、类型、嵌套层级。
 *
 * 用法: node tools/snapshot_fixtures.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'test', 'fixtures')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** 一个固定存在的公开视频（用于 detail/reply/related 三个夹具）。 */
const SAMPLE_BVID = 'BV1GJ411x7h7'
/** 一个固定存在的 UP 主。 */
const SAMPLE_MID = '546195'

/**
 * buvid3 缓存：实测不带它部分接口（尤其翻页）更容易 -412。
 * 注意：buvid3 **不能**救 `view` 的无差别 412 —— 那是出口 IP 级的拦截，
 * 已在适配器里改用 view/detail 绕开，这里保留 buvid3 只为降低翻页风控。
 */
let buvid3 = ''

async function ensureBuvid3() {
  if (buvid3) return buvid3
  try {
    const res = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
    })
    const j = await res.json()
    if (j.code === 0 && j.data?.b_3) buvid3 = j.data.b_3
  } catch {
    // 拿不到就纯匿名继续
  }
  return buvid3
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 不能带任何 cookie 的端点（与 src/http.ts 的 COOKIELESS_PATHS 保持一致）。
 *
 * 实测：`/x/v2/reply/main` 带上 buvid3 后**必定**返回 replies:[] + is_end:true，
 * 5 个视频交叉验证「无 cookie 成功 4/5、带 cookie 成功 0/5」。
 * 抓夹具时必须遵守同一条规则，否则抓到的就是「空评论」这种伪成功样本。
 */
const COOKIELESS_PATHS = ['/x/v2/reply/main', '/x/v2/reply']
const mustStayCookieless = (path) => COOKIELESS_PATHS.some((p) => path.startsWith(p))

/**
 * 单个接口请求，带 buvid3 与退避重试。
 * 实测 -412 是**间歇性**的：同一 URL 隔几秒重试多半就过（本次抓取 page=2 就撞过一次），
 * 所以重试是必要的；但 view 那种无差别 412 重试也救不了，只能换端点。
 *
 * 注意：评论类端点**不带 cookie**（见上面 COOKIELESS_PATHS 的原因）。
 */
async function api(path, params, { retries = 5 } = {}) {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
  const url = `https://api.bilibili.com${path}?${qs}`
  const cookieless = mustStayCookieless(path)
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt)
    const headers = {
      'User-Agent': UA,
      Referer: 'https://www.bilibili.com/',
      Accept: 'application/json',
    }
    if (!cookieless) {
      const b = await ensureBuvid3()
      if (b) headers.Cookie = `buvid3=${b}`
    }
    let res
    try {
      res = await fetch(url, { headers })
    } catch (e) {
      lastErr = new Error(`${path} -> 网络异常 ${e.message}`)
      continue
    }
    const text = await res.text()
    if (text.trimStart().startsWith('<')) {
      lastErr = new Error(`${path} -> HTTP ${res.status} 返回 HTML（风控）`)
      continue
    }
    let j
    try {
      j = JSON.parse(text)
    } catch {
      lastErr = new Error(`${path} -> 响应不是 JSON（HTTP ${res.status}）`)
      continue
    }
    if (j.code !== 0) {
      lastErr = new Error(`${path} -> code=${j.code} ${j.message ?? ''}`)
      // -412/-799 是风控，可重试；其余（如 -404 视频没了）立即失败
      if (j.code === -412 || j.code === -799) continue
      throw lastErr
    }
    return j.data
  }
  throw lastErr ?? new Error(`${path} -> 重试 ${retries} 次仍失败`)
}

/** 只保留白名单字段，其余丢弃（夹具要小、要只含被测字段）。 */
function pick(o, keys) {
  const out = {}
  for (const k of keys) if (o && Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k]
  return out
}

function fakeId(prefix, n) {
  return `${prefix}_${String(n).padStart(4, '0')}`
}

/** search/type 一条结果里本插件真正读的字段。 */
const VIDEO_PICK = [
  'type', 'aid', 'bvid', 'title', 'author', 'mid', 'play', 'video_review',
  'review', 'favorites', 'like', 'duration', 'pubdate', 'typename', 'tag',
  'pic', 'description', 'arcurl',
]

async function main() {
  mkdirSync(OUT, { recursive: true })
  const manifest = {}

  /* ---- 1. search/type（适配器实际走的搜索端点） ---- */
  const search = await api('/x/web-interface/search/type', {
    search_type: 'video',
    keyword: '猫',
    page: 1,
  })
  /**
   * 取前 3 条，且**保证至少有一条带 <em> 高亮、一条 duration 是多段形态**，
   * 否则 stripEm / durationToSec 的测试就没有真样本可测。
   * duration 不覆盖所有形态时，手工替换成真实见过的形态（见 manifest 注记）。
   */
  const rawVideos = (search.result ?? []).slice(0, 3)
  const DURATION_SHAPES = ['8:9', '21:24', '1:02:33']
  const searchFixture = {
    code: 0,
    data: {
      seid: '0',
      page: search.page ?? 1,
      pagesize: search.pagesize ?? 20,
      numResults: search.numResults,
      numPages: search.numPages,
      // 扁平 result[]，不需要遍历分组
      result: rawVideos.map((v, i) => ({
        ...pick(v, VIDEO_PICK),
        // 保留真实的 <em class="keyword"> 高亮，供 stripEm 测试使用
        title: v.title,
        // 人名/数字脱敏，结构不变
        author: fakeId('up', i + 1),
        mid: 1000000 + i,
        aid: 900000 + i,
        pubdate: 1700000000 + i * 86400,
        // 用力覆盖三种真实时长形态（"8:9" 秒不进位 / "21:24" / "1:02:33" 带小时）
        duration: DURATION_SHAPES[i] ?? v.duration,
      })),
    },
  }
  manifest['search-type.json'] = `search/type?search_type=video keyword=猫，前 ${rawVideos.length} 条；duration 覆盖 ${DURATION_SHAPES.slice(0, rawVideos.length).join(' / ')}`
  writeFileSync(join(OUT, 'search-type.json'), JSON.stringify(searchFixture, null, 2))

  /* ---- 2. search/type 第二页（供翻页测试） ---- */
  const search2 = await api('/x/web-interface/search/type', {
    search_type: 'video',
    keyword: '猫',
    page: 2,
  })
  writeFileSync(join(OUT, 'search-type-p2.json'), JSON.stringify({
    code: 0,
    data: {
      page: search2.page ?? 2,
      pagesize: search2.pagesize ?? 20,
      numResults: search2.numResults,
      numPages: search2.numPages,
      result: (search2.result ?? []).slice(0, 2).map((v, i) => ({
        ...pick(v, VIDEO_PICK),
        title: v.title,
        author: fakeId('up', i + 10),
        mid: 1100000 + i,
        aid: 910000 + i,
        bvid: v.bvid,
        pubdate: 1700000000 + i * 86400,
      })),
    },
  }, null, 2))
  manifest['search-type-p2.json'] = 'search/type 第 2 页，前 2 条'

  /* ---- 3. view/detail（详情，替代被风控的 view） ---- */
  const detail = await api('/x/web-interface/view/detail', { bvid: SAMPLE_BVID })
  const View = detail.View ?? {}
  const viewFixture = {
    code: 0,
    data: {
      View: {
        ...pick(View, ['bvid', 'aid', 'cid', 'title', 'tname', 'pubdate', 'duration', 'copyright', 'pic', 'videos']),
        desc: View.desc,
        stat: pick(View.stat ?? {}, ['view', 'danmaku', 'reply', 'favorite', 'coin', 'like', 'share']),
        owner: { mid: 1000000, name: fakeId('up', 1), face: View.owner?.face },
        pages: (View.pages ?? []).map((p) => pick(p, ['cid', 'page', 'part', 'duration'])),
        // ugc_season 只在有合集时存在；保留它以便测 toSeason
        ...(View.ugc_season ? {
          ugc_season: {
            id: View.ugc_season.id,
            title: View.ugc_season.title,
            sections: (View.ugc_season.sections ?? []).map((s) => ({
              title: s.title,
              episodes: (s.episodes ?? []).slice(0, 4).map((e, i) => ({
                title: `episode_${i + 1}`,
                bvid: e.bvid,
                aid: 800000 + i,
              })),
            })),
          },
        } : {}),
      },
      // 同一次响应里还带这些兄弟字段，保留其「存在」这一事实，防止适配器以后误依赖 view
      Card: { card: { mid: 1000000, name: fakeId('up', 1) } },
      Tags: (detail.Tags ?? []).slice(0, 3).map((t) => ({ tag_name: 'tag_placeholder' })),
      Related: [],
      Reply: { page: { count: View.stat?.reply ?? 0 } },
    },
  }
  manifest['view-detail.json'] = `view/detail bvid=${SAMPLE_BVID}，含 View.stat/owner/pages${View.ugc_season ? '/ugc_season' : '（无合集）'}`
  writeFileSync(join(OUT, 'view-detail.json'), JSON.stringify(viewFixture, null, 2))

  /**
   * 一个有合集的视频（用于测 toSeason）。
   * 这个 BV 号是实测探出来的（search/type 检索「罗翔 刑法」逐条 view/detail 找到的），
   * 不能随便换 —— 大多数视频 ugc_season 为 null。
   */
  const SEASON_BVID = 'BV1UQxhefEqs'
  try {
    const sd = await api('/x/web-interface/view/detail', { bvid: SEASON_BVID })
    const SV = sd.View ?? {}
    if (SV.ugc_season) {
      writeFileSync(join(OUT, 'view-detail-season.json'), JSON.stringify({
        code: 0,
        data: {
          View: {
            ...pick(SV, ['bvid', 'aid', 'cid', 'title', 'tname', 'pubdate', 'duration', 'copyright']),
            desc: SV.desc,
            stat: pick(SV.stat ?? {}, ['view', 'danmaku', 'reply', 'favorite', 'coin', 'like', 'share']),
            owner: { mid: 1000000, name: fakeId('up', 1), face: SV.owner?.face },
            pages: (SV.pages ?? []).map((p) => pick(p, ['cid', 'page', 'part', 'duration'])),
            ugc_season: {
              id: SV.ugc_season.id,
              title: 'season_placeholder',
              sections: (SV.ugc_season.sections ?? []).map((s, si) => ({
                title: `section_${si + 1}`,
                episodes: (s.episodes ?? []).slice(0, 3).map((e, i) => ({
                  title: `episode_${i + 1}`,
                  bvid: e.bvid,
                  aid: 800000 + i,
                })),
              })),
            },
          },
        },
      }, null, 2))
      manifest['view-detail-season.json'] = `view/detail bvid=${SEASON_BVID}，带 ugc_season（用于测合集解析）`
    }
  } catch (e) {
    manifest['view-detail-season.json'] = `（跳过：${e.message}）`
  }

  /* ---- 4. reply/main（oid 直接用 bvid，与适配器一致） ---- */
  /**
   * 评论必须抓到**非空**的样本。
   * 带上 buvid3 会让 reply/main 恒返回空（见 COOKIELESS_PATHS 注释），
   * 所以这里除了遵守无 cookie 规则，还要换不同游标/视频重试，直到非空为止 ——
   * 空夹具会让评论映射测试假绿。
   */
  async function fetchNonEmptyReplies() {
    const candidates = [SAMPLE_BVID, 'BV1JE411V765', 'BV1zW411G7Dx', 'BV1RSpp62Ev9']
    for (const bvid of candidates) {
      for (const next of [1, 2, 3]) {
        try {
          const r = await api('/x/v2/reply/main', { oid: bvid, type: 1, mode: 3, next })
          if (Array.isArray(r.replies) && r.replies.length > 0) {
            console.log(`  reply 夹具取自 bvid=${bvid} next=${next}，${r.replies.length} 条`)
            return r
          }
        } catch (e) {
          console.log(`  reply 尝试 bvid=${bvid} next=${next} 失败：${e.message}`)
        }
        await sleep(700)
      }
    }
    return null
  }

  const reply = await fetchNonEmptyReplies()
  if (!reply) {
    // 宁可让脚本失败，也不要写出一个空的评论夹具让测试假绿
    throw new Error('评论夹具抓取失败：所有候选都返回空 replies，无法生成有意义的夹具')
  }
  const replyFixture = {
    code: 0,
    data: {
      cursor: pick(reply.cursor ?? {}, ['all_count', 'is_end', 'next', 'prev', 'is_begin', 'mode']),
      replies: (reply.replies ?? []).slice(0, 3).map((r, i) => ({
        ...pick(r, ['rpid', 'like', 'rcount', 'ctime']),
        rpid: String(700000000000 + i),
        ctime: 1700000000 + i * 3600,
        member: { uname: fakeId('user', i + 1), mid: 2000000 + i },
        content: { message: `comment_body_${i + 1}` },
      })),
    },
  }
  manifest['reply.json'] = `reply/main oid=bvid，前 ${replyFixture.data.replies.length} 条评论（非空）`
  writeFileSync(join(OUT, 'reply.json'), JSON.stringify(replyFixture, null, 2))

  /* ---- 5. archive/related（owner/stat 嵌套） ---- */
  const related = await api('/x/web-interface/archive/related', { bvid: SAMPLE_BVID })
  writeFileSync(join(OUT, 'related.json'), JSON.stringify({
    code: 0,
    data: (related ?? []).slice(0, 3).map((v, i) => ({
      ...pick(v, ['bvid', 'aid', 'title', 'duration', 'pubdate', 'tname', 'pic']),
      title: v.title,
      owner: { mid: 1000000 + i, name: fakeId('up', i + 2) },
      stat: pick(v.stat ?? {}, ['view', 'danmaku', 'reply', 'favorite', 'like']),
    })),
  }, null, 2))
  manifest['related.json'] = 'archive/related 前 3 条（owner/stat 是嵌套结构，验证 nestedToVideoItem）'

  /* ---- 6. card + relation/stat（UP 主） ---- */
  const card = await api('/x/web-interface/card', { mid: SAMPLE_MID })
  const rel = await api('/x/relation/stat', { vmid: SAMPLE_MID })
  writeFileSync(join(OUT, 'card.json'), JSON.stringify({
    code: 0,
    data: {
      card: {
        mid: Number(SAMPLE_MID),
        name: fakeId('up', 1),
        face: card.card?.face,
        sign: 'signature_placeholder',
        level_info: pick(card.card?.level_info ?? {}, ['current_level']),
        like_num: card.card?.like_num,
      },
      follower: card.follower,
    },
  }, null, 2))
  writeFileSync(join(OUT, 'relation.json'), JSON.stringify({
    code: 0,
    data: pick(rel, ['mid', 'following', 'follower']),
  }, null, 2))
  manifest['card.json'] = `card mid=${SAMPLE_MID}（昵称/签名为假值，level_info 保留真实结构）`
  manifest['relation.json'] = `relation/stat vmid=${SAMPLE_MID}`

  /* ---- 7. popular（热门，同样嵌套结构） ---- */
  const popular = await api('/x/web-interface/popular', { ps: 20, pn: 1 })
  writeFileSync(join(OUT, 'popular.json'), JSON.stringify({
    code: 0,
    data: {
      list: (popular.list ?? []).slice(0, 3).map((v, i) => ({
        ...pick(v, ['bvid', 'aid', 'title', 'duration', 'pubdate', 'tname', 'pic']),
        owner: { mid: 1000000 + i, name: fakeId('up', i + 3) },
        stat: pick(v.stat ?? {}, ['view', 'danmaku', 'reply', 'favorite', 'like']),
      })),
    },
  }, null, 2))
  manifest['popular.json'] = 'popular 前 3 条'

  /* ---- 8. 失败形态夹具（风控 / 错误 code），手写但取自真实报文 ---- */
  // -412 的真实响应体：{"code":-412,"message":"request was banned","ttl":1}
  writeFileSync(join(OUT, 'err-412.json'), JSON.stringify({
    code: -412, message: 'request was banned', ttl: 1,
  }, null, 2))
  // HTML 风控页（真实 412 页面返回 text/html）
  writeFileSync(join(OUT, 'err-html.html'), '<!DOCTYPE html><html><head><title>412</title></head><body>Request blocked.</body></html>')
  // 视频不存在
  writeFileSync(join(OUT, 'err-notfound.json'), JSON.stringify({
    code: -404, message: '啥都木有', ttl: 1,
  }, null, 2))
  // 评论 oid 非法（实测值为 12002）
  writeFileSync(join(OUT, 'err-reply-oid.json'), JSON.stringify({
    code: 12002, message: '评论区已关闭', ttl: 1,
  }, null, 2))
  manifest['err-412.json'] = '风控响应体（-412），用于验证 TransportError kind=risk-control'
  manifest['err-html.html'] = 'HTML 风控页，用于验证「先判 content-type 再 parse」这条规则'
  manifest['err-notfound.json'] = '视频不存在（-404）'
  manifest['err-reply-oid.json'] = '评论 oid 非法（12002），实测值'

  writeFileSync(join(OUT, 'MANIFEST.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: '由 tools/snapshot_fixtures.mjs 从真实接口抓取并脱敏；只保留本插件读取的字段。用户名/正文/id 均为假值，结构为真。端点与 src/adapters/bilibili.ts 保持一致。',
    fixtures: manifest,
  }, null, 2))

  console.log('fixtures written to', OUT)
  for (const [k, v] of Object.entries(manifest)) console.log(`  ${k}: ${v}`)
}

main().catch((e) => {
  console.error('fixture snapshot failed:', e)
  process.exit(1)
})
