/**
 * 客户端入口：给工具注册 GUI 卡片（Toolview）。
 *
 * 装配形态与贴吧插件一致（那套是实测跑通过的）：导出 name/inject/apply 三件套，
 * apply 里对每个工具名逐个 inject + register 到 'tool.call.toolview' 槽位。
 *
 * 注意这里**列了 7 个 key**（含 P7 的 bili_video_transcript），而服务端只在
 * `asrEnabled=true` 时注册那个工具 —— 多注册一个用不到的 Toolview 是无害的
 * （槽位是「有结果才渲染」），反而避免了「服务端开关一变，客户端要重新打包」的耦合。
 */
import type { ClientContext } from './types'
import { MediaView } from './toolview'

export const name = 'dsh-media-search'
export const inject = ['slots']

const TOOL_KEYS = [
  'bili_video_search',
  'bili_video_detail',
  'bili_video_replies',
  'bili_video_related',
  'bili_user_profile',
  'bili_popular',
  'bili_video_transcript',
]

export function apply(ctx: ClientContext): void {
  for (const key of TOOL_KEYS) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      { name: 'tool.call.toolview', key },
      MediaView,
    ))
  }
}
