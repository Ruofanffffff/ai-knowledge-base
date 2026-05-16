import { useRef } from 'react';
import { useVisualViewportMetrics } from '../../../components/ui/use-visual-viewport';
import { useCapacitorKeyboardMetrics } from '../../../components/ui/use-capacitor-keyboard';

export interface KeyboardMetrics {
  vv: ReturnType<typeof useVisualViewportMetrics>;
  capKeyboard: ReturnType<typeof useCapacitorKeyboardMetrics>;
  keyboardOpen: boolean;
  containerHeight: number | undefined;
  viewportInsetBottom: number;
}

export function useKeyboardMetrics(inputFocused: boolean): KeyboardMetrics {
  const vv = useVisualViewportMetrics();
  const capKeyboard = useCapacitorKeyboardMetrics();
  const baselineLayoutHeightRef = useRef<number>(vv.layoutHeight);
  baselineLayoutHeightRef.current = Math.max(baselineLayoutHeightRef.current, vv.layoutHeight);
  const layoutInset = Math.max(0, baselineLayoutHeightRef.current - vv.layoutHeight);
  const viewportInsetBottom = Math.max(vv.insetBottom, layoutInset);
  const overlayInsetFromCap = capKeyboard.height > 0 ? Math.max(0, capKeyboard.height - layoutInset) : 0;
  const keyboardOpen = inputFocused && (capKeyboard.visible || capKeyboard.height > 0 || viewportInsetBottom > 0);
  const containerHeight = keyboardOpen
    ? Math.round(
        Math.max(
          0,
          capKeyboard.height > 0
            ? vv.layoutHeight - overlayInsetFromCap
            : vv.supported
              ? vv.visualHeight + vv.offsetTop
              : vv.layoutHeight - viewportInsetBottom,
        ),
      )
    : undefined;

  return { vv, capKeyboard, keyboardOpen, containerHeight, viewportInsetBottom };
}
