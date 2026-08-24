"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToastStore, ToastType } from "@/store/useToastStore";

const STYLES: Record<ToastType, { border: string; icon: React.ReactNode }> = {
  error: {
    border: "border-red-500/40 bg-red-950/95",
    icon: <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />,
  },
  success: {
    border: "border-green-500/40 bg-green-950/95",
    icon: <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5" />,
  },
  info: {
    border: "border-zinc-600 bg-zinc-800/95",
    icon: <Info size={16} className="text-zinc-400 shrink-0 mt-0.5" />,
  },
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const style = STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border ${style.border} px-3 py-2.5 shadow-lg`}
          >
            {style.icon}
            <p className="text-sm text-zinc-100 flex-1 min-w-0 break-words">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
