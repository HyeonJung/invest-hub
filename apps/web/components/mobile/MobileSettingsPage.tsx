"use client";

import { Bell, ChevronRight, KeyRound, LogOut, Moon, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/api";
import { ThemePreference, useTheme } from "@/components/theme-provider";
import { MobileAccountList } from "@/components/mobile/MobileAccountList";
import type { MobileAccount } from "@/components/mobile/mobile-types";
import { cn } from "@/lib/utils";

const notificationKeys = [
  { key: "price", label: "가격 변동 알림" },
  { key: "rebalance", label: "리밸런싱 알림" },
  { key: "dividend", label: "배당 일정 알림" },
  { key: "fx", label: "환율 알림" },
  { key: "fearGreed", label: "공포탐욕지수 알림" }
] as const;

type NotificationKey = (typeof notificationKeys)[number]["key"];

export function MobileSettingsPage({
  user,
  accounts,
  onLogout,
  onConnect
}: {
  user: AuthUser | null;
  accounts: MobileAccount[];
  onLogout: () => void;
  onConnect: () => void;
}) {
  const [sheet, setSheet] = useState<"services" | "security" | null>(null);
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>(() => readNotificationSettings());
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    window.localStorage.setItem("invest-hub-mobile-notifications", JSON.stringify(notifications));
  }, [notifications]);

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#2563EB] to-[#14B8A6] text-lg font-black text-white">
            {user?.profileImageUrl ? <img src={user.profileImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : (user?.name || "사").slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-black text-[#0F172A]">{user?.name ?? "사용자"}</p>
            <p className="mt-1 truncate text-[13px] font-bold text-[#64748B]">{user?.email ?? "로그인 정보 확인 중"}</p>
            <p className="mt-2 text-[11px] font-black text-[#2563EB]">{user?.providers.map(providerLabel).join(", ") || "소셜 로그인"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-4 shadow-sm">
        <SettingsSectionTitle icon={WalletCards} title="연결된 계좌 서비스" />
        <div className="mt-3">
          <MobileAccountList accounts={accounts} compact onConnect={onConnect} />
        </div>
        <button
          type="button"
          className="mt-4 flex h-12 w-full items-center justify-between rounded-2xl bg-[#F8FAFC] px-4 text-[14px] font-black text-[#0F172A]"
          onClick={() => setSheet("services")}
        >
          설정 관리
          <ChevronRight className="h-4 w-4 text-[#CBD5E1]" />
        </button>
      </section>

      <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-4 shadow-sm">
        <SettingsSectionTitle icon={Bell} title="알림 설정" />
        <div className="mt-3 divide-y divide-[#F1F5F9]">
          {notificationKeys.map((item) => (
            <label key={item.key} className="flex h-14 items-center justify-between gap-3">
              <span className="text-[14px] font-black text-[#0F172A]">{item.label}</span>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={notifications[item.key]}
                onChange={(event) => setNotifications((current) => ({ ...current, [item.key]: event.target.checked }))}
              />
              <span className="relative h-7 w-12 rounded-full bg-[#CBD5E1] transition peer-checked:bg-[#2563EB]">
                <span className={cn("absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition", notifications[item.key] && "translate-x-5")} />
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-4 shadow-sm">
        <SettingsSectionTitle icon={Moon} title="테마 설정" />
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-[#F8FAFC] p-1.5">
          {(["light", "dark", "system"] as ThemePreference[]).map((item) => (
            <button
              key={item}
              type="button"
              className={cn("h-10 rounded-xl text-[12px] font-black transition", theme === item ? "bg-white text-[#2563EB] shadow-sm" : "text-[#64748B]")}
              onClick={() => setTheme(item)}
            >
              {themeLabel(item)}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-4 shadow-sm">
        <SettingsSectionTitle icon={ShieldCheck} title="보안" />
        <button type="button" className="mt-3 flex h-12 w-full items-center justify-between rounded-2xl bg-[#F8FAFC] px-4 text-[14px] font-black text-[#0F172A]" onClick={() => setSheet("security")}>
          로그인 기록과 연결 계정
          <ChevronRight className="h-4 w-4 text-[#CBD5E1]" />
        </button>
        <button type="button" className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 text-[14px] font-black text-[#EF4444]" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </section>

      <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-4 shadow-sm">
        <SettingsSectionTitle icon={KeyRound} title="기타 설정" />
        <div className="mt-3 space-y-2 text-[13px] font-bold text-[#64748B]">
          <p>데이터 새로고침 주기: 자동</p>
          <button type="button" className="text-[#EF4444]">
            계정 탈퇴
          </button>
        </div>
      </section>

      <MobileSettingsSheet open={sheet !== null} title={sheet === "security" ? "보안 설정" : "서비스 설정"} onClose={() => setSheet(null)}>
        {sheet === "security" ? (
          <div className="space-y-3">
            <SheetRow label="로그인 방식" value={user?.providers.map(providerLabel).join(", ") || "소셜 로그인"} />
            <SheetRow label="이메일" value={user?.email ?? "-"} />
            <SheetRow label="최근 로그인" value={user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ko-KR") : "확인 중"} />
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <SheetRow key={account.id} label={account.displayName} value="연결됨" />
            ))}
            <button type="button" className="mt-2 h-12 w-full rounded-2xl bg-[#2563EB] text-[14px] font-black text-white" onClick={onConnect}>
              계좌 연결 추가
            </button>
          </div>
        )}
      </MobileSettingsSheet>
    </div>
  );
}

function SettingsSectionTitle({ icon: Icon, title }: { icon: typeof UserRound; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-[17px] font-black text-[#0F172A]">{title}</h2>
    </div>
  );
}

function MobileSettingsSheet({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-slate-950/40" aria-label="설정 닫기" onClick={onClose} />
      <section className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white p-5 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-[0_-24px_70px_rgba(15,23,42,0.22)]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#CBD5E1]" />
        <h3 className="text-[19px] font-black text-[#0F172A]">{title}</h3>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F8FAFC] p-4">
      <span className="text-[13px] font-black text-[#64748B]">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] font-black text-[#0F172A]">{value}</span>
    </div>
  );
}

function readNotificationSettings(): Record<NotificationKey, boolean> {
  const fallback = {
    price: true,
    rebalance: true,
    dividend: true,
    fx: true,
    fearGreed: true
  };

  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem("invest-hub-mobile-notifications") ?? "{}") as Partial<Record<NotificationKey, boolean>>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function providerLabel(provider: AuthUser["providers"][number]) {
  return provider === "KAKAO" ? "카카오" : "네이버";
}

function themeLabel(theme: ThemePreference) {
  if (theme === "dark") return "다크";
  if (theme === "system") return "시스템";
  return "라이트";
}
