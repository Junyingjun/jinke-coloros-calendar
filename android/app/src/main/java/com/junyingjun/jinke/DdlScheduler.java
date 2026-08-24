package com.junyingjun.jinke;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.util.Calendar;

final class DdlScheduler {
    static final String PREFS = "jinke_ddl_preferences";
    static final String KEY_TASKS = "tasks_json";
    static final String KEY_TIME = "reminder_time";
    static final String KEY_MULTIPLE = "reminder_multiple";
    static final String KEY_FINAL_DAYS = "reminder_final_days";
    static final String KEY_SYNC_DAY = "sync_epoch_day";
    private static final int REQUEST_CODE = 5100;

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
        String time = prefs.getString(KEY_TIME, "10:00");
        String[] parts = normalizeTime(time).split(":");
        int hour = Integer.parseInt(parts[0]);
        int minute = Integer.parseInt(parts[1]);
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_YEAR, 1);

        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                new Intent(context, DdlAlarmReceiver.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && manager.canScheduleExactAlarms()) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pendingIntent);
        } else {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pendingIntent);
        }
    }

    private static String normalizeTime(String value) {
        if (value != null && value.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")) return value;
        return "10:00";
    }
}
