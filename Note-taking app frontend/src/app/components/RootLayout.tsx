import { Outlet } from 'react-router';
import { Toaster } from 'sonner';

/**
 * Root layout — thin wrapper that provides a stable React Router outlet
 * for all child routes. Keeps Outlet inside RouterProvider context.
 */
export function RootLayout() {
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