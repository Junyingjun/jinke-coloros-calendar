const { APP_DATA, getCalendarMarker, getCriticalReminder, shouldRemindCritical, getDateMeta, getWeekDates, getMonthDates, shiftDateKeyByMonth, Icon, IconButton, SectionHeader, DailyTaskRow, CriticalTaskRow, Sheet, BackHeader, BarRow } = window;

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

function TodayScreen({ tasks, deadlineTasks, onToggle, onEdit, onOpenCritical, onMenu, viewMode, onOpenView, selectedDateKey, todayDateKey, onSelectDate, onOpenDayArchive }) {
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
              <div className="critical-stack daily-ddl-stack">{deadlineTasks.map((task) => <CriticalTaskRow task={task} onOpen={onOpenCritical} key={task.id} />)}</div>
            </section>
          ) : null}
        </div>
        <section className="today-daily-pane" aria-label="日常事项">
          <SectionHeader title={isToday ? "今天" : `星期${selectedDay.day}`} note={`${tasks.length - done} 项待完成`} />
          <div className="task-list">{tasks.map((task) => <DailyTaskRow task={task} onToggle={onToggle} onEdit={onEdit} key={task.id} />)}</div>
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

function CriticalScreen({ tasks, onOpen, onMenu, onOpenReminders }) {
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
          <div className="critical-stack">{withDDL.map((task) => <CriticalTaskRow task={task} onOpen={onOpen} key={task.id} />)}</div>
        </section>
        <section className="critical-pane critical-without-ddl" aria-label="无 DDL 的关键事项">
          <SectionHeader title="无 DDL" note="长期关注" />
          <div className="critical-stack">{withoutDDL.map((task) => <CriticalTaskRow task={task} onOpen={onOpen} key={task.id} />)}</div>
        </section>
      </div>
    </main>
  );
}

function Waveform() {
  return <div className="waveform" aria-hidden="true">{[11, 20, 26, 16, 24, 18, 9].map((height, index) => <span key={index} style={{ height }} />)}</div>;
}

function VoiceComposer({ phase, transcript, parsedCommand, draftTask, onDraftTaskChange, onTranscript, onStop, onUseExample, onConfirm, onClose, speechAvailable }) {
  const text = transcript.trim();
  const editableTask = draftTask || parsedCommand.task;
  const updateDraft = (field, value) => onDraftTaskChange({ ...(draftTask || parsedCommand.task), [field]: value });
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
  return (
    <Sheet onClose={onClose} labelledBy={phase === "listening" ? "voice-title" : undefined} label={phase === "review" ? "确认语音指令" : undefined}>
      {phase === "listening" ? (
        <>
          <h2 className="sheet-title" id="voice-title">今刻助手</h2>
          <div className="voice-stage">
            <button className="voice-orbit pressable" onClick={onStop} aria-label="停止并处理"><Waveform /></button>
            <div className="voice-transcript">{text || "正在听…"}</div>
          </div>
          <input className="composer-input" value={transcript} onChange={(event) => onTranscript(event.target.value)} placeholder="输入操作或安排" aria-label={speechAvailable ? "输入操作或安排" : "语音不可用，请输入操作或安排"} />
          <div className="button-row">
            <button className="secondary-button pressable" onClick={onUseExample}>使用示例</button>
            <button className="primary-button pressable" onClick={onStop}>停止并处理</button>
          </div>
        </>
      ) : (
        <>
          {parsedCommand.intent === "create" && editableTask ? (
            <div className="edit-form voice-edit-form edit-form-first">
              <label className="edit-field"><span className="edit-label">名称</span><input className="edit-input title-input" value={editableTask.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
              <label className="edit-field"><span className="edit-label">类型</span><select className="edit-input" value={editableTask.type} onChange={(event) => updateType(event.target.value)}><option value="daily">日常事务</option><option value="critical">关键事务</option></select></label>
              {editableTask.type === "daily" ? (
                <>
                  <label className="edit-field"><span className="edit-label">时间</span><input className="edit-input" type="time" value={editableTask.time === "待定" ? "" : editableTask.time} onChange={(event) => updateDraft("time", event.target.value || "待定")} /></label>
                  <label className="edit-field"><span className="edit-label">重复</span><input className="edit-input" value={editableTask.repeat} onChange={(event) => updateDraft("repeat", event.target.value)} /></label>
                </>
              ) : (
                <>
                  <label className="edit-field"><span className="edit-label">截止</span><input className="edit-input" value={editableTask.deadline || ""} placeholder="无 DDL" onChange={(event) => updateDraft("deadline", event.target.value || null)} /></label>
                  <label className="edit-field"><span className="edit-label">时间</span><input className="edit-input" type="time" value={editableTask.time === "待定" ? "" : editableTask.time || ""} onChange={(event) => updateCriticalTime(event.target.value)} /></label>
                </>
              )}
              <label className="edit-field"><span className="edit-label">提醒</span><input className="edit-input" value={editableTask.reminder || ""} readOnly={editableTask.type === "critical"} onChange={(event) => updateDraft("reminder", event.target.value)} /></label>
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
  return (
    <Sheet onClose={onClose} label="编辑任务">
      <div className="edit-form edit-form-first">
        <label className="edit-field"><span className="edit-label">名称</span><input className="edit-input title-input" value={draft.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label className="edit-field"><span className="edit-label">时间</span><input className="edit-input" type="time" value={draft.time === "待定" ? "" : draft.time} onChange={(event) => update("time", event.target.value || "待定")} /></label>
        <label className="edit-field"><span className="edit-label">重复</span><input className="edit-input" value={draft.repeat} onChange={(event) => update("repeat", event.target.value)} /></label>
        <label className="edit-field"><span className="edit-label">提醒</span><input className="edit-input" value={draft.reminder} onChange={(event) => update("reminder", event.target.value)} /></label>
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
        <label className="edit-field"><span className="edit-label">截止</span><input className="edit-input" value={draft.deadline || ""} placeholder="无 DDL" onChange={(event) => update("deadline", event.target.value || null)} /></label>
        <label className="edit-field"><span className="edit-label">时间</span><input className="edit-input" type="time" value={draft.time || ""} onChange={(event) => updateTime(event.target.value)} /></label>
        <label className="edit-field"><span className="edit-label">提醒</span><input className="edit-input" value={draft.reminder || ""} readOnly /></label>
        <label className="edit-field"><span className="edit-label">完成度</span><input className="edit-input" type="number" min="0" max="100" value={draft.progress ?? 0} onChange={(event) => update("progress", Math.min(100, Math.max(0, Number(event.target.value) || 0)))} /></label>
        <label className="edit-field stacked"><span className="edit-label">备注</span><textarea className="edit-input edit-textarea" rows="2" value={draft.note || ""} onChange={(event) => update("note", event.target.value)} /></label>
      </div>
      <button className="primary-button accent pressable save-wide" onClick={() => onSave(task.id, { ...draft, title: draft.title.trim() })} disabled={!draft.title.trim()}>保存修改</button>
      {task.deadline ? (
        <div className="renew-row">
          <label className="renew-days-field">
            <Icon name="refresh" size={17} />
            <span className="renew-days-label">续期</span>
            <input className="renew-days-input" type="number" inputMode="numeric" min="1" max="3650" value={renewDays} aria-label="续期天数" onChange={(event) => onRenewDaysChange(Math.min(3650, Math.max(1, Number(event.target.value) || 1)))} />
            <span className="renew-days-unit">天</span>
          </label>
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
      </div>
    </main>
  );
}

function ReportScreen({ type, onBack }) {
  const monthly = type === "month";
  const ranking = monthly ? APP_DATA.monthRanking : APP_DATA.yearRanking;
  return (
    <main className="screen secondary">
      <BackHeader title={monthly ? "7 月复盘" : "2025 年复盘"} onBack={onBack} />
      <div className="summary-hero">
        <div className="summary-kicker">日常事务完成率</div>
        <div className="summary-value">{monthly ? "84%" : "82%"}</div>
        <div className="summary-caption">{monthly ? "比 6 月提高 6 个百分点" : "全年完成 1,270 次日常事项"}</div>
      </div>
      <SectionHeader title="完成比例排名" note={monthly ? "上月" : "全年"} />
      <div className="ranking-list">{ranking.map((item) => <BarRow item={item} key={item.label} />)}</div>
      <SectionHeader title="最长提前完成的 DDL" note={monthly ? "前 5" : "前 10"} />
      <div>{APP_DATA.ddlRanking.slice(0, monthly ? 5 : 10).map((item) => <div className="ddl-rank" key={item.rank}><span className="rank-number">{String(item.rank).padStart(2, "0")}</span><span className="rank-title">{item.title}</span><span className="rank-days">提前 {item.days} 天</span></div>)}</div>
    </main>
  );
}

function PermissionsScreen({ onBack }) {
  const rows = [
    ["通知权限", "锁屏和通知中心可见", "已开启"],
    ["精确闹钟", "保证事项按设定时间出现", "已开启"],
    ["后台运行", "已加入 ColorOS 白名单", "正常"],
    ["电池优化", "允许今刻在后台保持提醒", "不限制"],
  ];
  return (
    <main className="screen secondary">
      <BackHeader title="通知与权限" onBack={onBack} />
      <div className="notice-preview">
        <div className="notice-app"><span className="notice-mark"><img src="./assets/app-icon-512.png" alt="" /></span>今刻 · 现在</div>
        <div className="notice-title">写今日日志</div>
        <div className="notice-copy">记录今天完成了什么，还有什么需要调整。</div>
      </div>
      <div style={{ marginTop: 17 }}>{rows.map(([title, note, status]) => <div className="permission-row" key={title}><div><div className="permission-title">{title}</div><div className="permission-note">{note}</div></div><span className="status-badge">{status}</span></div>)}</div>
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
      <label className="reminder-time-card">
        <span><span className="reminder-setting-title">默认时间</span><span className="reminder-setting-note">汇总当前需要提醒的任务</span></span>
        <input className="reminder-time-input" type="time" value={reminderTime} aria-label="DDL 默认提醒时间" onChange={(event) => onReminderTimeChange(event.target.value || "10:00")} />
      </label>
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
        <label className="reminder-rule-field">
          <span className="reminder-rule-label">倍数节点</span>
          <span className="reminder-rule-value">每 <input type="number" inputMode="numeric" min="1" max="3650" value={reminderMultiple} aria-label="DDL提醒倍数天数" onChange={(event) => onReminderMultipleChange(Math.min(3650, Math.max(1, Number(event.target.value) || 1)))} /> 天</span>
        </label>
        <label className="reminder-rule-field">
          <span className="reminder-rule-label">临近截止</span>
          <span className="reminder-rule-value">最后 <input type="number" inputMode="numeric" min="0" max="3650" value={reminderFinalDays} aria-label="DDL最后连续提醒天数" onChange={(event) => onReminderFinalDaysChange(Math.min(3650, Math.max(0, Number(event.target.value) || 0)))} /> 天</span>
        </label>
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
const JINKE_FALLBACK_VERSION = "1.0.0";

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

function VoiceSettingsScreen({ onBack }) {
  return (
    <main className="screen secondary">
      <BackHeader title="语音模型" onBack={onBack} />
      <div className="summary-hero">
        <div className="summary-kicker">当前方案</div>
        <div className="summary-value" style={{ fontSize: 28 }}>sherpa-onnx</div>
        <div className="summary-caption">端侧中文流式识别，录音不离开设备。</div>
      </div>
      <SectionHeader title="识别能力" note="离线" />
      <div className="permission-row"><div><div className="permission-title">普通话与英文</div><div className="permission-note">Zipformer 双语模型</div></div><span className="status-badge">已下载</span></div>
      <div className="permission-row"><div><div className="permission-title">自然语言时间解析</div><div className="permission-note">日期、星期、重复与提前提醒</div></div><span className="status-badge">本地</span></div>
      <div className="permission-row"><div><div className="permission-title">个性词表</div><div className="permission-note">健身、日志、DDL 等常用词</div></div><span className="status-badge">自动</span></div>
      <SectionHeader title="全局语音指令" note="执行前确认" />
      <div className="permission-row"><div><div className="permission-title">创建与修改</div><div className="permission-note">名称、时间、重复、提醒和备注</div></div><span className="status-badge">可用</span></div>
      <div className="permission-row"><div><div className="permission-title">完成与删除</div><div className="permission-note">勾选、取消勾选、归档或删除</div></div><span className="status-badge">可用</span></div>
      <div className="permission-row"><div><div className="permission-title">DDL 控制</div><div className="permission-note">设置期限、改期和按天／周／月延期</div></div><span className="status-badge">可用</span></div>
      <div className="permission-row"><div><div className="permission-title">页面与视图</div><div className="permission-note">今日、关键、历史、报表及日／周／月</div></div><span className="status-badge">可用</span></div>
    </main>
  );
}

Object.assign(window, { TodayScreen, CriticalScreen, ViewMenu, VoiceComposer, DailyEditSheet, MoreSheet, CriticalDetailSheet, CalendarDaySheet, HistoryScreen, ReportScreen, PermissionsScreen, CriticalReminderScreen, VersionScreen, VoiceSettingsScreen, compareVersions });
