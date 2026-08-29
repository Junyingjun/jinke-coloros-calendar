const { useEffect, useRef, useState } = React;
const {
  APP_DATA,
  getCriticalReminder,
  normalizeCriticalReminderPlan,
  repeatDaysFromValue,
  repeatLabelFromDays,
  taskOccursOnDate,
  countScheduledTasksOnDate,
  normalizeCriticalCompletion,
  completeCriticalForDate,
  moveCriticalCompletion,
  uncompleteCriticalTask,
  criticalTaskVisibleOnTodayDate,
  shiftDateKeyByDays,
  PhoneFrame,
  BottomNav,
  Sheet,
  TodayScreen,
  CriticalScreen,
  ViewMenu,
  VoiceComposer,
  DailyEditSheet,
  MoreSheet,
  CriticalDetailSheet,
  CalendarDaySheet,
  HistoryScreen,
  ReportScreen,
  DeleteConfirmSheet,
  PermissionsScreen,
  SettingsScreen,
  CriticalReminderScreen,
  VersionScreen,
  VoiceSettingsScreen,
} = window;
const DOMAIN_NLU = window.JINKE_DOMAIN_NLU;

const BUILT_IN_REMINDER_SOUNDS = [
  { id: "chime", name: "今刻清音", source: "built-in" },
  { id: "bell", name: "轻铃", source: "built-in" },
  { id: "glass", name: "玻璃音", source: "built-in" },
  { id: "pop", name: "短促音", source: "built-in" },
  { id: "soft", name: "柔和提示", source: "built-in" },
];

const PHONE_WIDTH = 430;
const EXPANDED_WIDTH = 860;
const DEVICE_HEIGHT = 956;
const SIMULATOR_GAP = 48;
const SIMULATOR_WIDTH = PHONE_WIDTH + EXPANDED_WIDTH + SIMULATOR_GAP;
const SIMULATOR_HEIGHT = DEVICE_HEIGHT + 34;
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readStoredJson(key, fallback, validator) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (parsed !== null && (!validator || validator(parsed))) return parsed;
  } catch {}
  return fallback;
}

function migrateLegacySeedData() {
  const markerKey = "jinke-seed-migration-v2";
  const legacyDailyIds = new Set(["wake", "plan", "gym", "journal", "sleep"]);
  const legacyCriticalIds = new Set(["passport", "voice-app", "tax", "autodrive", "health"]);
  const legacyHistoryIds = new Set(["h1", "h2", "h3", "h4"]);
  try {
    if (localStorage.getItem(markerKey)) return;

    const storedDaily = JSON.parse(localStorage.getItem("jinke-daily-tasks") || "null");
    if (Array.isArray(storedDaily)) {
      const retained = storedDaily.filter((task) => !legacyDailyIds.has(task.id));
      localStorage.setItem("jinke-daily-tasks", JSON.stringify(retained.length ? retained : APP_DATA.dailyTasks));
    }

    const storedCritical = JSON.parse(localStorage.getItem("jinke-critical-tasks") || "null");
    if (Array.isArray(storedCritical)) {
      const retained = storedCritical.filter((task) => !legacyCriticalIds.has(task.id));
      localStorage.setItem("jinke-critical-tasks", JSON.stringify(retained.length ? retained : APP_DATA.criticalTasks));
    }

    const storedHistory = JSON.parse(localStorage.getItem("jinke-task-history") || "null");
    if (Array.isArray(storedHistory)) {
      const retained = storedHistory.filter((item) => !legacyHistoryIds.has(item.id) && !legacyCriticalIds.has(item.sourceTaskId));
      localStorage.setItem("jinke-task-history", JSON.stringify(retained));
    }

    const storedCompletions = JSON.parse(localStorage.getItem("jinke-daily-completions") || "null");
    if (storedCompletions && typeof storedCompletions === "object" && !Array.isArray(storedCompletions)) {
      const retained = Object.fromEntries(Object.entries(storedCompletions).filter(([key]) => !legacyDailyIds.has(key.split(":")[0])));
      localStorage.setItem("jinke-daily-completions", JSON.stringify(retained));
    }

    localStorage.setItem(markerKey, "1");
  } catch {}
}

migrateLegacySeedData();

function migrateVoiceCreatedNotes() {
  const markerKey = "jinke-voice-note-migration-v3";
  try {
    if (localStorage.getItem(markerKey)) return;
    ["jinke-daily-tasks", "jinke-critical-tasks"].forEach((key) => {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      if (!Array.isArray(stored)) return;
      const cleaned = stored.map((task) => ({
        ...task,
        note: typeof task.note === "string" ? task.note.replace(/^语音创建(?:\s*·\s*)?/, "").trim() : task.note,
      }));
      localStorage.setItem(key, JSON.stringify(cleaned));
    });
    localStorage.setItem(markerKey, "1");
  } catch {}
}

migrateVoiceCreatedNotes();

function dateKeyOffset(fromKey, toKey) {
  const [fromYear, fromMonth, fromDay] = fromKey.split("-").map(Number);
  const [toYear, toMonth, toDay] = toKey.split("-").map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86400000);
}

function dateKeyAddDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(year, month - 1, day + days, 12);
  return localDateKey(next);
}

function criticalDaysLeftOn(task, dateKey, fallbackAnchorKey) {
  if (!Number.isFinite(task?.daysLeft)) return null;
  const anchorKey = task.anchorDateKey || fallbackAnchorKey;
  return task.daysLeft - dateKeyOffset(anchorKey, dateKey);
}

function editableCriticalDeadline(task, todayKey) {
  if (!task?.deadline) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(task.deadline))) return task.deadline;
  const daysLeft = criticalDaysLeftOn(task, todayKey, todayKey);
  return Number.isFinite(daysLeft) ? dateKeyAddDays(todayKey, daysLeft) : task.deadline;
}

function withCriticalReminderDefaults(task) {
  const deadlineTime = task.deadlineTime ?? (task.time && task.time !== "待定" ? task.time : null);
  const normalizedPlan = normalizeCriticalReminderPlan(task);
  const plan = normalizedPlan.reminderMode === "final-days" && Number.isFinite(task.daysLeft)
    ? { ...normalizedPlan, reminderFinalDays: Math.min(Math.max(1, task.daysLeft), Math.max(1, normalizedPlan.reminderFinalDays)) }
    : normalizedPlan;
  const next = { ...task, alertMode: task.alertMode || "inherit", soundId: task.soundId || "inherit", deadlineTime, time: deadlineTime, ...plan };
  return { ...next, reminder: getCriticalReminder(next) };
}

function criticalHistoryEntry(task, completionDateKey, fallbackAnchorKey) {
  const completionKey = `${task.id}:${completionDateKey}`;
  const [, month, day] = completionDateKey.split("-").map(Number);
  return {
    id: `done-${task.id}-${completionDateKey}`,
    completionKey,
    sourceTaskId: task.id,
    title: task.title,
    completed: `${month}月${day}日`,
    completedDateKey: completionDateKey,
    completedAt: task.completedAt || null,
    leadDays: criticalDaysLeftOn(task, completionDateKey, fallbackAnchorKey) || 0,
  };
}

const CN_DIGITS = { "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };

function normalizeSpeechText(value) {
  return DOMAIN_NLU?.normalizeTranscript?.(value) ?? String(value || "").trim();
}

function parseNumber(value) {
  if (DOMAIN_NLU?.parseNumber) return DOMAIN_NLU.parseNumber(value);
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (tens ? CN_DIGITS[tens] : 1) * 10 + (ones ? CN_DIGITS[ones] : 0);
  }
  return value.split("").reduce((total, char) => total * 10 + (CN_DIGITS[char] ?? 0), 0);
}

function parseTime(text) {
  const mention = DOMAIN_NLU?.extractTimeMentions?.(text)?.[0];
  return mention || { value: "待定", source: "", sources: [], period: "", confidence: 0 };
}

function parseTimeRange(text) {
  const connector = text.match(/(?:到|至|直到|—|–|-)/);
  if (!connector) return null;
  const index = connector.index;
  const before = text.slice(0, index);
  const after = text.slice(index + connector[0].length);
  const start = parseTime(before);
  if (!start.source) return null;
  const inheritedPeriod = start.period && !/^(?:凌晨|早上|上午|中午|下午|傍晚|晚上)/.test(after.trim()) ? start.period : "";
  const end = parseTime(`${inheritedPeriod}${after}`);
  if (!end.source) return null;
  const endSources = (end.sources || [end.source]).map((source) => source.replace(new RegExp(`^${inheritedPeriod}`), "")).filter(Boolean);
  return {
    start,
    end,
    source: `${start.source}${connector[0]}${end.source.replace(new RegExp(`^${inheritedPeriod}`), "")}`,
    sources: [...new Set([...(start.sources || [start.source]), ...endSources].filter(Boolean))],
    crossesMidnight: end.value < start.value || start.value.startsWith("24:"),
  };
}

function parseRepeat(text) {
  const range = text.match(/(?:每(?:个)?)?(?:周|星期)([一二三四五六日天])(?:到|至|\-)(?:(?:周|星期))?([一二三四五六日天])(?:每(?:天|日))?/);
  if (range) {
    const start = range[1] === "天" ? "日" : range[1];
    const end = range[2] === "天" ? "日" : range[2];
    if (start === "一" && end === "五") return { value: "工作日", days: [1, 2, 3, 4, 5], source: range[0] };
    const order = ["一", "二", "三", "四", "五", "六", "日"];
    const startIndex = order.indexOf(start);
    const endIndex = order.indexOf(end);
    const days = startIndex >= 0 && endIndex >= startIndex ? order.slice(startIndex, endIndex + 1) : [start, end];
    const numericDays = days.map((day) => ["一", "二", "三", "四", "五", "六", "日"].indexOf(day) + 1).filter(Boolean);
    return { value: repeatLabelFromDays(numericDays), days: numericDays, source: range[0] };
  }
  if (/每(天|日)/.test(text)) return { value: "每天", days: [1, 2, 3, 4, 5, 6, 7], source: text.match(/每(天|日)/)[0] };
  if (/每个?工作日/.test(text)) return { value: "工作日", days: [1, 2, 3, 4, 5], source: text.match(/每个?工作日/)[0] };
  if (/每(个)?周末/.test(text)) return { value: "周末", days: [6, 7], source: text.match(/每(个)?周末/)[0] };
  const match = text.match(/(?:每)?(?:周|星期)([一二三四五六日天、，和及到至\-]+)/);
  if (!match) return { value: "仅一次", days: [], source: "" };
  const days = [];
  for (const char of match[1]) {
    const day = char === "天" ? "日" : char;
    if (/[一二三四五六日]/.test(day) && !days.includes(day)) days.push(day);
  }
  const numericDays = days.map((day) => ["一", "二", "三", "四", "五", "六", "日"].indexOf(day) + 1).filter(Boolean);
  return { value: numericDays.length ? repeatLabelFromDays(numericDays) : "仅一次", days: numericDays, source: match[0] };
}

function parseDeadline(text) {
  const explicitNone = text.match(/(?:无|没有)\s*(?:ddl|deadline|截止(?:日期)?|期限|死线)/i);
  if (explicitNone) return { deadline: null, daysLeft: null, source: explicitNone[0], kind: "explicit-none" };
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const target = new Date(year, month - 1, day, 12);
    if (target.getFullYear() !== year || target.getMonth() !== month - 1 || target.getDate() !== day) {
      return { deadline: null, daysLeft: null, source: iso[0], kind: "invalid" };
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    return { deadline: iso[0], daysLeft: Math.round((target - today) / 86400000), source: iso[0], kind: "absolute-iso" };
  }
  const relative = text.match(/(今天|明天|后天)(?:截止|到期)?/);
  if (relative) {
    const daysLeft = relative[1] === "今天" ? 0 : relative[1] === "明天" ? 1 : 2;
    return { deadline: daysLeft === 0 ? "今天截止" : relative[1], daysLeft, source: relative[0], kind: "relative" };
  }

  const absolute = text.match(/([零〇一二三四五六七八九十两\d]{1,3})月([零〇一二三四五六七八九十两\d]{1,3})[日号]?(?:截止|到期)?/);
  if (!absolute) return { deadline: null, daysLeft: null, source: "", kind: "none" };
  const month = parseNumber(absolute[1]);
  const day = parseNumber(absolute[2]);
  const now = new Date();
  let target = new Date(now.getFullYear(), month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
  const daysLeft = Math.ceil((target - today) / 86400000);
  return { deadline: `${month}月${day}日`, daysLeft, source: absolute[0], kind: "absolute" };
}

function datePointFromDate(target, source) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const normalized = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return {
    deadline: `${normalized.getMonth() + 1}月${normalized.getDate()}日`,
    daysLeft: Math.round((normalized - today) / 86400000),
    source,
    date: normalized,
  };
}

function parseDatePoints(text) {
  const points = [];
  const absolutePattern = /([零〇一二三四五六七八九十两\d]{1,3})月([零〇一二三四五六七八九十两\d]{1,3})[日号]?/g;
  for (const match of text.matchAll(absolutePattern)) {
    const month = parseNumber(match[1]);
    const day = parseNumber(match[2]);
    const now = new Date();
    let target = new Date(now.getFullYear(), month - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
    points.push({ ...datePointFromDate(target, match[0]), index: match.index });
  }

  const relativePattern = /(今天|明天|后天|([零〇一二三四五六七八九十两\d]{1,3})天后)/g;
  for (const match of text.matchAll(relativePattern)) {
    if (points.some((point) => match.index >= point.index && match.index < point.index + point.source.length)) continue;
    const offset = match[1] === "今天" ? 0 : match[1] === "明天" ? 1 : match[1] === "后天" ? 2 : parseNumber(match[2]);
    const target = new Date();
    target.setDate(target.getDate() + offset);
    points.push({ ...datePointFromDate(target, match[0]), index: match.index });
  }

  const weekdayPattern = /((?:本|下)?周)([一二三四五六日天])/g;
  for (const match of text.matchAll(weekdayPattern)) {
    const weekday = match[2] === "天" ? 7 : ["一", "二", "三", "四", "五", "六", "日"].indexOf(match[2]) + 1;
    const now = new Date();
    const todayWeekday = now.getDay() || 7;
    let offset = weekday - todayWeekday;
    if (match[1] === "下周") offset += offset <= 0 ? 7 : 7;
    else if (offset < 0) offset += 7;
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    points.push({ ...datePointFromDate(target, match[0]), index: match.index });
  }
  return points.sort((a, b) => a.index - b.index);
}

function parseTaskSpan(text) {
  const datePoints = parseDatePoints(text);
  const durationMatch = text.match(/(?:待|住|停留|相隔|隔|过|持续)?\s*([零〇一二三四五六七八九十两\d]{1,3})\s*天(?:后)?(?=\s*(?:回|回来|返程|回程|结束))/);
  const durationDays = durationMatch ? Math.max(1, parseNumber(durationMatch[1])) : null;
  const hasSpanLanguage = /(?:去|出发|前往|开始).*(?:回来|返程|回程|结束|回)|(?:从).*(?:到|至)/.test(text);
  if (!hasSpanLanguage || (!durationDays && datePoints.length < 2)) return null;

  const start = datePoints[0] || null;
  let end = datePoints[1] || null;
  if (start && !end && durationDays) {
    const target = new Date(start.date);
    target.setDate(target.getDate() + durationDays);
    end = datePointFromDate(target, `${durationDays}天后`);
  }
  if (!start || !end) return null;

  let subject = text;
  [...datePoints.map((point) => point.source), durationMatch?.[0]].filter(Boolean).forEach((part) => { subject = subject.replace(part, " "); });
  subject = subject
    .replace(/(?:然后|之后|再)?\s*(?:回来|返程|回程|结束|回)/g, " ")
    .replace(/(?:待|住|停留|相隔|隔|过|持续)/g, " ")
    .replace(/(?:我|我们)?\s*(?:要|想|打算|计划)?\s*(?:去|出发去|前往|到)/g, " ")
    .replace(/(?:开始|出发)/g, " ")
    .replace(/[，,。；;！？!?\s]+/g, " ")
    .trim();
  const title = subject ? `${subject}行程` : "行程";
  return { start, end, durationDays, title, original: text };
}

const TASK_ACTION_WORDS = [
  "取消预约", "提交", "打电话", "参加", "领取", "预约", "续期", "复习", "整理", "完成", "准备", "修改", "购买", "学习", "阅读", "跑步", "健身", "睡觉", "起床", "开会", "上课", "体检", "写", "读", "看", "买", "取", "拿", "办", "考",
];

function extractTaskSemantics(rawText, removableParts, durationSource) {
  let title = rawText;
  [...removableParts, durationSource].filter(Boolean).forEach((part) => { title = title.replace(part, " "); });
  title = title
    .replace(/(?:没有|无)\s*(?:ddl|deadline|截止日期|截止|期限|死线)/ig, " ")
    .replace(/(?:有|带|包含)?\s*(?:ddl|deadline|截止日期|截止期限|期限|死线)(?:的)?/ig, " ")
    .replace(/(?:帮我|给我|请)?(?:创建|添加|新增|安排|记下|记一下|提醒我)\s*(?:一个|一条)?/g, " ")
    .replace(/(?:重要|关键|特殊)(?:任务|事项|事件)?|(?:任务|事项|日程)[:：]?/g, " ")
    .replace(/^\s*(?:的\s*)+/, "")
    .replace(/(?:什么时候|何时|哪天|几点|到时候|那个时候|有空的时候|等有空(?:的)?时候)/g, " ")
    .replace(/(?:的)?时候/g, " ")
    .replace(/(?:之前|以前)?(?:截止|到期)/g, " ")
    .replace(/[，,。；;！？!?]+/g, " ")
    .replace(/^\s*(?:我想要?|我要|我需要|我打算|我计划|我准备要?|我希望|麻烦|然后|就是|你帮我|可以帮我)\s*/g, " ")
    .replace(/(?:大概|大约|差不多|可能|最好)\s*/g, " ")
    .replace(/(?:计划|安排|设定|设置|定|放)\s*(?:在|到|为)\s*/g, " ")
    .replace(/^\s*(?:在|于)\s*/g, " ")
    .replace(/\s*(?:一下|一会儿|一会)\s*/g, "")
    .replace(/去(?=考|办|看|买|取|拿|做|参加|提交|领取|预约|体检|健身|开会|上课)/g, "")
    .replace(/(?:的|啊|呀|吧|呢|嘛|啦|咯|呗)+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const action = TASK_ACTION_WORDS.find((word) => title.includes(word)) || "";
  const actionIndex = action ? title.indexOf(action) : -1;
  let object = "";
  if (actionIndex >= 0) {
    const before = title.slice(0, actionIndex).replace(/^(?:给|向|和|跟)/, "").trim();
    const after = title.slice(actionIndex + action.length).replace(/^(?:给|向|到|去)/, "").trim();
    object = after || before;
  }
  return { title: title || "未命名事项", action, object, keywords: [action, object].filter(Boolean) };
}

function formatDailyReminder(totalMinutes) {
  const safe = Math.min(1435, Math.max(0, Math.round((Number(totalMinutes) || 0) / 5) * 5));
  if (safe === 0) return "到点提醒";
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `提前${hours ? `${hours}小时` : ""}${minutes ? `${minutes}分钟` : ""}`;
}

function dailyReminderLeadMinutes(value) {
  const text = String(value || "到点提醒").replace(/\s+/g, "");
  if (text === "不提醒") return null;
  if (text === "到点提醒") return 0;
  const hours = Number(text.match(/提前(\d+)小时/)?.[1] || 0);
  const minutes = Number(text.match(/(\d+)分钟/)?.[1] || 0);
  return Math.min(1435, Math.max(0, hours * 60 + minutes));
}

function parseVoiceTask(rawText) {
  const text = normalizeSpeechText(rawText);
  const span = parseTaskSpan(text);
  const repeat = span ? { value: "仅一次", days: [], source: "" } : parseRepeat(text);
  const withoutRepeat = repeat.source ? text.replace(repeat.source, " ") : text;
  const timeRange = parseTimeRange(withoutRepeat);
  const time = timeRange?.start || parseTime(withoutRepeat);
  const deadline = parseDeadline(text);
  const reminderMatch = text.match(/提前\s*([零〇一二三四五六七八九十两\d]{1,3})\s*(分钟|小时)(?:提醒)?/);
  const reminderAmount = reminderMatch ? parseNumber(reminderMatch[1]) : 0;
  const reminder = reminderMatch ? formatDailyReminder(reminderAmount * (reminderMatch[2] === "小时" ? 60 : 1)) : "到点提醒";
  const withoutReminder = reminderMatch ? text.replace(reminderMatch[0], "") : text;
  const durationMatch = withoutReminder.match(/([零〇一二三四五六七八九十两\d]{1,3})\s*(分钟|小时)/);
  const duration = durationMatch ? `${parseNumber(durationMatch[1])} ${durationMatch[2]}` : "";
  const hasTemporalInstruction = Boolean(span || repeat.source || time.source || deadline.deadline || reminderMatch);
  const isCritical = Boolean(span)
    || deadline.kind === "explicit-none"
    || (!repeat.source && (/(重要|关键|特殊|ddl|deadline|截止|期限|到期|死线)/i.test(text) || deadline.kind === "absolute"))
    || !hasTemporalInstruction;

  const spanSources = span ? [span.start.source, span.end.source] : [];
  const timeSources = timeRange?.sources || time.sources || [time.source];
  const semantics = extractTaskSemantics(text, [reminderMatch?.[0], ...timeSources, repeat.source, deadline.source, ...spanSources], durationMatch?.[0]);
  const noteParts = [];
  if (duration) noteParts.push(`持续 ${duration}`);

  const criticalPlan = normalizeCriticalReminderPlan({ deadline: deadline.deadline, reminderEnabled: Boolean(deadline.deadline) });
  return {
    type: isCritical ? "critical" : "daily",
    title: span?.title || semantics.title,
    time: time.value,
    endTime: timeRange?.end?.value || null,
    spansMidnight: Boolean(timeRange?.crossesMidnight),
    repeat: repeat.source ? repeat.value : (!isCritical && deadline.deadline ? deadline.deadline : repeat.value),
    repeatDays: repeat.days,
    reminder: isCritical ? getCriticalReminder(criticalPlan) : reminder,
    deadline: deadline.deadline,
    deadlineTime: isCritical && time.source ? time.value : null,
    ...(isCritical ? criticalPlan : {}),
    daysLeft: deadline.daysLeft,
    note: noteParts.join(" · "),
    action: semantics.action,
    object: semantics.object,
    keywords: semantics.keywords,
    hasTime: Boolean(time.source),
    hasRepeat: Boolean(repeat.source),
    hasReminder: Boolean(reminderMatch),
    hasDeadline: Boolean(deadline.deadline),
    alertMode: "inherit",
    soundId: "inherit",
    span,
  };
}

function normalizeTaskText(value) {
  return value
    .toLowerCase()
    .replace(/^(?:请|帮我|麻烦|把|给|将)*/, "")
    .replace(/^(?:取消勾选|取消完成|清除|清空|删除|移除|删掉|修改|更改|改名|更名|调整|设置|完成|勾选|标记|整理|安排|学习|写|提交|进行|开始)/, "")
    .replace(/[\d０-９]+\s*(?:分钟|小时|天)/g, "")
    .replace(/[\s\d０-９·。、，,：:（）()\-]/g, "")
    .replace(/[零〇一二三四五六七八九十两百]+(?:分钟|小时|天)?/g, "")
    .replace(/任务|事项|日程|ddl/ig, "");
}

function findMentionedTask(text, dailyTasks, criticalTasks) {
  const haystack = normalizeTaskText(text);
  const candidates = [
    ...dailyTasks.map((task) => ({ kind: "daily", task })),
    ...criticalTasks.map((task) => ({ kind: "critical", task })),
  ];
  let best = null;
  let bestScore = 0;
  let ambiguous = false;
  candidates.forEach((candidate) => {
    const title = normalizeTaskText(candidate.task.title);
    if (!title) return;
    const aliases = [title, title.replace(/^(今天|今日|每天|每日|年度|本周)/, "")].filter((value, index, array) => value.length >= 2 && array.indexOf(value) === index);
    let score = aliases.reduce((highest, alias) => haystack.includes(alias) ? Math.max(highest, alias.length + 20) : highest, 0);
    for (let size = Math.min(6, title.length); size >= 3 && !score; size -= 1) {
      for (let index = 0; index <= title.length - size; index += 1) {
        if (haystack.includes(title.slice(index, index + size))) {
          score = size;
          break;
        }
      }
    }
    if (!score && DOMAIN_NLU?.similarity) {
      const fuzzyScore = DOMAIN_NLU.similarity(haystack, title);
      if (fuzzyScore >= 0.68) score = fuzzyScore * 10;
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
      ambiguous = false;
    } else if (score > 0 && score === bestScore) {
      ambiguous = true;
    }
  });
  return ambiguous ? null : best;
}

function parseDelayDays(text) {
  const match = text.match(/([零〇一二三四五六七八九十两\d]{1,3})\s*(天|日|周|个月|月)/);
  if (!match) return 30;
  const amount = parseNumber(match[1]) || 1;
  if (match[2] === "周") return amount * 7;
  if (match[2].includes("月")) return amount * 30;
  return amount;
}

function deadlineLabelFromDays(days) {
  const target = new Date();
  target.setDate(target.getDate() + Math.max(days, 0));
  return `${target.getMonth() + 1}月${target.getDate()}日`;
}

function commandResult(intent, heading, rows, options = {}) {
  return {
    intent,
    heading,
    rows,
    confirmLabel: options.confirmLabel || "确认执行",
    valid: options.valid !== false,
    error: options.error || "",
    ...options,
  };
}

function parseVoiceCommand(rawText, dailyTasks, criticalTasks) {
  const text = normalizeSpeechText(rawText);
  const domainAnalysis = DOMAIN_NLU?.analyze?.(text) || null;
  const target = findMentionedTask(text, dailyTasks, criticalTasks);
  const wantsCreate = domainAnalysis?.intent?.intent === "create" || /(创建|添加|新增|记下|记一下|提醒我)/.test(text) || /^(?:帮我|请)?安排/.test(text);
  const hasAll = /(全部|所有)/.test(text);
  const arrangementNoun = /(安排|日程|任务|事项)/.test(text);

  if (/(切换|改成|设置|使用|启用).*(暗色|深色|夜间|亮色|浅色|跟随系统|系统主题)|^(暗色|深色|夜间|亮色|浅色|跟随系统|系统主题)(?:模式)?$/.test(text)) {
    const themeMode = /(跟随系统|系统主题)/.test(text) ? "system" : /(亮色|浅色)/.test(text) ? "light" : "dark";
    const themeLabel = themeMode === "system" ? "跟随系统" : themeMode === "light" ? "亮色" : "暗色";
    return commandResult("theme", `切换为${themeLabel}`, [["外观", themeLabel]], { themeMode, confirmLabel: "切换" });
  }

  if (!wantsCreate && /(ddl|deadline|关键事项|关键任务|截止任务).*(默认提醒时间|提醒时间|默认时间)/i.test(text) && /(设置|设为|改为|改到|调整)/.test(text)) {
    const reminderTime = parseTime(text);
    return reminderTime.source
      ? commandResult("set-ddl-reminder-time", "修改 DDL 默认提醒时间", [["时间", reminderTime.value], ["频率", "5 的倍数天；最后 5 天每日"]], { reminderTime: reminderTime.value, confirmLabel: "保存" })
      : commandResult("set-ddl-reminder-time", "没有识别到提醒时间", [["示例", "把 DDL 默认提醒时间改为早上九点"]], { valid: false, error: "请说出具体时间" });
  }

  if (!wantsCreate && /(ddl|deadline|关键事项|关键任务|截止任务).*(倍数|每隔|节点)/i.test(text) && /(设置|设为|改为|改成|调整)/.test(text)) {
    const multiple = parseDelayDays(text);
    return commandResult("set-ddl-reminder-policy", "修改 DDL 提醒倍数", [["倍数节点", `每 ${multiple} 天`]], { policy: "multiple", value: multiple, confirmLabel: "保存" });
  }

  if (!wantsCreate && /(ddl|deadline|关键事项|关键任务|截止任务).*(最后|临近|连续).*提醒/i.test(text) && /(设置|设为|改为|改成|调整)/.test(text)) {
    const finalDays = parseDelayDays(text);
    return commandResult("set-ddl-reminder-policy", "修改 DDL 连续提醒天数", [["临近截止", `最后 ${finalDays} 天`]], { policy: "final-days", value: finalDays, confirmLabel: "保存" });
  }

  const dateSelection = text.match(/(?:切换|打开|查看|前往|去|到)\s*(?:到)?\s*([零〇一二三四五六七八九十两\d]{1,3})[日号]/);
  if (dateSelection) {
    const day = parseNumber(dateSelection[1]);
    const now = new Date();
    const runtimeDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentWeek = window.getWeekDates(runtimeDateKey);
    const dateItem = currentWeek.find((item) => item.date === day);
    const first = currentWeek[0];
    const last = currentWeek[currentWeek.length - 1];
    const range = `${first.month}月${first.date}日—${last.month}月${last.date}日`;
    return dateItem
      ? commandResult("select-date", `切换到 ${dateItem.month} 月 ${day} 日`, [["日期", `${dateItem.month}月${day}日`]], { dateKey: dateItem.dateKey, confirmLabel: "切换" })
      : commandResult("select-date", "当前周没有这个日期", [["当前范围", range]], { valid: false, error: "请说当前周日期" });
  }

  if (!wantsCreate && hasAll && arrangementNoun && /(清空|清除|删除|移除|删掉)/.test(text)) {
    const scope = /(日常|每日)/.test(text) ? "daily" : /(关键|ddl|deadline|截止任务)/i.test(text) ? "critical" : "all";
    const dailyCount = scope === "critical" ? 0 : dailyTasks.length;
    const criticalCount = scope === "daily" ? 0 : criticalTasks.length;
    const scopeLabel = scope === "daily" ? "全部日常事项" : scope === "critical" ? "全部关键事项" : "全部未完成安排";
    return commandResult("clear-all", `清除${scopeLabel}`, [["日常", `${dailyCount} 项`], ["关键", `${criticalCount} 项`], ["历史记录", "保留"]], { scope, confirmLabel: "确认清除" });
  }

  if (!wantsCreate && hasAll && /(完成|做完|勾选|打勾)/.test(text) && /(今天|今日|日常|任务|事项|安排)/.test(text)) {
    return commandResult("complete-all", "完成所选日期的全部日常事项", [["日常事项", `${dailyTasks.length} 项`], ["日期", "当前所选日期"]], { confirmLabel: "全部完成" });
  }

  if (!wantsCreate && /(有什么|有哪些|列出|告诉我|汇总|查询|多少|还剩什么|还有什么|需要做什么|该做什么)/.test(text) && (arrangementNoun || /(还剩什么|还有什么|需要做什么|该做什么)/.test(text))) {
    const ddlCount = criticalTasks.filter((task) => task.deadline).length;
    const noDdlCount = criticalTasks.length - ddlCount;
    return commandResult("query", "当前安排", [["日常", `${dailyTasks.length} 项`], ["有 DDL", `${ddlCount} 项`], ["无 DDL", `${noDdlCount} 项`]], { confirmLabel: "关闭" });
  }

  if (/(打开|进入|查看|切换|回到)/.test(text)) {
    if (/(月报|月度总结|上月复盘)/.test(text)) return commandResult("navigate", "打开月度复盘", [["页面", "月度复盘"]], { route: "month", confirmLabel: "打开" });
    if (/(年报|年度总结|年度复盘)/.test(text)) return commandResult("navigate", "打开年度复盘", [["页面", "年度复盘"]], { route: "year", confirmLabel: "打开" });
    if (/历史/.test(text)) return commandResult("navigate", "打开历史记录", [["页面", "历史记录"]], { route: "history", confirmLabel: "打开" });
    if (/(ddl|deadline|关键|截止).*(提醒|通知)/i.test(text)) return commandResult("navigate", "打开关键提醒", [["页面", "关键提醒"]], { route: "critical-reminders", confirmLabel: "打开" });
    if (/(版本|更新)/.test(text)) return commandResult("navigate", "打开版本更新", [["页面", "版本更新"]], { route: "version", confirmLabel: "打开" });
    if (/(通知|权限|后台|电池)/.test(text)) return commandResult("navigate", "打开提醒与权限", [["页面", "提醒与权限"]], { route: "permissions", confirmLabel: "打开" });
    if (/(语音模型|离线语音|语音设置)/.test(text)) return commandResult("navigate", "打开语音设置", [["页面", "语音模型"]], { route: "voice", confirmLabel: "打开" });
    if (/(周视图|周检视|切换到周|查看周)/.test(text)) return commandResult("navigate", "日视图已包含本周", [["视图", "日（含本周）"]], { route: "today", confirmLabel: "前往" });
    if (/(月视图|月检视|切换到月|查看整月)/.test(text)) return commandResult("navigate", "切换到月检视", [["视图", "月"]], { route: "month-view", confirmLabel: "切换" });
    if (/(日视图|今日|今天|日常)/.test(text)) return commandResult("navigate", "回到今天", [["页面", "日常事务"], ["视图", "日"]], { route: "today", confirmLabel: "前往" });
    if (/关键/.test(text)) return commandResult("navigate", "打开关键事项", [["页面", "关键事项"]], { route: "critical", confirmLabel: "打开" });
  }

  if (!wantsCreate && /(删除|移除|删掉|清除)/.test(text)) {
    return target
      ? commandResult("delete", `删除「${target.task.title}」`, [["操作", "永久删除"], ["列表", target.kind === "daily" ? "日常事务" : "关键事项"]], { target, confirmLabel: "确认删除" })
      : commandResult("delete", "没有找到目标任务", [["建议", "说出任务名称中的关键词"]], { valid: false, error: "请再说一次要删除哪项任务" });
  }

  if (!wantsCreate && /(取消勾选|取消完成|标记为未完成|恢复未完成)/.test(text)) {
    return target?.kind === "daily"
      ? commandResult("uncomplete", `取消「${target.task.title}」的勾选`, [["状态", "未完成"]], { target, confirmLabel: "取消勾选" })
      : commandResult("uncomplete", "没有找到可取消勾选的日常任务", [["建议", "说出日常任务名称"]], { valid: false, error: "关键事项完成后会进入历史记录，不能在此取消" });
  }

  if (!wantsCreate && /(延期|延长|再续期|续期\s*[零〇一二三四五六七八九十两\d]+\s*天)/.test(text)) {
    const days = parseDelayDays(text);
    return target?.kind === "critical"
      ? commandResult("extend", `延长「${target.task.title}」`, [["延长", `${days} 天`], ["新的剩余时间", `${(target.task.daysLeft || 0) + days} 天`]], { target, days, confirmLabel: "确认延期" })
      : commandResult("extend", "没有找到对应的 DDL 任务", [["建议", "说出关键事项名称"]], { valid: false, error: "只有关键事项可以延期" });
  }

  if (!wantsCreate && /(设置|设为|改到|调整).*(ddl|deadline|截止|期限|[零〇一二三四五六七八九十两\d]{1,3}月[零〇一二三四五六七八九十两\d]{1,3}[日号]?)/i.test(text)) {
    const deadline = parseDeadline(text);
    const eventTime = parseTime(text);
    const nextTime = eventTime.source ? eventTime.value : target?.task?.time || null;
    return target?.kind === "critical" && deadline.deadline
      ? commandResult("set-deadline", `设置「${target.task.title}」的期限`, [["截止日期", deadline.deadline], ["截止时刻", nextTime || "未设置"], ["提醒计划", getCriticalReminder(target.task)]], { target, deadline, eventTime: eventTime.source ? eventTime.value : null, confirmLabel: "设置期限" })
      : commandResult("set-deadline", "期限或目标任务不完整", [["示例", "把年度体检设置到 9 月 30 日截止"]], { valid: false, error: "请同时说出关键事项名称和具体日期" });
  }

  if (!wantsCreate && /(打勾|勾选|标记完成|做完|完成了|^完成)/.test(text)) {
    return target
      ? commandResult("complete", `完成「${target.task.title}」`, [["结果", target.kind === "daily" ? "计入完成统计" : "移入历史记录"]], { target, confirmLabel: "标记完成" })
      : commandResult("complete", "没有找到要完成的任务", [["建议", "说出任务名称中的关键词"]], { valid: false, error: "请再说一次要勾选哪项任务" });
  }

  if (!wantsCreate && /(修改|更改|改成|改为|改名|更名|改到|改在|调到|设置|调整|挪到|提前到|延后到)/.test(text)) {
    if (!target) return commandResult("edit", "没有找到要修改的任务", [["建议", "先说任务名称，再说新内容"]], { valid: false, error: "请再说一次要修改哪项任务" });
    const contentMatch = text.match(/(?:改成|修改为|更改为|改名为|更名为|改为|改到|改在|调到|设置为?|调整(?:到|为)?|挪到|提前到|延后到)(.+)$/);
    const content = contentMatch?.[1]?.trim() || "";
    const parsed = parseVoiceTask(content);
    const noteMatch = text.match(/备注(?:改成|修改为|更改为|改为)(.+)$/);
    const changes = {};
    if (noteMatch) changes.note = noteMatch[1].trim();
    if (parsed.hasTime) {
      if (target.kind === "critical") changes.deadlineTime = parsed.time;
      else changes.time = parsed.time;
    }
    if (parsed.hasRepeat) {
      changes.repeat = parsed.repeat;
      changes.repeatDays = parsed.repeatDays;
    }
    if (parsed.hasReminder && target.kind === "daily") changes.reminder = parsed.reminder;
    if (parsed.hasDeadline) {
      changes.deadline = parsed.deadline;
      changes.daysLeft = parsed.daysLeft;
    }
    if (/(?:改成|改为|设为|调整为).*(关键|特殊)/.test(text)) changes.type = "critical";
    if (/(?:改成|改为|设为|调整为).*(日常|每日)/.test(text)) changes.type = "daily";
    if (!noteMatch && parsed.title !== "未命名事项") changes.title = parsed.title;
    const rows = Object.entries(changes).filter(([key]) => key !== "repeatDays").map(([key, value]) => [{ title: "名称", type: "类型", time: "时间", deadlineTime: "截止时刻", repeat: "重复", reminder: "提醒", deadline: "截止日期", daysLeft: "剩余天数", note: "备注" }[key] || key, key === "type" ? (value === "critical" ? "关键事项" : "日常事项") : value]);
    return rows.length
      ? commandResult("edit", `修改「${target.task.title}」`, rows, { target, changes, confirmLabel: "确认修改" })
      : commandResult("edit", "没有识别到修改内容", [["示例", "把健身改成慢跑 30 分钟"]], { valid: false, error: "请说明要改成什么" });
  }

  if (!wantsCreate && /(清空|清除|删除|移除|完成|勾选|取消|修改|更改|设置|调整|切换|打开|查看|查询|延期|延长|续期)/.test(text)) {
    return commandResult("clarify", "还需要一点信息", [["原话", text], ["需要", "任务名称或更明确的操作"]], { valid: false, error: "我不会把这句话创建成任务，请补充要操作的事项" });
  }

  const task = parseVoiceTask(text);
  const rows = task.span
    ? [["类型", "时间段"], ["去程", task.span.start.deadline], ["返程", task.span.end.deadline], ["记录", "生成两个关联 DDL"]]
    : task.type === "critical"
      ? [["类型", "关键事务"], ["截止日期", task.deadline || "未设置"], ["截止时刻", task.deadlineTime || "未设置"], ["提醒计划", task.reminder]]
      : [["类型", "日常事务"], ["重复", task.repeat], ["时间", task.endTime ? `${task.time}—${task.endTime}` : task.time], ["提醒", task.reminder]];
  return commandResult("create", task.title, rows, { task, analysis: domainAnalysis, confidence: domainAnalysis?.intent?.confidence, confirmLabel: "创建任务" });
}

function useViewportScale(width, height) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const availableWidth = window.innerWidth - 40;
      const availableHeight = window.innerHeight - 56;
      setScale(Math.min(availableWidth / width, availableHeight / height, 1));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [width, height]);
  return scale;
}

function getNativeWindowState(payload) {
  try {
    const previewMode = new URLSearchParams(window.location.search).get("native");
    const hasNativeBridge = Boolean(window.JinkeAndroid?.isNativeApp?.());
    if (!hasNativeBridge && !["phone", "expanded"].includes(previewMode)) return null;
    if (!hasNativeBridge) {
      const width = Math.max(1, window.innerWidth || 1);
      const height = Math.max(1, window.innerHeight || 1);
      return { width, height, ratio: Math.min(width, height) / Math.max(width, height), expanded: previewMode === "expanded" };
    }
    const supplied = typeof payload === "string" ? JSON.parse(payload) : payload;
    const nativeInfo = supplied || JSON.parse(window.JinkeAndroid.getWindowLayout());
    const width = Math.max(1, Number(nativeInfo.widthDp) || window.innerWidth || 1);
    const height = Math.max(1, Number(nativeInfo.heightDp) || window.innerHeight || 1);
    const ratio = Math.min(width, height) / Math.max(width, height);
    return { width, height, ratio, expanded: nativeInfo.expanded === true || ratio >= 0.68 };
  } catch {
    return null;
  }
}

function getNativeCapabilities(payload) {
  try {
    const supplied = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (supplied && typeof supplied === "object") return supplied;
    if (window.JinkeAndroid?.getSystemCapabilities) return JSON.parse(window.JinkeAndroid.getSystemCapabilities());
  } catch {}
  return null;
}

function MobileDesignApp() {
  const [themeMode, setThemeMode] = useState(() => {
    try { return localStorage.getItem("jinke-theme") || "dark"; } catch { return "dark"; }
  });
  const [defaultAlertMode, setDefaultAlertMode] = useState(() => {
    try { return localStorage.getItem("jinke-default-alert-mode") === "silent" ? "silent" : "sound"; } catch { return "sound"; }
  });
  const [defaultSoundId, setDefaultSoundId] = useState(() => {
    try { return localStorage.getItem("jinke-default-sound-id") || "chime"; } catch { return "chime"; }
  });
  const [customSounds, setCustomSounds] = useState(() => readStoredJson("jinke-custom-reminder-sounds", [], Array.isArray));
  const [activeTab, setActiveTab] = useState("today");
  const [secondaryStack, setSecondaryStack] = useState([]);
  const secondary = secondaryStack[secondaryStack.length - 1] || null;
  const setSecondary = (route) => setSecondaryStack(route ? [route] : []);
  const pushSecondary = (route) => setSecondaryStack((current) => [...current, route]);
  const [overlay, setOverlay] = useState(null);
  const [viewMode, setViewMode] = useState("day");
  const [todayDateKey, setTodayDateKey] = useState(() => localDateKey());
  const [selectedDateKey, setSelectedDateKey] = useState(() => localDateKey());
  const [dailyTasks, setDailyTasks] = useState(() => readStoredJson("jinke-daily-tasks", APP_DATA.dailyTasks, Array.isArray).map((task) => ({
    ...task,
    reminder: task.reminder || "到点提醒",
    alertMode: task.alertMode || "inherit",
    soundId: task.soundId || "inherit",
  })));
  const [dailyCompletionByDate, setDailyCompletionByDate] = useState(() => readStoredJson(
    "jinke-daily-completions",
    Object.fromEntries(APP_DATA.dailyTasks.map((task) => [`${task.id}:${localDateKey()}`, Boolean(task.done)])),
    (value) => value && typeof value === "object" && !Array.isArray(value),
  ));
  const [criticalTasks, setCriticalTasks] = useState(() => {
    const anchorDateKey = localDateKey();
    return readStoredJson("jinke-critical-tasks", APP_DATA.criticalTasks, Array.isArray).map((task) => (
      withCriticalReminderDefaults(normalizeCriticalCompletion(
        task.deadline && Number.isFinite(task.daysLeft) && !task.anchorDateKey ? { ...task, anchorDateKey } : task,
        anchorDateKey,
      ))
    ));
  });
  const [ddlReminderTime, setDdlReminderTime] = useState(() => {
    let value = "10:00";
    try { value = localStorage.getItem("jinke-ddl-reminder-time") || value; } catch {}
    window.JINKE_DDL_REMINDER_TIME = value;
    return value;
  });
  const [ddlReminderMultiple, setDdlReminderMultiple] = useState(() => {
    let value = 5;
    try { value = Math.max(1, Number(localStorage.getItem("jinke-ddl-reminder-multiple")) || value); } catch {}
    window.JINKE_DDL_REMINDER_MULTIPLE = value;
    return value;
  });
  const [ddlReminderFinalDays, setDdlReminderFinalDays] = useState(() => {
    let value = 5;
    try {
      const stored = localStorage.getItem("jinke-ddl-reminder-final-days");
      if (stored !== null) value = Math.max(0, Number(stored) || 0);
    } catch {}
    window.JINKE_DDL_REMINDER_FINAL_DAYS = value;
    return value;
  });
  const [history, setHistory] = useState(() => {
    const stored = readStoredJson("jinke-task-history", APP_DATA.history, Array.isArray).map((item) => {
      if (!item.completedDateKey || !item.sourceTaskId) return item;
      const [, month, day] = item.completedDateKey.split("-").map(Number);
      return { ...item, completed: `${month}月${day}日` };
    });
    const migrated = criticalTasks
      .filter((task) => task.done && task.completedDateKey)
      .map((task) => criticalHistoryEntry(task, task.completedDateKey, task.anchorDateKey || task.completedDateKey));
    return [...migrated.filter((entry) => !stored.some((item) => item.completionKey === entry.completionKey)), ...stored];
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedDaily, setSelectedDaily] = useState(null);
  const [dailyDraft, setDailyDraft] = useState(null);
  const [selectedCritical, setSelectedCritical] = useState(null);
  const [criticalDraft, setCriticalDraft] = useState(null);
  const [renewDays, setRenewDays] = useState(7);
  const [voicePhase, setVoicePhase] = useState("listening");
  const [transcript, setTranscript] = useState("");
  const [voiceDraft, setVoiceDraft] = useState(null);
  const [archiveActive, setArchiveActive] = useState("china");
  const [archiveIndex, setArchiveIndex] = useState(0);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [speechStatus, setSpeechStatus] = useState("idle");
  const speechCandidatesRef = useRef([]);
  const [toast, setToast] = useState("");
  const [nativeWindow, setNativeWindow] = useState(() => getNativeWindowState());
  const [nativeCapabilities, setNativeCapabilities] = useState(() => getNativeCapabilities());
  const [nativeSyncRevision, setNativeSyncRevision] = useState(0);
  const recognitionRef = useRef(null);
  const voiceInputModeRef = useRef("offline");
  const toastTimerRef = useRef(null);
  const overlayClosingRef = useRef(false);
  const overlayCloseTimerRef = useRef(null);
  const secondaryClosingRef = useRef(false);
  const secondaryCloseTimerRef = useRef(null);
  const soundImportCallbackRef = useRef(null);
  const reminderSounds = [...BUILT_IN_REMINDER_SOUNDS, ...customSounds];
  const scale = useViewportScale(SIMULATOR_WIDTH, SIMULATOR_HEIGHT);
  const currentCriticalTasks = criticalTasks.map((task) => ({
    ...task,
    daysLeft: criticalDaysLeftOn(task, todayDateKey, todayDateKey),
  }));
  const activeCriticalTasks = currentCriticalTasks.filter((task) => !task.done);
  const parsedVoiceCommand = transcript.trim()
    ? parseVoiceCommand(transcript, dailyTasks, currentCriticalTasks)
    : commandResult("invalid", "没有识别到内容", [["建议", "再说一次，或直接输入安排"]], { valid: false, error: "没有听清，请重试" });
  const displayedDailyTasks = dailyTasks
    .filter((task) => taskOccursOnDate(task, selectedDateKey, todayDateKey))
    .map((task) => ({
      ...task,
      done: Boolean(dailyCompletionByDate[`${task.id}:${selectedDateKey}`]),
    }));
  const displayedDeadlineTasks = criticalTasks
    .filter((task) => criticalTaskVisibleOnTodayDate(task, selectedDateKey))
    .map((task) => ({ ...task, daysLeft: criticalDaysLeftOn(task, selectedDateKey, todayDateKey) }));
  const getDateTaskLoad = (dateKey) => {
    return countScheduledTasksOnDate(dailyTasks, criticalTasks, dateKey, todayDateKey);
  };

  useEffect(() => {
    if (voicePhase === "review" && parsedVoiceCommand.intent === "create") setVoiceDraft({ ...parsedVoiceCommand.task });
  }, [voicePhase, transcript]);

  useEffect(() => {
    const refreshSystemDate = () => {
      const nextDateKey = localDateKey(new Date());
      setTodayDateKey((currentDateKey) => {
        if (currentDateKey === nextDateKey) return currentDateKey;
        setSelectedDateKey((selected) => selected === currentDateKey ? nextDateKey : selected);
        return nextDateKey;
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSystemDate();
    };
    window.JINKE_REFRESH_SYSTEM_TIME = refreshSystemDate;
    window.addEventListener("focus", refreshSystemDate);
    window.addEventListener("pageshow", refreshSystemDate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const clockTimer = window.setInterval(refreshSystemDate, 30000);
    refreshSystemDate();
    return () => {
      window.clearInterval(clockTimer);
      window.removeEventListener("focus", refreshSystemDate);
      window.removeEventListener("pageshow", refreshSystemDate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (window.JINKE_REFRESH_SYSTEM_TIME === refreshSystemDate) delete window.JINKE_REFRESH_SYSTEM_TIME;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = themeMode === "system" ? (media.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#171512" : "#F8F6F2");
    };
    applyTheme();
    try { localStorage.setItem("jinke-theme", themeMode); } catch {}
    if (themeMode === "system") media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    if (!nativeWindow) return undefined;
    const updateNativeWindow = (payload) => {
      const next = getNativeWindowState(payload);
      if (next) setNativeWindow(next);
    };
    window.JINKE_NATIVE_WINDOW_CHANGED = updateNativeWindow;
    const onResize = () => updateNativeWindow();
    window.addEventListener("resize", onResize);
    updateNativeWindow();
    return () => {
      window.removeEventListener("resize", onResize);
      if (window.JINKE_NATIVE_WINDOW_CHANGED === updateNativeWindow) delete window.JINKE_NATIVE_WINDOW_CHANGED;
    };
  }, [Boolean(nativeWindow)]);

  useEffect(() => {
    if (!window.JinkeAndroid?.getSystemCapabilities) return undefined;
    const updateCapabilities = (payload) => setNativeCapabilities(getNativeCapabilities(payload));
    window.JINKE_NATIVE_CAPABILITIES_CHANGED = updateCapabilities;
    updateCapabilities();
    return () => {
      if (window.JINKE_NATIVE_CAPABILITIES_CHANGED === updateCapabilities) delete window.JINKE_NATIVE_CAPABILITIES_CHANGED;
    };
  }, []);

  useEffect(() => {
    const requestSync = () => setNativeSyncRevision((current) => current + 1);
    window.JINKE_REQUEST_REMINDER_SYNC = requestSync;
    return () => {
      if (window.JINKE_REQUEST_REMINDER_SYNC === requestSync) delete window.JINKE_REQUEST_REMINDER_SYNC;
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem("jinke-daily-tasks", JSON.stringify(dailyTasks)); } catch {}
  }, [dailyTasks]);

  useEffect(() => {
    try { localStorage.setItem("jinke-daily-completions", JSON.stringify(dailyCompletionByDate)); } catch {}
  }, [dailyCompletionByDate]);

  useEffect(() => {
    try { localStorage.setItem("jinke-critical-tasks", JSON.stringify(criticalTasks)); } catch {}
  }, [criticalTasks]);

  useEffect(() => {
    try { localStorage.setItem("jinke-task-history", JSON.stringify(history)); } catch {}
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem("jinke-default-alert-mode", defaultAlertMode);
      localStorage.setItem("jinke-default-sound-id", defaultSoundId);
      localStorage.setItem("jinke-custom-reminder-sounds", JSON.stringify(customSounds.map(({ objectUrl, ...sound }) => sound)));
    } catch {}
  }, [defaultAlertMode, defaultSoundId, customSounds]);

  useEffect(() => {
    const receiveImportedSound = (payload) => {
      try {
        const sound = typeof payload === "string" ? JSON.parse(payload) : payload;
        if (!sound?.id || !sound?.name) return;
        const normalizedSound = { ...sound, source: sound.source || "local" };
        setCustomSounds((current) => [...current.filter((item) => item.id !== sound.id), normalizedSound]);
        const callback = soundImportCallbackRef.current;
        soundImportCallbackRef.current = null;
        callback?.(sound.id);
        showToast(normalizedSound.source === "system-alarm" ? `已选择闹铃：${sound.name}` : `已导入：${sound.name}`);
      } catch {
        showToast("音效导入失败");
      }
    };
    window.JINKE_SOUND_IMPORTED = receiveImportedSound;
    return () => {
      if (window.JINKE_SOUND_IMPORTED === receiveImportedSound) delete window.JINKE_SOUND_IMPORTED;
    };
  }, []);

  useEffect(() => {
    window.JINKE_DDL_REMINDER_TIME = ddlReminderTime;
    window.JINKE_DDL_REMINDER_MULTIPLE = ddlReminderMultiple;
    window.JINKE_DDL_REMINDER_FINAL_DAYS = ddlReminderFinalDays;
    try { localStorage.setItem("jinke-ddl-reminder-time", ddlReminderTime); } catch {}
    try { localStorage.setItem("jinke-ddl-reminder-multiple", String(ddlReminderMultiple)); } catch {}
    try { localStorage.setItem("jinke-ddl-reminder-final-days", String(ddlReminderFinalDays)); } catch {}
  }, [ddlReminderTime, ddlReminderMultiple, ddlReminderFinalDays]);

  useEffect(() => {
    if (!window.JinkeAndroid?.syncDdlReminders) return;
    const payload = criticalTasks
      .filter((task) => !task.done)
      .map((task) => ({ ...task, daysLeft: criticalDaysLeftOn(task, todayDateKey, todayDateKey) }))
      .filter((task) => task.deadline && Number.isFinite(task.daysLeft) && task.daysLeft >= 0)
      .map((task) => {
        const plan = normalizeCriticalReminderPlan(task, ddlReminderTime, ddlReminderMultiple, ddlReminderFinalDays);
        return {
          id: task.id,
          title: task.title,
          daysLeft: task.daysLeft,
          deadlineTime: task.deadlineTime || null,
          alertMode: task.alertMode && task.alertMode !== "inherit" ? task.alertMode : defaultAlertMode,
          soundId: task.soundId && task.soundId !== "inherit" ? task.soundId : defaultSoundId,
          ...plan,
        };
      });
    try {
      window.JinkeAndroid.syncDdlReminders(JSON.stringify(payload), ddlReminderTime, ddlReminderMultiple, ddlReminderFinalDays);
    } catch {}
  }, [criticalTasks, todayDateKey, ddlReminderTime, ddlReminderMultiple, ddlReminderFinalDays, defaultAlertMode, defaultSoundId, nativeSyncRevision]);

  useEffect(() => {
    if (!window.JinkeAndroid?.syncDailyReminders) return;
    const payload = dailyTasks.map((task) => {
      const reminderLeadMinutes = dailyReminderLeadMinutes(task.reminder);
      const completionPrefix = `${task.id}:`;
      const completedDateKeys = Object.entries(dailyCompletionByDate)
        .filter(([key, completed]) => completed && key.startsWith(completionPrefix))
        .map(([key]) => key.slice(completionPrefix.length));
      return {
        id: task.id,
        title: task.title,
        time: task.time,
        repeatDays: repeatDaysFromValue(task.repeat, task.repeatDays),
        scheduledDateKey: task.scheduledDateKey || "",
        activeFrom: task.activeFrom || todayDateKey,
        activeUntil: task.activeUntil || "",
        reminderEnabled: reminderLeadMinutes !== null,
        reminderLeadMinutes: reminderLeadMinutes || 0,
        completionDateKey: todayDateKey,
        completed: Boolean(dailyCompletionByDate[`${task.id}:${todayDateKey}`]),
        completedDateKeys,
        alertMode: task.alertMode && task.alertMode !== "inherit" ? task.alertMode : defaultAlertMode,
        soundId: task.soundId && task.soundId !== "inherit" ? task.soundId : defaultSoundId,
      };
    });
    try {
      window.JinkeAndroid.syncDailyReminders(JSON.stringify(payload));
    } catch {}
  }, [dailyTasks, dailyCompletionByDate, todayDateKey, defaultAlertMode, defaultSoundId, nativeSyncRevision]);

  useEffect(() => () => {
    if (recognitionRef.current) recognitionRef.current.abort();
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    if (overlayCloseTimerRef.current) window.clearTimeout(overlayCloseTimerRef.current);
    if (secondaryCloseTimerRef.current) window.clearTimeout(secondaryCloseTimerRef.current);
  }, []);

  const showToast = (message) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2200);
  };

  const previewReminderSound = (soundId) => {
    try {
      if (window.JinkeAndroid?.previewReminderSound) {
        window.JinkeAndroid.previewReminderSound(soundId || "chime");
        return;
      }
      const custom = customSounds.find((sound) => sound.id === soundId && sound.objectUrl);
      if (custom) {
        const audio = new Audio(custom.objectUrl);
        audio.play().catch(() => showToast("浏览器未允许播放音效"));
        return;
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const patterns = {
        chime: [[660, 0, 0.16], [880, 0.13, 0.25]],
        bell: [[784, 0, 0.35], [1046, 0.05, 0.45]],
        glass: [[988, 0, 0.12], [1318, 0.11, 0.32]],
        pop: [[520, 0, 0.12]],
        soft: [[440, 0, 0.22], [554, 0.17, 0.28]],
      };
      (patterns[soundId] || patterns.chime).forEach(([frequency, delay, duration]) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + delay;
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      });
      window.setTimeout(() => context.close(), 900);
    } catch {
      showToast("音效试听失败");
    }
  };

  const importReminderSound = (onSelected) => {
    soundImportCallbackRef.current = onSelected || null;
    if (window.JinkeAndroid?.pickReminderSound) {
      try {
        window.JinkeAndroid.pickReminderSound();
        return;
      } catch {}
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        soundImportCallbackRef.current = null;
        return;
      }
      const sound = { id: `web-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, "") || "本地音效", source: "local", objectUrl: URL.createObjectURL(file) };
      setCustomSounds((current) => [...current, sound]);
      const callback = soundImportCallbackRef.current;
      soundImportCallbackRef.current = null;
      callback?.(sound.id);
      showToast(`已导入：${sound.name}`);
    };
    input.click();
  };

  const pickSystemAlarmSound = (onSelected, currentSoundId = "") => {
    soundImportCallbackRef.current = onSelected || null;
    if (window.JinkeAndroid?.pickSystemAlarmSound) {
      try {
        window.JinkeAndroid.pickSystemAlarmSound(currentSoundId?.startsWith("alarm:") ? currentSoundId : "");
        return;
      } catch {}
    }
    soundImportCallbackRef.current = null;
    showToast("系统闹铃库仅在手机 App 中可用");
  };

  const changeDdlReminderTime = (time) => {
    const nextTime = /^\d{2}:\d{2}$/.test(time) ? time : "10:00";
    window.JINKE_DDL_REMINDER_TIME = nextTime;
    setDdlReminderTime(nextTime);
    showToast(`DDL 提醒时间已改为 ${nextTime}`);
  };

  const changeDdlReminderMultiple = (value) => {
    const next = Math.min(3650, Math.max(1, Number(value) || 1));
    window.JINKE_DDL_REMINDER_MULTIPLE = next;
    setDdlReminderMultiple(next);
    showToast(`DDL 提醒节点已改为每 ${next} 天`);
  };

  const changeDdlReminderFinalDays = (value) => {
    const next = Math.min(3650, Math.max(0, Number(value) || 0));
    window.JINKE_DDL_REMINDER_FINAL_DAYS = next;
    setDdlReminderFinalDays(next);
    showToast(`DDL 临近提醒已改为最后 ${next} 天`);
  };

  const toggleDaily = (taskId) => {
    const completionKey = `${taskId}:${selectedDateKey}`;
    const nowDone = !Boolean(dailyCompletionByDate[completionKey]);
    setDailyCompletionByDate((current) => ({ ...current, [completionKey]: nowDone }));
    if (nowDone) showToast("已完成，记入本月统计");
  };

  const setCriticalCompleted = (taskId, shouldComplete = true) => {
    const task = criticalTasks.find((item) => item.id === taskId);
    if (!task) return;
    if (shouldComplete) {
      const completionDateKey = localDateKey();
      const completionKey = `${taskId}:${completionDateKey}`;
      const completedTask = { ...completeCriticalForDate(task, completionDateKey), completionKey };
      setCriticalTasks((current) => current.map((item) => item.id === taskId ? completedTask : item));
      setHistory((current) => current.some((item) => item.completionKey === completionKey)
        ? current
        : [criticalHistoryEntry(task, completionDateKey, todayDateKey), ...current]);
      showToast("已完成，保留在今天的任务列表");
      return;
    }
    setCriticalTasks((current) => current.map((item) => item.id === taskId ? uncompleteCriticalTask(item) : item));
    setHistory((current) => current.filter((item) => item.sourceTaskId !== taskId));
    showToast("已取消完成，恢复到关键事项");
  };

  const toggleCriticalCheck = (taskId) => {
    const task = criticalTasks.find((item) => item.id === taskId);
    if (task) setCriticalCompleted(taskId, !task.done);
  };

  const selectDate = (dateKey) => {
    setSelectedDateKey(dateKey);
  };

  const openDaily = (task) => {
    setSelectedDaily(task);
    setDailyDraft({ ...task, alertMode: task.alertMode || "inherit", soundId: task.soundId || "inherit", repeatDays: repeatDaysFromValue(task.repeat, task.repeatDays), reminder: task.reminder || "到点提醒" });
    setOverlay("daily-edit");
  };

  const requestDelete = (task, kind) => {
    setDeleteTarget({ task, kind });
    setOverlay("delete-confirm");
  };

  const confirmDelete = (mode = "all") => {
    if (!deleteTarget?.task) return;
    const { task, kind } = deleteTarget;
    if (kind === "daily") {
      if (mode === "future") {
        const activeUntil = shiftDateKeyByDays(selectedDateKey, -1);
        setDailyTasks((current) => current.flatMap((item) => {
          if (item.id !== task.id) return [item];
          if (item.activeFrom && item.activeFrom > activeUntil) return [];
          return [{ ...item, activeUntil: item.activeUntil && item.activeUntil < activeUntil ? item.activeUntil : activeUntil }];
        }));
        setDailyCompletionByDate((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
          const separator = key.indexOf(":");
          const taskId = separator < 0 ? key : key.slice(0, separator);
          const dateKey = separator < 0 ? "" : key.slice(separator + 1);
          return taskId !== task.id || dateKey < selectedDateKey;
        })));
      } else {
        setDailyTasks((current) => current.filter((item) => item.id !== task.id));
        setDailyCompletionByDate((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key.split(":")[0] !== task.id)));
      }
    } else {
      setCriticalTasks((current) => current.filter((item) => item.id !== task.id));
    }
    closeOverlay();
    showToast(kind === "daily" && mode === "future" ? `已停止「${task.title}」的后续安排` : `已删除「${task.title}」`);
  };

  const saveDaily = (taskId, changes) => {
    setDailyTasks((current) => current
      .map((task) => task.id === taskId ? {
        ...task,
        ...changes,
        reminder: changes.reminder || task.reminder || "到点提醒",
      } : task)
      .sort((a, b) => a.time.localeCompare(b.time)));
    closeOverlay();
    showToast("日常事务已更新");
  };

  const openMore = (route) => {
    pushSecondary(route);
  };

  const openCritical = (task) => {
    const storedTask = criticalTasks.find((item) => item.id === task.id) || task;
    const editableTask = {
      ...storedTask,
      daysLeft: criticalDaysLeftOn(storedTask, todayDateKey, todayDateKey),
      deadline: editableCriticalDeadline(storedTask, todayDateKey),
    };
    setSelectedCritical(editableTask);
    setCriticalDraft(withCriticalReminderDefaults(editableTask));
    setRenewDays(7);
    setOverlay("critical-detail");
  };

  const saveCritical = (taskId, changes) => {
    const originalTask = criticalTasks.find((task) => task.id === taskId);
    if (!originalTask) return;
    const deadlineText = changes.deadline?.trim() || null;
    const parsed = deadlineText ? parseDeadline(deadlineText) : null;
    const deadlineTime = changes.deadlineTime || (changes.time && changes.time !== "待定" ? changes.time : null);
    let updatedTask = withCriticalReminderDefaults({
      ...originalTask,
      ...changes,
      deadline: deadlineText,
      daysLeft: deadlineText ? (parsed?.deadline
        ? parsed.daysLeft
        : Number.isFinite(changes.daysLeft) ? changes.daysLeft : criticalDaysLeftOn(originalTask, todayDateKey, todayDateKey)) : null,
      anchorDateKey: deadlineText ? todayDateKey : null,
      deadlineTime,
      time: deadlineTime,
      reminderEnabled: deadlineText ? changes.reminderEnabled : false,
    });
    if (updatedTask.done && updatedTask.completedDateKey) {
      updatedTask = moveCriticalCompletion(updatedTask, updatedTask.completedDateKey);
    }
    setCriticalTasks((current) => current.map((task) => task.id === taskId ? updatedTask : task));
    if (updatedTask.done && updatedTask.completedDateKey) {
      const historyEntry = criticalHistoryEntry(updatedTask, updatedTask.completedDateKey, updatedTask.anchorDateKey || todayDateKey);
      setHistory((current) => [historyEntry, ...current.filter((item) => item.sourceTaskId !== taskId)]);
      if (updatedTask.completedDateKey !== originalTask.completedDateKey) {
        setSelectedDateKey(updatedTask.completedDateKey);
        setActiveTab("today");
      }
    }
    closeOverlay();
    showToast(updatedTask.done && updatedTask.completedDateKey !== originalTask.completedDateKey ? "完成日期已更新" : "关键事项已更新");
  };

  const renewCritical = (taskId, requestedDays = 7) => {
    const days = Math.min(3650, Math.max(1, Number(requestedDays) || 7));
    setCriticalTasks((current) => current.map((task) => {
      if (task.id !== taskId) return task;
      const currentDaysLeft = criticalDaysLeftOn(task, todayDateKey, todayDateKey) || 0;
      const daysLeft = currentDaysLeft + days;
      return { ...task, daysLeft, anchorDateKey: todayDateKey, deadline: deadlineLabelFromDays(daysLeft) };
    }));
    closeOverlay();
    showToast(`DDL 已续期 ${days} 天`);
  };

  const startVoice = () => {
    voiceInputModeRef.current = "offline";
    setTranscript("");
    setVoiceDraft(null);
    setVoicePhase("listening");
    setSpeechStatus("starting");
    speechCandidatesRef.current = [];
    setOverlay("voice");
    if (window.JinkeAndroid?.startSpeechRecognition) {
      window.JINKE_NATIVE_SPEECH_STATUS = (status) => {
        setSpeechStatus(String(status || "idle"));
        setSpeechAvailable(status !== "error" && status !== "permission-denied");
      };
      window.JINKE_NATIVE_SPEECH_PARTIAL = (next) => {
        setTranscript(String(next || ""));
        setSpeechAvailable(true);
      };
      window.JINKE_NATIVE_SPEECH_CANDIDATES = (payload) => {
        try {
          const candidates = typeof payload === "string" ? JSON.parse(payload) : payload;
          speechCandidatesRef.current = Array.isArray(candidates) ? candidates : [];
        } catch {
          speechCandidatesRef.current = [];
        }
      };
      window.JINKE_NATIVE_SPEECH_RESULT = (next) => {
        const ranked = DOMAIN_NLU?.rankCandidates?.(speechCandidatesRef.current, { dailyTasks, criticalTasks });
        setTranscript(String(ranked?.best?.text || next || ""));
        setSpeechStatus("idle");
        window.setTimeout(() => setVoicePhase("review"), 80);
      };
      try {
        window.JinkeAndroid.startSpeechRecognition();
        setSpeechAvailable(true);
      } catch {
        setSpeechAvailable(false);
      }
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechAvailable(false);
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = "zh-CN";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const next = Array.from(event.results).map((result) => result[0].transcript).join("");
        setTranscript(next);
      };
      recognition.onerror = () => setSpeechAvailable(false);
      recognitionRef.current = recognition;
      recognition.start();
      setSpeechAvailable(true);
    } catch {
      setSpeechAvailable(false);
    }
  };

  const stopVoice = () => {
    if (voiceInputModeRef.current === "input-method") {
      setSpeechStatus("idle");
      window.setTimeout(() => setVoicePhase("review"), 50);
      return;
    }
    if (window.JinkeAndroid?.stopSpeechRecognition) {
      setSpeechStatus("processing");
      try { window.JinkeAndroid.stopSpeechRecognition(); } catch { setSpeechAvailable(false); }
      return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    window.setTimeout(() => setVoicePhase("review"), 100);
  };

  const useInputMethodVoice = () => {
    if (voiceInputModeRef.current === "input-method") return;
    voiceInputModeRef.current = "input-method";
    if (window.JinkeAndroid?.cancelSpeechRecognition) {
      try { window.JinkeAndroid.cancelSpeechRecognition(); } catch {}
    } else if (window.JinkeAndroid?.stopSpeechRecognition) {
      try { window.JinkeAndroid.stopSpeechRecognition(); } catch {}
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    setSpeechStatus("idle");
  };

  const confirmVoiceCommand = (commandOverride) => {
    const command = commandOverride || parsedVoiceCommand;
    if (!command.valid) return;
    const { intent, target } = command;

    if (intent === "create") {
      const task = command.task;
      if (task.span) {
        const spanId = `voice-span-${Date.now()}`;
        const created = [
          withCriticalReminderDefaults({
            id: `${spanId}-start`,
            spanId,
            spanRole: "start",
            title: `${task.title} · 出发`,
            note: task.note || "",
            deadline: task.span.start.deadline,
            daysLeft: task.span.start.daysLeft,
            anchorDateKey: todayDateKey,
            deadlineTime: task.hasTime && task.time !== "待定" ? task.time : null,
            alertMode: task.alertMode || "inherit",
            soundId: task.soundId || "inherit",
            progress: 0,
          }),
          withCriticalReminderDefaults({
            id: `${spanId}-end`,
            spanId,
            spanRole: "end",
            title: `${task.title} · 返程`,
            note: task.note || "",
            deadline: task.span.end.deadline,
            daysLeft: task.span.end.daysLeft,
            anchorDateKey: todayDateKey,
            deadlineTime: task.endTime || null,
            alertMode: task.alertMode || "inherit",
            soundId: task.soundId || "inherit",
            progress: 0,
          }),
        ];
        setCriticalTasks((current) => [...created, ...current]);
        setActiveTab("critical");
      } else if (task.type === "critical") {
        const normalizedDeadline = task.deadline ? parseDeadline(task.deadline) : null;
        const created = withCriticalReminderDefaults({
          id: `voice-critical-${Date.now()}`,
          title: task.title,
          note: task.note,
          deadline: task.deadline,
          daysLeft: normalizedDeadline?.daysLeft ?? task.daysLeft,
          anchorDateKey: task.deadline ? todayDateKey : null,
          deadlineTime: task.deadlineTime || (task.hasTime && task.time !== "待定" ? task.time : null),
          reminderEnabled: Boolean(task.deadline && task.reminderEnabled !== false),
          reminderTime: task.reminderTime,
          reminderMode: task.reminderMode,
          reminderMultiple: task.reminderMultiple,
          reminderFinalDays: task.reminderFinalDays,
           progress: 0,
           alertMode: task.alertMode || "inherit",
           soundId: task.soundId || "inherit",
         });
        setCriticalTasks((current) => [created, ...current]);
        setActiveTab("critical");
      } else {
        const created = {
          id: `voice-${Date.now()}`,
          time: task.time,
          endTime: task.endTime || null,
          spansMidnight: Boolean(task.spansMidnight),
          title: task.title,
          note: task.note || "",
          repeat: task.repeat,
          repeatDays: repeatDaysFromValue(task.repeat, task.repeatDays),
          scheduledDateKey: repeatDaysFromValue(task.repeat, task.repeatDays).length
            ? null
            : (task.scheduledDateKey && task.scheduledDateKey >= todayDateKey ? task.scheduledDateKey : todayDateKey),
           reminder: task.reminder || "到点提醒",
           alertMode: task.alertMode || "inherit",
           soundId: task.soundId || "inherit",
           activeFrom: todayDateKey,
          done: false,
        };
        setDailyTasks((current) => [...current, created].sort((a, b) => a.time.localeCompare(b.time)));
        setActiveTab("today");
      }
      setSecondary(null);
      showToast(`已创建：${task.title}`);
    } else if (intent === "clear-all") {
      if (command.scope !== "critical") {
        setDailyTasks([]);
        setDailyCompletionByDate({});
      }
      if (command.scope !== "daily") setCriticalTasks([]);
      setActiveTab(command.scope === "critical" ? "critical" : "today");
      setSecondary(null);
      showToast("已清除，历史记录已保留");
    } else if (intent === "complete-all") {
      setDailyCompletionByDate((current) => dailyTasks.reduce((next, task) => ({ ...next, [`${task.id}:${selectedDateKey}`]: true }), { ...current }));
      setActiveTab("today");
      setSecondary(null);
      showToast("所选日期的日常事项已全部完成");
    } else if (intent === "theme") {
      setThemeMode(command.themeMode);
      showToast(command.heading);
    } else if (intent === "set-ddl-reminder-time") {
      changeDdlReminderTime(command.reminderTime);
      setSecondary("critical-reminders");
    } else if (intent === "set-ddl-reminder-policy") {
      if (command.policy === "multiple") changeDdlReminderMultiple(command.value);
      else changeDdlReminderFinalDays(command.value);
      setSecondary("critical-reminders");
    } else if (intent === "select-date") {
      selectDate(command.dateKey);
      setActiveTab("today");
      setSecondary(null);
      showToast(command.heading);
    } else if (intent === "query") {
      showToast("已汇总当前安排");
    } else if (intent === "delete") {
      if (target.kind === "daily") {
        closeOverlay(() => requestDelete(target.task, "daily"));
        return;
      }
      setCriticalTasks((current) => current.filter((task) => task.id !== target.task.id));
      showToast(`已删除：${target.task.title}`);
    } else if (intent === "complete") {
      if (target.kind === "daily") {
        setDailyCompletionByDate((current) => ({ ...current, [`${target.task.id}:${selectedDateKey}`]: true }));
        setActiveTab("today");
        setSecondary(null);
        showToast("已勾选，并记入完成统计");
      } else {
        setCriticalCompleted(target.task.id, true);
        setActiveTab("today");
        setSelectedDateKey(localDateKey());
        setSecondary(null);
      }
    } else if (intent === "uncomplete") {
      if (target.kind === "critical") setCriticalCompleted(target.task.id, false);
      else setDailyCompletionByDate((current) => ({ ...current, [`${target.task.id}:${selectedDateKey}`]: false }));
      setActiveTab("today");
      setSecondary(null);
      if (target.kind !== "critical") showToast("已取消勾选");
    } else if (intent === "extend") {
      setCriticalTasks((current) => current.map((task) => {
        if (task.id !== target.task.id) return task;
        const currentDaysLeft = criticalDaysLeftOn(task, todayDateKey, todayDateKey) || 0;
        const daysLeft = currentDaysLeft + command.days;
        return { ...task, daysLeft, anchorDateKey: todayDateKey, deadline: deadlineLabelFromDays(daysLeft) };
      }));
      setActiveTab("critical");
      setSecondary(null);
      showToast(`已延期 ${command.days} 天`);
    } else if (intent === "set-deadline") {
      setCriticalTasks((current) => current.map((task) => task.id === target.task.id ? {
        ...task,
        deadline: command.deadline.deadline,
        daysLeft: command.deadline.daysLeft,
        anchorDateKey: todayDateKey,
        deadlineTime: command.eventTime || task.deadlineTime || task.time || null,
        time: command.eventTime || task.deadlineTime || task.time || null,
        reminderEnabled: task.deadline ? task.reminderEnabled : true,
      } : task));
      setActiveTab("critical");
      setSecondary(null);
      showToast(`期限已设为 ${command.deadline.deadline}`);
    } else if (intent === "edit") {
      const { type: nextType, ...changes } = command.changes;
      if (target.kind === "daily" && nextType === "critical") {
        setDailyTasks((current) => current.filter((task) => task.id !== target.task.id));
        setCriticalTasks((current) => [withCriticalReminderDefaults({
          id: target.task.id,
          title: changes.title || target.task.title,
          note: changes.note || target.task.note,
          deadline: changes.deadline || null,
          daysLeft: changes.daysLeft ?? null,
          anchorDateKey: changes.deadline ? todayDateKey : null,
          deadlineTime: changes.deadlineTime || (changes.time && changes.time !== "待定" ? changes.time : null),
          progress: 0,
        }), ...current]);
        setActiveTab("critical");
      } else if (target.kind === "critical" && nextType === "daily") {
        setCriticalTasks((current) => current.filter((task) => task.id !== target.task.id));
        setDailyTasks((current) => [...current, {
          id: target.task.id,
          time: changes.time || target.task.time || "待定",
          title: changes.title || target.task.title,
          note: changes.note || target.task.note,
          repeat: changes.repeat || "仅一次",
          repeatDays: repeatDaysFromValue(changes.repeat || "仅一次", changes.repeatDays),
          activeFrom: todayDateKey,
          scheduledDateKey: repeatDaysFromValue(changes.repeat || "仅一次", changes.repeatDays).length ? null : todayDateKey,
          reminder: changes.reminder || "到点提醒",
          done: false,
        }].sort((a, b) => a.time.localeCompare(b.time)));
        setActiveTab("today");
      } else {
        const applyChanges = (task) => task.id === target.task.id ? {
          ...task,
          ...changes,
          ...(target.kind === "critical" && Object.prototype.hasOwnProperty.call(changes, "daysLeft") ? { anchorDateKey: todayDateKey } : {}),
        } : task;
        if (target.kind === "daily") setDailyTasks((current) => current.map(applyChanges));
        else setCriticalTasks((current) => current.map(applyChanges));
        setActiveTab(target.kind === "daily" ? "today" : "critical");
      }
      setSecondary(null);
      showToast(`已修改：${target.task.title}`);
    } else if (intent === "navigate") {
      const route = command.route;
      if (["history", "month", "year", "permissions", "settings", "critical-reminders", "version", "voice"].includes(route)) {
        setSecondary(route);
      } else {
        setSecondary(null);
        if (route === "critical") {
          setActiveTab("critical");
          setViewMode("day");
        } else {
          setActiveTab("today");
          setViewMode(route === "month-view" ? "month" : "day");
          if (route !== "month-view") setSelectedDateKey(todayDateKey);
        }
      }
      showToast(command.heading);
    }

    closeOverlay();
  };

  const closeOverlay = (afterClose) => {
    if (overlayClosingRef.current) return;
    if (window.JinkeAndroid?.cancelSpeechRecognition) {
      try { window.JinkeAndroid.cancelSpeechRecognition(); } catch {}
    } else if (window.JinkeAndroid?.stopSpeechRecognition) {
      try { window.JinkeAndroid.stopSpeechRecognition(); } catch {}
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    const finish = () => {
      if (!overlayClosingRef.current && overlay) return;
      overlayClosingRef.current = false;
      if (overlayCloseTimerRef.current) window.clearTimeout(overlayCloseTimerRef.current);
      overlayCloseTimerRef.current = null;
      setOverlay(null);
      setSelectedDaily(null);
      setDailyDraft(null);
      setSelectedCritical(null);
      setCriticalDraft(null);
      setRenewDays(7);
      setTranscript("");
      setVoicePhase("listening");
      setSpeechStatus("idle");
      setVoiceDraft(null);
      setDeleteTarget(null);
      afterClose?.();
    };
    if (!overlay) {
      finish();
      return;
    }
    overlayClosingRef.current = true;
    const detail = { depth: 0, completed: false, complete: finish };
    window.dispatchEvent(new CustomEvent("jinke-sheet-dismiss", { detail }));
    overlayCloseTimerRef.current = window.setTimeout(() => {
      if (detail.completed) return;
      detail.completed = true;
      finish();
    }, 290);
  };

  const closeSecondary = () => {
    if (!secondaryStack.length || secondaryClosingRef.current) return;
    const depth = secondaryStack.length;
    const finish = () => {
      if (!secondaryClosingRef.current) return;
      secondaryClosingRef.current = false;
      if (secondaryCloseTimerRef.current) window.clearTimeout(secondaryCloseTimerRef.current);
      secondaryCloseTimerRef.current = null;
      setSecondaryStack((current) => current.slice(0, -1));
    };
    secondaryClosingRef.current = true;
    const detail = { depth, completed: false, complete: finish };
    window.dispatchEvent(new CustomEvent("jinke-sheet-dismiss", { detail }));
    secondaryCloseTimerRef.current = window.setTimeout(() => {
      if (detail.completed) return;
      detail.completed = true;
      finish();
    }, 290);
  };

  useEffect(() => {
    const handleNativeBack = () => {
      if (secondary) {
        closeSecondary();
        return true;
      }
      if (overlay) {
        closeOverlay();
        return true;
      }
      if (viewMode === "month") {
        setViewMode("day");
        setSelectedDateKey(todayDateKey);
        return true;
      }
      if (activeTab === "critical") {
        setActiveTab("today");
        return true;
      }
      return false;
    };
    window.JINKE_NATIVE_BACK = handleNativeBack;
    return () => {
      if (window.JINKE_NATIVE_BACK === handleNativeBack) delete window.JINKE_NATIVE_BACK;
    };
  }, [overlay, secondary, secondaryStack.length, viewMode, activeTab, todayDateKey]);

  useEffect(() => {
    const openTodayFromNotification = () => {
      setOverlay(null);
      setSecondaryStack([]);
      setActiveTab("today");
      setViewMode("day");
      const currentDateKey = localDateKey();
      setTodayDateKey(currentDateKey);
      setSelectedDateKey(currentDateKey);
    };
    window.JINKE_OPEN_TODAY = openTodayFromNotification;
    return () => {
      if (window.JINKE_OPEN_TODAY === openTodayFromNotification) delete window.JINKE_OPEN_TODAY;
    };
  }, []);

  const renderScreen = () => {
    if (activeTab === "critical") return <CriticalScreen tasks={activeCriticalTasks} onToggle={toggleCriticalCheck} onOpen={openCritical} onDelete={(task) => requestDelete(task, "critical")} onMenu={() => { setSecondaryStack([]); setOverlay("more"); }} onOpenReminders={() => setSecondary("critical-reminders")} />;
    return <TodayScreen tasks={displayedDailyTasks} deadlineTasks={displayedDeadlineTasks} onToggle={toggleDaily} onEdit={openDaily} onDeleteDaily={(task) => requestDelete(task, "daily")} onToggleCritical={toggleCriticalCheck} onOpenCritical={openCritical} onDeleteCritical={(task) => requestDelete(task, "critical")} onMenu={() => { setSecondaryStack([]); setOverlay("more"); }} viewMode={viewMode} onOpenView={() => setOverlay("view")} selectedDateKey={selectedDateKey} todayDateKey={todayDateKey} onSelectDate={selectDate} getDateLoad={getDateTaskLoad} onOpenDayArchive={() => { setArchiveActive("china"); setArchiveIndex(0); setOverlay("day-archive"); }} />;
  };

  const renderSecondaryScreen = (route) => {
    if (route === "history") return <HistoryScreen items={history} onBack={closeSecondary} />;
    if (route === "month") return <ReportScreen type="month" dailyTasks={dailyTasks} dailyCompletionByDate={dailyCompletionByDate} history={history} todayDateKey={todayDateKey} onBack={closeSecondary} />;
    if (route === "year") return <ReportScreen type="year" dailyTasks={dailyTasks} dailyCompletionByDate={dailyCompletionByDate} history={history} todayDateKey={todayDateKey} onBack={closeSecondary} />;
    if (route === "permissions") return <PermissionsScreen capabilities={nativeCapabilities} onOpenCapability={(key) => { try { window.JinkeAndroid?.openCapabilitySettings?.(key); } catch {} }} onTestReminder={() => {
      try {
        if (!window.JinkeAndroid?.scheduleReminderTest) {
          showToast("测试提醒仅在手机安装版可用");
          return;
        }
        window.JinkeAndroid.scheduleReminderTest();
        showToast("测试提醒已登记，8 秒后触发");
      } catch { showToast("测试提醒登记失败"); }
    }} onBack={closeSecondary} />;
    if (route === "settings") return <SettingsScreen alertMode={defaultAlertMode} defaultSoundId={defaultSoundId} sounds={reminderSounds} onAlertModeChange={(mode) => { setDefaultAlertMode(mode); showToast(mode === "silent" ? "默认改为静音提醒" : "默认改为响铃提醒"); }} onDefaultSoundChange={(soundId) => { setDefaultSoundId(soundId); showToast("默认音效已更新"); }} onPreviewSound={previewReminderSound} onImportSound={importReminderSound} onPickSystemAlarm={pickSystemAlarmSound} onOpenPermissions={() => pushSecondary("permissions")} onBack={closeSecondary} />;
    if (route === "critical-reminders") return <CriticalReminderScreen tasks={activeCriticalTasks} reminderTime={ddlReminderTime} onReminderTimeChange={changeDdlReminderTime} reminderMultiple={ddlReminderMultiple} onReminderMultipleChange={changeDdlReminderMultiple} reminderFinalDays={ddlReminderFinalDays} onReminderFinalDaysChange={changeDdlReminderFinalDays} onOpenPermissions={() => pushSecondary("permissions")} onBack={closeSecondary} />;
    if (route === "version") return <VersionScreen onBack={closeSecondary} />;
    if (route === "voice") return <VoiceSettingsScreen capabilities={nativeCapabilities} onBack={closeSecondary} />;
    return null;
  };

  const renderDevice = (variant) => (
    <PhoneFrame variant={variant}>
      {renderScreen()}
      <BottomNav activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setViewMode("day"); if (tab === "today") setSelectedDateKey(todayDateKey); setSecondaryStack([]); }} onVoice={startVoice} />
      {overlay === "view" ? <ViewMenu onClose={closeOverlay} onSelect={(mode) => { setViewMode(mode); if (mode === "day") setSelectedDateKey(todayDateKey); closeOverlay(); }} /> : null}
      {overlay === "more" ? <MoreSheet onClose={closeOverlay} onOpen={openMore} themeMode={themeMode} onThemeChange={setThemeMode} /> : null}
      {secondaryStack.map((route, index) => (
        <Sheet depth={index + 1} onClose={closeSecondary} label={`${route} 面板`} key={`${index}-${route}`}>
          {renderSecondaryScreen(route)}
        </Sheet>
      ))}
      {overlay === "voice" ? <VoiceComposer phase={voicePhase} transcript={transcript} parsedCommand={parsedVoiceCommand} draftTask={voiceDraft} onDraftTaskChange={setVoiceDraft} onTranscript={setTranscript} onStop={stopVoice} onUseInputMethod={useInputMethodVoice} onConfirm={confirmVoiceCommand} onClose={closeOverlay} speechAvailable={speechAvailable} speechStatus={speechStatus} sounds={reminderSounds} defaultAlertMode={defaultAlertMode} defaultSoundId={defaultSoundId} onPreviewSound={previewReminderSound} onImportSound={importReminderSound} onPickSystemAlarm={pickSystemAlarmSound} /> : null}
      {overlay === "daily-edit" ? <DailyEditSheet task={selectedDaily} draft={dailyDraft} onDraftChange={setDailyDraft} onSave={saveDaily} onClose={closeOverlay} sounds={reminderSounds} defaultAlertMode={defaultAlertMode} defaultSoundId={defaultSoundId} onPreviewSound={previewReminderSound} onImportSound={importReminderSound} onPickSystemAlarm={pickSystemAlarmSound} /> : null}
      {overlay === "critical-detail" ? <CriticalDetailSheet task={selectedCritical} draft={criticalDraft} renewDays={renewDays} onRenewDaysChange={setRenewDays} onDraftChange={setCriticalDraft} onClose={closeOverlay} onRenew={renewCritical} onSave={saveCritical} sounds={reminderSounds} defaultAlertMode={defaultAlertMode} defaultSoundId={defaultSoundId} onPreviewSound={previewReminderSound} onImportSound={importReminderSound} onPickSystemAlarm={pickSystemAlarmSound} /> : null}
      {overlay === "day-archive" ? <CalendarDaySheet dateKey={selectedDateKey} active={archiveActive} index={archiveIndex} onActiveChange={setArchiveActive} onIndexChange={setArchiveIndex} onClose={closeOverlay} /> : null}
      {overlay === "delete-confirm" ? <DeleteConfirmSheet target={deleteTarget} selectedDateKey={selectedDateKey} onClose={closeOverlay} onConfirm={confirmDelete} /> : null}
      {toast ? <div className="sr-only" role="status" aria-live="polite">{toast}</div> : null}
    </PhoneFrame>
  );

  if (nativeWindow) {
    const nativeVariant = nativeWindow.expanded ? "expanded" : "phone";
    return (
      <div
        className={`native-app ${nativeWindow.expanded ? "native-expanded" : "native-phone"}`}
        data-window-ratio={nativeWindow.ratio.toFixed(3)}
      >
        {renderDevice(nativeVariant)}
      </div>
    );
  }

  return (
    <div className="viewer-root">
      <div className="viewer-stage">
        <div className="viewer-simulator-wrap" style={{ transform: `scale(${scale})` }}>
          <div className="simulator-pair" aria-label="同步设备预览">
            <section className="device-preview device-preview-phone" aria-label="普通手机预览">
              <div className="device-preview-label">普通手机 · 430 × 956</div>
              <div className="viewer-device-wrap viewer-device-phone">{renderDevice("phone")}</div>
            </section>
            <section className="device-preview device-preview-expanded" aria-label="展开全面屏预览">
              <div className="device-preview-label">展开全面屏 · 860 × 956</div>
              <div className="viewer-device-wrap viewer-device-expanded">{renderDevice("expanded")}</div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<MobileDesignApp />);
