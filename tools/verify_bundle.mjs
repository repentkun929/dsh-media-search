#!/usr/bin/env node
// Offline verification that a profile will load the bundle at boot.
// 通用版：包名从 argv[4] 取，源目录从 argv[5] 或环境变量取，不硬编码任何本机路径。
//
// Replicates the host's real logic paths without importing cordis:
//   resolveBundleDir -> packageDirFromAnchor (createRequire().resolve.paths)
//   readProfileManifest -> dsh.profile.bundles
//   evaluatePluginCompatibility -> semver.satisfies(runtime, peer, prerelease)
//   bundlePatchPaths -> dsh.bundle.patch files exist
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const profileDir = process.argv[2]
if (!profileDir) {
  console.error('usage: node tools/verify_bundle.mjs <profileDir> [runtimeVersion] [packageName] [sourceDir]')
  process.exit(2)
}
const RUNTIME = process.argv[3] ?? '0.2.0-rc.2'
const TARGET = process.argv[4] ?? process.env.DSH_PLUGIN_NAME ?? 'dsh-media-search'
// 源目录：用于在 profile 里找不到 semver 时回退解析。默认取本脚本的上两级。
const SOURCE_DIR = resolve(process.argv[5] ?? process.env.DSH_PLUGIN_SOURCE ?? join(import.meta.dirname, '..'))

const profileRequire = createRequire(join(profileDir, 'package.json'))
// semver 只在做 peer 兼容性判定时需要；精简 profile（如 web，只有 3 个 bundle）
// 里可能根本没装。三级回退：profile 锚点 → 插件源目录 → undefined。
let semver
try {
  semver = profileRequire('semver')
} catch {
  try {
    semver = createRequire(join(SOURCE_DIR, 'package.json'))('semver')
  } catch {
    semver = undefined
  }
}

const log = (...a) => console.log(...a)

log(`profile: ${profileDir}`)
log(`runtime: dsh ${RUNTIME}`)
log(`target : ${TARGET}`)
log('')

const manifestPath = join(profileDir, 'package.json')
if (!existsSync(manifestPath)) {
  console.error(`FAIL profile package.json not found: ${manifestPath}`)
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

// ---------- [1] bundles ----------
// 宿主把 bundles 放在嵌套的 dsh.profile.bundles 里（顶层扁平键只是历史写法），
// 两种都认，嵌套优先。
const bundles = manifest.dsh?.profile?.bundles ?? manifest['dsh.profile.bundles'] ?? []
log('[1] bundle selection (dsh.profile.bundles)')
if (bundles.includes(TARGET)) {
  log(`  OK ${TARGET} selected (${bundles.length} bundles total)`)
} else {
  log(`  FAIL ${TARGET} NOT in dsh.profile.bundles -> cordis will never load it`)
  log(`       bundles: ${JSON.stringify(bundles)}`)
}
log('')

// ---------- [2] dependency ----------
const deps = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }
log('[2] dependency (manifest.dependencies)')
const dep = deps[TARGET]
if (dep) {
  log(`  OK ${TARGET} = ${dep}`)
} else {
  log(`  FAIL ${TARGET} missing from dependencies`)
}
log('')

// ---------- [3] resolveBundleDir ----------
log('[3] resolveBundleDir(profile anchor)')
let pkgDir = null
try {
  const entry = profileRequire.resolve(`${TARGET}/package.json`)
  pkgDir = dirname(entry)
  log(`  OK resolved -> ${pkgDir}`)
} catch (e) {
  log(`  FAIL cannot resolve ${TARGET} from ${profileDir} (host would throw "cannot resolve profile bundle")`)
  log(`       ${e.message}`)
}
log('')

// ---------- [4] patch file ----------
log('[4] cordis.patch.yml (bundlePatchPaths)')
if (pkgDir) {
  const patch = join(pkgDir, 'cordis.patch.yml')
  if (existsSync(patch)) {
    const size = readFileSync(patch).length
    log(`  OK patch file exists -> ${patch} (${size} bytes)`)
  } else {
    log(`  FAIL patch file missing -> ${patch}`)
  }
} else {
  log('  SKIP (bundle not resolved)')
}
log('')

// ---------- [5] peer compatibility ----------
log('[5] peer compatibility (evaluatePluginCompatibility)')
if (pkgDir) {
  const pkgJsonPath = join(pkgDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  const peers = pkg.peerDependencies ?? {}
  const dshPeers = Object.keys(peers).filter((k) => k.startsWith('@deepseek-ai/dsh-'))
  if (!semver) {
    log('  SKIP semver unavailable in this environment (host has its own)')
    dshPeers.forEach((k) => log(`     declared: ${k}@${peers[k]}`))
  } else if (!dshPeers.length) {
    log('  (no @deepseek-ai/dsh-* peer declared -> compatibility gate is skipped)')
  } else {
    dshPeers.forEach((k) => {
      const ok = semver.satisfies(RUNTIME, peers[k], { includePrerelease: true })
      log(`  ${ok ? 'OK  ' : 'FAIL'} ${k} peer "${peers[k]}" vs runtime ${RUNTIME} -> ${ok ? 'satisfies' : 'NOT satisfies'}`)
    })
  }
  const engines = pkg.engines ?? {}
  if (engines.node) {
    const nodeOk = semver ? semver.satisfies(process.versions.node, engines.node, { includePrerelease: true }) : 'unknown'
    log(`  node engine "${engines.node}" vs ${process.versions.node} -> ${nodeOk}`)
  }
} else {
  log('  SKIP (bundle not resolved)')
}
log('')

// ---------- [6] main / exports ----------
log('[6] entry points (main / exports)')
if (pkgDir) {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const main = pkg.main ?? 'index.js'
  const mainPath = join(pkgDir, main)
  log(`  ${existsSync(mainPath) ? 'OK  ' : 'FAIL'} main -> ${main} (${existsSync(mainPath) ? readFileSync(mainPath).length + ' bytes' : 'MISSING'})`)
  const exp = pkg.exports ?? {}
  Object.entries(exp).forEach(([k, v]) => {
    const rel = typeof v === 'string' ? v : v.default ?? v.import ?? v.require
    if (!rel) return
    const p = join(pkgDir, rel)
    log(`  ${existsSync(p) ? 'OK  ' : 'FAIL'} exports["${k}"] -> ${rel} (${existsSync(p) ? readFileSync(p).length + ' bytes' : 'MISSING'})`)
  })
} else {
  log('  SKIP (bundle not resolved)')
}
log('')

// ---------- [7] bare imports resolvable by the host ----------
log('[7] bare imports (must be @deepseek-ai/* or peer)')
if (pkgDir) {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const entry = join(pkgDir, pkg.main ?? 'index.js')
  const code = readFileSync(entry, 'utf8')
  const bare = [...new Set([...code.matchAll(/(?:from|require\()\s*['"]([^'".][^'"]*)['"]/g)].map((m) => m[1]))]
    .filter((s) => !s.startsWith('.') && !s.startsWith('node:') && !s.startsWith('/'))
  const allowed = new Set([...Object.keys(pkg.peerDependencies ?? {}), ...Object.keys(pkg.dependencies ?? {})])
  bare.forEach((s) => {
    const root = s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]
    const ok = allowed.has(root) || root.startsWith('@deepseek-ai/')
    log(`  ${ok ? 'OK  ' : 'FAIL'} import "${s}" -> root ${root} ${allowed.has(root) ? 'is declared' : 'assumed host-provided'}${ok ? '' : ' NOT DECLARED'}`)
  })
} else {
  log('  SKIP (bundle not resolved)')
}
log('')

// ---------- [8] client bundle ----------
log('[8] client bundle (window.__ModuleLoader__)')
if (pkgDir) {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const dshCfg = pkg.dsh ?? {}
  const clientCfg = dshCfg.client ?? {}
  const clientInject = clientCfg.inject ?? []
  const clientPlatform = clientCfg.platform ?? 'web'
  log(`  dsh.client = ${JSON.stringify({ inject: clientInject, platform: clientPlatform })}`)
  const exportsMap = pkg.exports ?? {}
  const clientPath = exportsMap['./client']
  if (clientPath) {
    const rel = typeof clientPath === 'string' ? clientPath : clientPath.default
    const p = join(pkgDir, rel)
    if (existsSync(p)) {
      const code = readFileSync(p, 'utf8')
      const hasLoad = code.includes('__ModuleLoader__.load')
      const idOk = new RegExp(`__ModuleLoader__\\.load\\(\\{\\s*id:\\s*['"]${TARGET}['"]`).test(code)
      log(`  ${hasLoad ? 'OK  ' : 'FAIL'} ModuleLoader wrapper present`)
      log(`  ${idOk ? 'OK  ' : 'FAIL'} load({id}) === package name "${TARGET}"`)
      const reactRe = /require\(['"]react/g
      const rq = code.match(reactRe)
      log(`  react requires: ${rq ? rq.length : 0} (${[...new Set(rq ?? [])].join(', ')})`)
      const dynImport = /(?<![.\w])import\s*\(/.test(code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))
      log(`  ${dynImport ? 'FAIL' : 'OK  '} no dynamic import() in client bundle`)
    } else {
      log(`  FAIL client export target missing -> ${p}`)
    }
  } else {
    log('  SKIP no ./client export')
  }
} else {
  log('  SKIP (bundle not resolved)')
}
log('')

// ---------- verdict ----------
const allOk = bundles.includes(TARGET) && !!dep && !!pkgDir
log(allOk
  ? 'VERDICT: PASS - the profile will load this bundle at next boot'
  : 'VERDICT: FAIL - fix the manifest or install the bundle first')
process.exit(allOk ? 0 : 1)
