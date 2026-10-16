# dsh 插件双端构建：install -> link_deps -> tsdown -> 自检
# 用法: powershell -ExecutionPolicy Bypass -File scripts/build.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pnpm = $null
foreach ($cand in @($env:PNPM_EXE, (Get-Command pnpm -ErrorAction SilentlyContinue).Source)) {
  if ($cand -and (Test-Path $cand)) { $pnpm = $cand; break }
}
if (-not $pnpm) { throw 'pnpm not found - install pnpm or set $env:PNPM_EXE' }

Write-Host '[1/4] install'
# pnpm 不认 --legacy-peer-deps（npm 专有）；用 --config.strict-peer-dependencies=false
& $pnpm install --config.strict-peer-dependencies=false
if ($LASTEXITCODE -ne 0) { throw 'install failed' }

Write-Host '[2/4] link host deps (junction)'
& python scripts/link_deps.py
# link_deps 非 0 只表示「没找到宿主副本」，devDependencies 已覆盖，不阻断构建

Write-Host '[3/4] tsdown (node + client)'
& npx tsdown
if ($LASTEXITCODE -ne 0) { throw 'tsdown failed' }

Write-Host '[4/4] verify artifacts'
& node tools/check_artifacts.mjs
if ($LASTEXITCODE -ne 0) { throw 'artifact check failed' }

Write-Host 'build ok'
