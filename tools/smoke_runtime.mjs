// 运行时冒烟测试：直接加载构建产物 lib/index.mjs，用假 ctx 跑 apply()，
// 验证：ESM 产物能加载、工具注册、系统提示段注册、skill provider 注册。
//
// 用法: node tools/smoke_runtime.mjs [path/to/lib/index.mjs] [expectedName]
//   expectedName  期望的 export const name（默认从产物自己读，不传则不断言）
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { register, createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'

// 自动找插件源目录（含 node_modules/@deepseek-ai 或 lib/index.mjs）
function hasPluginMark(c) {
  if (!existsSync(join(c, 'package.json'))) return false
  return existsSync(join(c, 'node_modules', '@deepseek-ai')) || existsSync(join(c, 'lib', 'index.mjs'))
}
function autoDetectSource(artPath) {
  const cands = []
  if (artPath) {
    // 产物可能在 profile 副本里（旁边没有 node_modules），也可能在源目录 lib/ 里
    cands.push(dirname(artPath))
    cands.push(dirname(dirname(artPath)))
  }
  cands.push(join(import.meta.dirname, '..'))
  try {
    for (const n of readdirSync(join(import.meta.dirname, '..'))) {
      if (n.startsWith('.')) continue
      cands.push(join(import.meta.dirname, '..', n))
    }
  } catch { /* ignore */ }
  const withDeps = cands.find((c) => existsSync(join(c, 'package.json'))
    && existsSync(join(c, 'node_modules', '@deepseek-ai')))
  if (withDeps) return withDeps
  const withArtifact = cands.find((c) => existsSync(join(c, 'package.json'))
    && existsSync(join(c, 'lib', 'index.mjs')))
  return withArtifact ?? null
}

const artArg = process.argv[2]
let SOURCE_DIR = process.env.DSH_PLUGIN_SOURCE ? resolve(process.env.DSH_PLUGIN_SOURCE) : null
if (!SOURCE_DIR) {
  SOURCE_DIR = autoDetectSource(artArg ? resolve(artArg) : null)
  if (!SOURCE_DIR) {
    console.error('FAIL 找不到插件源目录。请传第 1 参为产物路径，或设 DSH_PLUGIN_SOURCE。')
    process.exit(1)
  }
}
process.env.DSH_PLUGIN_SOURCE = SOURCE_DIR

const target = artArg ? resolve(artArg) : join(SOURCE_DIR, 'lib', 'index.mjs')
if (!existsSync(target)) {
  console.error(`FAIL artifact not found: ${target}`)
  process.exit(1)
}

// profile 里的副本附近没有 node_modules/@deepseek-ai/*，需要 loader 重定向。
// 判据：真问一次解析能否成功，不看路径子串。
function resolves(spec) {
  try {
    createRequire(pathToFileURL(target)).resolve(spec)
    return true
  } catch { return false }
}
if (!resolves('@deepseek-ai/dsh-tools')) {
  const hook = join(import.meta.dirname, 'host_loader.mjs')
  if (!existsSync(hook)) {
    console.error(`FAIL loader hook missing: ${hook}`)
    process.exit(1)
  }
  register(pathToFileURL(hook).href, import.meta.url)
}

const url = pathToFileURL(target).href
const mod = await import(url)
console.log('loading:', target)

const EXPECTED_NAME = process.argv[3]
if (EXPECTED_NAME) assert.equal(mod.name, EXPECTED_NAME, `export const name 应为 ${EXPECTED_NAME}，实际 ${mod.name}`)

const registeredTools = []
const sections = []
let skillProviderFactory = null

const ctx = {
  tools: {
    register: (tool) => {
      registeredTools.push(tool)
      return () => {}
    },
  },
  skills: {
    registerProvider: (factory) => {
      skillProviderFactory = factory
      return () => {}
    },
  },
  systemPrompt: {
    section: (s) => {
      sections.push(s)
      return () => {}
    },
  },
  effect: (fn) => {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
}

mod.apply(ctx, {})
assert.ok(registeredTools.length > 0, '未注册任何工具')
console.log(`tools registered = ${registeredTools.length}: ${registeredTools.map((t) => t.name).join(', ')}`)

// schema 形状各插件不同：可能是 tool.schema / tool.inputSchema / tool.output.schema /
// tool.parameters。只要有一处像 schema（带 properties/type/enum/items）就算过。
function looksLikeSchema(v) {
  return !!v && typeof v === 'object'
    && (v.properties || v.type || v.enum || v.items || v['~standard'])
}
for (const t of registeredTools) {
  assert.ok(typeof t.execute === 'function', `工具 ${t.name} 缺少 execute`)
  assert.ok(looksLikeSchema(t.schema) || looksLikeSchema(t.inputSchema)
    || looksLikeSchema(t.output?.schema) || looksLikeSchema(t.parameters),
  `工具 ${t.name} 缺少 schema / inputSchema / output.schema / parameters`)
}

assert.ok(sections.length > 0, '未注册系统提示段')
sections.forEach((s) => console.log(`prompt section: ${s.name} order ${s.order}`))

assert.ok(skillProviderFactory, '未注册 skill provider')
const provider = skillProviderFactory()
console.log(`skill: ${mod.name} -> ${provider.name}`)
if (typeof provider.list === 'function') {
  const list = await provider.list()
  console.log(`skill candidates: ${list.map((c) => c.name).join(', ')}`)
}

console.log('\nruntime smoke test OK')
