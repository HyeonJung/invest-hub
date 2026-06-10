"use client";

import { Brain, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { MobileAccountList } from "@/components/mobile/MobileAccountList";
import { MobileAssetSummaryCard } from "@/components/mobile/MobileAssetSummaryCard";
import { MobileHoldingList } from "@/components/mobile/MobileHoldingList";
import { MobileMarketTicker } from "@/components/mobile/MobileMarketTicker";
import type { MobileAggregatedHolding, MobilePortfolioData } from "@/components/mobile/mobile-types";

export function MobileDashboard({
  data,
  marketLoading,
  marketError,
  onSelectHolding,
  onConnect
}: {
  data: MobilePortfolioData;
  marketLoading: boolean;
  marketError: Error | null;
  onSelectHolding: (holding: MobileAggregatedHolding) => void;
  onConnect: () => void;
}) {
  const router = useRouter();
  const firstInsight = data.summary.aiInsights[0];

  return (
    <div className="space-y-5">
      <MobileAssetSummaryCard summary={data.summary} />
      <TodayMovementCard summary={data.summary} />
      <MobileMarketTicker data={data.marketIndicators} loading={marketLoading} error={marketError} />
      <MobileAccountList accounts={data.accounts} compact onConnect={onConnect} />
      <MobileHoldingList holdings={data.holdings} title="보유종목 TOP 5" compact onSelect={onSelectHolding} />
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-3 rounded-[24px] border border-[#E5EAF0] bg-white p-4 text-left shadow-sm"
        onClick={() => router.push("/analysis")}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
          <Brain className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-black text-[#0F172A]">AI 한눈에 요약</span>
          <span className="mt-1 block truncate text-[12px] font-bold text-[#64748B]">{firstInsight?.description ?? "계좌를 연결하면 투자 요약을 보여드려요."}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#CBD5E1]" />
      </button>
    </div>
  );
}

function TodayMovementCard({ summary }: { summary: MobilePortfolioData["summary"] }) {
  const movement = summary.todayAssetMovement ?? {
    totalChange: 0,
    stockImpact: 0,
    fxImpact: summary.metrics.fxImpactAmount ?? 0,
    dividendImpact: 0
  };

  return (
    <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[18px] font-black text-[#0F172A]">오늘 자산 변동</h2>
      </div>
      <div className="space-y-3">
        <MovementRow label="오늘" value={movement.totalChange} strong />
        <MovementRow label="주가 영향" value={movement.stockImpact} />
        <MovementRow label="환율 영향" value={movement.fxImpact} />
        <MovementRow label="배당 영향" value={movement.dividendImpact} />
      </div>
    </section>
  );
}

function MovementRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  const positive = value >= 0;
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="text-[13px] font-bold text-[#64748B]">{label}</span>
      <span className={`${strong ? "text-[17px]" : "text-[13px]"} numeric overflow-hidden text-ellipsis whitespace-nowrap font-black ${positive ? "text-[#16A34A]" : "text-[#EF4444]"}`}>
        {prefix}
        {Math.abs(Math.round(value)).toLocaleString("ko-KR")}원
      </span>
    </div>
  );
}
