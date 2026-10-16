/**
 * 服务端插件入口：通过 cordis 生命周期注册工具与系统提示。
 *
 * 这里刻意沿用贴吧插件已实测通过的装配形态（而不是自造一套 API）：
 * - 导出 `name` / `inject` / `apply` 三件套，由 cordis 装载；
 * - 必须重新导出 `Config`，否则 apply 拿到的 config 是 undefined
 *   （原因见下方注释），症状是「插件装了但没有工具」且**没有任何报错**。
 */
import type { Context } from '@deepseek-ai/cordis'
import { type Config, Config as ConfigSchema } from './config.ts'
import { mediaTools } from './tool.ts'
import { mediaSkillProvider } from './skill.ts'

export const name = 'dsh-media-search'
export const inject = ['tools', 'skills', 'systemPrompt']

/**
 * 必须重新导出配置 schema —— cordis 靠它给 apply() 注入默认值。
 *
 * cordis 的 resolveConfig()（lib/index.js:956-962）是：
 *   if (!runtime.Config) return config        // 没有 schema 就原样透传
 *   return runtime.Config['~standard'].validate(config).value
 * 而 runtime.Config 取自 `plugin.Config`（lib/index.js:1631）。
 *
 * 我们的 cordis.patch.yml 条目没有 `config:` 字段，所以透传进来的是 undefined；
 * 若不导出 Config，apply(ctx, undefined) 会在读 config.userAgent 时抛 TypeError，
 * 整个插件的 7 个工具一个都注册不上（症状是「插件装了、文件在位、也没有 skip 警告，
 * 但模型工具列表里没有 bili_*」）。
 */
export { ConfigSchema as Config }

/** B 站工具的使用边界，写进系统提示（段落名与贴吧插件的 tool:tieba 并列）。 */
const PROMPT = `## Query media (bilibili)
用户询问 B 站内容时，使用媒体搜索工具族（读公开数据，匿名即可，不需要登录）：
- \`bili_video_search\`：按关键词搜 B 站视频，按 B 站综合排序返回（插件不提供排序参数，
  因为 B 站的 order 参数实测不能可靠控制排序，不要向用户承诺「按播放量排序」）；
  支持 page 翻页，每页 20 条。返回的每一条都带可点击链接，**照原样给用户**，
  不要自己改写或「补」BV 号 —— 编出来的链接会指向错误视频。
- \`bili_video_detail\`：一个视频的标题/简介/分 P/合集/UP 主/互动数据。用户给 BV 号或
  bilibili.com/video/BV... 链接时**第一步就调它**。CC 字幕匿名拿不到，本插件不提供字幕。
- \`bili_video_replies\`：视频评论（按热度抽样，可 page 翻页；上万条评论不要全读进来）。
- \`bili_video_related\`：视频的相关推荐。
- \`bili_user_profile\`：UP 主资料（粉丝/关注/获赞/等级/签名）。
- \`bili_popular\`：B 站当前热门榜。
- \`bili_video_transcript\`（仅在 asrEnabled=true 时注册）：把一个 B 站视频的音频转写成文字稿。
  当用户问「这个视频讲了什么」而简介/分P/评论答不上来时用它，而不是只甩一个链接。
  它只覆盖视频**开头若干秒**（默认 300，上限 1800），返回体会写明覆盖范围 ——
  必须把这句话一起转达，不要把片段内容说成整个视频的总结。
 工具失败时会返回一段可读说明（例如「B 站返回 412 风控」），把说明转达给用户即可，
 不要对同一个失败调用重试超过 1 次。

本插件**只覆盖 B 站**。用户问到其他平台时，如实说明本插件没有这些能力，
不要拿 B 站的结果冒充，也不要凭训练记忆编造其他平台的内容。

**播报粒度**：默认只给「标题 + 链接 + UP 主 + 发布时间」。播放量、弹幕、评论、点赞、
投币、收藏这类明细数据**默认不要逐个罗列** —— 用户明确问热度/数据时才给。`

/**
 * 兜底：即使 cordis 没走到 schema（例如宿主行为变化、或有人直接调 apply），
 * 也不能让 config 是 undefined —— 否则读 config.userAgent 会抛进 ctx.effect 里，
 * 被 cordis 静默吞掉，表现为「工具全没了但没有任何报错」。
 */
function normalizeConfig(config: unknown): Config {
  // schemastery 的 validate 是同步的，但标准类型签名允许 Promise。
  const result = ConfigSchema['~standard'].validate(config ?? {}) as
    | { value: Config }
    | { issues: unknown }
  if ('issues' in result) throw new Error(`dsh-media-search 配置无效：${JSON.stringify(result.issues)}`)
  return result.value
}

export function apply(ctx: Context, rawConfig: Config) {
  const config = normalizeConfig(rawConfig)

  ctx.effect(() => {
    const disposers = mediaTools(config).map((tool) => ctx.tools.register(tool))
    return () => disposers.forEach((d) => d())
  }, 'dsh-media-search.tools')

  ctx.effect(() => ctx.skills.registerProvider(() => mediaSkillProvider), 'dsh-media-search.skill')

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'tool:mediasearch',
    order: 118,
    text: PROMPT,
  }), 'dsh-media-search.prompt')
}
