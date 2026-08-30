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

public class DailyAlarmReceiver extends BroadcastReceiver {
    private static final String LOG_TAG = "JinkeReminder";
    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationSupport.createChannels(context);
        SharedPreferences prefs = DirectBootPreferences.get(context, DailyScheduler.PREFS);
        String triggerTime = intent.getStringExtra(DailyScheduler.EXTRA_REMINDER_TIME);
        Log.i(LOG_TAG, "Daily receiver invoked for " + triggerTime
                + ", guardian=" + intent.getBooleanExtra(ReminderGuardianService.EXTRA_GUARDIAN_TICK, false));
        // Re-arm first. ColorOS may reclaim this short-lived receiver process immediately
        // after delivery, so tomorrow's alarm must not depend on notification/audio work.
        if (!intent.getBooleanExtra(ReminderGuardianService.EXTRA_GUARDIAN_TICK, false)) {
            DailyScheduler.schedule(context);
        }
        if (triggerTime == null || !triggerTime.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")) return;
        List<String> eligible = new ArrayList<>();
        List<JSONObject> eligibleTasks = new ArrayList<>();
        try {
            JSONArray tasks = new JSONArray(prefs.getString(DailyScheduler.KEY_TASKS, "[]"));
            for (int index = 0; index < tasks.length(); index++) {
                JSONObject task = tasks.optJSONObject(index);
                if (task == null || !task.optBoolean("reminderEnabled", true)) continue;
                if (!triggerTime.equals(DailyScheduler.triggerTimeFor(task))) continue;
                LocalDate logicalDate = LocalDate.now().plusDays(DailyScheduler.logicalDateOffsetFor(task));
                if (!occursOn(task, logicalDate) || isCompleted(task, logicalDate)) continue;
                String time = task.optString("time", "");
                eligible.add(task.optString("title", "日常事项") + (time.isEmpty() ? "" : " · " + time));
                eligibleTasks.add(task);
            }
        } catch (Exception ignored) {}

        String deliveryKey = "daily:" + LocalDate.now() + ":" + triggerTime;
        if (!eligible.isEmpty() && canNotify(context)
                && NotificationSupport.claimReminderDelivery(context, deliveryKey)) {
            boolean ringing = false;
            for (JSONObject task : eligibleTasks) {
                if (NotificationSupport.isRinging(task.optString("alertMode", "sound"))) {
                    ringing = true;
                    break;
                }
            }
            int minuteOfDay = Integer.parseInt(triggerTime.substring(0, 2)) * 60
                    + Integer.parseInt(triggerTime.substring(3));
            int notificationId = 10000 + minuteOfDay;
            String title = "日常事项 · " + eligible.size() + " 项";
            String message = String.join("\n", eligible);
            android.app.PendingIntent openToday = NotificationSupport.openTodayPendingIntent(
                    context,
                    12000 + minuteOfDay,
                    "com.junyingjun.jinke.OPEN_DAILY." + triggerTime,
                    notificationId);
            Notification.InboxStyle style = new Notification.InboxStyle();
            for (String line : eligible) style.addLine(line);
            Notification.Builder builder = new Notification.Builder(context, NotificationSupport.dailyChannel(ringing))
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle(title)
                    .setContentText(eligible.get(0))
                    .setStyle(style)
                    .setContentIntent(openToday)
                    .setFullScreenIntent(NotificationSupport.fullScreenPendingIntent(
                            context,
                            14000 + minuteOfDay,
                            "com.junyingjun.jinke.ALERT_DAILY." + triggerTime,
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
            Log.i(LOG_TAG, "Posted daily reminder notification " + notificationId);
            ArrayList<String> sounds = new ArrayList<>();
            for (JSONObject task : eligibleTasks) {
                if (NotificationSupport.isRinging(task.optString("alertMode", "sound"))) {
                    sounds.add(task.optString("soundId", "chime"));
                }
            }
            NotificationSupport.startReminderPlayback(context, notificationId, notification, sounds);
        } else {
            Log.i(LOG_TAG, "Daily receiver had no deliverable task or notification permission");
        }
    }

    private boolean occursOn(JSONObject task, LocalDate logicalDate) {
        String dateKey = logicalDate.toString();
        String activeFrom = task.optString("activeFrom", "");
        String activeUntil = task.optString("activeUntil", "");
        if (!activeFrom.isEmpty() && dateKey.compareTo(activeFrom) < 0) return false;
        if (!activeUntil.isEmpty() && dateKey.compareTo(activeUntil) > 0) return false;
        JSONArray repeatDays = task.optJSONArray("repeatDays");
        if (repeatDays == null || repeatDays.length() == 0) {
            String scheduledDate = task.optString("scheduledDateKey", activeFrom);
            return dateKey.equals(scheduledDate);
        }
        int weekday = logicalDate.getDayOfWeek().getValue();
        for (int index = 0; index < repeatDays.length(); index++) {
            if (repeatDays.optInt(index, -1) == weekday) return true;
        }
        return false;
    }

    private boolean isCompleted(JSONObject task, LocalDate logicalDate) {
        String dateKey = logicalDate.toString();
        JSONArray completedDates = task.optJSONArray("completedDateKeys");
        if (completedDates != null) {
            for (int index = 0; index < completedDates.length(); index++) {
                if (dateKey.equals(completedDates.optString(index))) return true;
            }
        }
        return task.optBoolean("completed", false)
                && dateKey.equals(task.optString("completionDateKey", ""));
    }

    private boolean canNotify(Context context) {
        return Build.VERSION.SDK_INT < 33
                || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }
}
