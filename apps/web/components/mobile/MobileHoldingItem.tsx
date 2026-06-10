"use client";

import { SecurityLogo } from "@/components/security-logo";
import { LossStickerBadge, ProfitStickerBadge } from "@/components/loss-sticker-badge";
import type { MobileAggregatedHolding } from "@/components/mobile/mobile-types";
import { formatPercentMobile, formatQuantityMobile, marketCountryFlagMobile } from "@/components/mobile/mobile-utils";
import { cn, formatKrw } from "@/lib/utils";

export function MobileHoldingItem({
  holding,
  onClick,
  rank
}: {
  holding: MobileAggregatedHolding;
  onClick?: () => void;
  rank?: number;
}) {
  const positive = holding.profitLoss >= 0;

  return (
    <button
      type="button"
      className="group flex w-full min-w-0 items-center gap-3 rounded-[18px] bg-white px-1 py-3 text-left transition active:scale-[0.99]"
      onClick={onClick}
    >
      {rank ? <span className="w-4 shrink-0 text-center text-[12px] font-black text-[#94A3B8]">{rank}</span> : null}
      <SecurityLogo symbol={holding.symbol} name={holding.name} logoUrl={holding.logoUrl} marketCountry={holding.marketCountry} size="md" showCountryBadge />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[15px] font-black text-[#0F172A]">{holding.name || holding.symbol}</p>
          <ProfitStickerBadge profitLossRate={holding.profitLossRate} size="sm" />
          <LossStickerBadge profitLossRate={holding.profitLossRate} size="sm" />
          <span className="shrink-0 text-[11px]" aria-hidden="true">
            {marketCountryFlagMobile(holding)}
          </span>
        </div>
        <p className="numeric mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-bold text-[#94A3B8]">
          {holding.symbol} · {formatQuantityMobile(holding.totalQuantity)}주
        </p>
      </div>
      <div className="min-w-[108px] text-right">
        <p className="numeric overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-black text-[#0F172A]">{formatKrw(holding.marketValue)}</p>
        <p className={cn("numeric mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-black", positive ? "text-[#EF4444]" : "text-[#2563EB]")}>
          {formatSignedProfit(holding.profitLoss)} ({formatPercentMobile(holding.profitLossRate)})
        </p>
      </div>
    </button>
  );
}

function formatSignedProfit(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${prefix}${Math.round(absolute / 100_000_000).toLocaleString("ko-KR")}억`;
  if (absolute >= 10_000) return `${prefix}${Math.round(absolute / 10_000).toLocaleString("ko-KR")}만`;
  return `${prefix}${Math.round(absolute).toLocaleString("ko-KR")}`;
}
