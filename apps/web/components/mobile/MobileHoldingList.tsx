"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { MobileHoldingItem } from "@/components/mobile/MobileHoldingItem";
import type { MobileAggregatedHolding, MobileHoldingFilter, MobileHoldingSort } from "@/components/mobile/mobile-types";
import { filterAndSortMobileHoldings } from "@/components/mobile/mobile-utils";
import { cn } from "@/lib/utils";

const filters: Array<{ key: MobileHoldingFilter; label: string }> = [
  { key: "ALL", label: "전체" },
  { key: "KR", label: "국내" },
  { key: "US", label: "해외" },
  { key: "ETF", label: "ETF" }
];

const sortOptions: Array<{ key: MobileHoldingSort; label: string }> = [
  { key: "marketValue", label: "평가금액순" },
  { key: "returnRate", label: "수익률순" },
  { key: "profitLoss", label: "손익순" },
  { key: "name", label: "종목명순" }
];

export function MobileHoldingList({
  holdings,
  title = "보유종목",
  compact = false,
  onSelect
}: {
  holdings: MobileAggregatedHolding[];
  title?: string;
  compact?: boolean;
  onSelect: (holding: MobileAggregatedHolding) => void;
}) {
  const [filter, setFilter] = useState<MobileHoldingFilter>("ALL");
  const [sort, setSort] = useState<MobileHoldingSort>("marketValue");
  const visibleHoldings = useMemo(() => filterAndSortMobileHoldings(holdings, filter, sort), [filter, holdings, sort]);
  const list = compact ? visibleHoldings.slice(0, 5) : visibleHoldings;

  return (
    <section className="min-w-0 rounded-[24px] border border-[#E5EAF0] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-black tracking-[-0.01em] text-[#0F172A]">{title}</h2>
        <span className="numeric rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-black text-[#64748B]">{visibleHoldings.length}개</span>
      </div>
      {!compact ? (
        <div className="mb-4 space-y-3">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={cn(
                  "h-9 shrink-0 rounded-full px-4 text-[13px] font-black transition",
                  filter === item.key ? "bg-[#0F172A] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                )}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex h-11 items-center gap-2 rounded-2xl bg-[#F8FAFC] px-3 text-[13px] font-black text-[#64748B]">
            <SlidersHorizontal className="h-4 w-4" />
            <select className="min-w-0 flex-1 bg-transparent text-[#0F172A] outline-none" value={sort} onChange={(event) => setSort(event.target.value as MobileHoldingSort)}>
              {sortOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <div className="divide-y divide-[#F1F5F9]">
        {list.map((holding, index) => (
          <MobileHoldingItem key={holding.id} holding={holding} rank={compact ? index + 1 : undefined} onClick={() => onSelect(holding)} />
        ))}
      </div>
    </section>
  );
}
