import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capacitor-community/speech-recognition';
import { AudioRecord, type AudioChunkEvent } from './audioRecordService';
import { API_BASE_URL, api } from './api';

export type SpeechProvider = 'native' | 'web' | 'cloud_streaming' | 'none';

export type SpeechPermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';

export type SpeechAvailability = {
  provider: SpeechProvider;
  available: boolean;
};

export type SpeechListenCallbacks = {
  onProvider?: (provider: SpeechProvider) => void;
  onChunk?: (seq: number) => void;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onListeningChange?: (listening: boolean) => void;
};

export type SpeechListenOptions = {
  language?: string;
  /**
   * 兜底超时：避免 Android 端在“无语音输入/超时”等错误场景下不回调导致 UI 一直处于聆听状态。
   * 单位：ms
   */
  maxDurationMs?: number;
};

type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((ev: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionErrorEvent = Event & { error?: string; message?: string };
type WebSpeechRecognitionEvent = { resultIndex: number; results: any[] };

function getWebSpeechCtor(): (new () => WebSpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as any;
}

function normalizePermissionState(value: any): SpeechPermissionState {
  if (value === 'granted' || value === 'denied' || value === 'prompt' || value === 'prompt-with-rationale') return value;
  return 'unknown';
}

function mapWebSpeechError(err?: string): string {
  const e = String(err || '');
  if (!e) return '语音识别失败，请重试';
  if (e === 'not-allowed' || e === 'service-not-allowed') return '未获得麦克风权限';
  if (e === 'audio-capture') return '无法访问麦克风';
  if (e === 'no-speech') return '未检测到语音';
  if (e === 'network') return '网络异常导致语音识别失败';
  if (e === 'aborted') return '语音识别已取消';
  return `语音识别失败：${e}`;
}

function readPreferredProvider(): SpeechProvider | null {
  const envPreferred = String((import.meta as any)?.env?.VITE_STT_PROVIDER || '').trim();
  const fromEnv = envPreferred === 'cloud_streaming' ? 'cloud_streaming' : envPreferred === 'native' ? 'native' : envPreferred === 'web' ? 'web' : null;
  if (fromEnv) return fromEnv;

  try {
    const qs = new URLSearchParams(window.location.search);
    const q = String(qs.get('sttProvider') || qs.get('stt') || '').trim();
    const fromQuery = q === 'cloud' || q === 'cloud_streaming' ? 'cloud_streaming' : q === 'native' ? 'native' : q === 'web' ? 'web' : null;
    if (fromQuery) return fromQuery;
  } catch {}

  try {
    const v = String(localStorage.getItem('stt_provider') || '').trim();
    const fromStorage = v === 'cloud' || v === 'cloud_streaming' ? 'cloud_streaming' : v === 'native' ? 'native' : v === 'web' ? 'web' : null;
    if (fromStorage) return fromStorage;
  } catch {}

  return null;
}

export class SpeechService {
  static getProvider(): SpeechProvider {
    // 1. 先检查用户偏好设置
    const preferred = readPreferredProvider();
    if (preferred) return preferred;

    // 2. HarmonyOS 检测：强制使用云流式识别（HarmonyOS 不完全兼容 Android SpeechRecognizer）
    if (Capacitor.isNativePlatform()) {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      if (ua.includes('HarmonyOS') || ua.includes('HUAWEI')) {
        console.log('[SpeechService] HarmonyOS detected, using cloud_streaming');
        return 'cloud_streaming';
      }
    }

    // 3. Native 平台优先使用本地识别
    if (Capacitor.isNativePlatform()) return 'native';

    // 4. Web 平台检测
    const webCtor = typeof window !== 'undefined' &&
      (window.SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (webCtor) return 'web';

    return 'none';
  }

  static async getAvailability(): Promise<SpeechAvailability> {
    const provider = SpeechService.getProvider();
    if (provider === 'cloud_streaming') {
      return { provider, available: Capacitor.isNativePlatform() };
    }
    if (provider === 'native') {
      try {
        const { available } = await CapacitorSpeechRecognition.available();
        return { provider, available: Boolean(available) };
      } catch {
        return { provider, available: false };
      }
    }
    if (provider === 'web') return { provider, available: true };
    return { provider, available: false };
  }

  static async checkPermissions(): Promise<SpeechPermissionState> {
    if (SpeechService.getProvider() !== 'native') return 'unknown';
    try {
      const res = await CapacitorSpeechRecognition.checkPermissions();
      return normalizePermissionState((res as any)?.speechRecognition);
    } catch {
      return 'unknown';
    }
  }

  static async requestPermissions(): Promise<SpeechPermissionState> {
    if (SpeechService.getProvider() !== 'native') return 'unknown';
    try {
      const res = await CapacitorSpeechRecognition.requestPermissions();
      return normalizePermissionState((res as any)?.speechRecognition);
    } catch {
      return 'unknown';
    }
  }

  static async startListening(
    options: SpeechListenOptions,
    callbacks: SpeechListenCallbacks
  ): Promise<{ stop: () => Promise<void>; started: boolean }> {
    const provider = SpeechService.getProvider();
    callbacks.onProvider?.(provider);
    if (provider === 'cloud_streaming') {
      const DEBUG = Boolean((import.meta as any)?.env?.DEV);
      const log = (...args: any[]) => {
        if (!DEBUG) return;
        console.debug('[SpeechService:cloud_streaming]', ...args);
      };

      let cleanedUp = false;
      let stopping = false;
      let userStopped = false;
      let lastPartial = '';
      let lastFinal = '';
      let lastHeardAt = 0;
      let lastChunkAt = 0;
      let sawAnyText = false;

      const abortController = new AbortController();
      const queue: Array<{ seq: number; chunk: AudioChunkEvent }> = [];
      const pendingResults = new Map<number, { partial?: string; final?: string; text?: string }>();
      let nextSeq = 0;
      let nextEmitSeq = 1;
      let inFlight = 0;
      let listenerHandle: any = null;
      let sttToken = '';
      let hardTimeout: any = null;
      let noSpeechTimer: any = null;

      const language = options.language || 'zh-CN';
      const maxInFlight = 2;
      const hardTimeoutMs = Math.max(3000, options.maxDurationMs ?? 15000);

      const flushPendingResults = () => {
        while (pendingResults.has(nextEmitSeq)) {
          const r = pendingResults.get(nextEmitSeq)!;
          pendingResults.delete(nextEmitSeq);
          nextEmitSeq += 1;

          const partial = typeof r.partial === 'string' ? r.partial.trim() : '';
          const final = typeof r.final === 'string' ? r.final.trim() : '';
          const text = typeof r.text === 'string' ? r.text.trim() : '';

          const now = Date.now();
          lastHeardAt = now;
          if (partial) {
            sawAnyText = true;
            lastPartial = partial;
            callbacks.onPartial?.(partial);
          }

          const finalLike = final || text;
          if (finalLike) {
            sawAnyText = true;
            lastFinal = finalLike;
            lastPartial = '';
            callbacks.onFinal?.(finalLike);
          }
        }
      };

      const toErrMsg = (err: unknown): string => {
        const raw = err instanceof Error ? err.message : String(err || '');
        const s = raw.trim();
        if (!s) return '语音识别失败，请重试';
        if (s.toLowerCase().includes('aborted')) return '语音识别已取消';
        if (s.toLowerCase().includes('network')) return '网络异常导致语音识别失败';
        return s;
      };

      const cleanup = async () => {
        if (cleanedUp) return;
        cleanedUp = true;
        try {
          clearTimeout(hardTimeout);
          clearTimeout(noSpeechTimer);
        } catch {}
        try {
          await listenerHandle?.remove?.();
        } catch {}
        listenerHandle = null;
        try {
          await AudioRecord.stop();
        } catch {}
        try {
          await AudioRecord.removeAllListeners();
        } catch {}
        try {
          abortController.abort();
        } catch {}
      };

      const waitDrain = async (ms: number) => {
        const start = Date.now();
        while (!cleanedUp && Date.now() - start < ms) {
          if (inFlight === 0 && queue.length === 0) return;
          await new Promise((r) => setTimeout(r, 80));
        }
      };

      const stopInternal = async (reason: string) => {
        if (stopping || cleanedUp) return;
        stopping = true;
        log('stop', reason);
        callbacks.onListeningChange?.(false);
        try {
          await AudioRecord.stop();
        } catch {}
        await waitDrain(1800);
        flushPendingResults();
        if (lastPartial && (!lastFinal || lastFinal !== lastPartial)) {
          callbacks.onFinal?.(lastPartial);
          lastFinal = lastPartial;
          lastPartial = '';
        }
        if (!sawAnyText && Date.now() - Math.max(lastHeardAt, lastChunkAt) > 1200) {
          callbacks.onError?.('未检测到语音');
        }
        await cleanup();
      };

      const failAndStop = async (err: unknown) => {
        if (userStopped || cleanedUp) return;
        callbacks.onError?.(toErrMsg(err));
        await stopInternal('error');
      };

      const sendChunk = async (seq: number, chunk: AudioChunkEvent) => {
        const resp = await fetch(`${API_BASE_URL}/stt/chunk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sttToken}`,
          },
          body: JSON.stringify({
            pcm16leBase64: chunk.base64,
            sampleRate: chunk.sampleRate,
            channels: chunk.channels,
            language,
          }),
          signal: abortController.signal,
        });

        const payloadText = await resp.text().catch(() => '');
        let payload: any = null;
        try {
          payload = payloadText ? JSON.parse(payloadText) : null;
        } catch {
          payload = null;
        }

        if (!resp.ok) {
          const msg = payload?.error || payload?.message || payloadText || `HTTP ${resp.status}`;
          throw new Error(String(msg || '请求失败'));
        }

        if (payload && payload.success === false) {
          throw new Error(String(payload?.error || payload?.message || '请求失败'));
        }

        const data = payload?.data ?? payload?.result ?? payload;
        const partial =
          typeof data?.partial === 'string'
            ? data.partial
            : typeof data?.partialText === 'string'
              ? data.partialText
              : undefined;
        const final =
          typeof data?.final === 'string'
            ? data.final
            : typeof data?.finalText === 'string'
              ? data.finalText
              : undefined;
        const text = typeof data?.text === 'string' ? data.text : undefined;

        pendingResults.set(seq, { partial, final, text });
        flushPendingResults();
      };

      const pump = () => {
        if (cleanedUp || stopping) return;
        while (inFlight < maxInFlight && queue.length > 0) {
          const item = queue.shift()!;
          inFlight += 1;
          sendChunk(item.seq, item.chunk)
            .catch((e) => failAndStop(e))
            .finally(() => {
              inFlight -= 1;
              pump();
            });
        }
      };

      const stop = async () => {
        userStopped = true;
        await stopInternal('user');
      };

      try {
        const tokenResp = await api.post('/stt/token', {});
        sttToken = String(tokenResp?.data?.data?.token || tokenResp?.data?.token || tokenResp?.data?.result?.token || '');
        if (!sttToken) {
          callbacks.onError?.('STT token 获取失败');
          callbacks.onListeningChange?.(false);
          return { stop: async () => {}, started: false };
        }

        listenerHandle = await AudioRecord.addListener('audioChunk', (ev) => {
          if (cleanedUp || stopping) return;
          const chunk = ev as AudioChunkEvent;
          lastChunkAt = Date.now();
          nextSeq += 1;
          callbacks.onChunk?.(nextSeq);
          queue.push({ seq: nextSeq, chunk });
          pump();
        });

        await AudioRecord.start({ sampleRate: 16000, chunkDurationMs: 800 });

        callbacks.onListeningChange?.(true);
        hardTimeout = setTimeout(() => {
          stopInternal('timeout').catch(() => {});
        }, hardTimeoutMs);

        noSpeechTimer = setTimeout(() => {
          if (cleanedUp || stopping) return;
          if (sawAnyText) return;
          if (Date.now() - lastChunkAt < 1200) return;
          stopInternal('no-speech').catch(() => {});
        }, 6000);

        return { stop, started: true };
      } catch (e) {
        await cleanup();
        callbacks.onListeningChange?.(false);
        callbacks.onError?.(toErrMsg(e));
        return { stop: async () => {}, started: false };
      }
    }
    if (provider === 'native') {
      const DEBUG = Boolean((import.meta as any)?.env?.DEV);
      const log = (...args: any[]) => {
        if (!DEBUG) return;
        // eslint-disable-next-line no-console
        console.debug('[SpeechService:native]', ...args);
      };

      const permission = await SpeechService.checkPermissions();
      if (permission !== 'granted') {
        const requested = await SpeechService.requestPermissions();
        if (requested !== 'granted') {
          callbacks.onError?.('未获得麦克风权限');
          callbacks.onListeningChange?.(false);
          return { stop: async () => {}, started: false };
        }
      }

      let nativeAvailable = false;
      try {
        const { available } = await CapacitorSpeechRecognition.available();
        nativeAvailable = Boolean(available);
      } catch (e) {
        console.warn('[SpeechService] Native speech available() check failed:', e);
        nativeAvailable = false;
      }
      if (!nativeAvailable) {
        // Fallback to cloud_streaming instead of failing outright
        console.warn('[SpeechService] Native speech not available, falling back to cloud_streaming');
        try {
          // 记住偏好，后续调用也直接走 cloud_streaming，避免重复检测失败
          localStorage.setItem('stt_provider', 'cloud_streaming');
        } catch {}
        callbacks.onProvider?.('cloud_streaming');
        return SpeechService.startListening(options, { ...callbacks, onProvider: undefined });
      }

      const pickText = (data: any): string => {
        const matches = data?.matches ?? data?.result?.matches ?? data?.data?.matches;
        if (Array.isArray(matches)) return String(matches[0] ?? '').trim();
        if (typeof matches === 'string') return matches.trim();
        const value = data?.value ?? data?.result ?? data?.data;
        if (typeof value === 'string') return value.trim();
        return '';
      };

      let lastText = '';
      let lastFinal = '';
      let cleanedUp = false;
      let userStopped = false;
      let lastHeardAt = 0;
      let listeningFromEvents: boolean | null = null;
      let stoppedAt = 0;
      let stopFinalizeTimer: any = null;
      let fallbackTimer: any = null;
      let fallbackActive = false;
      let switchingToFallback = false;

      const cleanup = async (reason: string) => {
        if (cleanedUp) return;
        cleanedUp = true;
        log('cleanup', reason);
        try {
          clearTimeout(stopFinalizeTimer);
        } catch {}
        try {
          clearTimeout(fallbackTimer);
        } catch {}
        try {
          clearInterval(pollTimer);
        } catch {}
        try {
          clearTimeout(hardTimeout);
        } catch {}
        try {
          await partialHandle.remove();
        } catch {}
        try {
          await stateHandle.remove();
        } catch {}
        try {
          if (resultHandle?.remove) await resultHandle.remove();
        } catch {}
        try {
          if (errorHandle?.remove) await errorHandle.remove();
        } catch {}
      };

      const emitFinalIfNeeded = (source: string) => {
        if (!lastText) return;
        if (lastFinal === lastText) return;
        lastFinal = lastText;
        log('final', source, lastFinal);
        callbacks.onFinal?.(lastFinal);
      };

      const scheduleFinalizeAfterStop = (source: string) => {
        if (cleanedUp) return;
        if (fallbackActive || switchingToFallback) return;
        if (stopFinalizeTimer) return;
        stoppedAt = stoppedAt || Date.now();
        stopFinalizeTimer = setTimeout(async () => {
          if (cleanedUp) return;
          if (fallbackActive || switchingToFallback) return;
          if (!lastText && Date.now() - lastHeardAt > 1200) callbacks.onError?.('未检测到语音');
          else emitFinalIfNeeded(source);
          await cleanup(`finalize:${source}`);
        }, 1300);
      };

      const partialHandle = await CapacitorSpeechRecognition.addListener('partialResults', (data: any) => {
        const text = pickText(data);
        if (!text) return;
        lastText = text;
        lastHeardAt = Date.now();
        log('partialResults', text);
        callbacks.onPartial?.(text);
      });

      /**
       * 注意：@capacitor-community/speech-recognition（v6.x）在 Android 且 partialResults=true 时，
       * 官方类型定义只保证会发出 partialResults/listeningState 事件，不保证会发出 result/error 事件。
       * 这里保留监听是为了兼容可能的自定义插件/未来版本；真正兜底依赖 listeningState + isListening 轮询 + 超时。
       */
      const resultHandle = await (CapacitorSpeechRecognition as any).addListener?.('result', (data: any) => {
        const text = pickText(data);
        if (!text) return;
        lastText = text;
        lastFinal = text;
        log('result', text);
        callbacks.onFinal?.(text);
      });



      const stateHandle = await CapacitorSpeechRecognition.addListener('listeningState', (data: any) => {
        const status = String(data?.status || '');
        const listening = status === 'started';
        listeningFromEvents = listening;
        log('listeningState', status);
        callbacks.onListeningChange?.(listening);
        if (!listening) {
          scheduleFinalizeAfterStop('listeningState:stopped');
        }
      });

      // Android 端在“无语音输入/超时”等错误场景下可能既不发 error，也不发 listeningState=stopped。
      // 通过 isListening 轮询 + 兜底超时把 UI 拉回到非聆听态，并尽可能提交最后一次识别文本。
      const pollIntervalMs = 800;
      const pollTimer = setInterval(async () => {
        if (cleanedUp) return;
        try {
          const res = await CapacitorSpeechRecognition.isListening();
          const nativeListening = Boolean((res as any)?.listening);
          if (!nativeListening) {
            // 如果事件流没有明确告诉我们“stopped”，也要兜底收尾，避免红色麦克风卡死。
            if (!fallbackActive && !switchingToFallback && listeningFromEvents !== false && !userStopped) {
              log('poll detected stopped without event');
              callbacks.onListeningChange?.(false);
              scheduleFinalizeAfterStop('poll:isListening=false');
            }
          }
        } catch (e) {
          // 忽略轮询错误（部分机型偶发），避免影响主流程
          log('poll error', e);
        }
      }, pollIntervalMs);

      const hardTimeout = setTimeout(async () => {
        if (cleanedUp) return;
        if (fallbackActive || switchingToFallback) return;
        userStopped = true; // 防止后续兜底再弹一次错误
        log('hard timeout reached, stopping');
        callbacks.onListeningChange?.(false);
        try {
          await CapacitorSpeechRecognition.stop();
        } catch {}
        if (!lastText) callbacks.onError?.('语音识别超时');
        else emitFinalIfNeeded('timeout');
        await cleanup('timeout');
      }, Math.max(3000, options.maxDurationMs ?? 15000));

      const triggerFallback = async () => {
        if (cleanedUp) return;
        if (userStopped) return;
        
        log('triggering fallback popup mode');
        switchingToFallback = true;
        
        try {
          await CapacitorSpeechRecognition.stop();
        } catch {}
        switchingToFallback = false;
        fallbackActive = true;

        clearInterval(pollTimer);
        clearTimeout(hardTimeout);
        clearTimeout(fallbackTimer);

        callbacks.onListeningChange?.(true);
        try {
          const startPopup = CapacitorSpeechRecognition.start({
            language: options.language || 'zh-CN',
            maxResults: 1,
            partialResults: false,
            popup: true,
          } as any);
          const res = await Promise.race([
            startPopup,
            new Promise((_, reject) => setTimeout(() => reject(new Error('popup timeout')), 12000)),
          ]) as any;
          const text = pickText(res);
          if (text) {
            lastText = text;
            callbacks.onFinal?.(text);
          } else {
            callbacks.onError?.('未检测到语音');
          }
        } catch (e) {
          const msg = String((e as any)?.message || e || '语音识别失败');
          callbacks.onError?.(msg === 'popup timeout' ? '系统语音服务不可用或未返回结果' : msg);
        } finally {
          callbacks.onListeningChange?.(false);
          fallbackActive = false;
          await cleanup('fallback done');
        }
      };

      fallbackTimer = setTimeout(async () => {
        if (lastHeardAt > 0) return;
        log('fallback: no speech detected within 0.8s');
        await triggerFallback();
      }, 800);

      const errorHandle = await (CapacitorSpeechRecognition as any).addListener?.('error', async (data: any) => {
        const msg = String(data?.message || data?.error || '语音识别失败');
        log('error', data);
        if (!fallbackActive && !switchingToFallback && !cleanedUp && !userStopped) {
          log('error received, triggering fallback immediately');
          await triggerFallback();
        } else {
          callbacks.onError?.(msg);
          callbacks.onListeningChange?.(false);
        }
      });

      log('start', { language: options.language || 'zh-CN' });
      const startSilent = CapacitorSpeechRecognition.start({
        language: options.language || 'zh-CN',
        maxResults: 1,
        partialResults: true,
        popup: false,
      } as any);

      startSilent
        .catch(async (e) => {
          if (cleanedUp) return;
          if (fallbackActive || switchingToFallback) return;
          callbacks.onListeningChange?.(false);
          callbacks.onError?.(String((e as any)?.message || e || '语音识别启动失败'));
          await cleanup('start rejected');
        })
        .then(() => {
          if (cleanedUp) return;
          if (fallbackActive || switchingToFallback) return;
          callbacks.onListeningChange?.(true);
        });

      // 防止某些设备/系统上 native start Promise 卡住，导致 UI 无法停止、兜底不执行
      await Promise.race([startSilent, new Promise((resolve) => setTimeout(resolve, 1200))]);

      const stop = async () => {
        if (cleanedUp) return;
        userStopped = true;
        
        if (fallbackActive || switchingToFallback) {
          callbacks.onListeningChange?.(false);
          try {
            await CapacitorSpeechRecognition.stop();
          } catch {}
          fallbackActive = false;
          switchingToFallback = false;
          await cleanup('stop:fallback');
          return;
        }

        callbacks.onListeningChange?.(false);
        try {
          await CapacitorSpeechRecognition.stop();
        } catch {}
        
        // 给 Android 最终结果/停止事件一个缓冲窗口
        await new Promise((r) => setTimeout(r, 800));
        
        if (!cleanedUp) {
          if (!lastText && Date.now() - lastHeardAt > 1200) callbacks.onError?.('未检测到语音');
          else emitFinalIfNeeded('stop()');
          await cleanup('stop()');
        }
        
        try {
          const res = await CapacitorSpeechRecognition.isListening();
          if ((res as any)?.listening) {
            try {
              await CapacitorSpeechRecognition.stop();
            } catch {}
          }
        } catch {}
      };

      return { stop, started: true };
    }

    if (provider === 'web') {
      const Ctor = getWebSpeechCtor();
      if (!Ctor) {
        callbacks.onError?.('当前环境不支持语音识别');
        callbacks.onListeningChange?.(false);
        return { stop: async () => {}, started: false };
      }

      const recognition = new Ctor();
      recognition.lang = options.language || 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      let stopped = false;
      let lastFinal = '';

      recognition.onstart = () => callbacks.onListeningChange?.(true);
      recognition.onend = () => {
        callbacks.onListeningChange?.(false);
        if (lastFinal.trim()) callbacks.onFinal?.(lastFinal.trim());
      };
      recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
        callbacks.onListeningChange?.(false);
        callbacks.onError?.(mapWebSpeechError((ev as any)?.error));
      };
      recognition.onresult = (ev: WebSpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
          const r = ev.results[i];
          const t = String(r?.[0]?.transcript || '');
          if (r.isFinal) final += t;
          else interim += t;
        }
        const interimText = interim.trim();
        const finalText = final.trim();
        if (interimText) callbacks.onPartial?.(interimText);
        if (finalText) {
          lastFinal = finalText;
          callbacks.onFinal?.(finalText);
        }
      };

      try {
        recognition.start();
      } catch (e) {
        callbacks.onListeningChange?.(false);
        callbacks.onError?.(String((e as any)?.message || e || '语音识别启动失败'));
        return { stop: async () => {}, started: false };
      }

      const stop = async () => {
        if (stopped) return;
        stopped = true;
        try {
          recognition.stop();
        } catch {}
        callbacks.onListeningChange?.(false);
      };

      return { stop, started: true };
    }

    callbacks.onError?.('当前环境不支持语音识别');
    callbacks.onListeningChange?.(false);
    return { stop: async () => {}, started: false };
  }
}
