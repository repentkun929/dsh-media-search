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
import shutil
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
    # 优先级只看「包全不全」，不看顺序：宿主包互相 peer 依赖（dsh-tools 需要
    # @deepseek-ai/dsh-scope），谁缺谁就没法被 node 真正 import，test/ 里那套
    # 契约测试会直接 ERR_MODULE_NOT_FOUND。所以给完整的那份打头。
    # 本机 vendored 副本 .vendor/dsh（0.2.0-rc.2）：dsh-tools 0.2.0-rc.2 的自带依赖
    # （dsh-brand / dsh-util-values / schemastery）都在这棵树里，是唯一自洽的一份。
    os.path.join(ROOT, '..', '.vendor', 'dsh', 'dsh', 'node_modules', '@deepseek-ai'),
    # 从 app.asar 抽出的宿主版本副本（0.2.1-rc.2）：只有 5 个壳包，id/版本与宿主一致，
    # 但没有配套的 dsh-scope 等依赖，只在上面那份缺包时兜底。
    os.path.join(ROOT, '..', '.dsh-local', 'asar-ver', 'dsh', 'node_modules', '@deepseek-ai'),
    # 贴吧工作区里同样的抽取副本（两个插件共用同一台机器 / 同一个宿主）。
    os.path.join(ROOT, '..', 'TieBa', '.dsh-local', 'asar-ver', 'dsh', 'node_modules', '@deepseek-ai'),
    *profile_roots(),
]


def junction(src: str, dst: str) -> bool:
    # 已存在就直接返回 True 会让「与宿主同版本」静默失效：pnpm install 会把 registry
    # 版本（0.2.0-rc.2）以符号链接装到同一路径，脚本报 [ok]，节点里其实还是旧版本。
    # 所以先清掉已有的链接/目录再重建。注意 junction 在 os.path.islink() 上为 False，
    # Windows 下用 rmdir 删除（只删链接本身，不会删到目标目录）。
    if os.path.islink(dst):
        os.unlink(dst)
    elif os.path.exists(dst):
        if os.path.isdir(dst) and os.name == 'nt':
            subprocess.run(['cmd', '/c', 'rmdir', dst], capture_output=True, text=True)
        elif os.path.isdir(dst):
            shutil.rmtree(dst)
        else:
            os.remove(dst)
        if os.path.exists(dst):
            return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.isdir(src):
        return False
    try:
        subprocess.run(['cmd', '/c', 'mklink', '/J', dst, src],
                       check=True, capture_output=True, text=True)
        return True
    except subprocess.CalledProcessError:
        return False


def has_types(src_root: str, name: str) -> bool:
    """该源目录里的这个包是否带可用的类型/入口（排除只抽出 package.json 的空壳）。"""
    pkg = os.path.join(src_root, name)
    if not os.path.isfile(os.path.join(pkg, 'package.json')):
        return False
    return (os.path.isfile(os.path.join(pkg, 'lib', 'types', 'index.d.ts'))
            or os.path.isfile(os.path.join(pkg, 'lib', 'index.js'))
            or os.path.isdir(os.path.join(pkg, 'src')))


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

    # 逐个包装：缺什么就回落到 devDependencies 的 registry 版本（pnpm 装的那份不动），
    # 而不是整批换源。这样「宿主有 UiSlots 才复用宿主」的细化策略也能成立。
    # 「有没有」按**类型入口是否存在**判断，而不是「目录是否存在」：
    # .dsh-local/asar-ver 是从 app.asar 抽的壳，每个包只有一个 package.json，
    # 指向的 lib/ 根本抽不出来；拿它做 junction 会让 tsc 找不到任何宿主类型，
    # 更糟的是这些错误看起来像源码有问题。
    print('[link_deps] sources:', *(srcs or ['(none)']))
    ok, missing = 0, []
    for pkg in PKGS:
        name = pkg.split('/')[-1]
        d = os.path.join(target_nm, name)
        hit = next((s for s in srcs if s and has_types(s, name)), '')
        if hit and junction(os.path.join(hit, name), d):
            print(f'  [ok] {pkg}  <- {hit}')
            ok += 1
        else:
            missing.append(pkg)
            print(f'  [miss] {pkg} (keep devDependencies copy)')

    # schemastery 单独处理（registry 版 lib/types/* 不全，vendored 副本带 src/*.ts）
    vend = next((s for s in srcs if s and has_types(s, 'schemastery')), '')
    if vend and junction(os.path.join(vend, 'schemastery'),
                         os.path.join(target_nm, 'schemastery')):
        print(f'  [ok] {SCHEMASTERY} (vendored, {vend})')
        ok += 1
    else:
        missing.append(SCHEMASTERY)
        print(f'  [miss] {SCHEMASTERY} (keep devDependencies copy)')

    if missing:
        print(f'[link_deps] WARN: {len(missing)} 个包未链接（devDependencies 提供）')
        if args.strict:
            return 1
    print(f'[link_deps] done: {ok}/{len(PKGS) + 1}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
