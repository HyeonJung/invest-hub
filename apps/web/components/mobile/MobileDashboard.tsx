"use client";

import { ChevronRight, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MobileAssetSummaryCard } from "@/components/mobile/MobileAssetSummaryCard";
import { MobileMarketTicker } from "@/components/mobile/MobileMarketTicker";
import { SecurityLogo } from "@/components/security-logo";
import type { Holding, PriceRefreshResult } from "@/lib/api";
import type { MobileAccount, MobileAggregatedHolding, MobilePortfolioData } from "@/components/mobile/mobile-types";
import {
  formatMobileDateTime,
  formatPercentMobile,
  formatSignedKrwMobile,
  getLatestMobileHoldingPriceUpdatedAt,
  mobileBrokerColors,
  mobileBrokerIconSrc,
  safeNumber
} from "@/components/mobile/mobile-utils";
import { cn, formatKrw } from "@/lib/utils";

export function MobileDashboard({
  data,
  marketLoading,
  marketError,
  priceStatus,
  onSelectHolding
}: {
  data: MobilePortfolioData;
  marketLoading: boolean;
  marketError: Error | null;
  priceStatus?: PriceRefreshResult;
  onSelectHolding: (holding: MobileAggregatedHolding) => void;
}) {
  const lastUpdatedAt = priceStatus?.lastSuccessAt ?? getLatestMobileHoldingPriceUpdatedAt(data.summary.holdings);
  const queriedAt = priceStatus?.refreshedAt ?? priceStatus?.lastSuccessAt ?? lastUpdatedAt;

  return (
    <div className="space-y-4">
      <MobileAssetSummaryCard summary={data.summary} lastUpdatedAt={lastUpdatedAt} />
      <TodayMovementCard summary={data.summary} queriedAt={queriedAt} />
      <MobileMarketTicker data={data.marketIndicators} loading={marketLoading} error={marketError} />
      <div className="space-y-4">
        <MobileAssetAllocationCard data={data} />
        <MobileBrokerValueCard accounts={data.accounts} />
        <MobileTopHoldingsCard summary={data.summary} holdings={data.holdings} onSelectHolding={onSelectHolding} />
      </div>
    </div>
  );
}

function TodayMovementCard({ summary, queriedAt }: { summary: MobilePortfolioData["summary"]; queriedAt?: string | null }) {
  const movement = summary.todayAssetMovement ?? {
    totalChange: 0,
    stockImpact: 0,
    fxImpact: summary.metrics.fxImpactAmount ?? 0,
    dividendImpact: 0
  };
  const totalPositive = movement.totalChange >= 0;

  return (
    <section className="rounded-[20px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[18px] font-black text-[#0F172A]">오늘 자산 변동</h2>
      </div>
      <p className="text-[12px] font-bold text-[#64748B]">총 변동금액</p>
      <p className={cn("numeric mt-1 overflow-hidden text-ellipsis text-[clamp(24px,7vw,30px)] font-black leading-tight", totalPositive ? "text-[#16A34A]" : "text-[#2563EB]")}>
        {formatSignedKrwMobile(movement.totalChange)}
      </p>
      <div className="mt-5 space-y-3">
        <MovementRow label="주가 영향" value={movement.stockImpact} />
        <MovementRow label="환율 영향" value={movement.fxImpact} />
        <MovementRow label="배당 영향" value={movement.dividendImpact} />
      </div>
      <p className="mt-4 text-[12px] font-bold text-[#94A3B8]">
        조회 시각 <span className="numeric text-[#64748B]">{formatMobileDateTime(queriedAt)}</span>
      </p>
    </section>
  );
}

function MovementRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  const positive = value >= 0;

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="text-[13px] font-bold text-[#64748B]">{label}</span>
      <span className={`${strong ? "text-[17px]" : "text-[13px]"} numeric overflow-hidden text-ellipsis whitespace-nowrap font-black ${positive ? "text-[#EF4444]" : "text-[#2563EB]"}`}>
        {formatSignedKrwMobile(value)}
      </span>
    </div>
  );
}

function MobileAssetAllocationCard({ data }: { data: MobilePortfolioData }) {
  const router = useRouter();
  const allocation = data.assetAllocation;

  return (
    <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
      <h2 className="text-[18px] font-black text-[#0F172A]">자산 구성 비중</h2>
      <div className="mt-4 min-w-0">
        <div className="relative mx-auto h-[180px] max-w-[180px] overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={allocation} innerRadius={46} outerRadius={76} dataKey="value" paddingAngle={2} animationDuration={700}>
                {allocation.map((entry) => (
                  <Cell key={entry.name} fill={entry.color ?? "#2563EB"} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatKrw(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[11px] font-bold text-[#64748B]">총 자산</p>
            <p className="numeric mt-1 max-w-[116px] overflow-hidden text-ellipsis text-[12px] font-black text-[#0F172A]">{formatKrw(data.summary.metrics.totalMarketValue)}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {allocation.map((item) => {
            const rate = item.rate ?? 0;
            return (
              <div key={item.name} className="min-w-0">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-[#64748B]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color ?? "#2563EB" }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="numeric shrink-0 text-[15px] font-black text-[#0F172A]">{rate.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7]">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, rate)}%`, backgroundColor: item.color ?? "#2563EB" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className="mt-5 flex h-11 w-full items-center justify-center rounded-2xl border border-[#E5EAF0] bg-white text-[13px] font-black text-[#2563EB] shadow-sm"
        onClick={() => router.push("/analysis")}
      >
        자산 구성 자세히 보기
      </button>
    </section>
  );
}

function MobileBrokerValueCard({ accounts }: { accounts: MobileAccount[] }) {
  const router = useRouter();
  const total = accounts.reduce((sum, account) => sum + account.metrics.totalMarketValue, 0);

  return (
    <section className="min-w-0 rounded-[20px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
      <h2 className="text-[18px] font-black text-[#0F172A]">계좌별 평가금액</h2>
      <div className="mt-4 space-y-4">
        {accounts.map((account) => {
          const rate = total > 0 ? (account.metrics.totalMarketValue / total) * 100 : 0;
          const color = mobileBrokerColors[account.broker] ?? "#2563EB";

          return (
            <button
              key={account.id}
              type="button"
              className="block w-full min-w-0 rounded-2xl bg-white text-left transition active:scale-[0.99]"
              onClick={() => router.push(`/accounts/${account.id}`)}
            >
              <div className="flex min-w-0 items-start gap-3">
                <MobileBrokerIcon account={account} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-black text-[#0F172A]">{account.shortName}</p>
                      <p className="mt-1 truncate text-[12px] font-bold text-[#64748B]">{account.brokerLabel}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="numeric max-w-[138px] overflow-hidden text-ellipsis text-[15px] font-black text-[#0F172A]">{formatKrw(account.metrics.totalMarketValue)}</p>
                      <p className="numeric mt-1 text-[11px] font-bold text-[#64748B]">{rate.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, rate)}%`, backgroundColor: color }} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-5 flex h-11 w-full items-center justify-center rounded-2xl border border-[#E5EAF0] bg-white text-[13px] font-black text-[#2563EB] shadow-sm"
        onClick={() => router.push("/accounts")}
      >
        계좌 관리
      </button>
    </section>
  );
}

function MobileTopHoldingsCard({
  summary,
  holdings,
  onSelectHolding
}: {
  summary: MobilePortfolioData["summary"];
  holdings: MobileAggregatedHolding[];
  onSelectHolding: (holding: MobileAggregatedHolding) => void;
}) {
  const router = useRouter();
  const totalMarketValue = Math.max(1, summary.metrics.totalMarketValue);
  const topHoldings = summary.topHoldings.slice(0, 5);

  return (
    <section className="min-w-0 rounded-[20px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
      <h2 className="text-[18px] font-black text-[#0F172A]">상위 보유 종목 TOP 5</h2>
      <div className="mt-3 divide-y divide-[#F1F5F9]">
        {topHoldings.map((holding, index) => {
          const matchedHolding = findMobileHolding(holdings, holding);
          const weight = (safeNumber(holding.marketValue) / totalMarketValue) * 100;
          const positive = holding.profitLossRate >= 0;

          return (
            <button
              key={holding.id}
              type="button"
              className="flex w-full min-w-0 items-center gap-3 rounded-[18px] bg-white px-1 py-3 text-left transition active:scale-[0.99]"
              onClick={() => (matchedHolding ? onSelectHolding(matchedHolding) : undefined)}
            >
              <span className="w-5 shrink-0 text-center text-[12px] font-black text-[#94A3B8]">{index + 1}</span>
              <SecurityLogo symbol={holding.symbol} name={holding.name} logoUrl={holding.logoUrl} marketCountry={holding.marketCountry} size="md" showCountryBadge />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-black text-[#0F172A]">{holding.name || holding.symbol}</p>
                <p className="numeric mt-1 truncate text-[12px] font-bold text-[#94A3B8]">
                  {holding.symbol} · {weight.toFixed(2)}%
                </p>
              </div>
              <div className="min-w-[108px] shrink-0 text-right">
                <p className="numeric overflow-hidden text-ellipsis text-[14px] font-black text-[#0F172A]">{formatKrw(holding.marketValue)}</p>
                <p className={cn("numeric mt-1 text-[12px] font-black", positive ? "text-[#EF4444]" : "text-[#2563EB]")}>{formatPercentMobile(holding.profitLossRate)}</p>
              </div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-4 flex h-11 w-full items-center justify-center gap-1 rounded-2xl border border-[#E5EAF0] bg-white text-[13px] font-black text-[#2563EB] shadow-sm"
        onClick={() => router.push("/holdings")}
      >
        보유 종목 전체 보기
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function MobileBrokerIcon({ account }: { account: MobileAccount }) {
  const iconSrc = mobileBrokerIconSrc[account.broker];
  const color = mobileBrokerColors[account.broker] ?? "#2563EB";

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F8FAFC] shadow-sm ring-1 ring-[#E5EAF0]">
      {iconSrc ? (
        <img src={iconSrc} alt="" className="h-7 w-7 object-contain" loading="lazy" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-xl text-[14px] font-black text-white" style={{ backgroundColor: color }}>
          <Wallet className="h-4 w-4" />
        </span>
      )}
    </span>
  );
}

function findMobileHolding(holdings: MobileAggregatedHolding[], holding: Holding) {
  return holdings.find((item) => item.symbol === holding.symbol && item.marketCountry === holding.marketCountry) ?? null;
}
