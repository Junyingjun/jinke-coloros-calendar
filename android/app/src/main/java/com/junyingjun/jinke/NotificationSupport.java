package com.junyingjun.jinke;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

final class NotificationSupport {
    // Channel behavior is immutable after first creation. Version the reminder channels so an
    // installed build also receives the new sound, vibration and lock-screen settings.
    static final String DAILY_CHANNEL = "jinke_daily_v2";
    static final String DDL_CHANNEL = "jinke_ddl_v2";
    static final String UPDATE_CHANNEL = "jinke_update";
    static final String EXTRA_OPEN_TODAY = "jinke_open_today";
    static final String EXTRA_REMINDER_TITLE = "jinke_reminder_title";
    static final String EXTRA_REMINDER_MESSAGE = "jinke_reminder_message";

    private NotificationSupport() {}

    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        manager.createNotificationChannel(reminderChannel(
                context,
                DAILY_CHANNEL,
                R.string.daily_channel_name,
                "日常事项按设定时间提醒"));
        manager.createNotificationChannel(reminderChannel(
                context,
                DDL_CHANNEL,
                R.string.ddl_channel_name,
                "按设定倍数节点与临近截止天数提醒关键事项"));
        NotificationChannel update = new NotificationChannel(
                UPDATE_CHANNEL,
                context.getString(R.string.update_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT);
        update.setDescription("今刻新版本下载与安装提醒");
        manager.createNotificationChannel(update);
    }

    private static NotificationChannel reminderChannel(
            Context context, String id, int nameResource, String description) {
        NotificationChannel channel = new NotificationChannel(
                id,
                context.getString(nameResource),
                NotificationManager.IMPORTANCE_HIGH);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        channel.setDescription(description);
        channel.setSound(sound, audioAttributes);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 260, 120, 260});
        channel.enableLights(true);
        channel.setLightColor(Color.rgb(255, 96, 72));
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        return channel;
    }

    static Intent openTodayActivityIntent(Context context, String action) {
        return new Intent(context, MainActivity.class)
                .setAction(action)
                .putExtra(EXTRA_OPEN_TODAY, true)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    }

    static PendingIntent openTodayPendingIntent(Context context, int requestCode, String action) {
        return PendingIntent.getActivity(
                context,
                requestCode,
                openTodayActivityIntent(context, action),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent fullScreenPendingIntent(
            Context context, int requestCode, String action, String title, String message) {
        Intent intent = new Intent(context, ReminderAlertActivity.class)
                .setAction(action)
                .putExtra(EXTRA_REMINDER_TITLE, title)
                .putExtra(EXTRA_REMINDER_MESSAGE, message)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @SuppressWarnings("deprecation")
    static void wakeForReminder(Context context) {
        PowerManager manager = context.getSystemService(PowerManager.class);
        if (manager == null || manager.isInteractive()) return;
        PowerManager.WakeLock wakeLock = manager.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                        | PowerManager.ACQUIRE_CAUSES_WAKEUP
                        | PowerManager.ON_AFTER_RELEASE,
                "jinke:reminder-screen");
        wakeLock.acquire(5000L);
    }
}
