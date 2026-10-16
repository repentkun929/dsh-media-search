#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把宿主 @deepseek-ai/* 依赖 junction 进插件 node_modules。

必须在 `npm install` / `pnpm install` 之后运行（安装会清掉 junction）。

用途：开发期让本地类型检查/构建拿到**与宿主同版本**的 @deepseek-ai/* 包。
安装到 profile 后这些包由宿主运行时提供，所以本步骤对使用者完全透明、可跳过。

源目录按优先级：
  1) --src 显式指定
  2) $DSH_HOST_NODE_MODULES 环境变量
  3) 本机 vendored 副本（.vendor/dsh/...，见 README 的抽取说明）
  4) $DSH_HOME 下各 profile 的 node_modules（默认 <DSH_HOME>/profiles/<profile>/node_modules/@deepseek-ai）

注意：app.asar.unpacked 里没有 cordis/dsh-tools/dsh-skill（它们打进 asar），
desktop profile 的 node_modules/@deepseek-ai 实际为空 —— 所以真实可用源是
npm registry（devDependencies 已装）或 vendored 副本。本脚本的价值是「运行期
与宿主同版本」校验：若源目录缺失则跳过，不阻断构建。

用 Windows junction（mklink /J），不需要管理员权限。
"""
import argparse
import os
import subprocess
import sys

PKGS = [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-tools',
    '@deepseek-ai/dsh-skill',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-tool',
    '@deepseek-ai/dsh-client-runtime',
]
# schemastery 单独处理：registry 版的 lib/ 只有 .cjs/.mjs（types 指向不存在的
# lib/types/index.d.ts），必须用 vendored 副本（从 app.asar 抽出，含 src/*.ts）。
SCHEMASTERY = '@deepseek-ai/schemastery'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def profile_roots() -> list:
    """按 $DSH_HOME 推导各 profile 的 @deepseek-ai 目录（不再硬编码本机路径）。"""
    home = os.environ.get('DSH_HOME', '')
    if not home:
        return []
    profiles = os.path.join(home, 'profiles')
    if not os.path.isdir(profiles):
        return []
    out = []
    for name in sorted(os.listdir(profiles)):
        cand = os.path.join(profiles, name, 'node_modules', '@deepseek-ai')
        if os.path.isdir(cand):
            out.append(cand)
    return out


CANDIDATES = [
    # 本机 vendored 副本（从 app.asar 抽取，版本 = 宿主真实版本）
    os.path.join(ROOT, '..', '.vendor', 'dsh', 'dsh', 'node_modules', '@deepseek-ai'),
    *profile_roots(),
]


def junction(src: str, dst: str) -> bool:
    if os.path.exists(dst):
        return True
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.isdir(src):
        return False
    try:
        subprocess.run(['cmd', '/c', 'mklink', '/J', dst, src],
                       check=True, capture_output=True, text=True)
        return True
    except subprocess.CalledProcessError:
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='', help='源 @deepseek-ai 目录')
    ap.add_argument('--strict', action='store_true', help='有任何包缺失就失败')
    args = ap.parse_args()

    target_nm = os.path.join(ROOT, 'node_modules', '@deepseek-ai')

    srcs = []
    if args.src:
        srcs.append(args.src)
    if os.environ.get('DSH_HOST_NODE_MODULES'):
        srcs.append(os.environ['DSH_HOST_NODE_MODULES'])
    srcs += CANDIDATES

    npx_roots = [
        os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'npm-cache', '_npx'),
    ]
    for npx_root in npx_roots:
        if os.path.isdir(npx_root):
            for base, _dirs, _files in os.walk(npx_root):
                cand = os.path.join(base, 'node_modules', '@deepseek-ai')
                if os.path.isdir(cand):
                    srcs.append(cand)
                if len(srcs) > 24:
                    break

    src = next((s for s in srcs if os.path.isdir(s)), '')
    if not src:
        print('[link_deps] WARN: 找不到宿主 @deepseek-ai 目录，跳过 junction（'
              'devDependencies 已装 registry 版本，构建不受影响）')
        return 1 if args.strict else 0

    print(f'[link_deps] source: {src}')
    ok, missing = 0, []
    for pkg in PKGS:
        s = os.path.join(src, pkg.split('/')[-1])
        d = os.path.join(target_nm, pkg.split('/')[-1])
        if junction(s, d):
            print(f'  [ok] {pkg}')
            ok += 1
        else:
            missing.append(pkg)
            print(f'  [miss] {pkg}')

    # schemastery：必须用 vendored 副本（registry 版缺 lib/types/*.d.ts）
    # 注意 DSH_HOST_NODE_MODULES 可能未设置（os.environ.get 返回 None），
    # 下面先过滤掉 None 再 os.path.join，否则 TypeError。
    env_src = os.environ.get('DSH_HOST_NODE_MODULES')
    vend_srcs = [args.src]
    if env_src:
        vend_srcs.append(env_src)
    vend_srcs += CANDIDATES
    vend = next((s for s in vend_srcs
                 if s and os.path.isdir(os.path.join(s, 'schemastery'))), '')
    if vend and junction(os.path.join(vend, 'schemastery'),
                         os.path.join(target_nm, 'schemastery')):
        print(f'  [ok] {SCHEMASTERY} (vendored, {vend})')
        ok += 1
    else:
        missing.append(SCHEMASTERY)
        print(f'  [miss] {SCHEMASTERY}')

    if missing:
        print(f'[link_deps] WARN: {len(missing)} 个包未链接（devDependencies 提供）')
        if args.strict:
            return 1
    print(f'[link_deps] done: {ok}/{len(PKGS) + 1}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
