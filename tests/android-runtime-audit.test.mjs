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
const scheduler = read("android/app/src/main/java/com/junyingjun/jinke/DdlScheduler.java");
const ddlReceiver = read("android/app/src/main/java/com/junyingjun/jinke/DdlAlarmReceiver.java");
const dailyScheduler = read("android/app/src/main/java/com/junyingjun/jinke/DailyScheduler.java");
const dailyReceiver = read("android/app/src/main/java/com/junyingjun/jinke/DailyAlarmReceiver.java");
const notificationSupport = read("android/app/src/main/java/com/junyingjun/jinke/NotificationSupport.java");
const reminderAlert = read("android/app/src/main/java/com/junyingjun/jinke/ReminderAlertActivity.java");
const webApp = read("app.jsx");
const screens = read("screens.jsx");
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
  "USE_FULL_SCREEN_INTENT",
]) {
  assert.match(manifest, new RegExp(`android\\.permission\\.${permission}`), `${permission} must be declared`);
}

assert.match(build, /com\.alphacephei:vosk-android:0\.3\.75@aar/, "Vosk Android engine must be packaged");
assert.match(build, /net\.java\.dev\.jna:jna:5\.18\.1@aar/, "Vosk native bridge dependency must be packaged");
assert.match(engine, /class OfflineSpeechEngine implements RecognitionListener/, "APK must include its own offline recognizer");
assert.match(engine, /new SpeechService\(recognizer, SAMPLE_RATE\)/, "offline engine must record directly from the microphone");
assert.match(engine, /setMaxAlternatives\(MAX_ALTERNATIVES\)/, "offline ASR must expose N-best candidates for domain rescoring");
assert.match(engine, /combinedAlternatives[\s\S]*confidence/, "offline ASR candidates must retain acoustic confidence");
assert.match(activity, /JINKE_NATIVE_SPEECH_CANDIDATES/, "native ASR candidates must reach the app-domain language model");
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
assert.match(manifest, /\.DailyAlarmReceiver/, "daily reminders must have a native broadcast receiver");
assert.match(manifest, /\.ReminderAlertActivity[\s\S]*showWhenLocked="true"[\s\S]*turnScreenOn="true"/, "lock-screen reminders must wake and render above the keyguard");
assert.match(manifest, /MainActivity[\s\S]*launchMode="singleTop"/, "notification taps must reuse the main app instead of opening a duplicate task");
assert.match(scheduler, /TreeSet[\s\S]*reminderTime[\s\S]*scheduleTime/, "Android must schedule every task-specific reminder time");
assert.match(scheduler, /cancelPreviouslyScheduled/, "changing reminder plans must cancel obsolete alarm times");
assert.match(ddlReceiver, /final-days[\s\S]*deadline-only/, "Android reminder delivery must honor final-days and deadline-only cadence modes");
assert.match(scheduler, /reminderTimeFor[\s\S]*deadlineLeadMinutes[\s\S]*triggerMinutes/, "deadline-only reminders must derive their alarm time from the deadline lead offset");
assert.match(scheduler, /reminderDayOffsetFor[\s\S]*deadlineMinutes - leadMinutes < 0/, "deadline lead offsets that cross midnight must target the previous day");
assert.match(dailyScheduler, /setExactAndAllowWhileIdle\(AlarmManager\.RTC_WAKEUP/, "daily reminders must use wakeup alarms at the planned time");
assert.match(dailyScheduler, /"24:00"\.equals\(value\)[\s\S]*return 1440/, "24:00 daily tasks must remain attached to their logical day");
assert.match(dailyScheduler, /Math\.floorDiv\(taskMinutes - leadMinutes, 1440\)/, "daily reminder leads that cross midnight must resolve a logical task date");
assert.match(dailyReceiver, /occursOn\(task, logicalDate\)/, "daily notifications must honor each task's weekday and active date range");
assert.match(dailyReceiver, /isCompleted\(task, logicalDate\)/, "manually completed daily occurrences must not notify again");
assert.doesNotMatch(dailyReceiver, /\.edit\(\)|putBoolean|setDailyCompletion|toggleDaily/, "a daily notification receiver must never mark a task complete");
assert.doesNotMatch(ddlReceiver, /\.edit\(\)|putBoolean|setDailyCompletion|toggleDaily/, "a DDL notification receiver must never mark a task complete");
assert.match(notificationSupport, /jinke_daily_ring_v3[\s\S]*jinke_daily_silent_v3[\s\S]*jinke_ddl_ring_v3[\s\S]*jinke_ddl_silent_v3/, "ringing and silent reminders must use separate immutable Android channels");
assert.match(notificationSupport, /setSound\(null, null\)[\s\S]*enableVibration\(vibrate\)[\s\S]*setLockscreenVisibility\(Notification\.VISIBILITY_PUBLIC\)/, "app-controlled reminder channels must preserve vibration policy and public lock-screen content");
assert.match(notificationSupport, /enqueueReminderSound[\s\S]*SOUND_QUEUE[\s\S]*USAGE_NOTIFICATION_EVENT/, "task sounds must be queued and played as notification sonification");
for (const resource of ["jinke_chime", "jinke_bell", "jinke_glass", "jinke_pop", "jinke_soft"]) {
  assert.match(notificationSupport, new RegExp(`R\\.raw\\.${resource}`), `${resource} must be wired into the native player`);
}
assert.match(notificationSupport, /getFilesDir\(\)[\s\S]*SOUND_DIRECTORY/, "imported sounds must resolve from app-private local storage");
assert.match(activity, /ACTION_OPEN_DOCUMENT[\s\S]*audio\/\*[\s\S]*REQUEST_REMINDER_SOUND/, "local reminder sounds must use Android's system audio picker");
assert.match(activity, /ACTION_RINGTONE_PICKER[\s\S]*TYPE_ALARM[\s\S]*REQUEST_SYSTEM_ALARM_SOUND/, "system alarm sounds must use Android's native alarm ringtone picker");
assert.match(activity, /pickSystemAlarmSound[\s\S]*EXTRA_RINGTONE_EXISTING_URI/, "the WebView bridge must open the alarm library and preserve the current selection");
assert.match(activity, /"source", "system-alarm"/, "selected system alarm metadata must return to the shared sound library");
assert.match(notificationSupport, /startsWith\("alarm:"\)[\s\S]*USAGE_ALARM[\s\S]*setDataSource\(context, alarmUri\)/, "system alarm sounds must play through the device alarm audio channel");
assert.match(screens, /闹铃库[\s\S]*手机系统闹铃[\s\S]*ColorOS/, "sound settings must expose the system alarm library as its own category");
assert.match(activity, /JINKE_SOUND_IMPORTED/, "imported sound metadata must return to the WebView sound library");
assert.match(dailyReceiver, /dailyChannel\(ringing\)[\s\S]*if \(ringing\) builder\.setVibrate[\s\S]*enqueueReminderSound/, "daily reminders must choose ring or silent delivery and play each selected sound");
assert.match(ddlReceiver, /ddlChannel\(ringing\)[\s\S]*if \(ringing\) builder\.setVibrate[\s\S]*enqueueReminderSound/, "DDL reminders must choose ring or silent delivery and play each selected sound");
assert.match(dailyReceiver, /setFullScreenIntent[\s\S]*setVisibility\(Notification\.VISIBILITY_PUBLIC\)[\s\S]*setPriority\(Notification\.PRIORITY_MAX\)/, "daily reminders must show as urgent lock-screen notifications");
assert.match(ddlReceiver, /setFullScreenIntent[\s\S]*setVisibility\(Notification\.VISIBILITY_PUBLIC\)[\s\S]*setPriority\(Notification\.PRIORITY_MAX\)/, "DDL reminders must show as urgent lock-screen notifications");
assert.match(reminderAlert, /setShowWhenLocked\(true\)[\s\S]*setTurnScreenOn\(true\)/, "the reminder alert must wake a locked device");
assert.match(activity, /syncDailyReminders[\s\S]*DailyScheduler\.saveAndSchedule/, "daily task plans must cross the WebView/native boundary");
assert.match(activity, /onNewIntent[\s\S]*deliverOpenToday/, "notification taps must route an already-running app to today's home screen");
assert.match(activity, /JINKE_OPEN_TODAY/, "the native activity must deliver the today navigation event to the WebView");
const openTodayHandler = webApp.match(/const openTodayFromNotification = \(\) => \{([\s\S]*?)\n    \};/);
assert.ok(openTodayHandler, "the web app must expose a notification navigation handler");
assert.match(openTodayHandler[1], /setActiveTab\("today"\)[\s\S]*setSelectedDateKey\(currentDateKey\)/, "notification taps must open today's home screen");
assert.doesNotMatch(openTodayHandler[1], /setDailyCompletionByDate|toggleDaily|done|completed/, "opening a notification must never complete a task");
assert.match(activity, /cleanupInstalledUpdateApk[\s\S]*DownloadManager[\s\S]*remove\(downloadId\)/, "a successfully installed update must clean up its downloaded APK");
assert.match(activity, /KEY_SOURCE_VERSION_CODE[\s\S]*BuildConfig\.VERSION_CODE/, "APK cleanup must only happen after the app version has advanced");

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
for (const sound of ["jinke_chime.wav", "jinke_bell.wav", "jinke_glass.wav", "jinke_pop.wav", "jinke_soft.wav"]) {
  const file = path.join(root, "android/app/src/main/res/raw", sound);
  assert.ok(fs.statSync(file).size > 8_000, `built-in reminder sound ${sound} must be a non-empty audio asset`);
}
const walkSize = (directory) => fs.readdirSync(directory, { withFileTypes: true }).reduce(
  (sum, entry) => sum + (entry.isDirectory() ? walkSize(path.join(directory, entry.name)) : fs.statSync(path.join(directory, entry.name)).size),
  0,
);
assert.ok(walkSize(modelRoot) > 60_000_000, "the complete offline Chinese model must be bundled, not a placeholder");

console.log("android runtime audit: permissions, components, and offline Chinese model passed");
