package com.junyingjun.jinke;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.DownloadManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Color;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.Settings;
import android.provider.OpenableColumns;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.webkit.MimeTypeMap;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Locale;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final int REQUEST_NOTIFICATIONS = 9022;
    private static final int REQUEST_MICROPHONE = 9023;
    private static final int REQUEST_REMINDER_SOUND = 9024;
    private static final int REQUEST_SYSTEM_ALARM_SOUND = 9025;
    private static final String SYSTEM_PREFS = "jinke-system-state";
    private static final String APP_STATE_PREFS = "jinke-app-state";
    private static final String BACKGROUND_SETTINGS_OPENED = "background-settings-opened";
    private WebView webView;
    private OfflineSpeechEngine offlineSpeechEngine;
    private boolean openSpeechAfterPermission;
    private boolean webAppReady;
    private boolean pendingOpenToday;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface", "ObsoleteSdkInt"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);

        NotificationSupport.createChannels(this);
        DdlScheduler.schedule(this);
        DailyScheduler.schedule(this);
        ReminderGuardianService.updateState(this);
        cleanupInstalledUpdateApk();
        NotificationSupport.dismissReminder(this, getIntent());
        pendingOpenToday = getIntent() != null
                && getIntent().getBooleanExtra(NotificationSupport.EXTRA_OPEN_TODAY, false);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(8, 7, 6));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                webAppReady = true;
                deliverOpenToday();
                view.postDelayed(MainActivity.this::deliverReminderSyncRequest, 350L);
                view.postDelayed(MainActivity.this::deliverReminderSyncRequest, 1200L);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean requestsAudio = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            requestsAudio = true;
                            break;
                        }
                    }
                    if (requestsAudio
                            && (Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                            || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        request.deny();
                    }
                });
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), "JinkeAndroid");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");
        webView.postDelayed(this::requestNotificationPermissionIfNeeded, 500L);
        offlineSpeechEngine = new OfflineSpeechEngine(this, new OfflineSpeechEngine.Callback() {
            @Override
            public void onStatus(String status) {
                runOnUiThread(() -> {
                    deliverSpeechStatus(status);
                    deliverSystemCapabilities();
                });
            }

            @Override
            public void onPartial(String text) {
                runOnUiThread(() -> deliverSpeechPartial(text));
            }

            @Override
            public void onAlternatives(String candidatesJson) {
                runOnUiThread(() -> deliverSpeechAlternatives(candidatesJson));
            }

            @Override
            public void onFinal(String text) {
                runOnUiThread(() -> deliverSpeechResult(text));
            }

            @Override
            public void onError(String message) {
                runOnUiThread(() -> {
                    deliverSpeechStatus("error");
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
                    deliverSpeechResult("");
                    deliverSystemCapabilities();
                });
            }
        });
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
        }
    }

    private void startSpeechRecognitionWithPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            if (offlineSpeechEngine != null) offlineSpeechEngine.start();
            return;
        }
        openSpeechAfterPermission = true;
        deliverSpeechStatus("requesting-permission");
        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_MICROPHONE);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATIONS
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            NotificationSupport.createChannels(this);
            DdlScheduler.schedule(this);
            DailyScheduler.schedule(this);
            if (webView != null) webView.postDelayed(this::deliverReminderSyncRequest, 200L);
        }
        if (requestCode == REQUEST_MICROPHONE) {
            boolean shouldOpenSpeech = openSpeechAfterPermission;
            openSpeechAfterPermission = false;
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted && shouldOpenSpeech) {
                if (offlineSpeechEngine != null) offlineSpeechEngine.start();
            } else if (!granted && shouldOpenSpeech) {
                deliverSpeechStatus("permission-denied");
                Toast.makeText(this, "需要麦克风权限才能使用语音助手", Toast.LENGTH_LONG).show();
                deliverSpeechResult("");
            }
        }
        deliverSystemCapabilities();
    }

    private void pickReminderSound() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("audio/*")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivityForResult(intent, REQUEST_REMINDER_SOUND);
    }

    private void pickSystemAlarmSound(String currentSoundId) {
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "选择手机系统闹铃");
        Uri existing = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (currentSoundId != null && currentSoundId.startsWith("alarm:")) {
            try { existing = Uri.parse(currentSoundId.substring("alarm:".length())); } catch (Exception ignored) {}
        }
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, existing);
        startActivityForResult(intent, REQUEST_SYSTEM_ALARM_SOUND);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_SYSTEM_ALARM_SOUND) {
            if (resultCode != RESULT_OK || data == null) return;
            Uri source = data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
            if (source == null) return;
            try {
                Ringtone ringtone = RingtoneManager.getRingtone(this, source);
                String title = ringtone == null ? "系统闹铃" : ringtone.getTitle(this);
                JSONObject payload = new JSONObject();
                payload.put("id", "alarm:" + source);
                payload.put("name", title == null || title.trim().isEmpty() ? "系统闹铃" : title.trim());
                payload.put("source", "system-alarm");
                payload.put("uri", source.toString());
                deliverImportedSound(payload.toString());
            } catch (Exception ignored) {
                Toast.makeText(this, "无法读取该系统闹铃，请重新选择", Toast.LENGTH_LONG).show();
            }
            return;
        }
        if (requestCode != REQUEST_REMINDER_SOUND || resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri source = data.getData();
        try {
            String displayName = reminderSoundDisplayName(source);
            String extension = reminderSoundExtension(source, displayName);
            String id = "custom-" + UUID.randomUUID().toString().replace("-", "");
            File directory = new File(getFilesDir(), NotificationSupport.SOUND_DIRECTORY);
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("sound directory unavailable");
            File destination = new File(directory, id + "." + extension);
            try (InputStream input = getContentResolver().openInputStream(source);
                 FileOutputStream output = new FileOutputStream(destination)) {
                if (input == null) throw new IllegalStateException("sound stream unavailable");
                byte[] buffer = new byte[32768];
                int read;
                while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
            }
            JSONObject payload = new JSONObject();
            payload.put("id", id);
            payload.put("name", displayName.replaceFirst("\\.[^.]+$", ""));
            payload.put("source", "local");
            deliverImportedSound(payload.toString());
        } catch (Exception ignored) {
            Toast.makeText(this, "音效导入失败，请选择常见的音频文件", Toast.LENGTH_LONG).show();
        }
    }

    private String reminderSoundDisplayName(Uri uri) {
        try (Cursor cursor = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) {
                    String value = cursor.getString(column);
                    if (value != null && !value.trim().isEmpty()) return value.trim();
                }
            }
        } catch (Exception ignored) {}
        return "本地音效";
    }

    private String reminderSoundExtension(Uri uri, String displayName) {
        String fromName = MimeTypeMap.getFileExtensionFromUrl(displayName);
        if (fromName != null && fromName.matches("[A-Za-z0-9]{1,8}")) return fromName.toLowerCase(Locale.ROOT);
        String mimeType = getContentResolver().getType(uri);
        String fromMime = mimeType == null ? null : MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
        return fromMime == null || fromMime.isEmpty() ? "audio" : fromMime.toLowerCase(Locale.ROOT);
    }

    private void deliverImportedSound(String payload) {
        if (webView == null) return;
        String script = "window.JINKE_SOUND_IMPORTED && window.JINKE_SOUND_IMPORTED(" + JSONObject.quote(payload) + ");";
        webView.evaluateJavascript(script, null);
    }

    private void deliverSpeechResult(String result) {
        if (webView == null) return;
        String script = "window.JINKE_NATIVE_SPEECH_RESULT && window.JINKE_NATIVE_SPEECH_RESULT("
                + JSONObject.quote(result) + ");";
        webView.evaluateJavascript(script, null);
    }

    private void deliverSpeechPartial(String result) {
        if (webView == null) return;
        String script = "window.JINKE_NATIVE_SPEECH_PARTIAL && window.JINKE_NATIVE_SPEECH_PARTIAL("
                + JSONObject.quote(result) + ");";
        webView.evaluateJavascript(script, null);
    }

    private void deliverSpeechAlternatives(String candidatesJson) {
        if (webView == null) return;
        String script = "window.JINKE_NATIVE_SPEECH_CANDIDATES && window.JINKE_NATIVE_SPEECH_CANDIDATES("
                + JSONObject.quote(candidatesJson) + ");";
        webView.evaluateJavascript(script, null);
    }

    private void deliverSpeechStatus(String status) {
        if (webView == null) return;
        String script = "window.JINKE_NATIVE_SPEECH_STATUS && window.JINKE_NATIVE_SPEECH_STATUS("
                + JSONObject.quote(status) + ");";
        webView.evaluateJavascript(script, null);
    }

    private String currentSystemCapabilities() {
        try {
            JSONObject payload = new JSONObject();
            boolean microphone = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                    || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            boolean notifications = (Build.VERSION.SDK_INT < 33
                    || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
                    && (notificationManager == null || notificationManager.areNotificationsEnabled());
            AlarmManager alarmManager = getSystemService(AlarmManager.class);
            boolean exactAlarm = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                    || (alarmManager != null && alarmManager.canScheduleExactAlarms());
            PowerManager powerManager = getSystemService(PowerManager.class);
            boolean batteryUnrestricted = powerManager != null
                    && powerManager.isIgnoringBatteryOptimizations(getPackageName());
            boolean backgroundConfigured = batteryUnrestricted || getSharedPreferences(SYSTEM_PREFS, MODE_PRIVATE)
                    .getBoolean(BACKGROUND_SETTINGS_OPENED, false);
            boolean installUpdates = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                    || getPackageManager().canRequestPackageInstalls();
            payload.put("microphone", microphone);
            payload.put("notifications", notifications);
            payload.put("exactAlarm", exactAlarm);
            payload.put("fullScreenIntent", Build.VERSION.SDK_INT < 34
                    || (notificationManager != null && notificationManager.canUseFullScreenIntent()));
            payload.put("batteryUnrestricted", batteryUnrestricted);
            payload.put("backgroundConfigured", backgroundConfigured);
            payload.put("installUpdates", installUpdates);
            payload.put("network", hasValidatedNetwork());
            payload.put("offlineSpeechBundled", true);
            payload.put("offlineSpeechReady", offlineSpeechEngine != null && offlineSpeechEngine.isReady());
            payload.put("bootRestore", true);
            payload.put("guardianActive", ReminderGuardianService.isHealthy(this));
            payload.put("guardianLastTick", ReminderGuardianService.lastTick(this));
            payload.put("systemAlarmMode", AlarmSchedulingSupport.latestMode(this));
            payload.put("systemAlarmTriggerAt", AlarmSchedulingSupport.latestTriggerAt(this));
            payload.put("systemAlarmRegisteredAt", AlarmSchedulingSupport.latestRegisteredAt(this));
            payload.put("backupJobCount", ReminderBackupJobService.pendingCount(this));
            android.content.SharedPreferences dailyPrefs = DirectBootPreferences.get(this, DailyScheduler.PREFS);
            android.content.SharedPreferences ddlPrefs = DirectBootPreferences.get(this, DdlScheduler.PREFS);
            payload.put("dailyReminderCount", new JSONArray(dailyPrefs.getString(DailyScheduler.KEY_TASKS, "[]")).length());
            payload.put("dailyAlarmTimes", dailyPrefs.getString(DailyScheduler.KEY_SCHEDULED_TIMES, ""));
            payload.put("ddlReminderCount", new JSONArray(ddlPrefs.getString(DdlScheduler.KEY_TASKS, "[]")).length());
            payload.put("ddlAlarmTimes", ddlPrefs.getString(DdlScheduler.KEY_SCHEDULED_TIMES, ""));
            return payload.toString();
        } catch (Exception ignored) {
            return "{}";
        }
    }

    private boolean hasValidatedNetwork() {
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        if (manager == null) return false;
        Network network = manager.getActiveNetwork();
        NetworkCapabilities capabilities = network == null ? null : manager.getNetworkCapabilities(network);
        return capabilities != null
                && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private void deliverSystemCapabilities() {
        if (webView == null) return;
        String script = "window.JINKE_NATIVE_CAPABILITIES_CHANGED && window.JINKE_NATIVE_CAPABILITIES_CHANGED("
                + JSONObject.quote(currentSystemCapabilities()) + ");";
        webView.evaluateJavascript(script, null);
    }

    private void deliverReminderSyncRequest() {
        if (!webAppReady || webView == null) return;
        webView.evaluateJavascript(
                "window.JINKE_REQUEST_REMINDER_SYNC && window.JINKE_REQUEST_REMINDER_SYNC();",
                null);
    }

    private void scheduleReminderTest() {
        requestNotificationPermissionIfNeeded();
        NotificationSupport.createChannels(this);
        AlarmManager manager = getSystemService(AlarmManager.class);
        if (manager == null) {
            Toast.makeText(this, "系统闹钟服务不可用", Toast.LENGTH_LONG).show();
            return;
        }
        Intent intent = new Intent(this, ReminderTestReceiver.class)
                .setAction(ReminderTestReceiver.ACTION)
                .addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                this,
                ReminderTestReceiver.REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        long triggerAtMillis = System.currentTimeMillis() + 8000L;
        AlarmSchedulingSupport.scheduleWakeup(
                this,
                manager,
                triggerAtMillis,
                pendingIntent);
        ReminderBackupJobService.scheduleTest(this, triggerAtMillis);
        Toast.makeText(this, "测试提醒已登记，请在 8 秒内返回桌面", Toast.LENGTH_LONG).show();
    }

    private void openExternalUrl(String url) {
        try {
            Uri uri = Uri.parse(url == null ? "" : url);
            String scheme = uri.getScheme();
            if (!("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))) return;
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignored) {
            Toast.makeText(this, "无法打开来源链接", Toast.LENGTH_SHORT).show();
        }
    }

    private void openCapabilitySettings(String capability) {
        if ("microphone".equals(capability)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_MICROPHONE);
            } else {
                openAppDetails();
            }
            return;
        }
        if ("notifications".equals(capability)) {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
            } else {
                Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                startActivity(intent);
            }
            return;
        }
        if ("exactAlarm".equals(capability) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + getPackageName())));
            return;
        }
        if ("fullScreenIntent".equals(capability) && Build.VERSION.SDK_INT >= 34) {
            startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                    Uri.parse("package:" + getPackageName())));
            return;
        }
        if ("battery".equals(capability) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + getPackageName())));
            return;
        }
        if ("background".equals(capability)) {
            openBackgroundSettings();
            return;
        }
        if ("installUpdates".equals(capability) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())));
            return;
        }
        openAppDetails();
    }

    private void openBackgroundSettings() {
        Intent[] colorOsIntents = new Intent[]{
                new Intent().setClassName("com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"),
                new Intent().setClassName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
                new Intent().setClassName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
                new Intent().setClassName("com.oplus.battery", "com.oplus.powermanager.fuelgaue.PowerUsageModelActivity")
                        .putExtra("packageName", getPackageName()),
                new Intent().setClassName("com.coloros.oppoguardelf", "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity")
                        .putExtra("packageName", getPackageName())
        };
        for (Intent intent : colorOsIntents) {
            try {
                startActivity(intent);
                markBackgroundSettingsOpened();
                return;
            } catch (Exception ignored) {
                // ColorOS component names vary by version; continue through the known fallbacks.
            }
        }
        markBackgroundSettingsOpened();
        openAppDetails();
    }

    private void markBackgroundSettingsOpened() {
        getSharedPreferences(SYSTEM_PREFS, MODE_PRIVATE)
                .edit()
                .putBoolean(BACKGROUND_SETTINGS_OPENED, true)
                .apply();
    }

    private void openAppDetails() {
        startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getPackageName())));
    }

    private String currentWindowLayout() {
        Configuration configuration = getResources().getConfiguration();
        int widthDp = Math.max(1, configuration.screenWidthDp);
        int heightDp = Math.max(1, configuration.screenHeightDp);
        double ratio = (double) Math.min(widthDp, heightDp) / (double) Math.max(widthDp, heightDp);
        try {
            JSONObject payload = new JSONObject();
            payload.put("widthDp", widthDp);
            payload.put("heightDp", heightDp);
            payload.put("ratio", ratio);
            payload.put("expanded", ratio >= 0.68d);
            return payload.toString();
        } catch (Exception ignored) {
            return "{\"widthDp\":1,\"heightDp\":1,\"ratio\":0,\"expanded\":false}";
        }
    }

    private void deliverWindowLayout() {
        if (webView == null) return;
        String script = "window.JINKE_NATIVE_WINDOW_CHANGED && window.JINKE_NATIVE_WINDOW_CHANGED("
                + JSONObject.quote(currentWindowLayout()) + ");";
        webView.evaluateJavascript(script, null);
    }

    private void deliverSystemTimeChanged() {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.JINKE_REFRESH_SYSTEM_TIME && window.JINKE_REFRESH_SYSTEM_TIME();",
                null
        );
    }

    private void deliverOpenToday() {
        if (!pendingOpenToday || !webAppReady || webView == null) return;
        pendingOpenToday = false;
        webView.evaluateJavascript(
                "window.JINKE_OPEN_TODAY && window.JINKE_OPEN_TODAY();",
                null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        NotificationSupport.dismissReminder(this, intent);
        if (intent != null && intent.getBooleanExtra(NotificationSupport.EXTRA_OPEN_TODAY, false)) {
            pendingOpenToday = true;
            if (webView != null) webView.post(this::deliverOpenToday);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (webView != null) webView.post(this::deliverWindowLayout);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.post(() -> {
            deliverWindowLayout();
            deliverSystemCapabilities();
            deliverSystemTimeChanged();
            deliverReminderSyncRequest();
            deliverOpenToday();
        });
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            performDefaultBack();
            return;
        }
        webView.evaluateJavascript(
                "Boolean(window.JINKE_NATIVE_BACK && window.JINKE_NATIVE_BACK());",
                result -> runOnUiThread(() -> {
                    if ("true".equals(result)) return;
                    if (webView.canGoBack()) webView.goBack();
                    else performDefaultBack();
                }));
    }

    private void performDefaultBack() {
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (offlineSpeechEngine != null) {
            offlineSpeechEngine.close();
            offlineSpeechEngine = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("JinkeAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getWindowLayout() {
            return currentWindowLayout();
        }

        @JavascriptInterface
        public String getAppVersion() {
            return BuildConfig.VERSION_NAME;
        }

        @JavascriptInterface
        public String getSystemCapabilities() {
            return currentSystemCapabilities();
        }

        @JavascriptInterface
        public String getAppState(String key) {
            if (key == null || !key.startsWith("jinke-")) return "";
            return getSharedPreferences(APP_STATE_PREFS, MODE_PRIVATE).getString(key, "");
        }

        @JavascriptInterface
        public boolean saveAppState(String key, String value) {
            if (key == null || !key.startsWith("jinke-") || value == null) return false;
            return getSharedPreferences(APP_STATE_PREFS, MODE_PRIVATE)
                    .edit()
                    .putString(key, value)
                    .commit();
        }

        @JavascriptInterface
        public void startSpeechRecognition() {
            runOnUiThread(MainActivity.this::startSpeechRecognitionWithPermission);
        }

        @JavascriptInterface
        public void stopSpeechRecognition() {
            runOnUiThread(() -> {
                if (offlineSpeechEngine != null) offlineSpeechEngine.stop();
            });
        }

        @JavascriptInterface
        public void cancelSpeechRecognition() {
            runOnUiThread(() -> {
                openSpeechAfterPermission = false;
                if (offlineSpeechEngine != null) offlineSpeechEngine.cancel();
            });
        }

        @JavascriptInterface
        public void openCapabilitySettings(String capability) {
            runOnUiThread(() -> MainActivity.this.openCapabilitySettings(capability));
        }

        @JavascriptInterface
        public void scheduleReminderTest() {
            runOnUiThread(MainActivity.this::scheduleReminderTest);
        }

        @JavascriptInterface
        public void openExternalUrl(String url) {
            runOnUiThread(() -> MainActivity.this.openExternalUrl(url));
        }

        @JavascriptInterface
        public void syncDdlReminders(String tasksJson, String time, int multiple, int finalDays) {
            DdlScheduler.saveAndSchedule(MainActivity.this, tasksJson, time, multiple, finalDays);
        }

        @JavascriptInterface
        public void syncDailyReminders(String tasksJson) {
            DailyScheduler.saveAndSchedule(MainActivity.this, tasksJson);
        }

        @JavascriptInterface
        public void pickReminderSound() {
            runOnUiThread(MainActivity.this::pickReminderSound);
        }

        @JavascriptInterface
        public void pickSystemAlarmSound(String currentSoundId) {
            runOnUiThread(() -> MainActivity.this.pickSystemAlarmSound(currentSoundId));
        }

        @JavascriptInterface
        public void previewReminderSound(String soundId) {
            runOnUiThread(() -> NotificationSupport.enqueueReminderSound(MainActivity.this, soundId));
        }

        @JavascriptInterface
        public void installApk(String apkUrl) {
            runOnUiThread(() -> startApkDownload(apkUrl));
        }
    }

    private void startApkDownload(String apkUrl) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getPackageManager().canRequestPackageInstalls()) {
            Intent permissionIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName()));
            startActivity(permissionIntent);
            Toast.makeText(this, "允许今刻安装更新后，请返回再点击一次更新", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            Uri uri = Uri.parse(apkUrl);
            String fileName = uri.getLastPathSegment();
            if (fileName == null || !fileName.toLowerCase(Locale.ROOT).endsWith(".apk")) {
                fileName = "jinke-latest.apk";
            }
            fileName = fileName.replaceAll("[^A-Za-z0-9._-]", "-");
            DownloadManager.Request request = new DownloadManager.Request(uri)
                    .setTitle("今刻版本更新")
                    .setDescription("下载完成后可安装最新版")
                    .setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(false);
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            long downloadId = manager.enqueue(request);
            getSharedPreferences(UpdateDownloadReceiver.PREFS, MODE_PRIVATE)
                    .edit()
                    .putLong(UpdateDownloadReceiver.KEY_DOWNLOAD_ID, downloadId)
                    .putInt(UpdateDownloadReceiver.KEY_SOURCE_VERSION_CODE, BuildConfig.VERSION_CODE)
                    .apply();
            Toast.makeText(this, "正在下载更新", Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            Toast.makeText(this, "更新下载失败，请稍后重试", Toast.LENGTH_LONG).show();
        }
    }

    private void cleanupInstalledUpdateApk() {
        android.content.SharedPreferences prefs = getSharedPreferences(UpdateDownloadReceiver.PREFS, MODE_PRIVATE);
        long downloadId = prefs.getLong(UpdateDownloadReceiver.KEY_DOWNLOAD_ID, -1L);
        int sourceVersionCode = prefs.getInt(UpdateDownloadReceiver.KEY_SOURCE_VERSION_CODE, BuildConfig.VERSION_CODE);
        if (downloadId < 0 || BuildConfig.VERSION_CODE <= sourceVersionCode) return;
        try {
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            manager.remove(downloadId);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) notificationManager.cancel(5200);
        } catch (Exception ignored) {
            // The package may already have been removed by the system or the user.
        }
        prefs.edit()
                .remove(UpdateDownloadReceiver.KEY_DOWNLOAD_ID)
                .remove(UpdateDownloadReceiver.KEY_SOURCE_VERSION_CODE)
                .apply();
    }
}
