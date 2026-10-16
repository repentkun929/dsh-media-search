# B站 内容检索 DSH 插件设计方案

> **目标**：做一个新插件，让 agent 能**搜索并读取 B站 的内容**（视频元数据、评论、简介、分 P、合集、UP 主信息），并把结果**整理总结**成用户想要的信息。对话里渲染成平台卡片（Toolview）。
>
> 本文档只讲设计。所有能力边界都经真网络实测标注 —— **能做的写清怎么做，不能做的写清为什么**，不含猜测。
>
> **范围变更记录**：初始方案曾计划同时接抖音（见 §7.1），后按用户决定**只做 B 站**，
> 抖音相关代码与文案均已清理（m02074 删代码 / m02920 清文案）。

---

## 0. TL;DR：能做什么、不能做什么

| 能力 | B 站 | 参考：抖音（已不做） | 实测依据 |
| --- | --- | --- | --- |
| **关键词搜索** | ✅ 完整可用 | ❌ 不可用 | B 站 `search/all/v2` 纯 UA **10/10~12/12 成功**；抖音三个搜索端点全部 `status_code:2483 请先登录，再继续搜索吧` |
| **视频详情** | ✅ 极全 | ❌ 不可用 | B 站 `view?bvid=` 无 UA 也 200 code 0；抖音详情 `403 Blocked by ArgusSecurityPlugin`（阿里云 CDN 层拦死） |
| **读取作品评论** | ✅ 可翻页 | ❌ 不可用 | B 站 `reply/main` `all_count=10898`，游标翻页可靠 |
| **读取字幕** | ⚠️ **官方字幕恒空**；音频流可自取 → 可自建 ASR | ❌ 不可用 | 见 §3.3，这是本方案最重要的一节 |
| **总结信息** | ✅ 靠「标题+简介+分P+合集+评论抽样+可选 ASR」 | ⚠️ 仅热榜词条 | B 站字段实测见 §3.4 |
| **链接解析** | ✅ BV 号/链接直读 | ❌ `v.douyin.com` 已 302 废掉 | 实测 |
| **热榜** | ✅ 全站 | ✅ 曾是唯一可用 | 抖音热榜曾 200 返回 50 条；后发现抖音整体价值有限，一并放弃 |

**一句话结论**：**B 站可以做成完整的内容检索插件。** 抖音最初只被评估为「热榜 + 搜索入口（告知不可用）」的壳子，后来按用户决定整体不做（见 §7.1）。

---

## 1. 插件定位与命名

### 1.1 定位

- **包名建议**：`dsh-media-search`（语义=「媒体平台内容检索」；最初为同时容纳 B 站与抖音而取，现只做 B 站，名字保留不改以免破坏已有安装）
- npm 上已确认 `dsh-media-search`、`dsh-hotsearch`、`dsh-video-search` 均未被占用
- 与 `dsh-tieba-plugin` **完全隔离**：不同包名、不同工具前缀（`bili_` vs `tieba_`）、不同系统提示段（`tool:mediasearch` vs `tool:tieba`）、不同技能名

### 1.2 为什么最初考虑把抖音 B 站合成一个包（此决定已作废）

> **本条是历史设计记录。** 用户后于 m02074 决定删掉抖音代码、m02920 要求清掉抖音文案，
> 插件最终**只做 B 站**。下面保留当时的权衡过程，便于日后想重开抖音时少走弯路。

| 考虑 | 当时的结论 |
| --- | --- |
| 抖音当前几乎无能力 | 合成后抖音只占一个适配器文件 + 一个热榜工具，成本极低 |
| 用户明确要求合成 | ✅ |
| 未来抖音开放 | 适配器接口已留好，加一个 `DouyinAdapter` 即可，不动工具层 |
| 搜索体验一致 | 模型看到的是 `media_search(keyword, platform)` 一个入口，内部路由 |

**即便当时也建议工具层按平台分开暴露**（`bili_video_search` / `douyin_hot_board`），因为参数与返回字段完全不同，强行统一 schema 会变得难用。**最终落地的正是这个「按平台分开」的形态，只是抖音那一半没有实现。**

---

## 2. 功能清单（最终版）

### 2.1 B 站工具（4 个，全部匿名可用）

| 工具 | 参数 | 数据源 | 返回要点 |
| --- | --- | --- | --- |
| `bili_video_search` | `keyword`(必填) / `page` / `limit` | `search/all/v2` | bvid / 标题(剥 `<em>`) / UP主 / 播放 / 弹幕 / 评论数 / 收藏 / 点赞 / 时长 / 发布时间 / 分区 / 标签 / 封面 / 链接 |
| `bili_video_detail` | `bvid`(必填，接受完整链接) | `view?bvid=` + `archive/desc` | 标题 / 简介 / 分P列表(cid+part+duration) / 播放等六项 stat / UP主mid+name / 分区 / 合集(ugc_season) / 版权标记 |
| `bili_video_replies` | `bvid`(必填) / `page` / `mode` | `view` 取 aid → `reply/main` | 昵称 / 内容 / 点赞 / 楼中楼数 / 总评论数 / 是否还有下一页 |
| `bili_video_related` | `bvid`(必填) / `limit` | `archive/related` | 相关视频列表（同 search 字段） |
| `bili_user_profile` | `mid`(必填) | `card?mid=` + `relation/stat` | 昵称 / 粉丝 / 关注 / 获赞 / 等级 / 签名 |
| `bili_popular` | `page` / `limit` | `popular` / `ranking/v2?rid=0` | 热门视频列表 |

### 2.2 抖音工具（曾规划 1 个，**已取消**）

当时唯一检出的可用能力是热榜（`iesdouyin.com/web/api/v2/hotsearch/billboard/word/`，
200 返回 `word_list` 50 条），计划包装成 `douyin_hot_board`。后按用户决定**整体不做**：
搜索撞 2483 登录墙、详情撞 403 网关墙，只剩一个热榜不成体系。

### 2.3 明确不做（附实测理由，避免反复讨论）

| 不做 | 理由 |
| --- | --- |
| 抖音搜索 / 视频详情 / 用户主页 | 2483 登录墙 + ArgusSecurityPlugin 403 网关墙，5 个 aweme_id × 7 种参数组合全同 |
| 抖音分享链接解析 | `v.douyin.com/<id>` 现在 302 到 `www.douyin.com`，已失效 |
| 抖音热榜 | 曾是抖音唯一可用能力，但整体放弃抖音后一并移除（m02074） |
| 逆向 `a_bogus` / `X-Bogus` | **实测 7 组签名变体返回体完全一致**，该校验根本不存在，逆向零回报 |
| B 站 `search/type` 分类搜索 | 412 HTML 风控页，纯 UA 仅 3/10；`all/v2` 已覆盖 |
| B 站 `order` 排序参数 | 实测 `none/totalrank/click/pubdate/dm/stow` 六种返回 bvid 序列**完全相同**，暴露就是骗用户 |
| B 站 CC 字幕直读 | `player/wbi/v2` 的 `subtitle.subtitles` 恒 `[]`（见 §3.3） |
| B 站 `ranking/v2` 多分区 | `rid=17/172/207` 全 `code=-400`，分区 id 体系与站点不一致；只做 `rid=0` |
| 视频下载 / 去水印 / 播放器 | 超出「读公开信息」范围，有合规风险 |

---

## 3. 三个关键能力的实现设计

### 3.1 搜索（B 站）

```
GET https://api.bilibili.com/x/web-interface/search/all/v2?keyword=<kw>&page=<n>
```

**实测特性**：

- 纯 UA 即可，**不需要 Referer / cookie / wbi 签名**
- 我连续测 **12/12 成功**
- `data.result` 是数组，按 `result_type` 分组；**只有 `video` 组有内容**（搜 UP 主名时 `bili_user` 组有 1 条，可选用）
- `data.next` 是下一页页码：`page=1 next=2` … `page=50 next=undefined` → **50 页深翻实测可用**，每页 20 条
- `numResults` / `numPages` 是总数

**字段清洗规则**（都是实测踩过的）：

| 原始 | 处理 |
| --- | --- |
| `title` 带 `<em class="keyword">鸣潮</em>` | 剥 `<em>` 标签 |
| `pic` = `//i2.hdslb.com/...` | 补 `https:` 前缀 |
| `duration` = `"21:24"` 字符串 | 保留原样（人读友好），另给 `durationSec` 供排序 |
| `pubdate` = Unix 秒 | 转 ISO |
| `arcurl` = `http://.../av117357364253026` | 统一输出 `https://www.bilibili.com/video/<bvid>` |

**`order` 不暴露**，理由见 §2.3。

### 3.2 评论（支撑「总结用户想要的信息」）

```
GET https://api.bilibili.com/x/v2/reply/main?oid=<aid>&type=1&mode=3&next=<n>
```

- `oid` 用 **aid**，而 `aid` 从 `view?bvid=` 直接可拿 → **无需额外请求**
- `mode=3` 是热门排序；翻页用 `next` 游标（`data.cursor.next`）
- 实测：`next=1`→20 条、`next=2`→19 条、`next=3`→20 条，`cursor.all_count=10898`、`cursor.is_end` 可靠
- 字段：`like` / `member.uname` / `content.message` / `rcount`（楼中楼数）

**「总结」策略**：抽前 N 页热评（默认 3 页 ≈ 60 条）+ 按 `like` 排序取前 20，交给模型总结。**不要把上万条评论全塞进上下文** —— 上限由 config 的 `maxReplies` 控制。

### 3.3 字幕（本节最重要，直接回答你的需求）

你提到「读取视频字幕」。**实测结论：B 站 CC 字幕匿名拿不到。**

| 探测 | 结果 |
| --- | --- |
| `player/wbi/v2`（带 aid+真 cid） | 200 code 0，但 `subtitle = {"allow_submit":false,"lan":"","lan_doc":"","subtitles":[],"subtitle_position":null}` |
| `player/v2`（老接口，无需 wbi） | 同样 `subtitles: []` |
| 之前扫了约 200 个视频（popular 全量 / ranking 前 40 / PGC《航拍中国第四季》/ TED / 纪录片 / 公开课 / 耶鲁 / 哈佛 / 斯坦福 / 字幕组 / 熟肉 / 央视 / NHK 等 30+ 组关键词） | `subtitles` **一次都没非空过** |
| `/x/player/wbi/v2/ai/subtitle`、`/x/player/ai/subtitle` | **404**，接口不存在 |
| `/x/web-interface/view/conclusion/get`（B 站官方的「视频总结」） | **403 `访问权限不足`** |

**但有一条实测可行的替代路径：自取音频流 + 本地 ASR。**

```
GET https://api.bilibili.com/x/player/playurl?bvid=<bv>&cid=<cid>&qn=64&fnval=16
```

实测返回 `data.dash.audio[]`，3 条流（30232 / 30280 / 30216，mp4a.40.2），且：

```
Range: bytes=0-1048575  →  HTTP 206, 999864 bytes  ✅ 可流式取
```

即**匿名可以 Range 下载音频片段**。所以插件可以做「视频转文字」：

```
工具 bili_video_transcript(bvid, maxSeconds)
  1. view?bvid=  → 拿 aid + pages[0].cid + duration
  2. playurl     → 拿 dash.audio 最低码率流的 baseUrl
  3. Range 下载前 N 秒音频（默认 300s，可配 60~1800s）
  4. 本地 ASR 转文字
  5. 返回文字稿 + 覆盖时间段说明
```

**ASR 引擎做成可插拔**（config 里选，默认关闭）：

| 引擎 | 成本 | 说明 |
| --- | --- | --- |
| `whisper.cpp`（本地） | 零边际成本，需用户装 | 推荐首选；`tiny`/`base` 模型 39~74 MB |
| `openai-whisper`（本地 Python） | 零边际成本 | 备选 |
| 云端 ASR API | 按量付费，需 Key | 用户自填，默认关闭 |

> **注意**：这是「插件替你下载音频 + 调 ASR」，不是「读 B 站字幕」。所以**必须在系统提示和技能里说清楚**：「字幕需登录拿不到，本插件用音频转写替代」。

**如果不想做 ASR**，退一步也有价值：`archive/desc` 能拿到完整简介（实测 `本期视频和@金铃子攻略组 合作，为大家带来鸣潮心攻略…`），配合标题、分 P 标题、合集结构、评论抽样，已经能覆盖大部分「总结视频讲了什么」的需求。**建议 P1 先做这个轻量版，ASR 作为 P2 可选。**

### 3.4 总结（agent 侧怎么做）

插件只负责**把结构化素材给全**，总结由模型完成。要给的素材：

| 素材 | 来源 | 默认量 |
| --- | --- | --- |
| 标题 | `view.title` | 1 |
| 简介 | `view.desc` + `archive/desc` | 全文 |
| 分 P 结构 | `view.pages[].part` | 全部（攻略类视频分 P 就是大纲） |
| 合集结构 | `view.ugc_season.sections[].episodes[].title` | 全部 |
| UP 主 | `view.owner` + `card` | 1 |
| 互动数据 | `view.stat` | 6 项 |
| 评论抽样 | `reply/main` 前 N 页按赞排序 | 默认 20 条 |
| 音频转写 | `bili_video_transcript`（可选） | 默认 300 秒 |

**示例**：用户问「B 站上鸣潮心月狐怎么玩」→
1. `bili_video_search('鸣潮 心月狐')` → 找到高播放攻略视频
2. `bili_video_detail(bvid)` → 拿简介 + 分 P 大纲
3. `bili_video_replies(bvid)` → 抽热评看观众反馈（「哪里讲得不对」「补充了什么」）
4. 可选 `bili_video_transcript(bvid, 600)` → 拿正文
5. 模型整理成「核心机制 / 输出流程 / 声骸词条 / 常见误区」结构回答

---

## 4. 架构设计

### 4.1 平台适配器抽象

```
interface MediaAdapter {
  readonly name: string          // 'bilibili'（历史上还规划过 'douyin'）
  search(q, page): Promise<SearchPage>
  detail(id): Promise<Detail>
  replies(id, page): Promise<ReplyPage>
  user(id): Promise<UserProfile>
  related?(id, limit): Promise<SearchPage>
  popular?(page, limit): Promise<SearchPage>
}
```

- 风控策略（cookie 注入 / 重试 / 412 回退）**必须关在适配器内部**，不漏到工具层
- 接口保留多平台形态（可选方法 + `name` 字段），但**现在只注册 `bilibili` 一个适配器**；
  接新平台时加一个实现即可，不动工具层与渲染层

### 4.2 降级链

```
B 站搜索：all/v2 → 失败判 412/HTML → 带匿名 buvid3 重试一次 → 仍失败返回 {text, items:[]}
B 站详情：view/detail → 失败 → 结构化失败（view 端点在该出口 IP 被无差别 -412，已改用 view/detail）
```

**业务失败一律返回 `{text, items:[]}` 不 throw**；throw 只留给参数错误（沿用贴吧插件的已验证规则）。

### 4.3 一个必须记住的坑：B 站 412 返回 HTML 不是 JSON

```
HTTP 412 + Content-Type: text/html
<!DOCTYPE html>… 由于触发哔哩哔哩安全风控策略，该次访问请求被拒绝。 …security.bilibili.com/static/js/412.js
```

`JSON.parse` 直接抛。**解析前必须先判 content-type 或首字符是否 `{`**，并区分三种错误形态：

| 形态 | 含义 | 处理 |
| --- | --- | --- |
| HTTP 404 + HTML | 接口不存在（如 `/x/popular`） | 报错，说明端点失效 |
| HTTP 412 + HTML | 风控 | 带 `buvid3` 重试一次 |
| HTTP 200 + `{"code":-400}` | 参数错 | 抛参数错误 |

### 4.4 文件结构

```
dsh-media-search/
├── package.json              # name=dsh-media-search，零 runtimeDependencies（ASR 引擎除外，做成可选 peer）
├── cordis.patch.yml          # - id: dsh-media-search / name: 'dsh-media-search'
├── tsdown.config.ts          # PLUGIN_ID 从 package.json 读（勿硬编码）
├── src/
│   ├── index.ts              # export const name / inject / Config / apply
│   ├── config.ts             # timeoutMs / maxItems / maxReplies / asr{enabled,engine,maxSeconds} / buvid3Enabled
│   ├── api.ts                # B 站六端点
│   ├── adapters/
│   │   ├── types.ts          # MediaAdapter 接口（多平台形态，当前只实现 bilibili）
│   │   ├── bilibili.ts       # 全部匿名逻辑 + 412 回退
│   │   └── douyin.ts         # 【已删除】原计划只有 hotBoard；按用户决定整体移除
│   ├── fragment.ts           # VideoItem / ReplyItem / UserItem + MediaMeta
│   ├── tool.ts               # 7 个工具 schema + execute
│   ├── skill.ts              # media-briefing 技能
│   ├── transcript.ts         # Range 下载音频 + 调 ASR（可选模块）
│   └── client/index.tsx      # keyed Toolview
├── test/                     # contract + client-render
└── lib/                      # 故意提交（用户免构建）
```

### 4.5 系统提示段

`name: 'tool:mediasearch'`、`order: 118`。内容要点：

- 用户提到 **B 站 / bilibili / 某 UP 主 / BV 号 / 视频链接** → 用 `bili_*` 工具
- 用户提到**其他平台**（抖音等）→ 明确说明本插件只覆盖 B 站，没有这些能力，不要假装能搜
- `bvid` 从 `BV` 开头的串或 `bilibili.com/video/BV...` 链接提取
- 用户要「总结某个视频讲了什么」→ 依次 `detail` → `replies` → 可选 `transcript`
- 播报按 `media-briefing` 技能规范

### 4.6 技能 `media-briefing`

契约（照 `tieba-briefing` 改）：

1. 先报平台 + 关键词 + 条数 + 页码；
2. 每条一行：`[标题](https://www.bilibili.com/video/BVxxx) · UP主 · 发布时间`；
3. 只依据工具数据，不编造播放量 / UP 主名 / 评论内容；
4. 明确声明能力边界：**CC 字幕不可用（用音频转写替代）、排序只有综合排序**。

> 粒度已于 m02609 收紧：播放量/弹幕/评论/点赞/投币/收藏这类明细**默认不展示**，
> 用户明确问数据时再给。详见 `src/skill.ts` 的「数据粒度」一节。

### 4.7 浏览器端 Toolview

| key | 卡片内容 |
| --- | --- |
| `bili_video_search` | 标题 + UP 主 + 时长 + 发布日期 + 链接 |
| `bili_video_detail` | 标题 + UP 主 + 分区 + 时长 + 分 P/合集大纲 + 简介 |
| `bili_video_replies` | 昵称 + 点赞 + 内容 + 总评论数 |
| `bili_video_related` | 同 search |
| `bili_user_profile` | 昵称 + 粉丝数 + 等级 + 签名 |
| `bili_popular` | 同 search |
| `bili_video_transcript` | 转写文字稿 + 覆盖范围警告 |

沿用贴吧插件的三个已验证手法：

- `!('kind' in block)` → 骨架屏「正在读取 B 站…」
- `block.isError` 或 meta 缺失 → 取 `block.content` 首行文本回退
- 纯 CSS、单文件、无动态 import、无外部 CDN

---

## 5. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| B 站 `all/v2` 被加风控 | 核心功能失效 | 适配器内置匿名 `buvid3` 回退（实测 `buvid3`+`wbi`+`Referer` 可 10/10）；仍失败则结构化失败不 throw |
| B 站改字段名 | 取数错乱 | 契约测试用 **fixture 快照**而非实时网络；字段缺失降级为「未知」 |
| 字幕需求无法满足 | 体验受损 | UI 与提示明示「CC 字幕需登录」；提供 `bili_video_transcript` 作为替代 |
| ASR 依赖 | 装不上就用不了 | ASR 做成**可选**，默认关闭；关闭时 `transcript` 返回「未启用 ASR」而非报错 |
| 音频下载合规 | 法律风险 | 只取前 N 秒用于转写，不落盘、不提供下载；仅公开视频 |
| 版权合规 | 法律风险 | 只取元数据 + 原链接，不做全量镜像 |
| 上下文爆炸 | token 爆掉 | `maxItems` / `maxReplies` / `maxTranscriptChars` 三重上限；正文进 `presentationMeta` |

---

## 6. 落地计划

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **P0 骨架** | package.json / cordis.patch.yml / tsdown / tsconfig / scripts | `tsc` 双配置 0 错 |
| **P1 B 站 API 层** | `search/all/v2` + `view` + `archive/desc` + `card` + `reply/main` + `related` + `popular`；HTML/JSON 判别、`<em>` 剥离、`pic` 补协议、412 回退 | 假 fetch 契约测试全过（覆盖 412 HTML / 404 HTML / `code:-400` 三形态） |
| **P2 工具层** | 7 个工具 schema + execute + `presentationMeta` | headless 验证；`limit`/`page` 边界；结构化失败不 throw |
| **P3 渲染层** | 7 张 Toolview | web profile 3080 验收 |
| **P4 抖音适配器** | ~~`douyin_hot_board` + `search` 结构化失败~~ | **已取消**（用户 m02074 决定整体不做抖音） |
| **P5 真网络联调** | 全部工具真请求 | 各至少 3 次成功；412 时走 `buvid3` 回退 |
| **P6 安装** | `dsh plugin --profile web add github:<user>/dsh-media-search` + desktop profile 迁移 | 工具出现在模型列表；卡片渲染 |
| **P7 音频转写（可选）** | `bili_video_transcript`：Range 下载 + ASR | 默认关闭；开启后能返回文字稿 |

**每一步照贴吧插件的两条硬约束自查**：

1. 产物**必须重新导出 `Config`**（否则 cordis 透传 `undefined` → `apply` 读 `config.x` 抛异常 → 被 `ctx.effect` 吞掉 → 工具静默全无）
2. client 产物 `window.__ModuleLoader__.load({ id })` 的 id **必须等于 package.json 的 name**

---

## 7. 与其他插件的关系

### 7.1 抖音：不做（此决定覆盖了本方案早期版本）

早期版本曾计划把抖音合进同一个包（哪怕只是一个热榜工具）。**该计划已作废**：

- 用户 m02074 决定删除抖音代码 → `douyin_hot_board` 与抖音适配器已移除
- 用户 m02920 进一步要求清掉「抖音所属插件内容」 → 文案、关键词、文档里的抖音残留一并清理
- 保留的唯一痕迹是**「为什么不做」的记录**（2483 登录墙 + 403 网关墙 + `a_bogus` 逆向零回报），
  以免日后有人重新论证一遍

### 7.2 贴吧插件：独立并存，不合并

两个插件**各自独立**（用户 m02920 决定不合并）：

- `dsh-tieba-plugin` 保持 0.1.1，只修 bug 和百度接口变动；GitHub Release `v0.1.1` + tarball 已就绪：
  ```bash
  dsh plugin --profile web add github:repentkun929/dsh-tieba-plugin
  ```
- 本插件与它**完全隔离**（包名 / 工具前缀 `bili_` vs `tieba_` / 系统提示段 `tool:mediasearch` vs `tool:tieba` / 技能名），互不影响
- 曾评估过把两者合并成一个包，**已否决**：贴吧内部并存两套传输层（老客户端签名 + HTML 正则爬取），
  合并需要先重写其网络层，风险与收益不成比例；分开也便于按平台单独禁用/排查
- 贴吧插件的可复用资产已沉淀到本工作区 `tools/` 与 `scripts/`：
  `check_artifacts.mjs`、`guard_config.mjs`、`verify_bundle.mjs`、`smoke_runtime.mjs`、`smoke_e2e.mjs`、
  `scripts/{build.ps1,link_deps.py}`，以及三条踩坑经验（ModuleLoader id = 包名 / 必须导出 Config / 翻页用服务端 `has_more`）

---

## 8. 需要你决定的事（均已定案，保留决议记录）

1. **包名**：`dsh-media-search` ✅（已确认 npm 可用）
2. **字幕走哪条路**：(a) 先不做 ASR ✅ → **后又追加要求补完 P7 ASR** ✅（`asrEnabled` 默认开）
3. **抖音**：~~合并进同一个包~~ → **整体不做** ✅（m02074 删代码 / m02920 清文案）
4. **GitHub 仓库名**：`repentkun929/dsh-media-search` ✅
5. **要不要现在就开始实现**：已实现 ✅（P0–P7 全部落地，装载进 web / desktop profile 验证通过）

---

## 附录：本方案的实测证据

| 文件 | 内容 |
| --- | --- |
| `B站公开接口匿名探测报告.md` | B 站接口匿名可用性总报告（本工作区根目录） |
| `probe-evidence/probe_bili_phase*.txt` | 17 轮原始证据 |
| `probe-evidence/probe_bili_verify_out.txt` | `all/v2` 纯 UA **12/12** |
| `probe-evidence/probe_bili_verify2_out.txt` | `order` 六值无效 / ranking rid / reply 翻页 / duration 形态 / aid 直取 / 50 页深翻 |
| `probe-evidence/probe_media_out.txt` | **字幕恒空**（player/wbi/v2 + player/v2 双接口）/ AI 字幕 404 / 官方总结 403 / 合集字段 / popular / ranking / card |
| `probe-evidence/probe_media2_out.txt` | **音频流可 Range 下载（206, 999864B）** / view 全字段 / 评论 all_count=10898 |

> 早期探测里还有一份抖音报告，已随抖音整体移除而删除（不复现在本工作区）。
> 若日后要重开抖音，需重新探测 —— 但那几条墙（2483 / 403 / `a_bogus` 无校验）不大可能变。
