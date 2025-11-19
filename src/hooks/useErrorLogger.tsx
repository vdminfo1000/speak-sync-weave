import { useState, useEffect, useCallback } from 'react';

export interface ErrorLog {
  id: string;
  timestamp: string;
  type: 'error' | 'warning' | 'network' | 'console';
  message: string;
  stack?: string;
  url?: string;
  component?: string;
  additionalData?: Record<string, any>;
}

const ERROR_STORAGE_KEY = 'app_error_logs';
const MAX_LOGS = 500;

export const useErrorLogger = () => {
  const [errors, setErrors] = useState<ErrorLog[]>(() => {
    try {
      const stored = localStorage.getItem(ERROR_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const logError = useCallback((error: Omit<ErrorLog, 'id' | 'timestamp'>) => {
    const newError: ErrorLog = {
      ...error,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    setErrors(prev => {
      const updated = [newError, ...prev].slice(0, MAX_LOGS);
      try {
        localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save error logs:', e);
      }
      return updated;
    });

    // Also log to console for immediate visibility
    console.error(`[${error.type.toUpperCase()}]`, error.message, error);
  }, []);

  const clearLogs = useCallback(() => {
    setErrors([]);
    localStorage.removeItem(ERROR_STORAGE_KEY);
  }, []);

  const exportLogs = useCallback(() => {
    const dataStr = JSON.stringify(errors, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [errors]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logError({
        type: 'error',
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        additionalData: {
          lineno: event.lineno,
          colno: event.colno,
        }
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError({
        type: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        additionalData: {
          reason: event.reason,
        }
      });
    };

    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      logError({
        type: 'console',
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '),
      });
      originalConsoleError.apply(console, args);
    };

    const originalConsoleWarn = console.warn;
    console.warn = (...args: any[]) => {
      logError({
        type: 'warning',
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '),
      });
      originalConsoleWarn.apply(console, args);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, [logError]);

  return {
    errors,
    logError,
    clearLogs,
    exportLogs,
    errorCount: errors.length,
    recentErrors: errors.slice(0, 10),
  };
};
