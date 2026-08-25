$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot "android"
$jdkRoot = Get-ChildItem (Join-Path $projectRoot ".toolchains\jdk") -Directory | Select-Object -First 1
$sdkRoot = Join-Path $projectRoot ".toolchains\android-sdk"
$signingProperties = $env:JINKE_KEYSTORE_PROPERTIES
if (-not $signingProperties) {
    $signingProperties = Join-Path $projectRoot "..\..\..\..\Codex Working Help\secrets\jinke-release.properties"
}

if (-not $jdkRoot) { throw "未找到项目本地 JDK 17。" }
if (-not (Test-Path (Join-Path $sdkRoot "platforms\android-36\android.jar"))) { throw "未找到 Android 36 SDK。" }
if (-not (Test-Path $signingProperties)) { throw "未找到今刻发布签名配置。" }

$env:JAVA_HOME = $jdkRoot.FullName
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:JINKE_KEYSTORE_PROPERTIES = $signingProperties

& node (Join-Path $PSScriptRoot "build-web-bundle.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& (Join-Path $androidRoot "gradlew.bat") -p $androidRoot --no-daemon assembleRelease
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$sourceApk = Join-Path $androidRoot "app\build\outputs\apk\release\app-release.apk"
$releaseDir = Join-Path $projectRoot "release"
$releaseApk = Join-Path $releaseDir "jinke-coloros-v1.0.12.apk"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $releaseApk -Force

$apksigner = Join-Path $sdkRoot "build-tools\36.0.0\apksigner.bat"
& $apksigner verify --verbose --print-certs $releaseApk
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$aapt2 = Join-Path $sdkRoot "build-tools\36.0.0\aapt2.exe"
$permissions = (& $aapt2 dump permissions $releaseApk) -join "`n"
$requiredPermissions = @(
    "android.permission.RECORD_AUDIO",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    "android.permission.REQUEST_INSTALL_PACKAGES"
)
foreach ($permission in $requiredPermissions) {
    if ($permissions -notmatch [regex]::Escape($permission)) { throw "APK 缺少权限：$permission" }
}
$apkEntries = (& tar -tf $releaseApk) -join "`n"
$requiredEntries = @(
    "lib/arm64-v8a/libvosk.so",
    "lib/arm64-v8a/libjnidispatch.so",
    "assets/vosk-model-small-cn-0.22/am/final.mdl",
    "assets/vosk-model-small-cn-0.22/conf/model.conf",
    "assets/vosk-model-small-cn-0.22/graph/Gr.fst",
    "assets/vosk-model-small-cn-0.22/graph/HCLr.fst",
    "assets/vosk-model-small-cn-0.22/ivector/final.ie",
    "assets/www/THIRD_PARTY_NOTICES.md"
)
foreach ($entry in $requiredEntries) {
    if ($apkEntries -notmatch [regex]::Escape($entry)) { throw "APK 缺少运行组件：$entry" }
}
if ((Get-Item -LiteralPath $releaseApk).Length -lt 80000000) { throw "APK 体积异常，离线中文模型可能未打包。" }
Write-Host "RUNTIME_AUDIT_OK=permissions+arm64-vosk+chinese-model"
Write-Host "APK_READY=$releaseApk"
