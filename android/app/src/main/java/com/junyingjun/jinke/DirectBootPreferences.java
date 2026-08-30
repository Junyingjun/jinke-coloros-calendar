package com.junyingjun.jinke;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

/** Stores the native reminder plan where it is readable before the first unlock after reboot. */
final class DirectBootPreferences {
    private static final String LOG_TAG = "JinkeReminder";

    private DirectBootPreferences() {}

    static SharedPreferences get(Context context, String name) {
        Context deviceContext = context.createDeviceProtectedStorageContext();
        if (!context.isDeviceProtectedStorage()) {
            try {
                deviceContext.moveSharedPreferencesFrom(context, name);
            } catch (RuntimeException error) {
                Log.w(LOG_TAG, "Unable to migrate reminder preferences " + name, error);
            }
        }
        return deviceContext.getSharedPreferences(name, Context.MODE_PRIVATE);
    }
}
