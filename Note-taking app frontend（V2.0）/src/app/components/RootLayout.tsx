import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Toaster } from 'sonner';
import { useTheme } from './context/ThemeContext';

/**
 * Root layout — injects mobile-viewport meta tags on mount, then
 * renders the route outlet. Keeps Outlet inside RouterProvider context.
 */
export function RootLayout() {
  const { isDark } = useTheme();

  useEffect(() => {
    const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (vp && !vp.content.includes('viewport-fit')) {
      vp.content = vp.content.trimEnd().replace(/,?\s*$/, '') +
        ', viewport-fit=cover, maximum-scale=1.0, user-scalable=no';
    }

    let tc = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!tc) {
      tc = document.createElement('meta');
      tc.name = 'theme-color';
      document.head.appendChild(tc);
    }
    tc.content = isDark ? '#0F0E1A' : '#F8F5FF';

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--hi-page-bg').trim();
    document.body.style.background = bg || (isDark ? '#0F0E1A' : '#FDFDFF');
  }, [isDark]);

  return (
    <>
      <Outlet />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(30,27,75,0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(99,102,241,0.25)',
            color: 'white',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: 600,
          },
        }}
      />
    </>
  );
}
