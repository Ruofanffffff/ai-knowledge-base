import * as React from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export interface CapacitorKeyboardMetrics {
  available: boolean;
  visible: boolean;
  height: number;
}

export function useCapacitorKeyboardMetrics(): CapacitorKeyboardMetrics {
  const available = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  const [metrics, setMetrics] = React.useState<CapacitorKeyboardMetrics>({
    available,
    visible: false,
    height: 0,
  });

  React.useEffect(() => {
    if (!available) return;

    let willShow: Promise<PluginListenerHandle> | undefined;
    let didShow: Promise<PluginListenerHandle> | undefined;
    let willHide: Promise<PluginListenerHandle> | undefined;
    let didHide: Promise<PluginListenerHandle> | undefined;
    let cancelled = false;

    const onShow = (keyboardHeight?: number) => {
      if (cancelled) return;
      const height = typeof keyboardHeight === 'number' && Number.isFinite(keyboardHeight) ? Math.max(0, keyboardHeight) : 0;
      setMetrics({ available: true, visible: true, height });
    };

    const onHide = () => {
      if (cancelled) return;
      setMetrics({ available: true, visible: false, height: 0 });
    };

    try {
      willShow = Keyboard.addListener('keyboardWillShow', (e: { keyboardHeight: number }) => onShow(e?.keyboardHeight));
      didShow = Keyboard.addListener('keyboardDidShow', (e: { keyboardHeight: number }) => onShow(e?.keyboardHeight));
      willHide = Keyboard.addListener('keyboardWillHide', onHide);
      didHide = Keyboard.addListener('keyboardDidHide', onHide);
    } catch {
      setMetrics({ available: true, visible: false, height: 0 });
    }

    return () => {
      cancelled = true;
      void willShow?.then(h => h.remove()).catch(() => {});
      void didShow?.then(h => h.remove()).catch(() => {});
      void willHide?.then(h => h.remove()).catch(() => {});
      void didHide?.then(h => h.remove()).catch(() => {});
    };
  }, [available]);

  return metrics;
}
