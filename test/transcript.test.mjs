/**
 * P7 音频转写：sidx 解析 + 切片边界 + 转写结果契约。
 *
 * 测试原则：
 * - sidx 的**测试数据是从真实 B 站音频流里截出来的前 8KB**（tools/find_sidx.mjs 定位过），
 *   不是手搓的假盒子 —— 手搓的盒子会迁就实现里的错误假设（这正是 findSidx 对齐 bug 的来源）。
 * - 纯函数测试离线跑，不碰网络；ASR 子进程只测「环境探测」和「失败路径」，
 *   真转写放 tools/probe_transcript.mjs（需要网络 + 模型，不适合进 CI）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findSidx, parseSidx, fragmentsForSeconds, sidxSeconds } from '../src/asr.ts'
import { mediaMetaFrom } from '../src/fragment.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const fixtureBytes = (name) => new Uint8Array(readFileSync(join(HERE, 'fixtures', name)))

/* ------------------------------------------------------------------ *
 * 真实头部夹具
 * ------------------------------------------------------------------ */

const head = fixtureBytes('audio-head-8k.bin')

// 真实结构（tools/find_sidx.mjs 实测）：
//   0 ftyp(32) -> 32 moov(805) -> 837 sidx(3124) -> 3961 moof(1040) -> ...
// 注意 sidx 起点 837 是**奇数**，这是 findSidx 不能按 4 字节对齐的直接证据。
const REAL_SIDX_START = 837

test('findSidx 能在真实头部里定位到 sidx（起点是奇数偏移，4 字节对齐会漏）', () => {
  const at = findSidx(head)
  assert.equal(at, REAL_SIDX_START, '应定位到 837')
  // 回归断言：842 这种 4 的倍数一定不是答案（早期实现只扫这些位置）
  assert.notEqual(at % 4, 0, '真实起点是奇数偏移 —— 这正是按 4 字节对齐会失败的证据')
})

test('findSidx 找不到时返回 -1，而不是抛或返回垃圾值', () => {
  const junk = new Uint8Array(64) // 全 0
  assert.equal(findSidx(junk), -1)
})

test('parseSidx 解析真实 sidx（version=1，片段数/时长/自校验都对得上）', () => {
  const buf = head.subarray(REAL_SIDX_START)
  const info = parseSidx(buf)

  assert.equal(info.timescale, 48000)
  assert.ok(info.fragments.length > 0, '应解析出片段')
  assert.equal(info.size, 3124, 'box size 应与顶层扫描一致')

  // 自校验：各 fragment 字节数之和 + init 段 = 文件总长（用 Content-Range 给的总长核对）
  // 这里只断言「解析没有在中间截断」：读指针自校验已在 parseSidx 内部做，
  // 能走到这说明 size 与项长一致。
  assert.ok(info.fragments.every((f) => f.size > 0), '每个片段都应有非零字节数')
  assert.ok(info.fragments.every((f) => f.duration > 0), '每个片段都应有非零时长')

  // 流总时长应与接口给的 duration=1284s 接近（索引求和为 1283.6s）
  const total = sidxSeconds(info)
  assert.ok(Math.abs(total - 1284) < 5, `索引总时长 ${total} 应接近接口的 1284s`)
})

test('parseSidx 的偏移是累加的（offset 单调递增，首项为 0）', () => {
  const info = parseSidx(head.subarray(REAL_SIDX_START))
  assert.equal(info.fragments[0].offset, 0)
  for (let i = 1; i < info.fragments.length; i++) {
    assert.equal(
      info.fragments[i].offset,
      info.fragments[i - 1].offset + info.fragments[i - 1].size,
      `第 ${i} 项 offset 应等于前一项 offset + size`,
    )
  }
})

test('parseSidx 对错误输入给出可读错误，而不是静默算出脏数据', () => {
  // 整段头部传进来（buf[4..7] 落在 ftyp 里）—— 这是早期实现真踩过的坑
  assert.throws(() => parseSidx(head), /魔数不匹配/)
  // 太短
  assert.throws(() => parseSidx(new Uint8Array(8)), /太短/)
})

/* ------------------------------------------------------------------ *
 * 切片边界
 * ------------------------------------------------------------------ */

test('fragmentsForSeconds 对齐到片段边界：60s 取 12 个片段（每段 5.01s）', () => {
  const info = parseSidx(head.subarray(REAL_SIDX_START))
  const n = fragmentsForSeconds(info, 60)
  assert.equal(n, 12, '60s / 5.01s 向上取整 = 12 个片段')

  // 覆盖时长必须 >= 请求时长（宁可多取一点，也不能少）
  const covered = info.fragments.slice(0, n).reduce((a, f) => a + f.duration, 0) / info.timescale
  assert.ok(covered >= 60, `覆盖 ${covered}s 必须 >= 请求的 60s`)
  assert.ok(covered < 65, `覆盖 ${covered}s 不应超出太多（切片精度是片段粒度）`)
})

test('fragmentsForSeconds 请求超过流总长时返回全部片段', () => {
  const info = parseSidx(head.subarray(REAL_SIDX_START))
  assert.equal(fragmentsForSeconds(info, 999999), info.fragments.length)
})

test('fragmentsForSeconds 请求 0 秒仍然至少取 1 个片段（不能返回空）', () => {
  const info = parseSidx(head.subarray(REAL_SIDX_START))
  assert.equal(fragmentsForSeconds(info, 0), 1)
})

/* ------------------------------------------------------------------ *
 * 契约：transcript 的 meta 必须能被 Toolview 认出来
 * ------------------------------------------------------------------ */

test('mediaMetaFrom 接受 bili-transcript（否则卡片会静默退化成纯文本）', () => {
  const meta = {
    kind: 'bili-transcript',
    bvid: 'BV1sHa966Eu6',
    title: '测试视频',
    coveredSeconds: 60.16,
    videoSeconds: 1284,
    language: 'zh',
    truncated: true,
    items: [{ bvid: 'BV1sHa966Eu6', coveredSeconds: 60.16, segments: [], text: '…' }],
  }
  const parsed = mediaMetaFrom(meta)
  assert.ok(parsed, 'bili-transcript 必须通过校验')
  assert.equal(parsed.kind, 'bili-transcript')
})

test('mediaMetaFrom 拒绝缺 items 的 transcript meta（触发兜底而不是渲染崩掉）', () => {
  assert.equal(mediaMetaFrom({ kind: 'bili-transcript', bvid: 'BV1' }), undefined)
})
