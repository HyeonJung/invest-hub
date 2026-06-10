"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MobileAccount } from "@/components/mobile/mobile-types";
import { accountTypeLabelMobile, formatPercentMobile, formatSignedKrwMobile, mobileBrokerColors, mobileBrokerIconSrc } from "@/components/mobile/mobile-utils";
import { cn, formatKrw } from "@/lib/utils";

export function MobileAccountList({
  accounts,
  compact = false,
  onConnect
}: {
  accounts: MobileAccount[];
  compact?: boolean;
  onConnect?: () => void;
}) {
  const router = useRouter();
  const visibleAccounts = compact ? accounts.slice(0, 3) : accounts;

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-black tracking-[-0.01em] text-[#0F172A]">내 계좌</h2>
        {compact ? (
          <button type="button" className="text-[12px] font-black text-[#2563EB]" onClick={() => router.push("/accounts")}>
            전체 보기
          </button>
        ) : null}
      </div>
      <div className="space-y-3">
        {visibleAccounts.map((account) => (
          <button
            key={account.id}
            type="button"
            className="flex w-full min-w-0 items-center gap-3 rounded-[20px] border border-[#E5EAF0] bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
            onClick={() => router.push(`/accounts/${account.id}`)}
          >
            <BrokerIcon account={account} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-[15px] font-black text-[#0F172A]">{account.shortName}</p>
                <span className="shrink-0 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-black text-[#64748B]">
                  {accountTypeLabelMobile(account.accountType)}
                </span>
              </div>
              <p className="mt-1 truncate text-[12px] font-bold text-[#94A3B8]">{account.brokerLabel}</p>
            </div>
            <div className="min-w-[112px] text-right">
              <p className="numeric overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-black text-[#0F172A]">{formatKrw(account.metrics.totalMarketValue)}</p>
              <p className={cn("numeric mt-1 text-[12px] font-black", account.metrics.totalProfitLoss >= 0 ? "text-[#EF4444]" : "text-[#2563EB]")}>
                {formatPercentMobile(account.metrics.returnRate)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#CBD5E1]" />
          </button>
        ))}
        {!compact ? (
          <button
            type="button"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[#CBD5E1] bg-white text-[14px] font-black text-[#2563EB]"
            onClick={onConnect}
          >
            <Plus className="h-4 w-4" />
            계좌 연결하기
          </button>
        ) : null}
      </div>
    </section>
  );
}

function BrokerIcon({ account }: { account: MobileAccount }) {
  const iconSrc = mobileBrokerIconSrc[account.broker];
  const color = mobileBrokerColors[account.broker];

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F8FAFC] shadow-sm ring-1 ring-[#E5EAF0]">
      {iconSrc ? (
        <img src={iconSrc} alt="" className="h-8 w-8 object-contain" loading="lazy" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-xl text-[15px] font-black text-white" style={{ backgroundColor: color }}>
          {account.brokerLabel.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
