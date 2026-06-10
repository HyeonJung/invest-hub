"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { FearGreedBadge, getFearGreedInsight } from "@/components/fear-greed-badge";
import type { MobilePortfolioData } from "@/components/mobile/mobile-types";
import { cn, formatKrw } from "@/lib/utils";

export function MobileAnalysisPage({ data }: { data: MobilePortfolioData }) {
  const fearGreed = data.marketIndicators?.indicators.find((indicator) => indicator.symbol === "FEAR_GREED");
  const score = Math.max(0, Math.min(100, Math.round(72 + data.summary.metrics.returnRate * 0.3 - data.summary.metrics.fxExposureRate * 0.05)));
  const insights = [
    ...(fearGreed ? [{ type: "info" as const, title: "시장 심리", description: getFearGreedInsight(fearGreed.value) }] : []),
    ...data.summary.aiInsights
  ].slice(0, 4);

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[18px] font-black text-[#0F172A]">AI 한눈에 요약</h2>
            <p className="mt-1 text-[12px] font-bold text-[#64748B]">복잡한 차트 대신 핵심 신호만 보여드려요.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {insights.map((insight) => (
            <div key={`${insight.title}-${insight.description}`} className="flex gap-3 rounded-2xl bg-[#F8FAFC] p-3">
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", insight.type === "warning" ? "bg-[#F59E0B]" : insight.type === "success" ? "bg-[#16A34A]" : "bg-[#2563EB]")} />
              <div className="min-w-0">
                <p className="text-[13px] font-black text-[#0F172A]">{insight.title}</p>
                <p className="mt-1 text-[12px] font-bold leading-5 text-[#64748B]">{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <SmallAnalysisCard icon={CheckCircle2} label="포트폴리오 점수" value={`${score}점`} tone="blue" />
        <SmallAnalysisCard icon={ShieldAlert} label="달러 노출도" value={`${data.summary.metrics.fxExposureRate.toFixed(1)}%`} tone="green" />
      </section>

      {fearGreed ? (
        <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
          <h2 className="text-[18px] font-black text-[#0F172A]">공포탐욕지수</h2>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-[22px] bg-[#F8FAFC] p-4">
            <FearGreedBadge value={fearGreed.value} size="lg" showDescription />
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
        <h2 className="text-[18px] font-black text-[#0F172A]">리밸런싱 추천 요약</h2>
        <div className="mt-4 space-y-3">
          {data.assetAllocation.map((item) => (
            <div key={item.name}>
              <div className="flex items-center justify-between text-[13px] font-black">
                <span className="text-[#64748B]">{item.name}</span>
                <span className="numeric text-[#0F172A]">{(item.rate ?? 0).toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF2F7]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, item.rate ?? 0)}%`, backgroundColor: item.color }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-orange-100 bg-orange-50 p-4 text-orange-800">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-[14px] font-black">위험 알림</p>
            <p className="mt-1 text-[12px] font-bold leading-5">
              총 평가금액은 {formatKrw(data.summary.metrics.totalMarketValue)}입니다. 단일 종목 비중이 높다면 분산 기준을 점검하세요.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SmallAnalysisCard({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: string; tone: "blue" | "green" }) {
  return (
    <div className="rounded-[22px] border border-[#E5EAF0] bg-white p-4 shadow-sm">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tone === "blue" ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#ECFDF5] text-[#16A34A]")}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[12px] font-black text-[#64748B]">{label}</p>
      <p className="numeric mt-1 text-[22px] font-black text-[#0F172A]">{value}</p>
    </div>
  );
}
