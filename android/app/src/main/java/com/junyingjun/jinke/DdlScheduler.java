package com.junyingjun.jinke;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Set;
import java.util.TreeSet;

final class DdlScheduler {
    static final String PREFS = "jinke_ddl_preferences";
    static final String KEY_TASKS = "tasks_json";
    static final String KEY_TIME = "reminder_time";
    static final String KEY_MULTIPLE = "reminder_multiple";
    static final String KEY_FINAL_DAYS = "reminder_final_days";
    static final String KEY_SYNC_DAY = "sync_epoch_day";
    static final String KEY_SCHEDULED_TIMES = "scheduled_times";
    static final String EXTRA_REMINDER_TIME = "reminder_time";
    private static final String ACTION_PREFIX = "com.junyingjun.jinke.DDL_REMINDER.";
    private static final int REQUEST_BASE = 7000;

    private DdlScheduler() {}

    static void saveAndSchedule(Context context, String tasksJson, String time, int multiple, int finalDays) {
        long epochDay = java.time.LocalDate.now().toEpochDay();
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_TASKS, tasksJson == null ? "[]" : tasksJson)
                .putString(KEY_TIME, normalizeTime(time))
                .putInt(KEY_MULTIPLE, Math.max(1, multiple))
                .putInt(KEY_FINAL_DAYS, Math.max(0, finalDays))
                .putLong(KEY_SYNC_DAY, epochDay)
                .apply();
        schedule(context);
    }

    static void schedule(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String fallbackTime = normalizeTime(prefs.getString(KEY_TIME, "10:00"));
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        cancelPreviouslyScheduled(context, manager, prefs.getString(KEY_SCHEDULED_TIMES, ""));

        Set<String> times = new TreeSet<>();
        try {
            JSONArray tasks = new JSONArray(prefs.getString(KEY_TASKS, "[]"));
            for (int index = 0; index < tasks.length(); index++) {
                JSONObject task = tasks.optJSONObject(index);
                if (task == null || !task.optBoolean("reminderEnabled", true)) continue;
                times.add(reminderTimeFor(task, fallbackTime));
            }
        } catch (Exception ignored) {}

        for (String reminderTime : times) scheduleTime(context, manager, reminderTime);
        prefs.edit().putString(KEY_SCHEDULED_TIMES, String.join(",", times)).apply();
    }

    private static void scheduleTime(Context context, AlarmManager manager, String time) {
        String[] parts = normalizeTime(time).split(":");
        int hour = Integer.parseInt(parts[0]);
        int minute = Integer.parseInt(parts[1]);
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_YEAR, 1);

        PendingIntent pendingIntent = reminderIntent(context, time, PendingIntent.FLAG_UPDATE_CURRENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && manager.canScheduleExactAlarms()) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pendingIntent);
        } else {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pendingIntent);
        }
    }

    private static void cancelPreviouslyScheduled(Context context, AlarmManager manager, String savedTimes) {
        if (savedTimes == null || savedTimes.isEmpty()) return;
        for (String time : savedTimes.split(",")) {
            PendingIntent existing = reminderIntent(context, normalizeTime(time), PendingIntent.FLAG_NO_CREATE);
            if (existing != null) {
                manager.cancel(existing);
                existing.cancel();
            }
        }
    }

    private static PendingIntent reminderIntent(Context context, String time, int lookupFlag) {
        int minutes = Integer.parseInt(time.substring(0, 2)) * 60 + Integer.parseInt(time.substring(3));
        Intent intent = new Intent(context, DdlAlarmReceiver.class)
                .setAction(ACTION_PREFIX + time.replace(":", ""))
                .putExtra(EXTRA_REMINDER_TIME, time);
        return PendingIntent.getBroadcast(context, REQUEST_BASE + minutes, intent, lookupFlag | PendingIntent.FLAG_IMMUTABLE);
    }

    static String normalizeTime(String value) {
        if (value != null && value.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")) return value;
        return "10:00";
    }

    static String reminderTimeFor(JSONObject task, String fallbackTime) {
        String reminderTime = normalizeTime(task.optString("reminderTime", fallbackTime));
        if (!"deadline-only".equals(task.optString("reminderMode", "smart"))) return reminderTime;
        String deadlineTime = task.optString("deadlineTime", "");
        if (!deadlineTime.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")) return reminderTime;
        int deadlineMinutes = Integer.parseInt(deadlineTime.substring(0, 2)) * 60 + Integer.parseInt(deadlineTime.substring(3));
        int leadMinutes = Math.min(1435, Math.max(0, task.optInt("deadlineLeadMinutes", 0)));
        int triggerMinutes = (deadlineMinutes - leadMinutes + 1440) % 1440;
        return String.format(java.util.Locale.ROOT, "%02d:%02d", triggerMinutes / 60, triggerMinutes % 60);
    }

    static int reminderDayOffsetFor(JSONObject task) {
        if (!"deadline-only".equals(task.optString("reminderMode", "smart"))) return 0;
        String deadlineTime = task.optString("deadlineTime", "");
        if (!deadlineTime.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")) return 0;
        int deadlineMinutes = Integer.parseInt(deadlineTime.substring(0, 2)) * 60 + Integer.parseInt(deadlineTime.substring(3));
        int leadMinutes = Math.min(1435, Math.max(0, task.optInt("deadlineLeadMinutes", 0)));
        return deadlineMinutes - leadMinutes < 0 ? 1 : 0;
    }
}
