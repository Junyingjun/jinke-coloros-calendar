package com.junyingjun.jinke;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.PowerManager;

import java.io.File;
import java.util.ArrayDeque;
import java.util.Deque;

final class NotificationSupport {
    // Reminder channels are deliberately soundless. Jinke plays the selected built-in or
    // imported local sound itself, which allows every task to have a different sound on
    // Android 8+ where a notification channel's sound is otherwise immutable.
    static final String DAILY_RING_CHANNEL = "jinke_daily_ring_v3";
    static final String DAILY_SILENT_CHANNEL = "jinke_daily_silent_v3";
    static final String DDL_RING_CHANNEL = "jinke_ddl_ring_v3";
    static final String DDL_SILENT_CHANNEL = "jinke_ddl_silent_v3";
    static final String UPDATE_CHANNEL = "jinke_update";
    static final String EXTRA_OPEN_TODAY = "jinke_open_today";
    static final String EXTRA_REMINDER_TITLE = "jinke_reminder_title";
    static final String EXTRA_REMINDER_MESSAGE = "jinke_reminder_message";
    static final String SOUND_DIRECTORY = "reminder_sounds";

    private static final Deque<String> SOUND_QUEUE = new ArrayDeque<>();
    private static MediaPlayer activePlayer;

    private NotificationSupport() {}

    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        manager.createNotificationChannel(reminderChannel(DAILY_RING_CHANNEL, "日常提醒（响铃）", "日常事项按设定时间响铃提醒", true));
        manager.createNotificationChannel(reminderChannel(DAILY_SILENT_CHANNEL, "日常提醒（静音）", "日常事项按设定时间静音提醒", false));
        manager.createNotificationChannel(reminderChannel(DDL_RING_CHANNEL, "关键提醒（响铃）", "关键事项按提醒计划响铃提醒", true));
        manager.createNotificationChannel(reminderChannel(DDL_SILENT_CHANNEL, "关键提醒（静音）", "关键事项按提醒计划静音提醒", false));
        NotificationChannel update = new NotificationChannel(
                UPDATE_CHANNEL,
                context.getString(R.string.update_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT);
        update.setDescription("今刻新版本下载与安装提醒");
        manager.createNotificationChannel(update);
    }

    private static NotificationChannel reminderChannel(String id, String name, String description, boolean vibrate) {
        NotificationChannel channel = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(description);
        channel.setSound(null, null);
        channel.enableVibration(vibrate);
        if (vibrate) channel.setVibrationPattern(new long[]{0, 260, 120, 260});
        channel.enableLights(true);
        channel.setLightColor(Color.rgb(255, 96, 72));
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        return channel;
    }

    static String dailyChannel(boolean ringing) {
        return ringing ? DAILY_RING_CHANNEL : DAILY_SILENT_CHANNEL;
    }

    static String ddlChannel(boolean ringing) {
        return ringing ? DDL_RING_CHANNEL : DDL_SILENT_CHANNEL;
    }

    static boolean isRinging(String alertMode) {
        return !"silent".equals(alertMode);
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

    static void enqueueReminderSound(Context context, String soundId) {
        Context applicationContext = context.getApplicationContext();
        synchronized (NotificationSupport.class) {
            SOUND_QUEUE.addLast(soundId == null || soundId.isEmpty() ? "chime" : soundId);
            if (activePlayer == null) playNext(applicationContext);
        }
    }

    private static void playNext(Context context) {
        String soundId;
        synchronized (NotificationSupport.class) {
            soundId = SOUND_QUEUE.pollFirst();
            if (soundId == null) {
                activePlayer = null;
                return;
            }
        }
        MediaPlayer player = createPlayer(context, soundId);
        if (player == null && !"chime".equals(soundId)) player = createPlayer(context, "chime");
        if (player == null) {
            synchronized (NotificationSupport.class) { activePlayer = null; }
            playNext(context);
            return;
        }
        synchronized (NotificationSupport.class) { activePlayer = player; }
        player.setOnCompletionListener(completed -> {
            completed.release();
            synchronized (NotificationSupport.class) { activePlayer = null; }
            playNext(context);
        });
        player.setOnErrorListener((failed, what, extra) -> {
            failed.release();
            synchronized (NotificationSupport.class) { activePlayer = null; }
            playNext(context);
            return true;
        });
        player.start();
    }

    private static MediaPlayer createPlayer(Context context, String soundId) {
        int resource = rawResource(soundId);
        AudioAttributes notificationAudio = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        if (resource != 0) return MediaPlayer.create(context, resource, notificationAudio, 0);
        File directory = new File(context.getFilesDir(), SOUND_DIRECTORY);
        File[] matches = directory.listFiles((dir, name) -> name.startsWith(soundId + "."));
        if (matches == null || matches.length == 0) return null;
        try {
            MediaPlayer player = new MediaPlayer();
            player.setAudioAttributes(notificationAudio);
            player.setDataSource(matches[0].getAbsolutePath());
            player.prepare();
            return player;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static int rawResource(String soundId) {
        if ("bell".equals(soundId)) return R.raw.jinke_bell;
        if ("glass".equals(soundId)) return R.raw.jinke_glass;
        if ("pop".equals(soundId)) return R.raw.jinke_pop;
        if ("soft".equals(soundId)) return R.raw.jinke_soft;
        return "chime".equals(soundId) ? R.raw.jinke_chime : 0;
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
