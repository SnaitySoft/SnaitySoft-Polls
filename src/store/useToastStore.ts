import { create } from "zustand";

export type ToastType = "error" | "success" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  pushToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
}

const DURATION_MS: Record<ToastType, number> = {
  error: 7000,
  success: 3000,
  info: 4000,
};

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  pushToast: (message, type = "error") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => get().dismissToast(id), DURATION_MS[type]);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
