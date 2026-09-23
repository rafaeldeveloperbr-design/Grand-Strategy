/**
 * ============================================================
 * TIPOS DE TOAST / NOTIFICAÇÕES
 * ============================================================
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number; // Tempo em milissegundos (padrão: 3500ms)
}
