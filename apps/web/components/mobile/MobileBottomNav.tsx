"use client";

import Link from "next/link";
import { BarChart3, Home, PieChart, Settings, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MobileTab } from "@/components/mobile/mobile-types";

const tabs: Array<{ key: MobileTab; label: string; href: string; icon: typeof Home }> = [
  { key: "home", label: "홈", href: "/dashboard", icon: Home },
  { key: "accounts", label: "계좌", href: "/accounts", icon: WalletCards },
  { key: "holdings", label: "보유", href: "/holdings", icon: PieChart },
  { key: "analysis", label: "분석", href: "/analysis", icon: BarChart3 },
  { key: "settings", label: "설정", href: "/settings", icon: Settings }
];

export function MobileBottomNav({ active }: { active: MobileTab }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5EAF0] bg-white/92 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden" aria-label="모바일 하단 메뉴">
      <div className="mx-auto grid h-[68px] max-w-[520px] grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition",
                isActive ? "text-[#2563EB]" : "text-[#94A3B8] active:text-[#0F172A]"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={cn("flex h-8 w-10 items-center justify-center rounded-full transition", isActive && "bg-[#EFF6FF]")}>
                <Icon className="h-5 w-5" />
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
