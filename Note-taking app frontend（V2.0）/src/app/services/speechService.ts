import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capacitor-community/speech-recognition';

export type SpeechProvider = 'native' | 'web' | 'none';

export type SpeechPermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';

export type SpeechAvailability = {
  provider: SpeechProvider;
  available: boolean;
};

export type SpeechListenCallbacks = {
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

type WebSpeechRecognition = SpeechRecognition & {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionErrorEvent = Event & { error?: string; message?: string };

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

export class SpeechService {
  static getProvider(): SpeechProvider {
    if (Capacitor.isNativePlatform()) return 'native';
    if (getWebSpeechCtor()) return 'web';
    return 'none';
  }

  static async getAvailability(): Promise<SpeechAvailability> {
    const provider = SpeechService.getProvider();
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

      const { available } = await CapacitorSpeechRecognition.available();
      if (!available) {
        callbacks.onError?.('当前设备不支持语音识别');
        callbacks.onListeningChange?.(false);
        return { stop: async () => {}, started: false };
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

      const cleanup = async (reason: string) => {
        if (cleanedUp) return;
        cleanedUp = true;
        log('cleanup', reason);
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

      const errorHandle = await (CapacitorSpeechRecognition as any).addListener?.('error', (data: any) => {
        const msg = String(data?.message || data?.error || '语音识别失败');
        log('error', data);
        callbacks.onError?.(msg);
        callbacks.onListeningChange?.(false);
      });

      const stateHandle = await CapacitorSpeechRecognition.addListener('listeningState', (data: any) => {
        const status = String(data?.status || '');
        const listening = status === 'started';
        listeningFromEvents = listening;
        log('listeningState', status);
        callbacks.onListeningChange?.(listening);
        if (!listening) {
          // Android 端在 partialResults=true 时通常不会单独发 result 事件；以最后一次 partialResults 为 final。
          emitFinalIfNeeded('listeningState:stopped');
          cleanup('listeningState:stopped').catch(() => {});
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
            if (listeningFromEvents !== false && !userStopped) {
              log('poll detected stopped without event');
              callbacks.onListeningChange?.(false);
              // 如果完全没有识别到任何字，给一个更友好的提示（不打断用户手动停止的场景）
              if (!lastText && Date.now() - lastHeardAt > 1200) {
                callbacks.onError?.('未检测到语音');
              } else {
                emitFinalIfNeeded('poll:isListening=false');
              }
              cleanup('poll:isListening=false').catch(() => {});
            }
          }
        } catch (e) {
          // 忽略轮询错误（部分机型偶发），避免影响主流程
          log('poll error', e);
        }
      }, pollIntervalMs);

      const hardTimeout = setTimeout(async () => {
        if (cleanedUp) return;
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

      try {
        log('start', { language: options.language || 'zh-CN' });
        await CapacitorSpeechRecognition.start({
          language: options.language || 'zh-CN',
          maxResults: 1,
          partialResults: true,
          popup: false,
        } as any);
      } catch (e) {
        await cleanup('start threw');
        callbacks.onListeningChange?.(false);
        callbacks.onError?.(String((e as any)?.message || e || '语音识别启动失败'));
        return { stop: async () => {}, started: false };
      }

      const stop = async () => {
        if (cleanedUp) return;
        userStopped = true;
        callbacks.onListeningChange?.(false);
        try {
          await CapacitorSpeechRecognition.stop();
        } catch {}
        // 给 Android 最终结果/停止事件一个缓冲窗口
        await new Promise((r) => setTimeout(r, 900));
        emitFinalIfNeeded('stop()');
        await cleanup('stop()');
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
      recognition.onresult = (ev: SpeechRecognitionEvent) => {
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
