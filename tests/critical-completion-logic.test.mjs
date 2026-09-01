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

const {
  completeCriticalForDate,
  moveCriticalCompletion,
  uncompleteCriticalTask,
  criticalTaskVisibleOnTodayDate,
  countScheduledTasksOnDate,
} = context.window;

const ddl = { id: "ddl", title: "提交报告", deadline: "9月1日", daysLeft: 6, anchorDateKey: "2026-08-26", progress: 25 };
const noDdl = { id: "focus", title: "整理相机", deadline: null, daysLeft: null, progress: 50 };

assert.equal(criticalTaskVisibleOnTodayDate(ddl, "2026-08-26"), true, "unfinished DDL stays visible in Today");
assert.equal(criticalTaskVisibleOnTodayDate(noDdl, "2026-08-26"), false, "unfinished no-DDL stays only in Critical");

const completedDdl = completeCriticalForDate(ddl, "2026-08-26");
const completedNoDdl = completeCriticalForDate(noDdl, "2026-08-26");
for (const task of [completedDdl, completedNoDdl]) {
  assert.equal(task.done, true);
  assert.equal(task.status, "completed");
  assert.equal(task.completedDateKey, "2026-08-26");
  assert.equal(task.progress, 100);
  assert.equal(criticalTaskVisibleOnTodayDate(task, "2026-08-26"), true, "completed critical task stays on its completion date");
  assert.equal(criticalTaskVisibleOnTodayDate(task, "2026-08-27"), false, "completed critical task must not leak into another date");
}

assert.equal(countScheduledTasksOnDate([], [completedNoDdl], "2026-08-26", "2026-08-26"), 1, "completed no-DDL contributes to the completion day's marker");
assert.equal(countScheduledTasksOnDate([], [completedNoDdl], "2026-08-27", "2026-08-26"), 0, "completed no-DDL does not mark another date");

const restoredDdl = uncompleteCriticalTask(completedDdl);
const restoredNoDdl = uncompleteCriticalTask(completedNoDdl);
assert.equal(restoredDdl.done, false);
assert.equal(restoredDdl.status, "active");
assert.equal(restoredDdl.progress, 25, "undo restores the pre-completion progress");
assert.equal(criticalTaskVisibleOnTodayDate(restoredDdl, "2026-08-26"), true, "restored DDL returns to both Critical and Today");
assert.equal(restoredNoDdl.done, false);
assert.equal(restoredNoDdl.progress, 50);
assert.equal(criticalTaskVisibleOnTodayDate(restoredNoDdl, "2026-08-26"), false, "restored no-DDL returns only to Critical");

const movedCompletion = moveCriticalCompletion(completedNoDdl, "2026-08-24");
assert.equal(movedCompletion.completedDateKey, "2026-08-24", "completed critical tasks can be moved back to the intended date");
assert.equal(movedCompletion.completionKey, "focus:2026-08-24");
assert.equal(criticalTaskVisibleOnTodayDate(movedCompletion, "2026-08-24"), true);
assert.equal(criticalTaskVisibleOnTodayDate(movedCompletion, "2026-08-26"), false);

const appSource = fs.readFileSync(path.join(root, "app.jsx"), "utf8");
const screensSource = fs.readFileSync(path.join(root, "screens.jsx"), "utf8");
const primitivesSource = fs.readFileSync(path.join(root, "primitives.jsx"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const detailStart = screensSource.indexOf("function CriticalDetailSheet");
const detailEnd = screensSource.indexOf("function HistoryScreen");
const detailSource = screensSource.slice(detailStart, detailEnd);
assert.match(appSource, /activeCriticalTasks = currentCriticalTasks\.filter\(\(task\) => !task\.done\)/, "completed tasks must disappear from Critical");
assert.match(appSource, /setCriticalTasks\(\(current\) => current\.map/, "completion must retain the task record instead of deleting it");
assert.doesNotMatch(detailSource, /onComplete|已完成/, "critical editors must not expose a separate completion button");
assert.match(detailSource, /task\.done[\s\S]*设置完成日期[\s\S]*CompletionDatePicker/, "only completed critical editors must expose the custom completion date control");
assert.doesNotMatch(detailSource, /label="完成时刻"|completionTime/, "completion archival must not expose an unnecessary clock control");
assert.match(detailSource, /DatePicker value=\{draft\.deadline\}[\s\S]{0,160}allowPast=\{task\.done\}/, "only completed critical tasks may move their deadline into the past");
assert.match(appSource, /const iso = text\.match\(\/\(\\d\{4\}\)-\(\\d\{2\}\)-\(\\d\{2\}\)\//, "deadline parsing must preserve an explicitly edited historical year");
assert.match(appSource, /editableCriticalDeadline\(storedTask, todayDateKey\)/, "opening an old completed task must reconstruct its original deadline instead of rolling it into next year");
assert.match(primitivesSource, /!task\.done && Number\.isFinite\(task\.daysLeft\) && task\.daysLeft <= 5/, "only unfinished DDL tasks within five days may use the urgent state");
assert.match(screensSource, /!task\.done && Number\.isFinite\(task\.daysLeft\) && task\.daysLeft <= 5/, "the critical editor must use the same five-day urgent boundary");
assert.match(stylesSource, /\.days-left\.urgent\s*\{[^}]*var\(--accent-soft\)[^}]*var\(--accent\)/, "the urgent deadline badge must use the red accent treatment");
assert.doesNotMatch(primitivesSource, /task\.daysLeft <= 0 \? "today"/, "null no-DDL values must never be coerced into the red deadline state");

console.log("critical completion logic: DDL/no-DDL completion date retention and undo passed");
