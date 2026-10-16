// 对比本地 HEAD 树与远端 main 树，找出所有差异。
// 用法: node tools/diff_remote.mjs [repoDir] [owner/repo]
//   repoDir   本地 git 仓库目录，默认当前工作目录
//   owner/repo  GitHub 仓库，默认从 repoDir 的 origin remote 自动解析
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const repoDir = resolve(process.argv[2] ?? '.')
const repoArg = process.argv[3]

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '')
  }
}

// 仓库名：显式参数优先，否则从 origin remote 解析
let REPO = repoArg
if (!REPO) {
  const remote = run('git', ['remote', 'get-url', 'origin'], repoDir).trim()
  const m = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/)
  REPO = m ? `repos/${m[1]}` : null
  if (!REPO) {
    console.error(`FAIL 无法从 origin remote 解析仓库名: ${remote}`)
    console.error('     用法: node tools/diff_remote.mjs <repoDir> <owner/repo>')
    process.exit(2)
  }
}

// 1. 本地树
const localRaw = run('git', ['ls-tree', '-r', 'HEAD'], repoDir)
const local = new Map()
for (const line of localRaw.trim().split('\n')) {
  const m = line.match(/^\d+ blob (\w+)\s+(.+)$/)
  if (m) local.set(m[2], m[1])
}

// 2. 远端树
const remoteRaw = run('gh', ['api', `${REPO}/git/trees/main?recursive=1`,
  '--jq', '.tree[] | select(.type=="blob") | (.sha + " " + .path)'], repoDir)
const remote = new Map()
for (const line of remoteRaw.trim().split('\n')) {
  const i = line.indexOf(' ')
  if (i > 0) remote.set(line.slice(i + 1), line.slice(0, i))
}

console.log(`repo : ${REPO}`)
console.log(`local files: ${local.size}`)
console.log(`remote files: ${remote.size}`)

const onlyLocal = [...local.keys()].filter((f) => !remote.has(f))
const onlyRemote = [...remote.keys()].filter((f) => !local.has(f))
const differ = [...local.keys()].filter((f) => remote.has(f) && remote.get(f) !== local.get(f))
const same = [...local.keys()].filter((f) => remote.has(f) && remote.get(f) === local.get(f))

console.log(`\n=== SAME (${same.length}) ===`)
console.log(same.sort().join('\n') || '(none)')
console.log(`\n=== ONLY LOCAL (${onlyLocal.length}) ===`)
console.log(onlyLocal.sort().join('\n') || '(none)')
console.log(`\n=== ONLY REMOTE (${onlyRemote.length}) ===`)
console.log(onlyRemote.sort().join('\n') || '(none)')
console.log(`\n=== CONTENT DIFFERS (${differ.length}) ===`)
console.log(differ.sort().join('\n') || '(none)')

// 3. 远端最新提交（用 node 自己解析 JSON，避免 jq 转义地狱）
const commitsJson = run('gh', ['api', `${REPO}/commits?per_page=5`], repoDir)
try {
  const commits = JSON.parse(commitsJson)
  console.log('\n=== REMOTE COMMITS ===')
  for (const c of commits) {
    console.log(`${c.sha.slice(0, 7)} ${c.commit.committer.date} ${c.commit.message.split('\n')[0]}`)
  }
} catch (e) {
  console.log('\n=== REMOTE COMMITS (raw) ===\n' + commitsJson.slice(0, 400))
}

// 4. Release / tags
console.log('\n=== REMOTE TAGS ===')
console.log(run('git', ['ls-remote', '--tags', 'origin'], repoDir).trim() || '(none)')
