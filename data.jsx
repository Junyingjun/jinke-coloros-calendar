window.APP_NAME = "今刻";
window.APP_SLUG = "jinke";

const CALENDAR_SPECIAL_DAYS = {
  "2026-08-23": "处暑",
  "2026-09-07": "白露",
  "2026-09-23": "秋分",
};

const SEASONAL_PHASES = [
  { start: "2026-08-23", end: "2026-08-27", short: "处暑一候", full: "处暑一候 · 鹰乃祭鸟" },
  { start: "2026-08-28", end: "2026-09-01", short: "处暑二候", full: "处暑二候 · 天地始肃" },
  { start: "2026-09-02", end: "2026-09-06", short: "处暑三候", full: "处暑三候 · 禾乃登" },
];

const SOLAR_FESTIVALS = {
  "1-1": "元旦",
  "3-8": "妇女节",
  "5-1": "劳动节",
  "6-1": "儿童节",
  "10-1": "国庆节",
};

const LUNAR_FESTIVALS = {
  "正月-1": "春节",
  "正月-15": "元宵节",
  "五月-5": "端午节",
  "七月-7": "七夕",
  "七月-15": "中元节",
  "八月-15": "中秋节",
  "九月-9": "重阳节",
  "腊月-8": "腊八节",
};

function lunarDayLabel(day) {
  if (day <= 10) return ["", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十"][day];
  if (day < 20) return `十${["", "一", "二", "三", "四", "五", "六", "七", "八", "九"][day - 10]}`;
  if (day === 20) return "二十";
  if (day < 30) return `廿${["", "一", "二", "三", "四", "五", "六", "七", "八", "九"][day - 20]}`;
  return "三十";
}

window.getCalendarMarker = function getCalendarMarker(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  const solarKey = `${date.getMonth() + 1}-${date.getDate()}`;
  const solarFestival = SOLAR_FESTIVALS[solarKey];
  const solarTerm = CALENDAR_SPECIAL_DAYS[dateKey];
  const seasonalPhase = SEASONAL_PHASES.find((item) => dateKey >= item.start && dateKey <= item.end);
  try {
    const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month: "long", day: "numeric" }).formatToParts(date);
    const month = parts.find((part) => part.type === "month")?.value;
    const day = Number(parts.find((part) => part.type === "day")?.value);
    if (!month || !day) throw new Error("Chinese calendar unavailable");
    const lunarFestival = LUNAR_FESTIVALS[`${month}-${day}`];
    const lunarDate = `农历${month}${lunarDayLabel(day)}`;
    const headline = solarFestival || solarTerm || lunarFestival;
    return {
      short: headline || `${lunarDate}${seasonalPhase ? ` · ${seasonalPhase.short}` : ""}`,
      full: headline ? `${headline} · ${lunarDate}` : `${lunarDate}${seasonalPhase ? ` · ${seasonalPhase.full}` : ""}`,
      source: headline ? "中国节日与历法" : "中国农历与七十二候",
    };
  } catch {
    return { short: solarFestival || solarTerm || "今日历法", full: solarFestival || solarTerm || "今日历法", source: "中国公历" };
  }
};

window.normalizeCriticalReminderPlan = function normalizeCriticalReminderPlan(
  task = {},
  defaultTime = window.JINKE_DDL_REMINDER_TIME || "10:00",
  defaultMultiple = window.JINKE_DDL_REMINDER_MULTIPLE || 5,
  defaultFinalDays = window.JINKE_DDL_REMINDER_FINAL_DAYS || 5,
) {
  const source = task && typeof task === "object" ? task : {};
  const reminderTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(source.reminderTime || "") ? source.reminderTime : defaultTime;
  const reminderMode = source.reminderMode === "daily"
    ? "final-days"
    : ["smart", "final-days", "deadline-only"].includes(source.reminderMode) ? source.reminderMode : "smart";
  const deadlineMinutes = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(source.deadlineTime || "")
    ? Number(source.deadlineTime.slice(0, 2)) * 60 + Number(source.deadlineTime.slice(3))
    : null;
  const reminderMinutes = Number(reminderTime.slice(0, 2)) * 60 + Number(reminderTime.slice(3));
  const inferredLeadMinutes = deadlineMinutes === null || reminderMinutes > deadlineMinutes ? 0 : deadlineMinutes - reminderMinutes;
  const deadlineLeadMinutes = Math.min(1435, Math.max(0,
    source.deadlineLeadMinutes !== undefined && source.deadlineLeadMinutes !== null
      ? Math.round((Number(source.deadlineLeadMinutes) || 0) / 5) * 5
      : inferredLeadMinutes,
  ));
  return {
    reminderEnabled: typeof source.reminderEnabled === "boolean" ? source.reminderEnabled : Boolean(source.deadline),
    reminderTime,
    reminderMode,
    reminderMultiple: Math.max(1, Number(source.reminderMultiple) || Number(defaultMultiple) || 5),
    reminderFinalDays: Math.max(0, source.reminderFinalDays !== undefined && source.reminderFinalDays !== null ? Number(source.reminderFinalDays) || 0 : Number(defaultFinalDays) || 0),
    deadlineLeadMinutes,
  };
};

window.getCriticalReminderTriggerTime = function getCriticalReminderTriggerTime(taskOrPlan = {}) {
  const plan = window.normalizeCriticalReminderPlan(taskOrPlan);
  if (plan.reminderMode !== "deadline-only" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(taskOrPlan.deadlineTime || "")) return plan.reminderTime;
  const deadlineMinutes = Number(taskOrPlan.deadlineTime.slice(0, 2)) * 60 + Number(taskOrPlan.deadlineTime.slice(3));
  const triggerMinutes = (deadlineMinutes - plan.deadlineLeadMinutes + 1440) % 1440;
  return `${String(Math.floor(triggerMinutes / 60)).padStart(2, "0")}:${String(triggerMinutes % 60).padStart(2, "0")}`;
};

window.getCriticalReminderDayOffset = function getCriticalReminderDayOffset(taskOrPlan = {}) {
  const plan = window.normalizeCriticalReminderPlan(taskOrPlan);
  if (plan.reminderMode !== "deadline-only" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(taskOrPlan.deadlineTime || "")) return 0;
  const deadlineMinutes = Number(taskOrPlan.deadlineTime.slice(0, 2)) * 60 + Number(taskOrPlan.deadlineTime.slice(3));
  return deadlineMinutes - plan.deadlineLeadMinutes < 0 ? 1 : 0;
};

window.shouldRemindCritical = function shouldRemindCritical(daysLeft, planOrMultiple, finalDays) {
  if (!Number.isFinite(daysLeft) || daysLeft < 0) return false;
  if (planOrMultiple && typeof planOrMultiple === "object") {
    const plan = window.normalizeCriticalReminderPlan(planOrMultiple);
    if (!plan.reminderEnabled) return false;
    if (plan.reminderMode === "final-days") return daysLeft <= plan.reminderFinalDays;
    if (plan.reminderMode === "deadline-only") return daysLeft === window.getCriticalReminderDayOffset(planOrMultiple);
    return daysLeft <= plan.reminderFinalDays || daysLeft % plan.reminderMultiple === 0;
  }
  const safeMultiple = Math.max(1, Number(planOrMultiple) || window.JINKE_DDL_REMINDER_MULTIPLE || 5);
  const safeFinalDays = Math.max(0, finalDays !== undefined && finalDays !== null ? Number(finalDays) || 0 : window.JINKE_DDL_REMINDER_FINAL_DAYS || 0);
  return daysLeft <= safeFinalDays || daysLeft % safeMultiple === 0;
};

window.getCriticalReminder = function getCriticalReminder(
  taskOrPlan = {},
  defaultTime = window.JINKE_DDL_REMINDER_TIME || "10:00",
  defaultMultiple = window.JINKE_DDL_REMINDER_MULTIPLE || 5,
  defaultFinalDays = window.JINKE_DDL_REMINDER_FINAL_DAYS || 5,
) {
  const plan = window.normalizeCriticalReminderPlan(
    taskOrPlan && typeof taskOrPlan === "object" ? taskOrPlan : {},
    defaultTime,
    defaultMultiple,
    defaultFinalDays,
  );
  if (!plan.reminderEnabled) return "不提醒";
  if (plan.reminderMode === "final-days") return `仅最后 ${plan.reminderFinalDays} 天 · ${plan.reminderTime}`;
  if (plan.reminderMode === "deadline-only" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(taskOrPlan.deadlineTime || "")) {
    const hours = Math.floor(plan.deadlineLeadMinutes / 60);
    const minutes = plan.deadlineLeadMinutes % 60;
    const lead = `${hours ? `${hours} 小时` : ""}${hours && minutes ? " " : ""}${minutes || !hours ? `${minutes} 分钟` : ""}`;
    return `截止时刻前 ${lead}`;
  }
  if (plan.reminderMode === "deadline-only") return `仅截止日 ${plan.reminderTime}`;
  return `每 ${plan.reminderMultiple} 天 · 最后 ${plan.reminderFinalDays} 天每天 · ${plan.reminderTime}`;
};

const CALENDAR_WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const REPEAT_WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

window.repeatDaysFromValue = function repeatDaysFromValue(value, explicitDays) {
  if (Array.isArray(explicitDays)) return [...new Set(explicitDays.map(Number).filter((day) => day >= 1 && day <= 7))].sort((a, b) => a - b);
  const text = String(value || "");
  if (text === "每天") return [1, 2, 3, 4, 5, 6, 7];
  if (text === "工作日") return [1, 2, 3, 4, 5];
  if (text === "周末" || text === "周六、日") return [6, 7];
  if (text === "仅一次") return [];
  const days = [];
  REPEAT_WEEKDAYS.forEach((label, index) => {
    if (text.includes(label) && !days.includes(index + 1)) days.push(index + 1);
  });
  return days;
};

window.repeatLabelFromDays = function repeatLabelFromDays(days) {
  const normalized = window.repeatDaysFromValue("", days);
  const key = normalized.join(",");
  if (!key) return "仅一次";
  if (key === "1,2,3,4,5,6,7") return "每天";
  if (key === "1,2,3,4,5") return "工作日";
  if (key === "6,7") return "周末";
  return `周${normalized.map((day) => REPEAT_WEEKDAYS[day - 1]).join("、")}`;
};

window.taskOccursOnDate = function taskOccursOnDate(task, dateKey, fallbackDateKey = window.APP_DATA?.today?.dateKey) {
  if (task?.activeFrom && dateKey < task.activeFrom) return false;
  if (task?.activeUntil && dateKey > task.activeUntil) return false;
  const days = window.repeatDaysFromValue(task?.repeat, task?.repeatDays);
  if (!days.length) return (task?.scheduledDateKey || task?.dateKey || fallbackDateKey) === dateKey;
  const date = parseCalendarDateKey(dateKey);
  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  return days.includes(weekday);
};

window.normalizeCriticalCompletion = function normalizeCriticalCompletion(task, fallbackDateKey = window.APP_DATA?.today?.dateKey) {
  const done = Boolean(task?.done || task?.status === "completed");
  if (!done) return { ...task, done: false, status: task?.status === "completed" ? "active" : (task?.status || "active") };
  return {
    ...task,
    done: true,
    status: "completed",
    completedDateKey: task.completedDateKey || fallbackDateKey,
    progressBeforeCompletion: Number.isFinite(task.progressBeforeCompletion) ? task.progressBeforeCompletion : (Number(task.progress) || 0),
    progress: 100,
  };
};

window.completeCriticalForDate = function completeCriticalForDate(task, dateKey) {
  if (task?.done && task?.completedDateKey) return window.normalizeCriticalCompletion(task, dateKey);
  return window.normalizeCriticalCompletion({
    ...task,
    done: true,
    status: "completed",
    completedDateKey: dateKey,
    completedAt: new Date().toISOString(),
    progressBeforeCompletion: Number(task?.progress) || 0,
    progress: 100,
  }, dateKey);
};

window.moveCriticalCompletion = function moveCriticalCompletion(task, dateKey, requestedTime) {
  if (!task?.done || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return { ...task };
  const previous = task.completedAt ? new Date(task.completedAt) : new Date();
  const fallbackHour = Number.isNaN(previous.getTime()) ? new Date().getHours() : previous.getHours();
  const fallbackMinute = Number.isNaN(previous.getTime()) ? new Date().getMinutes() : previous.getMinutes();
  const timeMatch = String(requestedTime || "").match(/^(\d{1,2}):(\d{2})$/);
  const hour = timeMatch ? Math.min(23, Math.max(0, Number(timeMatch[1]))) : fallbackHour;
  const minute = timeMatch ? Math.min(59, Math.max(0, Number(timeMatch[2]))) : fallbackMinute;
  const [year, month, day] = dateKey.split("-").map(Number);
  return {
    ...task,
    completedDateKey: dateKey,
    completedAt: new Date(year, month - 1, day, hour, minute, 0, 0).toISOString(),
    completionKey: `${task.id}:${dateKey}`,
  };
};

window.uncompleteCriticalTask = function uncompleteCriticalTask(task) {
  const { completedDateKey, completedAt, completionKey, progressBeforeCompletion, ...rest } = task || {};
  return {
    ...rest,
    done: false,
    status: "active",
    progress: Number.isFinite(progressBeforeCompletion) ? progressBeforeCompletion : (Number(rest.progress) || 0),
  };
};

window.criticalTaskVisibleOnTodayDate = function criticalTaskVisibleOnTodayDate(task, dateKey) {
  if (task?.done) return task.completedDateKey === dateKey;
  return Boolean(task?.deadline);
};

window.countScheduledTasksOnDate = function countScheduledTasksOnDate(dailyTasks = [], criticalTasks = [], dateKey, fallbackDateKey = window.APP_DATA?.today?.dateKey) {
  const dailyLoad = dailyTasks.filter((task) => window.taskOccursOnDate(task, dateKey, fallbackDateKey)).length;
  const target = parseCalendarDateKey(dateKey);
  const deadlineLoad = criticalTasks.filter((task) => {
    if (task?.done) return task.completedDateKey === dateKey;
    if (!task?.deadline || !Number.isFinite(task.daysLeft)) return false;
    const anchor = parseCalendarDateKey(task.anchorDateKey || fallbackDateKey);
    const elapsedDays = Math.round((target.getTime() - anchor.getTime()) / 86400000);
    return task.daysLeft - elapsedDays === 0;
  }).length;
  return dailyLoad + deadlineLoad;
};

function parseCalendarDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function calendarDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

window.getDateMeta = function getDateMeta(dateKey) {
  const date = parseCalendarDateKey(dateKey);
  return {
    dateKey,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    date: date.getDate(),
    day: CALENDAR_WEEKDAYS[date.getDay()],
  };
};

window.getWeekDates = function getWeekDates(dateKey) {
  const selected = parseCalendarDateKey(dateKey);
  const mondayOffset = (selected.getDay() + 6) % 7;
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = calendarDateKey(date);
    return window.getDateMeta(key);
  });
};

window.getMonthDates = function getMonthDates(dateKey) {
  const selected = parseCalendarDateKey(dateKey);
  const year = selected.getFullYear();
  const monthIndex = selected.getMonth();
  const first = new Date(year, monthIndex, 1, 12);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = calendarDateKey(date);
    return {
      ...window.getDateMeta(key),
      muted: date.getMonth() !== monthIndex,
    };
  });
};

window.shiftDateKeyByMonth = function shiftDateKeyByMonth(dateKey, offset) {
  const selected = parseCalendarDateKey(dateKey);
  const targetMonth = new Date(selected.getFullYear(), selected.getMonth() + offset, 1, 12);
  const lastDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 12).getDate();
  targetMonth.setDate(Math.min(selected.getDate(), lastDate));
  return calendarDateKey(targetMonth);
};

window.shiftDateKeyByDays = function shiftDateKeyByDays(dateKey, offset) {
  const selected = parseCalendarDateKey(dateKey);
  selected.setDate(selected.getDate() + Number(offset || 0));
  return calendarDateKey(selected);
};

const STARTUP_DATE = new Date();
const STARTUP_DATE_KEY = calendarDateKey(STARTUP_DATE);
const STARTUP_DATE_META = window.getDateMeta(STARTUP_DATE_KEY);
const STARTUP_WEEK = window.getWeekDates(STARTUP_DATE_KEY);

window.APP_DATA = {
  today: {
    date: `${STARTUP_DATE_META.month}月${STARTUP_DATE_META.date}日`,
    dateKey: STARTUP_DATE_KEY,
    weekday: `星期${STARTUP_DATE_META.day}`,
    solar: window.getCalendarMarker(STARTUP_DATE_KEY).short,
  },
  week: STARTUP_WEEK.map((item) => ({
    day: item.day,
    date: item.date,
    dateKey: item.dateKey,
    today: item.dateKey === STARTUP_DATE_KEY,
    active: item.dateKey === STARTUP_DATE_KEY,
  })),
  dailyTasks: [
    { id: "demo-daily", demo: true, activeFrom: STARTUP_DATE_KEY, time: "09:00", title: "演示：每天喝水", note: "向左滑动可编辑或删除", repeat: "每天", repeatDays: [1, 2, 3, 4, 5, 6, 7], reminder: "到点提醒", alertMode: "inherit", soundId: "inherit", done: false },
  ],
  criticalTasks: [
    { id: "demo-ddl", demo: true, title: "演示：完成第一个 DDL", note: "向左滑动可编辑或删除", deadline: "7天后", daysLeft: 7, deadlineTime: null, reminderEnabled: true, reminderTime: "10:00", reminderMode: "smart", reminderMultiple: 5, reminderFinalDays: 5, reminder: "每 5 天 · 最后 5 天每天 · 10:00", alertMode: "inherit", soundId: "inherit", progress: 0 },
  ],
  history: [],
  monthRanking: [],
  yearRanking: [],
  ddlRanking: [],
};
