package com.junyingjun.jinke;

import android.app.Notification;
import android.app.Service;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;

public class ReminderPlaybackService extends Service {
    static final String EXTRA_NOTIFICATION = "reminder_notification";
    static final String EXTRA_NOTIFICATION_ID = "reminder_notification_id";
    static final String EXTRA_SOUND_IDS = "reminder_sound_ids";

    private final Deque<String> sounds = new ArrayDeque<>();
    private MediaPlayer activePlayer;
    private int latestStartId;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        latestStartId = startId;
        Notification notification = notificationFrom(intent);
        int notificationId = intent == null ? 19991 : intent.getIntExtra(EXTRA_NOTIFICATION_ID, 19991);
        if (notification != null) startForeground(notificationId, notification);
        ArrayList<String> requested = intent == null ? null : intent.getStringArrayListExtra(EXTRA_SOUND_IDS);
        if (requested != null) sounds.addAll(requested);
        if (activePlayer == null) playNext();
        return START_NOT_STICKY;
    }

    @SuppressWarnings("deprecation")
    private Notification notificationFrom(Intent intent) {
        if (intent == null) return null;
        if (Build.VERSION.SDK_INT >= 33) {
            return intent.getParcelableExtra(EXTRA_NOTIFICATION, Notification.class);
        }
        return intent.getParcelableExtra(EXTRA_NOTIFICATION);
    }

    private void playNext() {
        String soundId = sounds.pollFirst();
        if (soundId == null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_DETACH);
            } else {
                // Keep the actual reminder notification after the short playback service exits.
                stopForeground(false);
            }
            stopSelfResult(latestStartId);
            return;
        }
        MediaPlayer player = NotificationSupport.createPlayer(this, soundId);
        if (player == null && !"chime".equals(soundId)) {
            player = NotificationSupport.createPlayer(this, "chime");
        }
        if (player == null) {
            playNext();
            return;
        }
        activePlayer = player;
        player.setOnCompletionListener(completed -> {
            completed.release();
            activePlayer = null;
            playNext();
        });
        player.setOnErrorListener((failed, what, extra) -> {
            failed.release();
            activePlayer = null;
            playNext();
            return true;
        });
        player.start();
    }

    @Override
    public void onDestroy() {
        if (activePlayer != null) {
            activePlayer.release();
            activePlayer = null;
        }
        sounds.clear();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
