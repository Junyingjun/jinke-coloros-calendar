package com.junyingjun.jinke;

import android.content.Context;
import android.content.res.AssetManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class OfflineSpeechEngine implements RecognitionListener {
    private static final String LOG_TAG = "JinkeSpeech";
    static final String MODEL_ASSET_DIR = "vosk-model-small-cn-0.22";
    private static final float SAMPLE_RATE = 16000.0f;
    private static final int LISTEN_TIMEOUT_MS = 30000;

    interface Callback {
        void onStatus(String status);
        void onPartial(String text);
        void onFinal(String text);
        void onError(String message);
    }

    private final Context context;
    private final Callback callback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private Model model;
    private Recognizer recognizer;
    private SpeechService speechService;
    private boolean loading;
    private boolean startAfterLoading;
    private boolean resultDelivered;
    private boolean closed;
    private String committedText = "";
    private String latestText = "";

    OfflineSpeechEngine(Context context, Callback callback) {
        this.context = context.getApplicationContext();
        this.callback = callback;
    }

    synchronized boolean isReady() {
        return model != null;
    }

    synchronized void start() {
        if (closed) return;
        if (model != null) {
            mainHandler.post(this::startListening);
            return;
        }
        startAfterLoading = true;
        if (loading) return;
        loading = true;
        Log.i(LOG_TAG, "Preparing bundled Chinese model");
        callback.onStatus("preparing-model");
        executor.execute(() -> {
            try {
                File modelDirectory = prepareModelFiles();
                Model loadedModel = new Model(modelDirectory.getAbsolutePath());
                synchronized (OfflineSpeechEngine.this) {
                    if (closed) {
                        loadedModel.close();
                        return;
                    }
                    model = loadedModel;
                    loading = false;
                    Log.i(LOG_TAG, "Bundled Chinese model loaded");
                }
                mainHandler.post(() -> {
                    callback.onStatus("model-ready");
                    boolean shouldStart;
                    synchronized (OfflineSpeechEngine.this) {
                        shouldStart = startAfterLoading;
                        startAfterLoading = false;
                    }
                    if (shouldStart) startListening();
                });
            } catch (Exception error) {
                synchronized (OfflineSpeechEngine.this) {
                    loading = false;
                    startAfterLoading = false;
                }
                mainHandler.post(() -> callback.onError("离线中文模型加载失败：" + safeMessage(error)));
            }
        });
    }

    synchronized void stop() {
        startAfterLoading = false;
        if (speechService == null) {
            if (loading) callback.onFinal("");
            return;
        }
        finish(latestText);
    }

    private synchronized void startListening() {
        if (closed || model == null || speechService != null) return;
        committedText = "";
        latestText = "";
        resultDelivered = false;
        try {
            recognizer = new Recognizer(model, SAMPLE_RATE);
            speechService = new SpeechService(recognizer, SAMPLE_RATE);
            speechService.startListening(this, LISTEN_TIMEOUT_MS);
            Log.i(LOG_TAG, "Offline microphone recognition started");
            callback.onStatus("listening");
        } catch (Exception error) {
            cleanupSession();
            callback.onError("麦克风启动失败：" + safeMessage(error));
        }
    }

    @Override
    public void onPartialResult(String hypothesis) {
        String text = jsonText(hypothesis, "partial");
        if (text.isEmpty()) return;
        latestText = previewText(committedText, text);
        callback.onPartial(latestText);
    }

    @Override
    public void onResult(String hypothesis) {
        String text = jsonText(hypothesis, "text");
        if (text.isEmpty()) return;
        committedText = appendSegment(committedText, text);
        latestText = committedText;
        callback.onPartial(committedText);
    }

    @Override
    public void onFinalResult(String hypothesis) {
        String text = jsonText(hypothesis, "text");
        finish(text.isEmpty() ? latestText : appendSegment(committedText, text));
    }

    @Override
    public void onError(Exception error) {
        if (resultDelivered) return;
        if (!latestText.isBlank()) {
            Log.w(LOG_TAG, "Recognition ended after recoverable audio error; preserving transcript", error);
            finish(latestText);
            return;
        }
        resultDelivered = true;
        cleanupSession();
        callback.onError("离线识别失败：" + safeMessage(error));
    }

    @Override
    public void onTimeout() {
        finish(latestText);
    }

    private synchronized void finish(String text) {
        if (resultDelivered) return;
        resultDelivered = true;
        cleanupSession();
        callback.onFinal(text == null ? "" : text.trim());
        Log.i(LOG_TAG, "Offline microphone recognition finished");
    }

    private String previewText(String committed, String partial) {
        if (committed == null || committed.isBlank()) return partial.trim();
        if (partial == null || partial.isBlank()) return committed.trim();
        String base = committed.trim();
        String next = partial.trim();
        if (next.startsWith(base)) return next;
        if (base.endsWith(next)) return base;
        return base + "，" + next;
    }

    private String appendSegment(String committed, String segment) {
        if (segment == null || segment.isBlank()) return committed == null ? "" : committed.trim();
        if (committed == null || committed.isBlank()) return segment.trim();
        String base = committed.trim();
        String next = segment.trim();
        if (next.startsWith(base)) return next;
        if (base.endsWith(next) || base.equals(next)) return base;
        return base + "，" + next;
    }

    private void cleanupSession() {
        SpeechService activeService = speechService;
        speechService = null;
        if (activeService != null) {
            try { activeService.stop(); } catch (Exception ignored) {}
            try { activeService.shutdown(); } catch (Exception ignored) {}
        }
        Recognizer activeRecognizer = recognizer;
        recognizer = null;
        if (activeRecognizer != null) {
            try { activeRecognizer.close(); } catch (Exception ignored) {}
        }
    }

    synchronized void close() {
        if (closed) return;
        closed = true;
        startAfterLoading = false;
        cleanupSession();
        if (model != null) {
            try { model.close(); } catch (Exception ignored) {}
            model = null;
        }
        executor.shutdownNow();
    }

    private File prepareModelFiles() throws IOException {
        File modelDirectory = new File(context.getFilesDir(), MODEL_ASSET_DIR);
        if (isCompleteModel(modelDirectory)) {
            Log.i(LOG_TAG, "Using extracted Chinese model");
            return modelDirectory;
        }
        File staging = new File(context.getFilesDir(), MODEL_ASSET_DIR + ".staging");
        deleteRecursively(staging);
        if (!staging.mkdirs() && !staging.isDirectory()) {
            throw new IOException("无法创建模型目录");
        }
        copyAssetTree(context.getAssets(), MODEL_ASSET_DIR, staging);
        if (!isCompleteModel(staging)) {
            deleteRecursively(staging);
            throw new IOException("APK 中的中文模型不完整");
        }
        deleteRecursively(modelDirectory);
        if (!staging.renameTo(modelDirectory)) {
            throw new IOException("无法启用离线中文模型");
        }
        Log.i(LOG_TAG, "Bundled Chinese model extracted");
        return modelDirectory;
    }

    private boolean isCompleteModel(File directory) {
        return new File(directory, "am/final.mdl").isFile()
                && new File(directory, "conf/model.conf").isFile()
                && new File(directory, "graph/Gr.fst").isFile()
                && new File(directory, "graph/HCLr.fst").isFile();
    }

    private void copyAssetTree(AssetManager assets, String assetPath, File destination) throws IOException {
        String[] children = assets.list(assetPath);
        if (children != null && children.length > 0) {
            if (!destination.exists() && !destination.mkdirs()) {
                throw new IOException("无法创建 " + destination.getName());
            }
            for (String child : children) {
                copyAssetTree(assets, assetPath + "/" + child, new File(destination, child));
            }
            return;
        }
        File parent = destination.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("无法创建 " + parent.getName());
        }
        try (InputStream input = assets.open(assetPath);
             FileOutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        }
    }

    private void deleteRecursively(File target) {
        if (target == null || !target.exists()) return;
        File[] children = target.listFiles();
        if (children != null) for (File child : children) deleteRecursively(child);
        if (!target.delete() && target.exists()) target.deleteOnExit();
    }

    private String jsonText(String payload, String key) {
        try {
            return new JSONObject(payload).optString(key, "").trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    private static String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.isBlank() ? error.getClass().getSimpleName() : message;
    }
}
