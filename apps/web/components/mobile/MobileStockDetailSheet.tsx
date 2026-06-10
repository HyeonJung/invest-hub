"use client";

import { X } from "lucide-react";
import { SecurityLogo } from "@/components/security-logo";
import type { MobileAggregatedHolding } from "@/components/mobile/mobile-types";
import {
  accountTypeLabelMobile,
  formatPercentMobile,
  formatQuantityMobile,
  formatSignedKrwMobile,
  marketCountryFlagMobile,
  mobileBrokerLabels
} from "@/components/mobile/mobile-utils";
import { cn, formatKrw } from "@/lib/utils";

export function MobileStockDetailSheet({
  holding,
  onClose
}: {
  holding: MobileAggregatedHolding | null;
  onClose: () => void;
}) {
  if (!holding) return null;

  const positive = holding.profitLoss >= 0;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-slate-950/45" aria-label="종목 상세 닫기" onClick={onClose} />
      <section className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-hidden rounded-t-[28px] bg-white shadow-[0_-24px_70px_rgba(15,23,42,0.24)]">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[#CBD5E1]" />
        <div className="max-h-[calc(70vh-10px)] overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <SecurityLogo symbol={holding.symbol} name={holding.name} logoUrl={holding.logoUrl} marketCountry={holding.marketCountry} size="lg" showCountryBadge />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-[20px] font-black text-[#0F172A]">{holding.name || holding.symbol}</h2>
                  <span className="shrink-0 text-sm">{marketCountryFlagMobile(holding)}</span>
                </div>
                <p className="mt-1 text-[13px] font-bold text-[#94A3B8]">{holding.symbol}</p>
              </div>
            </div>
            <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B]" onClick={onClose} aria-label="닫기">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 rounded-[22px] bg-[#F8FAFC] p-4">
            <p className="text-[12px] font-black text-[#64748B]">평가금액</p>
            <p className="numeric mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[28px] font-black leading-none tracking-[-0.03em] text-[#0F172A]">
              {formatKrw(holding.marketValue)}
            </p>
            <p className={cn("numeric mt-3 text-[15px] font-black", positive ? "text-[#EF4444]" : "text-[#2563EB]")}>
              {formatSignedKrwMobile(holding.profitLoss)} ({formatPercentMobile(holding.profitLossRate)})
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <DetailMetric label="현재가" value={formatPrice(holding.marketPrice, holding.currency)} />
            <DetailMetric label="평균단가" value={formatPrice(holding.averagePurchasePrice, holding.currency)} />
            <DetailMetric label="보유수량" value={`${formatQuantityMobile(holding.totalQuantity)}주`} />
            <DetailMetric label="계좌 수" value={`${holding.accounts.length}개`} />
          </div>

          <div className="mt-6">
            <h3 className="text-[16px] font-black text-[#0F172A]">계좌별 보유</h3>
            <div className="mt-3 space-y-2">
              {holding.accounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-[#E5EAF0] bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black text-[#0F172A]">{mobileBrokerLabels[account.broker]}</p>
                      <p className="mt-1 truncate text-[12px] font-bold text-[#94A3B8]">
                        {account.accountAlias} · {accountTypeLabelMobile(account.accountType)}
                      </p>
                    </div>
                    <div className="min-w-[112px] text-right">
                      <p className="numeric text-[13px] font-black text-[#0F172A]">{formatKrw(account.marketValue)}</p>
                      <p className="numeric mt-1 text-[12px] font-bold text-[#94A3B8]">{formatQuantityMobile(account.quantity)}주</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#E5EAF0] bg-white p-3">
      <p className="text-[12px] font-black text-[#94A3B8]">{label}</p>
      <p className="numeric mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-black text-[#0F172A]">{value}</p>
    </div>
  );
}

function formatPrice(value: number, currency: string) {
  if (currency === "USD" && Math.abs(value) < 10000) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
  return formatKrw(value);
}
