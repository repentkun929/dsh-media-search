#!/usr/bin/env node
// 通用版 guard_config —— 不依赖任何本机路径。
//
// 用法: node tools/guard_config.mjs [path/to/lib/index.mjs] [expectedTool1,expectedTool2,...]
//   第 1 参：要校验的产物。默认：<source>/lib/index.mjs
//   第 2 参：期望注册的工具名（逗号分隔）。不传则只校验「装载不炸 + 至少注册 1 个工具」。
//
// 源目录自动探测（含 @deepseek-ai 依赖的那份 node_modules），优先级：
//   1. 环境变量 DSH_PLUGIN_SOURCE
//   2. 产物所在目录
//   3. 本脚本上级目录（tools/ 在插件里时）
//   4. 本脚本上级的各一级子目录（tools/ 与插件目录并列时，如 <ws>/tools + <ws>/<plugin>）
import { pathToFileURL } from 'node:url'
import { createRequire, register } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'

const EXPECTED = (process.argv[3] ?? process.env.DSH_EXPECTED_TOOLS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

function hasPluginMark(c) {
  if (!existsSync(join(c, 'package.json'))) return false
  return existsSync(join(c, 'node_modules', '@deepseek-ai')) || existsSync(join(c, 'lib', 'index.mjs'))
}function autoDetectSource(artPath) {
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
  // 优先选真正带 node_modules/@deepseek-ai 的（能解析宿主包）；
  // 只有 lib/index.mjs 的作为次选（能解析产物但解析不了 cordis）。
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
    console.error('FAIL 找不到插件源目录（含 node_modules/@deepseek-ai 或 lib/index.mjs）。')
    console.error('     请显式传第 1 参为产物路径，或设环境变量 DSH_PLUGIN_SOURCE。')
    process.exit(1)
  }
}
const art = resolve(artArg ?? join(SOURCE_DIR, 'lib', 'index.mjs'))
if (!existsSync(art)) {
  console.error(`FAIL artifact not found: ${art}`)
  process.exit(1)
}

// profile 里的副本旁边没有 node_modules（宿主启动时才注入 @deepseek-ai/*），
// 所以裸 node import 会 ERR_MODULE_NOT_FOUND。判据：真问一次解析能否成功。
// 不用「路径含包名子串」判断 —— 改名后新旧包名可能互为子串，会误判。
function resolvesFromArtifact(spec) {
  try {
    createRequire(pathToFileURL(art)).resolve(spec)
    return true
  } catch {
    return false
  }
}
const needsLoaderHook = !resolvesFromArtifact('@deepseek-ai/dsh-tools')
if (needsLoaderHook) {
  const candidates = [
    join(import.meta.dirname, 'host_loader.mjs'),
    join(SOURCE_DIR, 'tools', 'host_loader.mjs'),
  ]
  const hook = candidates.find((p) => existsSync(p))
  if (!hook) {
    console.error(`FAIL no loader hook found; tried:\n  ${candidates.join('\n  ')}`)
    process.exit(1)
  }
  process.env.DSH_PLUGIN_SOURCE = SOURCE_DIR
  register(pathToFileURL(hook).href, import.meta.url)
}

let cordis
try {
  cordis = await import(pathToFileURL(createRequire(join(SOURCE_DIR, 'package.json')).resolve('@deepseek-ai/cordis')).href)
} catch (e) {
  console.error(`FAIL cannot resolve @deepseek-ai/cordis from ${SOURCE_DIR}: ${e.message}`)
  process.exit(1)
}
const mod = await import(pathToFileURL(art).href)

const failures = []
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` - ${detail}` : ''}`)
  if (!ok) failures.push(label)
}

// schemastery 的 schema 是可调用对象（Schemastery.Static），typeof 是 'function' 不是 'object'。
// cordis 真正依赖的契约是 `~standard.validate`。
check('产物导出 Config 且带 ~standard（cordis 靠它注入默认值）',
  mod.Config != null && (typeof mod.Config === 'function' || typeof mod.Config === 'object')
  && typeof mod.Config['~standard']?.validate === 'function',
  `typeof=${typeof mod.Config}`)
check('产物导出 apply', typeof mod.apply === 'function')
check('产物导出 inject（含 tools）',
  Array.isArray(mod.inject) && mod.inject.includes('tools'),
  JSON.stringify(mod.inject))

async function boot(configArg) {
  const { Context } = cordis
  const names = []
  const ctx = new Context()
  ctx.provide('tools', { register: (t) => { names.push(t.name); return () => {} } })
  ctx.provide('skills', { registerProvider: () => () => {} })
  ctx.provide('systemPrompt', { section: () => () => {} })
  try {
    ctx.plugin(mod, configArg)
    await new Promise((r) => setTimeout(r, 60))
  } catch (err) {
    return { names, error: err }
  }
  return { names, error: null }
}

const raw = await boot(undefined)
if (EXPECTED.length) {
  check(`config=undefined（profile 的真实形态）时注册 ${EXPECTED.length} 个工具`,
    raw.names.length === EXPECTED.length,
    raw.error ? `threw ${raw.error.message}` : `got ${raw.names.length}`)
  check('注册的工具名与预期一致',
    EXPECTED.every((n) => raw.names.includes(n)), raw.names.join(', '))
} else {
  check('config=undefined 时至少注册 1 个工具', raw.names.length >= 1,
    raw.error ? `threw ${raw.error.message}` : `got ${raw.names.length}`)
}

const empty = await boot({})
check('config={} 时工具全部注册', empty.names.length === raw.names.length, `got ${empty.names.length}`)

console.log(failures.length ? `\nGUARD FAIL (${failures.length}): ${failures.join('; ')}` : '\nGUARD PASS - plugin boots with no config')
process.exit(failures.length ? 1 : 0)
