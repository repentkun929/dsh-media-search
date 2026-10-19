/**
 * GUI 卡片：把 7 个工具的结果渲染成列表 / 详情卡。
 *
 * 数据流：服务端 presentationMeta 产出的 meta → 这里按 meta.kind 选视图。
 * 硬规则（沿用贴吧插件已验证的规则）：
 * 1. meta 来自服务端且**未经信任校验**，一切字段访问都要防御式判断，
 *    缺失就退回纯文本兜底，绝不能因为字段缺失把卡片渲染崩掉；
 * 2. block 三态要分清：`'kind' in block` 为假 = 还没结束（骨架屏）；
 *    isError / meta 校验失败 = 兜底纯文本。
 */
import type { ReactNode } from 'react'
import type { MediaMeta, VideoItem } from '../fragment'
import { countText, formatTime, mediaMetaFrom } from '../fragment'
import type { ToolCallViewProps } from './types'

const rowStyle = {
  padding: '6px 0',
  borderTop: '1px solid rgba(128,128,128,.2)',
} as const

const headStyle = {
  fontWeight: 600,
  marginBottom: 8,
} as const

const subtle = { opacity: 0.62, fontSize: 12 } as const

function Loading() {
  return (
    <div style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary, #888)' }}>
      ⏳ 正在读取媒体数据…
    </div>
  )
}

function Fallback({ block }: { block: { content?: unknown } }) {
  const c = block.content
  const text = Array.isArray(c) && c.length > 0 && typeof c[0] === 'object'
    && c[0] !== null && 'text' in c[0]
    ? String((c[0] as { text?: unknown }).text)
    : ''
  return (
    <div style={{ padding: 12, fontSize: 13, whiteSpace: 'pre-wrap' }}>
      {text || '媒体结果不可用'}
    </div>
  )
}

/**
 * 一行视频。列表类视图共用（VideoItem 已在 fragment.ts 定好型）。
 * 副行只留 UP / 分区 / 时长 / 日期 —— 播放量、弹幕这类明细对用户是噪声
 * （与服务端 videoLine 的口径一致，见 src/tool.ts）。
 */
function VideoRow({ v }: { v: VideoItem }) {
  const title = v.title || '(无标题)'
  const url = v.url || undefined
  const pub = v.pubdateISO ? v.pubdateISO.slice(0, 10) : ''
  const line = [
    v.author ? `UP ${v.author}` : '',
    v.tname,
    v.duration,
    pub,
  ].filter(Boolean).join(' · ')

  return (
    <div style={rowStyle}>
      <div>
        {url ? <a href={url} target="_blank" rel="noreferrer">{title}</a> : title}
      </div>
      <div style={subtle}>{line}</div>
    </div>
  )
}

function SearchView({ meta }: { meta: Extract<MediaMeta, { kind: 'bili-search' }> }) {
  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div style={headStyle}>
        B 站搜索「{meta.keyword}」· 第 {meta.page} 页 · {meta.items.length} 条
        {meta.total > 0 ? `（共约 ${countText(meta.total)} 条）` : ''}
      </div>
      {meta.items.map((v, i) => <VideoRow key={v.bvid || String(i)} v={v} />)}
      <div style={{ marginTop: 8, ...subtle }}>
        {meta.hasMore ? `还有第 ${meta.page + 1} 页可读` : '已到最后一页'}
      </div>
    </div>
  )
}

function RelatedView({ meta }: { meta: Extract<MediaMeta, { kind: 'bili-related' }> }) {
  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div style={headStyle}>{meta.bvid} 的相关推荐 · {meta.items.length} 条</div>
      {meta.items.map((v, i) => <VideoRow key={v.bvid || String(i)} v={v} />)}
    </div>
  )
}

function PopularView({ meta }: { meta: Extract<MediaMeta, { kind: 'bili-popular' }> }) {
  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div style={headStyle}>B 站热门榜 · 第 {meta.page} 页 · {meta.items.length} 条</div>
      {meta.items.map((v, i) => <VideoRow key={v.bvid || String(i)} v={v} />)}
      <div style={{ marginTop: 8, ...subtle }}>
        {meta.hasMore ? `还有第 ${meta.page + 1} 页可读` : '已到最后一页'}
      </div>
    </div>
  )
}

function RepliesView({ meta }: { meta: Extract<MediaMeta, { kind: 'bili-replies' }> }) {
  const total = meta.allCount > meta.items.length
    ? ` · 全视频共约 ${countText(meta.allCount)} 条，本页取 ${meta.items.length} 条`
    : ''
  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div style={headStyle}>{meta.bvid} 的评论 · 第 {meta.page} 页{total}</div>
      {meta.items.map((c, i) => (
        <div key={c.rpid || `r${i}`} style={rowStyle}>
          <div>
            <b>{c.author || '匿名'}</b>
            <span style={subtle}>
              {' '}赞 {countText(c.like)}
              {c.rcount ? ` · 楼中楼 ${c.rcount}` : ''}
              {c.ctimeISO ? ` · ${formatTime(c.ctime)}` : ''}
            </span>
          </div>
          <div>{c.content.length > 300 ? `${c.content.slice(0, 300)}…` : c.content}</div>
        </div>
      ))}
      <div style={{ marginTop: 8, ...subtle }}>
        {meta.hasMore ? `还有第 ${meta.page + 1} 页可读` : '已到最后一页'}
      </div>
    </div>
  )
}

function UserView({ meta }: { meta: Extract<MediaMeta, { kind: 'bili-user' }> }) {
  const u = meta.items[0]
  if (!u) return <div style={{ padding: 12, fontSize: 13 }}>没有取到 UP 主资料</div>
  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div style={headStyle}>
        <a href={`https://space.bilibili.com/${u.mid}`} target="_blank" rel="noreferrer">{u.name}</a>
        <span style={subtle}>（mid {u.mid}）</span>
      </div>
      <div style={subtle}>
        粉丝 {countText(u.fans)} · Lv{u.level}
      </div>
      {u.sign ? <div style={{ marginTop: 4, opacity: 0.85 }}>{u.sign}</div> : null}
    </div>
  )
}

function DetailView({ meta }: { meta: Extract<MediaMeta, { kind: 'bili-detail' }> }) {
  const d = meta.detail
  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div style={headStyle}>
        <a href={d.url} target="_blank" rel="noreferrer">{d.title}</a>
      </div>
      <div style={subtle}>
        UP {d.owner.name} · {d.tname || '未知分区'}
        {d.pubdateISO ? ` · ${d.pubdateISO.slice(0, 10)}` : ''}
      </div>
      <div style={{ marginTop: 4 }}>
        时长 {Math.floor(d.durationSec / 60)}分{d.durationSec % 60}秒
        {d.pages.length > 1 ? ` · ${d.pages.length} 个分 P` : ''}
      </div>
      {d.pages.length > 1
        ? (
          <div style={{ marginTop: 6 }}>
            <b>分 P（{d.pages.length}）</b>
            {d.pages.slice(0, 30).map((p) => (
              <div key={p.cid} style={subtle}>P{p.page} {p.part}</div>
            ))}
            {d.pages.length > 30
              ? <div style={subtle}>…仅列前 30 个分 P</div>
              : null}
          </div>
        )
        : null}
      {d.season
        ? (
          <div style={{ marginTop: 6 }}>
            <b>合集《{d.season.title}》</b>
            {d.season.sections.map((s) => (
              <div key={s.title} style={subtle}>{s.title}（{s.episodes.length} 集）</div>
            ))}
          </div>
        )
        : null}
      {d.desc
        ? (
          <div style={{ marginTop: 6, opacity: 0.8, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {d.desc.length > 800 ? `${d.desc.slice(0, 800)}…` : d.desc}
          </div>
        )
        : null}
    </div>
  )
}

/**
 * 音频转写卡。
 *
 * 这个卡片的**首要职责不是展示文字，而是把「只覆盖了前 N 秒」说清楚** ——
 * 服务端已经在文本里声明过，但如果卡片只渲染文字稿、不显示覆盖范围，
 * 用户截一张图就很容易把它当成整个视频的内容。所以覆盖范围用醒目样式放在最上面。
 */
function TranscriptView({ meta }: { meta: Extract<MediaMeta, { kind: 'bili-transcript' }> }) {
  const t = meta.items[0]
  if (!t) return <div style={{ padding: 12, fontSize: 13 }}>没有取到转写结果</div>
  const covered = Math.max(0, Math.round(t.coveredSeconds))
  const total = Math.max(0, Math.round(t.videoSeconds))
  const tip = t.truncated
    ? `⚠ 只转写了前 ${covered} 秒`
      + (total > 0 ? `（视频全长 ${total} 秒）` : '')
      + '，不代表整个视频的内容'
    : `已覆盖整个视频（约 ${covered} 秒）`
  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div style={headStyle}>
        {t.title ? `${t.title}（${t.bvid}）` : t.bvid}
      </div>
      <div style={{
        ...subtle,
        color: t.truncated ? 'var(--text-warning, #b8860b)' : undefined,
        marginBottom: 6,
      }}>
        {tip}
      </div>
      <div style={subtle}>
        识别语言 {t.language || '未知'}
        {t.languageProbability > 0 ? `（置信度 ${Math.round(t.languageProbability * 100)}%）` : ''}
        {t.segments.length > 0 ? ` · ${t.segments.length} 个分段` : ''}
      </div>
      <div style={{
        marginTop: 6,
        maxHeight: 320,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.7,
      }}>
        {t.text || '（没有识别出文字）'}
      </div>
    </div>
  )
}

export function MediaView({ block }: ToolCallViewProps): ReactNode {
  // block 可能缺席（宿主只在对应阶段才带它）——先兜住再判三态，避免
  // `'kind' in undefined` 抛错把整张卡片炸掉。
  if (!block || !('kind' in block)) return <Loading />
  if (block.isError) return <Fallback block={block} />
  const meta = mediaMetaFrom(block.meta)
  if (!meta) return <Fallback block={block} />
  if (meta.kind === 'bili-search') return <SearchView meta={meta} />
  if (meta.kind === 'bili-detail') return <DetailView meta={meta} />
  if (meta.kind === 'bili-replies') return <RepliesView meta={meta} />
  if (meta.kind === 'bili-related') return <RelatedView meta={meta} />
  if (meta.kind === 'bili-user') return <UserView meta={meta} />
  if (meta.kind === 'bili-popular') return <PopularView meta={meta} />
  if (meta.kind === 'bili-transcript') return <TranscriptView meta={meta} />
  return <Fallback block={block} />
}
