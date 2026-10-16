// 全量回归：跑通用化后的 tools/ 脚本，验证它们对「另一个工作区的插件」仍然有效。
// 用法: node tools/regress.mjs <pluginSourceDir> [profileDir] [packageName]
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(process.argv[2])
const PROFILE = resolve(process.argv[3] ?? process.env.DSH_PROFILE_DIR ?? '')
const PKG = process.argv[4] ?? process.env.DSH_PLUGIN_NAME ?? 'dsh-media-search'
const TOOLS = join(import.meta.dirname)

if (!existsSync(join(SRC, 'package.json'))) {
  console.error(`FAIL plugin source not found: ${SRC}`)
  process.exit(2)
}
if (!PROFILE || !existsSync(join(PROFILE, 'package.json'))) {
  console.error(`FAIL profile not found: ${PROFILE} (argv[3] or DSH_PROFILE_DIR)`)
  process.exit(2)
}

const env = { ...process.env, DSH_PLUGIN_SOURCE: SRC, DSH_PLUGIN_NAME: PKG }

const cases = [
  ['check_artifacts', ['tools/check_artifacts.mjs', SRC]],
  ['guard_config(source)', ['tools/guard_config.mjs', join(SRC, 'lib', 'index.mjs'), '']],
  ['guard_config(installed)', ['tools/guard_config.mjs', join(PROFILE, 'node_modules', PKG, 'lib', 'index.mjs'), '']],
  ['smoke_runtime', ['tools/smoke_runtime.mjs', join(SRC, 'lib', 'index.mjs'), PKG]],
  ['verify_bundle', ['tools/verify_bundle.mjs', PROFILE, '0.2.0-rc.2', PKG, SRC]],
  ['profile_bundles', ['tools/profile_bundles.mjs', PROFILE, PKG]],
  ['check_publish_safe', ['tools/check_publish_safe.py', SRC]],
  ['diff_remote', ['tools/diff_remote.mjs', SRC]],
]

let fails = 0
for (const [name, [file, ...args]] of cases) {
  const isPy = file.endsWith('.py')
  const cmd = isPy ? 'python' : process.execPath
  const argv = isPy ? [file, ...args] : [file, ...args]
  // 过滤空参数
  const clean = argv.filter((a) => a !== '')
  let code = 0
  let out = ''
  try {
    out = execFileSync(cmd, clean, { cwd: process.cwd(), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    code = e.status ?? 1
    out = String(e.stdout || '') + String(e.stderr || '')
  }
  const verdict = out.split('\n').filter((l) => /PASS|FAIL|VERDICT|\[ok\]|\[!\]/.test(l)).pop()?.trim() ?? ''
  console.log(`${code === 0 ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} exit=${code}  ${verdict}`)
  if (code !== 0) {
    fails++
    console.log(out.split('\n').slice(0, 8).map((l) => '      ' + l).join('\n'))
  }
}
console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILED'} (${cases.length} cases)`)
process.exit(fails === 0 ? 0 : 1)
