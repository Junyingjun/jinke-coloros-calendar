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
    { id: "wake", time: "07:30", title: "起床", note: "喝水、拉开窗帘", repeat: "每天", reminder: "到点提醒", done: true },
    { id: "plan", time: "08:10", title: "整理今日重点", note: "只保留 3 件最重要的事", repeat: "工作日", reminder: "到点提醒", done: true },
    { id: "gym", time: "19:00", title: "健身 45 分钟", note: "力量训练", repeat: "周一、三、五", reminder: "提前 10 分钟", done: false },
    { id: "journal", time: "22:45", title: "写今日日志", note: "记录完成与阻碍", repeat: "每天", reminder: "到点提醒", done: false },
    { id: "sleep", time: "23:30", title: "睡觉", note: "开启专注睡眠", repeat: "每天", reminder: "到点提醒", done: false },
  ],
  criticalTasks: [
    { id: "passport", title: "旅行证件续期", note: "准备证件照和原件", deadline: "今天截止", daysLeft: 0, time: null, reminder: "每5天/最后5天 10:00", progress: 80 },
    { id: "voice-app", title: "完成语音日历第一版", note: "原型、通知策略、离线语音", deadline: "9月8日", daysLeft: 15, time: null, reminder: "每5天/最后5天 10:00", progress: 35 },
    { id: "tax", title: "整理年度税务资料", note: "核对票据与电子记录", deadline: "10月1日", daysLeft: 38, time: null, reminder: "每5天/最后5天 10:00", progress: 10 },
    { id: "autodrive", title: "学习自动驾驶规划算法", note: "每周完成一个主题", deadline: null, daysLeft: null, time: null, reminder: "不定期回顾", progress: 42 },
    { id: "health", title: "安排年度体检", note: "先确认检查项目", deadline: null, daysLeft: null, time: null, reminder: "每周一提醒", progress: 15 },
  ],
  history: [
    { id: "h1", title: "完成家庭网络升级", completed: "8月18日", leadDays: 24 },
    { id: "h2", title: "提交驾照换证材料", completed: "8月9日", leadDays: 17 },
    { id: "h3", title: "整理上半年保险记录", completed: "7月26日", leadDays: 31 },
    { id: "h4", title: "完成个人作品集更新", completed: "7月12日", leadDays: 46 },
  ],
  monthRanking: [
    { label: "起床", value: 94, detail: "29 / 31" },
    { label: "写今日日志", value: 87, detail: "27 / 31" },
    { label: "睡觉", value: 81, detail: "25 / 31" },
    { label: "健身", value: 75, detail: "12 / 16" },
    { label: "整理今日重点", value: 72, detail: "16 / 22" },
  ],
  yearRanking: [
    { label: "起床", value: 92, detail: "336 / 365" },
    { label: "写今日日志", value: 86, detail: "314 / 365" },
    { label: "睡觉", value: 83, detail: "303 / 365" },
    { label: "整理今日重点", value: 78, detail: "203 / 260" },
    { label: "健身", value: 73, detail: "114 / 156" },
  ],
  ddlRanking: [
    ["毕业论文定稿", 86], ["公司年度报告", 72], ["个人作品集更新", 46], ["年度保险整理", 41], ["年度体检预约", 36],
    ["上半年财务归档", 31], ["家庭网络升级", 24], ["旅行路线确认", 21], ["驾照换证材料", 17], ["课程项目提交", 14],
  ].map(([title, days], index) => ({ rank: index + 1, title, days })),
};
