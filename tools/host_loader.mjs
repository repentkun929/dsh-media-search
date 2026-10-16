// ESM loader hook：把 @deepseek-ai/* 裸 specifier 重定向到可解析的副本。
//
// 为什么需要它：profile 里的插件副本旁边没有 node_modules/@deepseek-ai
// （宿主启动时才注入），所以裸 node 直接 import 那份产物会
// ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/dsh-tools'。
// 测试时用插件源目录 node_modules 里的同版本副本代替。
//
// 通用版：源目录从 DSH_PLUGIN_SOURCE 取，取不到用本脚本的上级目录。
//
// 注意：必须用「export async function resolve」而不是在模块里再调 register() ——
// 后者注册的嵌套 hook 不生效，症状是静默无输出、exit 1（踩过）。
import { pathToFileURL, fileURLToPath } from 'node:url'
import { readdirSync, existsSync, statSync } from 'node:fs'
import { join, resolve as resolvePath, dirname } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = resolvePath(process.env.DSH_PLUGIN_SOURCE ?? join(HERE, '..'))

if (!existsSync(join(SOURCE_DIR, 'node_modules'))) {
  console.error(`[host_loader] WARN no node_modules under ${SOURCE_DIR}; set DSH_PLUGIN_SOURCE`)
}

function pickEntry(dir) {
  for (const c of [`${dir}/lib/index.mjs`, `${dir}/lib/index.js`, `${dir}/lib/index.cjs`]) {
    try { if (statSync(c).isFile()) return c } catch { /* ignore */ }
  }
  return null
}

const ENTRY = new Map()

// 1) 顶层 node_modules/@deepseek-ai/*
{
  const nm = join(SOURCE_DIR, 'node_modules', '@deepseek-ai')
  try {
    for (const name of readdirSync(nm)) {
      const e = pickEntry(join(nm, name))
      if (e) ENTRY.set(`@deepseek-ai/${name}`, pathToFileURL(e).href)
    }
  } catch { /* ignore */ }
}

// 2) pnpm store 里每个包的私有 node_modules/@deepseek-ai/*（symlink 农场）
{
  const store = join(SOURCE_DIR, 'node_modules', '.pnpm')
  try {
    for (const d of readdirSync(store)) {
      const nm = join(store, d, 'node_modules', '@deepseek-ai')
      try {
        for (const name of readdirSync(nm)) {
          const key = `@deepseek-ai/${name}`
          if (ENTRY.has(key)) continue
          const e = pickEntry(join(nm, name))
          if (e) ENTRY.set(key, pathToFileURL(e).href)
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@deepseek-ai/')) {
    const name = specifier.split('/').slice(0, 2).join('/')
    const url = ENTRY.get(name)
    if (url) return { url, shortCircuit: true }
  }
  if (/^[a-zA-Z]:[\\/]/.test(specifier)) {
    return { url: pathToFileURL(specifier).href, shortCircuit: true }
  }
  return next(specifier, context)
}
