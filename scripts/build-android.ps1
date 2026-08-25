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
$releaseApk = Join-Path $releaseDir "jinke-coloros-v1.0.3.apk"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $releaseApk -Force

$apksigner = Join-Path $sdkRoot "build-tools\36.0.0\apksigner.bat"
& $apksigner verify --verbose --print-certs $releaseApk
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "APK_READY=$releaseApk"
