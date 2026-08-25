import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "data.jsx"), "utf8"), context);

const appSource = fs.readFileSync(path.join(root, "app.jsx"), "utf8");
const screensSource = fs.readFileSync(path.join(root, "screens.jsx"), "utf8");
const primitivesSource = fs.readFileSync(path.join(root, "primitives.jsx"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const activitySource = fs.readFileSync(path.join(root, "android/app/src/main/java/com/junyingjun/jinke/MainActivity.java"), "utf8");
const manifestSource = fs.readFileSync(path.join(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
const start = appSource.indexOf("const CN_DIGITS");
const end = appSource.indexOf("function useViewportScale");
assert.ok(start >= 0 && end > start, "voice router source markers must exist");

context.APP_DATA = context.window.APP_DATA;
context.getCriticalReminder = context.window.getCriticalReminder;
context.normalizeCriticalReminderPlan = context.window.normalizeCriticalReminderPlan;
context.repeatLabelFromDays = context.window.repeatLabelFromDays;
vm.runInContext(`${appSource.slice(start, end)}\nthis.parseVoiceCommand = parseVoiceCommand;`, context);

const routerDailyTasks = [
  { id: "gym", title: "健身", time: "19:00", note: "力量训练", repeat: "周一、三、五", reminder: "到点提醒" },
];
const routerCriticalTasks = [
  { id: "passport", title: "旅行证件续期", deadline: "9月8日", daysLeft: 15, time: null, note: "准备材料" },
];
const route = (text) => context.parseVoiceCommand(text, routerDailyTasks, routerCriticalTasks);

const cases = [
  ["清除所有的安排", "clear-all"],
  ["清除健身", "delete"],
  ["把健身改到晚上八点", "edit"],
  ["给旅行证件续期设置下午三点", "edit"],
  ["把旅行证件续期改到九月十五号下午三点", "set-deadline"],
  ["完成今天所有的安排", "complete-all"],
  ["今天有什么安排", "query"],
  ["切换到亮色", "theme"],
  ["把DDL默认提醒时间改为早上九点", "set-ddl-reminder-time"],
  ["把DDL提醒倍数改成7天", "set-ddl-reminder-policy"],
  ["把DDL最后连续提醒改成3天", "set-ddl-reminder-policy"],
  ["切换到25号", "select-date"],
  ["查看历史记录", "navigate"],
  ["切换到周视图", "navigate"],
  ["把健身改为关键事项", "edit"],
  ["每天晚上九点写日志", "create"],
  ["我想在九月十五号下午三点的时候去考驾照", "create"],
  ["提醒我明天早上九点给妈妈打电话", "create"],
  ["我打算每天晚上十点写一下日志吧", "create"],
  ["大概什么时候去考D照", "create"],
  ["每周一三五晚上七点健身四十五分钟", "create"],
  ["周一到周五点外卖", "create"],
  ["周 一 到 周 五 点 外 卖", "create"],
  ["周一到周五每天十一点点外卖", "create"],
  ["周一三五健身房", "create"],
  ["九月一号去北京，九月五号回来", "create"],
  ["创建一个有DDL的任务，九月三十号提交报告", "create"],
  ["创建一个有deadline的任务，九月三十号提交报告", "create"],
  ["创建一个有滴滴艾尔的任务，九月三十号提交报告", "create"],
];

for (const [text, intent] of cases) {
  const result = route(text);
  assert.equal(result.intent, intent, `${text} should route to ${intent}`);
  assert.equal(result.valid, true, `${text} should be actionable`);
}

assert.equal(route("清除所有的安排").scope, "all");
assert.equal(route("清除健身").target.task.id, "gym");
assert.equal(route("把健身改到晚上八点").changes.time, "20:00");
assert.equal(route("给旅行证件续期设置下午三点").changes.deadlineTime, "15:00");
assert.equal(route("把旅行证件续期改到九月十五号下午三点").eventTime, "15:00");
assert.equal(route("切换到亮色").themeMode, "light");
assert.equal(route("把DDL默认提醒时间改为早上九点").reminderTime, "09:00");
assert.equal(route("把DDL提醒倍数改成7天").value, 7);
assert.equal(route("把DDL提醒倍数改成7天").policy, "multiple");
assert.equal(route("把DDL最后连续提醒改成3天").value, 3);
assert.equal(route("把DDL最后连续提醒改成3天").policy, "final-days");
assert.equal(route("切换到25号").dateKey, "2026-08-25");
assert.equal(route("切换到周视图").route, "today");
assert.equal(route("把健身改为关键事项").changes.type, "critical");
assert.equal(route("我想在九月十五号下午三点的时候去考驾照").task.title, "考驾照");
assert.deepEqual(Array.from(route("我想在九月十五号下午三点的时候去考驾照").task.keywords), ["考", "驾照"]);
assert.equal(route("提醒我明天早上九点给妈妈打电话").task.title, "给妈妈打电话");
assert.equal(route("我打算每天晚上十点写一下日志吧").task.title, "写日志");
assert.equal(route("大概什么时候去考D照").task.title, "考D照");
assert.equal(route("每周一三五晚上七点健身四十五分钟").task.title, "健身");
assert.match(route("每周一三五晚上七点健身四十五分钟").task.note, /持续 45 分钟/);
assert.equal(route("周一到周五点外卖").task.title, "点外卖");
assert.equal(route("周一到周五点外卖").task.repeat, "工作日");
assert.equal(route("周一到周五点外卖").task.time, "待定");
assert.equal(route("周 一 到 周 五 点 外 卖").task.title, "点外卖");
assert.equal(route("周 一 到 周 五 点 外 卖").task.repeat, "工作日");
assert.equal(route("周一到周五每天十一点点外卖").task.title, "点外卖");
assert.equal(route("周一到周五每天十一点点外卖").task.time, "11:00");
assert.equal(route("周一到周五每天十一点点外卖").task.repeat, "工作日");
assert.deepEqual(Array.from(route("周一到周五每天十一点点外卖").task.repeatDays), [1, 2, 3, 4, 5]);
assert.equal(route("每天九点提前30小时提醒我写日志").task.reminder, "提前23小时55分钟", "daily voice reminders must stay inside 24 hours on the five-minute grid");
assert.equal(route("每天十一点三分写日志").task.time, "11:05", "voice minutes must snap to the five-minute grid");
assert.equal(route("每天十一点十二分写日志").task.time, "11:10", "voice minutes must use the nearest five-minute value");
assert.equal(route("每天晚上十一点半上床看书").task.time, "23:30", "standard half-hour speech must resolve to thirty minutes");
assert.equal(route("每天晚上十一点半上床看书").task.title, "上床看书", "the half-hour phrase must not leak into the title");
assert.equal(route("每天晚上十一点办，上床看书").task.time, "23:30", "common 半/办 recognition confusion must resolve to thirty minutes");
assert.equal(route("每天晚上十一点办，上床看书").task.title, "上床看书", "a fuzzy half-hour token must be removed from the title");
assert.equal(route("每天早上七点伴起床").task.time, "07:30", "common 半/伴 recognition confusion must resolve to thirty minutes");
assert.equal(route("每天晚上十二点睡觉").task.time, "24:00", "evening twelve must remain the selected day's 24:00 boundary");
assert.equal(route("每天12 点睡觉").task.time, "24:00", "spaced twelve o'clock sleep speech must infer the end-of-day boundary");
assert.equal(route("每天12电睡觉").task.time, "24:00", "common 点/电 recognition confusion must not leak into the title");
assert.equal(route("每天12电睡觉").task.title, "睡觉");
assert.equal(route("每天零点起床").task.time, "00:00", "zero o'clock must remain the start of the selected day");
assert.equal(route("每天晚上十点到十二点睡觉").task.time, "22:00");
assert.equal(route("每天晚上十点到十二点睡觉").task.endTime, "24:00");
assert.equal(route("每天晚上十点到十二点睡觉").task.spansMidnight, false);
assert.equal(route("周一三五健身房").task.title, "健身房");
assert.deepEqual(Array.from(route("周一三五健身房").task.repeatDays), [1, 3, 5]);
assert.equal(route("每天晚上九点写日志").task.note, "", "voice creation must leave notes empty by default");
assert.equal(route("九月一号去北京，九月五号回来").task.span.title, "北京行程");
assert.equal(route("九月一号去北京，九月五号回来").task.span.start.deadline, "9月1日");
assert.equal(route("九月一号去北京，九月五号回来").task.span.end.deadline, "9月5日");
assert.equal(route("九月一号去北京，待五天回来").task.span.end.daysLeft - route("九月一号去北京，待五天回来").task.span.start.daysLeft, 5);
assert.equal(route("创建一个无deadline的任务，修桑顿皮卡德相机").task.type, "critical", "an explicit no-deadline request must create a critical task");
assert.equal(route("创建一个无deadline的任务，修桑顿皮卡德相机").task.deadline, null);
assert.equal(route("创建一个无deadline的任务，修桑顿皮卡德相机").task.title, "修桑顿皮卡德相机", "the explicit no-deadline phrase must not leak into the title");
assert.equal(route("创建一个有DDL的任务，九月三十号上午九点提交报告").task.type, "critical", "spoken DDL must select the critical task model");
assert.equal(route("创建一个有DDL的任务，九月三十号上午九点提交报告").task.title, "提交报告", "DDL intent words must not leak into the task title");
assert.equal(route("创建一个有DDL的任务，九月三十号上午九点提交报告").task.deadlineTime, "09:00", "a spoken event time is the deadline time");
assert.equal(route("创建一个有DDL的任务，九月三十号上午九点提交报告").task.reminderTime, "10:00", "deadline time must not overwrite the independent reminder time");
assert.equal(route("创建一个有deadline的任务，九月三十号提交报告").task.type, "critical", "spoken deadline must remain supported");
assert.equal(route("创建一个有滴滴艾尔的任务，九月三十号提交报告").task.type, "critical", "common Chinese-model DDL transcription must be normalized");

const runtimeNow = new Date();
const runtimeDateKey = `${runtimeNow.getFullYear()}-${String(runtimeNow.getMonth() + 1).padStart(2, "0")}-${String(runtimeNow.getDate()).padStart(2, "0")}`;
assert.equal(context.APP_DATA.today.dateKey, runtimeDateKey, "startup calendar data must come from the system date");
assert.match(appSource, /useState\(\(\) => localDateKey\(\)\)/, "selected date and today must initialize from the system clock");
assert.match(appSource, /setInterval\(refreshSystemDate, 30000\)/, "the running app must detect midnight rollover");
assert.match(appSource, /visibilitychange[\s\S]*pageshow[\s\S]*JINKE_REFRESH_SYSTEM_TIME|JINKE_REFRESH_SYSTEM_TIME[\s\S]*pageshow[\s\S]*visibilitychange/, "foreground and native clock events must refresh the date");
assert.match(appSource, /voiceInputModeRef\.current === "input-method"[\s\S]*setVoicePhase\("review"\)/, "IME text must enter review without waiting for a canceled speech callback");
assert.doesNotMatch(screensSource, /composer-ime-button|>输入法<|showSoftKeyboard/, "the assistant must have one keyboard entry point instead of a redundant button");
assert.match(screensSource, /className="composer-input"[\s\S]*onFocus=\{onUseInputMethod\}/, "focusing the text field must switch safely into IME mode");

assert.equal(context.window.taskOccursOnDate({ repeat: "工作日" }, "2026-08-28", "2026-08-24"), true, "workday tasks must show on Friday");
assert.equal(context.window.taskOccursOnDate({ repeat: "工作日" }, "2026-08-29", "2026-08-24"), false, "workday tasks must not leak into Saturday");
assert.equal(context.window.taskOccursOnDate({ repeat: "周末" }, "2026-08-29", "2026-08-24"), true, "weekend tasks must show on Saturday");
assert.equal(context.window.taskOccursOnDate({ repeatDays: [2, 4] }, "2026-08-27", "2026-08-24"), true, "explicit weekday selections must drive visibility");
assert.equal(context.window.taskOccursOnDate({ repeatDays: [2, 4] }, "2026-08-28", "2026-08-24"), false, "unselected weekdays must stay hidden");

for (const day of context.APP_DATA.week) {
  const marker = context.window.getCalendarMarker(day.dateKey);
  assert.ok(marker.short && marker.full && marker.source, `${day.dateKey} must have a real calendar marker`);
}
assert.match(context.window.getCalendarMarker("2026-08-24").short, /农历七月十二/);
assert.match(context.window.getCalendarMarker("2026-08-27").short, /中元节/);

const augustGrid = Array.from(context.window.getMonthDates("2026-08-24"));
assert.equal(augustGrid.length, 42, "month view must render six complete weeks");
assert.equal(augustGrid[0].dateKey, "2026-07-27");
assert.equal(augustGrid.at(-1).dateKey, "2026-09-06");
assert.ok(augustGrid.some((item) => item.dateKey === "2026-08-31"), "August 31 must be selectable");
assert.deepEqual(Array.from(context.window.getWeekDates("2026-09-02"), (item) => item.dateKey), [
  "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06",
]);
assert.equal(context.window.getDateMeta("2026-09-02").day, "三");
assert.equal(context.window.shiftDateKeyByMonth("2026-08-31", 1), "2026-09-30");
assert.equal(context.window.shouldRemindCritical(15), true, "15 days must be a reminder node");
assert.equal(context.window.shouldRemindCritical(38), false, "non-multiple days outside the final five must stay quiet");
assert.equal(context.window.shouldRemindCritical(5), true, "the final five days must remind daily");
assert.equal(context.window.shouldRemindCritical(0), true, "deadline day must remind");
assert.equal(context.window.shouldRemindCritical(-1), false, "completed deadline cadence stops after the deadline");
assert.equal(context.window.shouldRemindCritical(14, 7, 3), true, "custom reminder multiples must be honored");
assert.equal(context.window.shouldRemindCritical(4, 7, 3), false, "days outside a custom final window must stay quiet");
assert.equal(context.window.shouldRemindCritical(3, 7, 3), true, "custom final reminder days must be honored");
assert.match(context.window.getCriticalReminder({ deadline: "9月30日", reminderEnabled: true }, "09:30"), /09:30/);
assert.equal(context.window.getCriticalReminder({ deadline: "9月30日", reminderEnabled: true, reminderMode: "final-days", reminderFinalDays: 5, reminderTime: "08:15" }), "仅最后 5 天 · 08:15");
assert.equal(context.window.shouldRemindCritical(6, { deadline: "9月30日", reminderEnabled: true, reminderMode: "final-days", reminderFinalDays: 5 }), false);
assert.equal(context.window.shouldRemindCritical(5, { deadline: "9月30日", reminderEnabled: true, reminderMode: "final-days", reminderFinalDays: 5 }), true);
assert.equal(context.window.shouldRemindCritical(4, { deadline: "9月30日", reminderEnabled: true, reminderMode: "deadline-only" }), false);
assert.equal(context.window.shouldRemindCritical(0, { deadline: "9月30日", reminderEnabled: true, reminderMode: "deadline-only" }), true);
assert.equal(context.window.getCriticalReminderTriggerTime({ deadline: "9月30日", deadlineTime: "14:00", reminderEnabled: true, reminderMode: "deadline-only", deadlineLeadMinutes: 90 }), "12:30");
assert.equal(context.window.getCriticalReminderTriggerTime({ deadline: "9月30日", deadlineTime: "00:30", reminderEnabled: true, reminderMode: "deadline-only", deadlineLeadMinutes: 60 }), "23:30");
assert.equal(context.window.getCriticalReminderDayOffset({ deadline: "9月30日", deadlineTime: "00:30", reminderEnabled: true, reminderMode: "deadline-only", deadlineLeadMinutes: 60 }), 1);
assert.equal(context.window.shouldRemindCritical(1, { deadline: "9月30日", deadlineTime: "00:30", reminderEnabled: true, reminderMode: "deadline-only", deadlineLeadMinutes: 60 }), true);
assert.match(screensSource, /TimePicker label="截止时刻"/, "critical task editing must expose a dedicated deadline time");
assert.match(screensSource, /CriticalReminderPlanPicker task=/, "critical task editing must expose an independent reminder plan");
assert.match(screensSource, /reminderTime[\s\S]*reminderMode[\s\S]*reminderMultiple/, "critical reminder time and cadence must be independently editable");
assert.doesNotMatch(screensSource, /label="时间"[\s\S]{0,180}getCriticalReminder\(time/, "changing the deadline time must not rewrite the reminder plan");
assert.equal(context.APP_DATA.dailyTasks.length, 1, "formal seed must keep one daily demonstration only");
assert.equal(context.APP_DATA.criticalTasks.length, 1, "formal seed must keep one DDL demonstration only");
assert.equal(context.APP_DATA.dailyTasks[0].demo, true);
assert.equal(context.APP_DATA.criticalTasks[0].demo, true);
assert.equal(context.APP_DATA.criticalTasks[0].deadline !== null, true);
assert.deepEqual(Array.from(context.APP_DATA.history), [], "formal seed must not invent history");
assert.deepEqual(Array.from(context.APP_DATA.monthRanking), [], "formal seed must not invent monthly results");
assert.deepEqual(Array.from(context.APP_DATA.yearRanking), [], "formal seed must not invent annual results");
assert.deepEqual(Array.from(context.APP_DATA.ddlRanking), [], "formal seed must not invent DDL rankings");

const migrationValues = new Map([
  ["jinke-daily-tasks", JSON.stringify([{ id: "gym" }, { id: "daily-user", title: "用户日程" }])],
  ["jinke-critical-tasks", JSON.stringify([{ id: "passport" }, { id: "critical-user", title: "用户 DDL" }])],
  ["jinke-task-history", JSON.stringify([{ id: "h1" }, { id: "history-user", sourceTaskId: "critical-user" }])],
  ["jinke-daily-completions", JSON.stringify({ "gym:2026-08-24": true, "daily-user:2026-08-24": true })],
]);
const migrationContext = {
  APP_DATA: context.APP_DATA,
  localStorage: {
    getItem: (key) => migrationValues.get(key) ?? null,
    setItem: (key, value) => migrationValues.set(key, String(value)),
  },
};
const migrationStart = appSource.indexOf("function migrateLegacySeedData");
const migrationEnd = appSource.indexOf("function dateKeyOffset");
vm.runInNewContext(appSource.slice(migrationStart, migrationEnd), migrationContext);
assert.deepEqual(JSON.parse(migrationValues.get("jinke-daily-tasks")).map((item) => item.id), ["daily-user"]);
assert.deepEqual(JSON.parse(migrationValues.get("jinke-critical-tasks")).map((item) => item.id), ["critical-user"]);
assert.deepEqual(JSON.parse(migrationValues.get("jinke-task-history")).map((item) => item.id), ["history-user"]);
assert.deepEqual(Object.keys(JSON.parse(migrationValues.get("jinke-daily-completions"))), ["daily-user:2026-08-24"]);

assert.match(appSource, /renderDevice\("phone"\)/, "simulator must render the normal phone");
assert.match(appSource, /renderDevice\("expanded"\)/, "simulator must render the expanded screen from the same state tree");
assert.match(appSource, /dailyDraft[\s\S]*criticalDraft[\s\S]*voiceDraft/, "device editors must use shared drafts");
assert.match(appSource, /archiveActive[\s\S]*archiveIndex/, "day archive browsing must be shared across devices");
assert.match(screensSource, /today-responsive-grid/, "today screen must expose responsive panes");
assert.match(screensSource, /critical-responsive-grid/, "critical screen must expose responsive panes");
assert.match(stylesSource, /\.phone-shell-expanded \.today-responsive-grid[\s\S]*grid-template-columns/, "expanded today screen must use two columns");
assert.match(stylesSource, /\.phone-shell-expanded \.critical-responsive-grid[\s\S]*grid-template-columns/, "expanded critical screen must use two columns");
assert.match(stylesSource, /\.phone-shell-expanded \.today-responsive-grid \{[^}]*repeat\(2, minmax\(0, 1fr\)\)[^}]*gap: 0/, "today panes must split exactly at the fold");
assert.match(stylesSource, /\.phone-shell-expanded \.critical-responsive-grid \{[^}]*repeat\(2, minmax\(0, 1fr\)\)[^}]*gap: 0/, "critical panes must split exactly at the fold");
assert.match(stylesSource, /\.week-strip \{[^}]*width: 100%[^}]*repeat\(7, minmax\(0, 1fr\)\)/, "week strip must divide the available interface width into seven bounded fractions");
assert.doesNotMatch(stylesSource, /\.day-cell \{[^}]*min-width: 44px/, "week cells must never force the calendar wider than the current interface");
assert.match(stylesSource, /\.day-cell \{[^}]*min-width: 0[^}]*width: 100%[^}]*max-width: 100%/, "every week cell must remain bounded by its fractional column");
assert.match(appSource, /ratio >= 0\.68/, "fold state must be detected from the relative window aspect ratio");
assert.match(appSource, /className={`native-app/, "native APK must render one full-window device rather than the dual desktop simulator");
assert.match(stylesSource, /\.native-app \{[\s\S]*width: 100vw;[\s\S]*height: 100dvh;/, "native shell must follow the current window dimensions");
assert.match(stylesSource, /\.native-app\.native-expanded[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, "unfolded layout must split panes by relative fractions");
assert.match(activitySource, /onConfigurationChanged[\s\S]*deliverWindowLayout/, "fold configuration changes must be delivered without restarting the activity");
assert.match(manifestSource, /android:resizeableActivity="true"/, "Android activity must be resizeable on foldables");
assert.match(manifestSource, /android\.permission\.RECORD_AUDIO/, "Android APK must declare microphone access");
assert.match(activitySource, /requestPermissions\(new String\[\]\{Manifest\.permission\.RECORD_AUDIO\}, REQUEST_MICROPHONE\)/, "microphone permission must be requested at runtime");
assert.match(activitySource, /onRequestPermissionsResult[\s\S]*offlineSpeechEngine\.start/, "offline speech recognition must continue after microphone permission is granted");
assert.match(activitySource, /RESOURCE_AUDIO_CAPTURE[\s\S]*RECORD_AUDIO/, "WebView audio capture must be gated by the Android permission");
assert.ok(appSource.indexOf("window.JinkeAndroid?.startSpeechRecognition") < appSource.indexOf("const Recognition = window.SpeechRecognition"), "native APK must prefer the ColorOS speech bridge over WebView speech recognition");
assert.doesNotMatch(activitySource, /RecognizerIntent|ACTION_RECOGNIZE_SPEECH/, "native speech must not depend on an optional system recognition service");
assert.match(appSource, /JINKE_NATIVE_SPEECH_PARTIAL/, "offline partial recognition must update the assistant transcript");
assert.match(appSource, /JINKE_NATIVE_SPEECH_STATUS/, "offline model and permission states must be visible in the assistant");
assert.doesNotMatch(screensSource, /使用示例/, "the listening sheet must offer cancellation instead of injecting a demo command");
assert.match(screensSource, /onClick=\{onClose\}>取消<\/button>[\s\S]*停止并处理/, "cancel must be available beside stop-and-process");
assert.match(appSource, /cancelSpeechRecognition/, "canceling the voice sheet must discard the native recognition session");
assert.match(screensSource, /composer-input[\s\S]*onFocus=\{onUseInputMethod\}/, "the focused field must expose the current keyboard's higher-accuracy dictation path");
assert.doesNotMatch(activitySource, /showSoftKeyboard|InputMethodManager\.SHOW_IMPLICIT/, "the APK must rely on normal focused-input IME behavior without a duplicate keyboard trigger");
assert.match(appSource, /useInputMethodVoice[\s\S]*cancelSpeechRecognition[\s\S]*recognitionRef\.current\.abort/, "switching to input-method dictation must release the offline microphone first");
assert.doesNotMatch(appSource, /parseVoiceCommand\(transcript \|\| VOICE_EXAMPLE/, "an empty recognition result must never silently execute the demo command");
assert.match(appSource, /commandResult\("invalid", "没有识别到内容"/, "empty recognition must produce an explicit retry state");
assert.match(appSource, /task\.span[\s\S]*spanRole:\s*"start"[\s\S]*spanRole:\s*"end"/, "multi-day voice ranges must create linked departure and return DDL records");
assert.doesNotMatch(appSource, /task\.note \|\| "语音创建"/, "voice creation must not inject a default note");
assert.match(screensSource, /function PermissionsScreen\(\{ capabilities/, "permission screen must render native capability data");
assert.doesNotMatch(screensSource, /已加入 ColorOS 白名单|\["通知权限"[^\n]*"已开启"/, "permission screen must never claim static system authorization");
assert.doesNotMatch(screensSource, /sherpa-onnx|Zipformer/, "voice settings must not claim unbundled recognizers or models");
assert.match(screensSource, /Vosk Offline[\s\S]*vosk-model-small-cn-0\.22[\s\S]*Vosk Android 0\.3\.75/, "voice settings must describe the engine and model actually packaged in the APK");
assert.match(primitivesSource, /function SwipeTaskActions[\s\S]*swipe-edit[\s\S]*编辑[\s\S]*swipe-delete[\s\S]*删除/, "every task row must expose edit and delete after a left swipe");
assert.match(stylesSource, /\.swipe-actions[^{]*\{[^}]*inset: 0[^}]*padding-left: calc\(60% \+ 6px\)[^}]*gap: 6px[^}]*background: transparent/, "swipe actions must expose a real transparent gap instead of a filler patch");
assert.match(stylesSource, /\.swipe-action[^{]*\{[^}]*border-radius: var\(--radius-md\)/, "daily and critical swipe actions must use matching independent rounded controls");
assert.match(primitivesSource, /closeFromOutside[\s\S]*document\.addEventListener\("pointerdown"/, "tapping outside an open swipe row must close it");
assert.match(primitivesSource, /sheet-drag-handle[\s\S]*onPointerMove=\{onHandlePointerMove\}[\s\S]*finishHandleGesture/, "every bottom sheet handle must support direct downward dragging");
assert.match(stylesSource, /@keyframes sheet-arrive[\s\S]*?translateY\(100%\)/, "bottom sheets must enter from the bottom edge");
assert.match(stylesSource, /@keyframes sheet-dismiss[\s\S]*?translateY\(calc\(100% \+ 24px\)\)/, "bottom sheets must leave toward the bottom edge");
assert.match(appSource, /secondaryBackTarget === "more"[\s\S]*setOverlay\("more"\)/, "menu child screens must return to the menu sheet instead of the main screen");
assert.match(appSource, /jinke-seed-migration-v2[\s\S]*legacyDailyIds[\s\S]*legacyCriticalIds/, "upgrades must remove legacy built-in task seeds while preserving custom entries");
assert.match(appSource, /jinke-voice-note-migration-v3[\s\S]*replace\(\/\^语音创建/, "upgrades must remove the old synthetic voice-created note label");
assert.match(screensSource, /左滑删除演示，点下方语音键创建第一项日程/, "daily demo must guide the first real task");
assert.match(screensSource, /左滑删除演示，点下方语音键创建第一个 DDL/, "DDL demo must guide the first real deadline");
assert.match(appSource, /const handleNativeBack[\s\S]*if \(overlay\)[\s\S]*if \(secondary\)[\s\S]*viewMode === "month"[\s\S]*activeTab === "critical"[\s\S]*window\.JINKE_NATIVE_BACK/, "native back must unwind the in-app navigation hierarchy");
assert.match(activitySource, /JINKE_NATIVE_BACK[\s\S]*performDefaultBack/, "ColorOS edge-back must ask the app before exiting");
assert.doesNotMatch(screensSource, />临时检视</, "view menu must not show an auxiliary title");
assert.doesNotMatch(screensSource, />更多<\/h2>/, "more sheet must not show a brand title");
assert.match(screensSource, /onOpenReminders[\s\S]*<button[^>]*aria-label="打开关键提醒设置"/, "critical bell must open critical reminder settings");
assert.match(appSource, /const \[ddlReminderTime, setDdlReminderTime\]/, "DDL reminder time must use shared application state");
assert.match(screensSource, /function CriticalReminderScreen[\s\S]*<TimePicker label="默认提醒时刻"/, "the default critical reminder time must be editable");
assert.match(screensSource, /<Stepper label="默认间隔天数"/, "the default critical reminder multiple must be editable");
assert.match(screensSource, /<Stepper label="默认最后每天提醒天数"/, "the default final daily reminder window must be editable");
assert.doesNotMatch(screensSource, /锁屏、精确闹钟与后台运行/, "notification permission helper copy must be removed");
assert.match(appSource, /displayedDeadlineTasks = criticalTasks\s*\.filter\(\(task\) => task\.deadline\)/, "today must keep every unfinished DDL task regardless of reminder cadence");
assert.match(screensSource, /const withDDL = tasks\.filter\(\(task\) => task\.deadline\)/, "critical list must keep every DDL task regardless of reminder cadence");
assert.match(screensSource, /reminderTasks = tasks\.filter\(\(task\) => task\.deadline && shouldRemindCritical\(task\.daysLeft, task\)\)/, "cadence filtering must be isolated to notifications and use each task's independent plan");
assert.match(screensSource, /今天不提醒[\s\S]*DDL 仍保留在今日与关键列表/, "zero reminder nodes must suppress the notification while preserving both lists");
assert.match(screensSource, /ON_THIS_DAY_REQUESTS/, "dual simulators must coalesce archive requests");
assert.doesNotMatch(screensSource, /onthisday\/all\//, "archive must not download every category at once");
assert.match(screensSource, /id: "people", label: "人物纪念"/, "births and deaths must share one people tab");
assert.doesNotMatch(screensSource, /label: "人物诞辰"|label: "逝世纪念"/, "duplicate people tabs must be removed");
assert.match(screensSource, /\["version", "版本更新", "update"\][\s\S]*\["settings", "设置", "settings"\]/, "version checker must appear above settings");
assert.match(screensSource, /api\.github\.com\/repos\/\$\{JINKE_GITHUB_REPOSITORY\}\/releases\/latest/, "version checker must read the latest GitHub release");
assert.match(screensSource, /JinkeAndroid\?\.installApk/, "Android build must hand APK installation to the native bridge");
assert.match(indexSource, /\.\/app-bundle\.js/, "file and WebView startup must use the precompiled application bundle");
assert.doesNotMatch(indexSource, /fetch\(file\)|Babel\.transform|window\.eval/, "file startup must not fetch or compile JSX at runtime");
assert.match(appSource, /const \[renewDays, setRenewDays\] = useState\(7\)/, "renewal must default to seven days");
assert.match(screensSource, /<Stepper label="续期天数"/, "renewal days must be editable");
assert.match(screensSource, /function WeekdayPicker[\s\S]*WEEKDAY_BUTTONS\.map/, "repeat editing must use a seven-day multi-select control");
assert.match(screensSource, /repeatLabelFromDays\(next\)/, "weekday selections must automatically derive their schedule label");
assert.match(screensSource, /function ReminderPicker[\s\S]*Math\.min\(1435/, "daily reminder editing must enforce a sub-24-hour five-minute limit");
assert.match(screensSource, /label=\{`\$\{label\}分钟`\}[\s\S]*max=\{55\} step=\{5\}/, "clock minutes must advance in five-minute steps");
assert.match(screensSource, /label="提前分钟"[\s\S]*max=\{55\} step=\{5\}/, "reminder minutes must advance in five-minute steps");
assert.match(screensSource, /function Stepper\([^)]*wrap = false[\s\S]*wrap && safeValue <= min \? max[\s\S]*wrap && safeValue >= max \? min/, "time steppers must support cyclic boundaries");
assert.match(screensSource, /label=\{`\$\{label\}小时`\}[\s\S]*max=\{24\} wrap/, "clock hours must expose both 0 and 24 and loop between them");
assert.match(screensSource, /label=\{`\$\{label\}分钟`\}[\s\S]*step=\{5\} wrap/, "clock minutes must loop between 0 and 55");
assert.match(stylesSource, /-webkit-tap-highlight-color:\s*transparent/, "WebView must suppress the Android system tap rectangle");
assert.match(stylesSource, /\.reminder-time-card\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, "phone DDL reminder time must use a non-overflowing single column");
assert.match(stylesSource, /\.reminder-rule-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, "phone DDL reminder rules must stack without horizontal overflow");
assert.match(stylesSource, /\.phone-shell-expanded \.critical-reminder-screen \.reminder-rule-grid\s*\{[^}]*repeat\(2/, "expanded devices may restore the two-column reminder rule layout");
assert.match(screensSource, /key:\s*"background"[\s\S]*backgroundConfigured\s*\?\s*"已配置"\s*:\s*"点击管理"/, "ColorOS background management must report live or neutral state instead of a false failure");
assert.doesNotMatch(screensSource, /<input[^>]*value=\{(?:editableTask|draft)\.repeat\}/, "repeat must never summon a text keyboard");
assert.doesNotMatch(screensSource, /<input[^>]*value=\{(?:editableTask|draft)\.reminder/, "reminder must never summon a text keyboard");
assert.doesNotMatch(screensSource, /<select|type="(?:number|date|time)"/, "all finite choices must use the app's own controls instead of native Android pickers");
assert.match(screensSource, /function DatePicker[\s\S]*截止年份[\s\S]*截止月份[\s\S]*截止日期/, "deadline editing must use a custom date control");
assert.match(screensSource, /label="截止月份"[\s\S]{0,140}wrap[\s\S]*label="截止日期"[\s\S]{0,140}wrap/, "deadline month and day controls must loop");
assert.match(screensSource, /finalDaysMax = deadlineDaysFromToday[\s\S]*max=\{finalDaysMax\} wrap/, "the final-days reminder limit must follow the actual remaining date span and loop");
assert.match(screensSource, /function DeadlineLeadPicker[\s\S]*截止时刻前[\s\S]*截止前小时[\s\S]*截止前分钟/, "deadline-only reminders with a deadline time must edit a lead-time offset");
assert.match(screensSource, /renew-panel[\s\S]*renew-controls[\s\S]*确认续期/, "renewal controls must use a dedicated non-overflowing panel");
assert.match(primitivesSource, /function DailyTaskRow[\s\S]*onClick=\{\(\) => onToggle\(task\.id\)\}/, "tapping a daily task must only toggle completion");
assert.match(primitivesSource, /function CriticalTaskRow[\s\S]*onClick=\{\(\) => onToggle\(task\.id\)\}/, "tapping a critical task must only toggle completion");
assert.doesNotMatch(primitivesSource, /task-time-edit|task-edit-button/, "task bodies must not retain hidden click-to-edit affordances");
assert.match(appSource, /displayedDailyTasks = dailyTasks\s*\.filter\(\(task\) => taskOccursOnDate\(task, selectedDateKey, todayDateKey\)\)/, "daily list must be filtered by the selected date and current system-day schedule");

const ambiguous = route("调整所有安排");
assert.notEqual(ambiguous.intent, "create", "unclear action must never create a task");
assert.equal(ambiguous.valid, false, "unclear action must request clarification");

console.log(`voice router: ${cases.length + 1} cases passed`);
