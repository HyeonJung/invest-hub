"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { api, type AuthUser, type PriceRefreshResult } from "@/lib/api";
import { useToast } from "@/components/toast-provider";
import { useMarketIndicators } from "@/hooks/use-market-indicators";
import { MobileAnalysisPage } from "@/components/mobile/MobileAnalysisPage";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { MobileDashboard } from "@/components/mobile/MobileDashboard";
import { MobileHoldingList } from "@/components/mobile/MobileHoldingList";
import { MobileAccountList } from "@/components/mobile/MobileAccountList";
import { MobileSettingsPage } from "@/components/mobile/MobileSettingsPage";
import { MobileStockDetailSheet } from "@/components/mobile/MobileStockDetailSheet";
import { MobileTopBar } from "@/components/mobile/MobileTopBar";
import type { MobileAggregatedHolding, MobilePortfolioData, MobileTab, MobileView } from "@/components/mobile/mobile-types";
import {
  assetAllocationFromMobileHoldings,
  buildMobileAccounts,
  buildMobileAggregatedHoldings,
  formatPercentMobile,
  formatSignedKrwMobile,
  metricsFromMobileHoldings
} from "@/components/mobile/mobile-utils";
import { cn, formatKrw } from "@/lib/utils";

const sessionToken = "cookie-session";

export function MobileAppShell({
  initialView = "home",
  accountId,
  desktopRedirect
}: {
  initialView?: MobileView;
  accountId?: string;
  desktopRedirect?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<MobileAggregatedHolding | null>(null);

  useEffect(() => {
    if (!desktopRedirect) return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      router.replace(desktopRedirect);
    }
  }, [desktopRedirect, router]);

  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((nextUser) => {
        if (!alive) return;
        setUser(nextUser);
        setToken(sessionToken);
      })
      .catch(() => {
        if (alive) router.replace("/login");
      })
      .finally(() => {
        if (alive) setSessionChecked(true);
      });

    return () => {
      alive = false;
    };
  }, [router]);

  const summaryQuery = useQuery({
    queryKey: ["summary"],
    queryFn: () => api.summary(token),
    enabled: Boolean(token),
    retry: false
  });
  const marketQuery = useMarketIndicators(token, Boolean(token));
  const priceQuery = useQuery({
    queryKey: ["prices", "refresh", "mobile"],
    queryFn: () => api.refreshPrices(token),
    enabled: Boolean(token),
    refetchInterval: (query) => query.state.data?.refreshIntervalMs ?? 300_000,
    refetchIntervalInBackground: true,
    retry: false
  });
  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSettled: () => {
      queryClient.clear();
      setToken(null);
      setUser(null);
      router.replace("/login");
    }
  });

  useEffect(() => {
    if (priceQuery.data?.refreshedAt) {
      void queryClient.invalidateQueries({ queryKey: ["summary"] });
    }
  }, [priceQuery.data?.refreshedAt, queryClient]);

  const portfolioData = useMemo<MobilePortfolioData | null>(() => {
    const summary = summaryQuery.data;
    if (!summary) return null;

    const accounts = buildMobileAccounts(summary);
    const holdings = buildMobileAggregatedHoldings(summary.holdings);
    const selectedAccount = accountId ? accounts.find((account) => account.id === accountId) ?? null : null;

    return {
      summary,
      accounts,
      holdings,
      assetAllocation: assetAllocationFromMobileHoldings(summary.holdings),
      marketIndicators: marketQuery.data,
      selectedAccount
    };
  }, [accountId, marketQuery.data, summaryQuery.data]);

  const activeTab = tabForView(initialView);

  function openConnect() {
    notify({
      kind: "info",
      title: "계좌 연결",
      description: "모바일에서는 기본 설정만 표시합니다. 상세 API 입력은 설정 관리에서 이어서 진행하세요."
    });
    router.push("/settings");
  }

  if (!sessionChecked || !token) {
    return <MobileLoading label="로그인 세션을 확인하고 있습니다." />;
  }

  if (summaryQuery.isLoading) {
    return <MobileLoading label="투자 데이터를 불러오고 있습니다." />;
  }

  if (summaryQuery.isError) {
    return (
      <MobileFrame active={activeTab} user={user}>
        <MobileError message={(summaryQuery.error as Error).message} onRetry={() => summaryQuery.refetch()} />
      </MobileFrame>
    );
  }

  if (!portfolioData || portfolioData.summary.holdings.length === 0) {
    return (
      <MobileFrame active={activeTab} user={user}>
        <MobileEmptyState onConnect={openConnect} />
      </MobileFrame>
    );
  }

  return (
    <MobileFrame active={activeTab} user={user}>
      <CompactPriceAlert data={priceQuery.data} error={(priceQuery.error as Error | null) ?? null} />
      {initialView === "home" ? (
        <MobileDashboard
          data={portfolioData}
          marketLoading={marketQuery.isFetching}
          marketError={(marketQuery.error as Error | null) ?? null}
          priceStatus={priceQuery.data}
          onSelectHolding={setSelectedHolding}
        />
      ) : null}
      {initialView === "accounts" ? <MobileAccountList accounts={portfolioData.accounts} onConnect={openConnect} /> : null}
      {initialView === "account-detail" ? (
        portfolioData.selectedAccount ? (
          <MobileAccountDetail account={portfolioData.selectedAccount} onSelectHolding={setSelectedHolding} />
        ) : (
          <MobileError message="계좌를 찾을 수 없습니다." onRetry={() => router.replace("/accounts")} />
        )
      ) : null}
      {initialView === "holdings" ? <MobileHoldingList holdings={portfolioData.holdings} onSelect={setSelectedHolding} /> : null}
      {initialView === "analysis" ? <MobileAnalysisPage data={portfolioData} /> : null}
      {initialView === "settings" ? <MobileSettingsPage user={user} accounts={portfolioData.accounts} onLogout={() => logoutMutation.mutate()} onConnect={openConnect} /> : null}
      <MobileStockDetailSheet holding={selectedHolding} onClose={() => setSelectedHolding(null)} />
    </MobileFrame>
  );
}

function MobileFrame({ active, user, children }: { active: MobileTab; user: AuthUser | null; children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#F7F9FC] text-[#0F172A] md:hidden">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[520px] px-4 pb-[calc(88px+env(safe-area-inset-bottom))]">
        <MobileTopBar user={user} />
        <div className="pt-4">{children}</div>
      </div>
      <MobileBottomNav active={active} />
    </main>
  );
}

function MobileAccountDetail({
  account,
  onSelectHolding
}: {
  account: NonNullable<MobilePortfolioData["selectedAccount"]>;
  onSelectHolding: (holding: MobileAggregatedHolding) => void;
}) {
  const holdings = buildMobileAggregatedHoldings(account.holdings);
  const metrics = metricsFromMobileHoldings(account.holdings);
  const positive = metrics.totalProfitLoss >= 0;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[24px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
        <p className="text-[13px] font-black text-[#64748B]">{account.brokerLabel}</p>
        <h2 className="mt-1 truncate text-[22px] font-black text-[#0F172A]">{account.shortName}</h2>
        <p className="numeric mt-5 overflow-hidden text-ellipsis whitespace-nowrap text-[32px] font-black leading-none tracking-[-0.03em] text-[#0F172A]">
          {formatKrw(metrics.totalMarketValue)}
        </p>
        <p className={cn("numeric mt-3 text-[16px] font-black", positive ? "text-[#EF4444]" : "text-[#2563EB]")}>
          {formatSignedKrwMobile(metrics.totalProfitLoss)} ({formatPercentMobile(metrics.returnRate)})
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <AccountMetric label="보유" value={`${holdings.length}개`} />
          <AccountMetric label="달러노출" value={`${metrics.fxExposureRate.toFixed(1)}%`} />
          <AccountMetric label="예상배당" value={formatKrw(metrics.annualDividendEstimate)} />
        </div>
      </section>
      <section className="rounded-[20px] border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-[12px] font-bold leading-5 text-[#2563EB]">
        자동 동기화 상태를 확인하고 있습니다. 수동 동기화는 설정 화면에서 실행할 수 있어요.
      </section>
      <MobileHoldingList holdings={holdings} title="보유종목" onSelect={onSelectHolding} />
    </div>
  );
}

function AccountMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#F8FAFC] p-3">
      <p className="text-[11px] font-black text-[#94A3B8]">{label}</p>
      <p className="numeric mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-black text-[#0F172A]">{value}</p>
    </div>
  );
}

function CompactPriceAlert({ data, error }: { data?: PriceRefreshResult; error: Error | null }) {
  const messages = [error?.message, ...(data?.errors ?? [])].filter(Boolean);
  if (messages.length === 0) return null;

  return (
    <div className="mb-4 flex gap-2 rounded-[18px] border border-orange-100 bg-orange-50 px-3 py-3 text-[12px] font-bold leading-5 text-orange-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>일부 가격 갱신 실패. 마지막 성공 가격 기준으로 표시 중입니다.</p>
    </div>
  );
}

function MobileLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F7F9FC] p-6 md:hidden">
      <div className="flex items-center gap-3 rounded-2xl border border-[#E5EAF0] bg-white px-5 py-4 text-[13px] font-black text-[#0F172A] shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" />
        {label}
      </div>
    </main>
  );
}

function MobileError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="rounded-[24px] border border-red-100 bg-white p-5 text-center shadow-sm">
      <p className="text-[16px] font-black text-[#0F172A]">화면을 불러오지 못했습니다</p>
      <p className="mt-2 text-[13px] font-bold leading-6 text-[#64748B]">{message}</p>
      <button type="button" className="mt-5 h-11 rounded-2xl bg-[#2563EB] px-5 text-[14px] font-black text-white" onClick={onRetry}>
        다시 시도
      </button>
    </section>
  );
}

function MobileEmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-6 text-center shadow-sm">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
        <Plus className="h-6 w-6" />
      </span>
      <p className="mt-4 text-[18px] font-black text-[#0F172A]">연결된 계좌가 없습니다</p>
      <p className="mt-2 text-[13px] font-bold leading-6 text-[#64748B]">계좌를 연결하면 모바일 홈에서 자산과 보유종목을 바로 확인할 수 있어요.</p>
      <button type="button" className="mt-5 h-12 w-full rounded-2xl bg-[#2563EB] text-[14px] font-black text-white" onClick={onConnect}>
        계좌 연결하기
      </button>
    </section>
  );
}

function tabForView(view: MobileView): MobileTab {
  if (view === "account-detail") return "accounts";
  return view;
}
