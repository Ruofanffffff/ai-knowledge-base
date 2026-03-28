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

      const partialHandle = await CapacitorSpeechRecognition.addListener('partialResults', (data: any) => {
        const text = String(data?.matches?.[0] || '').trim();
        if (text) callbacks.onPartial?.(text);
      });

      const stateHandle = await CapacitorSpeechRecognition.addListener('listeningState', (data: any) => {
        const status = String(data?.status || '');
        callbacks.onListeningChange?.(status === 'started');
      });

      try {
        await CapacitorSpeechRecognition.start({
          language: options.language || 'zh-CN',
          maxResults: 3,
          partialResults: true,
          popup: false,
        } as any);
      } catch (e) {
        await partialHandle.remove();
        await stateHandle.remove();
        callbacks.onListeningChange?.(false);
        callbacks.onError?.(String((e as any)?.message || e || '语音识别启动失败'));
        return { stop: async () => {}, started: false };
      }

      const stop = async () => {
        callbacks.onListeningChange?.(false);
        try {
          await CapacitorSpeechRecognition.stop();
        } catch {}
        await new Promise((r) => setTimeout(r, 1200));
        try {
          await partialHandle.remove();
        } catch {}
        try {
          await stateHandle.remove();
        } catch {}
        try {
          await CapacitorSpeechRecognition.removeAllListeners();
        } catch {}
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
