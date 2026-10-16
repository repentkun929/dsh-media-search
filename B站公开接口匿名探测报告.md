# B站（bilibili）公开数据接口匿名探测报告

> 探测时间：2026-10（Node v24.20.0，中国大陆网络，河南郑州出口 IP 120.219.119.91）
> 测试词：`鸣潮 心月狐`、`原神 攻略`
> 纪律：所有结论均来自真实网络请求，未使用任何训练记忆。所有请求**只带桌面 Chrome UA**，**不带任何登录 Cookie**（除明确标注的匿名 `buvid3` 外）。
> 探测脚本：原为 `TieBa\tools\probe_bili_1.mjs` ~ `probe_bili_17.mjs`
> 原始证据：本工作区 `probe-evidence\probe_bili_phase1.txt` ~ `probe_bili_phase17.txt`（已随插件源码一起搬入）
> 报告本体原为 `TieBa\tools\probe_bili_report.md`，搬入时改名为本文件名

---

## 0. 最重要的结论（先看这个）

| 接口 | 纯 UA（无 cookie 无 Referer） | 结论 |
|---|---|---|
| `search/all/v2` | **HTTP 200, code 0，10/10 全成功** | ✅ **可用，无需签名、无需 cookie、无需 Referer** |
| `search/all`（老版） | **HTTP 200, code 0，10/10 全成功** | ✅ **可用，同样零门槛** |
| `search/type` | HTTP 412（WAF HTML 页）或 200 code 0，**仅 3/10** | ⚠️ 需要 `buvid3` 匿名 cookie + wbi 签名才能 100% |
| `view` | HTTP 200, code 0 | ✅ 可用，字段全 |
| `card` | HTTP 200, code 0 | ✅ 可用 |
| `player/wbi/v2` | HTTP 200, code 0 | ✅ 可用，但**字幕恒为空** |
| `nav` | HTTP 200, code -101，但 `data.wbi_img` **照样给** | ✅ 匿名可拿 wbi keys |

**「B站搜索」功能完全不需要 wbi 签名、不需要登录、不需要 cookie——用 `search/all/v2` 就行。**
`search/type` 的 `-412` 是 WAF（风控网关）随机拒绝，**不是签名问题**，加 wbi 签名并不能根治，真正起作用的是匿名 `buvid3` cookie。

---

## 接口逐条证据

### 接口 1：`/x/web-interface/search/all/v2?keyword=<kw>` —— 新版聚合搜索
- **HTTP 状态码**：200
- **返回体前 500 字符（原文）**：
```
{"code":0,"message":"OK","ttl":1,"data":{"seid":"12565258862459419931","page":1,"pagesize":20,"next":2,"numResults":1000,"numPages":50,"suggest_keyword":"","rqt_type":"search","exp_list":{"100010":true,"5500":true,"6699":true},"is_hit_web_inf":false,"egg_hit":0,"pageinfo":{"tv":{"numResults":0,"pages":0,"total":0},"user":{"numResults":0,"pages":0,"total":0},"movie":{"numResults":0,"pages":0,"total":0},...
```
- **code 字段值**：`0`
- **是否需要登录 Cookie**：否
- **是否需要 wbi 签名**：否（加 w_rid 也返回 200 code 0，纯属多余）
- **是否需要 Referer**：否（带/不带 Referer 均 200 code 0，10/10）
- **拿到的关键字段**（`data.result` 是**数组**，每项 `{result_type, data[]}`，视频在 `result_type === "video"` 那项，一页 20 条）：

  单条视频 item 的字段名与示例值：
```
  type:        "video"
  author:      "叫我棉被"              ← UP主名
  mid:         6014992                  ← UP主 mid
  aid:         117357364253026
  bvid:        "BV1sHa966Eu6"           ← bvid
  arcurl:      "http://www.bilibili.com/video/av117357364253026"
  title:       "【<em class=\"keyword\">鸣潮</em>】<em class=\"keyword\">心月狐</em>攻略！..."  ← 带高亮标签，需剥 <em>
  description: "本期视频和@金铃子攻略组 合作..."   ← 简介
  pic:         "//i2.hdslb.com/bfs/archive/37b09cd...jpg"   ← 封面（// 开头，需补 https:）
  play:        1271989                  ← 播放量
  danmaku:     5025                     ← 弹幕数
  review:      10897                    ← 评论数
  favorites:   11703                    ← 收藏数
  like:        40540                    ← 点赞数
  video_review: 5025
  duration:    "21:24"                  ← 时长（字符串 mm:ss / h:mm:ss）
  pubdate:     1790731684               ← 发布时间（Unix 秒，= 2026-09-30T01:28:04Z）
  senddate:    1791389471
  typename:    "手机游戏"                ← 分类
  typeid:      "172"
  tag:         "鸣潮心,岁主,今汐,同奏,..."  ← 标签（逗号分隔）
  upic:        "https://i1.hdslb.com/bfs/face/e9e613...jpg"  ← UP 头像
  rank_index:  1
  hit_columns: ["title","description","tag"]   ← 命中在哪些字段
```
  `data` 顶层另有：`numResults`(1000)、`numPages`(50)、`next`(下一页)、`pageinfo`(各类型计数)、`suggest_keyword`。
  其他 `result_type`：`tips / brand_ad / esports / activity / web_game / card / media_bangumi / media_ft / bili_user / user / star / video`（多数为空数组）。
- **分页**：`&page=N` 可用，实测 page=1/2/3 各返回 20 条，`next` 正确递增。
- **结论**：**可用（匿名零门槛，首选）**

---

### 接口 2：`/x/web-interface/search/type?search_type=video&keyword=<kw>&page=1` —— 分类搜索
- **HTTP 状态码**：**412**
- **返回体前 500 字符（原文，纯 UA 时是 HTML 不是 JSON）**：
```
<!DOCTYPE html>
<html lang="zh-cn">

<head>
    <meta http-equiv="Access-Control-Allow-Origin" content="*" />
    <meta http-equiv="Page-Enter" content="blendTrans(Duration=0.5)">
    <meta http-equiv="Page-Exit" content="blendTrans(Duration=0.5)">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, user-scale=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta name="spm_prefix" content="333.937">
```
  页面正文关键文案（原文）：
```
            <div class="txt-item err-code">错误号: 412</div>
            <div class="txt-item err-text"></div>
            <div class="txt-item err-default">由于触发哔哩哔哩安全风控策略，该次访问请求被拒绝。 
              <div class="txt-item">The request was rejected because of the bilibili security control policy.</div>
            </div>
```
  该页最后加载 `//security.bilibili.com/static/js/412.js`（即 B 站 412 风控 JS 挑战页）。
- **code 字段值**：**纯 UA 下无 code 字段（返回的是 HTML，不是 JSON）**。若带全套浏览器头（Referer+Origin+Accept 等）但仍无 cookie，则返回 JSON：`{"code":-412,"message":"request was banned","ttl":1}`
- **是否需要登录 Cookie**：否（匿名 `buvid3` 即可，不需要 SESSDATA）
- **是否需要 wbi 签名**：**技术上不需要，但加上后成功率大幅提升**（见下）
- **是否需要 Referer**：否（实测「只带 buvid3、不带 Referer」也返回 200 code 0）
- **拿到的关键字段**（`data.result` 是数组，字段与接口 1 的 video item 基本一致，额外有 `tag`、`review`、`favorites`、`upic` 等，同样有 `bvid`/`aid`/`mid`/`cid`）
- **成功率实测（各 10 次，间隔 2s）**：
```
  type  纯UA                  ok=3/10  成功率=30%
  type  UA+buvid3             ok=8/10  成功率=80%
  type  UA+buvid3+buvid4      ok=6/10  成功率=60%
  type  UA+buvid3+wbi+Referer ok=10/10 成功率=100%
```
- **结论**：**需签名（+匿名 buvid3 cookie）**。这是唯一需要额外处理的搜索接口，且**没有必要用**——接口 1 已经 100% 可用。

---

### 接口 3：`/x/web-interface/search/all?keyword=<kw>&page=1` —— 老版聚合搜索
- **HTTP 状态码**：200
- **返回体前 500 字符（原文）**：
```
{"code":0,"message":"OK","ttl":1,"data":{"seid":"4434728298646500115","page":1,"pagesize":20,"numResults":1000,"numPages":50,"suggest_keyword":"","rqt_type":"search","exp_list":{"100010":true,"5500":true,"6699":true},"is_hit_web_inf":false,"egg_hit":0,"pageinfo":{"tv":{"numResults":0,"pages":0,"total":0},"user":{"numResults":0,"pages":0,"total":0},"movie":{"numResults":0,"pages":0,"total":0},"operation_card":{"numResults":0,"pages":0,"total":0},"upuser":{"numResults":0,"pages":0,"total
```
- **code 字段值**：`0`
- **是否需要登录 Cookie**：否
- **是否需要 wbi 签名**：否
- **是否需要 Referer**：否
- **拿到的关键字段**：`data.result` 长度 21，但结构**退化为索引数组**，`result_type` 多为 `undefined`/`null`（老接口已半废弃），取视频数据要靠遍历找 `bvid`。字段名与接口 1 相同。
- **结论**：**可用，但结构比 `/all/v2` 差，不推荐**（用 `/all/v2`）

---

### 接口 4：`/x/web-interface/view?bvid=<bvid>` —— 视频详情
- **HTTP 状态码**：200
- **返回体前 500 字符（原文，纯 UA，无 Referer 无 cookie）**：
```
{"code":0,"message":"OK","ttl":1,"data":{"bvid":"BV1FhpX6GE1i","aid":117425999709024,"videos":1,"tid":172,"tid_v2":2064,"tname":"","tname_v2":"","copyright":1,"pic":"http://i1.hdslb.com/bfs/archive/7e12b6fb3927618368db731f96086a29cc9a6638.jpg","title":"【原神】判测胜券本征 活动攻略/预测/原神7.1","pubdate":1791778896,"ctime":1791778896,"desc":"有帮助的话还请三连支持一下！\n原神最全的攻略导航：https://www.bilibili.com/read/cv13698984","desc_v2":[{"raw_text":"有帮助的话还请三连支持一下！\n原神最全的攻略导航：https://www.bilibili.com/read/cv13698984","type":1,"biz_id":0}],"state":0,"duration":42,"mission_id":4071093,"rights":{"bp":0,"elec":0,"download":1,"movie":0,"hd5":0,"no_reprint":1,"autoplay":1,"is_cooperation":0,"ugc_pay_preview":0,"no_background":0,"clean_mode":0,"is_stein_gate":0,"is_360":0,"no_share":0,"arc_pay":0,"free_watch":0},"owner":{"mid":431073645,"name":"你的影月月","face":"https://i0.hdslb.com/bfs/face/2e32de7b28fc491a28281a22c6ea9f5d195cbdf5.jpg"},"stat":{"aid":117425999709024,"view":757696,"danmaku":372,"reply":7355,"favorite":3489,"coin":2082,"share":1135,"now_rank":0,"his_rank":0,"like":28357,"dislike":0,"evaluation":"","vt":0},...
```
- **code 字段值**：`0`
- **是否需要登录 Cookie**：否
- **是否需要 wbi 签名**：否（加 w_rid 也 200 code 0，同样多余）
- **是否需要 Referer**：否（纯 UA、纯 UA+Referer、`curl/8.5.0` UA、甚至**完全无 UA**，四种情况全部 200 code 0 且返回体长度完全一致 2116 字节）
- **拿到的关键字段**（全部拿到，实测值）：
```
  title:      "【原神】判测胜券本征 活动攻略/预测/原神7.1"
  desc:       "有帮助的话还请三连支持一下！..."
  stat.view:      757696      ← 播放量
  stat.danmaku:   372         ← 弹幕数
  stat.reply:     7355        ← 评论数
  stat.favorite:  3489        ← 收藏数
  stat.coin:      2082        ← 硬币数
  stat.share:     1135        ← 分享数
  stat.like:      28357       ← 点赞数
  owner.name:  "你的影月月"
  owner.mid:   431073645
  owner.face:  "https://i0.hdslb.com/bfs/face/..."
  pubdate:    1791778896  (2026-10-22T…)
  duration:   42            ← 时长（秒，整数）
  videos:     1             ← 分P数
  pages:      [{"cid":42670952130,"page":1,"part":"...","duration":42,"dimension":{"width":1920,"height":1080}}]
  cid:        42670952130
  pic:        "http://i1.hdslb.com/bfs/archive/..."
  tid_v2:     2064
  rights:     {"download":1,"no_reprint":1,...}
  honor_reply:{"honor":[{"type":7,"desc":"热门收录"}]}
  ugc_season: （仅合集视频有，含 season_id/分集列表，会让返回体涨到 ~180KB）
```
- **结论**：**可用（匿名零门槛，字段极全）**

---

### 接口 5：`/x/web-interface/card?mid=<mid>&photo=false` —— 用户卡片
- **HTTP 状态码**：200
- **返回体前 500 字符（原文，纯 UA）**：
```
{"code":0,"message":"OK","ttl":1,"data":{"card":{"mid":"431073645","name":"你的影月月","approve":false,"sex":"男","rank":"10000","face":"https://i0.hdslb.com/bfs/face/2e32de7b28fc491a28281a22c6ea9f5d195cbdf5.jpg","face_nft":0,"face_nft_type":0,"DisplayRank":"0","regtime":0,"spacesta":0,"birthday":"","place":"","description":"","article":0,"attentions":[],"fans":10594932,"friend":222,"attention":222,"sign":"攻略在合集观看！电视端建议手机投屏！商务邮注明来意 jyybiz@qq.com  常用手机：一加15！不接代肝，用我名义接代肝的都是骗子！","level_info":{"current_level":6,"current_min":0,"current_exp":0,"next_exp":0},...
```
- **code 字段值**：`0`
- **是否需要登录 Cookie**：否
- **是否需要 wbi 签名**：否
- **是否需要 Referer**：否
- **拿到的关键字段**：`data.card.{name, face, sign, fans, attention, level_info.current_level, Official.title, official_verify.desc, nameplate.name, vip}`，`data.{follower, archive_count, like_num, following}`
- **结论**：**可用**

---

### 接口 6：`/x/player/wbi/v2?aid=<aid>&cid=<cid>` —— 字幕列表
- **HTTP 状态码**：200
- **返回体前 500 字符（原文，纯 UA）**：
```
{"code":0,"message":"OK","ttl":1,"data":{"aid":117425999709024,"bvid":"BV1FhpX6GE1i","allow_bp":false,"no_share":false,"cid":42670952130,"max_limit":300,"page_no":1,"has_next":false,"ip_info":{"ip":"120.219.119.91","zone_ip":" 10.158.17.41","zone_id":4505616,"country":"中国","province":"河南","city":"郑州"},"login_mid":0,"login_mid_hash":"","is_owner":false,"name":"","permission":"0","level_info":{"current_level":0,"current_min":0,"current_exp":0,"next_exp":0,"level_up":0},"vip":{"type":0,"status":0,...
```
- **code 字段值**：`0`
- **是否需要登录 Cookie**：接口本身不需要（`code:0`），**但要拿到非空字幕需要登录**
- **是否需要 wbi 签名**：**否！**（实测用**故意反转的错误 mixinKey** 签名，仍然 `http=200 code=0`。路径里的 `wbi` 只是个名字，服务端不校验 `w_rid`）
- **是否需要 Referer**：否（无 Referer 无 cookie 无 wbi，四种组合全部 200 code 0）
- **拿到的关键字段**：`data.subtitle`、`data.need_login_subtitle`、`data.view_points`（章节）、`data.online_count`、`data.ip_info`、`data.asr_language`、`data.ocr_language`
- **字幕实际情况（重点）**：
```
  subtitle: {"allow_submit":false,"lan":"","lan_doc":"","subtitles":[],"subtitle_position":null,"font_size_type":0}
  need_login_subtitle: true
```
  实测扫描了 **~200 个视频**（关键词覆盖 TED/纪录片/公开课/耶鲁/哈佛/斯坦福/字幕组/熟肉/央视新闻/NHK/航拍中国，以及 popular 全 20 条、ranking 全站榜前 40 条、PGC 番剧《航拍中国 第四季》前 5 集），**匿名下 `subtitles` 恒为 `[]`，一次都没拿到过非空字幕**。`view` 接口里的 `subtitle.list` 同样是 `[]`。
- **结论**：**可用（接口本身），但字幕内容匿名拿不到，等于不可用**

---

### 接口 7：`Referer: https://www.bilibili.com/` 是否必要
- **结论：不必要。** 有/无 Referer 对比实测：
  - `search/all/v2`：带 Referer 10/10 成功，不带 Referer 10/10 成功 → **Referer 无影响**
  - `search/all`（老版）：同上，无影响
  - `view`：纯 UA / 纯 UA+Referer / `curl/8.5.0` UA / **完全无 UA** 四种全部 200 code 0，返回体长度完全一致（2116 字节）→ **Referer 无影响，连 UA 都不影响**
  - `card`：无 Referer 200 code 0
  - `player/wbi/v2`：无 Referer 无 cookie 无 wbi → 200 code 0
  - `search/type`：单变量实测「只带 `buvid3` cookie、**不带 Referer**」→ 200 code 0；「只带 Referer、不带 cookie」→ 4 次里 2 次成功（50%）。**起决定作用的是 `buvid3` cookie，不是 Referer。**
- **建议**：插件里还是带上 `Referer: https://www.bilibili.com/`，无害且更接近真实浏览器，但**不要把它当成必需条件**。

---

### 接口 8：wbi 签名实测（完整流程 + 匿名可用性）

#### 8.1 `/x/web-interface/nav` 匿名能否拿到 `wbi_img`
- **HTTP 状态码**：200
- **返回体全文（原文，纯 UA，无 cookie 无 Referer）**：
```
{"code":-101,"message":"账号未登录","ttl":1,"data":{"isLogin":false,"wbi_img":{"img_url":"https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png","sub_url":"https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png"},"ip_region":"CN"}}
```
- **code 字段值**：`-101`（账号未登录）
- **但 `data.wbi_img` 完整返回**，连续 5 次请求 img/sub 值**完全稳定不变**：
  - `img_url` = `https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png`
  - `sub_url` = `https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png`
- **结论**：✅ **匿名可以拿到 wbi_img，不需要登录。** `code:-101` 只是"未登录"提示，不影响 `data` 里的 wbi_img。

#### 8.2 自算 w_rid 的完整流程（按本次实测验证）

```
步骤 1：GET https://api.bilibili.com/x/web-interface/nav   （只带 UA）
        取 data.wbi_img.img_url 与 data.wbi_img.sub_url
        imgKey = img_url 路径最后一段去掉 ".png"  → "7cd084941338484aae1ad9425b84077c"
        subKey = sub_url 路径最后一段去掉 ".png"  → "4932caff0ff746eab6f01bf08b70ac45"

步骤 2：拼接 raw = imgKey + subKey
        raw = "7cd084941338484aae1ad9425b84077c4932caff0ff746eab6f01bf08b70ac45"（64 字符）

步骤 3：按固定置换表 MIXIN_ENC_TAB 重排，取前 32 字符得到 mixinKey
        MIXIN_ENC_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,
                         33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,
                         26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52]
        mixinKey = MIXIN_ENC_TAB.map(i => raw[i]).join('').slice(0,32)
        本次实测：mixinKey = "ea1db124af3c7062474693fa704f4ff8"

步骤 4：准备业务参数（不含 wts / w_rid），加 wts = Math.floor(Date.now()/1000)
        例如 { search_type:"video", keyword:"鸣潮 心月狐", page:1, wts:1792045285 }

步骤 5：按 key 字典序排序，序列化为 query string；
        值里的 !'()* 要先做 %XX 转义（这是 B 站特有的，不做会签名失败）
        qs = "keyword=%E9%B8%A3%E6%BD%AE%20%E5%BF%83%E6%9C%88%E7%8B%91&page=1&search_type=video&wts=1792045285"

步骤 6：w_rid = md5(qs + mixinKey)
        本次实测：w_rid = "6f3056c62ec7a60b7246cf333d060260"

步骤 7：最终 URL = path + "?" + qs + "&w_rid=" + w_rid
        https://api.bilibili.com/x/web-interface/search/type?keyword=...&page=1&search_type=video&wts=1792045285&w_rid=6f3056c62ec7a60b7246cf333d060260
```

参考实现（Node，实测可用）：
```js
const MIXIN_ENC_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
const getMixinKey = raw => MIXIN_ENC_TAB.map(i => raw[i]).join('').slice(0, 32);
function signWbi(path, params, mixinKey) {
  const wts = Math.floor(Date.now() / 1000);
  const p = { ...params, wts };
  const qs = Object.keys(p).sort().map(k => {
    const v = String(p[k]).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    return encodeURIComponent(k) + '=' + encodeURIComponent(v);
  }).join('&');
  return path + '?' + qs + '&w_rid=' + md5(qs + mixinKey);
}
```

#### 8.3 算完 w_rid 再请求 `search/type`，code 是什么？

**变成 `code:0`（成功）。** 原始证据：
```
===== SEARCH_TYPE_wbi_signed =====
URL: https://api.bilibili.com/x/web-interface/search/type?keyword=%E9%B8%A3%E6%BD%AE%20%E5%BF%83%E6%9C%88%E7%8B%91&page=1&search_type=video&wts=1792045145&w_rid=f2203950380ada2103422bf726a634cc
HEADERS: {"User-Agent":"Mozilla/5.0 ... Chrome/131.0.0.0 Safari/537.36","Referer":"https://www.bilibili.com/"}
HTTP_STATUS: 200
BODY_FIRST_500: {"code":0,"message":"OK","ttl":1,"data":{"seid":"18302813665990390674","page":1,"pagesize":20,"numResults":1000,"numPages":50,..."result":[{"type":"video","id":117357364253026,"author":"叫我棉被","mid":6014992,..."bvid":"BV1sHa966Eu6","title":"【<em class=\"keyword"...
CODE: 0  MESSAGE: OK
```

**但关键限定条件（必须说明，否则会误导实现）**：
- wbi 签名**单独使用并不稳定**。实测 10 次「UA + wbi + Referer，**无 cookie**」：**ok=0/10，全部 412**。
- 加上匿名 `buvid3` cookie 后：「UA + buvid3 + wbi + Referer」：**ok=10/10，100%**。
- 也就是说：**真正把成功率从 30% 拉到 100% 的是 `buvid3` 匿名 cookie，wbi 签名是锦上添花**。
- `buvid3` 的获取也是完全匿名的：`GET /x/frontend/finger/spi` →
  `{"code":0,"data":{"b_3":"3491B2DA-C856-E2D4-F281-857FCA03291287205infoc","b_4":"363AC430-..."},"message":"ok"}`
- **假 buvid3 也能过**（实测 `buvid3=00000000-0000-0000-0000-000000000000infoc` + Referer → 200 code 0）。所以这不是"身份"，只是"有没有带 cookie 这个动作"。
- 签名算法正确性验证：在 `/x/space/arc/search`（严格校验 w_rid 的接口）上，正确 mixinKey 4 次成功 1 次，错误 mixinKey 4 次成功 0 次 → 算法方向正确，但 412 噪声太大难以量化。
- **`/x/player/wbi/v2` 完全不校验 w_rid**：用故意反转的错误 mixinKey 签名，依然 `200 code 0`。

---

## 总结论

### 匿名（只带 UA）能拿到什么
1. **搜索**：`search/all/v2` 和 `search/all` 都是 **HTTP 200 / code 0 / 10/10 稳定成功**，无需 cookie、无需 wbi、无需 Referer。能拿到标题、UP主名+mid、播放量、弹幕数、评论数、收藏数、点赞数、时长、发布时间、封面、bvid、aid、cid、分类、标签、简介。
2. **视频详情**：`view?bvid=` 拿到 title / desc / stat(view,danmaku,reply,favorite,coin,share,like) / owner(mid,name,face) / pubdate / duration(秒) / videos / pages(cid) / pic / rights / honor_reply。**连 UA 都不需要**（无 UA 也返回同样内容）。
3. **用户卡片**：`card?mid=` 拿到 name / face / sign / fans / attention / archive_count / like_num / level / Official 认证。
4. **播放器元数据**：`player/wbi/v2?aid=&cid=` 拿到 `need_login_subtitle`、章节 `view_points`、在线人数等——**但 `subtitles` 恒为 `[]`**。
5. **其他顺带验证可用的**：`/x/web-interface/popular`、`/x/web-interface/ranking/v2`、`/x/web-interface/archive/related`、`/x/web-interface/archive/desc`、`/x/v2/reply/main`（评论区）、`/x/relation/stat`、`/x/player/pagelist`、`/x/web-interface/suggest`、`/pgc/view/web/season`、`/pgc/season/rank/cn`。
6. **匿名身份材料**：`nav` 拿 `wbi_img`，`/x/frontend/finger/spi` 拿 `buvid3`/`buvid4`。

### 匿名拿不到什么
1. **CC 字幕内容**：扫了 ~200 个视频（含 popular 全量、ranking 前 40、PGC 番剧 5 集、以及 TED/纪录片/公开课/耶鲁/哈佛/斯坦福/字幕组/央视新闻 等大量关键词），`subtitles` **一次都没非空过**。很多视频 `need_login_subtitle: true`。**字幕（及 AI 字幕 asr）匿名不可得。**
2. **视频文件/播放地址**：`/x/player/playurl` 匿名能返回 `code:0` 和 dash 片段 baseUrl，但那是 CDN 临时地址，需要 Referer+登录态才能稳定播放，且**视频内容本身抓取没有意义**（体积大、时效短、可能需登录/大会员）。
3. **`search/type` 的 100% 稳定**：必须带 `buvid3` cookie（+ wbi + Referer）。
4. **`/x/space/arc/search`（UP 主视频列表）**：匿名需要严格 wbi 签名，实测噪声大、成功率低。
5. **登录态相关内容**：收藏夹、历史、关注列表、稍后再看、大会员专享、`is_upower_exclusive` 视频。

### 如果某接口要 wbi 签名，完整流程
见上面 **8.2**。要点：
- `nav` 匿名**能**拿到 `wbi_img`（`code:-101` 但 `data.wbi_img` 完整且稳定）。
- 流程：nav → imgKey/subKey → `raw = imgKey+subKey` → `MIXIN_ENC_TAB` 重排取前 32 → `mixinKey` → 业务参数加 `wts` → key 字典序排序序列化（值里 `!'()*` 要先 %XX 转义）→ `w_rid = md5(qs + mixinKey)` → 拼回 URL。
- 但**本次实测最重要的发现是：`search/type` 的 -412 主因是缺匿名 `buvid3` cookie（WAF 层），不是缺签名**。签名单独上加并未把成功率从 30% 提上来（0/10），加上 `buvid3` 后才 10/10。

### 推荐的功能组合（支撑「B站搜索」）
**主路径（零签名、零 cookie、零 Referer，最简）：**
1. `GET /x/web-interface/search/all/v2?keyword=<kw>&page=<n>` → 解析 `data.result[]` 中 `result_type==="video"` 的 `data[]`（每页 20 条）
   → 输出：标题（剥 `<em class="keyword">`）、UP主（`author`/`mid`）、播放量（`play`）、时长（`duration`）、封面（`pic` 补 `https:`）、bvid（`bvid`）、链接（`https://www.bilibili.com/video/${bvid}`）、弹幕/评论/收藏/点赞、发布时间、分类、标签、简介。
2. 用户点某条 → `GET /x/web-interface/view?bvid=<bvid>` → 补全详情（完整 stat、owner、duration 秒、pages/cid、简介全文）。
3. 需要 UP 主信息 → `GET /x/web-interface/card?mid=<mid>&photo=false`。
4. 需要评论区 → `GET /x/v2/reply/main?oid=<aid>&type=1&mode=3`。
5. 需要相关推荐 → `GET /x/web-interface/archive/related?bvid=<bvid>`。

**加固路径（可选，只为让 `search/type` 也 100%）：**
- 启动时 `GET /x/frontend/finger/spi` 拿 `buvid3`（匿名，无需登录），之后所有请求带 `Cookie: buvid3=<值>`。
- 若确需 `search/type`：再叠加 wbi 签名 + `Referer` → 实测 10/10。
- **但既然 `all/v2` 已经 100%，这条加固路径可以不做。**

### 这类平台的「视频内容」插件该怎么设计
（当时一并评估过抖音：搜索撞 `status_code 2483` 登录墙、详情撞 `ArgusSecurityPlugin` 403 网关墙、
`a_bogus` 实测不被校验 —— **那三个结论正是后来放弃抖音的依据**；本节保留通用方法论）

1. **定位成「元数据层」，不是「内容层」。** 视频文件（mp4/flv/dash 片段）不要作为抓取目标：体积大、CDN 地址短时效、大多要登录态/大会员、且对插件没有增量价值。插件的价值在**结构化的标题/UP主/播放量/时长/封面/bvid/链接**。
2. **按「接口风险等级」分层，逐层降级：**
   - **L0 免签名层**（B站：`search/all/v2`、`view`、`card`、`reply/main`、`related`、`popular`、`ranking/v2`）→ 这是主力，务必优先实现并作为默认路径。
   - **L1 匿名 cookie 层**（B站：`buvid3` from `/x/frontend/finger/spi`）→ 用于把 `search/type` 这类半风控接口拉到 100%。
   - **L2 签名层**（B站：wbi；另有平台用 `a_bogus`/`X-Bogus`/`X-Gorgon` 等）→ **只在 L0/L1 不够时才做**。注意抖音实测 `a_bogus` 不被校验，说明该平台的墙是**网关层 ArgusSecurityPlugin**，签名算法再对也过不去——**签名不是万能药，不要为它投入主要工程量**。
   - **L3 登录态层** → 插件不应做（要用户 Cookie，合规与维护成本都高）。
3. **必须把「风控随机 412」当一等公民处理：**
   - B站 412 返回的是 **HTML 挑战页**（含 `security.bilibili.com/static/js/412.js`），不是 JSON。**解析前必须先判断 `content-type` / 首字符是不是 `{`**，否则 `JSON.parse` 直接抛异常。
   - 实现**重试 + 指数退避**（实测纯 UA 下 `search/type` 30% 成功率，重试 3 次即可到 ~97%）。
   - 请求间隔 ≥ 1~2s，**绝不要并发轰炸**。
   - 把「接口在风控黑名单里」和「接口不存在」区分开：B站不存在的老接口返回 **HTTP 404 + HTML**，而风控是 **HTTP 412 + HTML**，参数错误是 **HTTP 200 + `{"code":-400}`**。
4. **字幕：明确做成「尽力而为 + 明示不可用」。** B站匿名 `subtitles` 恒空；其他平台更严格。UI 上要能显示「该视频无公开字幕（需登录）」，而不是静默失败。**不要承诺字幕功能**。
5. **字段清洗要点：**
   - 标题/简介里的 `<em class="keyword">` 高亮标签要剥掉，并反转义 `&lt; &gt; &amp; &quot; &#39; &nbsp;`。
   - 封面 `pic` 常是 `//i0.hdslb.com/...`，要补 `https:`。
   - `pubdate` 是 Unix 秒；`duration` 在搜索结果是 `"21:24"` 字符串、在 `view` 里是 `1284` 秒整数——**两种表示都要兼容**。
   - `view` 返回体可能因 `ugc_season`（合集）从 2KB 涨到 180KB，解析时注意体积。
6. **架构上把「平台适配器」抽象成统一接口**（`search(kw, page)` / `getVideo(id)` / `getUser(id)`），每个平台一个适配器，风控策略（cookie 注入、签名、重试）放在适配器内部，上层插件逻辑不感知平台差异。这样某个平台墙变严时只改一个适配器。**本插件当前只接 B 站**，但接口按这个形态保留。

---

## 附：产出文件
- 探测脚本：`TieBa\tools\probe_bili_1.mjs` ~ `probe_bili_17.mjs`（Node 24，只用内置 `fetch` + `node:crypto`；留在原工作区，未随插件搬入）
- 原始证据（UTF-8，含每个请求的完整 URL / headers / HTTP 状态码 / 返回体前 500 字符 / code / message）：本工作区 `probe-evidence\probe_bili_phase1.txt` ~ `probe_bili_phase17.txt`
- 本报告：原 `TieBa\tools\probe_bili_report.md`，搬入后为 `B站公开接口匿名探测报告.md`（根目录）
