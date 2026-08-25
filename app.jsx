const { useEffect, useRef, useState } = React;
const {
  APP_DATA,
  getCriticalReminder,
  repeatDaysFromValue,
  repeatLabelFromDays,
  taskOccursOnDate,
  PhoneFrame,
  BottomNav,
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
  CriticalReminderScreen,
  VersionScreen,
  VoiceSettingsScreen,
} = window;

const PHONE_WIDTH = 430;
const EXPANDED_WIDTH = 860;
const DEVICE_HEIGHT = 956;
const SIMULATOR_GAP = 48;
const SIMULATOR_WIDTH = PHONE_WIDTH + EXPANDED_WIDTH + SIMULATOR_GAP;
const SIMULATOR_HEIGHT = DEVICE_HEIGHT + 34;
const VOICE_EXAMPLE = "把健身改到晚上八点";

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

function dateKeyOffset(fromKey, toKey) {
  const [fromYear, fromMonth, fromDay] = fromKey.split("-").map(Number);
  const [toYear, toMonth, toDay] = toKey.split("-").map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86400000);
}

const CN_DIGITS = { "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };

function normalizeSpeechText(value) {
  let normalized = String(value || "").trim();
  let previous = "";
  while (normalized !== previous) {
    previous = normalized;
    normalized = normalized.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1");
  }
  return normalized;
}

function parseNumber(value) {
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
  const periodPattern = "(凌晨|早上|上午|中午|下午|傍晚|晚上)?";
  const numberPattern = "([零〇一二三四五六七八九十两\\d]{1,3})";
  const colon = text.match(new RegExp(`${periodPattern}\\s*(\\d{1,2})[:：](\\d{2})`));
  const spoken = text.match(new RegExp(`${periodPattern}\\s*${numberPattern}[点时](?:钟)?(半|[零〇一二三四五六七八九十两\\d]{1,3}分?)?`));
  const match = colon || spoken;
  if (!match) return { value: "待定", source: "" };

  const period = match[1] || "";
  let hour = parseNumber(match[2]);
  let minute = colon ? Number(match[3]) : match[3] === "半" ? 30 : parseNumber((match[3] || "").replace("分", "")) || 0;
  if (["下午", "傍晚", "晚上"].includes(period) && hour < 12) hour += 12;
  if (period === "中午" && hour < 11) hour += 12;
  if (period === "凌晨" && hour === 12) hour = 0;
  hour = Math.min(Math.max(hour, 0), 23);
  minute = Math.min(55, Math.max(0, Math.round(minute / 5) * 5));
  return { value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, source: match[0].trim() };
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
  const match = text.match(/每(?:周|星期)([一二三四五六日天、，和及到至\-]+)/);
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
  if (/无\s*(?:ddl|截止)|没有\s*(?:ddl|截止日期|期限)/i.test(text)) return { deadline: null, daysLeft: null, source: "", kind: "none" };
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

const TASK_ACTION_WORDS = [
  "取消预约", "提交", "打电话", "参加", "领取", "预约", "续期", "复习", "整理", "完成", "准备", "修改", "购买", "学习", "阅读", "跑步", "健身", "睡觉", "起床", "开会", "上课", "体检", "写", "读", "看", "买", "取", "拿", "办", "考",
];

function extractTaskSemantics(rawText, removableParts, durationSource) {
  let title = rawText;
  [...removableParts, durationSource].filter(Boolean).forEach((part) => { title = title.replace(part, " "); });
  title = title
    .replace(/没有\s*(?:ddl|截止日期|期限)|无\s*(?:ddl|截止)/ig, " ")
    .replace(/(?:帮我|给我|请)?(?:创建|添加|新增|安排|记下|记一下|提醒我)\s*(?:一个|一条)?/g, " ")
    .replace(/(?:重要|关键|特殊)(?:任务|事项|事件)?|(?:任务|事项|日程)[:：]?/g, " ")
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

function parseVoiceTask(rawText) {
  const text = normalizeSpeechText(rawText);
  const repeat = parseRepeat(text);
  const withoutRepeat = repeat.source ? text.replace(repeat.source, " ") : text;
  const time = parseTime(withoutRepeat);
  const deadline = parseDeadline(text);
  const reminderMatch = text.match(/提前\s*([零〇一二三四五六七八九十两\d]{1,3})\s*(分钟|小时)(?:提醒)?/);
  const reminderAmount = reminderMatch ? parseNumber(reminderMatch[1]) : 0;
  const reminder = reminderMatch ? formatDailyReminder(reminderAmount * (reminderMatch[2] === "小时" ? 60 : 1)) : "到点提醒";
  const withoutReminder = reminderMatch ? text.replace(reminderMatch[0], "") : text;
  const durationMatch = withoutReminder.match(/([零〇一二三四五六七八九十两\d]{1,3})\s*(分钟|小时)/);
  const duration = durationMatch ? `${parseNumber(durationMatch[1])} ${durationMatch[2]}` : "";
  const isCritical = !repeat.source && (/(重要|关键|特殊|ddl|截止|到期)/i.test(text) || deadline.kind === "absolute");

  const semantics = extractTaskSemantics(text, [reminderMatch?.[0], time.source, repeat.source, deadline.source], durationMatch?.[0]);

  return {
    type: isCritical ? "critical" : "daily",
    title: semantics.title,
    time: time.value,
    repeat: repeat.source ? repeat.value : (!isCritical && deadline.deadline ? deadline.deadline : repeat.value),
    repeatDays: repeat.days,
    reminder: isCritical ? getCriticalReminder(time.source ? time.value : null) : reminder,
    deadline: deadline.deadline,
    daysLeft: deadline.daysLeft,
    note: `语音创建${duration ? ` · 持续 ${duration}` : ""}`,
    action: semantics.action,
    object: semantics.object,
    keywords: semantics.keywords,
    hasTime: Boolean(time.source),
    hasRepeat: Boolean(repeat.source),
    hasReminder: Boolean(reminderMatch),
    hasDeadline: Boolean(deadline.deadline),
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
  const target = findMentionedTask(text, dailyTasks, criticalTasks);
  const wantsCreate = /(创建|添加|新增|记下|记一下|提醒我)/.test(text) || /^(?:帮我|请)?安排/.test(text);
  const hasAll = /(全部|所有)/.test(text);
  const arrangementNoun = /(安排|日程|任务|事项)/.test(text);

  if (/(切换|改成|设置|使用|启用).*(暗色|深色|夜间|亮色|浅色|跟随系统|系统主题)|^(暗色|深色|夜间|亮色|浅色|跟随系统|系统主题)(?:模式)?$/.test(text)) {
    const themeMode = /(跟随系统|系统主题)/.test(text) ? "system" : /(亮色|浅色)/.test(text) ? "light" : "dark";
    const themeLabel = themeMode === "system" ? "跟随系统" : themeMode === "light" ? "亮色" : "暗色";
    return commandResult("theme", `切换为${themeLabel}`, [["外观", themeLabel]], { themeMode, confirmLabel: "切换" });
  }

  if (!wantsCreate && /(ddl|关键事项).*(默认提醒时间|提醒时间|默认时间)/i.test(text) && /(设置|设为|改为|改到|调整)/.test(text)) {
    const reminderTime = parseTime(text);
    return reminderTime.source
      ? commandResult("set-ddl-reminder-time", "修改 DDL 默认提醒时间", [["时间", reminderTime.value], ["频率", "5 的倍数天；最后 5 天每日"]], { reminderTime: reminderTime.value, confirmLabel: "保存" })
      : commandResult("set-ddl-reminder-time", "没有识别到提醒时间", [["示例", "把 DDL 默认提醒时间改为早上九点"]], { valid: false, error: "请说出具体时间" });
  }

  if (!wantsCreate && /(ddl|关键事项).*(倍数|每隔|节点)/i.test(text) && /(设置|设为|改为|改成|调整)/.test(text)) {
    const multiple = parseDelayDays(text);
    return commandResult("set-ddl-reminder-policy", "修改 DDL 提醒倍数", [["倍数节点", `每 ${multiple} 天`]], { policy: "multiple", value: multiple, confirmLabel: "保存" });
  }

  if (!wantsCreate && /(ddl|关键事项).*(最后|临近|连续).*提醒/i.test(text) && /(设置|设为|改为|改成|调整)/.test(text)) {
    const finalDays = parseDelayDays(text);
    return commandResult("set-ddl-reminder-policy", "修改 DDL 连续提醒天数", [["临近截止", `最后 ${finalDays} 天`]], { policy: "final-days", value: finalDays, confirmLabel: "保存" });
  }

  const dateSelection = text.match(/(?:切换|打开|查看|前往|去|到)\s*(?:到)?\s*([零〇一二三四五六七八九十两\d]{1,3})[日号]/);
  if (dateSelection) {
    const day = parseNumber(dateSelection[1]);
    const dateItem = APP_DATA.week.find((item) => item.date === day);
    return dateItem
      ? commandResult("select-date", `切换到 8 月 ${day} 日`, [["日期", `8月${day}日`]], { dateKey: dateItem.dateKey, confirmLabel: "切换" })
      : commandResult("select-date", "当前周没有这个日期", [["当前范围", "8月24日—8月30日"]], { valid: false, error: "请说当前周日期" });
  }

  if (!wantsCreate && hasAll && arrangementNoun && /(清空|清除|删除|移除|删掉)/.test(text)) {
    const scope = /(日常|每日)/.test(text) ? "daily" : /(关键|ddl)/i.test(text) ? "critical" : "all";
    const dailyCount = scope === "critical" ? 0 : dailyTasks.length;
    const criticalCount = scope === "daily" ? 0 : criticalTasks.length;
    const scopeLabel = scope === "daily" ? "全部日常事项" : scope === "critical" ? "全部关键事项" : "全部未完成安排";
    return commandResult("clear-all", `清除${scopeLabel}`, [["日常", `${dailyCount} 项`], ["关键", `${criticalCount} 项`], ["历史记录", "保留"]], { scope, confirmLabel: "确认清除" });
  }

  if (!wantsCreate && hasAll && /(完成|做完|勾选|打勾)/.test(text) && /(今天|今日|日常|任务|事项|安排)/.test(text)) {
    return commandResult("complete-all", "完成所选日期的全部日常事项", [["日常事项", `${dailyTasks.length} 项`], ["日期", "当前所选日期"]], { confirmLabel: "全部完成" });
  }

  if (!wantsCreate && /(有什么|有哪些|列出|告诉我|汇总|查询|多少)/.test(text) && arrangementNoun) {
    const ddlCount = criticalTasks.filter((task) => task.deadline).length;
    const noDdlCount = criticalTasks.length - ddlCount;
    return commandResult("query", "当前安排", [["日常", `${dailyTasks.length} 项`], ["有 DDL", `${ddlCount} 项`], ["无 DDL", `${noDdlCount} 项`]], { confirmLabel: "关闭" });
  }

  if (/(打开|进入|查看|切换|回到)/.test(text)) {
    if (/(月报|月度总结|上月复盘)/.test(text)) return commandResult("navigate", "打开月度复盘", [["页面", "月度复盘"]], { route: "month", confirmLabel: "打开" });
    if (/(年报|年度总结|年度复盘)/.test(text)) return commandResult("navigate", "打开年度复盘", [["页面", "年度复盘"]], { route: "year", confirmLabel: "打开" });
    if (/历史/.test(text)) return commandResult("navigate", "打开历史记录", [["页面", "历史记录"]], { route: "history", confirmLabel: "打开" });
    if (/(ddl|关键).*(提醒|通知)/i.test(text)) return commandResult("navigate", "打开 DDL 提醒", [["页面", "DDL 提醒"]], { route: "critical-reminders", confirmLabel: "打开" });
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

  if (!wantsCreate && /(设置|设为|改到|调整).*(ddl|截止|期限|[零〇一二三四五六七八九十两\d]{1,3}月[零〇一二三四五六七八九十两\d]{1,3}[日号]?)/i.test(text)) {
    const deadline = parseDeadline(text);
    const eventTime = parseTime(text);
    const nextTime = eventTime.source ? eventTime.value : target?.task?.time || null;
    return target?.kind === "critical" && deadline.deadline
      ? commandResult("set-deadline", `设置「${target.task.title}」的期限`, [["截止", deadline.deadline], ["时间", nextTime || "未设置"], ["提醒", getCriticalReminder(nextTime)]], { target, deadline, eventTime: eventTime.source ? eventTime.value : null, confirmLabel: "设置期限" })
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
      changes.time = parsed.time;
      if (target.kind === "critical") changes.reminder = getCriticalReminder(parsed.time);
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
    const rows = Object.entries(changes).filter(([key]) => key !== "repeatDays").map(([key, value]) => [{ title: "名称", type: "类型", time: "时间", repeat: "重复", reminder: "提醒", deadline: "截止", daysLeft: "剩余天数", note: "备注" }[key] || key, key === "type" ? (value === "critical" ? "关键事项" : "日常事项") : value]);
    return rows.length
      ? commandResult("edit", `修改「${target.task.title}」`, rows, { target, changes, confirmLabel: "确认修改" })
      : commandResult("edit", "没有识别到修改内容", [["示例", "把健身改成慢跑 30 分钟"]], { valid: false, error: "请说明要改成什么" });
  }

  if (!wantsCreate && /(清空|清除|删除|移除|完成|勾选|取消|修改|更改|设置|调整|切换|打开|查看|查询|延期|延长|续期)/.test(text)) {
    return commandResult("clarify", "还需要一点信息", [["原话", text], ["需要", "任务名称或更明确的操作"]], { valid: false, error: "我不会把这句话创建成任务，请补充要操作的事项" });
  }

  const task = parseVoiceTask(text);
  const rows = task.type === "critical"
    ? [["类型", "关键事务"], ["截止", task.deadline || "无 DDL"], ["时间", task.hasTime ? task.time : "未设置"], ["提醒", task.reminder]]
    : [["类型", "日常事务"], ["重复", task.repeat], ["时间", task.time], ["提醒", task.reminder]];
  return commandResult("create", task.title, rows, { task, confirmLabel: "创建任务" });
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
  const [activeTab, setActiveTab] = useState("today");
  const [secondary, setSecondary] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [viewMode, setViewMode] = useState("day");
  const [selectedDateKey, setSelectedDateKey] = useState(APP_DATA.today.dateKey);
  const [dailyTasks, setDailyTasks] = useState(() => readStoredJson("jinke-daily-tasks", APP_DATA.dailyTasks, Array.isArray));
  const [dailyCompletionByDate, setDailyCompletionByDate] = useState(() => readStoredJson(
    "jinke-daily-completions",
    Object.fromEntries(APP_DATA.dailyTasks.map((task) => [`${task.id}:${localDateKey()}`, Boolean(task.done)])),
    (value) => value && typeof value === "object" && !Array.isArray(value),
  ));
  const [criticalTasks, setCriticalTasks] = useState(() => readStoredJson("jinke-critical-tasks", APP_DATA.criticalTasks, Array.isArray));
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
  const [history, setHistory] = useState(() => readStoredJson("jinke-task-history", APP_DATA.history, Array.isArray));
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
  const [toast, setToast] = useState("");
  const [nativeWindow, setNativeWindow] = useState(() => getNativeWindowState());
  const [nativeCapabilities, setNativeCapabilities] = useState(() => getNativeCapabilities());
  const recognitionRef = useRef(null);
  const toastTimerRef = useRef(null);
  const scale = useViewportScale(SIMULATOR_WIDTH, SIMULATOR_HEIGHT);
  const parsedVoiceCommand = parseVoiceCommand(transcript || VOICE_EXAMPLE, dailyTasks, criticalTasks);
  const displayedDailyTasks = dailyTasks
    .filter((task) => taskOccursOnDate(task, selectedDateKey, APP_DATA.today.dateKey))
    .map((task) => ({
      ...task,
      done: Boolean(dailyCompletionByDate[`${task.id}:${selectedDateKey}`]),
    }));
  const selectedDateOffset = dateKeyOffset(APP_DATA.today.dateKey, selectedDateKey);
  const displayedDeadlineTasks = criticalTasks
    .filter((task) => task.deadline)
    .map((task) => ({ ...task, daysLeft: Number.isFinite(task.daysLeft) ? task.daysLeft - selectedDateOffset : null }));

  useEffect(() => {
    if (voicePhase === "review" && parsedVoiceCommand.intent === "create") setVoiceDraft({ ...parsedVoiceCommand.task });
  }, [voicePhase, transcript]);

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
    window.JINKE_DDL_REMINDER_TIME = ddlReminderTime;
    window.JINKE_DDL_REMINDER_MULTIPLE = ddlReminderMultiple;
    window.JINKE_DDL_REMINDER_FINAL_DAYS = ddlReminderFinalDays;
    try { localStorage.setItem("jinke-ddl-reminder-time", ddlReminderTime); } catch {}
    try { localStorage.setItem("jinke-ddl-reminder-multiple", String(ddlReminderMultiple)); } catch {}
    try { localStorage.setItem("jinke-ddl-reminder-final-days", String(ddlReminderFinalDays)); } catch {}
    setCriticalTasks((current) => current.map((task) => task.deadline ? { ...task, reminder: getCriticalReminder(task.time, ddlReminderTime, ddlReminderMultiple, ddlReminderFinalDays) } : task));
  }, [ddlReminderTime, ddlReminderMultiple, ddlReminderFinalDays]);

  useEffect(() => {
    if (!window.JinkeAndroid?.syncDdlReminders) return;
    const payload = criticalTasks
      .filter((task) => task.deadline && Number.isFinite(task.daysLeft) && task.daysLeft >= 0)
      .map((task) => ({ id: task.id, title: task.title, daysLeft: task.daysLeft }));
    try {
      window.JinkeAndroid.syncDdlReminders(JSON.stringify(payload), ddlReminderTime, ddlReminderMultiple, ddlReminderFinalDays);
    } catch {}
  }, [criticalTasks, ddlReminderTime, ddlReminderMultiple, ddlReminderFinalDays]);

  useEffect(() => () => {
    if (recognitionRef.current) recognitionRef.current.abort();
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = (message) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2200);
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

  const toggleCriticalCheck = (taskId) => {
    let nowDone = false;
    setCriticalTasks((current) => current.map((task) => {
      if (task.id !== taskId) return task;
      nowDone = !Boolean(task.done);
      return { ...task, done: nowDone };
    }));
    showToast(nowDone ? "关键事项已勾选" : "已取消勾选");
  };

  const selectDate = (dateKey) => {
    setSelectedDateKey(dateKey);
  };

  const openDaily = (task) => {
    setSelectedDaily(task);
    setDailyDraft({ ...task, repeatDays: repeatDaysFromValue(task.repeat, task.repeatDays), reminder: task.reminder || "到点提醒" });
    setOverlay("daily-edit");
  };

  const requestDelete = (task, kind) => {
    setDeleteTarget({ task, kind });
    setOverlay("delete-confirm");
  };

  const confirmDelete = () => {
    if (!deleteTarget?.task) return;
    const { task, kind } = deleteTarget;
    if (kind === "daily") {
      setDailyTasks((current) => current.filter((item) => item.id !== task.id));
      setDailyCompletionByDate((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key.split(":")[0] !== task.id)));
    } else {
      setCriticalTasks((current) => current.filter((item) => item.id !== task.id));
    }
    setDeleteTarget(null);
    setOverlay(null);
    showToast(`已删除「${task.title}」`);
  };

  const saveDaily = (taskId, changes) => {
    setDailyTasks((current) => current
      .map((task) => task.id === taskId ? { ...task, ...changes } : task)
      .sort((a, b) => a.time.localeCompare(b.time)));
    setSelectedDaily(null);
    setDailyDraft(null);
    setOverlay(null);
    showToast("日常事务已更新");
  };

  const openMore = (route) => {
    setOverlay(null);
    setSecondary(route === "settings" ? "permissions" : route);
  };

  const openCritical = (task) => {
    setSelectedCritical(task);
    setCriticalDraft({ ...task });
    setRenewDays(7);
    setOverlay("critical-detail");
  };

  const saveCritical = (taskId, changes) => {
    const deadlineText = changes.deadline?.trim() || null;
    const parsed = deadlineText ? parseDeadline(deadlineText) : null;
    const eventTime = changes.time && changes.time !== "待定" ? changes.time : null;
    setCriticalTasks((current) => current.map((task) => task.id === taskId ? {
      ...task,
      ...changes,
      deadline: deadlineText,
      daysLeft: deadlineText ? (parsed?.deadline ? parsed.daysLeft : task.daysLeft) : null,
      time: eventTime,
      reminder: getCriticalReminder(eventTime),
    } : task));
    setSelectedCritical(null);
    setCriticalDraft(null);
    setRenewDays(7);
    setOverlay(null);
    showToast("关键事项已更新");
  };

  const completeCritical = (taskId) => {
    const task = criticalTasks.find((item) => item.id === taskId);
    if (!task) return;
    const completionKey = `${taskId}:${localDateKey()}`;
    setCriticalTasks((current) => current.filter((item) => item.id !== taskId));
    setHistory((current) => current.some((item) => item.completionKey === completionKey)
      ? current
      : [{ id: `done-${taskId}-${localDateKey()}`, completionKey, sourceTaskId: taskId, title: task.title, completed: "今天", leadDays: task.daysLeft || 0 }, ...current]);
    setOverlay(null);
    setSelectedCritical(null);
    setCriticalDraft(null);
    setRenewDays(7);
    showToast("已完成，并移入历史记录");
  };

  const renewCritical = (taskId, requestedDays = 7) => {
    const days = Math.min(3650, Math.max(1, Number(requestedDays) || 7));
    setCriticalTasks((current) => current.map((task) => {
      if (task.id !== taskId) return task;
      const daysLeft = (task.daysLeft || 0) + days;
      return { ...task, daysLeft, deadline: deadlineLabelFromDays(daysLeft) };
    }));
    setOverlay(null);
    setSelectedCritical(null);
    setCriticalDraft(null);
    setRenewDays(7);
    showToast(`DDL 已续期 ${days} 天`);
  };

  const startVoice = () => {
    setTranscript("");
    setVoiceDraft(null);
    setVoicePhase("listening");
    setSpeechStatus("starting");
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
      window.JINKE_NATIVE_SPEECH_RESULT = (next) => {
        setTranscript(String(next || ""));
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
    if (window.JinkeAndroid?.stopSpeechRecognition) {
      setSpeechStatus("processing");
      try { window.JinkeAndroid.stopSpeechRecognition(); } catch { setSpeechAvailable(false); }
      return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (!transcript.trim()) setTranscript(VOICE_EXAMPLE);
    window.setTimeout(() => setVoicePhase("review"), 100);
  };

  const useVoiceExample = () => {
    setTranscript(VOICE_EXAMPLE);
    window.setTimeout(() => setVoicePhase("review"), 120);
  };

  const confirmVoiceCommand = (commandOverride) => {
    const command = commandOverride || parsedVoiceCommand;
    if (!command.valid) return;
    const { intent, target } = command;

    if (intent === "create") {
      const task = command.task;
      if (task.type === "critical") {
        const normalizedDeadline = task.deadline ? parseDeadline(task.deadline) : null;
        const created = {
          id: `voice-critical-${Date.now()}`,
          title: task.title,
          note: task.note,
          deadline: task.deadline,
          daysLeft: normalizedDeadline?.daysLeft ?? task.daysLeft,
          time: task.hasTime && task.time !== "待定" ? task.time : null,
          reminder: getCriticalReminder(task.hasTime ? task.time : null),
          progress: 0,
        };
        setCriticalTasks((current) => [created, ...current]);
        setActiveTab("critical");
      } else {
        const created = {
          id: `voice-${Date.now()}`,
          time: task.time,
          title: task.title,
          note: task.note || "语音创建",
          repeat: task.repeat,
          repeatDays: repeatDaysFromValue(task.repeat, task.repeatDays),
          scheduledDateKey: repeatDaysFromValue(task.repeat, task.repeatDays).length ? null : selectedDateKey,
          reminder: task.reminder || "到点提醒",
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
      if (target.kind === "daily") setDailyTasks((current) => current.filter((task) => task.id !== target.task.id));
      else setCriticalTasks((current) => current.filter((task) => task.id !== target.task.id));
      showToast(`已删除：${target.task.title}`);
    } else if (intent === "complete") {
      if (target.kind === "daily") {
        setDailyCompletionByDate((current) => ({ ...current, [`${target.task.id}:${selectedDateKey}`]: true }));
        setActiveTab("today");
        setSecondary(null);
        showToast("已勾选，并记入完成统计");
      } else {
        const completionKey = `${target.task.id}:${localDateKey()}`;
        setCriticalTasks((current) => current.filter((task) => task.id !== target.task.id));
        setHistory((current) => current.some((item) => item.completionKey === completionKey)
          ? current
          : [{ id: `done-${target.task.id}-${localDateKey()}`, completionKey, sourceTaskId: target.task.id, title: target.task.title, completed: "今天", leadDays: target.task.daysLeft || 0 }, ...current]);
        setActiveTab("critical");
        setSecondary(null);
        showToast("已完成，并移入历史记录");
      }
    } else if (intent === "uncomplete") {
      setDailyCompletionByDate((current) => ({ ...current, [`${target.task.id}:${selectedDateKey}`]: false }));
      setActiveTab("today");
      setSecondary(null);
      showToast("已取消勾选");
    } else if (intent === "extend") {
      setCriticalTasks((current) => current.map((task) => {
        if (task.id !== target.task.id) return task;
        const daysLeft = (task.daysLeft || 0) + command.days;
        return { ...task, daysLeft, deadline: deadlineLabelFromDays(daysLeft), reminder: getCriticalReminder(task.time) };
      }));
      setActiveTab("critical");
      setSecondary(null);
      showToast(`已延期 ${command.days} 天`);
    } else if (intent === "set-deadline") {
      setCriticalTasks((current) => current.map((task) => task.id === target.task.id ? {
        ...task,
        deadline: command.deadline.deadline,
        daysLeft: command.deadline.daysLeft,
        time: command.eventTime || task.time || null,
        reminder: getCriticalReminder(command.eventTime || task.time),
      } : task));
      setActiveTab("critical");
      setSecondary(null);
      showToast(`期限已设为 ${command.deadline.deadline}`);
    } else if (intent === "edit") {
      const { type: nextType, ...changes } = command.changes;
      if (target.kind === "daily" && nextType === "critical") {
        setDailyTasks((current) => current.filter((task) => task.id !== target.task.id));
        setCriticalTasks((current) => [{
          id: target.task.id,
          title: changes.title || target.task.title,
          note: changes.note || target.task.note,
          deadline: changes.deadline || null,
          daysLeft: changes.daysLeft ?? null,
          time: changes.time && changes.time !== "待定" ? changes.time : null,
          reminder: getCriticalReminder(changes.time),
          progress: 0,
        }, ...current]);
        setActiveTab("critical");
      } else if (target.kind === "critical" && nextType === "daily") {
        setCriticalTasks((current) => current.filter((task) => task.id !== target.task.id));
        setDailyTasks((current) => [...current, {
          id: target.task.id,
          time: changes.time || target.task.time || "待定",
          title: changes.title || target.task.title,
          note: changes.note || target.task.note,
          repeat: changes.repeat || "仅一次",
          reminder: changes.reminder || "到点提醒",
          done: false,
        }].sort((a, b) => a.time.localeCompare(b.time)));
        setActiveTab("today");
      } else {
        const applyChanges = (task) => task.id === target.task.id ? { ...task, ...changes } : task;
        if (target.kind === "daily") setDailyTasks((current) => current.map(applyChanges));
        else setCriticalTasks((current) => current.map(applyChanges));
        setActiveTab(target.kind === "daily" ? "today" : "critical");
      }
      setSecondary(null);
      showToast(`已修改：${target.task.title}`);
    } else if (intent === "navigate") {
      const route = command.route;
      if (["history", "month", "year", "permissions", "critical-reminders", "version", "voice"].includes(route)) {
        setSecondary(route);
      } else {
        setSecondary(null);
        if (route === "critical") {
          setActiveTab("critical");
          setViewMode("day");
        } else {
          setActiveTab("today");
          setViewMode(route === "month-view" ? "month" : "day");
        }
      }
      showToast(command.heading);
    }

    setOverlay(null);
  };

  const closeOverlay = () => {
    if (window.JinkeAndroid?.stopSpeechRecognition) {
      try { window.JinkeAndroid.stopSpeechRecognition(); } catch {}
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    setOverlay(null);
    setSelectedDaily(null);
    setDailyDraft(null);
    setSelectedCritical(null);
    setCriticalDraft(null);
    setRenewDays(7);
    setVoiceDraft(null);
    setDeleteTarget(null);
  };

  useEffect(() => {
    const handleNativeBack = () => {
      if (overlay) {
        closeOverlay();
        return true;
      }
      if (secondary) {
        setSecondary(null);
        return true;
      }
      if (viewMode === "month") {
        setViewMode("day");
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
  }, [overlay, secondary, viewMode, activeTab]);

  const renderScreen = () => {
    if (secondary === "history") return <HistoryScreen items={history} onBack={() => setSecondary(null)} />;
    if (secondary === "month") return <ReportScreen type="month" onBack={() => setSecondary(null)} />;
    if (secondary === "year") return <ReportScreen type="year" onBack={() => setSecondary(null)} />;
    if (secondary === "permissions") return <PermissionsScreen capabilities={nativeCapabilities} onOpenCapability={(key) => { try { window.JinkeAndroid?.openCapabilitySettings?.(key); } catch {} }} onBack={() => setSecondary(null)} />;
    if (secondary === "critical-reminders") return <CriticalReminderScreen tasks={criticalTasks} reminderTime={ddlReminderTime} onReminderTimeChange={changeDdlReminderTime} reminderMultiple={ddlReminderMultiple} onReminderMultipleChange={changeDdlReminderMultiple} reminderFinalDays={ddlReminderFinalDays} onReminderFinalDaysChange={changeDdlReminderFinalDays} onOpenPermissions={() => setSecondary("permissions")} onBack={() => setSecondary(null)} />;
    if (secondary === "version") return <VersionScreen onBack={() => setSecondary(null)} />;
    if (secondary === "voice") return <VoiceSettingsScreen capabilities={nativeCapabilities} onBack={() => setSecondary(null)} />;
    if (activeTab === "critical") return <CriticalScreen tasks={criticalTasks} onToggle={toggleCriticalCheck} onOpen={openCritical} onDelete={(task) => requestDelete(task, "critical")} onMenu={() => setOverlay("more")} onOpenReminders={() => setSecondary("critical-reminders")} />;
    return <TodayScreen tasks={displayedDailyTasks} deadlineTasks={displayedDeadlineTasks} onToggle={toggleDaily} onEdit={openDaily} onDeleteDaily={(task) => requestDelete(task, "daily")} onToggleCritical={toggleCriticalCheck} onOpenCritical={openCritical} onDeleteCritical={(task) => requestDelete(task, "critical")} onMenu={() => setOverlay("more")} viewMode={viewMode} onOpenView={() => setOverlay("view")} selectedDateKey={selectedDateKey} todayDateKey={APP_DATA.today.dateKey} onSelectDate={selectDate} onOpenDayArchive={() => { setArchiveActive("china"); setArchiveIndex(0); setOverlay("day-archive"); }} />;
  };

  const renderDevice = (variant) => (
    <PhoneFrame variant={variant}>
      {renderScreen()}
      {!secondary ? <BottomNav activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setViewMode("day"); }} onVoice={startVoice} /> : null}
      {overlay === "view" ? <ViewMenu onClose={closeOverlay} onSelect={(mode) => { setViewMode(mode); setOverlay(null); }} /> : null}
      {overlay === "more" ? <MoreSheet onClose={closeOverlay} onOpen={openMore} themeMode={themeMode} onThemeChange={setThemeMode} /> : null}
      {overlay === "voice" ? <VoiceComposer phase={voicePhase} transcript={transcript} parsedCommand={parsedVoiceCommand} draftTask={voiceDraft} onDraftTaskChange={setVoiceDraft} onTranscript={setTranscript} onStop={stopVoice} onUseExample={useVoiceExample} onConfirm={confirmVoiceCommand} onClose={closeOverlay} speechAvailable={speechAvailable} speechStatus={speechStatus} /> : null}
      {overlay === "daily-edit" ? <DailyEditSheet task={selectedDaily} draft={dailyDraft} onDraftChange={setDailyDraft} onSave={saveDaily} onClose={closeOverlay} /> : null}
      {overlay === "critical-detail" ? <CriticalDetailSheet task={selectedCritical} draft={criticalDraft} renewDays={renewDays} onRenewDaysChange={setRenewDays} onDraftChange={setCriticalDraft} onClose={closeOverlay} onComplete={completeCritical} onRenew={renewCritical} onSave={saveCritical} /> : null}
      {overlay === "day-archive" ? <CalendarDaySheet dateKey={selectedDateKey} active={archiveActive} index={archiveIndex} onActiveChange={setArchiveActive} onIndexChange={setArchiveIndex} onClose={closeOverlay} /> : null}
      {overlay === "delete-confirm" ? <DeleteConfirmSheet target={deleteTarget} onClose={closeOverlay} onConfirm={confirmDelete} /> : null}
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
