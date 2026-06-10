"use client";

import type { PortfolioSummary } from "@/lib/api";
import { cn, formatKrw } from "@/lib/utils";
import { MobileSparkline } from "@/components/mobile/MobileSparkline";
import { buildMobileAssetTrend, formatPercentMobile, formatSignedKrwMobile, safeNumber } from "@/components/mobile/mobile-utils";

export function MobileAssetSummaryCard({ summary }: { summary: PortfolioSummary }) {
  const movement = summary.todayAssetMovement ?? {
    stockImpact: 0,
    fxImpact: summary.metrics.fxImpactAmount ?? 0,
    dividendImpact: 0,
    totalChange: summary.metrics.fxImpactAmount ?? 0
  };
  const profitPositive = summary.metrics.totalProfitLoss >= 0;
  const todayPositive = movement.totalChange >= 0;
  const todayRate = (safeNumber(movement.totalChange) / Math.max(1, summary.metrics.totalMarketValue - movement.totalChange)) * 100;
  const trend = buildMobileAssetTrend(summary.metrics.totalMarketValue, movement.totalChange);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#E5EAF0] bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black text-[#64748B]">내 총 자산</p>
          <p className="numeric mt-3 max-w-full overflow-hidden text-ellipsis text-[clamp(28px,8vw,34px)] font-black leading-tight tracking-[-0.03em] text-[#0F172A]">
            {formatKrw(summary.metrics.totalMarketValue)}
          </p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("numeric max-w-full overflow-hidden text-ellipsis text-[16px] font-black", profitPositive ? "text-[#EF4444]" : "text-[#2563EB]")}>
              {formatSignedKrwMobile(summary.metrics.totalProfitLoss)}
            </span>
            <span className={cn("numeric text-[15px] font-black", profitPositive ? "text-[#EF4444]" : "text-[#2563EB]")}>
              ({formatPercentMobile(summary.metrics.returnRate)})
            </span>
          </div>
        </div>
        <div className="mt-3 shrink-0">
          <MobileSparkline values={trend} positive={todayPositive} className="h-[46px] w-[96px]" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <MobileMovementPill label="오늘" value={movement.totalChange} positive={todayPositive} />
        <MobileMovementPill label="전일 대비" value={todayRate} positive={todayRate >= 0} isPercent />
      </div>
    </section>
  );
}

function MobileMovementPill({ label, value, positive, isPercent = false }: { label: string; value: number; positive: boolean; isPercent?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#F8FAFC] px-3 py-3">
      <p className="text-[12px] font-black text-[#64748B]">{label}</p>
      <p className={cn("numeric mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-black", positive ? "text-[#16A34A]" : "text-[#EF4444]")}>
        {isPercent ? formatPercentMobile(value) : formatSignedKrwMobile(value)}
      </p>
    </div>
  );
}
