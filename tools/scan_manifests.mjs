/** 扫描 profile 里所有第三方插件的 package.json，报告约定的 dsh.* / 未知顶层键。 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const profileDir = process.argv[2]
const root = join(profileDir, 'node_modules')
const manifests = []

const walkScopes = (dir, depth = 0) => {
  if (!existsSync(dir) || depth > 2) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const full = join(dir, e.name)
    if (e.name.startsWith('@')) { walkScopes(full, depth + 1); continue }
    const pj = join(full, 'package.json')
    if (existsSync(pj)) manifests.push([e.name, pj])
  }
}
walkScopes(root)

const KNOWN = new Set(['name', 'version', 'description', 'license', 'type', 'main', 'module', 'exports', 'files',
  'engines', 'scripts', 'peerDependencies', 'peerDependenciesMeta', 'devDependencies', 'dependencies',
  'optionalDependencies', 'keywords', 'author', 'repository', 'homepage', 'bugs', 'publishConfig', 'dsh',
  'packageManager', 'sideEffects', 'types', 'typings', 'bin', 'private', 'os', 'cpu'])

console.log(`# scanning ${manifests.length} packages in ${root}`)
for (const [name, pj] of manifests) {
  let j
  try { j = JSON.parse(readFileSync(pj, 'utf8')) } catch { console.log(`  ${name}: UNREADABLE`); continue }
  const unknown = Object.keys(j).filter((k) => !KNOWN.has(k))
  const dshKeys = j.dsh ? Object.keys(j.dsh) : []
  const flags = []
  if (unknown.length) flags.push(`UNKNOWN KEYS: ${unknown.join(', ')}`)
  if (dshKeys.length) flags.push(`dsh: {${dshKeys.join(', ')}}`)
  if (flags.length) console.log(`  ${name}: ${flags.join(' | ')}`)
}
console.log('# done')
