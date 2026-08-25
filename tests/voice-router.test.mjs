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
const stylesSource = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = appSource.indexOf("const CN_DIGITS");
const end = appSource.indexOf("function useViewportScale");
assert.ok(start >= 0 && end > start, "voice router source markers must exist");

context.APP_DATA = context.window.APP_DATA;
context.getCriticalReminder = context.window.getCriticalReminder;
vm.runInContext(`${appSource.slice(start, end)}\nthis.parseVoiceCommand = parseVoiceCommand;`, context);

const route = (text) => context.parseVoiceCommand(
  text,
  context.APP_DATA.dailyTasks,
  context.APP_DATA.criticalTasks,
);

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

const ambiguous = route("调整所有安排");
assert.notEqual(ambiguous.intent, "create", "unclear action must never create a task");
assert.equal(ambiguous.valid, false, "unclear action must request clarification");

console.log(`voice router: ${cases.length + 1} cases passed`);
