#!/usr/bin/env python3
"""把宿主侧的客户端类型包下到 .host-types/，供 tsconfig.client.json 用。

为什么需要它：
  dsh 的宿主包躺在 app.asar 里，本机没有任何 asar 解包工具；而插件源码里的
  `import type { ... } from '@deepseek-ai/dsh-client-ui-tool'` 之类的语句又要能过
  tsc。registry 上这几个客户端包**恰好**发的是完整声明文件（lib/types/**.d.ts），
  版本号与宿主一致（0.2.1-rc.2），所以直接下载解包最省事、也可复现。

  注意 dsh-client-runtime / dsh-client-ui-chat / dsh-client-ui-conversation 在
  registry 上是 0.0.1-rc.1 / 0.1.2-alpha.2 这类完全无关的包，**别用**——那些槽位
  契约在 src/client/contract.d.ts 里手写维护。

用法：
  python scripts/fetch_host_types.py                 # 默认宿主版本 0.2.1-rc.2
  python scripts/fetch_host_types.py --version 0.2.0-rc.2
  python scripts/fetch_host_types.py --check         # 只检查，不下载

产物落在 <repo>/.host-types/<pkg>/（已在 .gitignore 里）。
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tarfile
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '.host-types')

DEFAULT_VERSION = '0.2.1-rc.2'

# 只放 registry 上真实存在的客户端包；名字 -> 从哪个子路径提供类型都不重要，
# 下游 tsconfig 的 paths 指向包根，靠 package.json 的 "types" 字段解析。
PACKAGES = (
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-tool',
    '@deepseek-ai/dsh-client-store',
)


def registry() -> str:
    # 本机全局 registry 指向 npmmirror，但这里跟着 profile 的 .npmrc 走 npmjs，
    # 免得镜像同步延迟导致刚发布的 rc 版拉不到。
    return os.environ.get('DSH_HOST_TYPES_REGISTRY', 'https://registry.npmjs.org').rstrip('/')


def tarball_url(name: str, version: str) -> str:
    base = name.split('/')[-1]
    return f'{registry()}/{name}/-/{base}-{version}.tgz'


def package_dir(name: str) -> str:
    return os.path.join(OUT, name.split('/')[-1])


def installed_version(name: str) -> str | None:
    manifest = os.path.join(package_dir(name), 'package.json')
    if not os.path.isfile(manifest):
        return None
    try:
        with open(manifest, encoding='utf-8') as fh:
            return json.load(fh).get('version')
    except (OSError, json.JSONDecodeError):
        return None


def has_types(name: str) -> bool:
    root = package_dir(name)
    manifest = os.path.join(root, 'package.json')
    if not os.path.isfile(manifest):
        return False
    try:
        with open(manifest, encoding='utf-8') as fh:
            types = json.load(fh).get('types') or 'index.d.ts'
    except (OSError, json.JSONDecodeError):
        return False
    return os.path.isfile(os.path.join(root, types))


def fetch(name: str, version: str) -> None:
    url = tarball_url(name, version)
    print(f'[fetch] {name}@{version}  <- {url}')
    with urllib.request.urlopen(url, timeout=120) as resp:
        payload = resp.read()
    with tempfile.TemporaryDirectory() as tmp:
        tgz = os.path.join(tmp, 'pkg.tgz')
        with open(tgz, 'wb') as fh:
            fh.write(payload)
        dest = package_dir(name)
        if os.path.isdir(dest):
            shutil.rmtree(dest)
        os.makedirs(dest, exist_ok=True)
        with tarfile.open(tgz, 'r:gz') as tar:
            for member in tar.getmembers():
                # npm 包统一以 package/ 打头；挡掉绝对路径与 .. 穿越
                if not member.name.startswith('package/'):
                    continue
                rel = member.name[len('package/'):]
                if not rel or rel.startswith('/') or '..' in rel.split('/'):
                    continue
                target = os.path.join(dest, rel)
                if member.isdir():
                    os.makedirs(target, exist_ok=True)
                elif member.isfile():
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    src = tar.extractfile(member)
                    if src is None:
                        continue
                    with src, open(target, 'wb') as out:
                        shutil.copyfileobj(src, out)


def count_dts(root: str) -> int:
    total = 0
    for _, _, files in os.walk(root):
        total += sum(1 for f in files if f.endswith('.d.ts'))
    return total


def main() -> int:
    parser = argparse.ArgumentParser(description='下载宿主客户端类型包到 .host-types/')
    parser.add_argument('--version', default=DEFAULT_VERSION, help='宿主版本（默认 %(default)s）')
    parser.add_argument('--check', action='store_true', help='只检查是否齐备，不下载')
    args = parser.parse_args()

    missing = []
    for name in PACKAGES:
        version = installed_version(name)
        ok = version == args.version and has_types(name)
        state = 'ok' if ok else ('stale' if version else 'missing')
        print(f'[{state}] {name}  (installed={version or "-"})')
        if not ok:
            missing.append(name)

    if args.check:
        if missing:
            print(f'\n{len(missing)} 个类型包缺失或版本不符，请先跑：python scripts/fetch_host_types.py')
            return 1
        print(f'\nall host types ready (.host-types, {count_dts(OUT)} .d.ts)')
        return 0

    if missing:
        os.makedirs(OUT, exist_ok=True)
        for name in missing:
            fetch(name, args.version)

    broken = [n for n in PACKAGES if not has_types(n)]
    if broken:
        print(f'ERROR: 下载后仍然没有类型：{", ".join(broken)}', file=sys.stderr)
        return 1
    print(f'[done] {len(PACKAGES)} packages, {count_dts(OUT)} .d.ts in {OUT}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
