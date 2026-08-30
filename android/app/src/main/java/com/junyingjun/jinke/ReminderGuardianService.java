package com.junyingjun.jinke;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ReminderGuardianService extends Service {
    static final String EXTRA_GUARDIAN_TICK = "jinke_guardian_tick";
    private static final String LOG_TAG = "JinkeReminder";
    private static final String PREFS = "jinke_reminder_guardian";
    private static final String KEY_LAST_TICK = "last_tick";
    private static final int NOTIFICATION_ID = 19989;
    private static final long MINUTE_MILLIS = 60000L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String lastDeliveredMinute = "";

    private final Runnable minuteTick = new Runnable() {
        @Override
        public void run() {
            deliverCurrentMinuteFallback();
            long delay = MINUTE_MILLIS - (System.currentTimeMillis() % MINUTE_MILLIS) + 350L;
            handler.postDelayed(this, Math.max(1000L, delay));
        }
    };

    static void updateState(Context context) {
        boolean required = DailyScheduler.hasEnabledReminders(context)
                || DdlScheduler.hasEnabledReminders(context);
        Intent intent = new Intent(context, ReminderGuardianService.class);
        if (!required) {
            context.stopService(intent);
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
            else context.startService(intent);
        } catch (RuntimeException error) {
            Log.e(LOG_TAG, "Guardian start was denied; AlarmManager remains active", error);
            // AlarmManager remains the primary delivery path if an OEM denies FGS startup.
        }
    }

    static long lastTick(Context context) {
        return DirectBootPreferences.get(context, PREFS).getLong(KEY_LAST_TICK, 0L);
    }

    static boolean isHealthy(Context context) {
        long tick = lastTick(context);
        return tick > 0L && System.currentTimeMillis() - tick < 150000L;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationSupport.createChannels(this);
        startForeground(NOTIFICATION_ID, guardianNotification());
        recordTick();
        Log.i(LOG_TAG, "Reminder guardian started");
        DailyScheduler.schedule(this);
        DdlScheduler.schedule(this);
        handler.post(minuteTick);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!DailyScheduler.hasEnabledReminders(this) && !DdlScheduler.hasEnabledReminders(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.i(LOG_TAG, "App task removed; preserving reminder schedules");
        DailyScheduler.schedule(this);
        DdlScheduler.schedule(this);
        super.onTaskRemoved(rootIntent);
    }

    private Notification guardianNotification() {
        return new Notification.Builder(this, NotificationSupport.GUARDIAN_CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("今刻提醒已启用")
                .setContentText("后台保障正在运行")
                .setContentIntent(NotificationSupport.openTodayPendingIntent(
                        this,
                        NOTIFICATION_ID,
                        "com.junyingjun.jinke.OPEN_GUARDIAN"))
                .setCategory(Notification.CATEGORY_SERVICE)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .build();
    }

    private void deliverCurrentMinuteFallback() {
        String minute = new SimpleDateFormat("HH:mm", Locale.ROOT).format(new Date());
        if (minute.equals(lastDeliveredMinute)) return;
        lastDeliveredMinute = minute;
        recordTick();
        Log.i(LOG_TAG, "Guardian minute tick " + minute);

        sendBroadcast(new Intent(this, DailyAlarmReceiver.class)
                .setAction("com.junyingjun.jinke.GUARDIAN_DAILY." + minute.replace(":", ""))
                .putExtra(DailyScheduler.EXTRA_REMINDER_TIME, minute)
                .putExtra(EXTRA_GUARDIAN_TICK, true));
        sendBroadcast(new Intent(this, DdlAlarmReceiver.class)
                .setAction("com.junyingjun.jinke.GUARDIAN_DDL." + minute.replace(":", ""))
                .putExtra(DdlScheduler.EXTRA_REMINDER_TIME, minute)
                .putExtra(EXTRA_GUARDIAN_TICK, true));
    }

    private void recordTick() {
        DirectBootPreferences.get(this, PREFS).edit()
                .putLong(KEY_LAST_TICK, System.currentTimeMillis())
                .apply();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        Log.i(LOG_TAG, "Reminder guardian destroyed");
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
