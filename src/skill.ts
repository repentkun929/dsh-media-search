/**
 * 技能提供者：注册 `media-briefing` 技能，规范模型拿到工具数据后的播报格式。
 *
 * 为什么要单独做一个技能而不是只靠系统提示：系统提示讲「什么时候用哪个工具」，
 * 技能讲「拿到数据后怎么组织回复」——后者只在真正播报时才需要，分开可省上下文。
 */
import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate,
  type SkillDefinition,
  type SkillProvider,
} from '@deepseek-ai/dsh-skill'

const PROVIDER_NAME = 'dsh-media-search'
const INVOCATION = { modelInvocable: true, userInvocable: true } as const

const CANDIDATES: SkillCandidate[] = [{
  name: 'media-briefing',
  description:
    '播报 B 站媒体数据时使用：规定搜索结果、视频详情、评论、热门榜的汇报格式'
    + '（每条一行带链接、数字带量级、只依据工具数据不编造、说明抽样与翻页边界）。',
  invocation: INVOCATION,
  provider: PROVIDER_NAME,
  source: 'bundled',
  rank: BUNDLED_SKILL_RANK,
  locator: 'media-briefing',
}]

const BODY = `# 媒体播报规范（media-briefing）

调用媒体工具（bili_video_search / bili_video_detail / bili_video_replies /
bili_video_related / bili_user_profile / bili_popular / bili_video_transcript）拿到数据后，
按本规范组织回复。

## 结构契约（按顺序）
1. **先报定位**：一句话说清「在哪个平台、搜了什么/看的哪个视频」，以及拿到多少条。
2. **列表逐条一行**：每条 = \`[标题](链接) · UP主 · 发布时间\`。
   封面(pic)、标签等只在用户明确要看时补上，不要每条都堆。
3. **视频详情**：先给结论（这个视频讲什么），再给关键数据（标题/UP主/分区/时长/发布时间/链接）；
   分 P 与合集用嵌套列表，超过 20 项时说明「仅列前 20 项」。
4. **评论**：按点赞从高到低摘录，每条标作者与点赞数；评论上万条时**必须**说明
   「按热度只取前 N 条，未读全部」。
5. **结尾一句**：需要下一页/更多时，提示可继续翻 page 或用相关推荐工具。

## 数据粒度（用户嫌过详，默认都别铺）
- **默认只给**：标题、链接、UP 主、发布时间、视频/UP 主的定位性数字（粉丝数、时长）。
- **播放量、弹幕数、评论数、点赞、投币、收藏这类明细数据默认不展示** ——
  它们是噪声，用户要的是「这是什么、在哪看、哪天发的」。只在用户明确问
  「数据怎么样 / 有多少播放 / 热度如何」时才逐项给出。
- 同理，简介/标签/封面图默认省略，用户要看再补。

## 必含要素
- 视频链接必须给（用户要能点回原页面），且**只能是工具返回体里那一个**
  （搜索/相关/热门结果现在每行末尾自带 \`https://www.bilibili.com/video/<bvid>\`）。
- 数据条数要说清（例：「共约 1000 条结果，本页 10 条」），不要让用户猜。
- 数字带量级（「1072.5万」而不是「107248125」），工具返回里已格式化好，直接沿用；
  但按上面的粒度规则，这类数字默认根本不出现。

## 格式契约
- 中文回复；列表用 markdown 列表；一条内容一行，不写成长段落。
- 先结论后证据；引用哪条就给哪条的链接。

## 边界（不做什么）
- **只依据工具返回的数据**，不编造标题、UP 主、播放量、评论或热度。
- **不编造字幕/视频内容**：本插件拿不到 CC 字幕，需要概括内容时只能依据标题、简介、
  评论与分 P 信息，并如实说明依据来源。
- **不编造链接**：链接只能用工具返回体里的那一个。工具没给链接时，宁可只报标题，
  也不要「补」一个 BV 号 —— 编出来的链接会指向别的视频（实测踩过：20 条结果全成了同一个 BV）。
- **不越界到其他平台**：本插件只覆盖 B 站。用户问其他平台时，直接说没有这些能力，
  不要拿 B 站的结果冒充。
- 工具返回空/失败时，直接说失败原因（关键词无结果 / 视频被删 / 412 风控 / 需要登录），
  不要用训练记忆填空。
- 工具已经做了抽样与截断，超过上限的内容必须说明「只取到前 N 条，其余未读」。
- 不要整段复制简介或评论原文（版权），摘录关键句即可。
`

export const mediaSkillProvider: SkillProvider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve(CANDIDATES),
  async get(candidate: SkillCandidate): Promise<SkillDefinition> {
    return {
      name: candidate.name,
      description: candidate.description,
      invocation: candidate.invocation,
      provider: PROVIDER_NAME,
      source: 'bundled',
      content: BODY,
    }
  },
}
