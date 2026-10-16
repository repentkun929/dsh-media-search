# dsh-media-search

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 加一组 **B 站内容检索**工具：
让 agent 能搜 B 站视频、读视频详情/评论/简介/分 P/合集/UP 主主页、看热门榜，
还能把 B 站视频的**音频转写成文字稿**。

所有接口都是**匿名可读的公开数据**，不需要登录、不需要 API Key、不需要 Cookie。

---

## 能力边界（请先读这一段）

这个插件**只覆盖 B 站**，不做其他平台。

为什么不顺带做抖音：抖音搜索与视频详情实测撞「登录墙 + 网关墙」两道
（搜索返回 `status_code 2483`「请先登录，再继续搜索吧」，详情 `403 Blocked by ArgusSecurityPlugin`），
唯一可用的热榜价值有限 —— 与其提供一个半残能力，不如明确不提供。

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| B 站视频搜索 | 可用 | 纯 UA 即可，可深翻至第 50 页（每页 20 条） |
| B 站视频详情 | 可用 | 标题/简介/分 P/合集/六项互动数据 |
| B 站评论 | 可用 | 热门排序，游标翻页，单页 20 条 |
| B 站相关推荐 | 可用 | 一次约 40 条，不支持翻页 |
| B 站 UP 主主页 | 可用 | 昵称/签名/粉丝数/等级 |
| B 站热门榜 | 可用 | 综合热门，20 条/页 |
| B 站音频转写 | 可用 | 默认开启；需本地 Python + faster-whisper，见下 |
| B 站 CC 字幕 | 不可用 | 匿名请求 `subtitle.subtitles` 恒为空数组 |
| 其他平台（抖音等） | 不做 | 搜索 2483 登录墙 + 详情 403 网关墙，不具备可用的匿名读取路径 |

### 与贴吧插件的关系：各自独立

本插件与 `dsh-tieba-plugin` 是**两个独立插件**，可以同时装、互不影响：包名不同、
工具前缀不同（`bili_` vs `tieba_`）、系统提示段不同（`tool:mediasearch` vs `tool:tieba`）、
技能名不同（`media-briefing` vs `tieba-briefing`）。

曾评估过把两者合并成一个包，**已否决**：合并需要先重写贴吧插件内部并存的两套传输层
（老客户端签名 + HTML 正则爬取），风险与收益不成比例；分开也便于按平台单独禁用与排查。

### B 站 CC 字幕拿不到，但音频可以

匿名状态下 B 站不返回任何字幕（`player/wbi/v2` 与 `player/v2` 的 `subtitle.subtitles` 都是空数组，
官方视频总结接口 403）。所以 `bili_video_transcript` 走的是**自己下音频再本地转写**这条路：
`playurl?fnval=16` 拿 DASH 音频流 → 读 stream 索引精确定位 → Range 只取前 N 秒的字节 → 本地 ASR。

**它不会为了转写 3 分钟而下载整集 21 分钟的视频。** 音频流的 `sidx` 索引里写着每个分片的
字节偏移与时长，插件据此算出「前 N 秒需要哪几个分片」，只发两个 Range 请求
（一个 init 段 + 一段连续的分片区间）。实测：转写前 45 秒只需要抓 **0.38 MB**，
覆盖 45 秒、9 个分片；前 60 秒是 0.48 MB。

代价是**转写内容是片段而非全片**，工具返回里会写明「仅前 N 秒」并在卡片上高亮警告 ——
避免模型把前 45 秒的内容当成整个视频的总结。

---

## 安装

插件已提交构建产物（`lib/`），从 git 安装**无需本地构建**。

```bash
# 在 DSH 的 profile 目录下
pnpm add github:repentkun929/dsh-media-search
```

插件自带 `cordis.patch.yml`，DSH 会自动合并该条目：

```yaml
- insert:
    - id: dsh-media-search
      name: 'dsh-media-search'
```

重启 DSH 后，模型工具列表里会出现 6 个 `bili_*` 工具（默认再带上 `bili_video_transcript`
共 7 个），GUI 里会显示卡片式结果。

---

## 工具清单

| 工具名 | 用途 | 主要参数 |
| --- | --- | --- |
| `bili_video_search` | 按关键词搜 B 站视频 | `keyword`（必填）、`page`、`limit` |
| `bili_video_detail` | 读视频详情（简介/分 P/合集/统计） | `bvid` 或 `aid` |
| `bili_video_replies` | 读视频评论（热门排序） | `bvid` 或 `aid`、`page`、`limit` |
| `bili_video_related` | 读相关推荐 | `bvid` |
| `bili_user_profile` | 读 UP 主主页 | `mid` |
| `bili_popular` | 读综合热门榜 | `page`、`limit` |
| `bili_video_transcript` | 把视频音频转写成文字稿（**默认开启**） | `seconds`、`language` |

`bvid` 参数接受完整链接（`https://www.bilibili.com/video/BV...`）或裸号（`BV...`），
工具会自动提取。

> `bili_video_transcript` 默认注册（`asrEnabled` 默认 `true`），但需要本地装好 ASR 环境
> （Python + faster-whisper + PyAV）。没装环境时它会返回一段可读的安装说明，而不是报错。
> 想让它从模型工具列表里消失，把 `asrEnabled` 设成 `false`。

### 为什么默认只返回 10 条

宿主 DSH 有一个工具结果预算（`dsh-spill-policy`，默认约 12500 token）：超过后会把结果
**从中间截断**，只留头部、尾部，和一句「完整结果已存到 X 文件」。搜索/相关/热门每条都带
`https://www.bilibili.com/video/<bvid>`，20 条满页刚好压线，中间若干条的链接会连同条目
一起被砍掉 —— 模型只能看到前 N 条带链接，后几条只剩标题。

所以 `maxItems` 默认设成 10，并把「结果过长会被截断」写进了三个工具的 description。
需要更多结果时翻页（`page=2`），不要一次要满 20 条。

### 默认不展示哪些数据

工具返回的文本里**只有**：标题、链接、UP 主、时长、发布日期。播放量、弹幕数、评论数、
点赞、投币、收藏、关注数、获赞数这些明细数据**默认一个都不给**（用户 m02609 明确反馈
「完全没必要展示出来」）—— 它们对用户是噪声。GUI 卡片同理。

需要热度/数据时，让模型直接说「把这条的数据给我」，它再从工具结果里取；结构化字段
仍在 `items` 里，只是不渲染进文本。

---

## 配置

在 profile 的插件配置里可以覆盖以下项（全部可选）：

```yaml
- id: dsh-media-search
  name: 'dsh-media-search'
  config:
    userAgent: '...'        # 默认桌面 Chrome UA
    timeoutMs: 15000        # 单请求超时
    proxyUrl: ''            # 例：http://127.0.0.1:7890
    maxItems: 10            # 单次返回条数上限（默认 10；20 条会被宿主从中截断，中间的链接会丢）
    maxReplies: 20          # 单次返回评论条数上限
    maxDescChars: 2000      # 简介截断长度
    buvid3Fallback: true    # 遇 412 风控时自动取 buvid3 重试一次
    sessdata: ''            # 可选；填了会带上，但匿名已够用
    asrEnabled: true        # bili_video_transcript 工具开关（需本地 ASR 环境；未装环境时返回安装说明）
    asrPython: ''           # Python 可执行文件；留空自动探测
    asrModel: 'small'       # faster-whisper 模型
    asrMaxSeconds: 300      # 单次转写秒数上限
```

---

## 工作原理

```
模型 ──调用工具──> tool.ts ──> MediaAdapter ──> BiliTransport (http.ts)
                     │                            └─ 风控/降级/错误分类关在这里
                      │
                     │
                     └─ presentationMeta ──> GUI 卡片 (toolview.tsx)
```

几个刻意的设计决定：

- **业务失败不抛异常，只返回文本。** 工具执行失败时返回 `{text: '...原因...', items: []}`，
  让模型读到一句可解释的说明；`throw` 只留给参数错误（比如 `keyword` 为空）。
  否则模型看到的是工具崩溃，而不是一句能转述给用户的原因。
- **风控处理关在传输层内部，不外泄。** `http.ts` 识别三种形态：
  `404 + HTML` = 接口不存在、`412 + HTML` = 触发风控、`200 + {"code":-400}` = 参数错。
  B 站返回 412 时若 `buvid3Fallback` 开启，会取一次 `buvid3` 再重试，只重试一次。
- **降级是分级的。** 简介接口失败不影响详情主体；粉丝数接口失败不影响 UP 主主体。
- **meta 契约做了防御式校验。** 卡片渲染前用 `mediaMetaFrom` 校验 meta 形状，
  脏 meta 会让卡片退回纯文本，而不是白屏。
- **端点选择以稳定性为准，不选「看起来更直接」的那个。** 两个反直觉的实测结论：
  - 搜索走 `search/all/v2` 而非 `search/type`。同环境连打 6 次：`search/type` 是
    `412、412、200、200、200、412`（**一半失败**），`all/v2` 是 6/6 成功。
    `search/type` 的「偶尔成功」最危险 —— 它能让冒烟测试绿灯通过，
    把间歇性风控伪装成正常。
  - 详情走 `view/detail` 而非 `view`。部分出口 IP 上 `view` 会被**无差别** 412
    （换 bvid、换 aid、带不带 `buvid3` 全都 412），`view/detail` 同 IP 稳定 200，
    且返回内容比 `view` 还多。
  - 这两条都写在 `src/adapters/bilibili.ts` 顶部，契约测试里也钉死了端点断言，
    避免以后被「优化」回去。

---

## 开发

```bash
pnpm install
pnpm run typecheck   # 两个 tsconfig 都过
pnpm test            # 80 个测试（契约 40 + 卡片渲染 29 + 转写 10）
pnpm run build       # 构建 + 产物自检
pnpm run smoke       # 真网络联调（需要能访问 bilibili）
```

工作区导航、探测证据与脚本用法见 [`DEVELOPMENT.md`](./DEVELOPMENT.md)。

### 目录结构

```
src/
  index.ts            服务端入口（注册工具 + 技能 + 系统提示）
  config.ts           配置 schema（必须导出为 Config，见下）
  fragment.ts         共享契约：类型 + 纯函数（服务端/客户端都用）
  http.ts             B 站传输层：风控识别、降级重试、错误分类
  asr.ts              音频提取（sidx 精确定位 + Range）+ 本地 ASR 调用
  skill.ts            media-briefing 技能（播报格式契约）
  tool.ts             7 个工具定义（asrEnabled=false 时 6 个）
  adapters/
    types.ts          MediaAdapter 接口
    bilibili.ts       B 站适配器

  client/
    index.tsx         客户端入口（注册 Toolview）
    toolview.tsx      7 张卡片
    types.ts          最小客户端契约
test/
  contract.test.mjs       接口响应 -> 插件数据结构 的映射（用真实响应夹具）
  client-render.test.mjs  卡片渲染（跑构建产物，不需要 DOM）
  transcript.test.mjs     sidx 解析、Range 计算、转写结果组装（纯离线）
lib/                  构建产物（已提交）
tools/                探针、自检、联调脚本
```

### 两个必须注意的坑

1. **必须导出 `Config`。** cordis 的 config 注入走 `plugin.Config['~standard'].validate()`。
   如果入口只 `export default` 而不导出 `Config`，补丁条目又没有 `config` 字段，
   配置解析就会抛 TypeError，而这个异常会被 `ctx.effect` 静默吞掉 —— 症状是
   **插件装了、文件都在、没有任何警告，但模型工具列表里就是没有工具**。
   产物自检（`tools/check_artifacts.mjs`）和配置守卫（`tools/guard_config.mjs`）
   都会断言这一条。

2. **客户端 `__ModuleLoader__.load` 的 id 必须等于 `package.json` 的 name。**
   宿主 `dsh-client-modules` 会用这个 id 校验 `factories.has(row.id)`。写错的话
   客户端半边会永久静默失效（服务端工具正常、GUI 卡片永远是纯文本）。
   `tsdown.config.ts` 从 `package.json` 读包名，**不要硬编码**。

### 测试为什么测构建产物

`test/client-render.test.mjs` 加载的是 `lib/client.js` 而不是 `src/`。原因：
Node 24 的原生 TS 支持只做**类型擦除**（`process.features.typescript === 'strip'`），
不编译 JSX，所以 `.tsx` 无法被 `node --test` 直接 import；而构建产物恰恰是宿主真正加载的东西，
测它比测源码更有说服力。跑这个测试前必须先 `pnpm run build`。

测试用一个极小的加载器壳拆开 `ModuleLoader` 包装，然后走宿主真实路径：调 `apply(ctx)`，
从 fake `ctx.slots` 里接住注册的组件，再直接当函数调用。因为组件是纯函数（只用到了
函数组件的求值语义，没用到挂载/状态/effect），所以不需要 jsdom。

> 注意产物包装的细节：`factory` 内部自己声明了 `var module` / `var exports`，
> 所以外部传入的 `module` 会被遮蔽 —— 唯一可靠的取值方式是接住 **factory 的返回值**。

---

## 音频转写（`bili_video_transcript`）

默认 `asrEnabled: true`，所以这个工具**默认就注册**。没装本地 ASR 环境的人不会看到报错 ——
工具会返回一段安装说明。装好环境（Python + faster-whisper + PyAV）之后它才能真转写；
想让它从模型工具列表里消失，把 `asrEnabled` 设成 `false` 即可，其余 6 个工具不受影响。

### 1. 装本地 ASR

需要一个能跑 `faster-whisper` 的 Python：

```bash
pip install faster-whisper
```

首次转写会自动下载模型（`small` 约 480 MB）。想换更快的可以设 `asrModel: 'base'`，
想更准设 `'medium'`；也可以用 `asrPython` 指定某个虚拟环境里的解释器。

### 2. 调参（默认已经打开，不用配也能用）

在 profile 的插件配置里可以覆盖：

```yaml
- id: dsh-media-search
  name: 'dsh-media-search'
  config:
    asrEnabled: true        # 默认就是 true；设 false 则整个工具不注册
    asrModel: 'small'       # base 更快，medium 更准
    asrMaxSeconds: 300      # 单次转写秒数上限
    asrPython: ''           # 指定某个虚拟环境里的 python
```

重启 DSH 后生效。

### 3. 它到底抓了多少数据

这是这个工具最值得说明的部分。三分钟的视频和二十一小时的视频，抓取量**不由视频长度决定**，
只由你要的秒数决定：

| 想要的时长 | 抓取量 | 覆盖分片数 |
| --- | --- | --- |
| 前 45 秒 | 0.38 MB | 9 |
| 前 60 秒 | 0.48 MB | — |

做法是读 DASH 音频流的 `sidx`（stream 索引）—— 里面按顺序写着每个分片的字节偏移与时长 ——
然后算出「第 1..N 秒落在哪几个分片」，只对那一段发 Range 请求。总共两个请求：
一个取 init 段（含编码参数，ASR 才能解码），一个取连续的分片区间。

所以 21 分钟的视频转写前 45 秒，抓的是 0.38 MB 而不是整集。

### 4. 必须知道的限制

- **只转写开头 N 秒，不是全片。** 返回文本里会明写「仅前 N 秒（共 X 秒）」，
  卡片顶部也有高亮警告。别让模型把前 45 秒当成整个视频的总结。
  `asrMaxSeconds` 默认 300，即最多转写 5 分钟。
- **分片对齐不是精确裁剪。** 分片边界是编码器定的，所以实际声音可能比你要的秒数略长或略短；
  转写文本末尾可能包含超出范围的一点点内容。
- **首次运行慢。** 要下载模型；`small` 模型在 CPU 上转写 1 分钟音频通常要十几秒。
- **比别的工具更可能失败。** 它依赖本地 Python、模型缓存、以及能跑完整子进程的环境。
  失败时同样返回可读文本（比如「未找到可用的 Python」），不会拖垮插件。

---

## 免责声明

本插件只读取各平台**匿名可见的公开数据**，用于个人学习与研究。请遵守目标平台的服务条款，
不要用于批量抓取或任何商业用途。接口是公开端点而非官方 API，平台可能随时调整。

## License

Apache-2.0
