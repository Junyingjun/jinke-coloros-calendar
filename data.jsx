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

window.shouldRemindCritical = function shouldRemindCritical(
  daysLeft,
  multiple = window.JINKE_DDL_REMINDER_MULTIPLE || 5,
  finalDays = window.JINKE_DDL_REMINDER_FINAL_DAYS || 5,
) {
  const safeMultiple = Math.max(1, Number(multiple) || 5);
  const safeFinalDays = Math.max(0, Number(finalDays) || 0);
  return Number.isFinite(daysLeft) && daysLeft >= 0 && (daysLeft <= safeFinalDays || daysLeft % safeMultiple === 0);
};

window.getCriticalReminder = function getCriticalReminder(
  time,
  summaryTime = window.JINKE_DDL_REMINDER_TIME || "10:00",
  multiple = window.JINKE_DDL_REMINDER_MULTIPLE || 5,
  finalDays = window.JINKE_DDL_REMINDER_FINAL_DAYS || 5,
) {
  const cadence = `每${Math.max(1, Number(multiple) || 5)}天/最后${Math.max(0, Number(finalDays) || 0)}天 ${summaryTime}`;
  if (!time || time === "待定") return cadence;
  if (time <= summaryTime) return `当天 ${time}`;
  return `${cadence} · 当天 ${time}`;
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
  const days = window.repeatDaysFromValue(task?.repeat, task?.repeatDays);
  if (!days.length) return (task?.scheduledDateKey || task?.dateKey || fallbackDateKey) === dateKey;
  const date = parseCalendarDateKey(dateKey);
  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  return days.includes(weekday);
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
    const seeded = window.APP_DATA?.week?.find((item) => item.dateKey === key);
    return { ...window.getDateMeta(key), load: seeded?.load ?? ((date.getDate() + index) % 4) };
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
    const seeded = window.APP_DATA?.week?.find((item) => item.dateKey === key);
    return {
      ...window.getDateMeta(key),
      muted: date.getMonth() !== monthIndex,
      load: seeded?.load ?? ((date.getDate() + index) % 4),
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

window.APP_DATA = {
  today: { date: "8月24日", dateKey: "2026-08-24", weekday: "星期一", solar: "处暑一候" },
  week: [
    { day: "一", date: 24, dateKey: "2026-08-24", today: true, active: true, load: 5 },
    { day: "二", date: 25, dateKey: "2026-08-25", load: 3 },
    { day: "三", date: 26, dateKey: "2026-08-26", load: 5 },
    { day: "四", date: 27, dateKey: "2026-08-27", load: 2 },
    { day: "五", date: 28, dateKey: "2026-08-28", load: 4 },
    { day: "六", date: 29, dateKey: "2026-08-29", load: 2 },
    { day: "日", date: 30, dateKey: "2026-08-30", load: 1 },
  ],
  dailyTasks: [
    { id: "demo-daily", demo: true, time: "09:00", title: "演示：每天喝水", note: "向左滑动可编辑或删除", repeat: "每天", repeatDays: [1, 2, 3, 4, 5, 6, 7], reminder: "到点提醒", done: false },
  ],
  criticalTasks: [
    { id: "demo-ddl", demo: true, title: "演示：完成第一个 DDL", note: "向左滑动可编辑或删除", deadline: "7天后", daysLeft: 7, time: null, reminder: "每5天/最后5天 10:00", progress: 0 },
  ],
  history: [],
  monthRanking: [],
  yearRanking: [],
  ddlRanking: [],
};
