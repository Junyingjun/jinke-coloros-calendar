package com.junyingjun.jinke;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

final class NotificationSupport {
    static final String DDL_CHANNEL = "jinke_ddl";
    static final String UPDATE_CHANNEL = "jinke_update";

    private NotificationSupport() {}

    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel ddl = new NotificationChannel(
                DDL_CHANNEL,
                context.getString(R.string.ddl_channel_name),
                NotificationManager.IMPORTANCE_HIGH);
        ddl.setDescription("按设定倍数节点与临近截止天数提醒关键事项");
        NotificationChannel update = new NotificationChannel(
                UPDATE_CHANNEL,
                context.getString(R.string.update_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT);
        update.setDescription("今刻新版本下载与安装提醒");
        manager.createNotificationChannel(ddl);
        manager.createNotificationChannel(update);
    }
}
