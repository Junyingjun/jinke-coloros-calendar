const { APP_DATA, getCalendarMarker, getCriticalReminder, shouldRemindCritical, getDateMeta, getWeekDates, getMonthDates, shiftDateKeyByMonth, repeatDaysFromValue, repeatLabelFromDays, Icon, IconButton, SectionHeader, DailyTaskRow, CriticalTaskRow, Sheet, BackHeader, BarRow } = window;

const WEEKDAY_BUTTONS = ["一", "二", "三", "四", "五", "六", "日"];

function SegmentedChoice({ label, value, options, onChange, compact = false }) {
  return (
    <div className={`jinke-segments ${compact ? "compact" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
        const selected = String(value) === String(optionValue);
        return <button type="button" role="radio" aria-checked={selected} className={selected ? "selected" : ""} onClick={() => onChange(optionValue)} key={optionValue}>{optionLabel}</button>;
      })}
    </div>
  );
}

function WeekdayPicker({ value, repeatDays, onChange }) {
  const selectedDays = repeatDaysFromValue(value, repeatDays);
  const toggleDay = (day) => {
    const next = selectedDays.includes(day) ? selectedDays.filter((item) => item !== day) : [...selectedDays, day].sort((a, b) => a - b);
    onChange(next, repeatLabelFromDays(next));
  };
  return (
    <div className="weekday-picker" role="group" aria-label="重复星期">
      <div className="weekday-summary"><span>重复</span><strong>{repeatLabelFromDays(selectedDays)}</strong></div>
      <div className="weekday-buttons">
        {WEEKDAY_BUTTONS.map((label, index) => <button type="button" aria-pressed={selectedDays.includes(index + 1)} className={selectedDays.includes(index + 1) ? "selected" : ""} onClick={() => toggleDay(index + 1)} key={label}>{label}</button>)}
      </div>
    </div>
  );
}

function Stepper({ label, value, min, max, step = 1, wrap = false, onChange, format = (item) => item }) {
  const safeValue = Math.min(max, Math.max(min, Number(value) || 0));
  const decrease = () => onChange(wrap && safeValue <= min ? max : Math.max(min, safeValue - step));
  const increase = () => onChange(wrap && safeValue >= max ? min : Math.min(max, safeValue + step));
  return (
    <div className="jinke-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`${label}减少`} disabled={!wrap && safeValue <= min} onClick={decrease}>−</button>
      <output aria-label={label}>{format(safeValue)}</output>
      <button type="button" aria-label={`${label}增加`} disabled={!wrap && safeValue >= max} onClick={increase}>＋</button>
    </div>
  );
}

function parseClock(value, fallback = "09:00") {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  const source = match || fallback.match(/^(\d{1,2}):(\d{2})$/);
  const minute = Math.min(55, Math.max(0, Math.round(Number(source?.[2] || 0) / 5) * 5));
  return { hour: Math.min(24, Math.max(0, Number(source?.[1] || 9))), minute };
}

function TimePicker({ label, value, onChange, allowUnset = true }) {
  const enabled = Boolean(value && value !== "待定");
  const clock = parseClock(value);
  const update = (hour, minute) => onChange(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  return (
    <div className="jinke-time-picker" aria-label={label}>
      <div className="picker-head"><span>{label}</span>{allowUnset ? <button type="button" aria-pressed={enabled} onClick={() => onChange(enabled ? null : "09:00")}>{enabled ? "清除" : "设置"}</button> : null}</div>
      {enabled || !allowUnset ? <div className="time-stepper-row">
        <Stepper label={`${label}小时`} value={clock.hour} min={0} max={24} wrap onChange={(hour) => update(hour, clock.minute)} format={(item) => String(item).padStart(2, "0")} />
        <span className="time-colon">:</span>
        <Stepper label={`${label}分钟`} value={clock.minute} min={0} max={55} step={5} wrap onChange={(minute) => update(clock.hour, minute)} format={(item) => String(item).padStart(2, "0")} />
      </div> : <span className="picker-empty">未设置</span>}
    </div>
  );
}

function reminderToMinutes(value) {
  const text = String(value || "到点提醒");
  if (text === "不提醒") return null;
  if (text === "到点提醒") return 0;
  const hours = Number(text.match(/(\d+)\s*小时/)?.[1] || 0);
  const minutes = Number(text.match(/(\d+)\s*分钟/)?.[1] || 0);
  return Math.min(1435, Math.max(0, Math.round((hours * 60 + minutes) / 5) * 5));
}

function reminderFromMinutes(totalMinutes) {
  if (totalMinutes === null) return "不提醒";
  const safe = Math.min(1435, Math.max(0, Math.round((Number(totalMinutes) || 0) / 5) * 5));
  if (safe === 0) return "到点提醒";
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `提前${hours ? `${hours}小时` : ""}${minutes ? `${minutes}分钟` : ""}`;
}

function ReminderPicker({ value, onChange }) {
  const total = reminderToMinutes(value);
  const enabled = total !== null;
  const safe = total || 0;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  const update = (nextHours, nextMinutes) => onChange(reminderFromMinutes(Math.min(1435, nextHours * 60 + nextMinutes)));
  return (
    <div className="jinke-reminder-picker" aria-label="提前提醒">
      <div className="picker-head"><span>提醒</span><button type="button" aria-pressed={enabled} className={enabled ? "enabled" : ""} onClick={() => onChange(enabled ? "不提醒" : "到点提醒")}>{enabled ? "已开启" : "不提醒"}</button></div>
      {enabled ? <>
        <div className="reminder-stepper-row">
          <div><small>小时</small><Stepper label="提前小时" value={hours} min={0} max={23} wrap onChange={(next) => update(next, minutes)} /></div>
          <div><small>分钟</small><Stepper label="提前分钟" value={minutes} min={0} max={55} step={5} wrap onChange={(next) => update(hours, next)} /></div>
        </div>
        <output className="reminder-summary">{reminderFromMinutes(safe)}</output>
      </> : null}
    </div>
  );
}

function deadlineToDateInput(deadline) {
  if (!deadline) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return deadline;
  const today = new Date();
  const relative = String(deadline).match(/^(今天截止|今天|明天|后天|(\d+)天后)$/);
  if (relative) {
    const days = relative[1] === "明天" ? 1 : relative[1] === "后天" ? 2 : Number(relative[2] || 0);
    const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days, 12);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
  }
  const absolute = String(deadline).match(/(\d{1,2})月(\d{1,2})日/);
  if (!absolute) return "";
  let target = new Date(today.getFullYear(), Number(absolute[1]) - 1, Number(absolute[2]), 12);
  if (target < new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)) target = new Date(today.getFullYear() + 1, Number(absolute[1]) - 1, Number(absolute[2]), 12);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

function dateInputToDeadline(value) {
  if (!value) return null;
  const [, month, day] = value.split("-").map(Number);
  return `${month}月${day}日`;
}

function DatePicker({ value, onChange }) {
  const today = new Date();
  const iso = deadlineToDateInput(value) || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [year, month, day] = iso.split("-").map(Number);
  const maxDay = new Date(year, month, 0).getDate();
  const update = (nextYear, nextMonth, nextDay) => {
    const safeDay = Math.min(new Date(nextYear, nextMonth, 0).getDate(), nextDay);
    onChange(dateInputToDeadline(`${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`));
  };
  return (
    <div className="jinke-date-picker" aria-label="截止日期">
      <div className="picker-head"><span>截止</span><button type="button" aria-pressed={Boolean(value)} onClick={() => onChange(value ? null : dateInputToDeadline(iso))}>{value ? "清除" : "设置"}</button></div>
      {value ? <div className="date-stepper-row">
        <div><small>年</small><Stepper label="截止年份" value={year} min={today.getFullYear()} max={today.getFullYear() + 10} onChange={(next) => update(next, month, day)} /></div>
        <div><small>月</small><Stepper label="截止月份" value={month} min={1} max={12} onChange={(next) => update(year, next, day)} /></div>
        <div><small>日</small><Stepper label="截止日期" value={day} min={1} max={maxDay} onChange={(next) => update(year, month, next)} /></div>
      </div> : <span className="picker-empty">无 DDL</span>}
    </div>
  );
}

function WeekStrip({ selectedDateKey, todayDateKey, onSelectDate }) {
  return (
    <div className="week-strip" aria-label="本周">
      {getWeekDates(selectedDateKey).map((item) => {
        const isToday = item.dateKey === todayDateKey;
        const isSelected = item.dateKey === selectedDateKey;
        return (
        <button className={`day-cell ${isToday ? "today" : ""} ${isSelected && !isToday ? "selected" : ""}`} aria-current={isToday ? "date" : undefined} aria-pressed={isSelected} onClick={() => onSelectDate(item.dateKey)} key={item.dateKey}>
          <span className="day-name">{item.day}</span>
          <span className="day-number">{item.date}</span>
          <span className="load-dots">{Array.from({ length: Math.min(item.load, 3) }).map((_, index) => <span key={index} />)}</span>
        </button>
        );
      })}
    </div>
  );
}

function MonthPeekPanel({ selectedDateKey, todayDateKey, onSelectDate }) {
  const selected = getDateMeta(selectedDateKey);
  const monthDays = getMonthDates(selectedDateKey);
  return (
    <div className="peek-panel">
      <div className="peek-head">
        <button className="month-nav-button" type="button" aria-label="上个月" onClick={() => onSelectDate(shiftDateKeyByMonth(selectedDateKey, -1))}><Icon name="back" size={17} /></button>
        <span className="peek-title">{selected.year} 年 {selected.month} 月</span>
        <button className="month-nav-button" type="button" aria-label="下个月" onClick={() => onSelectDate(shiftDateKeyByMonth(selectedDateKey, 1))}><Icon name="chevronRight" size={17} /></button>
      </div>
      <div className="month-weekdays" aria-hidden="true">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="month-grid">
        {monthDays.map((item) => {
          const today = item.dateKey === todayDateKey;
          const isSelected = item.dateKey === selectedDateKey;
          return (
            <button
              type="button"
              className={`month-day ${item.muted ? "muted" : ""} ${today ? "today" : ""} ${isSelected && !today ? "selected" : ""} ${item.load ? "busy" : ""}`}
              aria-label={`${item.year}年${item.month}月${item.date}日`}
              aria-current={today ? "date" : undefined}
              aria-pressed={isSelected}
              onClick={() => onSelectDate(item.dateKey)}
              key={item.dateKey}
            >{item.date}</button>
          );
        })}
      </div>
      <button className="peek-today-action" type="button" onClick={() => onSelectDate(todayDateKey)}>今天</button>
    </div>
  );
}

function ViewMenu({ onSelect, onClose }) {
  return (
    <Sheet onClose={onClose} label="检视方式">
      <div className="menu-list menu-list-first">
        {[{ id: "day", title: "日", icon: "calendar" }, { id: "month", title: "月", icon: "year" }].map((item) => (
          <button className="menu-row" key={item.id} onClick={() => onSelect(item.id)}>
            <span className="menu-icon"><Icon name={item.icon} size={18} /></span>
            <span className="menu-title">{item.title}</span>
            <Icon name="chevronRight" size={17} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function TodayScreen({ tasks, deadlineTasks, onToggle, onEdit, onDeleteDaily, onToggleCritical, onOpenCritical, onDeleteCritical, onMenu, viewMode, onOpenView, selectedDateKey, todayDateKey, onSelectDate, onOpenDayArchive }) {
  const done = tasks.filter((task) => task.done).length;
  const percent = Math.round((done / Math.max(tasks.length, 1)) * 100);
  const selectedDay = getDateMeta(selectedDateKey);
  const isToday = selectedDateKey === todayDateKey;
  const dateLabel = `${selectedDay.month}月${selectedDay.date}日`;
  const calendarMarker = getCalendarMarker(selectedDateKey);
  return (
    <main className="screen today-screen">
      <div className="top-row">
        <IconButton name="menu" label="更多" onClick={onMenu} />
        <button className="view-trigger pressable" onClick={onOpenView}>{viewMode === "day" ? "日" : "月"}<Icon name="chevronDown" size={15} /></button>
      </div>
      <div className="today-responsive-grid">
        <div className="today-left-pane">
          <section className="today-calendar-pane" aria-label="日期与检视">
            <div className="page-title-row">
              <div>
                <div className="eyebrow-line">
                  <p className="eyebrow">星期{selectedDay.day}{calendarMarker.short ? ` · ${calendarMarker.short}` : ""}</p>
                  <button className="day-archive-trigger" aria-label={`查看${dateLabel}是什么日子`} onClick={onOpenDayArchive}><Icon name="spark" size={13} /></button>
                </div>
                <h1 className="page-title">{dateLabel}</h1>
              </div>
              <div className="page-meta">{done}/{tasks.length} 已完成</div>
            </div>
            {viewMode === "month" ? <MonthPeekPanel selectedDateKey={selectedDateKey} todayDateKey={todayDateKey} onSelectDate={onSelectDate} /> : <WeekStrip selectedDateKey={selectedDateKey} todayDateKey={todayDateKey} onSelectDate={onSelectDate} />}
            <div className="progress-line" aria-label={`${dateLabel}完成 ${percent}%`}>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
              <span className="progress-copy">{percent}%</span>
            </div>
          </section>
          {deadlineTasks.length ? (
            <section className="today-ddl-pane" aria-label="当天 DDL 事项">
              <SectionHeader title="DDL" />
              <div className="critical-stack daily-ddl-stack">{deadlineTasks.map((task) => <CriticalTaskRow task={task} onToggle={onToggleCritical} onOpen={onOpenCritical} onDelete={onDeleteCritical} key={task.id} />)}</div>
            </section>
          ) : null}
        </div>
        <section className="today-daily-pane" aria-label="日常事项">
          <SectionHeader title={isToday ? "今天" : `星期${selectedDay.day}`} note={`${tasks.length - done} 项待完成`} />
          {tasks.some((task) => task.demo) ? <div className="demo-guide">左滑删除演示，点下方语音键创建第一项日程</div> : null}
          <div className="task-list">{tasks.map((task) => <DailyTaskRow task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDeleteDaily} key={task.id} />)}</div>
          {!tasks.length ? <div className="empty-guide">点下方语音键，创建第一项日程</div> : null}
        </section>
      </div>
    </main>
  );
}

const DAY_ARCHIVE_TABS = [
  { id: "china", label: "中国" },
  { id: "holidays", label: "全球节日" },
  { id: "events", label: "历史事件" },
  { id: "people", label: "人物纪念" },
];

const ON_THIS_DAY_MEMORY = new Map();
const ON_THIS_DAY_REQUESTS = new Map();

function normalizeOnThisDayItems(items, source, kind = "") {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = `${item?.year ?? ""}:${item?.text || ""}`;
    if (!item?.text || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80).map((item) => ({
    text: item.text,
    year: Number.isFinite(item.year) ? item.year : null,
    source,
    kind,
    url: item.pages?.[0]?.content_urls?.desktop?.page || "",
  }));
}

function mergePeopleItems(births, deaths) {
  const seen = new Set();
  return [
    ...normalizeOnThisDayItems(births, "Wikimedia · 人物纪念", "诞辰"),
    ...normalizeOnThisDayItems(deaths, "Wikimedia · 人物纪念", "逝世"),
  ].filter((item) => {
    const key = `${item.year ?? ""}:${item.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 120);
}

function getArchiveCacheKey(category, month, day) {
  return `${month}-${day}-${category}`;
}

function readArchiveCache(category, month, day) {
  const key = getArchiveCacheKey(category, month, day);
  if (ON_THIS_DAY_MEMORY.has(key)) return ON_THIS_DAY_MEMORY.get(key);
  try {
    const cached = JSON.parse(localStorage.getItem(`jinke-onthisday-v2-${key}`) || "null");
    if (Array.isArray(cached?.items)) {
      ON_THIS_DAY_MEMORY.set(key, cached.items);
      return cached.items;
    }
    const legacy = JSON.parse(localStorage.getItem(`jinke-onthisday-${month}-${day}`) || "null");
    const legacyItems = category === "people"
      ? mergePeopleItems(legacy?.data?.births || [], legacy?.data?.deaths || [])
      : legacy?.data?.[category];
    if (Array.isArray(legacyItems) && legacyItems.length) {
      ON_THIS_DAY_MEMORY.set(key, legacyItems);
      return legacyItems;
    }
  } catch {}
  return null;
}

function requestOnThisDayType(type, month, day) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 18000);
  return fetch(`https://api.wikimedia.org/feed/v1/wikipedia/zh/onthisday/${type}/${month}/${day}`, {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  }).then((response) => {
    if (!response.ok) throw new Error("On this day unavailable");
    return response.json();
  }).finally(() => window.clearTimeout(timeout));
}

function loadArchiveCategory(category, month, day) {
  const key = getArchiveCacheKey(category, month, day);
  const cached = readArchiveCache(category, month, day);
  if (cached) return Promise.resolve(cached);
  if (ON_THIS_DAY_REQUESTS.has(key)) return ON_THIS_DAY_REQUESTS.get(key);
  const types = category === "people" ? ["births", "deaths"] : [category];
  const request = Promise.all(types.map((type) => requestOnThisDayType(type, month, day)))
    .then((responses) => {
      const items = category === "people"
        ? mergePeopleItems(responses[0]?.births, responses[1]?.deaths)
        : normalizeOnThisDayItems(responses[0]?.[category], `Wikimedia · ${category === "holidays" ? "全球节日" : "历史事件"}`);
      ON_THIS_DAY_MEMORY.set(key, items);
      try { localStorage.setItem(`jinke-onthisday-v2-${key}`, JSON.stringify({ savedAt: Date.now(), items })); } catch {}
      return items;
    })
    .finally(() => ON_THIS_DAY_REQUESTS.delete(key));
  ON_THIS_DAY_REQUESTS.set(key, request);
  return request;
}

function CalendarDaySheet({ dateKey, onClose, active, index, onActiveChange, onIndexChange }) {
  const [remote, setRemote] = React.useState({ holidays: [], events: [], people: [] });
  const [status, setStatus] = React.useState(active === "china" ? "ready" : "loading");
  const marker = getCalendarMarker(dateKey);
  const [, month, day] = dateKey.split("-");
  const dateLabel = `${Number(month)}月${Number(day)}日`;

  React.useEffect(() => {
    if (active === "china") {
      setStatus("ready");
      return undefined;
    }
    let activeRequest = true;
    const cached = readArchiveCache(active, month, day);
    if (cached) {
      setRemote((current) => ({ ...current, [active]: cached }));
      setStatus("ready");
    } else {
      setStatus("loading");
    }
    loadArchiveCategory(active, month, day)
      .then((items) => {
        if (!activeRequest) return;
        setRemote((current) => ({ ...current, [active]: items }));
        setStatus("ready");
      })
      .catch(() => { if (activeRequest) setStatus((current) => current === "ready" ? current : "offline"); });
    return () => { activeRequest = false; };
  }, [active, month, day]);

  const sections = {
    china: [{ text: marker.full, year: null, source: marker.source }],
    ...remote,
  };
  const items = sections[active] || [];
  const current = items.length ? items[index % items.length] : null;
  const selectTab = (tab) => { onActiveChange(tab); onIndexChange(0); };

  return (
    <Sheet onClose={onClose} labelledBy="day-archive-title">
      <div className="day-archive-head">
        <div><p className="day-archive-date">{dateLabel}</p><h2 className="sheet-title" id="day-archive-title">今天是什么日子</h2></div>
        <button className="sheet-close" aria-label="关闭" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="day-archive-tabs" role="tablist" aria-label="日期内容分类">
        {DAY_ARCHIVE_TABS.map((tab) => <button role="tab" aria-selected={active === tab.id} className={active === tab.id ? "active" : ""} onClick={() => selectTab(tab.id)} key={tab.id}>{tab.label}</button>)}
      </div>
      <div className="day-archive-card" aria-live="polite">
        {current ? (
          <>
            {current.kind ? <span className="day-archive-kind">{current.kind}</span> : null}
            {current.year ? <span className="day-archive-year">{current.year > 0 ? `${current.year} 年` : `公元前 ${Math.abs(current.year)} 年`}</span> : null}
            <p className="day-archive-story">{current.text}</p>
            {current.url
              ? <a className="day-archive-source source-link" href={current.url} target="_blank" rel="noreferrer">{current.source}<Icon name="chevronRight" size={12} /></a>
              : <span className="day-archive-source">{current.source}</span>}
          </>
        ) : <p className="day-archive-empty">{status === "loading" ? "正在读取全球日期档案…" : "当前分类暂时没有中文条目"}</p>}
      </div>
      <div className="day-archive-actions">
        <span>{current ? `${(index % items.length) + 1} / ${items.length}` : status === "offline" ? "离线" : "联网"}</span>
        <button className="secondary-button day-archive-next" disabled={items.length < 2} onClick={() => onIndexChange((index + 1) % items.length)}><Icon name="refresh" size={16} />换一条</button>
      </div>
    </Sheet>
  );
}

function CriticalScreen({ tasks, onToggle, onOpen, onDelete, onMenu, onOpenReminders }) {
  const withDDL = tasks.filter((task) => task.deadline);
  const withoutDDL = tasks.filter((task) => !task.deadline);
  return (
    <main className="screen critical-screen">
      <div className="top-row"><IconButton name="menu" label="更多" onClick={onMenu} /><button className="view-trigger pressable" type="button" aria-label="打开DDL提醒设置" onClick={onOpenReminders}><Icon name="bell" size={16} /></button></div>
      <div className="page-title-row">
        <h1 className="page-title">关键事项</h1>
        <div className="page-meta">{tasks.length} 件</div>
      </div>
      <div className="critical-responsive-grid">
        <section className="critical-pane critical-with-ddl" aria-label="有 DDL 的关键事项">
          <SectionHeader title="有 DDL" />
          {withDDL.some((task) => task.demo) ? <div className="demo-guide">左滑删除演示，点下方语音键创建第一个 DDL</div> : null}
          <div className="critical-stack">{withDDL.map((task) => <CriticalTaskRow task={task} onToggle={onToggle} onOpen={onOpen} onDelete={onDelete} key={task.id} />)}</div>
          {!withDDL.length ? <div className="empty-guide">点下方语音键，创建第一个 DDL</div> : null}
        </section>
        <section className="critical-pane critical-without-ddl" aria-label="无 DDL 的关键事项">
          <SectionHeader title="无 DDL" note="长期关注" />
          <div className="critical-stack">{withoutDDL.map((task) => <CriticalTaskRow task={task} onToggle={onToggle} onOpen={onOpen} onDelete={onDelete} key={task.id} />)}</div>
        </section>
      </div>
    </main>
  );
}

function Waveform() {
  return <div className="waveform" aria-hidden="true">{[11, 20, 26, 16, 24, 18, 9].map((height, index) => <span key={index} style={{ height }} />)}</div>;
}

function VoiceComposer({ phase, transcript, parsedCommand, draftTask, onDraftTaskChange, onTranscript, onStop, onUseInputMethod, onConfirm, onClose, speechAvailable, speechStatus }) {
  const text = transcript.trim();
  const editableTask = draftTask || parsedCommand.task;
  const updateDraft = (field, value) => onDraftTaskChange({ ...(draftTask || parsedCommand.task), [field]: value });
  const updateRepeat = (repeatDays, repeat) => onDraftTaskChange({ ...(draftTask || parsedCommand.task), repeatDays, repeat, hasRepeat: repeatDays.length > 0 });
  const updateType = (type) => {
    const next = { ...(draftTask || parsedCommand.task), type };
    onDraftTaskChange(type === "critical" ? { ...next, reminder: getCriticalReminder(next.time === "待定" ? null : next.time) } : next);
  };
  const updateCriticalTime = (time) => onDraftTaskChange({ ...(draftTask || parsedCommand.task), time: time || "待定", hasTime: Boolean(time), reminder: getCriticalReminder(time || null) });
  const confirm = () => {
    if (parsedCommand.intent === "create") {
      onConfirm({ ...parsedCommand, heading: editableTask.title.trim(), task: { ...editableTask, title: editableTask.title.trim() } });
    } else {
      onConfirm(parsedCommand);
    }
  };
  const canConfirm = parsedCommand.valid && (parsedCommand.intent !== "create" || Boolean(editableTask?.title?.trim()));
  const statusText = {
    starting: "正在启动离线语音…",
    "requesting-permission": "等待麦克风授权…",
    "preparing-model": "正在准备离线中文模型…",
    "model-ready": "离线中文模型已就绪…",
    listening: "正在听…",
    processing: "正在处理…",
    "permission-denied": "麦克风权限未开启",
    error: "离线语音组件启动失败",
  }[speechStatus] || "正在听…";
  return (
    <Sheet onClose={onClose} labelledBy={phase === "listening" ? "voice-title" : undefined} label={phase === "review" ? "确认语音指令" : undefined}>
      {phase === "listening" ? (
        <>
          <h2 className="sheet-title" id="voice-title">今刻助手</h2>
          <div className="voice-stage">
            <button className="voice-orbit pressable" onClick={onStop} aria-label="停止并处理"><Waveform /></button>
            <div className="voice-transcript">{text || statusText}</div>
          </div>
          <input className="composer-input" value={transcript} onFocus={onUseInputMethod} onChange={(event) => onTranscript(event.target.value)} placeholder="输入操作或安排" aria-label={speechAvailable ? "输入操作或安排" : "语音不可用，请输入操作或安排"} />
          <div className="button-row">
            <button className="secondary-button pressable" onClick={onClose}>取消</button>
            <button className="primary-button pressable" onClick={onStop}>停止并处理</button>
          </div>
        </>
      ) : (
        <>
          {parsedCommand.intent === "create" && editableTask?.span ? (
            <div className="edit-form voice-edit-form edit-form-first">
              <label className="edit-field"><span className="edit-label">名称</span><input className="edit-input title-input" value={editableTask.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
              <div className="parsed-card">
                <div className="field-list">
                  <div className="field-row"><span className="field-label">去程 DDL</span><span className="field-value">{editableTask.span.start.deadline}</span></div>
                  <div className="field-row"><span className="field-label">返程 DDL</span><span className="field-value">{editableTask.span.end.deadline}</span></div>
                </div>
              </div>
              <label className="edit-field stacked"><span className="edit-label">备注</span><textarea className="edit-input edit-textarea" rows="2" value={editableTask.note || ""} onChange={(event) => updateDraft("note", event.target.value)} /></label>
            </div>
          ) : parsedCommand.intent === "create" && editableTask ? (
            <div className="edit-form voice-edit-form edit-form-first">
              <label className="edit-field"><span className="edit-label">名称</span><input className="edit-input title-input" value={editableTask.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
              <div className="edit-field stacked custom-control-field"><span className="edit-label">类型</span><SegmentedChoice label="任务类型" value={editableTask.type} options={[["daily", "日常事务"], ["critical", "关键事务"]]} onChange={updateType} /></div>
              {editableTask.type === "daily" ? (
                <>
                  <div className="edit-field stacked custom-control-field"><TimePicker label="时间" value={editableTask.time === "待定" ? null : editableTask.time} onChange={(time) => updateDraft("time", time || "待定")} /></div>
                  <div className="edit-field stacked custom-control-field"><TimePicker label="结束" value={editableTask.endTime || null} onChange={(time) => updateDraft("endTime", time || null)} /></div>
                  <div className="edit-field stacked custom-control-field"><WeekdayPicker value={editableTask.repeat} repeatDays={editableTask.repeatDays} onChange={updateRepeat} /></div>
                </>
              ) : (
                <>
                  <div className="edit-field stacked custom-control-field"><DatePicker value={editableTask.deadline} onChange={(deadline) => updateDraft("deadline", deadline)} /></div>
                  <div className="edit-field stacked custom-control-field"><TimePicker label="时间" value={editableTask.time === "待定" ? null : editableTask.time} onChange={updateCriticalTime} /></div>
                </>
              )}
              {editableTask.type === "critical"
                ? <div className="edit-field"><span className="edit-label">提醒</span><output className="edit-input edit-output">{editableTask.reminder || getCriticalReminder(null)}</output></div>
                : <div className="edit-field stacked custom-control-field"><ReminderPicker value={editableTask.reminder || "到点提醒"} onChange={(reminder) => updateDraft("reminder", reminder)} /></div>}
              <label className="edit-field stacked"><span className="edit-label">备注</span><textarea className="edit-input edit-textarea" rows="2" value={editableTask.note || ""} onChange={(event) => updateDraft("note", event.target.value)} /></label>
            </div>
          ) : (
            <div className="parsed-card parsed-card-first">
              <div className="parsed-title">{parsedCommand.heading}</div>
              <div className="field-list">
                {parsedCommand.rows.map(([label, value], index) => (
                  <div className="field-row" key={`${label}-${index}`}><span className="field-label">{label}</span><span className="field-value">{value}</span></div>
                ))}
              </div>
            </div>
          )}
          {!parsedCommand.valid ? <p className="voice-command-error" role="alert">{parsedCommand.error}</p> : null}
          <div className="button-row">
            {parsedCommand.intent !== "query" ? <button className="secondary-button pressable" onClick={onClose}>取消</button> : null}
            <button className="primary-button accent pressable" onClick={confirm} disabled={!canConfirm}>{parsedCommand.confirmLabel}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function DailyEditSheet({ task, draft, onDraftChange, onSave, onClose }) {
  if (!task || !draft) return null;
  const update = (field, value) => onDraftChange({ ...draft, [field]: value });
  const updateRepeat = (repeatDays, repeat) => onDraftChange({ ...draft, repeatDays, repeat });
  return (
    <Sheet onClose={onClose} label="编辑任务">
      <div className="edit-form edit-form-first">
        <label className="edit-field"><span className="edit-label">名称</span><input className="edit-input title-input" value={draft.title} onChange={(event) => update("title", event.target.value)} /></label>
        <div className="edit-field stacked custom-control-field"><TimePicker label="时间" value={draft.time === "待定" ? null : draft.time} onChange={(time) => update("time", time || "待定")} /></div>
        <div className="edit-field stacked custom-control-field"><TimePicker label="结束" value={draft.endTime || null} onChange={(time) => update("endTime", time || null)} /></div>
        <div className="edit-field stacked custom-control-field"><WeekdayPicker value={draft.repeat} repeatDays={draft.repeatDays} onChange={updateRepeat} /></div>
        <div className="edit-field stacked custom-control-field"><ReminderPicker value={draft.reminder} onChange={(reminder) => update("reminder", reminder)} /></div>
        <label className="edit-field stacked"><span className="edit-label">备注</span><textarea className="edit-input edit-textarea" rows="3" value={draft.note} onChange={(event) => update("note", event.target.value)} /></label>
      </div>
      <div className="button-row">
        <button className="secondary-button pressable" onClick={onClose}>取消</button>
        <button className="primary-button accent pressable" onClick={() => onSave(task.id, { ...draft, title: draft.title.trim() })} disabled={!draft.title.trim()}>保存修改</button>
      </div>
    </Sheet>
  );
}

function MoreSheet({ onClose, onOpen, themeMode, onThemeChange }) {
  const rows = [
    ["history", "历史记录", "history"],
    ["month", "月度复盘", "chart"],
    ["year", "年度复盘", "year"],
    ["permissions", "通知与权限", "bell"],
    ["voice", "语音模型", "spark"],
    ["version", "版本更新", "update"],
    ["settings", "设置", "settings"],
  ];
  return (
    <Sheet onClose={onClose} label="更多菜单">
      <div className="theme-switch theme-switch-first" role="group" aria-label="外观">
        {[['dark', '暗色'], ['system', '系统'], ['light', '亮色']].map(([mode, label]) => (
          <button className={`theme-option ${themeMode === mode ? "active" : ""}`} aria-pressed={themeMode === mode} key={mode} onClick={() => onThemeChange(mode)}>{label}</button>
        ))}
      </div>
      <div className="menu-list">
        {rows.map(([id, title, icon]) => (
          <button className="menu-row" key={id} onClick={() => onOpen(id)}>
            <span className="menu-icon"><Icon name={icon} size={18} /></span>
            <span className="menu-title">{title}</span>
            <Icon name="chevronRight" size={17} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function CriticalDetailSheet({ task, draft, renewDays, onRenewDaysChange, onDraftChange, onClose, onComplete, onRenew, onSave }) {
  if (!task || !draft) return null;
  const update = (field, value) => onDraftChange({ ...draft, [field]: value });
  const updateTime = (time) => onDraftChange({ ...draft, time: time || null, reminder: getCriticalReminder(time || null) });
  const dueCopy = task.daysLeft === null ? "无 DDL" : task.daysLeft < 0 ? `逾期 ${Math.abs(task.daysLeft)} 天` : task.daysLeft === 0 ? "今天截止" : `剩 ${task.daysLeft} 天`;
  return (
    <Sheet onClose={onClose} label="编辑关键事项">
      <div className="top-row">
        <span className={`days-left ${task.daysLeft <= 0 ? "today" : ""}`}>{dueCopy}</span>
        <IconButton name="close" label="关闭" onClick={onClose} />
      </div>
      <div className="edit-form critical-edit-form">
        <label className="edit-field"><span className="edit-label">名称</span><input className="edit-input title-input" value={draft.title} onChange={(event) => update("title", event.target.value)} /></label>
        <div className="edit-field stacked custom-control-field"><DatePicker value={draft.deadline} onChange={(deadline) => update("deadline", deadline)} /></div>
        <div className="edit-field stacked custom-control-field"><TimePicker label="时间" value={draft.time} onChange={updateTime} /></div>
        <div className="edit-field"><span className="edit-label">提醒</span><output className="edit-input edit-output">{draft.reminder || getCriticalReminder(draft.time || null)}</output></div>
        <div className="edit-field stacked custom-control-field"><span className="edit-label">完成度</span><SegmentedChoice label="完成度" value={draft.progress ?? 0} options={[0, 25, 50, 75, 100].map((value) => [value, `${value}%`])} onChange={(progress) => update("progress", Number(progress))} compact /></div>
        <label className="edit-field stacked"><span className="edit-label">备注</span><textarea className="edit-input edit-textarea" rows="2" value={draft.note || ""} onChange={(event) => update("note", event.target.value)} /></label>
      </div>
      <button className="primary-button accent pressable save-wide" onClick={() => onSave(task.id, { ...draft, title: draft.title.trim() })} disabled={!draft.title.trim()}>保存修改</button>
      {task.deadline ? (
        <div className="renew-row">
          <div className="renew-days-field">
            <Icon name="refresh" size={17} />
            <span className="renew-days-label">续期</span>
            <Stepper label="续期天数" value={renewDays} min={1} max={365} onChange={onRenewDaysChange} />
            <span className="renew-days-unit">天</span>
          </div>
          <button className="secondary-button pressable renew-confirm" onClick={() => onRenew(task.id, renewDays)}>确认续期</button>
        </div>
      ) : null}
      <button className="primary-button accent pressable save-wide complete-wide" onClick={() => onComplete(task.id)}><Icon name="check" size={17} /> 已完成</button>
    </Sheet>
  );
}

function HistoryScreen({ items, onBack }) {
  return (
    <main className="screen secondary">
      <BackHeader title="历史记录" onBack={onBack} />
      <div className="history-list">
        {items.map((item) => (
          <div className="history-row" key={item.id}>
            <span className="history-check"><Icon name="check" size={16} strokeWidth={2.2} /></span>
            <div><div className="history-title">{item.title}</div><div className="history-meta">完成于 {item.completed}</div></div>
            <span className="history-days">提前 {item.leadDays} 天</span>
          </div>
        ))}
        {!items.length ? <div className="empty-guide">还没有已完成的关键事项</div> : null}
      </div>
    </main>
  );
}

function ReportScreen({ type, onBack }) {
  const monthly = type === "month";
  const ranking = monthly ? APP_DATA.monthRanking : APP_DATA.yearRanking;
  const hasData = ranking.length > 0 || APP_DATA.ddlRanking.length > 0;
  return (
    <main className="screen secondary">
      <BackHeader title={monthly ? "月度复盘" : "年度复盘"} onBack={onBack} />
      {hasData ? <>
        <SectionHeader title="完成比例排名" note={monthly ? "上月" : "全年"} />
        <div className="ranking-list">{ranking.map((item) => <BarRow item={item} key={item.label} />)}</div>
        <SectionHeader title="最长提前完成的 DDL" note={monthly ? "前 5" : "前 10"} />
        <div>{APP_DATA.ddlRanking.slice(0, monthly ? 5 : 10).map((item) => <div className="ddl-rank" key={item.rank}><span className="rank-number">{String(item.rank).padStart(2, "0")}</span><span className="rank-title">{item.title}</span><span className="rank-days">提前 {item.days} 天</span></div>)}</div>
      </> : <div className="empty-guide report-empty">完成任务后，这里会生成真实复盘</div>}
    </main>
  );
}

function DeleteConfirmSheet({ target, onClose, onConfirm }) {
  if (!target?.task) return null;
  return (
    <Sheet onClose={onClose} label="确认删除任务">
      <div className="delete-confirm-title">{target.task.title}</div>
      <div className="button-row">
        <button className="secondary-button pressable" type="button" onClick={onClose}>取消</button>
        <button className="primary-button accent pressable" type="button" onClick={onConfirm}>删除</button>
      </div>
    </Sheet>
  );
}

function PermissionsScreen({ capabilities, onOpenCapability, onBack }) {
  const known = Boolean(capabilities);
  const state = (value, yes = "已开启", no = "未开启") => known ? (value ? yes : no) : "仅手机检测";
  const rows = [
    { key: "microphone", title: "麦克风", note: "语音识别与助手指令", status: state(capabilities?.microphone, "已授权", "未授权"), ok: capabilities?.microphone },
    { key: null, title: "离线中文识别", note: "Vosk 中文模型随 APK 内置", status: known ? (capabilities?.offlineSpeechReady ? "已加载" : capabilities?.offlineSpeechBundled ? "已内置" : "组件缺失") : "APK 内置", ok: capabilities?.offlineSpeechBundled },
    { key: "notifications", title: "通知", note: "锁屏和通知中心提醒", status: state(capabilities?.notifications), ok: capabilities?.notifications },
    { key: "exactAlarm", title: "精确闹钟", note: "按设定时间触发 DDL 提醒", status: state(capabilities?.exactAlarm), ok: capabilities?.exactAlarm },
    { key: "background", title: "ColorOS 后台运行", note: "自启动和后台活动由 ColorOS 管理", status: capabilities?.backgroundConfigured ? "已配置" : "点击管理", ok: true },
    { key: "battery", title: "电池优化", note: "后台提醒不被系统休眠", status: state(capabilities?.batteryUnrestricted, "不限制", "受限制"), ok: capabilities?.batteryUnrestricted },
    { key: "installUpdates", title: "安装更新", note: "从 GitHub 安装新版 APK", status: state(capabilities?.installUpdates, "已允许", "未允许"), ok: capabilities?.installUpdates },
    { key: null, title: "联网", note: "节日资料和版本检测", status: state(capabilities?.network, "可用", "当前离线"), ok: capabilities?.network },
    { key: null, title: "开机恢复提醒", note: "重启后重新安排 DDL 闹钟", status: state(capabilities?.bootRestore, "已内置", "组件缺失"), ok: capabilities?.bootRestore },
  ];
  return (
    <main className="screen secondary">
      <BackHeader title="权限与组件" onBack={onBack} />
      <div className="notice-preview">
        <div className="notice-app"><span className="notice-mark"><img src="./assets/app-icon-512.png" alt="" /></span>今刻 · 现在</div>
        <div className="notice-title">写今日日志</div>
        <div className="notice-copy">记录今天完成了什么，还有什么需要调整。</div>
      </div>
      <div style={{ marginTop: 17 }}>{rows.map((row) => {
        const content = <><div><div className="permission-title">{row.title}</div><div className="permission-note">{row.note}</div></div><span className={`status-badge ${row.ok ? "" : "needs-action"}`}>{row.status}</span></>;
        return row.key
          ? <button type="button" className="permission-row permission-action" onClick={() => onOpenCapability(row.key)} key={row.title}>{content}</button>
          : <div className="permission-row" key={row.title}>{content}</div>;
      })}</div>
    </main>
  );
}

function CriticalReminderScreen({ tasks, reminderTime, onReminderTimeChange, reminderMultiple, onReminderMultipleChange, reminderFinalDays, onReminderFinalDaysChange, onOpenPermissions, onBack }) {
  const reminderTasks = tasks.filter((task) => task.deadline && shouldRemindCritical(task.daysLeft, reminderMultiple, reminderFinalDays));
  const summary = reminderTasks.length
    ? reminderTasks.map((task) => `${task.title}${task.daysLeft === 0 ? "今天截止" : `剩${task.daysLeft}天`}`).join("；")
    : "今天没有到达提醒节点的关键事项。";
  return (
    <main className="screen secondary critical-reminder-screen">
      <BackHeader title="DDL 提醒" onBack={onBack} />
      <div className="reminder-time-card">
        <span><span className="reminder-setting-title">默认时间</span><span className="reminder-setting-note">汇总当前需要提醒的任务</span></span>
        <TimePicker label="DDL 默认提醒时间" value={reminderTime} allowUnset={false} onChange={(time) => onReminderTimeChange(time || "10:00")} />
      </div>
      {reminderTasks.length ? (
        <div className="notice-preview ddl-notice-preview">
          <div className="notice-app"><span className="notice-mark"><img src="./assets/app-icon-512.png" alt="" /></span>今刻 · {reminderTime}</div>
          <div className="notice-title">关键事项 · {reminderTasks.length} 项</div>
          <div className="notice-copy">{summary}</div>
        </div>
      ) : (
        <div className="reminder-silent-card"><Icon name="bell" size={18} /><span><strong>今天不提醒</strong><small>DDL 仍保留在今日与关键列表</small></span></div>
      )}
      <div className="reminder-rule-grid" aria-label="DDL提醒频率">
        <div className="reminder-rule-field">
          <span className="reminder-rule-label">倍数节点</span>
          <span className="reminder-rule-value">每 <Stepper label="DDL提醒倍数天数" value={reminderMultiple} min={1} max={30} onChange={onReminderMultipleChange} /> 天</span>
        </div>
        <div className="reminder-rule-field">
          <span className="reminder-rule-label">临近截止</span>
          <span className="reminder-rule-value">最后 <Stepper label="DDL最后连续提醒天数" value={reminderFinalDays} min={0} max={30} onChange={onReminderFinalDaysChange} /> 天</span>
        </div>
      </div>
      <SectionHeader title="今天会提醒" note={`${reminderTasks.length} 项`} />
      <div className="reminder-task-list">
        {reminderTasks.map((task) => (
          <div className="reminder-task-row" key={task.id}>
            <span className="reminder-task-dot" />
            <span className="reminder-task-title">{task.title}</span>
            <span className="reminder-task-days">{task.daysLeft === 0 ? "今天" : `${task.daysLeft} 天`}</span>
          </div>
        ))}
        {!reminderTasks.length ? <div className="reminder-empty">尚未到达提醒节点</div> : null}
      </div>
      <button className="permission-link pressable" type="button" onClick={onOpenPermissions}>
        <span className="permission-title">系统通知权限</span>
        <Icon name="chevronRight" size={17} />
      </button>
    </main>
  );
}

const JINKE_GITHUB_REPOSITORY = "Junyingjun/jinke-coloros-calendar";
const JINKE_FALLBACK_VERSION = "1.0.11";

function normalizeVersion(value) {
  return String(value || "0.0.0").trim().replace(/^v/i, "").split("-")[0];
}

function compareVersions(left, right) {
  const a = normalizeVersion(left).split(".").map((part) => Number(part) || 0);
  const b = normalizeVersion(right).split(".").map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
}

function VersionScreen({ onBack }) {
  const currentVersion = (() => {
    try { return window.JinkeAndroid?.getAppVersion?.() || JINKE_FALLBACK_VERSION; } catch { return JINKE_FALLBACK_VERSION; }
  })();
  const [state, setState] = React.useState({ status: "idle", latest: "", apkUrl: "", error: "" });
  const checkVersion = () => {
    setState({ status: "checking", latest: "", apkUrl: "", error: "" });
    fetch(`https://api.github.com/repos/${JINKE_GITHUB_REPOSITORY}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub ${response.status}`);
        return response.json();
      })
      .then((release) => {
        const latest = normalizeVersion(release.tag_name);
        const apk = (release.assets || []).find((asset) => /\.apk$/i.test(asset.name));
        const hasUpdate = compareVersions(latest, currentVersion) > 0;
        setState({ status: hasUpdate ? "update" : "latest", latest, apkUrl: apk?.browser_download_url || "", error: hasUpdate && !apk ? "最新版没有 APK 附件" : "" });
      })
      .catch(() => setState({ status: "error", latest: "", apkUrl: "", error: "无法连接 GitHub，请稍后重试" }));
  };
  const installUpdate = () => {
    if (!state.apkUrl) return;
    try {
      if (window.JinkeAndroid?.installApk) window.JinkeAndroid.installApk(state.apkUrl);
      else window.open(state.apkUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = state.apkUrl;
    }
  };
  const statusCopy = state.status === "checking" ? "正在检查…"
    : state.status === "latest" ? "已是最新版"
      : state.status === "update" ? `发现 v${state.latest}`
        : state.status === "error" ? state.error
          : "尚未检查";
  return (
    <main className="screen secondary version-screen">
      <BackHeader title="版本更新" onBack={onBack} />
      <div className="version-card">
        <span className="version-mark"><Icon name="update" size={23} /></span>
        <div><span className="version-name">今刻</span><span className="version-number">v{normalizeVersion(currentVersion)}</span></div>
        <span className={`version-status ${state.status}`}>{statusCopy}</span>
      </div>
      <button className="primary-button accent pressable version-action" type="button" disabled={state.status === "checking"} onClick={state.status === "update" && state.apkUrl ? installUpdate : checkVersion}>
        {state.status === "update" && state.apkUrl ? `下载并安装 v${state.latest}` : state.status === "checking" ? "检查中" : "检查更新"}
      </button>
      {state.error && state.status === "update" ? <div className="version-error">{state.error}</div> : null}
      <a className="github-release-link" href={`https://github.com/${JINKE_GITHUB_REPOSITORY}/releases`} target="_blank" rel="noreferrer">GitHub Releases <Icon name="chevronRight" size={15} /></a>
    </main>
  );
}

function VoiceSettingsScreen({ capabilities, onBack }) {
  const modelStatus = capabilities
    ? (capabilities.offlineSpeechReady ? "已加载" : capabilities.offlineSpeechBundled ? "已内置" : "组件缺失")
    : "APK 内置";
  return (
    <main className="screen secondary">
      <BackHeader title="语音模型" onBack={onBack} />
      <div className="summary-hero">
        <div className="summary-kicker">当前方案</div>
        <div className="summary-value" style={{ fontSize: 28 }}>Vosk Offline</div>
        <div className="summary-caption">端侧普通话流式识别，不依赖系统语音服务。</div>
      </div>
      <SectionHeader title="识别能力" note="离线" />
      <div className="permission-row"><div><div className="permission-title">普通话模型</div><div className="permission-note">vosk-model-small-cn-0.22 · 约 68 MB</div></div><span className="status-badge">{modelStatus}</span></div>
      <div className="permission-row"><div><div className="permission-title">原生识别引擎</div><div className="permission-note">Vosk Android 0.3.75 · ARM64</div></div><span className="status-badge">已内置</span></div>
      <div className="permission-row"><div><div className="permission-title">自然语言指令解析</div><div className="permission-note">日期、星期、重复、DDL 与应用操作</div></div><span className="status-badge">本地</span></div>
      <SectionHeader title="全局语音指令" note="执行前确认" />
      <div className="permission-row"><div><div className="permission-title">创建与修改</div><div className="permission-note">名称、时间、重复、提醒和备注</div></div><span className="status-badge">可用</span></div>
      <div className="permission-row"><div><div className="permission-title">完成与删除</div><div className="permission-note">勾选、取消勾选、归档或删除</div></div><span className="status-badge">可用</span></div>
      <div className="permission-row"><div><div className="permission-title">DDL 控制</div><div className="permission-note">设置期限、改期和按天／周／月延期</div></div><span className="status-badge">可用</span></div>
      <div className="permission-row"><div><div className="permission-title">页面与视图</div><div className="permission-note">今日、关键、历史、报表及日／周／月</div></div><span className="status-badge">可用</span></div>
    </main>
  );
}

Object.assign(window, { TodayScreen, CriticalScreen, ViewMenu, VoiceComposer, DailyEditSheet, MoreSheet, CriticalDetailSheet, CalendarDaySheet, HistoryScreen, ReportScreen, DeleteConfirmSheet, PermissionsScreen, CriticalReminderScreen, VersionScreen, VoiceSettingsScreen, compareVersions });
