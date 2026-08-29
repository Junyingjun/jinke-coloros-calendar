package com.junyingjun.jinke;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.os.Build;
import android.util.Log;

final class AlarmSchedulingSupport {
    private static final String LOG_TAG = "JinkeReminder";
    private AlarmSchedulingSupport() {}

    static void scheduleWakeup(Context context, AlarmManager manager, long triggerAtMillis, PendingIntent pendingIntent) {
        if (manager == null || pendingIntent == null) return;
        try {
            // A user-visible alarm clock is the most reliable Android contract for reminders.
            // It survives task removal and is honored by ColorOS even when normal background
            // execution is restricted. It also does not depend on exact-alarm special access.
            PendingIntent showIntent = NotificationSupport.openTodayPendingIntent(
                    context,
                    19991,
                    "com.junyingjun.jinke.SHOW_NEXT_REMINDER");
            manager.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent), pendingIntent);
            Log.i(LOG_TAG, "Scheduled alarm-clock wakeup at " + triggerAtMillis);
        } catch (RuntimeException alarmClockDenied) {
            // Some ColorOS builds can revoke exact-alarm access while the process is alive.
            // A delayed wakeup is still much better than silently losing the reminder.
            try {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()) {
                    manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                    Log.i(LOG_TAG, "Scheduled exact idle-safe wakeup at " + triggerAtMillis);
                } else {
                    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                    Log.i(LOG_TAG, "Scheduled inexact idle-safe wakeup at " + triggerAtMillis);
                }
            } catch (RuntimeException exactDenied) {
                Log.w(LOG_TAG, "Exact wakeup denied; using basic alarm", exactDenied);
                manager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        }
    }
}
