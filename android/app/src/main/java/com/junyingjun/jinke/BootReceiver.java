package com.junyingjun.jinke;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String LOG_TAG = "JinkeReminder";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(LOG_TAG, "System reminder restore: " + (intent == null ? "unknown" : intent.getAction()));
        DdlScheduler.schedule(context);
        DailyScheduler.schedule(context);
        ReminderGuardianService.updateState(context);
    }
}
