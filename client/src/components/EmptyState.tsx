import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  message: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/**
 * EmptyState component for displaying when no data is available
 * 
 * @param message - Message to display in the empty state
 * @param actionText - Optional text for action button
 * @param onAction - Optional callback for action button
 * @param icon - Optional custom icon (defaults to Inbox icon)
 */
export function EmptyState({ 
  message, 
  actionText, 
  onAction,
  icon 
}: EmptyStateProps) {
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          {icon || <Inbox className="w-8 h-8 text-slate-400" />}
        </div>
        <p className="text-slate-600 text-base mb-6">
          {message}
        </p>
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            {actionText}
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
