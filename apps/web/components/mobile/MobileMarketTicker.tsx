"use client";

import { Loader2 } from "lucide-react";
import type { MarketIndicatorsResult } from "@/lib/api";
import { FearGreedBadge, getFearGreedMeta } from "@/components/fear-greed-badge";
import { MobileSparkline } from "@/components/mobile/MobileSparkline";
import {
  buildMobileIndicatorSparkline,
  compactMobileIndicatorName,
  formatMobileIndicatorValue,
  selectMobileMarketIndicators
} from "@/components/mobile/mobile-utils";
import { cn } from "@/lib/utils";

export function MobileMarketTicker({
  data,
  loading,
  error
}: {
  data?: MarketIndicatorsResult;
  loading: boolean;
  error: Error | null;
}) {
  const indicators = selectMobileMarketIndicators(data?.indicators ?? []);

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-black tracking-[-0.01em] text-[#0F172A]">시장 주요 지표</h2>
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#94A3B8]">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2563EB]" /> : null}
          <span>{error ? "일부 지연" : "자동 갱신"}</span>
        </div>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-0 gap-3">
          {indicators.length === 0
            ? Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-[78px] w-[132px] shrink-0 animate-pulse rounded-[18px] border border-[#E5EAF0] bg-white" />
              ))
            : indicators.map((indicator) =>
                indicator.symbol === "FEAR_GREED" ? (
                  <MobileFearGreedTickerCard key={indicator.symbol} indicator={indicator} />
                ) : (
                  <MobileMarketTickerCard key={indicator.symbol} indicator={indicator} />
                )
              )}
        </div>
      </div>
      {error || (data?.errors.length ?? 0) > 0 ? (
        <p className="mt-2 rounded-2xl bg-orange-50 px-3 py-2 text-[12px] font-bold leading-5 text-orange-700">
          일부 지표가 지연되어 마지막 성공 값 기준으로 표시 중입니다.
        </p>
      ) : null}
    </section>
  );
}

function MobileMarketTickerCard({ indicator }: { indicator: MarketIndicatorsResult["indicators"][number] }) {
  const positive = indicator.changeRate >= 0;
  const sparkline = buildMobileIndicatorSparkline(indicator);

  return (
    <article className="relative h-[78px] w-[132px] shrink-0 overflow-hidden rounded-[18px] border border-[#E5EAF0] bg-white p-3 shadow-sm">
      <div className="relative z-10 min-w-0">
        <p className="truncate text-[11px] font-black uppercase text-[#64748B]">{compactMobileIndicatorName(indicator.name, indicator.symbol)}</p>
        <p className="numeric mt-1 max-w-[102px] overflow-hidden text-ellipsis whitespace-nowrap text-[17px] font-black leading-5 text-[#0F172A]">
          {formatMobileIndicatorValue(indicator)}
        </p>
        <p className={cn("numeric mt-1 max-w-[62px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-black", positive ? "text-[#EF4444]" : "text-[#2563EB]")}>
          {indicator.changeRate > 0 ? "+" : ""}
          {indicator.changeRate.toFixed(2)}%
        </p>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-2 h-[28px] w-[70px] overflow-hidden">
        <MobileSparkline values={sparkline} positive={positive} />
      </div>
    </article>
  );
}

function MobileFearGreedTickerCard({ indicator }: { indicator: MarketIndicatorsResult["indicators"][number] }) {
  const meta = getFearGreedMeta(indicator.value);

  return (
    <article className="relative h-[78px] w-[132px] shrink-0 overflow-hidden rounded-[18px] border bg-white p-3 shadow-sm" style={{ borderColor: `${meta.color}35` }}>
      <div className="flex h-full min-w-0 items-center gap-2">
        <FearGreedBadge value={indicator.value} size="sm" showValue={false} showLabel={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-[#64748B]">공포탐욕</p>
          <p className="numeric mt-1 text-[21px] font-black leading-none text-[#0F172A]">{Math.round(indicator.value)}</p>
          <p className="mt-1 truncate text-[11px] font-black" style={{ color: meta.color }}>
            {meta.labelKo}
          </p>
        </div>
      </div>
      <span className="absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-60" style={{ backgroundColor: meta.softColor }} />
    </article>
  );
}
