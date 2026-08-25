package com.junyingjun.jinke;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int REQUEST_SPEECH = 9021;
    private static final int REQUEST_NOTIFICATIONS = 9022;
    private static final int REQUEST_MICROPHONE = 9023;
    private WebView webView;
    private boolean openSpeechAfterPermission;

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
        requestNotificationPermissionIfNeeded();

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

        webView.setWebViewClient(new WebViewClient());
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
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
        }
    }

    private void openSpeechRecognizer() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.SIMPLIFIED_CHINESE.toLanguageTag());
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "告诉今刻要创建、修改、完成或删除什么");
        try {
            startActivityForResult(intent, REQUEST_SPEECH);
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "系统中没有可用的语音识别服务", Toast.LENGTH_LONG).show();
            deliverSpeechResult("");
        }
    }

    private void startSpeechRecognitionWithPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            openSpeechRecognizer();
            return;
        }
        openSpeechAfterPermission = true;
        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_MICROPHONE);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_MICROPHONE) return;
        boolean shouldOpenSpeech = openSpeechAfterPermission;
        openSpeechAfterPermission = false;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted && shouldOpenSpeech) {
            openSpeechRecognizer();
            return;
        }
        Toast.makeText(this, "需要麦克风权限才能使用语音助手", Toast.LENGTH_LONG).show();
        deliverSpeechResult("");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_SPEECH) return;
        String result = "";
        if (resultCode == RESULT_OK && data != null) {
            ArrayList<String> values = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (values != null && !values.isEmpty()) result = values.get(0);
        }
        deliverSpeechResult(result);
    }

    private void deliverSpeechResult(String result) {
        if (webView == null) return;
        String script = "window.JINKE_NATIVE_SPEECH_RESULT && window.JINKE_NATIVE_SPEECH_RESULT("
                + JSONObject.quote(result) + ");";
        webView.evaluateJavascript(script, null);
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

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (webView != null) webView.post(this::deliverWindowLayout);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.post(this::deliverWindowLayout);
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
        public void startSpeechRecognition() {
            runOnUiThread(MainActivity.this::startSpeechRecognitionWithPermission);
        }

        @JavascriptInterface
        public void syncDdlReminders(String tasksJson, String time, int multiple, int finalDays) {
            DdlScheduler.saveAndSchedule(MainActivity.this, tasksJson, time, multiple, finalDays);
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
                    .edit().putLong(UpdateDownloadReceiver.KEY_DOWNLOAD_ID, downloadId).apply();
            Toast.makeText(this, "正在下载更新", Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            Toast.makeText(this, "更新下载失败，请稍后重试", Toast.LENGTH_LONG).show();
        }
    }
}
