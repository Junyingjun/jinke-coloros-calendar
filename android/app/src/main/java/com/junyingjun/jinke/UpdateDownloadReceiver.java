package com.junyingjun.jinke;

import android.app.DownloadManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

public class UpdateDownloadReceiver extends BroadcastReceiver {
    public static final String PREFS = "jinke_update_preferences";
    public static final String KEY_DOWNLOAD_ID = "download_id";
    public static final String KEY_SOURCE_VERSION_CODE = "source_version_code";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
        long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
        long expectedId = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getLong(KEY_DOWNLOAD_ID, -2L);
        if (completedId != expectedId) return;
        DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        Uri apkUri = manager.getUriForDownloadedFile(completedId);
        if (apkUri == null) return;
        Intent install = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(apkUri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 5200, install, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationSupport.createChannels(context);
        Notification notification = new Notification.Builder(context, NotificationSupport.UPDATE_CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("今刻更新已下载")
                .setContentText("点击安装最新版")
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build();
        context.getSystemService(NotificationManager.class).notify(5200, notification);
    }
}
