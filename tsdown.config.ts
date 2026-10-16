import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

// 浏览器端 __ModuleLoader__ 的注册 id 必须等于 package.json 的 name。
// 宿主 dsh-client-modules 的 reconcilePackage(packageName) 用包名建图（graphRow(packageName, ...)），
// 加载后用 factories.has(row.id) 校验；id 不匹配时报
// `loaded without registering "<包名>" via __ModuleLoader__.load`，客户端半边永久静默失效。
// 所以这里从清单读取，绝不硬编码短名。
const PLUGIN_ID: string = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).name

export default defineConfig([
  {
    name: 'node',
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: true,
    clean: true,
    deps: {
      neverBundle: ['@deepseek-ai/schemastery', '@deepseek-ai/cordis'],
    },
  },
  {
    name: 'client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    clean: false,
    inlineDynamicImports: true,
    // react 由宿主 client 运行时提供，绝不能打进产物（否则每插件一份 react）。
    // @deepseek-ai/dsh-client-* 同理：浏览器端只有类型，运行时全在宿主。
    external: ['react', 'react/jsx-runtime', 'react-dom', /^@deepseek-ai\//],
    outputOptions: {
      entryFileNames: 'client.js',
      inlineDynamicImports: true,
      banner: `window.__ModuleLoader__.load({ id: "${PLUGIN_ID}", factory: (require) => {`,
      footer: `return module.exports; } });`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
