package com.shisi.app.v2.plugins;

import android.Manifest;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Process;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
    name = "AudioRecord",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = AudioRecordPlugin.MICROPHONE) }
)
public class AudioRecordPlugin extends Plugin {

    static final String MICROPHONE = "microphone";
    private static final String AUDIO_CHUNK_EVENT = "audioChunk";

    private static final int DEFAULT_SAMPLE_RATE = 16000;
    private static final int DEFAULT_CHUNK_DURATION_MS = 800;
    private static final int BYTES_PER_SAMPLE = 2;
    private static final int CHANNEL_COUNT = 1;

    private final Object lock = new Object();
    private final AtomicBoolean running = new AtomicBoolean(false);

    private AudioRecord audioRecord;
    private Thread recordThread;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            requestPermissionForAlias(MICROPHONE, call, "microphonePermissionCallback");
            return;
        }
        startInternal(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopInternal();
        call.resolve();
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            call.reject("未获得录音权限");
            return;
        }
        startInternal(call);
    }

    @Override
    protected void handleOnDestroy() {
        stopInternal();
        super.handleOnDestroy();
    }

    private void startInternal(PluginCall call) {
        synchronized (lock) {
            if (running.get()) {
                call.resolve();
                return;
            }

            int sampleRate = call.getInt("sampleRate", DEFAULT_SAMPLE_RATE);
            int chunkDurationMs = call.getInt("chunkDurationMs", DEFAULT_CHUNK_DURATION_MS);
            final int finalChunkDurationMs = chunkDurationMs > 0 ? chunkDurationMs : DEFAULT_CHUNK_DURATION_MS;
            final int finalSampleRate = sampleRate > 0 ? sampleRate : DEFAULT_SAMPLE_RATE;

            int channelConfig = AudioFormat.CHANNEL_IN_MONO;
            int audioFormat = AudioFormat.ENCODING_PCM_16BIT;
            int minBufferSize = AudioRecord.getMinBufferSize(finalSampleRate, channelConfig, audioFormat);
            if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
                call.reject("AudioRecord.getMinBufferSize 失败");
                return;
            }

            int chunkBytes = (int) Math.round(finalSampleRate * (finalChunkDurationMs / 1000.0) * BYTES_PER_SAMPLE * CHANNEL_COUNT);
            int bufferSize = Math.max(minBufferSize * 2, chunkBytes);

            try {
                audioRecord =
                    new AudioRecord(MediaRecorder.AudioSource.MIC, finalSampleRate, channelConfig, audioFormat, bufferSize);
            } catch (Exception e) {
                audioRecord = null;
                call.reject("创建 AudioRecord 失败: " + e.getMessage());
                return;
            }

            if (audioRecord == null || audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                releaseAudioRecord();
                call.reject("AudioRecord 未初始化");
                return;
            }

            try {
                audioRecord.startRecording();
            } catch (Exception e) {
                releaseAudioRecord();
                call.reject("启动录音失败: " + e.getMessage());
                return;
            }

            if (audioRecord.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                releaseAudioRecord();
                call.reject("录音未进入 RECORDSTATE_RECORDING");
                return;
            }

            running.set(true);
            recordThread =
                new Thread(
                    () -> runRecordLoop(finalSampleRate, finalChunkDurationMs, minBufferSize),
                    "cap-audiorecord-16k-pcm"
                );
            recordThread.start();

            JSObject ret = new JSObject();
            ret.put("sampleRate", finalSampleRate);
            ret.put("chunkDurationMs", finalChunkDurationMs);
            ret.put("encoding", "pcm16le");
            ret.put("channels", CHANNEL_COUNT);
            call.resolve(ret);
        }
    }

    private void runRecordLoop(int sampleRate, int chunkDurationMs, int minBufferSize) {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);

        int chunkBytes = (int) Math.round(sampleRate * (chunkDurationMs / 1000.0) * BYTES_PER_SAMPLE * CHANNEL_COUNT);
        byte[] readBuffer = new byte[Math.max(2048, minBufferSize)];
        byte[] chunkBuffer = new byte[chunkBytes];
        int chunkOffset = 0;

        while (running.get() && !Thread.currentThread().isInterrupted()) {
            AudioRecord ar;
            synchronized (lock) {
                ar = audioRecord;
            }
            if (ar == null) break;

            int read;
            try {
                read = ar.read(readBuffer, 0, readBuffer.length);
            } catch (Exception e) {
                break;
            }

            if (read <= 0) {
                if (!running.get()) break;
                continue;
            }

            int srcOffset = 0;
            while (srcOffset < read && running.get()) {
                int toCopy = Math.min(chunkBytes - chunkOffset, read - srcOffset);
                System.arraycopy(readBuffer, srcOffset, chunkBuffer, chunkOffset, toCopy);
                chunkOffset += toCopy;
                srcOffset += toCopy;

                if (chunkOffset == chunkBytes) {
                    String b64 = Base64.encodeToString(chunkBuffer, Base64.NO_WRAP);
                    JSObject payload = new JSObject();
                    payload.put("base64", b64);
                    payload.put("bytes", chunkBytes);
                    payload.put("sampleRate", sampleRate);
                    payload.put("chunkDurationMs", chunkDurationMs);
                    payload.put("encoding", "pcm16le");
                    payload.put("channels", CHANNEL_COUNT);
                    payload.put("timestampMs", System.currentTimeMillis());
                    bridge.getWebView().post(() -> notifyListeners(AUDIO_CHUNK_EVENT, payload));
                    chunkOffset = 0;
                }
            }
        }
    }

    private void stopInternal() {
        Thread t;
        synchronized (lock) {
            if (!running.get()) {
                releaseAudioRecord();
                return;
            }
            running.set(false);
            t = recordThread;
            recordThread = null;

            if (audioRecord != null) {
                try {
                    audioRecord.stop();
                } catch (Exception ignored) {}
                try {
                    audioRecord.release();
                } catch (Exception ignored) {}
                audioRecord = null;
            }
        }

        if (t != null) {
            try {
                t.interrupt();
                t.join(1500);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private void releaseAudioRecord() {
        if (audioRecord != null) {
            try {
                audioRecord.release();
            } catch (Exception ignored) {}
            audioRecord = null;
        }
    }
}
