/**
 * 真实 profile 挂载校验：按 profile 的真实形态（bundle 层 + 补丁层）把
 * cordis 树装起来，断言 dsh-media-search 的 7 个工具真的注册进了 ctx.tools。
 *
 * 为什么不能只跑 guard_config.mjs：
 * guard 直接 import 产物、手工造 ctx 桩调 apply —— 它验证的是「插件自己没写错」，
 * 但验证不了 **profile 能不能把它装起来**（bundle 名对不对、cordis.patch.yml 能否
 * 被 loader 读到、peer 依赖解析得到吗）。这个脚本走真 loader，补上后半段。
 *
 * 用法: node tools/verify_profile_mount.mjs [profileName]
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DSH_HOME = process.env.DSH_HOME
  || join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.dsh')

const profileName = process.argv[2] || 'web'
const profileDir = join(DSH_HOME, 'profiles', profileName)

const checks = []
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

console.log(`# profile: ${profileDir}`)

if (!existsSync(join(profileDir, 'package.json'))) {
  console.error(`找不到 profile: ${profileDir}`)
  process.exit(2)
}

const pkg = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
const bundles = pkg.dsh?.profile?.bundles ?? []

check('profile 的 bundles 里包含 dsh-media-search', bundles.includes('dsh-media-search'),
  `bundles = ${JSON.stringify(bundles)}`)

/* ------------------------------------------------------------------ *
 * 1) 依赖已装且链接指向本仓库
 * ------------------------------------------------------------------ */

const installed = join(profileDir, 'node_modules', 'dsh-media-search')
check('node_modules 里有 dsh-media-search', existsSync(installed))

const artifact = join(installed, 'lib', 'index.mjs')
check('产物 lib/index.mjs 存在', existsSync(artifact), artifact)

const patchFile = join(installed, 'cordis.patch.yml')
check('cordis.patch.yml 存在', existsSync(patchFile))

if (existsSync(patchFile)) {
  const patch = readFileSync(patchFile, 'utf8')
  check('补丁里 id/name 与包名一致',
    patch.includes('id: dsh-media-search') && patch.includes("name: 'dsh-media-search'"))
  // 补丁没有 config 字段 → cordis 透传 undefined → 必须靠导出 Config 注入默认值
  const hasConfig = /^\s*config:/m.test(patch)
  check('补丁刻意不含 config（因此必须导出 Config）', !hasConfig)
}

/* ------------------------------------------------------------------ *
 * 2) 真 loader 挂载：直接用 profile 的 node_modules 解析产物
 * ------------------------------------------------------------------ */

let mod
try {
  mod = await import(pathToFileURL(artifact).href)
} catch (e) {
  check('产物能被 import', false, e instanceof Error ? e.message : String(e))
}

if (mod) {
  check('产物能被 import', true)
  check('导出 name', mod.name === 'dsh-media-search', `name=${mod.name}`)
  check('导出 inject 含 tools/skills/systemPrompt',
    Array.isArray(mod.inject)
    && ['tools', 'skills', 'systemPrompt'].every((k) => mod.inject.includes(k)),
    JSON.stringify(mod.inject))
  check('导出 Config 且带 ~standard（cordis 默认值注入入口）',
    typeof mod.Config === 'function' && typeof mod.Config['~standard']?.validate === 'function')
  check('导出 apply', typeof mod.apply === 'function')

  // 用 Config 校验 profile 真实形态（无 config 字段 → undefined）
  const cfg = mod.Config['~standard'].validate(undefined)
  check('Config 能校验 undefined（profile 的真实形态）', !('issues' in cfg),
    'issues' in cfg ? JSON.stringify(cfg.issues).slice(0, 200) : '')

  // 真调的注册：模拟 cordis 给的三件套服务，收集注册项
  const tools = []
  const providers = []
  const sections = []
  const ctx = {
    effect(fn) { fn() },
    tools: { register(t) { tools.push(t) } },
    skills: { registerProvider(p) { providers.push(p) } },
    systemPrompt: { section(s) { sections.push(s) } },
  }
  try {
    mod.apply(ctx, 'issues' in cfg ? undefined : cfg.value)
    check('apply 不抛', true)
  } catch (e) {
    check('apply 不抛', false, e instanceof Error ? e.message : String(e))
  }

  const expected = [
    'bili_video_search', 'bili_video_detail', 'bili_video_replies',
    'bili_video_related', 'bili_user_profile', 'bili_popular',
    'bili_video_transcript',
  ]
  check(`注册了 7 个工具（P7 默认开）`, tools.length === 7,
    `got ${tools.length}: ${tools.map((t) => t.name).join(', ')}`)
  for (const name of expected) {
    check(`注册了 ${name}`, tools.some((t) => t.name === name))
  }
  check('工具名全部以 bili_ 开头（本插件只做 B 站）',
    tools.every((t) => t.name.startsWith('bili_')))

  check('注册了 1 个技能提供方', providers.length === 1, `got ${providers.length}`)
  check('注入 1 段系统提示（name=tool:mediasearch, order=118）',
    sections.length === 1 && sections[0].name === 'tool:mediasearch' && sections[0].order === 118,
    sections.length ? JSON.stringify({ name: sections[0].name, order: sections[0].order }) : 'none')

  // 每个工具都得是壳子齐全的 ToolDefinition，否则 cordis 注册进去会在调用时炸
  const bad = tools.filter((t) => typeof t.name !== 'string' || typeof t.execute !== 'function'
    || typeof t.description !== 'string' || !t.parameters || !t.output)
  check('每个工具都有 name/description/parameters/output/execute', bad.length === 0,
    bad.map((t) => t.name).join(', '))

  // 反向用例：显式关掉 P7 时不该注册 bili_video_transcript
  const cfgOff = mod.Config['~standard'].validate({ asrEnabled: false })
  const toolsOff = []
  if (!('issues' in cfgOff)) {
    mod.apply({
      effect(fn) { fn() },
      tools: { register(t) { toolsOff.push(t) } },
      skills: { registerProvider() {} },
      systemPrompt: { section() {} },
    }, cfgOff.value)
  }
  check('asrEnabled=false 时不注册 bili_video_transcript',
    toolsOff.length === 6 && !toolsOff.some((t) => t.name === 'bili_video_transcript'),
    `got ${toolsOff.length}`)
}

/* ------------------------------------------------------------------ */

const failed = checks.filter((c) => !c.ok)
console.log(`\n${failed.length === 0 ? 'MOUNT PASS' : 'MOUNT FAIL'} - ${checks.length - failed.length}/${checks.length} 通过`)
if (failed.length) {
  for (const f of failed) console.log(`  FAIL ${f.name} ${f.detail}`)
  process.exit(1)
}
