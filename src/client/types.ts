// 最小客户端契约声明（与贴吧插件同源，形状依据为 asar 实读）。
//
// 为什么要手写：宿主 @deepseek-ai/dsh-client-runtime 在 0.2.0-rc.2 不存在，
// 而 @deepseek-ai/dsh-client-ui-tool / dsh-client-ui-renderer 在 asar 里只打包了
// lib/*.js，lib/types/** 未随包发布 → TS 编译拿不到 ClientContext /
// ToolCallViewProps 的真实类型。
//
// 形状依据（均为 asar 抽取副本实读）：
// - dsh-client-ui-tool/lib/client.js:1832  toolview 组件 owner props =
//   { callId, toolName, ...call, openFile, cwd, home, loadImage, useDisclosure, inspect }，
//   call = { phase, block }
// - dsh-client-ui-tool/lib/client.js:1804  block 三态：'kind' in block → 已结束；
//   否则 block.phase === 'preparing' → 准备中；否则 'start'
// - dsh-client-ui-tool/lib/client.js:179   结果文本：遍历 node.content，block.type === 'text' 取 block.text
// - dsh-client-ui-tool/lib/client.js:1009  meta 读取：非 object / null / 数组 → null；
//   !('kind' in block) || isError → null
// - dshmarket/client/client.js            ctx.slots.register 返回 disposer

export type ToolCallBlock =
  | { phase: 'start' | 'preparing' | 'end'; isError?: boolean; meta?: unknown; content?: unknown }
  | ({ kind: string; isError?: boolean; meta?: unknown; content?: unknown } & Record<string, unknown>)

export type ToolCallViewProps = {
  callId: string
  toolName: string
  block: ToolCallBlock
}

type SlotRegistrationOptions = {
  name: string
  key?: string
  locale?: unknown
}

type SlotRegistration = (
  options: SlotRegistrationOptions,
  component: (props: ToolCallViewProps) => unknown,
) => () => void

type SlotsService = {
  inject: (slot: string, factory: () => unknown) => unknown
  register: SlotRegistration
}

export type ClientContext = {
  slots: SlotsService
}
