$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot "android"
$jdkRoot = Get-ChildItem (Join-Path $projectRoot ".toolchains\jdk") -Directory | Select-Object -First 1
$sdkRoot = Join-Path $projectRoot ".toolchains\android-sdk"
$signingProperties = $env:JINKE_KEYSTORE_PROPERTIES
if (-not $signingProperties) {
    $signingProperties = Join-Path $projectRoot "..\..\..\..\Codex Working Help\secrets\jinke-release.properties"
}

if (-not $jdkRoot) { throw "Project-local JDK 17 was not found." }
if (-not (Test-Path (Join-Path $sdkRoot "platforms\android-36\android.jar"))) { throw "Android 36 SDK was not found." }
if (-not (Test-Path $signingProperties)) { throw "Jinke release signing properties were not found." }

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
$releaseApk = Join-Path $releaseDir "jinke-coloros-v1.1.5.apk"
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
    "android.permission.USE_EXACT_ALARM",
    "android.permission.USE_FULL_SCREEN_INTENT",
    "android.permission.WAKE_LOCK",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
    "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    "android.permission.REQUEST_INSTALL_PACKAGES"
)
foreach ($permission in $requiredPermissions) {
    if ($permissions -notmatch [regex]::Escape($permission)) { throw "APK is missing permission: $permission" }
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
    if ($apkEntries -notmatch [regex]::Escape($entry)) { throw "APK is missing runtime component: $entry" }
}
if ((Get-Item -LiteralPath $releaseApk).Length -lt 80000000) { throw "APK size is unexpectedly small; the offline Chinese model may be missing." }
foreach ($sound in @("jinke_chime.wav", "jinke_bell.wav", "jinke_glass.wav", "jinke_pop.wav", "jinke_soft.wav")) {
    if (-not (Test-Path (Join-Path $projectRoot "android\app\src\main\res\raw\$sound"))) { throw "Bundled reminder sound is missing: $sound" }
}
$mainActivitySource = Get-Content -LiteralPath (Join-Path $projectRoot "android\app\src\main\java\com\junyingjun\jinke\MainActivity.java") -Raw
$notificationSource = Get-Content -LiteralPath (Join-Path $projectRoot "android\app\src\main\java\com\junyingjun\jinke\NotificationSupport.java") -Raw
if ($mainActivitySource -notmatch "ACTION_RINGTONE_PICKER" -or $mainActivitySource -notmatch "TYPE_ALARM") { throw "Android system alarm picker is not wired." }
if ($notificationSource -notmatch "USAGE_ALARM" -or $notificationSource -notmatch 'startsWith\("alarm:"\)') { throw "System alarm sounds are not routed through the alarm audio channel." }
Write-Host "RUNTIME_AUDIT_OK=permissions+arm64-vosk+chinese-model+5-reminder-sounds+system-alarm-picker"
Write-Host "APK_READY=$releaseApk"
