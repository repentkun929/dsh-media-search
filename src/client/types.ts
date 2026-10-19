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
//
// 已用 npm 包 @deepseek-ai/dsh-client-ui-tool@0.2.1-rc.2 的 lib/types 核实
// （lib/types/client/contract/slots.d.ts）：'tool.call.toolview' 是 keyed 槽位，
// owner = ToolCallCommonProps & ToolCallPhaseProps，后者的形状是
//   { phase: 'preparing', block: PreparingToolCall }
// | { phase: 'start',     block: StartedToolCall }
// | { phase: 'result',    block: ToolResultNode }
// 即 phase 与 block 是**并列**的兄弟字段（宿主代码里是 `{...call}` 展开的），
// 所以这里的 props 必须把 block 声明成可选，不能假设它一定在。

export type ToolCallBlock =
  | { phase: 'start' | 'preparing' | 'end'; isError?: boolean; meta?: unknown; content?: unknown }
  | ({ kind: string; isError?: boolean; meta?: unknown; content?: unknown } & Record<string, unknown>)

/**
 * 注册到 'tool.call.toolview' 的组件**只拿到 owner 与注入那份 props**，
 * 没有额外字段。宿主 0.2.x 的实际形状是 `{ phase, block, callId, toolName, ... }`
 * —— `block` 是兄弟字段而不是独生子，所以要容忍「block 缺席」的宿主：
 * 早先按 `{ block }` 写死时，宿主一旦只给 phase 不嵌 block，`'kind' in undefined`
 * 会直接抛错把整张卡片炸掉（不是回落到兜底文本，是渲染异常）。
 */
export type ToolCallViewProps = {
  callId: string
  toolName: string
  /** 宿主 0.2.x：阶段四态之一，与 block 并列。 */
  phase?: 'preparing' | 'start' | 'end' | 'result'
  /** 三态块：准备中 / 已开始 / 已结束。缺席时按「准备中」渲染骨架屏。 */
  block?: ToolCallBlock
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
