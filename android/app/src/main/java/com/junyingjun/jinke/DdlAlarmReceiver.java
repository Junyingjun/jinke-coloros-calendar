package com.junyingjun.jinke;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
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
        int multiple = Math.max(1, prefs.getInt(DdlScheduler.KEY_MULTIPLE, 5));
        int finalDays = Math.max(0, prefs.getInt(DdlScheduler.KEY_FINAL_DAYS, 5));
        long elapsedDays = LocalDate.now().toEpochDay() - prefs.getLong(
                DdlScheduler.KEY_SYNC_DAY, LocalDate.now().toEpochDay());
        List<String> eligible = new ArrayList<>();
        try {
            JSONArray tasks = new JSONArray(prefs.getString(DdlScheduler.KEY_TASKS, "[]"));
            for (int index = 0; index < tasks.length(); index++) {
                JSONObject task = tasks.getJSONObject(index);
                int daysLeft = task.optInt("daysLeft", -1) - (int) elapsedDays;
                if (daysLeft < 0 || !(daysLeft <= finalDays || daysLeft % multiple == 0)) continue;
                String suffix = daysLeft == 0 ? "今天截止" : "剩 " + daysLeft + " 天";
                eligible.add(task.optString("title", "关键事项") + " · " + suffix);
            }
        } catch (Exception ignored) {}

        if (!eligible.isEmpty() && canNotify(context)) {
            Intent openIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            PendingIntent contentIntent = PendingIntent.getActivity(
                    context, 5101, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.InboxStyle style = new Notification.InboxStyle();
            for (String line : eligible) style.addLine(line);
            Notification notification = new Notification.Builder(context, NotificationSupport.DDL_CHANNEL)
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle("关键事项 · " + eligible.size() + " 项")
                    .setContentText(eligible.get(0))
                    .setStyle(style)
                    .setContentIntent(contentIntent)
                    .setAutoCancel(true)
                    .setCategory(Notification.CATEGORY_REMINDER)
                    .build();
            context.getSystemService(NotificationManager.class).notify(5100, notification);
        }
        DdlScheduler.schedule(context);
    }

    private boolean canNotify(Context context) {
        return Build.VERSION.SDK_INT < 33
                || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }
}
