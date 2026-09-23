/**
 * ============================================================
 * CONTEXT / GERENCIADOR DE TOASTS
 * ============================================================
 * Sistema global de notificações temporárias
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastMessage, ToastType } from '../types/toast';

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', title?: string, duration: number = 3500) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    
    const newToast: ToastMessage = {
      id,
      message,
      type,
      title,
      duration,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove após o tempo estipulado
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
