package com.junyingjun.jinke;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.os.Build;

final class AlarmSchedulingSupport {
    private AlarmSchedulingSupport() {}

    static void scheduleWakeup(AlarmManager manager, long triggerAtMillis, PendingIntent pendingIntent) {
        if (manager == null || pendingIntent == null) return;
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (SecurityException exactAlarmDenied) {
            // Some ColorOS builds can revoke exact-alarm access while the process is alive.
            // A delayed wakeup is still much better than silently losing the reminder.
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
        }
    }
}
