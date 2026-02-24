
  import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorProvider } from "./contexts/ErrorContext";
import "./styles/globals.css";

// Filter out sqlcipher errors from browser extensions
const originalError = console.error;
console.error = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  if (message.includes('sqlcipher') || message.includes('sqlcipher_attribute')) {
    // Silently ignore these errors from browser extensions
    return;
  }
  originalError.apply(console, args);
};

// Add global error handler
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('sqlcipher')) {
    event.preventDefault();
    return;
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorProvider>
);
  