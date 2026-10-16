/**
 * 产物自检：复刻 scripts/build.ps1 的检查清单，但用 node 跑（避免 PowerShell 转义地狱）。
 * 用法: node tools/check_artifacts.mjs [pluginDir]
 * 退出码 0 = 全部通过。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// 插件目录：显式参数 > 自动探测（脚本上级，或其一级子目录里含 lib/index.mjs 的）
function findPluginDir() {
  if (process.argv[2]) return resolve(process.argv[2])
  const root = join(import.meta.dirname, '..')
  if (existsSync(join(root, 'lib', 'index.mjs'))) return root
  try {
    const { readdirSync } = require('node:fs')
    for (const n of readdirSync(root)) {
      if (n.startsWith('.')) continue
      const c = join(root, n)
      if (existsSync(join(c, 'package.json')) && existsSync(join(c, 'lib', 'index.mjs'))) return c
    }
  } catch { /* ignore */ }
  return root
}
const dir = findPluginDir()
const clientPath = join(dir, 'lib', 'client.js')
const nodePath = join(dir, 'lib', 'index.mjs')

const problems = []
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) problems.push(label)
}

for (const p of [clientPath, nodePath]) {
  if (!existsSync(p)) {
    console.error(`missing artifact: ${p}`)
    process.exit(2)
  }
}
const c = readFileSync(clientPath, 'utf8')
const n = readFileSync(nodePath, 'utf8')

console.log(`# client: ${clientPath} (${c.length} bytes)`)
check('client 有 ModuleLoader 包装', c.includes('window.__ModuleLoader__.load'))

// 注册 id 必须等于 package.json 的 name：宿主 dsh-client-modules 用包名建图
// （reconcilePackage(packageName) → graphRow(packageName, ...)），加载后靠 factories.has(row.id) 确认；
// 不匹配时报 `loaded without registering "<包名>" via __ModuleLoader__.load`，客户端半边永久静默失效。
const pkgName = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name
const regId = c.match(/window\.__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/)?.[1]
check('client 注册 id 等于 package.json name', regId === pkgName, `id=${regId ?? '(未解析出)'} name=${pkgName}`)

// 宿主用 create(loader, row.id) 插入 Loader 条目；cordis 的 plugin() 从 plugin.name 取展示名。
check('client 导出 name（Loader 条目展示名）', /exports\.name\s*=/.test(c))

// 打包器常把 inject 写成 `exports.inject = inject` + `const inject = ["slots"]`，
// 所以先看内联字面量，再回退解析标识符指向的数组。
const inlineInject = c.match(/exports\.inject\s*=\s*(\[[^\]]*\])/)
const injectIdent = c.match(/exports\.inject\s*=\s*([A-Za-z_$][\w$]*)/)?.[1]
const resolvedInject = inlineInject?.[1]
  ?? (injectIdent ? c.match(new RegExp(`(?:const|let|var)\\s+${injectIdent}\\s*=\\s*(\\[[^\\]]*\\])`))?.[1] : undefined)
check('client 导出 inject 含 slots', Boolean(resolvedInject) && /["']slots["']/.test(resolvedInject),
  resolvedInject ?? '(未解析出 inject)')
check('client 无动态 import(', !/(^|[^.\w])import\s*\(/m.test(c))
const nodeBuiltins = ['fs', 'path', 'os', 'http', 'https', 'crypto', 'net', 'tls', 'stream', 'url', 'zlib', 'child_process']
const badRequire = nodeBuiltins.filter((m) => c.includes(`require("${m}")`) || c.includes(`require("node:${m}")`))
check('client 不 require Node 内置', badRequire.length === 0, badRequire.join(','))
check('client 未内联 react', !c.includes('react.createElement'))
// META_LIST_FIELD 断言按插件改：环境变量给 "kind:field,kind:field" 形式
const META_MAP = (process.env.DSH_META_LIST_FIELDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
for (const pair of META_MAP) {
  const [kind, field] = pair.split(':')
  check(`client META_LIST_FIELD 含 ${kind} -> ${field}`, c.includes(`"${kind}"`) && c.includes(`"${field}"`), `${kind}:${field}`)
}
check('client 无非 react 外部 require', [...c.matchAll(/require\("([^"]+)"\)/g)]
  .map((m) => m[1])
  .every((s) => s === 'react' || s === 'react-dom' || s.startsWith('react/') || s.startsWith('@deepseek-ai/')))

console.log(`# node: ${nodePath} (${n.length} bytes)`)
// 端点特征串按插件改；为空数组则跳过这一段
const NEEDLES = (process.env.DSH_ENDPOINT_NEEDLES ?? '').split(',').map((s) => s.trim()).filter(Boolean)
for (const needle of NEEDLES) {
  check(`node 含 ${needle}`, n.includes(needle))
}
// 只匹配真实的 import/require 语句，避免注释里提到 node:crypto 造成误报
const asSpecifier = (source, name) => new RegExp(`(?:from\\s*|require\\(\\s*)["']${name.replace(':', '\\:')}["']`).test(source)
check('node 不依赖 node:crypto（纯 JS md5）', !asSpecifier(n, 'node:crypto'))

// 产物外部依赖必须全是宿主提供的 @deepseek-ai/* 命名空间
const externals = [...new Set([...n.matchAll(/from\s*"([^"]+)"/g)].map((m) => m[1]))]
console.log(`# node externals: ${externals.join(', ') || '(none)'}`)
const badExternals = externals.filter((s) => !s.startsWith('@deepseek-ai/') && !s.startsWith('node:'))
check('node 裸依赖都在 @deepseek-ai/* 命名空间内', badExternals.length === 0, badExternals.join(','))

const requires = [...new Set([...c.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]))]
console.log(`# client requires: ${requires.join(', ') || '(none)'}`)

// 关键：产物必须重新导出 Config。cordis 的 resolveConfig()（lib/index.js:956-962）
// 只在 plugin.Config 存在时才做 validate，否则原样透传 —— 而 cordis.patch.yml
// 的 insert 条目没有 `config:` 字段，透传进来就是 undefined，
// apply(ctx, undefined) 读 config.<任意字段> 会抛进 ctx.effect 里被静默吞掉，
// 症状是「插件装了、没有 skip 警告，但模型工具列表里一个工具都没有」。
const exportLine = n.match(/^export \{([^}]*)\};?\s*$/m)?.[1] ?? ''
const exportNames = exportLine.split(',').map((s) => s.trim()).filter(Boolean)
check('node 重新导出 Config（cordis 默认值注入入口）', exportNames.includes('Config'),
  `exports: ${exportNames.join(', ') || '(未解析出)'}`)
check('node 导出 apply / inject / name 三件套',
  ['apply', 'inject', 'name'].every((k) => exportNames.includes(k)),
  `exports: ${exportNames.join(', ')}`)

console.log('')
if (problems.length) {
  console.error(`ARTIFACT CHECK FAILED: ${problems.length} problem(s)`)
  process.exit(1)
}
console.log('ARTIFACT CHECK PASS')
