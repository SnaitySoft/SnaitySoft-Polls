import { create } from "zustand";

export type ToastType = "error" | "success" | "info";

export interface ToastAction {
  label: string;
  url: string;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

interface PushToastOptions {
  // skips the auto-dismiss timer — for things the user shouldn't miss (e.g. a new version
  // being available), left on screen until they dismiss it themselves via the X button.
  persistent?: boolean;
  action?: ToastAction;
}

interface ToastStore {
  toasts: Toast[];
  pushToast: (message: string, type?: ToastType, options?: PushToastOptions) => void;
  dismissToast: (id: string) => void;
}

const DURATION_MS: Record<ToastType, number> = {
  error: 7000,
  success: 3000,
  info: 4000,
};

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  pushToast: (message, type = "error", options) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message, action: options?.action }] }));
    if (!options?.persistent) {
      setTimeout(() => get().dismissToast(id), DURATION_MS[type]);
    }
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
