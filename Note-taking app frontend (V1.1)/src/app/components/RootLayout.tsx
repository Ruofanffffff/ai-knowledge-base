import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Toaster } from 'sonner';

/**
 * Root layout — injects mobile-viewport meta tags on mount, then
 * renders the route outlet. Keeps Outlet inside RouterProvider context.
 */
export function RootLayout() {
  useEffect(() => {
    // ── 1. viewport-fit=cover ── lets the app extend behind the
    //    Android status bar and iOS notch instead of leaving a gap.
    const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (vp && !vp.content.includes('viewport-fit')) {
      vp.content = vp.content.trimEnd().replace(/,?\s*$/, '') +
        ', viewport-fit=cover, maximum-scale=1.0, user-scalable=no';
    }

    // ── 2. theme-color ── sets the Android status-bar background so it
    //    blends with the page instead of showing an opaque black strip.
    let tc = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!tc) {
      tc = document.createElement('meta');
      tc.name = 'theme-color';
      document.head.appendChild(tc);
    }
    // Light purple-white to match the app's overall gradient feel
    tc.content = '#F8F5FF';

    // ── 3. body background ── prevents a flash of white/black during
    //    route transitions or before React hydrates.
    document.documentElement.style.background = '#0e0520';
    document.body.style.background = '#FDFDFF';
  }, []);

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