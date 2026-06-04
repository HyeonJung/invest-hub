import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingState({ label = "데이터를 불러오는 중입니다." }: { label?: string }) {
  return (
    <div className="glass-card flex min-h-[220px] items-center justify-center rounded-xl">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass-card flex min-h-[220px] flex-col items-center justify-center rounded-xl p-8 text-center">
      <p className="text-lg font-bold text-[var(--text-primary)]">{title}</p>
      <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-card flex min-h-[220px] flex-col items-center justify-center rounded-xl p-8 text-center">
      <AlertCircle className="h-8 w-8 text-red-500" />
      <p className="mt-3 text-lg font-bold text-[var(--text-primary)]">문제가 발생했습니다.</p>
      <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">{message}</p>
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}
