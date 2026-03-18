import * as React from 'react';

export interface VisualViewportMetrics {
  supported: boolean;
  layoutHeight: number;
  visualHeight: number;
  offsetTop: number;
  insetBottom: number;
}

function readMetrics(baselineLayoutHeight?: number): VisualViewportMetrics {
  const layoutHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;

  if (!vv) {
    const baseline = typeof baselineLayoutHeight === 'number' ? baselineLayoutHeight : layoutHeight;
    const insetBottom = Math.max(0, baseline - layoutHeight);
    return {
      supported: false,
      layoutHeight,
      visualHeight: layoutHeight,
      offsetTop: 0,
      insetBottom,
    };
  }

  const visualHeight = vv.height;
  const offsetTop = vv.offsetTop || 0;
  const insetBottom = Math.max(0, layoutHeight - (visualHeight + offsetTop));

  return {
    supported: true,
    layoutHeight,
    visualHeight,
    offsetTop,
    insetBottom,
  };
}

export function useVisualViewportMetrics(): VisualViewportMetrics {
  const baselineLayoutHeightRef = React.useRef<number>(typeof window !== 'undefined' ? window.innerHeight : 0);
  const [metrics, setMetrics] = React.useState<VisualViewportMetrics>(() =>
    readMetrics(baselineLayoutHeightRef.current),
  );

  React.useEffect(() => {
    const update = () => {
      baselineLayoutHeightRef.current = Math.max(baselineLayoutHeightRef.current, window.innerHeight);
      setMetrics(readMetrics(baselineLayoutHeightRef.current));
    };

    update();

    window.addEventListener('resize', update);

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }

    return () => {
      window.removeEventListener('resize', update);
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
    };
  }, []);

  return metrics;
}
