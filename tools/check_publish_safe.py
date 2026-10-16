#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""发布前安全检查：确认要推送到 GitHub 的内容里没有真实凭据与本机私有路径。

用法：
    python tools/check_publish_safe.py <目标目录> [--all]

默认扫描目标目录内所有文本文件（跳过 node_modules / .git / .vendor）。
--all 时额外把工作区根目录的 .dsh-local 也列出来（提醒不要发布）。

退出码：0 = 干净，1 = 发现需要处理的问题。
"""
from __future__ import annotations

import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 凭据文件位置可用环境变量覆盖；新工作区没有 BDUSS 时自动跳过真实值比对。
BDUSS_FILE = os.environ.get('DSH_CREDENTIAL_FILE', '')

TEXT_EXT = {
    '.md', '.mjs', '.cjs', '.js', '.ts', '.tsx', '.py', '.ps1',
    '.json', '.yml', '.yaml', '.txt', '.mts', '.css', '.html',
}
SKIP_DIRS = {'node_modules', '.git', '.vendor', '.pnpm', 'dist', '__pycache__'}

# 真实凭据：从 .dsh-local 读取（不落盘、不打印）
CREDENTIAL_PATTERNS = [
    ('BDUSS 值（真实）', None),                                  # 占位，运行时填充
    ('BDUSS= 后接长串', re.compile(r'BDUSS\s*[=:]\s*["\']?[A-Za-z0-9_\-]{40,}')),
    ('STOKEN= 后接长串', re.compile(r'STOKEN\s*[=:]\s*["\']?[a-f0-9]{40,}')),
    ('Cookie 请求头里的真实值', re.compile(r'Cookie["\']?\s*:\s*["\']BDUSS=[A-Za-z0-9_\-]{40,}')),
]

# 本机私有绝对路径（正则只做「形态」匹配，不含任何具体盘符下的目录名）
PRIVATE_PATH_PATTERNS = [
    ('本机 F: 路径', re.compile(r'F:[\\/]')),
    ('本机 C: 用户目录', re.compile(r'C:[\\/]Users[\\/]')),
    ('本机 D/E 盘路径', re.compile(r'[DE]:[\\/](?:Claude-code|AI zhinengti|Agent xiangmu)')),
]


def read_bduss() -> str:
    if not BDUSS_FILE or not os.path.isfile(BDUSS_FILE):
        return ''
    try:
        with open(BDUSS_FILE, 'r', encoding='utf-8') as fh:
            return fh.read().strip()
    except OSError:
        return ''


def walk(target: str):
    for dirpath, dirnames, filenames in os.walk(target):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            ext = os.path.splitext(name)[1].lower()
            if ext not in TEXT_EXT:
                continue
            path = os.path.join(dirpath, name)
            try:
                if os.path.getsize(path) > 8 * 1024 * 1024:
                    continue
            except OSError:
                continue
            yield path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('target')
    ap.add_argument('--all', action='store_true', help='同时报告工作区内应排除的目录')
    args = ap.parse_args()

    target = os.path.abspath(args.target)
    if not os.path.isdir(target):
        print(f'[x] 不是目录：{target}')
        return 1

    bduss = read_bduss()
    patterns = list(CREDENTIAL_PATTERNS)
    if bduss:
        pass  # 真实值比对走 bduss in line，不需要改 patterns[0]
    else:
        print(f'[!] 未找到凭据文件 {BDUSS_FILE}，跳过真实值比对（仅按模式扫描）')

    credential_hits: list[tuple[str, str, int, str]] = []
    path_hits: list[tuple[str, str, int, str]] = []

    scanned = 0
    for path in walk(target):
        scanned += 1
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as fh:
                text = fh.read()
        except OSError:
            continue
        rel = os.path.relpath(path, target)
        for lineno, line in enumerate(text.splitlines(), 1):
            if bduss and bduss in line:
                credential_hits.append(('BDUSS 值（真实）', rel, lineno, line.strip()[:90]))
            for label, rx in patterns[1:]:
                if rx.search(line):
                    credential_hits.append((label, rel, lineno, line.strip()[:90]))
            for label, rx in PRIVATE_PATH_PATTERNS:
                # 扫描脚本自己含这些正则形态，跳过自身造成的自匹配
                if rel.replace('\\', '/').endswith('check_publish_safe.py'):
                    continue
                if rx.search(line):
                    path_hits.append((label, rel, lineno, line.strip()[:90]))

    print(f'扫描目录：{target}')
    print(f'文本文件：{scanned} 个（已跳过 node_modules / .git / .vendor）')
    print()

    if credential_hits:
        print(f'!! 凭据类命中 {len(credential_hits)} 处（**必须处理**）：')
        for label, rel, lineno, snippet in credential_hits:
            print(f'   [{label}] {rel}:{lineno}')
            print(f'       {snippet}')
    else:
        print('[ok] 未发现真实凭据')

    print()
    if path_hits:
        print(f'[!] 本机私有路径 {len(path_hits)} 处（公开仓库里应改成可配置/相对路径）：')
        for label, rel, lineno, snippet in path_hits:
            print(f'   [{label}] {rel}:{lineno}')
            print(f'       {snippet}')
    else:
        print('[ok] 未发现本机私有路径')

    if args.all:
        print()
        root_entries = sorted(os.listdir(ROOT))
        risky = [n for n in root_entries if n in {'.dsh-local', '.vendor', 'tools', '.tmp_raw.mjs'}]
        print(f'工作区根目录含水项（不应发布）：{risky}')
        print('（新插件请只发布插件子目录本身，工作区根目录保持私有）')

    return 1 if credential_hits else 0


if __name__ == '__main__':
    sys.exit(main())
