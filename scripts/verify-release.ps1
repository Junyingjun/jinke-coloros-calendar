$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$apiUrl = "https://api.github.com/repos/Junyingjun/jinke-coloros-calendar/releases/latest"
$release = Invoke-RestMethod -Uri $apiUrl -Headers @{ Accept = "application/vnd.github+json"; "User-Agent" = "Jinke-Release-Verification" }
if ($release.tag_name -ne "v1.0.8") { throw "GitHub 最新版本不是 v1.0.8。" }
$apk = $release.assets | Where-Object { $_.name -eq "jinke-coloros-v1.0.8.apk" } | Select-Object -First 1
if (-not $apk) { throw "GitHub Release 缺少 APK。" }
Write-Host "RELEASE_OK=$($release.html_url)"
Write-Host "APK_URL=$($apk.browser_download_url)"
