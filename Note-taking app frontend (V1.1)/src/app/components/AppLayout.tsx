import { Outlet } from "react-router";
import { Toaster } from "sonner";
import { NoteProvider } from "./context/NoteContext";

export function AppLayout() {
  return (
    <NoteProvider>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-yellow-200 selection:text-black">
        <Outlet />
        <Toaster position="top-center" />
      </div>
    </NoteProvider>
  );
}
