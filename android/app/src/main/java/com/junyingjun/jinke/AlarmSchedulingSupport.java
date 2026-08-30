package com.junyingjun.jinke;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

final class AlarmSchedulingSupport {
    private static final String LOG_TAG = "JinkeReminder";
    private static final String PREFS = "jinke_system_alarm_registration";
    private static final String KEY_MODE = "mode";
    private static final String KEY_TRIGGER_AT = "trigger_at";
    private static final String KEY_REGISTERED_AT = "registered_at";
    private AlarmSchedulingSupport() {}

    static void scheduleWakeup(Context context, AlarmManager manager, long triggerAtMillis, PendingIntent pendingIntent) {
        if (manager == null || pendingIntent == null) return;
        String mode = "failed";
        try {
            // A user-visible alarm clock is the most reliable Android contract for reminders.
            // It survives task removal and is honored by ColorOS even when normal background
            // execution is restricted.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
                throw new SecurityException("Exact alarm access is not available");
            }
            PendingIntent showIntent = NotificationSupport.openTodayPendingIntent(
                    context,
                    19991,
                    "com.junyingjun.jinke.SHOW_NEXT_REMINDER");
            manager.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent), pendingIntent);
            mode = "alarm-clock";
            Log.i(LOG_TAG, "Scheduled alarm-clock wakeup at " + triggerAtMillis);
        } catch (RuntimeException alarmClockDenied) {
            // Some ColorOS builds can revoke exact-alarm access while the process is alive.
            // A delayed wakeup is still much better than silently losing the reminder.
            try {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()) {
                    manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                    mode = "exact-idle";
                    Log.i(LOG_TAG, "Scheduled exact idle-safe wakeup at " + triggerAtMillis);
                } else {
                    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                    mode = "idle-fallback";
                    Log.i(LOG_TAG, "Scheduled inexact idle-safe wakeup at " + triggerAtMillis);
                }
            } catch (RuntimeException exactDenied) {
                Log.w(LOG_TAG, "Exact wakeup denied; using basic alarm", exactDenied);
                try {
                    manager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                    mode = "basic-fallback";
                } catch (RuntimeException basicDenied) {
                    Log.e(LOG_TAG, "System rejected every reminder alarm contract", basicDenied);
                }
            }
        }
        recordRegistration(context, mode, triggerAtMillis);
    }

    private static void recordRegistration(Context context, String mode, long triggerAtMillis) {
        DirectBootPreferences.get(context, PREFS).edit()
                .putString(KEY_MODE, mode)
                .putLong(KEY_TRIGGER_AT, triggerAtMillis)
                .putLong(KEY_REGISTERED_AT, System.currentTimeMillis())
                .apply();
    }

    static String latestMode(Context context) {
        return DirectBootPreferences.get(context, PREFS)
                .getString(KEY_MODE, "none");
    }

    static long latestTriggerAt(Context context) {
        return DirectBootPreferences.get(context, PREFS)
                .getLong(KEY_TRIGGER_AT, 0L);
    }

    static long latestRegisteredAt(Context context) {
        return DirectBootPreferences.get(context, PREFS)
                .getLong(KEY_REGISTERED_AT, 0L);
    }
}
