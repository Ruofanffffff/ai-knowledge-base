import { createContext, useContext, useState, ReactNode } from 'react';

export interface ErrorModalData {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  details?: string;
}

interface ErrorContextType {
  error: ErrorModalData | null;
  showError: (error: ErrorModalData) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<ErrorModalData | null>(null);

  const showError = (errorData: ErrorModalData) => {
    setError(errorData);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <ErrorContext.Provider value={{ error, showError, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

// Global function for showing errors from interceptors
let globalShowError: ((error: ErrorModalData) => void) | null = null;

export function setGlobalErrorHandler(handler: (error: ErrorModalData) => void) {
  globalShowError = handler;
}

export function showErrorModal(error: ErrorModalData) {
  if (globalShowError) {
    globalShowError(error);
  }
}
