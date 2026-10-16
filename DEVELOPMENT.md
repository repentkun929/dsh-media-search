# 开发工作区导航

> **仅开发用文档。** 本文件不在 `package.json` 的 `files` 白名单里，发布到 npm 时不会包含；
> 它只是本机工作区的导航与探测记录，因此可以写本机绝对路径。
> 面向用户的说明见 [`README.md`](./README.md)。

这个目录是 **B 站内容检索 DSH 插件**（包名 `dsh-media-search`）的工作区。
贴吧插件是**另一个独立插件**，开发仍在同盘的 TieBa 工作区，两者互不干扰、也不合并
（用户 m02920 决定：保持独立）。

## 当前状态

**实现完成，全部自检通过，并已装载进 desktop / web profile 验证。**

6 个默认工具 + 1 个可选工具 `bili_video_transcript`（P7，`asrEnabled` 默认**开**，
本机 ASR 环境实测可用；没装环境时该工具返回可读安装说明而不报错）。P0–P7 已完成。
**本插件只做 B 站**：抖音相关代码（`douyin_hot_board` 与适配器）已删除（用户 m02074 决定），
文案里的「抖音」字样也已清理（m02920：用户明确要求把抖音所属插件内容清理掉）。

`maxItems` 默认 **10**（不是 20）：宿主的 `dsh-spill-policy`（`dsh-base/cordis.patch.yml`
里配 `maxInlineTokens: 12500`）会把超预算的工具结果**从中间截断**，只留头尾加一句
「完整结果已存到 X 文件」。搜索/相关/热门每条都带 `bilibili.com/video/<bvid>`，
20 条满页刚好压线，中间若干条的 url 会连条目一起被砍掉（m02517 实测：模型只看到前 N 条
带链接，后几条只剩标题）。所以默认收到 10 条，并把截断风险写进三个工具的 description。

**播报粒度收紧**（用户 m02609：「播放 1.8万 · 弹幕 107 · 评论 195 · 点赞 615 · 投币 158 ·
收藏 405 像这些信息内容完全没必要给用户展示出来」）：`videoLine()` 去掉播放量/弹幕，
`bili_video_detail` 去掉六项互动整行（只留标题/UP主/分区/时长/发布日期/链接/分P/合集/简介），
`bili_user_profile` 去掉关注数/获赞数（只留粉丝数+等级），Toolview 的 `VideoRow` /
`DetailView` / `UserView` 同步收紧。结构化字段仍完整留在 `items` 里，只是不渲染进文本 ——
用户问热度时模型自己能从 meta 里取。`skill.ts` 与系统提示各加一条「数据粒度」约束，
防止模型自己把明细又铺出来。测试相应改为**反向断言**（断言这些标签不出现）。

| 验证 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `pnpm run typecheck` | exit 0（服务端 + 客户端两套 tsconfig 都干净） |
| 测试 | `pnpm test` | 80 通过 / 0 失败（契约 41 + 卡片渲染 29 + 转写 10） |
| 构建 | `pnpm run build` | 4 步全过，产物自检 PASS |
| 配置守卫 | `node tools/guard_config.mjs` | PASS（config=undefined 时仍注册 7 个工具） |
| 产物自检 | `node tools/check_artifacts.mjs` | PASS |
| 真网络 | `pnpm run smoke` | 12 通过 / 0 失败 |
| 真 profile 挂载 | `node tools/verify_profile_mount.mjs web` | **MOUNT PASS 26/26** |
| P7 真转写 | `node tools/probe_transcript.mjs BV1sHa966Eu6 45` | 抓 0.38 MB / 45 秒 / 9 分片 → 转写成功 |

装载进 profile 的方式是**目录 junction + link 协议**（不是发布到 npm），
所以 profile 里的 `node_modules/dsh-media-search` 直接指向本工作区，改完跑 `pnpm run build` 即生效。
`dsh.profile.bundles` 里排在 `dsh-tieba-plugin` 之后。

> `tools/verify_bundle.mjs` 仍会因 profile 形态（junction 而非 registry 安装）报判定失败，
> 这是预期的 —— 请看 `verify_profile_mount.mjs` 的结果。

## 发布到 GitHub（发布前检查清单）

仓库：`github.com/repentkun929/dsh-media-search`。发布前按顺序过一遍：

1. **产物与源码一致** —— 改过 `src/` 就必须重跑 `pnpm run build` 并一起提交产物：
   ```bash
   pnpm run build          # 末尾必须打印 ARTIFACT CHECK PASS
   ```
2. **凭据与私有路径扫描**（发布门禁，必须两个 `[ok]`）：
   ```bash
   python tools/check_publish_safe.py .
   ```
3. **`package.json` 的 `files` 白名单**：`["lib", "cordis.patch.yml", "README.md", "LICENSE"]`。
   `DEVELOPMENT.md`、`src/`、`test/`、`tools/`、`probe-evidence/` **不进包**（但进 git 仓库）。
4. **`lib/` 故意提交**（`.gitignore` 明确不忽略）—— 用户 `dsh plugin add github:...` 时
   宿主直接加载 `lib/index.mjs` 与 `lib/client.js`，不需要在用户机器上构建。
5. **三个必须成立的产物约束**（`check_artifacts.mjs` 已在自检里断言）：
   client `window.__ModuleLoader__.load({ id })` 的 id == `package.json` 的 `name`；
   node 产物重新导出 `Config`；client 产物无动态 `import(`、不 require Node 内置、不内联 react。
6. 推送后用户安装命令：
   ```bash
   dsh plugin --profile web add github:repentkun929/dsh-media-search
   ```

> `tools/diff_remote.mjs <repoDir> <owner/repo>` 可做本地树与远端的比对，
> 但它需要 `origin` remote 存在 —— 仓库刚 `git init` 时会报 `not a git repository`，属预期。

## P7 音频转写（已实现，默认开）

`src/asr.ts` 的实现要点，回归时别改坏：

- **`sidx` 解析的魔数校验偏移**：box 头是 `size(4) + type(4)`，魔数紧跟其后；
  校验时必须跳过 4 字节的 version+flags 再比 `'sidx'`。错一位就永远解析失败。
- **分片表只取「时长 > 0」的项**：`sidx` 的第一项常是初始化项（时长为 0），
  把它算进"覆盖 N 秒"会在边界上取少一个分片，导致最后一段音频被截断。
- **`referer` 必须带**：音频 CDN 对没有 `Referer: https://www.bilibili.com` 的请求返回 403。
- **模型走 `faster-whisper`**，通过子进程调用用户自己的 Python（`asrPython`）。
  找不到 Python / 没装依赖 / 模型下载失败，全部转成可读文本返回，不抛异常。

## 文件说明

| 文件 / 目录 | 作用 |
| --- | --- |
| `B站搜索DSH插件设计方案.md` | **主文档**（原名含「抖音」，m02920 已改名）。功能清单、架构、工具 schema、落地计划；抖音相关内容已标注为「不做」 |
| `B站公开接口匿名探测报告.md` | B 站 17 轮 phase 汇总（从 `TieBa\tools\probe_bili_report.md` 搬来）；也是 `probe-evidence/` 里那批原始输出的索引 |
| `probe-evidence\` | 探测原始证据（含复测输出），复现或回归时看这里，不用重新探测 |
| `DEVELOPMENT.md` | 本文件，工作区导航 |
| `README.md` | 面向用户的说明（会被发布） |
| `tools\` | 从贴吧工作区**通用化后**搬来的可复用脚本，已去掉硬编码本机路径 |

> 早期还有一份《抖音公开接口匿名探测报告.md》，已随抖音整体移除而删除（m02920）；
> 结论性内容（2483 登录墙 / 403 网关墙 / `a_bogus` 无校验）保留在设计方案 §2.3 与 §7.1。

## 关键结论速查（都实测过，别重新论证）

### 端点选择（两条反直觉的，改回去会坏）

- **搜索走 `search/all/v2`，不要用 `search/type`**：同环境连打 6 次，
  `search/type` 是 `412、412、200、200、200、412`（**一半失败**），`all/v2` 是 6/6 成功。
  两者 video 字段完全一致，`all/v2` 只多一层 `result[]` 分组（取 `result_type === 'video'` 那组）。
  `search/type` 的「偶尔成功」会骗过冒烟测试 —— 绿灯不代表稳定。
- **详情走 `view/detail`，不要用 `view`**：部分出口 IP 对 `view` **无差别** -412
  （换 bvid、换成 aid、带不带 `buvid3` 全是 412），而 `view/detail` 同 IP 稳定 200，
  返回 `{View, Card, Tags, Reply, Related, Spec}`，比 `view` 还多。
- **评论 `oid` 直接传 bvid**：实测 `oid=aid` 与 `oid=bvid` 返回完全相同的 rpid/点赞/游标
  （非法 oid 会 `code=12002`），所以不必为了拿 aid 先请求一次 view ——
  这正是 `view` 被墙时评论仍可用的原因。

### 能力边界

- **不要暴露 `order` 参数**：接口接受它，但实测**不能作为排序控制使用** ——
  前三位不随它变化，后面位置的差异方向也不可信。暴露它会让模型向用户承诺
  「按播放量排序」却拿不到对应结果。搜索固定走默认综合排序。
- **B 站 CC 字幕拿不到**：`player/wbi/v2` 与 `player/v2` 的 `subtitles` 恒 `[]`；官方「视频总结」接口 403。
- **但音频流可 Range 下载 + 精确定位**：`player/playurl?fnval=16` 的 `dash.audio[]` 里带 `segment_base`
  与 `sidx`；读 `sidx` 能拿到每个分片的字节偏移与时长，于是「前 N 秒」只需两个 Range 请求
  （init 段 + 连续分片区间）。实测前 45 秒 = 0.38 MB / 9 分片，前 60 秒 = 0.48 MB。
  **这是 P7 已经落地的路径**，不是待办。
- **本插件只覆盖 B 站**：抖音搜索 / 详情 / 链接解析本来就撞 2483 登录墙 +
  `ArgusSecurityPlugin` 403 网关墙，唯一可用的热榜也一并去掉（用户 m02074 决定），
  文案里的抖音字样在 m02920 清理干净。
- **`a_bogus` 逆向是白干**：7 组签名变体返回体完全一致，该校验不存在。
- **B 站 412 返回 HTML 不是 JSON**，解析前必须判 content-type 或首字符是否 `{`。
- **夹具里的 BV 号必须实测确认存在**：`BV1xx411c7mD` 其实是 aid=2 的真实稿件，
  不能当「不存在的视频」用。真正的不存在样本是 `BV1xxxxxxxxx`（-404 not-found）；
  `BV1111111111` → -400 api-error；`BV1GJ411x7h8` → `code=62002`「稿件不可见」api-error。

## tools\ 脚本用法

新插件源码放 `<ws>/dsh-media-search/` 后：

```bash
# 一条命令跑完全部回归（推荐；用贴吧插件验证过 8/8 全过）
node tools/regress.mjs <插件目录> <profileDir> <包名>

# 单项：
node tools/check_artifacts.mjs <插件目录>                          # 产物自检（Config 导出 + ModuleLoader id）
node tools/guard_config.mjs <插件目录>/lib/index.mjs tool1,tool2   # 真 cordis 装载守卫（核心防线）
node tools/verify_profile_mount.mjs web                            # 真 profile 挂载校验（补上 loader 那一段）
node tools/probe_transcript.mjs BV1sHa966Eu6 45                    # P7 真转写（下载音频 + ASR）
node tools/smoke_runtime.mjs <插件目录>/lib/index.mjs <包名>        # 运行时冒烟
node tools/verify_bundle.mjs <profileDir> 0.2.0-rc.2 <包名> <插件目录>  # profile 装载判定
node tools/profile_bundles.mjs <profileDir> <包名>                  # 看 bundles/hmr/依赖
python tools/check_publish_safe.py <插件目录>                       # 发布前凭据/私有路径扫描
node tools/diff_remote.mjs <git仓库目录> <owner/repo>               # 本地 vs 远端树比对
```

`guard_config.mjs` 与 `host_loader.mjs` 是配套的：前者在校验 profile 里的副本时会自动挂上后者，
把 `@deepseek-ai/*` 裸 import 重定向到插件源目录的 `node_modules`。源目录会自动探测
（产物目录 → 产物上级 → 脚本上级 → 脚本上级的各一级子目录），也可用 `DSH_PLUGIN_SOURCE` 显式指定。

**这组脚本已对贴吧插件做过跨工作区回归，8/8 全 PASS**
（在 TieBa 工作区上验证过；同盘另一个同名目录。）

### 环境变量

| 变量 | 作用 |
| --- | --- |
| `DSH_PLUGIN_SOURCE` | 插件源目录（解析 `@deepseek-ai/*` 用） |
| `DSH_PLUGIN_NAME` | 包名，默认 `dsh-media-search` |
| `DSH_PROFILE_DIR` | profile 目录 |
| `DSH_EXPECTED_TOOLS` | 期望注册的工具名（逗号分隔） |
| `DSH_ENDPOINT_NEEDLES` | `check_artifacts` 要断言的端点特征串（逗号分隔） |
| `DSH_META_LIST_FIELDS` | `check_artifacts` 要断言的 meta 映射，形如 `kind:field,kind:field` |
| `DSH_CREDENTIAL_FILE` | `check_publish_safe` 做真实值比对的凭据文件路径 |

## 开工前定的 5 件事（均已按默认值落地）

1. 包名：`dsh-media-search`（npm 可用）✅
2. 字幕路径：先只做 P0–P6 ✅ → **后按追加要求补完 P7 ASR** ✅（`asrEnabled` 默认**开**：未装环境时返回安装说明而非报错）
3. 抖音合并进同一个包 ✅ → **后按用户 m02074 决定删除抖音代码；m02920 又要求把抖音相关文案一并清干净** ✅
4. GitHub 仓库名：`repentkun929/dsh-media-search` ✅
5. 范围：本地可构建 + 自检通过 ✅ → **后按追加要求装载进 web / desktop profile 并跑真实挂载验证** ✅

## 从贴吧插件继承的三条硬约束（每条都踩过坑）

1. **产物必须重新导出 `Config`** —— 否则 cordis `resolveConfig()` 原样透传 `undefined`，`apply(ctx, undefined)` 读 `config.x` 抛异常，而抛点在 `ctx.effect()` 回调里被 cordis 吞掉 → 工具静默全无、无任何日志。
2. **client 产物 `window.__ModuleLoader__.load({ id })` 的 id 必须等于 package.json 的 name** —— 否则 Node 端工具正常、浏览器端卡片永久退化成通用文本行。`tsdown.config.ts` 要从 package.json 读，别硬编码。
3. **搜「不存在的视频」类夹具前必须先实测确认这个 BV 号真的不存在** ——
   我们曾把 `BV1xx411c7mD` 当「不存在的视频」写进说明，实测它其实是 aid=2 的真实稿件。
   错的夹具会让「错误分类」测试测出假的绿灯。
