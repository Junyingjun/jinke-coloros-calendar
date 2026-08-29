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
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class DdlAlarmReceiver extends BroadcastReceiver {
    private static final String LOG_TAG = "JinkeReminder";
    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationSupport.createChannels(context);
        SharedPreferences prefs = context.getSharedPreferences(DdlScheduler.PREFS, Context.MODE_PRIVATE);
        String triggerTime = DdlScheduler.normalizeTime(intent.getStringExtra(DdlScheduler.EXTRA_REMINDER_TIME));
        Log.i(LOG_TAG, "DDL receiver invoked for " + triggerTime
                + ", guardian=" + intent.getBooleanExtra(ReminderGuardianService.EXTRA_GUARDIAN_TICK, false));
        // Always persist the next wakeup before doing any heavier notification work.
        if (!intent.getBooleanExtra(ReminderGuardianService.EXTRA_GUARDIAN_TICK, false)) {
            DdlScheduler.schedule(context);
        }
        int defaultMultiple = Math.max(1, prefs.getInt(DdlScheduler.KEY_MULTIPLE, 5));
        int defaultFinalDays = Math.max(0, prefs.getInt(DdlScheduler.KEY_FINAL_DAYS, 5));
        long elapsedDays = LocalDate.now().toEpochDay() - prefs.getLong(DdlScheduler.KEY_SYNC_DAY, LocalDate.now().toEpochDay());
        List<String> eligible = new ArrayList<>();
        List<JSONObject> eligibleTasks = new ArrayList<>();
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
                eligibleTasks.add(task);
            }
        } catch (Exception ignored) {}

        String deliveryKey = "ddl:" + LocalDate.now() + ":" + triggerTime;
        if (!eligible.isEmpty() && canNotify(context)
                && NotificationSupport.claimReminderDelivery(context, deliveryKey)) {
            boolean ringing = false;
            for (JSONObject task : eligibleTasks) {
                if (NotificationSupport.isRinging(task.optString("alertMode", "sound"))) {
                    ringing = true;
                    break;
                }
            }
            int minuteOfDay = Integer.parseInt(triggerTime.substring(0, 2)) * 60 + Integer.parseInt(triggerTime.substring(3));
            int notificationId = 7000 + minuteOfDay;
            String title = "关键事项 · " + eligible.size() + " 项";
            String message = String.join("\n", eligible);
            android.app.PendingIntent openToday = NotificationSupport.openTodayPendingIntent(
                    context,
                    8500 + minuteOfDay,
                    "com.junyingjun.jinke.OPEN_DDL." + triggerTime,
                    notificationId);
            Notification.InboxStyle style = new Notification.InboxStyle();
            for (String line : eligible) style.addLine(line);
            Notification.Builder builder = new Notification.Builder(context, NotificationSupport.ddlChannel(ringing))
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
                            message,
                            notificationId), true)
                    .setAutoCancel(true)
                    .addAction(new Notification.Action.Builder(R.drawable.ic_notification, "打开今刻", openToday).build())
                    .setCategory(Notification.CATEGORY_REMINDER)
                    .setShowWhen(true)
                    .setVisibility(Notification.VISIBILITY_PUBLIC)
                    .setPriority(Notification.PRIORITY_MAX)
                    .setDefaults(Notification.DEFAULT_LIGHTS);
            if (ringing) builder.setVibrate(new long[]{0, 260, 120, 260});
            NotificationSupport.wakeForReminder(context);
            Notification notification = builder.build();
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) manager.notify(notificationId, notification);
            Log.i(LOG_TAG, "Posted DDL reminder notification " + notificationId);
            ArrayList<String> sounds = new ArrayList<>();
            for (JSONObject task : eligibleTasks) {
                if (NotificationSupport.isRinging(task.optString("alertMode", "sound"))) {
                    sounds.add(task.optString("soundId", "chime"));
                }
            }
            NotificationSupport.startReminderPlayback(context, notificationId, notification, sounds);
        } else {
            Log.i(LOG_TAG, "DDL receiver had no deliverable task or notification permission");
        }
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
