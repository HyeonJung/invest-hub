"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "info" | "error";
type Toast = { id: string; title: string; description?: string; kind: ToastKind };

const ToastContext = createContext<{ notify: (toast: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-5 top-5 z-50 flex w-[360px] max-w-[calc(100vw-40px)] flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? XCircle : Info;
          return (
            <div
              key={toast.id}
              className={cn(
                "glass-card flex gap-3 rounded-xl p-4 text-sm",
                toast.kind === "success" && "border-emerald-200",
                toast.kind === "error" && "border-red-200"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5",
                  toast.kind === "success" && "text-emerald-500",
                  toast.kind === "error" && "text-red-500",
                  toast.kind === "info" && "text-blue-500"
                )}
              />
              <div>
                <p className="font-semibold text-slate-900">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-slate-500">{toast.description}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("ToastProvider 안에서만 useToast를 사용할 수 있습니다.");
  }
  return context;
}
