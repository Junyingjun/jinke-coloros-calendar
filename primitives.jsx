function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const paths = {
    menu: <><path d="M5 7h14M5 12h14M5 17h14" /></>,
    chevronDown: <path d="m7 9.5 5 5 5-5" />,
    chevronRight: <path d="m9 6 6 6-6 6" />,
    back: <path d="m15 18-6-6 6-6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    flag: <><path d="M5 21V4" /><path d="M5 5h10l-1 4 3 3H5" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></>,
    check: <path d="m6.5 12.5 3.4 3.3 7.6-8" />,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    year: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 9h18M8 13h3v3H8z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    spark: <><path d="m12 3 1.3 4.2L17.5 8.5l-4.2 1.3L12 14l-1.3-4.2-4.2-1.3 4.2-1.3L12 3Z" /><path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></>,
    keyboard: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M18 10h.01M6 14h12" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    repeat: <><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
    archive: <><path d="M4 7h16v13H4zM3 4h18v3H3z" /><path d="M9 11h6" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8.3A7 7 0 0 1 18.7 7L20 12M4 12l1.3 5A7 7 0 0 0 18 15.7" /></>,
    shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3 7.6 7.5 9.5 4.5-1.9 7.5-5 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-5" /></>,
    update: <><path d="M12 3a9 9 0 1 0 8.2 5.3" /><path d="M20 3v5h-5" /><path d="M12 7v6" /><path d="m9.5 10.5 2.5 2.5 2.5-2.5" /><path d="M9 17h6" /></>,
  };
  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

function PhoneFrame({ children, variant = "phone" }) {
  return (
    <div className={`phone-shell phone-shell-${variant}`} data-device={variant}>
      <div className="phone-content">{children}</div>
    </div>
  );
}

function IconButton({ name, label, onClick }) {
  return <button className="icon-button" aria-label={label} onClick={onClick}><Icon name={name} /></button>;
}

function SectionHeader({ title, note, noteTone }) {
  return <div className="section-head"><h2 className="section-title">{title}</h2>{note ? <span className={`section-note ${noteTone ? `is-${noteTone}` : ""}`}>{note}</span> : null}</div>;
}

function SwipeTaskActions({ label, onEdit, onDelete, children }) {
  const revealRatio = 0.4;
  const [offsetRatio, setOffsetRatio] = React.useState(0);
  const gestureRef = React.useRef(null);
  const offsetRef = React.useRef(0);
  const suppressClickRef = React.useRef(false);
  const rootRef = React.useRef(null);
  const instanceIdRef = React.useRef(`swipe-${Math.random().toString(36).slice(2)}`);

  const settle = (next) => {
    offsetRef.current = next;
    setOffsetRatio(next);
  };

  React.useEffect(() => {
    const closeFromOutside = (event) => {
      if (offsetRef.current < 0 && rootRef.current && !rootRef.current.contains(event.target)) settle(0);
    };
    const closeAnother = (event) => {
      if (event.detail !== instanceIdRef.current && offsetRef.current < 0) settle(0);
    };
    const closeOnScroll = () => { if (offsetRef.current < 0) settle(0); };
    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("jinke-swipe-open", closeAnother);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside, true);
      document.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("jinke-swipe-open", closeAnother);
    };
  }, []);

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offsetRef.current,
      horizontal: false,
      moved: false,
    };
  };

  const onPointerMove = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.horizontal && Math.max(Math.abs(dx), Math.abs(dy)) > 14) {
      if (Math.abs(dx) <= Math.abs(dy) * 1.2) return;
      gesture.horizontal = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (!gesture.horizontal) return;
    gesture.moved = true;
    const width = Math.max(1, event.currentTarget.getBoundingClientRect().width);
    settle(Math.max(-revealRatio, Math.min(0, gesture.startOffset + (dx / width))));
  };

  const onPointerEnd = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      const next = offsetRef.current <= -0.13 ? -revealRatio : 0;
      settle(next);
      if (next < 0) window.dispatchEvent(new CustomEvent("jinke-swipe-open", { detail: instanceIdRef.current }));
    }
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const onClickCapture = (event) => {
    if (event.target.closest?.(".swipe-action")) return;
    if (suppressClickRef.current || offsetRef.current < 0) {
      event.preventDefault();
      event.stopPropagation();
      settle(0);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`swipe-task ${offsetRatio < 0 ? "is-open" : ""}`}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={onClickCapture}
    >
      <div className="swipe-actions" aria-hidden={offsetRatio === 0}>
        <button className="swipe-action swipe-edit" type="button" onClick={() => { settle(0); onEdit(); }}>编辑</button>
        <button className="swipe-action swipe-delete" type="button" onClick={() => { settle(0); onDelete(); }}>删除</button>
      </div>
      <div className="swipe-task-content" style={{ transform: `translateX(${offsetRatio * 100}%)` }}>{children}</div>
    </div>
  );
}

function DailyTaskRow({ task, onToggle, onEdit, onDelete }) {
  return (
    <SwipeTaskActions label={`${task.title}，向左滑动可编辑或删除`} onEdit={() => onEdit(task)} onDelete={() => onDelete(task)}>
      <button className="daily-row task-toggle-row" type="button" aria-label={task.done ? `取消完成 ${task.title}` : `完成 ${task.title}`} onClick={() => onToggle(task.id)}>
        <span className={`task-time ${task.endTime ? "task-time-range" : ""}`}><span>{task.time}</span>{task.endTime ? <span>→ {task.endTime}</span> : null}</span>
        <span className={`check-button ${task.done ? "done" : ""}`} aria-hidden="true">
          {task.done ? <Icon name="check" size={15} strokeWidth={2.3} /> : null}
        </span>
        <span className="task-copy">
          <span className="task-edit-body">
            <span className={`task-title ${task.done ? "done" : ""}`}>{task.title}</span>
            {task.note ? <span className="task-note">{task.note}</span> : null}
            <span className="task-tags"><span className="repeat-pill">{task.repeat}</span>{task.reminder && task.reminder !== "到点提醒" ? <span className="reminder-pill">{task.reminder}</span> : null}</span>
          </span>
        </span>
      </button>
    </SwipeTaskActions>
  );
}

function CriticalTaskRow({ task, onToggle, onOpen, onDelete }) {
  const dueCopy = task.daysLeft === null ? "无 DDL" : task.daysLeft < 0 ? `逾期 ${Math.abs(task.daysLeft)} 天` : task.daysLeft === 0 ? "今天" : `剩 ${task.daysLeft} 天`;
  return (
    <SwipeTaskActions label={`${task.title}，向左滑动可编辑或删除`} onEdit={() => onOpen(task)} onDelete={() => onDelete(task)}>
      <button className={`critical-row pressable ${task.done ? "done" : ""}`} aria-label={task.done ? `取消完成 ${task.title}` : `完成 ${task.title}`} onClick={() => onToggle(task.id)}>
        <div className="critical-top">
          <div className="critical-title-wrap">
            <span className={`critical-check ${task.done ? "done" : ""}`}>{task.done ? <Icon name="check" size={13} strokeWidth={2.3} /> : null}</span>
            <div>
            <div className={`critical-title ${task.done ? "done" : ""}`}>{task.title}</div>
            {task.note ? <div className="critical-note">{task.note}</div> : null}
            </div>
          </div>
          <span className={`days-left ${task.daysLeft <= 0 ? "today" : ""}`}>{dueCopy}</span>
        </div>
        <div className="critical-meta">
          <span>{task.deadline ? [task.deadline, task.time].filter(Boolean).join(" · ") : task.reminder}</span>
          <div className="mini-progress" aria-label={`完成 ${task.progress}%`}><span style={{ width: `${task.progress}%` }} /></div>
        </div>
      </button>
    </SwipeTaskActions>
  );
}

function BottomNav({ activeTab, onTabChange, onVoice }) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <button className={`nav-tab ${activeTab === "today" ? "active" : ""}`} onClick={() => onTabChange("today")}>
        <Icon name="calendar" size={21} /><span className="nav-label">今日</span>
      </button>
      <div className="voice-slot">
        <button className="voice-button" aria-label="全局语音控制" onClick={onVoice}><Icon name="mic" size={27} strokeWidth={2} /></button>
      </div>
      <button className={`nav-tab ${activeTab === "critical" ? "active" : ""}`} onClick={() => onTabChange("critical")}>
        <Icon name="flag" size={21} /><span className="nav-label">关键</span>
      </button>
    </nav>
  );
}

function Sheet({ children, onClose, labelledBy, label, depth = 0 }) {
  const [dragY, setDragY] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [dismissing, setDismissing] = React.useState(false);
  const sheetRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const dismissingRef = React.useRef(false);

  React.useEffect(() => {
    const dismiss = (event) => {
      if (Number.isFinite(event.detail?.depth) && event.detail.depth !== depth) return;
      if (dismissingRef.current) return;
      dismissingRef.current = true;
      setDragging(false);
      setDismissing(true);
      const detail = event.detail || {};
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      window.setTimeout(() => {
        if (detail.completed) return;
        detail.completed = true;
        detail.complete?.();
      }, reduced ? 1 : 230);
    };
    window.addEventListener("jinke-sheet-dismiss", dismiss);
    return () => window.removeEventListener("jinke-sheet-dismiss", dismiss);
  }, [depth]);

  const onHandlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastAt: performance.now(),
      velocity: 0,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onHandlePointerMove = (event) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const delta = event.clientY - gesture.startY;
    const next = delta >= 0 ? delta : -Math.min(30, Math.abs(delta) * 0.2);
    const now = performance.now();
    const elapsed = Math.max(1, now - gesture.lastAt);
    gesture.velocity = (event.clientY - gesture.lastY) / elapsed;
    gesture.lastY = event.clientY;
    gesture.lastAt = now;
    setDragY(next);
    event.preventDefault();
  };

  const finishHandleGesture = (event, cancelled = false) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const height = Math.max(1, sheetRef.current?.getBoundingClientRect().height || 1);
    const shouldDismiss = !cancelled && (dragY >= Math.min(120, height * 0.16) || gesture.velocity > 0.55);
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (shouldDismiss) onClose();
    else setDragY(0);
  };

  const scrimOpacity = Math.min(1, Math.max(0, 1 - Math.max(0, dragY) / Math.max(240, (sheetRef.current?.offsetHeight || 480) * 0.7)));
  const sheetStyle = {
    "--sheet-drag-y": `${dragY}px`,
    "--sheet-stack-offset": `${Math.min(3, depth) * 8}px`,
    "--sheet-scrim-z": 70 + depth * 20,
    "--sheet-z": 80 + depth * 20,
  };
  return (
    <>
      <button className={`scrim ${dismissing ? "is-dismissing" : ""}`} data-sheet-depth={depth} style={{ "--scrim-drag-opacity": scrimOpacity, "--sheet-scrim-z": 70 + depth * 20 }} aria-label="关闭" onClick={onClose} />
      <section
        ref={sheetRef}
        className={`sheet ${dragging ? "is-dragging" : ""} ${dragY < 0 ? "is-pulling" : ""} ${dismissing ? "is-dismissing" : ""}`}
        data-sheet-depth={depth}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || undefined}
        aria-label={label || undefined}
      >
        <button
          className="sheet-drag-handle"
          type="button"
          aria-label="上下拖动，向下关闭"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={(event) => finishHandleGesture(event)}
          onPointerCancel={(event) => finishHandleGesture(event, true)}
        ><span className="sheet-handle" /></button>
        {children}
      </section>
    </>
  );
}

function BackHeader({ title, onBack }) {
  return <div className="back-header"><IconButton name="back" label="返回" onClick={onBack} /><h1>{title}</h1></div>;
}

function BarRow({ item }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{item.label}</span>
      <div className="bar-track"><div className="bar-value" style={{ width: `${item.value}%` }} /></div>
      <span className="bar-detail">{item.detail}</span>
    </div>
  );
}

Object.assign(window, { Icon, PhoneFrame, IconButton, SectionHeader, SwipeTaskActions, DailyTaskRow, CriticalTaskRow, BottomNav, Sheet, BackHeader, BarRow });
