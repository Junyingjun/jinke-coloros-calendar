package com.junyingjun.jinke;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import java.util.Collections;

public class ReminderTestReceiver extends BroadcastReceiver {
    static final String ACTION = "com.junyingjun.jinke.REMINDER_PIPELINE_TEST";
    static final int REQUEST_CODE = 19990;
    static final int NOTIFICATION_ID = 19990;

    @Override
    public void onReceive(Context context, Intent intent) {
        ReminderBackupJobService.cancelTest(context);
        NotificationSupport.createChannels(context);
        if (Build.VERSION.SDK_INT >= 33
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return;

        String title = "今刻测试提醒";
        String message = "系统闹钟、后台接收、通知弹窗和提示音均已连通。";
        android.app.PendingIntent openToday = NotificationSupport.openTodayPendingIntent(
                context,
                REQUEST_CODE + 1,
                "com.junyingjun.jinke.OPEN_TEST_REMINDER",
                NOTIFICATION_ID);
        Notification notification = new Notification.Builder(
                context,
                NotificationSupport.dailyChannel(true))
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(message)
                .setContentIntent(openToday)
                .setFullScreenIntent(NotificationSupport.fullScreenPendingIntent(
                        context,
                        REQUEST_CODE + 2,
                        "com.junyingjun.jinke.ALERT_TEST_REMINDER",
                        title,
                        message,
                        NOTIFICATION_ID), true)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setShowWhen(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_MAX)
                .setVibrate(new long[]{0, 260, 120, 260})
                .setDefaults(Notification.DEFAULT_LIGHTS)
                .build();
        NotificationSupport.wakeForReminder(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, notification);
        NotificationSupport.startReminderPlayback(
                context,
                NOTIFICATION_ID,
                notification,
                Collections.singletonList("chime"));
    }
}
