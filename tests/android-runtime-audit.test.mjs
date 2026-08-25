import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const build = read("android/app/build.gradle");
const activity = read("android/app/src/main/java/com/junyingjun/jinke/MainActivity.java");
const engine = read("android/app/src/main/java/com/junyingjun/jinke/OfflineSpeechEngine.java");
const modelRoot = path.join(root, "android/app/src/main/assets/vosk-model-small-cn-0.22");

for (const permission of [
  "INTERNET",
  "ACCESS_NETWORK_STATE",
  "RECORD_AUDIO",
  "POST_NOTIFICATIONS",
  "RECEIVE_BOOT_COMPLETED",
  "REQUEST_INSTALL_PACKAGES",
  "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
  "WAKE_LOCK",
  "SCHEDULE_EXACT_ALARM",
]) {
  assert.match(manifest, new RegExp(`android\\.permission\\.${permission}`), `${permission} must be declared`);
}

assert.match(build, /com\.alphacephei:vosk-android:0\.3\.75@aar/, "Vosk Android engine must be packaged");
assert.match(build, /net\.java\.dev\.jna:jna:5\.18\.1@aar/, "Vosk native bridge dependency must be packaged");
assert.match(engine, /class OfflineSpeechEngine implements RecognitionListener/, "APK must include its own offline recognizer");
assert.match(engine, /new SpeechService\(recognizer, SAMPLE_RATE\)/, "offline engine must record directly from the microphone");
assert.match(engine, /Log\.i\(LOG_TAG, "Offline microphone recognition started"\)/, "offline microphone startup must leave a diagnostic log");
assert.match(engine, /LISTEN_TIMEOUT_MS = 30000/, "offline listening must leave enough time for a follow-up phrase");
assert.match(engine, /committedText = appendSegment\(committedText, text\)/, "pause-separated recognition segments must accumulate instead of replacing each other");
assert.match(engine, /if \(!latestText\.isBlank\(\)\)[\s\S]*finish\(latestText\)/, "a late audio error must preserve an already recognized transcript");
assert.match(engine, /synchronized void cancel\(\)[\s\S]*cleanupSession\(\)/, "canceling voice input must release the microphone without delivering a command");
assert.match(activity, /cancelSpeechRecognition[\s\S]*offlineSpeechEngine\.cancel\(\)/, "the web voice sheet must be able to cancel native recognition");
assert.doesNotMatch(activity, /showSoftKeyboard|InputMethodManager\.SHOW_IMPLICIT/, "the focused input must open the IME without a redundant native button bridge");
assert.match(engine, /copyAssetTree[\s\S]*MODEL_ASSET_DIR/, "bundled model must be copied into private storage before loading");
assert.match(activity, /getSystemCapabilities/, "native bridge must expose live permission and component states");
assert.match(activity, /ACTION_REQUEST_SCHEDULE_EXACT_ALARM/, "exact-alarm settings must be actionable");
assert.match(activity, /ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS/, "battery restriction settings must be actionable");
assert.match(activity, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/, "APK update installation permission must be actionable");
assert.match(activity, /backgroundConfigured/, "native capabilities must expose the ColorOS background configuration state");
assert.match(activity, /openBackgroundSettings[\s\S]*com\.oplus\.safecenter[\s\S]*com\.coloros\.safecenter/, "background management must deep-link through known OPlus and ColorOS settings");
assert.match(activity, /BACKGROUND_SETTINGS_OPENED/, "returning from the OEM background settings must not keep showing a false failure");
assert.match(activity, /deliverSystemTimeChanged[\s\S]*JINKE_REFRESH_SYSTEM_TIME/, "returning to the app must refresh the JavaScript system clock");
assert.match(manifest, /android\.intent\.action\.DATE_CHANGED/, "date rollover must reschedule Android reminders");

const requiredModelFiles = [
  "am/final.mdl",
  "conf/model.conf",
  "graph/Gr.fst",
  "graph/HCLr.fst",
  "ivector/final.ie",
];
for (const relative of requiredModelFiles) {
  const file = path.join(modelRoot, relative);
  assert.ok(fs.statSync(file).size > 0, `offline Chinese model file ${relative} must be non-empty`);
}
const walkSize = (directory) => fs.readdirSync(directory, { withFileTypes: true }).reduce(
  (sum, entry) => sum + (entry.isDirectory() ? walkSize(path.join(directory, entry.name)) : fs.statSync(path.join(directory, entry.name)).size),
  0,
);
assert.ok(walkSize(modelRoot) > 60_000_000, "the complete offline Chinese model must be bundled, not a placeholder");

console.log("android runtime audit: permissions, components, and offline Chinese model passed");
