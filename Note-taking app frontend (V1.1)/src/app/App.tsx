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
          <RouterProvider router={router} />
        </ToastProvider>
      </NoteProvider>
    </ThemeProvider>
  );
}