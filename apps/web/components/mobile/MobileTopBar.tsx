"use client";

import { Bell, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/api";

export function MobileTopBar({ user }: { user: AuthUser | null }) {
  const router = useRouter();
  const firstName = user?.name?.trim() || "대장님";

  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-white/70 bg-[#F7F9FC]/90 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">INVEST HUB</p>
          <h1 className="mt-1 truncate text-[20px] font-black tracking-[-0.02em] text-[#0F172A]">안녕하세요, {firstName}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E5EAF0] bg-white text-[#64748B] shadow-sm"
            aria-label="알림"
            onClick={() => router.push("/analysis")}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#EF4444]" />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5EAF0] bg-white text-[#64748B] shadow-sm"
            aria-label="설정"
            onClick={() => router.push("/settings")}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
