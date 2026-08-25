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
];

for (const [text, intent] of cases) {
  const result = route(text);
  assert.equal(result.intent, intent, `${text} should route to ${intent}`);
  assert.equal(result.valid, true, `${text} should be actionable`);
}

assert.equal(route("清除所有的安排").scope, "all");
assert.equal(route("清除健身").target.task.id, "gym");
assert.equal(route("把健身改到晚上八点").changes.time, "20:00");
assert.equal(route("给旅行证件续期设置下午三点").changes.time, "15:00");
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
assert.match(context.window.getCriticalReminder(null, "09:30"), /09:30/);
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
assert.match(screensSource, /function PermissionsScreen\(\{ capabilities/, "permission screen must render native capability data");
assert.doesNotMatch(screensSource, /已加入 ColorOS 白名单|\["通知权限"[^\n]*"已开启"/, "permission screen must never claim static system authorization");
assert.doesNotMatch(screensSource, /sherpa-onnx|Zipformer/, "voice settings must not claim unbundled recognizers or models");
assert.match(screensSource, /Vosk Offline[\s\S]*vosk-model-small-cn-0\.22[\s\S]*Vosk Android 0\.3\.75/, "voice settings must describe the engine and model actually packaged in the APK");
assert.match(primitivesSource, /function SwipeTaskActions[\s\S]*swipe-edit[\s\S]*编辑[\s\S]*swipe-delete[\s\S]*删除/, "every task row must expose edit and delete after a left swipe");
assert.match(stylesSource, /\.swipe-actions[^{]*\{[^}]*width: 36%/, "swipe actions must be sized relative to the task row");
assert.match(appSource, /jinke-seed-migration-v2[\s\S]*legacyDailyIds[\s\S]*legacyCriticalIds/, "upgrades must remove legacy built-in task seeds while preserving custom entries");
assert.match(screensSource, /左滑删除演示，点下方语音键创建第一项日程/, "daily demo must guide the first real task");
assert.match(screensSource, /左滑删除演示，点下方语音键创建第一个 DDL/, "DDL demo must guide the first real deadline");
assert.match(appSource, /const handleNativeBack[\s\S]*if \(overlay\)[\s\S]*if \(secondary\)[\s\S]*viewMode === "month"[\s\S]*activeTab === "critical"[\s\S]*window\.JINKE_NATIVE_BACK/, "native back must unwind the in-app navigation hierarchy");
assert.match(activitySource, /JINKE_NATIVE_BACK[\s\S]*performDefaultBack/, "ColorOS edge-back must ask the app before exiting");
assert.doesNotMatch(screensSource, />临时检视</, "view menu must not show an auxiliary title");
assert.doesNotMatch(screensSource, />更多<\/h2>/, "more sheet must not show a brand title");
assert.match(screensSource, /onOpenReminders[\s\S]*<button[^>]*aria-label="打开DDL提醒设置"/, "critical bell must open DDL reminder settings");
assert.match(appSource, /const \[ddlReminderTime, setDdlReminderTime\]/, "DDL reminder time must use shared application state");
assert.match(screensSource, /function CriticalReminderScreen[\s\S]*aria-label="DDL 默认提醒时间"/, "DDL reminder time must be editable");
assert.match(screensSource, /aria-label="DDL提醒倍数天数"/, "DDL reminder multiple must be editable");
assert.match(screensSource, /aria-label="DDL最后连续提醒天数"/, "DDL final daily reminder window must be editable");
assert.doesNotMatch(screensSource, /锁屏、精确闹钟与后台运行/, "notification permission helper copy must be removed");
assert.match(appSource, /displayedDeadlineTasks = criticalTasks\s*\.filter\(\(task\) => task\.deadline\)/, "today must keep every unfinished DDL task regardless of reminder cadence");
assert.match(screensSource, /const withDDL = tasks\.filter\(\(task\) => task\.deadline\)/, "critical list must keep every DDL task regardless of reminder cadence");
assert.match(screensSource, /reminderTasks = tasks\.filter\(\(task\) => task\.deadline && shouldRemindCritical\(task\.daysLeft, reminderMultiple, reminderFinalDays\)\)/, "cadence filtering must be isolated to notifications and use editable policy values");
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
assert.match(screensSource, /aria-label="续期天数"/, "renewal days must be editable");
assert.match(screensSource, /const REPEAT_OPTIONS[\s\S]*周一至周五/, "repeat editing must provide a workday preset");
assert.match(screensSource, /<select className="edit-input" value=\{editableTask\.repeat\}/, "voice repeat review must use a choice control");
assert.match(screensSource, /<select className="edit-input" value=\{draft\.repeat\}/, "daily repeat editing must use a choice control");
assert.doesNotMatch(screensSource, /<input[^>]*value=\{(?:editableTask|draft)\.repeat\}/, "repeat must never summon a text keyboard");
assert.doesNotMatch(screensSource, /<input[^>]*value=\{(?:editableTask|draft)\.reminder/, "reminder must never summon a text keyboard");
assert.doesNotMatch(screensSource, /type="number"/, "finite numeric settings must use preset choice controls");
assert.match(screensSource, /type="date"/, "deadline editing must use the system date picker");

const ambiguous = route("调整所有安排");
assert.notEqual(ambiguous.intent, "create", "unclear action must never create a task");
assert.equal(ambiguous.valid, false, "unclear action must request clarification");

console.log(`voice router: ${cases.length + 1} cases passed`);
