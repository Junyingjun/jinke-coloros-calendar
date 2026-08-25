package com.junyingjun.jinke;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class DdlAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationSupport.createChannels(context);
        SharedPreferences prefs = context.getSharedPreferences(DdlScheduler.PREFS, Context.MODE_PRIVATE);
        String triggerTime = DdlScheduler.normalizeTime(intent.getStringExtra(DdlScheduler.EXTRA_REMINDER_TIME));
        int defaultMultiple = Math.max(1, prefs.getInt(DdlScheduler.KEY_MULTIPLE, 5));
        int defaultFinalDays = Math.max(0, prefs.getInt(DdlScheduler.KEY_FINAL_DAYS, 5));
        long elapsedDays = LocalDate.now().toEpochDay() - prefs.getLong(DdlScheduler.KEY_SYNC_DAY, LocalDate.now().toEpochDay());
        List<String> eligible = new ArrayList<>();
        try {
            JSONArray tasks = new JSONArray(prefs.getString(DdlScheduler.KEY_TASKS, "[]"));
            for (int index = 0; index < tasks.length(); index++) {
                JSONObject task = tasks.getJSONObject(index);
                if (!task.optBoolean("reminderEnabled", true)) continue;
                String taskTime = DdlScheduler.reminderTimeFor(task, prefs.getString(DdlScheduler.KEY_TIME, "10:00"));
                if (!triggerTime.equals(taskTime)) continue;
                int daysLeft = task.optInt("daysLeft", -1) - (int) elapsedDays;
                int multiple = Math.max(1, task.optInt("reminderMultiple", defaultMultiple));
                int finalDays = Math.max(0, task.optInt("reminderFinalDays", defaultFinalDays));
                String mode = task.optString("reminderMode", "smart");
                if (!isEligible(daysLeft, mode, multiple, finalDays, DdlScheduler.reminderDayOffsetFor(task))) continue;
                String suffix = daysLeft == 0 ? "今天截止" : "剩 " + daysLeft + " 天";
                eligible.add(task.optString("title", "关键事项") + " · " + suffix);
            }
        } catch (Exception ignored) {}

        if (!eligible.isEmpty() && canNotify(context)) {
            int minuteOfDay = Integer.parseInt(triggerTime.substring(0, 2)) * 60 + Integer.parseInt(triggerTime.substring(3));
            String title = "关键事项 · " + eligible.size() + " 项";
            String message = String.join("\n", eligible);
            android.app.PendingIntent openToday = NotificationSupport.openTodayPendingIntent(
                    context,
                    8500 + minuteOfDay,
                    "com.junyingjun.jinke.OPEN_DDL." + triggerTime);
            Notification.InboxStyle style = new Notification.InboxStyle();
            for (String line : eligible) style.addLine(line);
            Notification notification = new Notification.Builder(context, NotificationSupport.DDL_CHANNEL)
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle(title)
                    .setContentText(eligible.get(0))
                    .setStyle(style)
                    .setContentIntent(openToday)
                    .setFullScreenIntent(NotificationSupport.fullScreenPendingIntent(
                            context,
                            9000 + minuteOfDay,
                            "com.junyingjun.jinke.ALERT_DDL." + triggerTime,
                            title,
                            message), true)
                    .setAutoCancel(true)
                    .addAction(new Notification.Action.Builder(R.drawable.ic_notification, "打开今刻", openToday).build())
                    .setCategory(Notification.CATEGORY_REMINDER)
                    .setShowWhen(true)
                    .setVisibility(Notification.VISIBILITY_PUBLIC)
                    .setPriority(Notification.PRIORITY_MAX)
                    .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE | Notification.DEFAULT_LIGHTS)
                    .build();
            NotificationSupport.wakeForReminder(context);
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) manager.notify(7000 + minuteOfDay, notification);
        }
        DdlScheduler.schedule(context);
    }

    private boolean isEligible(int daysLeft, String mode, int multiple, int finalDays, int deadlineDayOffset) {
        if (daysLeft < 0) return false;
        if ("daily".equals(mode) || "final-days".equals(mode)) return daysLeft <= finalDays;
        if ("deadline-only".equals(mode)) return daysLeft == deadlineDayOffset;
        return daysLeft <= finalDays || daysLeft % multiple == 0;
    }

    private boolean canNotify(Context context) {
        return Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }
}
