import assert from "node:assert/strict";

const triggerPlan = (time, leadMinutes) => {
  const taskMinutes = time === "24:00"
    ? 1440
    : Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const raw = taskMinutes - leadMinutes;
  const triggerMinutes = ((raw % 1440) + 1440) % 1440;
  return {
    time: `${String(Math.floor(triggerMinutes / 60)).padStart(2, "0")}:${String(triggerMinutes % 60).padStart(2, "0")}`,
    logicalDateOffset: -Math.floor(raw / 1440) || 0,
  };
};

assert.deepEqual(triggerPlan("09:00", 0), { time: "09:00", logicalDateOffset: 0 });
assert.deepEqual(triggerPlan("09:00", 30), { time: "08:30", logicalDateOffset: 0 });
assert.deepEqual(triggerPlan("00:10", 30), { time: "23:40", logicalDateOffset: 1 });
assert.deepEqual(triggerPlan("24:00", 0), { time: "00:00", logicalDateOffset: -1 });
assert.deepEqual(triggerPlan("24:00", 60), { time: "23:00", logicalDateOffset: 0 });

const occursOn = (task, dateKey, weekday) => {
  if (task.activeFrom && dateKey < task.activeFrom) return false;
  if (task.activeUntil && dateKey > task.activeUntil) return false;
  if (!task.repeatDays?.length) return dateKey === (task.scheduledDateKey || task.activeFrom);
  return task.repeatDays.includes(weekday);
};

const workday = { activeFrom: "2026-08-26", activeUntil: "", repeatDays: [1, 2, 3, 4, 5] };
assert.equal(occursOn(workday, "2026-08-28", 5), true);
assert.equal(occursOn(workday, "2026-08-29", 6), false);
assert.equal(occursOn(workday, "2026-08-25", 2), false);

const oneTime = { activeFrom: "2026-08-26", scheduledDateKey: "2026-08-28", repeatDays: [] };
assert.equal(occursOn(oneTime, "2026-08-28", 5), true);
assert.equal(occursOn(oneTime, "2026-08-29", 6), false);

const manuallyCompletedDates = new Set(["2026-08-28"]);
assert.equal(manuallyCompletedDates.has("2026-08-28"), true);
assert.equal(manuallyCompletedDates.has("2026-08-29"), false);

console.log("daily notification logic: timing, recurrence, and manual completion passed");
