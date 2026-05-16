import { Suspense } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { NoteProvider } from './components/context/NoteContext';
import { ToastProvider } from './components/ui/Toast';
import { ThemeProvider } from './components/context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <NoteProvider>
        <ToastProvider>
          <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[#0a0a14]"><div className="text-white/60 text-sm">加载中...</div></div>}>
            <RouterProvider router={router} />
          </Suspense>
        </ToastProvider>
      </NoteProvider>
    </ThemeProvider>
  );
}