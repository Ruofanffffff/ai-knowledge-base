import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  title?: string;
}

/**
 * ErrorDisplay component for showing error messages with optional retry button
 * 
 * @param message - Error message to display
 * @param onRetry - Optional callback function for retry button
 * @param title - Optional title for the error (defaults to "Error")
 */
export function ErrorDisplay({ message, onRetry, title = 'Error' }: ErrorDisplayProps) {
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {title}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {message}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <RefreshCw size={16} />
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ErrorDisplay;
