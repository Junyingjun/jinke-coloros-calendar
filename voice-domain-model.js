(() => {
  const CN_DIGITS = { "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
  const NUMBER_SOURCE = "[零〇一二三四五六七八九十两\\d]{1,3}";
  const PERIOD_SOURCE = "凌晨|清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜里|夜间";
  const PERIOD_CANONICAL = {
    清晨: "凌晨",
    早晨: "早上",
    夜里: "晚上",
    夜间: "晚上",
  };
  const NIGHT_ACTIONS = /洗漱|刷牙|睡觉|睡眠|上床|休息|晚安/;
  const MORNING_ACTIONS = /起床|早餐|晨练|早饭/;
  const NOON_ACTIONS = /午饭|午餐|午休/;
  const CLAUSE_BOUNDARY = /[，,。；;！？!?、\n]/;

  function normalizeTranscript(value) {
    let normalized = String(value || "").trim();
    normalized = normalized
      .replace(/\bd\s*[，,、.\s]*d\s*[，,、.\s]*l\b/ig, "ddl")
      .replace(/(?:滴|迪|低|弟|地|的)[，,、.\s]*(?:滴|迪|低|弟|地|的)[，,、.\s]*(?:艾|爱|挨)(?:尔|耳|儿|乐|了|勒)?/g, "ddl")
      .replace(/(?:戴德莱恩|代德莱恩|带的来因|带的赖因|戴的来因|代的来因|得来因)/g, "deadline")
      .replace(/[﹕：]/g, ":")
      .replace(/[；;]/g, "，")
      .replace(/\s+/g, " ");

    let previous = "";
    while (normalized !== previous) {
      previous = normalized;
      normalized = normalized.replace(/([\u3400-\u9fff\d])\s+(?=[\u3400-\u9fff\d])/g, "$1");
    }

    const number = "([零〇一二三四五六七八九十两\\d]{1,3})";
    const timeBoundary = "(?=$|[，,。！？!?、]|凌晨|清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜里|夜间|洗漱|刷牙|睡觉|睡眠|休息|起床|出发|回来|回家|看书|学习|健身|吃饭|开会|上课|下班)";
    normalized = normalized
      .replace(new RegExp(`${number}\\s*[店电]\\s*`, "g"), "$1点")
      .replace(new RegExp(`${number}点\\s*[办伴班版般]${timeBoundary}`, "g"), "$1点半");
    return normalized.trim();
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

  function clauseBounds(text, index) {
    let start = 0;
    let end = text.length;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (CLAUSE_BOUNDARY.test(text[cursor])) {
        start = cursor + 1;
        break;
      }
    }
    for (let cursor = index; cursor < text.length; cursor += 1) {
      if (CLAUSE_BOUNDARY.test(text[cursor])) {
        end = cursor;
        break;
      }
    }
    return { start, end, text: text.slice(start, end) };
  }

  function closestClausePeriod(text, mentionStart, mentionEnd) {
    const bounds = clauseBounds(text, mentionStart);
    const clause = bounds.text;
    const matches = [...clause.matchAll(new RegExp(PERIOD_SOURCE, "g"))]
      .map((match) => ({ value: match[0], start: bounds.start + match.index, end: bounds.start + match.index + match[0].length }))
      .filter((item) => item.end <= mentionStart || item.start >= mentionEnd)
      .map((item) => ({ ...item, distance: item.end <= mentionStart ? mentionStart - item.end : item.start - mentionEnd }))
      .sort((a, b) => a.distance - b.distance);
    return matches[0] || null;
  }

  function inferPeriodFromClause(clause, hour) {
    if (NIGHT_ACTIONS.test(clause) && (hour === 12 || (hour >= 1 && hour <= 11))) return "晚上";
    if (MORNING_ACTIONS.test(clause) && hour >= 1 && hour <= 11) return "早上";
    if (NOON_ACTIONS.test(clause) && hour >= 1 && hour <= 12) return "中午";
    return "";
  }

  function normalizeClock(hourValue, minuteValue, periodValue) {
    let hour = Number(hourValue);
    let minute = Number(minuteValue);
    const period = PERIOD_CANONICAL[periodValue] || periodValue || "";
    if (["下午", "傍晚"].includes(period) && hour < 12) hour += 12;
    if (period === "晚上") hour = hour === 0 || hour === 12 ? 24 : hour < 12 ? hour + 12 : hour;
    if (period === "中午" && hour < 11) hour += 12;
    if (period === "凌晨" && hour === 12) hour = 0;
    hour = Math.min(24, Math.max(0, hour));
    minute = Math.min(55, Math.max(0, Math.round(minute / 5) * 5));
    if (hour === 24) minute = 0;
    return {
      hour,
      minute,
      value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      period,
      dayBoundary: hour === 24 ? "end" : "start",
    };
  }

  function buildTimeMention(text, match, kind) {
    const beforePeriod = match[1] || "";
    const hour = parseNumber(match[2]);
    const rawMinute = kind === "colon" ? Number(match[3]) : match[3] === "半" ? 30 : parseNumber(String(match[3] || "").replace("分", "")) || 0;
    const afterPeriod = match[4] || "";
    const start = match.index;
    const end = start + match[0].length;
    let qualifier = beforePeriod || afterPeriod;
    let qualifierSource = "";
    let qualifierBinding = qualifier ? (beforePeriod ? "before" : "after") : "";
    if (!qualifier) {
      const nearby = closestClausePeriod(text, start, end);
      if (nearby) {
        qualifier = nearby.value;
        qualifierSource = nearby.value;
        qualifierBinding = "clause";
      }
    }
    const clause = clauseBounds(text, start).text;
    if (!qualifier) {
      qualifier = inferPeriodFromClause(clause, hour);
      if (qualifier) qualifierBinding = "semantic";
    }
    const clock = normalizeClock(hour, rawMinute, qualifier);
    const source = match[0].trim();
    const sources = [...new Set([source, qualifierSource].filter(Boolean))];
    return {
      ...clock,
      source,
      sources,
      start,
      end,
      qualifierBinding,
      confidence: qualifierBinding === "before" || qualifierBinding === "after" ? 0.99 : qualifierBinding === "clause" ? 0.92 : qualifierBinding === "semantic" ? 0.78 : 0.72,
    };
  }

  function extractTimeMentions(rawText) {
    const text = normalizeTranscript(rawText);
    const mentions = [];
    const occupied = [];
    const colonPattern = new RegExp(`(${PERIOD_SOURCE})?\\s*(${NUMBER_SOURCE})\\s*:\\s*(\\d{1,2})\\s*(${PERIOD_SOURCE})?`, "g");
    const spokenPattern = new RegExp(`(${PERIOD_SOURCE})?\\s*(${NUMBER_SOURCE})\\s*[点时电]\\s*(半|${NUMBER_SOURCE}分?)?\\s*(${PERIOD_SOURCE})?`, "g");

    for (const match of text.matchAll(colonPattern)) {
      const mention = buildTimeMention(text, match, "colon");
      mentions.push(mention);
      occupied.push([mention.start, mention.end]);
    }
    for (const match of text.matchAll(spokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (occupied.some(([from, to]) => start < to && end > from)) continue;
      mentions.push(buildTimeMention(text, match, "spoken"));
    }
    return mentions.sort((a, b) => a.start - b.start);
  }

  function addScore(scores, intent, amount, evidence) {
    const current = scores.get(intent) || { intent, score: 0, evidence: [] };
    current.score += amount;
    if (evidence) current.evidence.push(evidence);
    scores.set(intent, current);
  }

  function classifyIntent(rawText) {
    const text = normalizeTranscript(rawText);
    const scores = new Map();
    addScore(scores, "create", 0.5, "domain-default");
    const rules = [
      ["clear-all", /(清空|清除|删除|移除|删掉).*(全部|所有)|(全部|所有).*(清空|清除|删除|移除|删掉)/, 12],
      ["delete", /(删除|移除|删掉|清除)/, 8],
      ["uncomplete", /(取消勾选|取消完成|标记为未完成|恢复未完成)/, 12],
      ["complete", /(打勾|勾选|标记完成|做完|完成了|^完成)/, 8],
      ["extend", /(延期|延长|再续期|续期\s*[零〇一二三四五六七八九十两\d]+\s*天)/, 10],
      ["edit", /(修改|更改|改成|改为|改名|更名|改到|改在|调到|调整|挪到|提前到|延后到|设置)/, 8],
      ["query", /(有什么|有哪些|列出|告诉我|汇总|查询|多少|还剩什么|还有什么|需要做什么|该做什么)/, 9],
      ["navigate", /(打开|进入|查看|切换|回到)/, 5],
      ["create", /(创建|添加|新增|记下|记一下|提醒我|安排一个|安排一条)/, 10],
    ];
    rules.forEach(([intent, pattern, score]) => {
      const match = text.match(pattern);
      if (match) addScore(scores, intent, score, match[0]);
    });
    if (/(每天|每日|工作日|周末|每周|星期|\d{1,2}:\d{2}|[零〇一二三四五六七八九十两\d]+[点时电])/.test(text)) addScore(scores, "create", 2, "task-slots");
    if (/(任务|事项|日程|安排)/.test(text)) {
      for (const intent of ["create", "delete", "edit", "complete", "query", "clear-all"]) {
        if (scores.has(intent)) addScore(scores, intent, 1, "domain-object");
      }
    }
    const ranked = [...scores.values()].sort((a, b) => b.score - a.score);
    const top = ranked[0] || { intent: "clarify", score: 0, evidence: [] };
    const second = ranked[1] || { score: 0 };
    const margin = top.score - second.score;
    const confidence = Math.max(0.35, Math.min(0.99, 0.55 + top.score / 30 + margin / 24));
    return { intent: top.intent, confidence, evidence: top.evidence, ranked };
  }

  function normalizeComparable(value) {
    return normalizeTranscript(value)
      .toLowerCase()
      .replace(/(?:任务|事项|日程|安排|ddl|deadline)/ig, "")
      .replace(/[\s\d０-９·。、，,：:（）()\-]/g, "");
  }

  function levenshtein(left, right) {
    if (!left) return right.length;
    if (!right) return left.length;
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let diagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const previous = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
        diagonal = previous;
      }
    }
    return row[right.length];
  }

  function similarity(leftValue, rightValue) {
    const left = normalizeComparable(leftValue);
    const right = normalizeComparable(rightValue);
    if (!left || !right) return 0;
    if (left.includes(right) || right.includes(left)) return 1;
    const distance = levenshtein(left, right);
    return Math.max(0, 1 - distance / Math.max(left.length, right.length));
  }

  function analyze(rawText) {
    const normalized = normalizeTranscript(rawText);
    return {
      raw: String(rawText || ""),
      normalized,
      intent: classifyIntent(normalized),
      times: extractTimeMentions(normalized),
      domain: "jinke-app-functions",
      modelVersion: 1,
    };
  }

  function scoreCandidate(candidate, context = {}) {
    const text = normalizeTranscript(candidate?.text || "");
    if (!text) return -Infinity;
    const analysis = analyze(text);
    const acoustic = Math.max(0, Math.min(1, Number(candidate?.confidence) || 0));
    const knownTasks = [
      ...(Array.isArray(context.dailyTasks) ? context.dailyTasks : []),
      ...(Array.isArray(context.criticalTasks) ? context.criticalTasks : []),
    ];
    const targetSimilarity = knownTasks.reduce((best, task) => Math.max(best, similarity(text, task?.title || "")), 0);
    const hasOperation = /(创建|添加|新增|删除|移除|清除|完成|勾选|修改|更改|改到|延期|续期|查询|有什么|打开|切换)/.test(text);
    const hasTaskSlot = analysis.times.length > 0 || /(每天|工作日|周末|星期|周[一二三四五六日天]|ddl|deadline|截止|无期限|无ddl)/i.test(text);
    const hasExplicitTaskType = /(?:有|无)?(?:ddl|deadline)|关键(?:任务|事项)|日常(?:任务|事项)/i.test(text);
    const domainFit = Math.min(1, (analysis.intent.confidence || 0) * 0.55 + (hasOperation ? 0.2 : 0) + (hasTaskSlot ? 0.15 : 0) + targetSimilarity * 0.25);
    return acoustic * 0.68 + domainFit * 0.27 + (hasExplicitTaskType ? 0.05 : 0);
  }

  function rankCandidates(rawCandidates, context = {}) {
    const candidates = (Array.isArray(rawCandidates) ? rawCandidates : [])
      .map((candidate, index) => ({
        ...candidate,
        text: normalizeTranscript(candidate?.text || ""),
        index,
      }))
      .filter((candidate) => candidate.text)
      .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, context) }))
      .sort((left, right) => right.score - left.score || left.index - right.index);
    return { best: candidates[0] || null, candidates };
  }

  window.JINKE_DOMAIN_NLU = Object.freeze({
    normalizeTranscript,
    parseNumber,
    extractTimeMentions,
    classifyIntent,
    similarity,
    analyze,
    scoreCandidate,
    rankCandidates,
  });
})();
