/**
 * 列出 profile 的 bundles、hmr 情况、以及目标插件的依赖声明。
 * 用法: node tools/profile_bundles.mjs <profileDir> [packageName]
 *   packageName 默认 dsh-media-search，可用 DSH_PLUGIN_NAME 覆盖
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const profileDir = process.argv[2]
if (!profileDir) {
  console.error('usage: node tools/profile_bundles.mjs <profileDir> [packageName]')
  process.exit(2)
}
const TARGET = process.argv[3] ?? process.env.DSH_PLUGIN_NAME ?? 'dsh-media-search'

const manifestPath = join(profileDir, 'package.json')
if (!existsSync(manifestPath)) {
  console.error(`FAIL profile package.json not found: ${manifestPath}`)
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
// 宿主用嵌套的 dsh.profile.bundles；顶层扁平键只是历史写法，两种都认。
const bundles = manifest.dsh?.profile?.bundles ?? manifest['dsh.profile.bundles'] ?? []
console.log(`# ${profileDir}`)
bundles.forEach((b, i) => console.log(`  ${i + 1}. ${b}`))
console.log(`  count = ${bundles.length}`)
const hmr = bundles.filter((b) => /hmr/i.test(b))
console.log(`  hmr bundles: ${hmr.join(', ') || '(none) -> new bundles need a restart'}`)
const deps = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }
console.log(`  ${TARGET} in bundles: ${bundles.includes(TARGET)}`)
console.log(`  dependencies (${TARGET}): ${deps[TARGET] ?? '(absent)'}`)
