// 端到端冒烟模板（通用版）。
//
// 这个文件是贴吧插件的 smoke_e2e 改造来的通用骨架：把「api 层真实网络 +
// profile 产物 apply/execute + schema 一致性 + 业务失败降级」四段结构保留，
// 具体的端点和断言按你的插件改。
//
// 用法: node tools/smoke_e2e.mjs [profileDir] [pkgName]
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { register } from 'node:module'
import { resolve, join, dirname } from 'node:path'

function hasPluginMark(c) {
  if (!existsSync(join(c, 'package.json'))) return false
  return existsSync(join(c, 'node_modules', '@deepseek-ai')) || existsSync(join(c, 'lib', 'index.mjs'))
}
function autoDetectSource() {
  const cands = [join(import.meta.dirname, '..')]
  try {
    const { readdirSync } = require('node:fs')
    for (const n of readdirSync(join(import.meta.dirname, '..'))) {
      if (!n.startsWith('.')) cands.push(join(import.meta.dirname, '..', n))
    }
  } catch { /* ignore */ }
  return cands.find(hasPluginMark) ?? null
}

const PKG_NAME = process.argv[4] ?? process.env.DSH_PLUGIN_NAME ?? 'dsh-media-search'
const SOURCE_DIR = process.env.DSH_PLUGIN_SOURCE ? resolve(process.env.DSH_PLUGIN_SOURCE) : autoDetectSource()
if (!SOURCE_DIR) {
  console.error('FAIL 找不到插件源目录。设 DSH_PLUGIN_SOURCE 或把 tools/ 放进工作区。')
  process.exit(1)
}
process.env.DSH_PLUGIN_SOURCE = SOURCE_DIR
const DS = join(SOURCE_DIR, 'node_modules', '@deepseek-ai')

const profileDir = process.argv[2] ?? process.env.DSH_PROFILE_DIR ?? process.env.DSH_PROFILE_ANCHOR ?? ''
if (!profileDir) {
  console.error('FAIL 未指定 profile 目录。传 argv[2] 或设 DSH_PROFILE_DIR。')
  process.exit(2)
}
const artifact = join(profileDir, 'node_modules', PKG_NAME, 'lib', 'index.mjs')

// profile 副本附近没有 node_modules/@deepseek-ai/*，挂 loader 重定向到源目录副本
if (!existsSync(artifact)) {
  console.error(`FAIL installed artifact not found: ${artifact}`)
  process.exit(1)
}
function resolvesFromArtifact(spec) {
  try {
    const { createRequire } = require('node:module')
    createRequire(pathToFileURL(artifact)).resolve(spec)
    return true
  } catch { return false }
}
const { createRequire } = await import('node:module')
if (!resolvesFromArtifact('@deepseek-ai/dsh-tools')) {
  const hook = join(import.meta.dirname, 'host_loader.mjs')
  if (!existsSync(hook)) {
    console.error(`FAIL loader hook missing: ${hook}`)
    process.exit(1)
  }
  register(pathToFileURL(hook).href, import.meta.url)
}

const mod = await import(pathToFileURL(artifact).href)

const registered = []
const ctx = {
  tools: { register: (t) => { registered.push(t); return () => {} } },
  skills: { registerProvider: () => () => {} },
  systemPrompt: { section: () => () => {} },
  effect: (cb) => { cb(); return () => {} },
}

// config 用默认值（故意不传 bduss/apiKey 之类，验证「无凭据也要能装载」）
mod.apply(ctx, {})
console.log(`tools registered = ${registered.length}: ${registered.map((t) => t.name).join(', ')}`)
assert.ok(registered.length > 0, '未注册任何工具')

const byName = Object.fromEntries(registered.map((t) => [t.name, t]))

// ---- 通用断言：每个工具都要满足的契约 ----
for (const [name, tool] of Object.entries(byName)) {
  assert.ok(typeof tool.execute === 'function', `${name} 缺少 execute`)
  assert.ok(tool.schema && typeof tool.schema === 'object', `${name} 缺少 schema`)
  const out = tool.output
  assert.ok(out && out.schema, `${name} 缺少 output.schema`)
  assert.equal(out.schema.additionalProperties, false,
    `${name} output.schema 必须 additionalProperties:false`)
}

console.log('\n=== 按插件改写以下段落 ===')
// 示例（B 站插件可这样写）：
// const r = await byName.bili_video_search.execute({ keyword: '鸣潮 心月狐', page: 1 })
// assert.ok(typeof r.text === 'string' && r.text.length > 0)
// assert.ok(Array.isArray(r.items) && r.items.length > 0)
// assert.deepEqual(Object.keys(r).sort(), ['items', 'text'], 'execute 只能返回 text+items')
// const schema = byName.bili_video_search.output.schema
// for (const k of Object.keys(r)) assert.ok(k in schema.properties, `unexpected key ${k}`)
// for (const k of Object.keys(schema.properties)) assert.ok(k in r, `missing key ${k}`)
// const meta = byName.bili_video_search.output.presentationMeta({ keyword: 'x' }, r)
// assert.equal(meta.kind, 'bili-search')

// 业务失败必须降级不 throw（示例）
// const empty = await byName.bili_video_search.execute({ keyword: '' })
// assert.equal(empty.items.length, 0, '空关键词必须降级不 throw')

console.log('e2e through installed bundle OK')
