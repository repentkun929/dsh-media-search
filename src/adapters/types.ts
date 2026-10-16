/**
 * 平台适配器接口抽象。
 *
 * 风控策略（cookie 注入 / 重试 / 412 回退）**必须关在适配器内部**，不漏到工具层：
 * 工具层只看到「成功拿到数据」或「抛出一个带可读原因的 Error」。
 */
import type { AudioStreamInfo } from '../asr.ts'
import type { ReplyItem, UserItem, VideoDetail, VideoItem } from '../fragment.ts'

/** 列表类返回：列表 + 翻页信息。 */
export interface ListPage {
  items: VideoItem[]
  /** 服务端给的下一页页码；没有下一页时为 0。 */
  nextPage: number
  /** 是否还有下一页。 */
  hasMore: boolean
  /** 命中的总条数（接口给不出时为 0）。 */
  total: number
}

export interface ReplyPage {
  items: ReplyItem[]
  /** 评论总数（可能上万）。 */
  allCount: number
  hasMore: boolean
}

/**
 * 一个平台适配器要提供的能力。可选方法意味着该平台没有这项能力。
 *
 * 注意 search 没有排序参数：B 站的 `order` 经实测**不能作为排序控制使用**
 * （前三位不随 order 变化，后面位置的差异方向也不可信），所以固定走综合排序。
 * 理由与实测数据见 adapters/bilibili.ts 的 search() 注释。
 */
export interface MediaAdapter {
  readonly name: 'bilibili'
  search(q: string, page: number, limit: number): Promise<ListPage>
  detail(id: string): Promise<VideoDetail>
  replies(id: string, page: number, limit: number): Promise<ReplyPage>
  user(id: string): Promise<UserItem>
  related?(id: string, limit: number): Promise<ListPage>
  popular?(page: number, limit: number): Promise<ListPage>
  /**
   * 取音频流列表（DASH）。只有 B 站有。
   *
   * 单独放进适配器接口，是因为它需要 cid —— 调用方一般先用 `detail()` 拿到 cid。
   * 注意返回的是 DASH 的 `baseUrl`（带宽 + 编码 + `sidx` 索引），
   * 用它能按时长**精确**切片段，而不是按「字节数 = 时长 × 比特率」那种近似。
   */
  audioStreams?(id: string, cid: number): Promise<AudioStreamInfo[]>
}
