import { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useError } from '../../contexts/ErrorContext';
import './ErrorModal.css';

export function ErrorModal() {
  const { error, clearError } = useError();

  // Auto-dismiss info messages after 5 seconds
  useEffect(() => {
    if (error && error.type === 'info') {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const getIcon = () => {
    switch (error?.type) {
      case 'error':
        return (
          <svg className="error-icon error" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'warning':
        return (
          <svg className="error-icon warning" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'info':
        return (
          <svg className="error-icon info" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {error && (
        <Dialog.Root open={!!error} onOpenChange={clearError}>
          <Dialog.Portal>
            <Dialog.Overlay asChild>
              <motion.div
                className="error-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="error-modal-content"
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="error-modal-header">
                  {getIcon()}
                  <Dialog.Title className="error-modal-title">
                    {error.title}
                  </Dialog.Title>
                </div>
                
                <Dialog.Description className="error-modal-message">
                  {error.message}
                </Dialog.Description>
                
                {error.details && (
                  <details className="error-modal-details">
                    <summary>Technical Details</summary>
                    <pre>{error.details}</pre>
                  </details>
                )}
                
                <div className="error-modal-actions">
                  <Dialog.Close asChild>
                    <button className="error-modal-button">
                      {error.type === 'info' ? 'OK' : 'Close'}
                    </button>
                  </Dialog.Close>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
