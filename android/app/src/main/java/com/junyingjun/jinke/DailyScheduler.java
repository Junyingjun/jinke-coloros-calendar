package com.junyingjun.jinke;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;

final class DailyScheduler {
    static final String PREFS = "jinke_daily_preferences";
    static final String KEY_TASKS = "tasks_json";
    static final String KEY_SCHEDULED_TIMES = "scheduled_times";
    static final String EXTRA_REMINDER_TIME = "reminder_time";
    private static final String ACTION_PREFIX = "com.junyingjun.jinke.DAILY_REMINDER.";
    private static final int REQUEST_BASE = 10000;

    private DailyScheduler() {}

    static void saveAndSchedule(Context context, String tasksJson) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_TASKS, tasksJson == null ? "[]" : tasksJson)
                .apply();
        schedule(context, true);
        ReminderGuardianService.updateState(context);
    }

    static boolean hasEnabledReminders(Context context) {
        try {
            JSONArray tasks = new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getString(KEY_TASKS, "[]"));
            for (int index = 0; index < tasks.length(); index++) {
                JSONObject task = tasks.optJSONObject(index);
                if (task != null && task.optBoolean("reminderEnabled", true) && triggerTimeFor(task) != null) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    static void schedule(Context context) {
        schedule(context, false);
    }

    private static void schedule(Context context, boolean allowCurrentMinute) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (manager == null) return;
        cancelPreviouslyScheduled(context, manager, prefs.getString(KEY_SCHEDULED_TIMES, ""));

        Set<String> times = new TreeSet<>();
        try {
            JSONArray tasks = new JSONArray(prefs.getString(KEY_TASKS, "[]"));
            for (int index = 0; index < tasks.length(); index++) {
                JSONObject task = tasks.optJSONObject(index);
                if (task == null || !task.optBoolean("reminderEnabled", true)) continue;
                String triggerTime = triggerTimeFor(task);
                if (triggerTime != null) times.add(triggerTime);
            }
        } catch (Exception ignored) {}

        for (String time : times) scheduleTime(context, manager, time, allowCurrentMinute);
        prefs.edit().putString(KEY_SCHEDULED_TIMES, String.join(",", times)).apply();
    }

    private static void scheduleTime(Context context, AlarmManager manager, String time, boolean allowCurrentMinute) {
        int minutes = minutesFromClock(time);
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, minutes / 60);
        next.set(Calendar.MINUTE, minutes % 60);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        long now = System.currentTimeMillis();
        if (next.getTimeInMillis() <= now) {
            if (allowCurrentMinute && now - next.getTimeInMillis() < 60000L) {
                next.setTimeInMillis(now + 3000L);
            } else {
                next.add(Calendar.DAY_OF_YEAR, 1);
            }
        }

        PendingIntent pendingIntent = reminderIntent(context, time, PendingIntent.FLAG_UPDATE_CURRENT);
        AlarmSchedulingSupport.scheduleWakeup(context, manager, next.getTimeInMillis(), pendingIntent);
    }

    private static void cancelPreviouslyScheduled(Context context, AlarmManager manager, String savedTimes) {
        if (savedTimes == null || savedTimes.isEmpty()) return;
        for (String time : savedTimes.split(",")) {
            if (!isClockTime(time)) continue;
            PendingIntent existing = reminderIntent(context, time, PendingIntent.FLAG_NO_CREATE);
            if (existing != null) {
                manager.cancel(existing);
                existing.cancel();
            }
        }
    }

    private static PendingIntent reminderIntent(Context context, String time, int lookupFlag) {
        int minutes = minutesFromClock(time);
        Intent intent = new Intent(context, DailyAlarmReceiver.class)
                .setAction(ACTION_PREFIX + time.replace(":", ""))
                .addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
                .putExtra(EXTRA_REMINDER_TIME, time);
        return PendingIntent.getBroadcast(
                context,
                REQUEST_BASE + minutes,
                intent,
                lookupFlag | PendingIntent.FLAG_IMMUTABLE);
    }

    static String triggerTimeFor(JSONObject task) {
        int taskMinutes = taskMinutes(task.optString("time", ""));
        if (taskMinutes < 0) return null;
        int leadMinutes = Math.min(1435, Math.max(0, task.optInt("reminderLeadMinutes", 0)));
        int triggerMinutes = Math.floorMod(taskMinutes - leadMinutes, 1440);
        return String.format(Locale.ROOT, "%02d:%02d", triggerMinutes / 60, triggerMinutes % 60);
    }

    static int logicalDateOffsetFor(JSONObject task) {
        int taskMinutes = taskMinutes(task.optString("time", ""));
        if (taskMinutes < 0) return 0;
        int leadMinutes = Math.min(1435, Math.max(0, task.optInt("reminderLeadMinutes", 0)));
        int triggerDayOffset = Math.floorDiv(taskMinutes - leadMinutes, 1440);
        return -triggerDayOffset;
    }

    static int taskMinutes(String value) {
        if ("24:00".equals(value)) return 1440;
        if (!isClockTime(value)) return -1;
        return minutesFromClock(value);
    }

    private static boolean isClockTime(String value) {
        return value != null && value.matches("(?:[01]\\d|2[0-3]):[0-5]\\d");
    }

    private static int minutesFromClock(String value) {
        return Integer.parseInt(value.substring(0, 2)) * 60 + Integer.parseInt(value.substring(3));
    }
}
