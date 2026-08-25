$ErrorActionPreference = "Stop"
$previewPort = 43190
$bundleScript = Join-Path $PSScriptRoot "scripts\build-web-bundle.mjs"
& node $bundleScript
if ($LASTEXITCODE -ne 0) { throw "今刻 Web bundle 构建失败。" }
$identityUrl = "http://127.0.0.1:$previewPort/project-identity.json"
$listener = Get-NetTCPConnection -State Listen -LocalPort $previewPort -ErrorAction SilentlyContinue
if ($listener) {
  try {
    $identity = Invoke-RestMethod -Uri $identityUrl -TimeoutSec 3
    if ($identity.appId -eq "jinke-coloros-calendar") {
      Write-Host "今刻预览已在 $identityUrl 对应的 $previewPort 端口运行。"
      exit 0
    }
  } catch {}
  throw "端口 $previewPort 已被其它服务占用；今刻不会复用或切换到其它端口。"
}
$previewScript = Join-Path $env:USERPROFILE ".codex\skills\mobile-design\scripts\start_mobile_preview.py"
py -3.7 $previewScript $PSScriptRoot --host 127.0.0.1 --port $previewPort
