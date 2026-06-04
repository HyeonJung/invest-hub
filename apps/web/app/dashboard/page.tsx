"use client";

import { useEffect, useState, type ElementType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Gift,
  Globe2,
  Info,
  Landmark,
  LineChart as LineChartIcon,
  Loader2,
  LogOut,
  Menu,
  PieChart as PieIcon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  Wallet,
  X
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useRouter } from "next/navigation";
import {
  api,
  BrokerKey,
  BrokerPortfolio,
  ChartDatum,
  Holding,
  KiwoomCredentialProfile,
  MarketIndicatorsResult,
  Metric,
  NamuhCredentialProfile,
  NormalizedUploadRow,
  PortfolioSummary,
  PortfolioTargetInput,
  PriceRefreshResult,
  TossCredentialAccount
} from "@/lib/api";
import { cn, formatKrw, formatPercent } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { Input } from "@/components/ui/input";
import {
  buildFearGreedAlerts,
  FEAR_GREED_META,
  FearGreedBadge,
  getFearGreedInsight,
  getFearGreedLevel,
  getFearGreedMeta,
  type FearGreedLevel
} from "@/components/fear-greed-badge";
import {
  DEFAULT_LOSS_STICKER_MODE,
  DEFAULT_PROFIT_STICKER_MODE,
  LossStickerBadge,
  ProfitStickerBadge,
  type LossStickerMode,
  type ProfitStickerMode
} from "@/components/loss-sticker-badge";
import { SecurityLogo } from "@/components/security-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMarketIndicators } from "@/hooks/use-market-indicators";

type StaticViewKey = "overview" | "upload" | "settings" | "ai" | "rebalance" | "dividend" | "tax" | "market" | "alerts";
type AccountViewKey = `account:${string}`;
type ViewKey = StaticViewKey | AccountViewKey;

type AccountNavigationItem = {
  key: AccountViewKey;
  id: string;
  broker: BrokerKey;
  brokerLabel: string;
  accountAlias: string;
  accountType: string;
  displayName: string;
  shortName: string;
  holdings: Holding[];
  marketValue: number;
  profitLoss: number;
  returnRate: number;
  annualDividendEstimate: number;
};

const brokerLabels: Record<BrokerKey, string> = {
  TOSS: "토스증권",
  NAMUH: "나무증권",
  KIWOOM: "키움(영웅문)"
};

const defaultTargets: PortfolioTargetInput[] = [
  { targetType: "ASSET", targetKey: "해외 주식", targetWeight: 55 },
  { targetType: "ASSET", targetKey: "국내 주식", targetWeight: 25 },
  { targetType: "ASSET", targetKey: "ETF", targetWeight: 55 },
  { targetType: "ASSET", targetKey: "개별주", targetWeight: 40 }
];

const lossStickerMode: LossStickerMode = DEFAULT_LOSS_STICKER_MODE;
const profitStickerMode: ProfitStickerMode = DEFAULT_PROFIT_STICKER_MODE;

export default function DashboardPage() {
  const router = useRouter();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [view, setView] = useState<ViewKey>("overview");
  const [priceRefreshInterval, setPriceRefreshInterval] = useState(300_000);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const priceRefreshQuery = useQuery({
    queryKey: ["prices", "refresh"],
    queryFn: () => api.refreshPrices(token),
    enabled: Boolean(token),
    refetchInterval: priceRefreshInterval,
    refetchIntervalInBackground: true,
    retry: false
  });
  const marketIndicatorsQuery = useMarketIndicators(token, Boolean(token));
  const summaryQuery = useQuery({
    queryKey: ["summary"],
    queryFn: () => api.summary(token),
    enabled: Boolean(token),
    retry: false
  });
  const accountNavigation = buildAccountNavigation(summaryQuery.data);
  const selectedAccount = isAccountView(view) ? accountNavigation.find((account) => account.key === view) ?? null : null;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("invest-hub-token");
      if (saved) {
        setToken(saved);
      }
    } finally {
      setSessionChecked(true);
    }
  }, []);

  useEffect(() => {
    if (sessionChecked && !token) {
      router.replace("/login");
    }
  }, [router, sessionChecked, token]);

  useEffect(() => {
    const result = priceRefreshQuery.data;
    if (!result) return;

    setPriceRefreshInterval(result.refreshIntervalMs);

    if (result.refreshedAt) {
      void queryClient.invalidateQueries({ queryKey: ["summary"] });
      void queryClient.invalidateQueries({ queryKey: ["broker"] });
    }
  }, [priceRefreshQuery.data?.refreshedAt, priceRefreshQuery.data?.refreshIntervalMs, queryClient]);

  useEffect(() => {
    const result = marketIndicatorsQuery.data;
    if (!result) return;

    void queryClient.invalidateQueries({ queryKey: ["summary"] });
    void queryClient.invalidateQueries({ queryKey: ["broker"] });
  }, [marketIndicatorsQuery.data?.refreshedAt, marketIndicatorsQuery.data?.nextRefreshIntervalMs, queryClient]);

  useEffect(() => {
    if (isAccountView(view) && summaryQuery.data && !selectedAccount) {
      setView("overview");
      notify({ kind: "info", title: "계좌 목록 갱신", description: "선택한 계좌가 없어져 종합 대시보드로 이동했습니다." });
    }
  }, [notify, selectedAccount, summaryQuery.data, view]);

  if (!sessionChecked) {
    return <LoadingState label="로그인 세션을 확인하고 있습니다." />;
  }

  if (!token) {
    return <SessionRequired onLogin={() => router.replace("/login")} />;
  }

  function navigate(next: ViewKey) {
    setView(next);
    setMobileSidebarOpen(false);
    const account = accountNavigation.find((item) => item.key === next);
    notify({ kind: "info", title: "화면 이동", description: `${account?.displayName ?? navLabel(next)} 화면으로 이동했습니다.` });
  }

  function openConnectModal() {
    setMobileSidebarOpen(false);
    setConnectModalOpen(true);
  }

  function handleConnectChoice(destination: ViewKey | "coming-soon") {
    setConnectModalOpen(false);
    if (destination === "coming-soon") {
      notify({ kind: "info", title: "연동 준비 중", description: "요청한 증권사는 어댑터 설계가 준비되어 있으며, API 문서 확인 후 연결할 수 있습니다." });
      return;
    }
    navigate(destination);
  }

  function refreshPricesNow() {
    void priceRefreshQuery.refetch().then((result) => {
      if (result.error) {
        notify({ kind: "error", title: "현재가 갱신 실패", description: (result.error as Error).message });
        return;
      }

      notify({
        kind: "success",
        title: "현재가 갱신 완료",
        description: `${result.data?.symbolsFetched ?? 0}개 종목 가격을 확인했습니다.`
      });
    });
  }

  return (
    <div className="dashboard-shell flex h-screen w-screen overflow-hidden bg-[#F7F9FC]" data-dashboard-shell>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="사이드바 열기"
      >
        <Menu className="h-5 w-5" />
      </button>
      <aside className="dashboard-sidebar hidden h-screen w-[256px] shrink-0 border-r lg:block" data-sidebar>
        <Sidebar
          active={view}
          accounts={accountNavigation}
          onNavigate={navigate}
          onConnectAccount={openConnectModal}
          onLogout={() => logout(router, notify)}
        />
      </aside>
      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-slate-950/45" onClick={() => setMobileSidebarOpen(false)} aria-label="사이드바 닫기" />
          <aside className="relative h-full w-[256px] border-r border-white/10 bg-[#07111F] shadow-2xl" data-mobile-sidebar>
            <button
              type="button"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="사이드바 닫기"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar
              active={view}
              accounts={accountNavigation}
              onNavigate={navigate}
              onConnectAccount={openConnectModal}
              onLogout={() => logout(router, notify)}
            />
          </aside>
        </div>
      ) : null}
      <main className="dashboard-main min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-7 lg:px-9 2xl:px-10" data-main-content>
        <div className="mx-auto min-w-0 max-w-[1440px] space-y-6">
          {!isAccountView(view) ? (
            <Header
              view={view}
              onChange={navigate}
              onRefresh={refreshPricesNow}
              priceRefreshing={priceRefreshQuery.isFetching}
            />
          ) : null}
          {view !== "overview" && !isAccountView(view) && (priceRefreshQuery.error || (priceRefreshQuery.data?.errors?.length ?? 0) > 0) ? (
            <PriceRefreshStatus
              data={priceRefreshQuery.data}
              loading={priceRefreshQuery.isFetching}
              error={(priceRefreshQuery.error as Error | null) ?? null}
            />
          ) : null}
          {view === "overview" ? (
            <Overview
              token={token}
              onNavigate={navigate}
              marketIndicators={marketIndicatorsQuery.data}
              marketIndicatorsLoading={marketIndicatorsQuery.isFetching}
              marketIndicatorsError={(marketIndicatorsQuery.error as Error | null) ?? null}
              priceStatus={priceRefreshQuery.data}
            />
          ) : null}
          {isAccountView(view) ? (
            summaryQuery.isLoading ? (
              <LoadingState label="계좌 데이터를 불러오고 있습니다." />
            ) : selectedAccount && summaryQuery.data ? (
              <AccountDashboard account={selectedAccount} />
            ) : (
              <EmptyState title="계좌를 찾을 수 없습니다." description="계좌 연결 또는 업로드 후 다시 선택하세요." />
            )
          ) : null}
          {view === "upload" ? <UploadManager token={token} /> : null}
          {view === "settings" ? <SettingsPanel token={token} /> : null}
          {view === "rebalance" ? <RebalancePanel token={token} /> : null}
          {view === "ai" ? <AiPanel token={token} marketIndicators={marketIndicatorsQuery.data} /> : null}
          {view === "dividend" ? <SimpleAnalysisPanel token={token} kind="dividend" /> : null}
          {view === "tax" ? <SimpleAnalysisPanel token={token} kind="tax" /> : null}
          {view === "market" ? (
            <MarketPanel data={marketIndicatorsQuery.data} loading={marketIndicatorsQuery.isFetching} error={(marketIndicatorsQuery.error as Error | null) ?? null} />
          ) : null}
          {view === "alerts" ? <AlertCenterPanel summary={summaryQuery.data} marketIndicators={marketIndicatorsQuery.data} onNavigate={navigate} /> : null}
        </div>
      </main>
      <AccountConnectionModal open={connectModalOpen} onClose={() => setConnectModalOpen(false)} onChoose={handleConnectChoice} />
    </div>
  );
}

function SessionRequired({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Wallet className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-slate-950">로그인이 필요합니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          저장된 로그인 세션을 찾지 못했습니다. 다시 로그인하면 대시보드로 바로 이동합니다.
        </p>
        <Button className="mt-6 w-full" onClick={onLogin}>
          로그인으로 이동
        </Button>
      </section>
    </main>
  );
}

function Sidebar({
  active,
  accounts,
  onNavigate,
  onConnectAccount,
  onLogout
}: {
  active: ViewKey;
  accounts: AccountNavigationItem[];
  onNavigate: (view: ViewKey) => void;
  onConnectAccount: () => void;
  onLogout: () => void;
}) {
  const secondaryItems: Array<{ label: string; icon: ElementType; target: ViewKey; active: boolean; badge?: string }> = [
    { label: "AI 분석", icon: BarChart3, target: "ai", active: active === "ai" },
    { label: "리밸런싱 추천", icon: RefreshCw, target: "rebalance", active: active === "rebalance" },
    { label: "배당 캘린더", icon: Gift, target: "dividend", active: active === "dividend" },
    { label: "세금/절세", icon: CircleDollarSign, target: "tax", active: active === "tax" },
    { label: "시장 지표", icon: Globe2, target: "market", active: active === "market" },
    { label: "알림 센터", icon: Bell, target: "alerts", active: active === "alerts", badge: "3" },
    { label: "업로드 관리", icon: Upload, target: "upload", active: active === "upload" },
    { label: "설정", icon: Settings, target: "settings", active: active === "settings" }
  ];

  return (
    <div className="flex h-full flex-col bg-[#07111F] px-3 py-5 text-[#E5EAF2]">
      <div className="flex h-11 items-center gap-3 px-2">
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_10px_28px_rgba(59,130,246,0.28)]">
          <img src="/favicon.svg" alt="Invest Hub" className="h-8 w-8" />
        </span>
        <span className="text-[17px] font-black tracking-[-0.01em] text-white">INVEST HUB</span>
      </div>
      <nav className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 premium-scrollbar">
        <SidebarNavButton
          label="대시보드"
          icon={BriefcaseBusiness}
          active={active === "overview"}
          onClick={() => onNavigate("overview")}
        />

        <section className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <p className="text-[12px] font-black text-[#94A3B8]">내 계좌</p>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0D1729] text-[#94A3B8] transition hover:bg-[#13223A] hover:text-white"
              onClick={onConnectAccount}
              aria-label="계좌 연결"
              title="계좌 연결"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <AccountTree accounts={accounts} active={active} onNavigate={onNavigate} onConnectAccount={onConnectAccount} />
        </section>

        <section className="space-y-1 border-t border-white/5 pt-4">
          {secondaryItems.map((item) => (
            <SidebarNavButton
              key={item.label}
              label={item.label}
              icon={item.icon}
              active={item.active}
              badge={item.badge}
              onClick={() => onNavigate(item.target)}
            />
          ))}
        </section>
      </nav>
      <div className="mt-5 space-y-2 pb-1">
        <Button className="h-10 w-full justify-start rounded-xl bg-transparent px-3 text-[13px] font-bold text-[#94A3B8] hover:bg-[#13223A] hover:text-white" variant="ghost" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}

function SidebarNavButton({
  label,
  icon: Icon,
  active,
  badge,
  onClick
}: {
  label: string;
  icon: ElementType;
  active: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-bold transition",
        active ? "bg-[#14233B] text-white shadow-[inset_3px_0_0_#3B82F6]" : "text-[#94A3B8] hover:bg-[#13223A] hover:text-[#E5EAF2]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF4D5D] px-1.5 text-[11px] font-black text-white">
          {badge}
        </span>
      ) : null}
    </motion.button>
  );
}

function AccountTree({
  accounts,
  active,
  onNavigate,
  onConnectAccount
}: {
  accounts: AccountNavigationItem[];
  active: ViewKey;
  onNavigate: (view: ViewKey) => void;
  onConnectAccount: () => void;
}) {
  const groups = buildBrokerAccountGroups(accounts);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => readSidebarOpenGroups());

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      for (const group of groups) {
        next[group.broker] = next[group.broker] ?? true;
      }
      return next;
    });
  }, [groups.map((group) => `${group.broker}:${group.accounts.length}`).join("|")]);

  useEffect(() => {
    try {
      window.localStorage.setItem("invest-hub-sidebar-groups", JSON.stringify(openGroups));
    } catch {
      // localStorage persistence is best-effort only.
    }
  }, [openGroups]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-[#0D1729] p-3">
        <p className="text-[13px] font-black text-white">연결된 계좌 없음</p>
        <p className="mt-1 text-[12px] leading-5 text-[#94A3B8]">계좌를 연결하면 이곳에 증권사별로 표시됩니다.</p>
        <button
          type="button"
          className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#14233B] text-[12px] font-black text-[#E5EAF2] transition hover:bg-[#1B2E4D]"
          onClick={onConnectAccount}
        >
          <Plus className="h-4 w-4" />
          계좌 연결하기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const Icon = brokerGroupIcon(group.broker);
        const iconSrc = brokerGroupIconSrc(group.broker);
        const color = brokerColor(group.broker);
        const isOpen = openGroups[group.broker] ?? true;

        return (
          <div key={group.broker} className="space-y-1">
            <button
              type="button"
              className="flex h-9 w-full items-center gap-2 rounded-xl px-2 text-left text-[#E5EAF2] transition hover:bg-[#13223A]"
              onClick={() => setOpenGroups((current) => ({ ...current, [group.broker]: !(current[group.broker] ?? true) }))}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-[0_8px_18px_rgba(0,0,0,0.25)]",
                  iconSrc ? "bg-white p-0.5" : "text-white"
                )}
                style={iconSrc ? undefined : { backgroundColor: color }}
              >
                {iconSrc ? (
                  <img src={iconSrc} alt="" className="h-full w-full object-contain" loading="lazy" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-black">
                {group.label} <span className="font-bold text-[#94A3B8]">({group.accounts.length})</span>
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#64748B] transition-transform duration-200", !isOpen && "-rotate-90")} />
            </button>
            <motion.div
              initial={false}
              animate={isOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-1 pl-2">
                {group.accounts.map((account) => {
                  const isActive = active === account.key;
                  return (
                    <button
                      key={account.key}
                      type="button"
                      className={cn(
                        "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left transition",
                        isActive ? "bg-[#14233B] text-white" : "text-[#94A3B8] hover:bg-[#13223A] hover:text-[#E5EAF2]"
                      )}
                      onClick={() => onNavigate(account.key)}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{account.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        );
      })}
      <button
        type="button"
        className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0D1729] text-[13px] font-black text-[#CBD5E1] transition hover:bg-[#14233B] hover:text-white"
        onClick={onConnectAccount}
      >
        <Plus className="h-4 w-4" />
        계좌 연결하기
      </button>
    </div>
  );
}

function readSidebarOpenGroups() {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem("invest-hub-sidebar-groups");
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function Header({
  view,
  onChange,
  onRefresh,
  priceRefreshing
}: {
  view: ViewKey;
  onChange: (view: ViewKey) => void;
  onRefresh: () => void;
  priceRefreshing: boolean;
}) {
  const isOverview = view === "overview";
  const title = isOverview ? "안녕하세요, 대장님 👋" : navLabel(view);
  const description = isOverview ? "오늘도 성공 투자를 응원합니다!" : "필요한 정보를 간결하게 확인하세요";

  return (
    <header className="min-w-0 overflow-hidden">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-black leading-none tracking-[-0.01em] text-[#0F172A] dark:text-[var(--text-primary)]">{title}</h1>
          <p className="mt-3 text-[15px] font-medium text-[#64748B] dark:text-[var(--text-secondary)]">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <ThemeToggle className="h-10 rounded-full" />
          <button
            className="theme-icon-button relative flex h-10 w-10 items-center justify-center rounded-full transition"
            onClick={() => onChange("alerts")}
            aria-label="알림"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF4D5D] text-[10px] font-black text-white">
              3
            </span>
          </button>
          <Button className="h-10 rounded-xl px-6 text-[14px] font-bold" variant="outline" onClick={onRefresh} disabled={priceRefreshing}>
            {priceRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            2024.06.03 (월)
          </Button>
        </div>
      </div>
    </header>
  );
}

function PriceRefreshStatus({
  data,
  loading,
  error
}: {
  data?: PriceRefreshResult;
  loading: boolean;
  error: Error | null;
}) {
  const messages = [error?.message, ...(data?.errors ?? [])].filter(Boolean);
  const isOpen = data?.marketSession.session === "OPEN";

  return (
    <section className="mb-5 space-y-2" aria-live="polite">
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-black text-[var(--text-primary)]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            현재가 자동 갱신
          </span>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", isOpen ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]")}>
            {data?.marketSession.label ?? "상태 확인 중"}
          </span>
          <span className="text-[var(--text-secondary)]">마지막 성공 {formatDateTime(data?.lastSuccessAt)}</span>
          <span className="text-[var(--text-secondary)]">주기 {formatInterval(data?.refreshIntervalMs)}</span>
        </div>
        <div className="text-xs font-semibold text-[var(--text-muted)]">
          조회 {data?.symbolsRequested ?? 0}개 · 반영 {data?.holdingsUpdated ?? 0}건 · {data?.source ?? "가격 소스 준비 중"}
        </div>
      </div>
      {messages.length > 0 ? (
        <div className="flex gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 shadow-[0_10px_28px_rgba(251,146,60,0.12)] dark:border-orange-400/25 dark:bg-orange-500/10 dark:text-orange-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500 dark:text-orange-300" />
          <div>
            <p className="font-black text-orange-950 dark:text-orange-100">현재가 갱신 일부 실패</p>
            <p className="mt-1 font-medium text-orange-700 dark:text-orange-100">{messages.join(" ")}</p>
            <p className="mt-1 text-xs font-medium text-orange-600 dark:text-orange-200">마지막 성공 가격을 유지한 상태로 화면을 표시합니다.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AccountConnectionModal({
  open,
  onClose,
  onChoose
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (destination: ViewKey | "coming-soon") => void;
}) {
  if (!open) return null;

  const choices: Array<{
    label: string;
    description: string;
    icon: ElementType;
    destination: ViewKey | "coming-soon";
    badge?: string;
  }> = [
    { label: "토스증권", description: "Open API 키 저장 후 계좌와 보유종목을 동기화합니다.", icon: Wallet, destination: "settings", badge: "지원" },
    { label: "나무증권", description: "WMCA 브리지/API 설정 후 여러 계좌를 등록합니다.", icon: PieIcon, destination: "settings", badge: "지원" },
    { label: "키움증권", description: "실전/모의 App Key를 등록하고 계좌를 조회합니다.", icon: BarChart3, destination: "settings", badge: "지원" },
    { label: "한국투자", description: "향후 Broker Adapter로 추가될 증권사입니다.", icon: Building2, destination: "coming-soon" },
    { label: "미래에셋", description: "CMA, ISA, 연금 계좌 연결 확장을 고려한 슬롯입니다.", icon: Landmark, destination: "coming-soon" },
    { label: "신한투자", description: "API 문서 확인 후 연결 플로우를 추가할 수 있습니다.", icon: ShieldCheck, destination: "coming-soon" },
    { label: "삼성증권", description: "국내/해외 주식 계좌 연동 후보입니다.", icon: BriefcaseBusiness, destination: "coming-soon" },
    { label: "CSV 업로드", description: "API 연결 전 백업 수단으로 보유종목 파일을 올립니다.", icon: FileSpreadsheet, destination: "upload", badge: "Fallback" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <motion.section
        className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-[var(--card-border)] bg-[var(--surface)] shadow-[0_30px_100px_rgba(15,23,42,0.22)]"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--card-border)] p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-500">Account Connection</p>
            <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">계좌 연결</h2>
            <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
              API 연결, 계좌 조회, 계좌 선택, 최초 동기화 흐름으로 내 계좌 트리에 자동 추가됩니다.
            </p>
          </div>
          <button
            type="button"
            className="theme-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition"
            onClick={onClose}
            aria-label="계좌 연결 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-3 p-6 sm:grid-cols-2">
          {choices.map((choice) => {
            const Icon = choice.icon;
            return (
              <button
                key={choice.label}
                type="button"
                className="group rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-[var(--surface-hover)]"
                onClick={() => onChoose(choice.destination)}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-black text-[var(--text-primary)]">{choice.label}</span>
                      {choice.badge ? (
                        <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-black text-[var(--text-secondary)]">{choice.badge}</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{choice.description}</span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 text-[var(--text-muted)] transition group-hover:text-blue-500" />
                </div>
              </button>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}

function MarketPanel({
  data,
  loading,
  error
}: {
  data?: MarketIndicatorsResult;
  loading: boolean;
  error: Error | null;
}) {
  const fearGreed = findFearGreedIndicator(data);

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <section className="hero-card rounded-[28px] p-6">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-500">Market Radar</p>
        <h2 className="mt-2 text-3xl font-black text-[var(--text-primary)]">시장 지표</h2>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">환율, 금리, 원자재, 지수, 비트코인을 한 화면에서 봅니다.</p>
      </section>
      <MarketIndicatorsWidget data={data} loading={loading} error={error} />
      {fearGreed ? <FearGreedDetailCard indicator={fearGreed} /> : null}
    </motion.div>
  );
}

function AlertCenterPanel({
  summary,
  marketIndicators,
  onNavigate
}: {
  summary?: PortfolioSummary;
  marketIndicators?: MarketIndicatorsResult;
  onNavigate: (view: ViewKey) => void;
}) {
  const topHolding = summary?.topHoldings[0];
  const fxExposure = summary?.metrics.fxExposureRate ?? 0;
  const dividend = summary?.metrics.annualDividendEstimate ?? 0;
  const fearGreed = findFearGreedIndicator(marketIndicators);
  const fearGreedAlerts = fearGreed ? buildFearGreedAlerts(fearGreed.value, fearGreed.change).map((alert) => ({ ...alert, action: "market" as ViewKey })) : [];
  const alerts = [
    ...fearGreedAlerts,
    {
      title: topHolding ? `${topHolding.symbol} 비중 확인` : "상위 종목 비중 확인",
      description: topHolding ? `${topHolding.name} 평가금액이 ${formatKrw(topHolding.marketValue)}입니다.` : "계좌를 연결하면 집중도 알림을 계산합니다.",
      action: "ai" as ViewKey,
      tone: "red"
    },
    {
      title: "달러 노출도",
      description: `${fxExposure.toFixed(1)}% USD 기준입니다. 환율 민감도를 확인하세요.`,
      action: "market" as ViewKey,
      tone: "blue"
    },
    {
      title: "배당 추정 증가",
      description: `연간 예상 배당은 ${formatKrw(dividend)}입니다.`,
      action: "dividend" as ViewKey,
      tone: "green"
    }
  ];

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <section className="hero-card rounded-[28px] p-6">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-500">Alert Center</p>
        <h2 className="mt-2 text-3xl font-black text-[var(--text-primary)]">알림 센터</h2>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">계좌 중심으로 집중도, 환율, 배당 이벤트를 모아봅니다.</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        {alerts.map((alert) => (
          <button
            key={alert.title}
            type="button"
            className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--surface-hover)]"
            onClick={() => onNavigate(alert.action)}
          >
            <span
              className={cn(
                "mb-4 block h-2 w-2 rounded-full",
                alert.tone === "red" && "bg-red-400",
                alert.tone === "blue" && "bg-blue-400",
                alert.tone === "green" && "bg-emerald-400",
                alert.tone === "orange" && "bg-orange-400"
              )}
            />
            <p className="text-base font-black text-[var(--text-primary)]">{alert.title}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{alert.description}</p>
            <p className="mt-4 flex items-center gap-1 text-xs font-black text-blue-300">
              자세히 보기 <ChevronRight className="h-4 w-4" />
            </p>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Overview({
  token,
  onNavigate,
  marketIndicators,
  marketIndicatorsLoading,
  marketIndicatorsError,
  priceStatus
}: {
  token: string;
  onNavigate: (view: ViewKey) => void;
  marketIndicators?: MarketIndicatorsResult;
  marketIndicatorsLoading: boolean;
  marketIndicatorsError: Error | null;
  priceStatus?: PriceRefreshResult;
}) {
  const query = useQuery({
    queryKey: ["summary"],
    queryFn: () => api.summary(token)
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  if (!query.data || query.data.holdings.length === 0) {
    return <EmptyState title="아직 연결된 계좌가 없습니다." description="토스증권을 연동하거나 나무·키움 파일을 업로드하세요." />;
  }

  const data = query.data;

  return (
    <motion.div
      className="min-w-0 space-y-6"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="min-w-0 space-y-6">
        <OverviewHero data={data} />
        <MarketIndicatorsWidget data={marketIndicators} loading={marketIndicatorsLoading} error={marketIndicatorsError} onMore={() => onNavigate("market")} mode="overview" />
        <section className="grid min-w-0 gap-5 xl:grid-cols-2 min-[1440px]:grid-cols-3">
          <AllocationCard title="자산 구성 비중" data={assetAllocationFromHoldings(data.holdings)} center={formatKrw(data.metrics.totalMarketValue)} />
          <AccountValueCards data={data.accountValues} />
          <TopHoldings data={data} onNavigate={onNavigate} />
        </section>
        <p className="flex min-w-0 items-center justify-between gap-4 px-1 text-[12px] font-medium text-[#94A3B8]">
          <span className="truncate">데이터 제공: {priceStatus?.source ?? marketIndicators?.indicators[0]?.source ?? "실시간"}</span>
          <span className="numeric shrink-0">{formatHeaderTime(priceStatus?.lastSuccessAt ?? marketIndicators?.lastSuccessAt)} 기준</span>
        </p>
      </div>
    </motion.div>
  );
}

function AccountDashboard({ account }: { account: AccountNavigationItem }) {
  const metrics = metricsFromHoldings(account.holdings);

  return (
    <motion.div className="min-w-0 space-y-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: "easeOut" }}>
      <TossStyleHoldingsList title={`${account.displayName} 내 투자`} holdings={account.holdings} metrics={metrics} scope="account" />
    </motion.div>
  );
}

function OverviewHero({ data }: { data: PortfolioSummary }) {
  const [selectedRange, setSelectedRange] = useState("1W");
  const movement = data.todayAssetMovement ?? {
    stockImpact: 0,
    fxImpact: data.metrics.fxImpactAmount ?? 0,
    dividendImpact: 0,
    totalChange: data.metrics.fxImpactAmount ?? 0
  };
  const profitTone = data.metrics.totalProfitLoss >= 0 ? "text-[#EF4444]" : "text-[#3B82F6]";
  const todayTone = movement.totalChange >= 0 ? "text-[#16A34A]" : "text-[#EF4444]";
  const heroChart = buildHeroChartData(data.metrics.totalMarketValue, movement.totalChange);
  const values = heroChart.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.15 || Math.max(1, max * 0.05);
  const todayRate = (movement.totalChange / Math.max(1, data.metrics.totalMarketValue - movement.totalChange)) * 100;

  return (
    <motion.div
      className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
      data-hero-section
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <section className="hero-card min-h-[280px] min-w-0 overflow-hidden rounded-[20px] border border-[#E5EAF0] bg-white p-6 shadow-sm" data-hero-card>
        <div className="grid h-full min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col justify-between overflow-hidden py-1" data-hero-summary>
            <div className="min-w-0">
              <p className="text-[16px] font-black text-[#0F172A]">내 총 자산</p>
              <p className="numeric mt-12 block min-w-[320px] max-w-full overflow-hidden text-[44px] font-black leading-none tracking-[-0.04em] text-[#0F172A]" data-hero-asset-value>
                <AnimatedKrw value={data.metrics.totalMarketValue} />
              </p>
              <div className="mt-5 flex max-w-full items-end gap-3 overflow-hidden" data-hero-profit-row>
                <p className={cn("numeric min-w-[184px] overflow-hidden text-[22px] font-black leading-none", profitTone)}>
                  {formatSignedKrw(data.metrics.totalProfitLoss)}
                </p>
                <p className={cn("numeric shrink-0 text-[20px] font-black leading-none", profitTone)}>({formatPercent(data.metrics.returnRate)})</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-[13px]">
              <span className="font-bold text-[#64748B]">전일 대비</span>
              <span className={cn("numeric font-black", todayRate >= 0 ? "text-[#16A34A]" : "text-[#EF4444]")}>
                {todayRate >= 0 ? "↗ " : "↘ "}
                {formatPercent(todayRate)}
              </span>
            </div>
          </div>

          <div className="relative min-h-[220px] min-w-0 overflow-hidden" data-hero-chart>
            <div className="absolute right-0 top-0 z-10 flex items-center gap-1 text-[13px] font-bold text-[#475569]">
              {["1D", "1W", "1M", "3M", "1Y"].map((range) => (
                <button
                  key={range}
                  type="button"
                  className={cn(
                    "h-8 rounded-lg px-3 transition",
                    selectedRange === range ? "bg-[#EFF6FF] text-[#2563EB] shadow-sm ring-1 ring-[#D9E7FF]" : "text-[#475569] hover:bg-[#F1F5F9]"
                  )}
                  onClick={() => setSelectedRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
            <div className="h-[220px] min-w-0 pt-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={heroChart} margin={{ top: 12, right: 10, bottom: 8, left: 10 }}>
                  <defs>
                    <linearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" hide />
                  <YAxis hide domain={[min - padding, max + padding]} />
                  <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} fill="url(#assetGradient)" dot={false} activeDot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <section className="hero-card min-h-[280px] min-w-0 overflow-hidden rounded-[20px] border border-[#E5EAF0] bg-white p-7 shadow-sm" data-today-change-card>
        <p className="text-[18px] font-black text-[#0F172A]">오늘 자산 변동</p>
        <p className={cn("numeric mt-7 block max-w-full overflow-hidden text-[30px] font-black leading-none", todayTone)}>{formatSignedKrw(movement.totalChange)}</p>
        <p className={cn("numeric mt-3 block text-[15px] font-black", todayTone)}>({formatPercent(todayRate)})</p>
        <div className="mt-7 space-y-4 text-[13px]">
          <HeroMovementRow label="주가 영향" value={movement.stockImpact} />
          <HeroMovementRow label="환율 영향" value={movement.fxImpact} />
          <HeroMovementRow label="배당 영향" value={movement.dividendImpact} />
        </div>
        <p className="mt-7 text-[13px] font-medium text-[#64748B]">조회 시간 {formatHeaderTime(new Date().toISOString())} 기준</p>
      </section>
    </motion.div>
  );
}

function HeroMovementRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 overflow-hidden">
      <span className="min-w-0 truncate font-normal text-[var(--text-secondary)]">{label}</span>
      <span className={cn("numeric min-w-[116px] shrink-0 overflow-hidden text-right font-semibold", value >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>{formatSignedKrw(value)}</span>
    </div>
  );
}

function AnimatedKrw({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 700;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{formatKrw(displayValue)}</>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  caption,
  tone
}: {
  icon: ElementType;
  label: string;
  value: string;
  caption: string;
  tone: "blue" | "red" | "purple" | "green";
}) {
  const toneClass = {
    blue: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
    red: "bg-red-500/15 text-red-600 dark:text-red-300",
    purple: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
    green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
  }[tone];
  return (
    <Card className="relative p-5">
      <div className="flex min-w-0 items-start gap-4">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 overflow-hidden">
          <p className="text-sm font-bold text-[var(--text-secondary)]">{label}</p>
          <p className="numeric mt-2 block min-w-[178px] max-w-full overflow-hidden text-ellipsis text-xl font-black text-[var(--text-primary)] xl:text-2xl">{value}</p>
          <p className={cn("mt-2 truncate text-sm", tone === "red" ? "text-red-600 dark:text-red-300" : "text-[var(--text-secondary)]")}>{caption}</p>
        </div>
      </div>
    </Card>
  );
}

function MarketIndicatorsWidget({
  data,
  loading,
  error,
  onMore,
  mode = "full"
}: {
  data?: MarketIndicatorsResult;
  loading: boolean;
  error: Error | null;
  onMore?: () => void;
  mode?: "overview" | "full";
}) {
  const indicators = mode === "overview" ? selectDashboardMarketIndicators(data?.indicators ?? []) : sortMarketIndicators(data?.indicators ?? []);
  const delayedCount = indicators.filter((indicator) => indicator.isDelayed).length;
  const messages = [error?.message, ...(data?.errors ?? [])].filter(Boolean);
  const skeletonCount = mode === "overview" ? 6 : 7;

  return (
    <section className="market-widget min-w-0 overflow-hidden rounded-[20px] border border-[#E5EAF0] bg-white p-5 shadow-sm" data-market-widget>
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-black leading-none text-[#0F172A] dark:text-[var(--text-primary)]">시장 주요 지표</h2>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[12px] font-bold text-[#64748B] dark:text-[var(--text-secondary)]">
          {mode === "full" ? <span className="numeric">{formatHeaderTime(data?.lastSuccessAt)} 기준</span> : null}
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#3B82F6]" /> : <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />}
          <button className="flex h-8 items-center gap-1 rounded-lg border border-[#E5EAF0] bg-white px-3 text-[12px] font-bold text-[#64748B] shadow-sm transition hover:bg-[#F8FAFC] hover:text-[#0F172A]" onClick={onMore ?? (() => alert("시장 지표 화면에서 전체 지표를 확인할 수 있습니다."))}>
            전체 보기
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {mode === "full" && messages.length > 0 ? (
        <div className="mt-3 flex gap-2 rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-700 dark:text-orange-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-black">시장 지표 갱신 지연</p>
            <p className="mt-1">{messages.join(" ")}</p>
          </div>
        </div>
      ) : null}
      {indicators.length === 0 ? (
        <div className={cn("min-w-0 gap-3", mode === "overview" ? "grid sm:grid-cols-2 xl:grid-cols-3 min-[1400px]:grid-cols-6" : "flex overflow-x-auto pb-1 premium-scrollbar")}>
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <div key={index} className={cn("h-[88px] animate-pulse rounded-[14px] border border-[#E5EAF0] bg-[#F8FAFC]", mode === "full" && "w-[156px] shrink-0")} />
          ))}
        </div>
      ) : (
        <div className={cn("w-full min-w-0 gap-3", mode === "overview" ? "grid sm:grid-cols-2 xl:grid-cols-3 min-[1400px]:grid-cols-6" : "flex overflow-x-auto pb-1 premium-scrollbar")} data-market-strip>
          {indicators.map((indicator) => (
            <MarketIndicatorCard key={indicator.symbol} indicator={indicator} className={mode === "overview" ? "w-full" : "w-[156px] shrink-0"} />
          ))}
        </div>
      )}
    </section>
  );
}

function MarketIndicatorCard({ indicator, className }: { indicator: MarketIndicatorsResult["indicators"][number]; className?: string }) {
  if (indicator.symbol === "FEAR_GREED") {
    return <FearGreedMarketIndicatorCard indicator={indicator} />;
  }

  const positive = indicator.changeRate > 0;
  const negative = indicator.changeRate < 0;
  const changePrefix = positive ? "+" : negative ? "-" : "";
  const sparklineData = buildIndicatorSparklineData(indicator);

  return (
    <motion.div
      className={cn("market-indicator-card relative h-[88px] overflow-hidden rounded-[14px] border border-[#E5EAF0] bg-white p-3.5 shadow-none", className)}
      data-market-indicator-card
      whileHover={{ y: -2, backgroundColor: "#F8FAFC" }}
      transition={{ duration: 0.18 }}
    >
      <div className="relative z-10 min-w-0">
        <p className="truncate text-[12px] font-bold uppercase leading-4 text-[#64748B]">{compactIndicatorName(indicator.name, indicator.symbol)}</p>
        <p className="numeric mt-1 block max-w-[118px] overflow-hidden text-ellipsis text-[18px] font-black leading-[21px] text-[#0F172A]">{formatMarketIndicatorValue(indicator)}</p>
        <p className={cn("numeric mt-1 max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-black leading-4", positive ? "text-[#EF4444]" : negative ? "text-[#2563EB]" : "text-[#64748B]")}>
          {changePrefix}{Math.abs(indicator.changeRate).toFixed(2)}%
        </p>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 h-[30px] w-[70px] overflow-hidden" data-market-sparkline>
        <Sparkline data={sparklineData} positive={indicator.changeRate >= 0} />
      </div>
    </motion.div>
  );
}

function FearGreedMarketIndicatorCard({ indicator }: { indicator: MarketIndicatorsResult["indicators"][number] }) {
  const meta = getFearGreedMeta(indicator.value);
  const isStale = indicator.isDelayed || indicator.status === "DELAYED";

  return (
    <motion.div
      className="market-indicator-card relative h-[92px] w-[172px] shrink-0 overflow-hidden rounded-xl border"
      data-market-indicator-card
      data-fear-greed-card
      whileHover={{ y: -2, backgroundColor: "var(--surface-hover)" }}
      transition={{ duration: 0.18 }}
      style={{
        borderColor: `${meta.color}32`,
        backgroundColor: "var(--surface)"
      }}
    >
      <div className="relative z-10 flex h-full min-w-0 items-center gap-2 p-3">
        <FearGreedBadge value={indicator.value} size="sm" showValue={false} showLabel={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-4 text-[var(--text-secondary)]">공포탐욕지수</p>
          <div className="mt-1 flex min-w-0 items-end gap-1.5">
            <p className="numeric text-[22px] font-black leading-none text-[var(--text-primary)]">{Math.round(indicator.value)}</p>
            <p className="truncate text-[12px] font-black leading-4" style={{ color: meta.color }}>
              {meta.labelKo}
            </p>
          </div>
          <p className="mt-1 truncate text-[10px] font-semibold text-[var(--text-secondary)]">
            {isStale ? "마지막 성공 값 유지" : `업데이트 ${formatHeaderTime(indicator.lastUpdatedAt)}`}
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-7 -top-8 h-24 w-24 rounded-full opacity-60" style={{ backgroundColor: meta.softColor }} />
    </motion.div>
  );
}

function FearGreedDetailCard({ indicator }: { indicator: MarketIndicatorsResult["indicators"][number] }) {
  const value = Math.max(0, Math.min(100, indicator.value));
  const meta = getFearGreedMeta(value);
  const level = getFearGreedLevel(value);
  const levels = Object.keys(FEAR_GREED_META) as FearGreedLevel[];

  return (
    <Card className="overflow-hidden" data-fear-greed-detail>
      <CardHeader>
        <div>
          <CardTitle>공포탐욕지수</CardTitle>
          <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">{indicator.source} 기준 시장 심리</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-black" style={{ backgroundColor: meta.softColor, color: meta.color }}>
          {meta.range}
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0 rounded-2xl p-4" style={{ backgroundColor: meta.softColor }}>
            <FearGreedBadge value={value} size="lg" showDescription className="justify-center" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-black text-[var(--text-secondary)]">현재 단계</p>
                <p className="mt-1 truncate text-2xl font-black text-[var(--text-primary)]">{meta.labelKo}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{getFearGreedInsight(value)}</p>
              </div>
              <p className="numeric shrink-0 text-[44px] font-black leading-none" style={{ color: meta.color }}>
                {Math.round(value)}
              </p>
            </div>
            <div className="mt-5">
              <div className="relative h-3 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: meta.color }} />
              </div>
              <div className="mt-2 grid grid-cols-5 text-center text-[11px] font-black text-[var(--text-muted)]">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-5">
              {levels.map((item) => {
                const itemMeta = FEAR_GREED_META[item];
                const active = item === level;
                return (
                  <div
                    key={item}
                    className={cn("min-w-0 rounded-xl border px-2 py-2 text-center", active ? "border-transparent" : "border-[var(--card-border)] bg-[var(--surface)]")}
                    style={active ? { backgroundColor: itemMeta.softColor, color: itemMeta.color } : undefined}
                  >
                    <p className="truncate text-[11px] font-black">{itemMeta.labelKo}</p>
                    <p className="numeric mt-1 text-[10px] font-semibold opacity-80">{itemMeta.range}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type SparklineProps = {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
};

function Sparkline({ data, positive = true, width = 70, height = 30 }: SparklineProps) {
  if (!data || data.length < 2) {
    return <div className="h-[30px] w-[70px]" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 3;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });
  const color = positive ? "#EF4444" : "#2563EB";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TodayAssetMovementCard({ data }: { data: PortfolioSummary }) {
  const movement = data.todayAssetMovement ?? {
    stockImpact: 0,
    fxImpact: data.metrics.fxImpactAmount ?? 0,
    dividendImpact: 0,
    totalChange: data.metrics.fxImpactAmount ?? 0
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>오늘 자산 변동</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-3 md:grid-cols-4">
          <MovementCell label="주가 영향" value={movement.stockImpact} />
          <MovementCell label="환율 영향" value={movement.fxImpact} />
          <MovementCell label="배당 영향" value={movement.dividendImpact} />
          <MovementCell label="총 변동" value={movement.totalChange} strong />
        </div>
      </CardContent>
    </Card>
  );
}

function MovementCell({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl bg-[var(--surface-subtle)] p-4", strong && "bg-blue-500/10")}>
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={cn("numeric mt-2 overflow-hidden text-lg font-black", value >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-blue-600 dark:text-blue-300", strong && "text-2xl")}>
        {formatSignedKrw(value)}
      </p>
    </div>
  );
}

function AllocationCard({ title, data, center }: { title: string; data: PortfolioSummary["assetAllocation"]; center: string }) {
  return (
    <Card className="min-h-[360px] overflow-hidden rounded-[20px] border-[#E5EAF0] bg-white shadow-sm">
      <CardHeader>
        <div>
          <CardTitle className="text-[18px] font-black text-[#0F172A]">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 pt-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
        <div className="relative h-[210px] min-w-0 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} innerRadius={54} outerRadius={88} dataKey="value" paddingAngle={2} animationDuration={900}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatKrw(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[12px] font-bold text-[#64748B]">총 자산</p>
            <p className="numeric mt-1 max-w-[132px] overflow-hidden text-ellipsis text-[13px] font-black text-[#0F172A]">{center}</p>
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          {data.map((item) => (
            <div key={item.name} className="min-w-0 overflow-hidden">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-[#64748B]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="numeric shrink-0 text-right text-[16px] font-black text-[#0F172A]">
                  {(item.rate ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, item.rate ?? 0)}%`, backgroundColor: item.color }} />
              </div>
            </div>
          ))}
        </div>
        <Button className="h-10 rounded-xl text-[13px] font-bold md:col-span-2" variant="outline" onClick={() => alert("자산 구성 상세 화면에서 확인할 수 있습니다.")}>
          자산 구성 자세히 보기
        </Button>
      </CardContent>
    </Card>
  );
}

function AccountValueCards({ data }: { data: PortfolioSummary["accountValues"] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="min-h-[360px] rounded-[20px] border-[#E5EAF0] bg-white shadow-sm">
      <CardHeader>
        <div>
          <CardTitle className="text-[18px] font-black text-[#0F172A]">계좌별 평가금액</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 pt-2">
        {data.map((item, index) => {
          const rate = total > 0 ? (item.value / total) * 100 : item.rate ?? 0;
          const displayName = cleanDisplayName(item.name);
          return (
            <motion.div
              key={item.name}
              className="min-w-0 overflow-hidden rounded-xl bg-white p-2 transition hover:bg-[#F8FAFC]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
              whileHover={{ y: -2 }}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[0_10px_22px_rgba(15,23,42,0.13)]" style={{ backgroundColor: item.color }}>
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-[#0F172A]">{displayName}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="numeric max-w-[150px] overflow-hidden text-ellipsis text-[16px] font-black text-[#0F172A]">{formatKrw(item.value)}</p>
                  <p className="numeric mt-1 text-[11px] font-bold text-[#64748B]">{rate.toFixed(1)}%</p>
                </div>
              </div>
              <div className="ml-12 mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: item.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, rate)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          );
        })}
        <Button className="mt-2 h-10 w-full rounded-xl text-[13px] font-bold" variant="outline" onClick={() => alert("계좌 관리 화면으로 이동합니다.")}>
          계좌 관리
        </Button>
      </CardContent>
    </Card>
  );
}

function ReturnBarCard({ data, average }: { data: PortfolioSummary["accountReturns"]; average: number }) {
  const displayData = data.map((item) => ({ ...item, name: cleanDisplayName(item.name) }));

  return (
    <Card className="min-h-[314px]">
      <CardHeader>
        <CardTitle>계좌별 수익률 비교</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="h-[222px] min-w-0 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={displayData}>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.10)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 12, fontWeight: 400 }} />
              <YAxis tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
              <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
              <Bar dataKey="value" radius={[8, 8, 3, 3]} barSize={46} animationDuration={900}>
                {displayData.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-right text-[12px] font-normal text-[#94A3B8]">전체 평균 <span className="numeric font-semibold text-[#3B82F6]">{formatPercent(average)}</span></p>
      </CardContent>
    </Card>
  );
}

type HoldingSortKey = "value" | "weight" | "return";

type AggregatedHolding = {
  key: string;
  securityId: string;
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  assetType: string;
  logoUrl: string | null;
  companyDomain: string | null;
  logoSource: string;
  totalQuantity: number;
  marketValue: number;
  costAmount: number;
  profitLoss: number;
  profitLossRate: number;
  portfolioWeight: number;
  brokerCount: number;
  accountCount: number;
  brokers: BrokerKey[];
  accounts: Array<{
    id: string;
    broker: BrokerKey;
    accountAlias: string;
    accountType: string;
    quantity: number;
    marketValue: number;
    profitLoss: number;
    profitLossRate: number;
    weightWithinHolding: number;
  }>;
};

function AggregatedHoldingsList({ data }: { data: PortfolioSummary }) {
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<HoldingSortKey>("value");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const holdings = buildAggregatedHoldings(data, searchText, sortKey);

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <CardTitle>보유종목 리스트</CardTitle>
            <p className="mt-2 text-sm font-semibold text-slate-500">종목 단위 합산 · 다중 증권사 보유 · 계좌별 수량 분해</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={searchText}
                placeholder="종목명 또는 티커 검색"
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>
            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              <Button size="sm" variant={sortKey === "value" ? "secondary" : "ghost"} onClick={() => setSortKey("value")}>
                금액
              </Button>
              <Button size="sm" variant={sortKey === "weight" ? "secondary" : "ghost"} onClick={() => setSortKey("weight")}>
                비중
              </Button>
              <Button size="sm" variant={sortKey === "return" ? "secondary" : "ghost"} onClick={() => setSortKey("return")}>
                수익률
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {holdings.length === 0 ? (
          <EmptyState title="검색 결과가 없습니다." description="다른 종목명이나 티커로 다시 검색하세요." />
        ) : (
          <div className="divide-y divide-slate-100">
            {holdings.map((holding) => {
              const expanded = expandedKey === holding.key;
              return (
                <div key={holding.key} className="py-3">
                  <button
                    className="grid w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl p-2 text-left transition hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_190px_170px]"
                    onClick={() => setExpandedKey(expanded ? null : holding.key)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SecurityLogo
                        symbol={holding.symbol}
                        name={holding.name}
                        logoUrl={holding.logoUrl}
                        marketCountry={holding.marketCountry}
                        size="sm"
                        showCountryBadge
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-black text-slate-950">{holding.symbol}</p>
                          <LossStickerBadge profitLossRate={holding.profitLossRate} mode={lossStickerMode} />
                          <ProfitStickerBadge profitLossRate={holding.profitLossRate} mode={profitStickerMode} />
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
                            {holding.marketCountry === "US" ? "미국" : "국내"}
                          </span>
                          {holding.brokerCount > 1 ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700">
                              {holding.brokerCount}개 증권사
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{holding.name}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          총 {formatQuantity(holding.totalQuantity)}주 · {holding.accountCount}개 계좌
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-500">전체 비중</span>
                        <span className="numeric text-slate-950">{holding.portfolioWeight.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, holding.portfolioWeight)}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {holding.brokers.map((broker) => (
                          <span key={broker} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                            {brokerLabels[broker]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3 md:justify-end">
                      <div className="min-w-0 text-right">
                        <p className="numeric max-w-full overflow-hidden text-ellipsis text-base font-black text-slate-950">{formatKrw(holding.marketValue)}</p>
                        <p className={cn("numeric mt-1 max-w-full overflow-hidden text-ellipsis text-sm font-black", holding.profitLoss >= 0 ? "text-red-500" : "text-blue-500")}>
                          {formatSignedKrw(holding.profitLoss)} ({formatPercent(holding.profitLossRate)})
                        </p>
                      </div>
                      <ChevronRight className={cn("h-5 w-5 shrink-0 text-slate-400 transition", expanded && "rotate-90")} />
                    </div>
                  </button>
                  {expanded ? <AccountBreakdown holding={holding} /> : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountBreakdown({ holding }: { holding: AggregatedHolding }) {
  return (
    <div className="ml-0 mt-2 rounded-xl bg-slate-50 p-3 md:ml-14">
      <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-500">
        <span>계좌별 수량 분해</span>
        <span>{holding.accountCount}개 계좌</span>
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        {holding.accounts.map((account) => (
          <div key={account.id} className="rounded-lg bg-white p-3 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950">{account.accountAlias}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {brokerLabels[account.broker]} · {accountTypeLabel(account.accountType)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="numeric text-sm font-black text-slate-950">{formatQuantity(account.quantity)}주</p>
                <p className="numeric mt-1 text-xs font-bold text-slate-500">{account.weightWithinHolding.toFixed(1)}%</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="font-semibold text-slate-400">평가금액</p>
                <p className="numeric mt-1 overflow-hidden text-ellipsis font-black text-slate-900">{formatKrw(account.marketValue)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-400">손익</p>
                <p className={cn("numeric mt-1 overflow-hidden text-ellipsis font-black", account.profitLoss >= 0 ? "text-red-500" : "text-blue-500")}>
                  {formatSignedKrw(account.profitLoss)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type TossHoldingSortKey = "return" | "value" | "profit" | "name";
type TossHoldingValueMode = "value" | "price";
type TossHoldingScope = "overview" | "broker" | "account";

const tossHoldingSortOptions: Array<{ value: TossHoldingSortKey; label: string }> = [
  { value: "return", label: "총 수익률 높은 순" },
  { value: "value", label: "평가금액 높은 순" },
  { value: "profit", label: "수익금 높은 순" },
  { value: "name", label: "종목명 순" }
];

type TossHoldingRow = {
  key: string;
  securityId: string;
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  assetType: string;
  logoUrl: string | null;
  companyDomain: string | null;
  logoSource: string;
  totalQuantity: number;
  averagePurchasePrice: number;
  marketPrice: number;
  marketValue: number;
  costAmount: number;
  profitLoss: number;
  profitLossRate: number;
  portfolioWeight: number;
  brokerCount: number;
  accountCount: number;
  brokers: BrokerKey[];
  accounts: Array<{
    id: string;
    broker: BrokerKey;
    accountAlias: string;
    accountType: string;
    quantity: number;
    averagePurchasePrice: number;
    marketPrice: number;
    marketValue: number;
    costAmount: number;
    profitLoss: number;
    profitLossRate: number;
    weightWithinHolding: number;
  }>;
  brokerBreakdown: Array<{
    broker: BrokerKey;
    quantity: number;
    marketValue: number;
  }>;
};

function TossStyleHoldingsList({
  title,
  holdings,
  metrics,
  scope
}: {
  title: string;
  holdings: Holding[];
  metrics: Metric;
  scope: TossHoldingScope;
}) {
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<TossHoldingSortKey>("return");
  const [valueMode, setValueMode] = useState<TossHoldingValueMode>("value");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const rows = buildTossHoldingRows(holdings, metrics.totalMarketValue, searchText, sortKey);
  const selectedHolding = selectedKey ? rows.find((row) => row.key === selectedKey) ?? null : null;
  const overseasRows = rows.filter((row) => !isDomesticHolding(row));
  const domesticRows = rows.filter(isDomesticHolding);
  const profitTone = metrics.totalProfitLoss >= 0 ? "text-[#ff3b4e]" : "text-[#2f7dff]";

  useEffect(() => {
    if (selectedKey && !rows.some((row) => row.key === selectedKey)) {
      setSelectedKey(null);
    }
  }, [rows, selectedKey]);

  return (
    <section className="holding-list-shell min-w-0 overflow-hidden rounded-[18px]">
      <div className="border-b border-[var(--card-border)] px-4 py-5 sm:px-6">
        <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 overflow-hidden">
            <p className="text-sm font-black text-[var(--text-secondary)]">{title}</p>
            <p className="numeric mt-2 max-w-full overflow-hidden text-ellipsis text-3xl font-black text-[var(--text-primary)]">{formatKrw(metrics.totalMarketValue)}</p>
            <p className={cn("numeric mt-1 max-w-full overflow-hidden text-ellipsis text-sm font-black", profitTone)}>
              {formatSignedKrw(metrics.totalProfitLoss)} ({formatPercent(metrics.returnRate)})
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(220px,1fr)_auto] xl:w-[520px] xl:shrink-0">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                className="h-10 pl-9 text-sm font-semibold"
                value={searchText}
                placeholder="종목명 또는 티커 검색"
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>
            <select
              aria-label="보유종목 정렬"
              className="h-10 rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-3 text-sm font-black text-[var(--text-primary)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as TossHoldingSortKey)}
            >
              {tossHoldingSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex rounded-lg bg-[var(--surface-subtle)] p-1 sm:col-start-2">
              <button
                type="button"
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-black transition",
                  valueMode === "price" ? "bg-white text-slate-950 shadow-sm dark:bg-white/10 dark:text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                )}
                onClick={() => setValueMode("price")}
              >
                현재가
              </button>
              <button
                type="button"
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-black transition",
                  valueMode === "value" ? "bg-white text-slate-950 shadow-sm dark:bg-white/10 dark:text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                )}
                onClick={() => setValueMode("value")}
              >
                평가금
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px] min-[1536px]:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <TossHoldingEmpty />
          ) : (
            <div className="space-y-5">
              <TossHoldingSection
                title="해외주식"
                rows={overseasRows}
                valueMode={valueMode}
                selectedKey={selectedKey}
                showBrokerBadges={scope === "overview"}
                onSelect={setSelectedKey}
              />
              <TossHoldingSection
                title="국내주식"
                rows={domesticRows}
                valueMode={valueMode}
                selectedKey={selectedKey}
                showBrokerBadges={scope === "overview"}
                onSelect={setSelectedKey}
              />
            </div>
          )}
        </div>
        <TossHoldingDetailPanel holding={selectedHolding} onClear={() => setSelectedKey(null)} />
      </div>
    </section>
  );
}

function TossHoldingSection({
  title,
  rows,
  valueMode,
  selectedKey,
  showBrokerBadges,
  onSelect
}: {
  title: string;
  rows: TossHoldingRow[];
  valueMode: TossHoldingValueMode;
  selectedKey: string | null;
  showBrokerBadges: boolean;
  onSelect: (key: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1 text-xs font-black text-slate-500">
        <span>{title}</span>
        <span>{rows.length}개 종목</span>
      </div>
      <div className="space-y-1">
        {rows.map((holding) => (
          <TossHoldingRowButton
            key={holding.key}
            holding={holding}
            valueMode={valueMode}
            selected={selectedKey === holding.key}
            showBrokerBadges={showBrokerBadges}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function TossHoldingRowButton({
  holding,
  valueMode,
  selected,
  showBrokerBadges,
  onSelect
}: {
  holding: TossHoldingRow;
  valueMode: TossHoldingValueMode;
  selected: boolean;
  showBrokerBadges: boolean;
  onSelect: (key: string) => void;
}) {
  const profitColor = holding.profitLoss >= 0 ? "text-[#ff3b4e]" : "text-[#2f7dff]";
  const displayValue = valueMode === "price" ? formatHoldingPrice(holding.marketPrice, holding.currency) : formatKrw(holding.marketValue);
  const displayName = holding.name.trim() || holding.symbol;

  return (
    <button
      type="button"
      className={cn(
        "holding-row group flex min-h-[72px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl px-2 py-2 text-left transition",
        selected ? "holding-row-selected" : "hover:bg-[var(--surface-hover)]"
      )}
      onClick={() => onSelect(holding.key)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <SecurityLogo
          symbol={holding.symbol}
          name={holding.name}
          logoUrl={holding.logoUrl}
          marketCountry={holding.marketCountry}
          size="sm"
          showCountryBadge
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-base font-black text-[var(--text-primary)]">{displayName}</p>
            <LossStickerBadge profitLossRate={holding.profitLossRate} mode={lossStickerMode} />
            <ProfitStickerBadge profitLossRate={holding.profitLossRate} mode={profitStickerMode} />
            <span className="text-xs leading-none">{marketCountryFlag(holding)}</span>
            {holding.accountCount > 1 ? (
              <span className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-black text-[var(--text-secondary)]">{holding.accountCount}계좌</span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-400">{holding.symbol}</p>
          <p className="numeric mt-0.5 text-xs font-semibold text-slate-400">{formatQuantity(holding.totalQuantity)}주</p>
          {showBrokerBadges ? (
            <div className="mt-1 flex max-w-[360px] flex-wrap gap-1">
              {holding.brokerBreakdown.map((item) => (
                <span key={item.broker} className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                  {brokerShortLabel(item.broker)} {formatQuantity(item.quantity)}주
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex w-[178px] shrink-0 items-center justify-end gap-1.5 overflow-hidden">
        <div className="min-w-0 text-right">
          <p className="numeric max-w-full overflow-hidden text-ellipsis text-base font-black text-[var(--text-primary)]">{displayValue}</p>
          <p className={cn("numeric mt-0.5 max-w-full overflow-hidden text-ellipsis text-xs font-black", profitColor)}>
            {formatSignedKrw(holding.profitLoss)} ({formatPercent(holding.profitLossRate)})
          </p>
          <p className="numeric mt-0.5 text-[10px] font-bold text-slate-500">비중 {holding.portfolioWeight.toFixed(1)}%</p>
        </div>
        <ChevronRight className={cn("h-4 w-4 text-slate-600 transition group-hover:text-slate-300", selected && "text-slate-300")} />
      </div>
    </button>
  );
}

function TossHoldingDetailPanel({ holding, onClear }: { holding: TossHoldingRow | null; onClear: () => void }) {
  if (!holding) {
    return (
      <aside className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5 text-[var(--text-secondary)] xl:sticky xl:top-5">
        <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
          <Info className="h-9 w-9 text-slate-600" />
          <p className="mt-3 text-sm font-black text-[var(--text-primary)]">종목을 선택하세요</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">보유수량, 평균단가, 계좌별 분해를 오른쪽에서 확인할 수 있습니다.</p>
        </div>
      </aside>
    );
  }

  const profitColor = holding.profitLoss >= 0 ? "text-[#ff3b4e]" : "text-[#2f7dff]";
  const displayName = holding.name.trim() || holding.symbol;

  return (
    <aside className="min-w-0 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5 xl:sticky xl:top-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SecurityLogo
            symbol={holding.symbol}
            name={holding.name}
            logoUrl={holding.logoUrl}
            marketCountry={holding.marketCountry}
            size="lg"
            showCountryBadge
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-lg font-black text-[var(--text-primary)]">{displayName}</p>
              <LossStickerBadge profitLossRate={holding.profitLossRate} mode={lossStickerMode} size="md" />
              <ProfitStickerBadge profitLossRate={holding.profitLossRate} mode={profitStickerMode} size="md" />
              <span className="shrink-0 text-sm">{marketCountryFlag(holding)}</span>
            </div>
            <p className="truncate text-xs font-bold text-slate-400">{holding.symbol}</p>
          </div>
        </div>
        <Button size="sm" variant="dark" onClick={onClear}>
          선택 해제
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <DetailMetric label="종목명" value={holding.name} />
        <DetailMetric label="티커" value={holding.symbol} />
        <DetailMetric label="보유수량" value={`${formatQuantity(holding.totalQuantity)}주`} />
        <DetailMetric label="보유 계좌" value={`${holding.accountCount}개`} />
        <DetailMetric label="평균단가" value={formatHoldingPrice(holding.averagePurchasePrice, holding.currency)} />
        <DetailMetric label="현재가" value={formatHoldingPrice(holding.marketPrice, holding.currency)} />
        <DetailMetric label="평가금액" value={formatKrw(holding.marketValue)} />
        <DetailMetric label="매입금액" value={formatKrw(holding.costAmount)} />
        <DetailMetric label="손익" value={formatSignedKrw(holding.profitLoss)} valueClassName={profitColor} />
        <DetailMetric label="수익률" value={formatPercent(holding.profitLossRate)} valueClassName={profitColor} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-500">
          <span>계좌별 보유수량</span>
          <span>{holding.brokerCount}개 증권사</span>
        </div>
        <div className="space-y-2">
          {holding.accounts.map((account) => {
            const accountProfitColor = account.profitLoss >= 0 ? "text-[#ff3b4e]" : "text-[#2f7dff]";
            return (
              <div key={account.id} className="rounded-xl bg-[var(--surface-subtle)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--text-primary)]">{cleanDisplayName(account.accountAlias)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {brokerShortLabel(account.broker)} · {accountTypeLabel(account.accountType)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="numeric text-sm font-black text-[var(--text-primary)]">{formatQuantity(account.quantity)}주</p>
                    <p className="numeric text-[10px] font-bold text-slate-500">{account.weightWithinHolding.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="font-semibold text-slate-500">현재가</p>
                    <p className="numeric mt-1 overflow-hidden text-ellipsis font-black text-[var(--text-primary)]">{formatHoldingPrice(account.marketPrice, holding.currency)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">평가금</p>
                    <p className="numeric mt-1 overflow-hidden text-ellipsis font-black text-[var(--text-primary)]">{formatKrw(account.marketValue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-500">손익</p>
                    <p className={cn("numeric mt-1 overflow-hidden text-ellipsis font-black", accountProfitColor)}>{formatSignedKrw(account.profitLoss)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function DetailMetric({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-[var(--surface-subtle)] p-3">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className={cn("numeric mt-1 truncate text-sm font-black text-[var(--text-primary)]", valueClassName)}>{value}</p>
    </div>
  );
}

function TossHoldingEmpty() {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-8 text-center">
      <Search className="mx-auto h-8 w-8 text-slate-600" />
      <p className="mt-3 text-sm font-black text-[var(--text-primary)]">검색 결과가 없습니다</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">다른 종목명이나 티커로 다시 검색해보세요.</p>
    </div>
  );
}

function TopHoldings({ data, onNavigate }: { data: PortfolioSummary; onNavigate?: (view: ViewKey) => void }) {
  const totalMarketValue = Math.max(1, data.metrics.totalMarketValue);
  const firstAccount = buildAccountNavigation(data)[0]?.key;

  return (
    <Card className="min-h-[360px] rounded-[20px] border-[#E5EAF0] bg-white shadow-sm">
      <CardHeader className="block">
        <div className="flex min-w-0 w-full items-start justify-between gap-3">
          <CardTitle className="min-w-0 truncate text-[18px] font-black text-[#0F172A]">상위 보유 종목 TOP 5</CardTitle>
          <button
            className="shrink-0 rounded-lg border border-[#E5EAF0] bg-white px-3 py-1.5 text-[12px] font-bold text-[#64748B] shadow-sm transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            onClick={() => (firstAccount && onNavigate ? onNavigate(firstAccount) : alert("전체 보유종목은 계좌별 상세 화면에서 확인할 수 있습니다."))}
          >
            전체 보기
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="space-y-1">
          {data.topHoldings.map((holding, index) => (
            <div key={holding.id} className="grid h-[44px] min-w-0 grid-cols-[22px_34px_minmax(0,1fr)_48px_118px] items-center gap-3 overflow-hidden rounded-xl px-1 text-[13px] transition hover:bg-[#F8FAFC]">
              <p className="text-center text-[13px] font-bold text-[#64748B]">{index + 1}</p>
              <SecurityLogo
                symbol={holding.symbol}
                name={holding.name}
                logoUrl={holding.logoUrl}
                marketCountry={holding.marketCountry}
                size="sm"
                showCountryBadge
              />
              <div className="min-w-0">
                <p className="truncate font-black text-[#0F172A]">{holding.symbol}</p>
                <p className="truncate text-[11px] font-medium text-[#64748B]">{holding.name}</p>
              </div>
              <p className="numeric overflow-hidden text-ellipsis text-right text-[12px] font-bold text-[#64748B]">{((safeNumber(holding.marketValue) / totalMarketValue) * 100).toFixed(2)}%</p>
              <div className="min-w-0 text-right">
                <p className="numeric overflow-hidden text-ellipsis font-black text-[#0F172A]">{formatKrw(holding.marketValue)}</p>
                <p className={cn("numeric mt-0.5 overflow-hidden text-ellipsis text-[11px] font-black", holding.profitLossRate >= 0 ? "text-[#EF4444]" : "text-[#2563EB]")}>{formatPercent(holding.profitLossRate)}</p>
              </div>
            </div>
          ))}
        </div>
        <Button className="mt-4 h-10 w-full rounded-xl text-[13px] font-bold" variant="outline" onClick={() => (firstAccount && onNavigate ? onNavigate(firstAccount) : alert("전체 종목 리스트는 계좌별 상세 화면에서 확인할 수 있습니다."))}>
          보유 종목 전체 보기
        </Button>
      </CardContent>
    </Card>
  );
}

function DuplicateHoldings({ data }: { data: PortfolioSummary }) {
  return (
    <Card className="min-h-[326px]">
      <CardHeader>
        <div>
          <CardTitle>중복 보유 종목</CardTitle>
          <p className="mt-1 text-[12px] font-normal text-[#94A3B8]">다중 계좌</p>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {data.duplicateHoldings.length === 0 ? (
          <div className="rounded-2xl bg-emerald-400/10 p-5 text-sm">
            <p className="font-black text-emerald-200">중복 보유 종목이 없습니다</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">현재 계좌 간 종목 집중도는 깔끔한 편입니다.</p>
          </div>
        ) : (
        <div className="space-y-2">
          {data.duplicateHoldings.map((item) => (
            <div key={item.symbol} className="rounded-xl bg-[var(--surface-subtle)] p-3 transition hover:bg-[var(--surface-hover)]">
              <div className="flex items-start gap-3">
                <SecurityLogo
                  symbol={item.symbol}
                  name={item.name}
                  logoUrl={item.logoUrl}
                  marketCountry={item.marketCountry}
                  size="sm"
                  showCountryBadge
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{item.symbol}</p>
                        <LossStickerBadge profitLossRate={item.profitLossRate} mode={lossStickerMode} />
                        <ProfitStickerBadge profitLossRate={item.profitLossRate} mode={profitStickerMode} />
                      </div>
                      <p className="truncate text-[11px] font-normal text-[var(--text-secondary)]">{item.name}</p>
                    </div>
                    <div className="text-right text-[13px]">
                      <p className="font-semibold text-[var(--text-primary)]">{formatQuantity(item.totalQuantity)}주</p>
                      <p className="mt-1 text-[11px] font-medium text-blue-300">{item.accounts.length}개 계좌</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.accounts.map((account) => (
                      <span key={`${item.symbol}-${account}`} className="rounded-md bg-white px-2 py-0.5 text-[11px] font-normal text-[var(--text-secondary)] shadow-sm dark:bg-white/[0.08]">
                        {account}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
        <Button className="mt-4 h-10 w-full rounded-xl text-[13px] font-medium" variant="dark" onClick={() => alert("중복 보유 정리 워크플로우는 리밸런싱 화면에서 진행합니다.")}>
          전체 중복 종목 보기 <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function AiInsightCard({
  data,
  marketIndicators,
  onNavigate
}: {
  data: PortfolioSummary;
  marketIndicators?: MarketIndicatorsResult;
  onNavigate: (view: ViewKey) => void;
}) {
  const fearGreed = findFearGreedIndicator(marketIndicators);
  const fearGreedInsight = fearGreed
    ? {
        type: "info" as const,
        title: "시장 심리",
        description: getFearGreedInsight(fearGreed.value)
      }
    : null;
  const insights = fearGreedInsight ? [fearGreedInsight, ...data.aiInsights] : data.aiInsights;

  return (
    <Card className="min-h-[326px]">
      <CardHeader>
        <div>
          <CardTitle>AI 한눈에 요약</CardTitle>
        </div>
        <button className="text-[12px] font-medium text-[#3B82F6] transition hover:text-blue-200" onClick={() => onNavigate("ai")}>AI 상세 분석</button>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
          <ul className="space-y-2">
          {insights.map((insight) => {
            return (
              <li key={insight.title} className="flex gap-3 text-[13px] leading-6">
                <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", insight.type === "warning" && "bg-orange-300", insight.type === "info" && "bg-blue-300", insight.type === "success" && "bg-emerald-300")} />
                <span>
                  <span className="font-medium text-[var(--text-primary)]">{insight.title}</span>
                  <span className="ml-1 text-[var(--text-secondary)]">{insight.description}</span>
                </span>
              </li>
            );
          })}
          </ul>
        </div>
        <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--surface-subtle)] p-3">
          <div className="flex items-end justify-between">
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">포트폴리오 점수</p>
            <p className="text-[28px] font-semibold leading-none text-[var(--text-primary)]">85<span className="text-[13px] font-normal text-[var(--text-secondary)]"> /100</span></p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]" />
          </div>
        </div>
        <Button className="mt-3 h-10 w-full rounded-xl text-[13px] font-medium" variant="dark" onClick={() => onNavigate("ai")}>
          AI 리포트 전체 보기
        </Button>
      </CardContent>
    </Card>
  );
}

function BottomActionPanel({ data, onNavigate }: { data: PortfolioSummary; onNavigate: (view: ViewKey) => void }) {
  return (
    <section className="hero-card grid gap-5 rounded-[24px] p-6 xl:grid-cols-4">
      <div>
        <p className="text-lg font-black text-[var(--text-primary)]">리밸런싱 추천</p>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">자산 배분을 최적화하면</p>
        <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">연간 +1,250,000원 추가 수익이</p>
        <p className="text-sm text-[var(--text-secondary)]">예상됩니다.</p>
        <Button className="mt-4" variant="dark" onClick={() => onNavigate("rebalance")}>상세 보기</Button>
      </div>
      <div className="border-[var(--card-border)] xl:border-l xl:pl-6">
        <p className="text-lg font-black text-[var(--text-primary)]">세금 예상 <span className="text-xs text-[var(--text-secondary)]">(올해 양도소득세)</span></p>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">예상 과세 대상 금액</p>
            <p className="mt-1 text-lg font-black text-[var(--text-primary)]">12,450,000원</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)]">예상 세금</p>
            <p className="mt-1 text-lg font-black text-[var(--text-primary)]">1,990,000원</p>
          </div>
        </div>
        <Button className="mt-4" variant="dark" onClick={() => onNavigate("tax")}>상세 보기</Button>
      </div>
      <div className="border-[var(--card-border)] xl:border-l xl:pl-6">
        <p className="text-lg font-black text-[var(--text-primary)]">ISA/연금 최적화</p>
        <div className="mt-4 flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-blue-400 text-lg font-black text-[var(--text-primary)]">78%</div>
          <div>
            <p className="text-sm text-[var(--text-secondary)]">절세 한도 활용률</p>
            <p className="mt-1 text-lg font-black text-[var(--text-primary)]">추가 납입 가능 금액<br />2,450,000원</p>
          </div>
        </div>
        <Button className="mt-4" variant="dark" onClick={() => onNavigate("settings")}>상세 보기</Button>
      </div>
      <div className="border-[var(--card-border)] xl:border-l xl:pl-6">
        <p className="text-lg font-black text-[var(--text-primary)]">다음 배당 예정</p>
        <div className="mt-5 flex gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-red-400 text-xl font-black text-red-400">D-7</div>
          <div>
            <p className="font-black text-[var(--text-primary)]">SCHD</p>
            <p className="text-sm text-[var(--text-secondary)]">예상 배당금 {formatKrw(Math.min(156000, data.metrics.annualDividendEstimate))}</p>
            <p className="text-sm text-[var(--text-secondary)]">2024.05.27 입금 예정</p>
          </div>
        </div>
        <Button className="mt-4" variant="dark" onClick={() => onNavigate("dividend")}>전체 배당 캘린더</Button>
      </div>
    </section>
  );
}

function BrokerView({ broker, token, onNavigate }: { broker: BrokerKey; token: string; onNavigate: (view: ViewKey) => void }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [kiwoomAccountNo, setKiwoomAccountNo] = useState("");
  const [namuhAccountNo, setNamuhAccountNo] = useState("");
  const query = useQuery({
    queryKey: ["broker", broker],
    queryFn: () => api.broker(broker, token)
  });
  const kiwoomStatus = useQuery({
    queryKey: ["brokers", "kiwoom", "status"],
    queryFn: () => api.kiwoomStatus(token),
    enabled: broker === "KIWOOM"
  });
  const namuhStatus = useQuery({
    queryKey: ["brokers", "namuh", "status"],
    queryFn: () => api.namuhStatus(token),
    enabled: broker === "NAMUH"
  });
  const syncToss = useMutation({
    mutationFn: async () => {
      return api.syncToss({}, token);
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries();
      notify({ kind: "success", title: "토스증권 동기화 완료", description: `${data.accounts}개 계좌, ${data.saved}개 종목을 저장했습니다.` });
    },
    onError: (error) => notify({ kind: "error", title: "토스증권 동기화 실패", description: (error as Error).message })
  });

  const connectKiwoom = useMutation({
    mutationFn: async (payload?: { accountNo?: string; accountNos?: string[]; connectAll?: boolean }) =>
      api.connectKiwoom(payload ?? {}, token),
    onSuccess: async (data) => {
      if ((data.selectedAccountNo || data.accounts[0]?.brokerAccountNo) && !kiwoomAccountNo) {
        setKiwoomAccountNo(data.selectedAccountNo ?? data.accounts[0].brokerAccountNo ?? "");
      }
      await queryClient.invalidateQueries({ queryKey: ["brokers", "kiwoom"] });
      await queryClient.invalidateQueries({ queryKey: ["broker", "KIWOOM"] });
      notify({ kind: data.connected ? "success" : "info", title: "키움 연결", description: data.message });
    },
    onError: (error) => notify({ kind: "error", title: "키움 연결 실패", description: (error as Error).message })
  });
  const syncKiwoom = useMutation({
    mutationFn: async (accountNo?: string) => api.syncKiwoom({ accountNo: accountNo || kiwoomAccountNo || undefined }, token),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries();
      notify({ kind: "success", title: "키움 동기화 완료", description: `${data.saved}개 보유 종목을 저장했습니다.` });
    },
    onError: (error) => notify({ kind: "error", title: "키움 동기화 실패", description: (error as Error).message })
  });
  const kiwoomAccounts = connectKiwoom.data?.accounts ?? [];
  const connectNamuh = useMutation({
    mutationFn: async (payload?: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string }) =>
      api.connectNamuh(payload ?? {}, token),
    onSuccess: async (data) => {
      if ((data.selectedAccountNo || data.accounts[0]?.brokerAccountNo) && !namuhAccountNo) {
        setNamuhAccountNo(data.selectedAccountNo ?? data.accounts[0].brokerAccountNo ?? "");
      }
      await queryClient.invalidateQueries({ queryKey: ["brokers", "namuh"] });
      await queryClient.invalidateQueries({ queryKey: ["broker", "NAMUH"] });
      notify({ kind: data.connected ? "success" : "info", title: "나무 연결", description: data.message });
    },
    onError: (error) => notify({ kind: "error", title: "나무 연결 실패", description: (error as Error).message })
  });
  const syncNamuh = useMutation({
    mutationFn: async (accountNo?: string) => api.syncNamuh({ accountNo: accountNo || namuhAccountNo || undefined }, token),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries();
      notify({ kind: "success", title: "나무 동기화 완료", description: `${data.saved}개 보유 종목을 저장했습니다.` });
    },
    onError: (error) => notify({ kind: "error", title: "나무 동기화 실패", description: (error as Error).message })
  });
  const namuhAccounts = connectNamuh.data?.accounts ?? [];
  useEffect(() => {
    if (!kiwoomAccountNo && kiwoomStatus.data?.accounts[0]?.brokerAccountNo) {
      setKiwoomAccountNo(kiwoomStatus.data.accounts[0].brokerAccountNo);
    }
  }, [kiwoomAccountNo, kiwoomStatus.data?.accounts]);
  useEffect(() => {
    if (!namuhAccountNo && namuhStatus.data?.accounts[0]?.brokerAccountNo) {
      setNamuhAccountNo(namuhStatus.data.accounts[0].brokerAccountNo);
    }
  }, [namuhAccountNo, namuhStatus.data?.accounts]);
  if (query.isLoading) return <LoadingState label={`${brokerLabels[broker]} 계좌를 불러오고 있습니다.`} />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  if (!query.data || query.data.holdings.length === 0) {
    if (broker === "NAMUH") {
      return (
        <div className="space-y-4">
          <NamuhConnectionCard
            status={namuhStatus.data}
            loading={namuhStatus.isFetching || connectNamuh.isPending || syncNamuh.isPending}
            discoveredAccounts={namuhAccounts}
            selectedAccountNo={namuhAccountNo}
            onSelectAccount={setNamuhAccountNo}
            onConnect={() => connectNamuh.mutate({})}
            onRegisterAccount={(accountNo) => connectNamuh.mutate({ accountNo })}
            onRegisterAll={(accountNos) => connectNamuh.mutate({ accountNos })}
            onSync={(accountNo) => syncNamuh.mutate(accountNo)}
            onOpenSettings={() => onNavigate("settings")}
            onUploadFallback={() => onNavigate("upload")}
          />
          <EmptyState title="나무 계좌 데이터가 없습니다." description="나무 WMCA 연결 또는 CSV/XLSX 업로드를 먼저 진행하세요." />
        </div>
      );
    }
    if (broker === "KIWOOM") {
      return (
        <div className="space-y-4">
          <KiwoomConnectionCard
            status={kiwoomStatus.data}
            loading={kiwoomStatus.isFetching || connectKiwoom.isPending || syncKiwoom.isPending}
            discoveredAccounts={kiwoomAccounts}
            selectedAccountNo={kiwoomAccountNo}
            onSelectAccount={setKiwoomAccountNo}
            onConnect={() => connectKiwoom.mutate({})}
            onRegisterAccount={(accountNo) => connectKiwoom.mutate({ accountNo })}
            onRegisterAll={(accountNos) => connectKiwoom.mutate({ accountNos })}
            onSync={(accountNo) => syncKiwoom.mutate(accountNo)}
            onOpenSettings={() => onNavigate("settings")}
            onUploadFallback={() => onNavigate("upload")}
          />
          <EmptyState title="키움 계좌 데이터가 없습니다." description="키움 REST API 연결 또는 CSV 업로드를 먼저 진행하세요." />
        </div>
      );
    }
    return <EmptyState title={`${brokerLabels[broker]} 데이터가 없습니다.`} description="파일 업로드 또는 API 연동을 먼저 진행하세요." />;
  }

  const data = query.data;
  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-4">
        <KpiCard icon={Wallet} label="평가금액" value={formatKrw(data.metrics.totalMarketValue)} caption={brokerLabels[broker]} tone="blue" />
        <KpiCard icon={LineChartIcon} label="손익" value={formatKrw(data.metrics.totalProfitLoss)} caption={formatPercent(data.metrics.returnRate)} tone="red" />
        <KpiCard icon={Gift} label="연간 배당 예상" value={formatKrw(data.metrics.annualDividendEstimate)} caption="입력/추정 기준" tone="purple" />
        <KpiCard icon={Globe2} label="환율 노출도" value={`${data.metrics.fxExposureRate.toFixed(1)}%`} caption="USD 기준" tone="green" />
      </section>
      {broker === "TOSS" ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-black text-slate-950">토스증권 Open API 동기화</p>
              <p className="mt-1 text-sm text-slate-500">설정에 저장된 토스증권 API 키로 계좌와 보유 종목을 갱신합니다.</p>
            </div>
            <Button onClick={() => syncToss.mutate()} disabled={syncToss.isPending}>
              {syncToss.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              토스 API 동기화
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {broker === "KIWOOM" ? (
        <KiwoomConnectionCard
          status={kiwoomStatus.data}
          loading={kiwoomStatus.isFetching || connectKiwoom.isPending || syncKiwoom.isPending}
          discoveredAccounts={kiwoomAccounts}
          selectedAccountNo={kiwoomAccountNo}
          onSelectAccount={setKiwoomAccountNo}
          onConnect={() => connectKiwoom.mutate({})}
          onRegisterAccount={(accountNo) => connectKiwoom.mutate({ accountNo })}
          onRegisterAll={(accountNos) => connectKiwoom.mutate({ accountNos })}
          onSync={(accountNo) => syncKiwoom.mutate(accountNo)}
          onOpenSettings={() => onNavigate("settings")}
          onUploadFallback={() => onNavigate("upload")}
        />
      ) : null}
      {broker === "NAMUH" ? (
        <NamuhConnectionCard
          status={namuhStatus.data}
          loading={namuhStatus.isFetching || connectNamuh.isPending || syncNamuh.isPending}
          discoveredAccounts={namuhAccounts}
          selectedAccountNo={namuhAccountNo}
          onSelectAccount={setNamuhAccountNo}
          onConnect={() => connectNamuh.mutate({})}
          onRegisterAccount={(accountNo) => connectNamuh.mutate({ accountNo })}
          onRegisterAll={(accountNos) => connectNamuh.mutate({ accountNos })}
          onSync={(accountNo) => syncNamuh.mutate(accountNo)}
          onOpenSettings={() => onNavigate("settings")}
          onUploadFallback={() => onNavigate("upload")}
        />
      ) : null}
      <TossStyleHoldingsList title={`${brokerLabels[broker]} 내 투자`} holdings={data.holdings} metrics={data.metrics} scope="broker" />
    </div>
  );
}

function KiwoomConnectionCard({
  status,
  loading,
  discoveredAccounts,
  selectedAccountNo,
  onSelectAccount,
  onConnect,
  onRegisterAccount,
  onRegisterAll,
  onSync,
  onOpenSettings,
  onUploadFallback
}: {
  status?: Awaited<ReturnType<typeof api.kiwoomStatus>>;
  loading: boolean;
  discoveredAccounts: Array<{ brokerAccountNo: string | null; accountAlias: string }>;
  selectedAccountNo: string;
  onSelectAccount: (accountNo: string) => void;
  onConnect: () => void;
  onRegisterAccount: (accountNo: string) => void;
  onRegisterAll: (accountNos: string[]) => void;
  onSync: (accountNo?: string) => void;
  onOpenSettings: () => void;
  onUploadFallback: () => void;
}) {
  const connectedAccounts = status?.accounts ?? [];
  const selectableAccounts = discoveredAccounts.length > 0 ? discoveredAccounts : connectedAccounts;
  const hasAccountChoice = selectableAccounts.length > 0;
  const isConnected = Boolean(status?.connected || connectedAccounts.length > 0);
  const registeredAccountNos = new Set(connectedAccounts.map((account) => account.brokerAccountNo).filter(Boolean));
  const unregisteredAccountNos = selectableAccounts
    .map((account) => account.brokerAccountNo)
    .filter((accountNo): accountNo is string => Boolean(accountNo) && !registeredAccountNos.has(accountNo));

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-black text-slate-950">키움 REST API 연동</p>
              <span className={cn("rounded-full px-2 py-1 text-xs font-black", isConnected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                {isConnected ? "연결됨" : "미연결"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">계좌번호, 예수금, 평가잔고, 현재가를 키움 REST API로 자동 동기화합니다.</p>
            {status?.credentialSource ? <p className="mt-1 text-xs text-slate-400">키 출처 {status.credentialSource}{status.appKeyPreview ? ` · ${status.appKeyPreview}` : ""}</p> : null}
            {status?.tokenExpiresAt ? <p className="mt-1 text-xs text-slate-400">토큰 만료 {formatDateTime(status.tokenExpiresAt)}</p> : null}
            {status?.lastSyncedAt ? <p className="mt-1 text-xs text-slate-400">마지막 동기화 {formatDateTime(status.lastSyncedAt)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onConnect} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              계좌 조회
            </Button>
            <Button variant="outline" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
              키 설정
            </Button>
            <Button variant="secondary" onClick={() => onSync(selectedAccountNo || connectedAccounts[0]?.brokerAccountNo || undefined)} disabled={loading || !isConnected}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              보유종목 동기화
            </Button>
            <Button variant="secondary" onClick={onUploadFallback}>
              <Upload className="h-4 w-4" />
              CSV 백업
            </Button>
          </div>
        </div>
        {hasAccountChoice ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">영웅문 계좌 목록</p>
                <p className="mt-1 text-xs text-slate-500">조회된 계좌를 여러 개 등록할 수 있습니다.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onRegisterAll(unregisteredAccountNos)} disabled={loading || unregisteredAccountNos.length === 0}>
                미등록 계좌 전체 등록
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {selectableAccounts.map((account) => {
                const accountNo = account.brokerAccountNo ?? "";
                const registered = Boolean(accountNo && registeredAccountNos.has(accountNo));
                const selected = Boolean(accountNo && selectedAccountNo === accountNo);
                return (
                  <div
                    key={accountNo || account.accountAlias}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "rounded-xl border bg-white p-4 text-left transition hover:border-blue-300",
                      selected ? "border-blue-400 shadow-sm" : "border-slate-200"
                    )}
                    onClick={() => accountNo && onSelectAccount(accountNo)}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && accountNo) {
                        event.preventDefault();
                        onSelectAccount(accountNo);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{account.accountAlias}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {accountNo ? maskAccountNoForUi(accountNo) : "계좌번호 없음"}
                        </p>
                      </div>
                      <span className={cn("rounded-full px-2 py-1 text-xs font-black", registered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                        {registered ? "등록됨" : "미등록"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={registered ? "secondary" : "primary"}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (accountNo) onRegisterAccount(accountNo);
                        }}
                        disabled={loading || !accountNo || registered}
                      >
                        등록
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (accountNo) onSync(accountNo);
                        }}
                        disabled={loading || !registered}
                      >
                        동기화
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NamuhConnectionCard({
  status,
  loading,
  discoveredAccounts,
  selectedAccountNo,
  onSelectAccount,
  onConnect,
  onRegisterAccount,
  onRegisterAll,
  onSync,
  onOpenSettings,
  onUploadFallback
}: {
  status?: Awaited<ReturnType<typeof api.namuhStatus>>;
  loading: boolean;
  discoveredAccounts: Array<{ brokerAccountNo: string | null; accountAlias: string }>;
  selectedAccountNo: string;
  onSelectAccount: (accountNo: string) => void;
  onConnect: () => void;
  onRegisterAccount: (accountNo: string) => void;
  onRegisterAll: (accountNos: string[]) => void;
  onSync: (accountNo?: string) => void;
  onOpenSettings: () => void;
  onUploadFallback: () => void;
}) {
  const connectedAccounts = status?.accounts ?? [];
  const selectableAccounts = discoveredAccounts.length > 0 ? discoveredAccounts : connectedAccounts;
  const hasAccountChoice = selectableAccounts.length > 0;
  const isConnected = Boolean(status?.connected || connectedAccounts.length > 0);
  const registeredAccountNos = new Set(connectedAccounts.map((account) => account.brokerAccountNo).filter(Boolean));
  const unregisteredAccountNos = selectableAccounts
    .map((account) => account.brokerAccountNo)
    .filter((accountNo): accountNo is string => Boolean(accountNo) && !registeredAccountNos.has(accountNo));

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black text-slate-950">나무증권 WMCA OpenAPI 연동</p>
              <span className={cn("rounded-full px-2 py-1 text-xs font-black", isConnected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                {isConnected ? "연결됨" : "미연결"}
              </span>
              <span className={cn("rounded-full px-2 py-1 text-xs font-black", status?.hasBridge ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700")}>
                {status?.hasBridge ? "브리지 설정됨" : "브리지 필요"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              제공 문서 기준으로 계좌목록은 로그인 이벤트, 잔고/예수금은 c8201, 국내 현재가는 IVWUTKMST04 TR로 동기화합니다.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {status?.bridgeUrl ? `브리지 ${status.bridgeUrl}` : "NAMUH_WMCA_BRIDGE_URL 미설정"} · {status?.documentProfile.mockTrading ?? "모의투자 지원 정보 확인 중"}
            </p>
            {status?.lastSyncedAt ? <p className="mt-1 text-xs text-slate-400">마지막 동기화 {formatDateTime(status.lastSyncedAt)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onConnect} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              계좌 조회
            </Button>
            <Button variant="outline" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
              로그인 설정
            </Button>
            <Button variant="secondary" onClick={() => onSync(selectedAccountNo || connectedAccounts[0]?.brokerAccountNo || undefined)} disabled={loading || !isConnected}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              보유종목 동기화
            </Button>
            <Button variant="secondary" onClick={onUploadFallback}>
              <Upload className="h-4 w-4" />
              CSV 백업
            </Button>
          </div>
        </div>

        {!status?.hasBridge ? (
          <div className="flex gap-2 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-black">WMCA 브리지 설정 필요</p>
              <p className="mt-1">
                나무 문서는 32비트 Windows DLL 기반이라 현재 64비트 Nest 서버가 직접 로드할 수 없습니다. 브리지 설정 전에는 CSV/XLSX 업로드를 fallback으로 사용하세요.
              </p>
            </div>
          </div>
        ) : null}

        {hasAccountChoice ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">나무 계좌 목록</p>
                <p className="mt-1 text-xs text-slate-500">조회된 나무 계좌를 여러 개 등록할 수 있습니다.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onRegisterAll(unregisteredAccountNos)} disabled={loading || unregisteredAccountNos.length === 0}>
                미등록 계좌 전체 등록
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {selectableAccounts.map((account) => {
                const accountNo = account.brokerAccountNo ?? "";
                const registered = Boolean(accountNo && registeredAccountNos.has(accountNo));
                const selected = Boolean(accountNo && selectedAccountNo === accountNo);
                return (
                  <div
                    key={accountNo || account.accountAlias}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "rounded-xl border bg-white p-4 text-left transition hover:border-blue-300",
                      selected ? "border-blue-400 shadow-sm" : "border-slate-200"
                    )}
                    onClick={() => accountNo && onSelectAccount(accountNo)}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && accountNo) {
                        event.preventDefault();
                        onSelectAccount(accountNo);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{account.accountAlias}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {accountNo ? maskAccountNoForUi(accountNo) : "계좌번호 없음"}
                        </p>
                      </div>
                      <span className={cn("rounded-full px-2 py-1 text-xs font-black", registered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                        {registered ? "등록됨" : "미등록"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={registered ? "secondary" : "primary"}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (accountNo) onRegisterAccount(accountNo);
                        }}
                        disabled={loading || !accountNo || registered}
                      >
                        등록
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (accountNo) onSync(accountNo);
                        }}
                        disabled={loading || !registered}
                      >
                        동기화
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function maskAccountNoForUi(accountNo: string) {
  if (accountNo.length <= 4) return accountNo;
  return `${accountNo.slice(0, 2)}****${accountNo.slice(-2)}`;
}
function BrokerHoldingsTable({ data }: { data: BrokerPortfolio }) {
  return <TossStyleHoldingsList title={`${brokerLabels[data.broker]} 내 투자`} holdings={data.holdings} metrics={data.metrics} scope="broker" />;
}
function UploadManager({ token }: { token: string }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [broker, setBroker] = useState<BrokerKey>("NAMUH");
  const [accountType, setAccountType] = useState("BROKERAGE");
  const [accountAlias, setAccountAlias] = useState("나무증권");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<NormalizedUploadRow[]>([]);

  const preview = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("파일을 먼저 선택하세요.");
      return api.uploadPreview(file, broker, accountType, token);
    },
    onSuccess: (data) => {
      setRows(data.normalizedRows);
      notify({ kind: "success", title: "업로드 미리보기 완료", description: `${data.validation.validRows}개 행이 검증되었습니다.` });
    },
    onError: (error) => notify({ kind: "error", title: "업로드 실패", description: (error as Error).message })
  });

  const commit = useMutation({
    mutationFn: () => api.uploadCommit({ broker, accountType, accountAlias, rows }, token),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries();
      notify({ kind: "success", title: "저장 완료", description: `${data.saved}개 보유 종목이 저장되었습니다.` });
    },
    onError: (error) => notify({ kind: "error", title: "저장 실패", description: (error as Error).message })
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>CSV/XLSX 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm font-bold text-slate-700">증권사</label>
          <select className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={broker} onChange={(event) => setBroker(event.target.value as BrokerKey)}>
            <option value="NAMUH">나무증권</option>
            <option value="KIWOOM">키움 영웅문</option>
            <option value="TOSS">토스증권</option>
          </select>
          <label className="block text-sm font-bold text-slate-700">계좌 유형</label>
          <select className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={accountType} onChange={(event) => setAccountType(event.target.value)}>
            <option value="BROKERAGE">종합매매</option>
            <option value="ISA">ISA</option>
            <option value="PENSION_SAVINGS">연금저축</option>
          </select>
          <label className="block text-sm font-bold text-slate-700">계좌 별칭</label>
          <Input value={accountAlias} onChange={(event) => setAccountAlias(event.target.value)} />
          <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50 text-center">
            <FileSpreadsheet className="h-8 w-8 text-blue-600" />
            <span className="mt-2 text-sm font-bold text-slate-800">{file ? file.name : "CSV 또는 XLSX 파일 선택"}</span>
            <span className="mt-1 text-xs text-slate-500">보유잔고 파일을 업로드하세요.</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => preview.mutate()} disabled={preview.isPending}>
              {preview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              미리보기
            </Button>
            <Button variant="outline" onClick={() => window.open("/sample-holdings.csv", "_blank")}>
              <Download className="h-4 w-4" />
              템플릿
            </Button>
          </div>
          <Button className="w-full" variant="secondary" onClick={() => commit.mutate()} disabled={rows.length === 0 || commit.isPending}>
            {commit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            저장
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>미리보기와 검증 결과</CardTitle>
        </CardHeader>
        <CardContent>
          {preview.isError ? <ErrorState message={(preview.error as Error).message} onRetry={() => preview.mutate()} /> : null}
          {!preview.data && !preview.isError ? (
            <EmptyState title="업로드 대기 중" description="파일을 선택하고 미리보기를 누르면 컬럼 자동 매핑과 검증 결과가 표시됩니다." />
          ) : null}
          {preview.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <ValidationBadge label="전체 행" value={preview.data.validation.totalRows} />
                <ValidationBadge label="정상" value={preview.data.validation.validRows} />
                <ValidationBadge label="경고" value={preview.data.validation.warningRows} />
                <ValidationBadge label="오류" value={preview.data.validation.errorRows} />
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                {preview.data.validation.messages.map((message) => (
                  <p key={message}>- {message}</p>
                ))}
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[840px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-3">상태</th>
                      <th>종목</th>
                      <th className="text-right">수량</th>
                      <th className="text-right">평가금액</th>
                      <th className="text-right">손익</th>
                      <th>검증</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((row, index) => (
                      <tr key={`${row.symbol}-${index}`} className="border-b border-slate-100">
                        <td className="py-3 font-bold">{row.status}</td>
                        <td>
                          <p className="font-black">{row.symbol}</p>
                          <p className="text-xs text-slate-500">{row.name}</p>
                        </td>
                        <td className="text-right">{row.quantity.toLocaleString("ko-KR")}</td>
                        <td className="text-right">{formatKrw(row.marketValue)}</td>
                        <td className="text-right">{formatKrw(row.profitLoss)}</td>
                        <td className="text-xs text-slate-500">{row.errors.join(", ") || "정상"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ValidationBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function SettingsPanel({ token }: { token: string }) {
  const { notify } = useToast();
  const [targets, setTargets] = useState(defaultTargets);
  const query = useQuery({ queryKey: ["targets"], queryFn: () => api.targets(token) });
  const mutation = useMutation({
    mutationFn: () => api.saveTargets(targets, token),
    onSuccess: () => notify({ kind: "success", title: "목표 비중 저장", description: "리밸런싱 추천에 반영됩니다." }),
    onError: (error) => notify({ kind: "error", title: "저장 실패", description: (error as Error).message })
  });

  useEffect(() => {
    if (query.data?.length) {
      setTargets(query.data.map((target) => ({ targetType: target.targetType, targetKey: target.targetKey, targetWeight: Number(target.targetWeight) })));
    }
  }, [query.data]);

  return (
    <div className="space-y-4">
      <TossCredentialSettings token={token} />
      <NamuhCredentialProfilesSettings token={token} />
      <KiwoomCredentialProfilesSettings token={token} />
      <Card>
        <CardHeader>
          <CardTitle>목표 비중 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {targets.map((target, index) => (
            <div key={target.targetKey} className="grid items-center gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[160px_1fr_90px]">
              <p className="font-bold text-slate-900">{target.targetKey}</p>
              <input
                type="range"
                min={0}
                max={100}
                value={target.targetWeight}
                onChange={(event) => {
                  const next = [...targets];
                  next[index] = { ...target, targetWeight: Number(event.target.value) };
                  setTargets(next);
                }}
              />
              <Input
                type="number"
                value={target.targetWeight}
                onChange={(event) => {
                  const next = [...targets];
                  next[index] = { ...target, targetWeight: Number(event.target.value) };
                  setTargets(next);
                }}
              />
            </div>
          ))}
          <div className="flex gap-3">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              저장
            </Button>
            <Button variant="outline" onClick={() => setTargets(defaultTargets)}>
              기본값 복원
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TossCredentialSettings({ token }: { token: string }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["toss-credentials"], queryFn: () => api.tossCredentials(token) });
  const [drafts, setDrafts] = useState<Record<string, { clientId: string; clientSecret: string }>>({});

  useEffect(() => {
    if (!query.data) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const account of query.data) {
        next[account.accountId] = next[account.accountId] ?? {
          clientId: account.credential?.clientId ?? "",
          clientSecret: ""
        };
        if (!next[account.accountId].clientId && account.credential?.clientId) {
          next[account.accountId] = { ...next[account.accountId], clientId: account.credential.clientId };
        }
      }
      return next;
    });
  }, [query.data]);

  const createAccount = useMutation({
    mutationFn: () => {
      const accountAlias = window.prompt("추가할 토스 계좌 별칭을 입력하세요.", "토스증권 추가 계좌");
      if (!accountAlias) throw new Error("계좌 별칭을 입력해야 합니다.");
      return api.createTossAccount({ accountAlias }, token);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["toss-credentials"] });
      notify({ kind: "success", title: "토스 계좌 추가", description: "설정에서 API 키를 입력할 수 있습니다." });
    },
    onError: (error) => notify({ kind: "error", title: "계좌 추가 실패", description: (error as Error).message })
  });

  const saveCredential = useMutation({
    mutationFn: (account: TossCredentialAccount) => {
      const draft = drafts[account.accountId];
      if (!draft?.clientId) throw new Error("client_id를 입력하세요.");
      if (!account.credential && !draft.clientSecret) throw new Error("처음 저장할 때는 client_secret이 필요합니다.");
      return api.saveTossCredential(
        {
          accountId: account.accountId,
          clientId: draft.clientId,
          clientSecret: draft.clientSecret || undefined
        },
        token
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["toss-credentials"] });
      setDrafts((current) =>
        Object.fromEntries(Object.entries(current).map(([accountId, draft]) => [accountId, { ...draft, clientSecret: "" }]))
      );
      notify({ kind: "success", title: "토스 API 키 저장", description: "계좌별 키가 DB에 암호화되어 저장되었습니다." });
    },
    onError: (error) => notify({ kind: "error", title: "키 저장 실패", description: (error as Error).message })
  });

  const deleteCredential = useMutation({
    mutationFn: (accountId: string) => api.deleteTossCredential(accountId, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["toss-credentials"] });
      notify({ kind: "success", title: "토스 API 키 삭제", description: "저장된 계좌 키를 삭제했습니다." });
    },
    onError: (error) => notify({ kind: "error", title: "키 삭제 실패", description: (error as Error).message })
  });

  const syncAccount = useMutation({
    mutationFn: (accountId: string) => api.syncToss({ accountId }, token),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries();
      notify({ kind: "success", title: "토스 계좌 동기화 완료", description: `${data.accounts}개 계좌, ${data.saved}개 종목을 저장했습니다.` });
    },
    onError: (error) => notify({ kind: "error", title: "토스 동기화 실패", description: (error as Error).message })
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>토스증권 API 키 설정</CardTitle>
            <p className="mt-2 text-sm text-slate-500">토스 계좌별로 Open API 키를 저장하고, 저장된 키로 동기화합니다.</p>
          </div>
          <Button variant="outline" onClick={() => createAccount.mutate()} disabled={createAccount.isPending}>
            {createAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            토스 계좌 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? <LoadingState label="토스 계좌 설정을 불러오고 있습니다." /> : null}
        {query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /> : null}
        {query.data && query.data.length === 0 ? (
          <EmptyState title="토스 계좌가 없습니다." description="토스 계좌 추가 버튼으로 API 키를 저장할 계좌를 만드세요." />
        ) : null}
        {query.data?.map((account) => {
          const draft = drafts[account.accountId] ?? { clientId: account.credential?.clientId ?? "", clientSecret: "" };
          return (
            <div key={account.accountId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-base font-black text-slate-950">{account.accountAlias}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {account.accountType} · 외부 계좌 ID {account.externalAccountId ?? "동기화 후 자동 입력"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    저장 상태: {account.credential ? `${account.credential.secretPreview} · ${account.credential.status}` : "저장된 키 없음"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => syncAccount.mutate(account.accountId)} disabled={!account.credential || syncAccount.isPending}>
                    {syncAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    동기화
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteCredential.mutate(account.accountId)} disabled={!account.credential || deleteCredential.isPending}>
                    삭제
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-bold text-slate-700">
                  client_id
                  <Input
                    className="mt-2"
                    value={draft.clientId}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [account.accountId]: { ...draft, clientId: event.target.value }
                      }))
                    }
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  client_secret
                  <Input
                    className="mt-2"
                    type="password"
                    placeholder={account.credential ? "변경할 때만 입력" : "필수 입력"}
                    value={draft.clientSecret}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [account.accountId]: { ...draft, clientSecret: event.target.value }
                      }))
                    }
                  />
                </label>
              </div>
              <Button className="mt-4" onClick={() => saveCredential.mutate(account)} disabled={saveCredential.isPending}>
                {saveCredential.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                계좌 키 저장
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NamuhCredentialProfilesSettings({ token }: { token: string }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const profilesQuery = useQuery({ queryKey: ["settings", "namuh-credentials"], queryFn: () => api.namuhCredentials(token) });
  const [draft, setDraft] = useState({
    connectionId: "",
    label: "",
    loginId: "",
    loginPassword: "",
    certificatePassword: "",
    accountPassword: "",
    certificateMode: "PC" as "PC" | "CLOUD",
    environment: "REAL" as "REAL" | "MOCK"
  });
  const [discoveredAccounts, setDiscoveredAccounts] = useState<Record<string, Array<{ brokerAccountNo: string | null; accountAlias: string }>>>({});

  function resetDraft() {
    setDraft({
      connectionId: "",
      label: "",
      loginId: "",
      loginPassword: "",
      certificatePassword: "",
      accountPassword: "",
      certificateMode: "PC",
      environment: "REAL"
    });
  }

  function editProfile(profile: NamuhCredentialProfile) {
    setDraft({
      connectionId: profile.connectionId,
      label: profile.label,
      loginId: profile.loginId ?? "",
      loginPassword: "",
      certificatePassword: "",
      accountPassword: "",
      certificateMode: profile.certificateMode,
      environment: profile.environment
    });
    notify({ kind: "info", title: "나무 설정 편집", description: `${profile.label} 정보를 편집합니다.` });
  }

  const saveProfile = useMutation({
    mutationFn: () => {
      if (!draft.label.trim()) throw new Error("나무 연결 이름을 입력하세요.");
      if (!draft.loginId.trim()) throw new Error("나무 ID를 입력하세요.");
      if (!draft.connectionId && (!draft.loginPassword.trim() || !draft.certificatePassword.trim() || !draft.accountPassword.trim())) {
        throw new Error("새 나무 연결에는 ID 비밀번호, 인증서 비밀번호, 계좌 비밀번호가 모두 필요합니다.");
      }
      return api.saveNamuhCredentialProfile(
        {
          connectionId: draft.connectionId || undefined,
          label: draft.label.trim(),
          loginId: draft.loginId.trim(),
          loginPassword: draft.loginPassword.trim() || undefined,
          certificatePassword: draft.certificatePassword.trim() || undefined,
          accountPassword: draft.accountPassword.trim() || undefined,
          certificateMode: draft.certificateMode,
          environment: draft.environment
        },
        token
      );
    },
    onSuccess: async () => {
      resetDraft();
      await queryClient.invalidateQueries({ queryKey: ["settings", "namuh-credentials"] });
      await queryClient.invalidateQueries({ queryKey: ["brokers", "namuh"] });
      notify({ kind: "success", title: "나무 WMCA 정보 저장", description: "로그인 정보를 암호화 저장했습니다." });
    },
    onError: (error) => notify({ kind: "error", title: "나무 정보 저장 실패", description: (error as Error).message })
  });

  const deleteProfile = useMutation({
    mutationFn: (connectionId: string) => api.deleteNamuhCredentialProfile(connectionId, token),
    onSuccess: async () => {
      resetDraft();
      await queryClient.invalidateQueries({ queryKey: ["settings", "namuh-credentials"] });
      await queryClient.invalidateQueries({ queryKey: ["brokers", "namuh"] });
      await queryClient.invalidateQueries({ queryKey: ["broker", "NAMUH"] });
      notify({ kind: "success", title: "나무 연결 삭제", description: "저장된 로그인 정보와 계좌 연결을 삭제했습니다." });
    },
    onError: (error) => notify({ kind: "error", title: "나무 연결 삭제 실패", description: (error as Error).message })
  });

  const connectProfile = useMutation({
    mutationFn: (payload: { credentialId: string; accountNo?: string; accountNos?: string[] }) =>
      api.connectNamuh(payload, token),
    onSuccess: async (data) => {
      if (data.credentialId) {
        setDiscoveredAccounts((current) => ({ ...current, [data.credentialId ?? ""]: data.accounts }));
      }
      await queryClient.invalidateQueries({ queryKey: ["settings", "namuh-credentials"] });
      await queryClient.invalidateQueries({ queryKey: ["brokers", "namuh"] });
      await queryClient.invalidateQueries({ queryKey: ["broker", "NAMUH"] });
      notify({ kind: data.connected ? "success" : "info", title: "나무 계좌 조회", description: data.message });
    },
    onError: (error) => notify({ kind: "error", title: "나무 계좌 조회 실패", description: (error as Error).message })
  });

  const profiles = profilesQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>나무증권 WMCA OpenAPI 설정</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              제공 문서 기준 나무 OpenAPI는 App Key 방식이 아니라 ID/비밀번호/공동인증서 기반 32비트 WMCA SDK입니다.
            </p>
          </div>
          <Button variant="outline" onClick={resetDraft}>
            새 나무 연결
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {profilesQuery.isLoading ? <LoadingState label="나무 연결 정보를 불러오고 있습니다." /> : null}
        {profilesQuery.isError ? <ErrorState message={(profilesQuery.error as Error).message} onRetry={() => profilesQuery.refetch()} /> : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]">
            <label className="block text-sm font-bold text-slate-700">
              연결 이름
              <Input
                className="mt-2"
                value={draft.label}
                placeholder="예: 나무 주계좌"
                onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              나무 ID
              <Input
                className="mt-2"
                value={draft.loginId}
                placeholder="나무/NH 온라인 ID"
                onChange={(event) => setDraft((current) => ({ ...current, loginId: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              ID 비밀번호
              <Input
                className="mt-2"
                type="password"
                value={draft.loginPassword}
                placeholder={draft.connectionId ? "변경할 때만 입력" : "필수 입력"}
                onChange={(event) => setDraft((current) => ({ ...current, loginPassword: event.target.value }))}
              />
            </label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              공동인증서 비밀번호
              <Input
                className="mt-2"
                type="password"
                value={draft.certificatePassword}
                placeholder={draft.connectionId ? "변경할 때만 입력" : "필수 입력"}
                onChange={(event) => setDraft((current) => ({ ...current, certificatePassword: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              계좌 비밀번호
              <Input
                className="mt-2"
                type="password"
                value={draft.accountPassword}
                placeholder={draft.connectionId ? "변경할 때만 입력" : "필수 입력"}
                onChange={(event) => setDraft((current) => ({ ...current, accountPassword: event.target.value }))}
              />
            </label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              인증서 위치
              <select
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                value={draft.certificateMode}
                onChange={(event) => setDraft((current) => ({ ...current, certificateMode: event.target.value as "PC" | "CLOUD" }))}
              >
                <option value="PC">PC 저장 공동인증서</option>
                <option value="CLOUD">클라우드 공동인증서</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              투자 환경
              <select
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                value={draft.environment}
                onChange={(event) => setDraft((current) => ({ ...current, environment: event.target.value as "REAL" | "MOCK" }))}
              >
                <option value="REAL">실전투자</option>
                <option value="MOCK">모의투자</option>
              </select>
            </label>
          </div>
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
            문서상 나무 모의투자 서비스는 2023.05.31 중단으로 안내되어 있습니다. 실사용은 실전투자 기준으로 검증하세요.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {saveProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              {draft.connectionId ? "나무 연결 수정" : "나무 연결 저장"}
            </Button>
            <Button variant="ghost" onClick={resetDraft}>
              입력 초기화
            </Button>
          </div>
        </div>

        {profiles.length === 0 && !profilesQuery.isLoading ? (
          <EmptyState title="저장된 나무 연결이 없습니다." description="나무 ID와 인증 정보를 저장한 뒤 계좌를 조회하세요." />
        ) : null}

        <div className="grid gap-4">
          {profiles.map((profile) => (
            <NamuhCredentialProfileCard
              key={profile.connectionId}
              profile={profile}
              discoveredAccounts={discoveredAccounts[profile.connectionId] ?? []}
              loading={connectProfile.isPending || deleteProfile.isPending}
              onEdit={() => editProfile(profile)}
              onDelete={() => deleteProfile.mutate(profile.connectionId)}
              onLookup={() => connectProfile.mutate({ credentialId: profile.connectionId })}
              onRegister={(accountNo) => connectProfile.mutate({ credentialId: profile.connectionId, accountNo })}
              onRegisterAll={(accountNos) => connectProfile.mutate({ credentialId: profile.connectionId, accountNos })}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NamuhCredentialProfileCard({
  profile,
  discoveredAccounts,
  loading,
  onEdit,
  onDelete,
  onLookup,
  onRegister,
  onRegisterAll
}: {
  profile: NamuhCredentialProfile;
  discoveredAccounts: Array<{ brokerAccountNo: string | null; accountAlias: string }>;
  loading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLookup: () => void;
  onRegister: (accountNo: string) => void;
  onRegisterAll: (accountNos: string[]) => void;
}) {
  const registeredAccountNos = new Set(profile.accounts.map((account) => account.brokerAccountNo).filter(Boolean));
  const unregisteredAccountNos = discoveredAccounts
    .map((account) => account.brokerAccountNo)
    .filter((accountNo): accountNo is string => Boolean(accountNo) && !registeredAccountNos.has(accountNo));

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-black text-slate-950">{profile.label}</p>
            <span className={cn("rounded-full px-2 py-1 text-xs font-black", profile.environment === "REAL" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700")}>
              {profile.environment === "REAL" ? "실전투자" : "모의투자"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
              {profile.accounts.length}개 계좌 등록
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            ID {profile.loginIdPreview} · ID PW {profile.passwordPreview ?? "저장됨"} · 계좌 PW {profile.accountPasswordPreview ?? "저장됨"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            인증서 {profile.certificateMode === "PC" ? "PC" : "클라우드"} · 브리지 {profile.bridgeUrl ?? "미설정"}
          </p>
          {profile.errorMessage ? <p className="mt-1 text-xs font-bold text-orange-600">{profile.errorMessage}</p> : null}
          {profile.updatedAt ? <p className="mt-1 text-xs text-slate-400">마지막 저장 {formatDateTime(profile.updatedAt)}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            수정
          </Button>
          <Button size="sm" onClick={onLookup} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            계좌 조회
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={loading}>
            삭제
          </Button>
        </div>
      </div>

      {discoveredAccounts.length > 0 ? (
        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-black text-slate-900">조회된 계좌</p>
            <Button size="sm" variant="outline" onClick={() => onRegisterAll(unregisteredAccountNos)} disabled={loading || unregisteredAccountNos.length === 0}>
              미등록 계좌 전체 등록
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {discoveredAccounts.map((account) => {
              const accountNo = account.brokerAccountNo ?? "";
              const registered = Boolean(accountNo && registeredAccountNos.has(accountNo));
              return (
                <div key={accountNo || account.accountAlias} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{account.accountAlias}</p>
                      <p className="mt-1 text-xs text-slate-500">{accountNo ? maskAccountNoForUi(accountNo) : "계좌번호 없음"}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-1 text-xs font-black", registered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {registered ? "등록됨" : "미등록"}
                    </span>
                  </div>
                  <Button className="mt-3" size="sm" onClick={() => accountNo && onRegister(accountNo)} disabled={loading || !accountNo || registered}>
                    등록
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KiwoomCredentialProfilesSettings({ token }: { token: string }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const profilesQuery = useQuery({ queryKey: ["settings", "kiwoom-credentials"], queryFn: () => api.kiwoomCredentials(token) });
  const [draft, setDraft] = useState({ connectionId: "", label: "", appKey: "", secretKey: "", useMock: false });
  const [discoveredAccounts, setDiscoveredAccounts] = useState<Record<string, Array<{ brokerAccountNo: string | null; accountAlias: string }>>>({});

  function resetDraft() {
    setDraft({ connectionId: "", label: "", appKey: "", secretKey: "", useMock: false });
  }

  function editProfile(profile: KiwoomCredentialProfile) {
    setDraft({
      connectionId: profile.connectionId,
      label: profile.label,
      appKey: profile.appKey ?? "",
      secretKey: "",
      useMock: profile.useMock
    });
    notify({ kind: "info", title: "키 수정", description: `${profile.label} 정보를 편집합니다.` });
  }

  const saveProfile = useMutation({
    mutationFn: () => {
      if (!draft.label.trim()) throw new Error("키 이름을 입력하세요.");
      if (!draft.appKey.trim()) throw new Error("키움 App Key를 입력하세요.");
      if (!draft.connectionId && !draft.secretKey.trim()) throw new Error("새 키를 추가할 때는 Secret Key가 필요합니다.");
      return api.saveKiwoomCredentialProfile(
        {
          connectionId: draft.connectionId || undefined,
          label: draft.label.trim(),
          appKey: draft.appKey.trim(),
          secretKey: draft.secretKey.trim() || undefined,
          useMock: draft.useMock
        },
        token
      );
    },
    onSuccess: async () => {
      resetDraft();
      await queryClient.invalidateQueries({ queryKey: ["settings", "kiwoom-credentials"] });
      await queryClient.invalidateQueries({ queryKey: ["brokers", "kiwoom"] });
      notify({ kind: "success", title: "키움 API 키 저장", description: "키 프로필을 암호화 저장했습니다." });
    },
    onError: (error) => notify({ kind: "error", title: "키 저장 실패", description: (error as Error).message })
  });

  const deleteProfile = useMutation({
    mutationFn: (connectionId: string) => api.deleteKiwoomCredentialProfile(connectionId, token),
    onSuccess: async () => {
      resetDraft();
      await queryClient.invalidateQueries({ queryKey: ["settings", "kiwoom-credentials"] });
      await queryClient.invalidateQueries({ queryKey: ["brokers", "kiwoom"] });
      await queryClient.invalidateQueries({ queryKey: ["broker", "KIWOOM"] });
      notify({ kind: "success", title: "키움 API 키 삭제", description: "키와 연결 토큰을 삭제했습니다." });
    },
    onError: (error) => notify({ kind: "error", title: "키 삭제 실패", description: (error as Error).message })
  });

  const connectProfile = useMutation({
    mutationFn: (payload: { credentialId: string; accountNo?: string; accountNos?: string[] }) =>
      api.connectKiwoom(payload, token),
    onSuccess: async (data) => {
      if (data.credentialId) {
        setDiscoveredAccounts((current) => ({ ...current, [data.credentialId ?? ""]: data.accounts }));
      }
      await queryClient.invalidateQueries({ queryKey: ["settings", "kiwoom-credentials"] });
      await queryClient.invalidateQueries({ queryKey: ["brokers", "kiwoom"] });
      await queryClient.invalidateQueries({ queryKey: ["broker", "KIWOOM"] });
      notify({ kind: data.connected ? "success" : "info", title: "키움 계좌 조회", description: data.message });
    },
    onError: (error) => notify({ kind: "error", title: "키움 계좌 조회 실패", description: (error as Error).message })
  });

  const profiles = profilesQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>키움 REST API 키 설정</CardTitle>
            <p className="mt-2 text-sm text-slate-500">키움 API 키를 여러 개 저장하고, 각 키로 조회되는 계좌를 여러 개 등록합니다.</p>
          </div>
          <Button variant="outline" onClick={resetDraft}>
            새 키 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {profilesQuery.isLoading ? <LoadingState label="키움 API 키 목록을 불러오고 있습니다." /> : null}
        {profilesQuery.isError ? <ErrorState message={(profilesQuery.error as Error).message} onRetry={() => profilesQuery.refetch()} /> : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]">
            <label className="block text-sm font-bold text-slate-700">
              키 이름
              <Input
                className="mt-2"
                value={draft.label}
                placeholder="예: 실전 주계좌"
                onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              App Key
              <Input
                className="mt-2"
                value={draft.appKey}
                placeholder="키움 Open API App Key"
                onChange={(event) => setDraft((current) => ({ ...current, appKey: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Secret Key
              <Input
                className="mt-2"
                type="password"
                value={draft.secretKey}
                placeholder={draft.connectionId ? "변경할 때만 입력" : "새 키 추가 시 필수"}
                onChange={(event) => setDraft((current) => ({ ...current, secretKey: event.target.value }))}
              />
            </label>
          </div>
          <label className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={draft.useMock}
              onChange={(event) => setDraft((current) => ({ ...current, useMock: event.target.checked }))}
            />
            <span>
              모의투자 API 사용
              <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">
                실전 App Key면 해제, 모의투자 App Key면 체크하세요. 둘이 다르면 키움 8030 오류가 납니다.
              </span>
            </span>
          </label>
          <div className="mt-3 rounded-xl bg-white p-4 text-sm text-slate-600">
            <p className="font-bold text-slate-800">저장 대상: {draft.connectionId ? "기존 키 수정" : "새 키 추가"}</p>
            <p className="mt-1">투자구분: {draft.useMock ? "모의투자" : "실전투자"}</p>
            <p className="mt-1">API 주소: {draft.useMock ? "https://mockapi.kiwoom.com" : "https://api.kiwoom.com"}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {saveProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              {draft.connectionId ? "키 수정 저장" : "키 추가 저장"}
            </Button>
            <Button variant="ghost" onClick={resetDraft}>
              입력 초기화
            </Button>
          </div>
        </div>

        {profiles.length === 0 && !profilesQuery.isLoading ? (
          <EmptyState title="저장된 키움 API 키가 없습니다." description="실전/모의 구분에 맞춰 키를 추가한 뒤 계좌를 조회하세요." />
        ) : null}

        <div className="grid gap-4">
          {profiles.map((profile) => (
            <KiwoomCredentialProfileCard
              key={profile.connectionId}
              profile={profile}
              discoveredAccounts={discoveredAccounts[profile.connectionId] ?? []}
              loading={connectProfile.isPending || deleteProfile.isPending}
              onEdit={() => editProfile(profile)}
              onDelete={() => deleteProfile.mutate(profile.connectionId)}
              onLookup={() => connectProfile.mutate({ credentialId: profile.connectionId })}
              onRegister={(accountNo) => connectProfile.mutate({ credentialId: profile.connectionId, accountNo })}
              onRegisterAll={(accountNos) => connectProfile.mutate({ credentialId: profile.connectionId, accountNos })}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function KiwoomCredentialProfileCard({
  profile,
  discoveredAccounts,
  loading,
  onEdit,
  onDelete,
  onLookup,
  onRegister,
  onRegisterAll
}: {
  profile: KiwoomCredentialProfile;
  discoveredAccounts: Array<{ brokerAccountNo: string | null; accountAlias: string }>;
  loading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLookup: () => void;
  onRegister: (accountNo: string) => void;
  onRegisterAll: (accountNos: string[]) => void;
}) {
  const registeredAccountNos = new Set(profile.accounts.map((account) => account.brokerAccountNo).filter(Boolean));
  const unregisteredAccountNos = discoveredAccounts
    .map((account) => account.brokerAccountNo)
    .filter((accountNo): accountNo is string => Boolean(accountNo) && !registeredAccountNos.has(accountNo));

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-black text-slate-950">{profile.label}</p>
            <span className={cn("rounded-full px-2 py-1 text-xs font-black", profile.useMock ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700")}>
              {profile.useMock ? "모의투자" : "실전투자"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
              {profile.accounts.length}개 계좌 등록
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">App Key {profile.appKeyPreview} · Secret {profile.secretPreview ?? "저장됨"}</p>
          <p className="mt-1 text-xs text-slate-500">{profile.baseUrl}</p>
          {profile.updatedAt ? <p className="mt-1 text-xs text-slate-400">마지막 저장 {formatDateTime(profile.updatedAt)}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            수정
          </Button>
          <Button size="sm" onClick={onLookup} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            계좌 조회
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={loading}>
            삭제
          </Button>
        </div>
      </div>

      {discoveredAccounts.length > 0 ? (
        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-black text-slate-900">조회된 계좌</p>
            <Button size="sm" variant="outline" onClick={() => onRegisterAll(unregisteredAccountNos)} disabled={loading || unregisteredAccountNos.length === 0}>
              미등록 계좌 전체 등록
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {discoveredAccounts.map((account) => {
              const accountNo = account.brokerAccountNo ?? "";
              const registered = Boolean(accountNo && registeredAccountNos.has(accountNo));
              return (
                <div key={accountNo || account.accountAlias} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{account.accountAlias}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{accountNo ? maskAccountNoForUi(accountNo) : "계좌번호 없음"}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-1 text-xs font-black", registered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {registered ? "등록됨" : "미등록"}
                    </span>
                  </div>
                  <Button className="mt-3" size="sm" onClick={() => accountNo && onRegister(accountNo)} disabled={loading || !accountNo || registered}>
                    계좌 등록
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {profile.accounts.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {profile.accounts.map((account) => (
            <div key={account.accountId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">{account.accountAlias}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {account.brokerAccountNo ? maskAccountNoForUi(account.brokerAccountNo) : "계좌번호 없음"}
              </p>
              <p className="mt-1 text-xs text-slate-500">상태 {account.credentialStatus}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function KiwoomCredentialSettings({ token }: { token: string }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "kiwoom-credential"], queryFn: () => api.kiwoomCredential(token) });
  const statusQuery = useQuery({ queryKey: ["brokers", "kiwoom", "status"], queryFn: () => api.kiwoomStatus(token) });
  const [draft, setDraft] = useState({ appKey: "", secretKey: "", useMock: false });

  useEffect(() => {
    if (!query.data) return;
    setDraft((current) => ({
      appKey: current.appKey || query.data.appKey || "",
      secretKey: "",
      useMock: query.data.useMock
    }));
  }, [query.data]);

  const saveCredential = useMutation({
    mutationFn: () => {
      if (!draft.appKey.trim()) throw new Error("키움 App Key를 입력하세요.");
      if (query.data?.source !== "DB" && !draft.secretKey.trim()) {
        throw new Error("처음 저장할 때는 Secret Key가 필요합니다.");
      }
      return api.saveKiwoomCredential(
        {
          appKey: draft.appKey.trim(),
          secretKey: draft.secretKey.trim() || undefined,
          useMock: draft.useMock
        },
        token
      );
    },
    onSuccess: async () => {
      setDraft((current) => ({ ...current, secretKey: "" }));
      await queryClient.invalidateQueries({ queryKey: ["settings", "kiwoom-credential"] });
      await queryClient.invalidateQueries({ queryKey: ["brokers", "kiwoom"] });
      notify({ kind: "success", title: "키움 API 키 저장", description: "DB에 암호화 저장했고 키움 연결에 바로 사용됩니다." });
    },
    onError: (error) => notify({ kind: "error", title: "키 저장 실패", description: (error as Error).message })
  });

  const deleteCredential = useMutation({
    mutationFn: () => api.deleteKiwoomCredential(token),
    onSuccess: async () => {
      setDraft({ appKey: "", secretKey: "", useMock: false });
      await queryClient.invalidateQueries({ queryKey: ["settings", "kiwoom-credential"] });
      await queryClient.invalidateQueries({ queryKey: ["brokers", "kiwoom"] });
      notify({ kind: "success", title: "키움 API 키 삭제", description: "저장된 키움 API 키를 삭제했습니다." });
    },
    onError: (error) => notify({ kind: "error", title: "키 삭제 실패", description: (error as Error).message })
  });

  const connectKiwoom = useMutation({
    mutationFn: (payload?: { accountNo?: string; accountNos?: string[]; connectAll?: boolean }) =>
      api.connectKiwoom(payload ?? {}, token),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["brokers", "kiwoom"] });
      await queryClient.invalidateQueries({ queryKey: ["broker", "KIWOOM"] });
      notify({ kind: data.connected ? "success" : "info", title: "키움 계좌 조회", description: data.message });
    },
    onError: (error) => notify({ kind: "error", title: "키움 계좌 조회 실패", description: (error as Error).message })
  });

  const sourceLabel = query.data?.source === "DB" ? "DB 저장 키" : query.data?.source === "ENV" ? "환경변수 키" : "저장된 키 없음";
  const canDelete = query.data?.source === "DB";
  const discoveredAccounts = connectKiwoom.data?.accounts ?? [];
  const registeredAccountNos = new Set((statusQuery.data?.accounts ?? []).map((account) => account.brokerAccountNo).filter(Boolean));
  const unregisteredAccountNos = discoveredAccounts
    .map((account) => account.brokerAccountNo)
    .filter((accountNo): accountNo is string => Boolean(accountNo) && !registeredAccountNos.has(accountNo));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>키움 REST API 키 설정</CardTitle>
            <p className="mt-2 text-sm text-slate-500">키움 App Key와 Secret Key를 저장하면 키움 계좌 조회와 보유종목 동기화에 사용됩니다.</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-black", query.data?.source === "NONE" ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-700")}>
            {sourceLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? <LoadingState label="키움 API 키 설정을 불러오고 있습니다." /> : null}
        {query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /> : null}
        {query.data ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                App Key
                <Input
                  className="mt-2"
                  value={draft.appKey}
                  placeholder="키움 Open API App Key"
                  onChange={(event) => setDraft((current) => ({ ...current, appKey: event.target.value }))}
                />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Secret Key
                <Input
                  className="mt-2"
                  type="password"
                  value={draft.secretKey}
                  placeholder={query.data.secretPreview ? `저장됨: ${query.data.secretPreview}` : "처음 저장할 때 필수"}
                  onChange={(event) => setDraft((current) => ({ ...current, secretKey: event.target.value }))}
                />
              </label>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={draft.useMock}
                onChange={(event) => setDraft((current) => ({ ...current, useMock: event.target.checked }))}
              />
              <span>
                모의투자 API 사용
                <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">
                  키움 실전 App Key면 체크를 해제하고, 모의투자 App Key면 체크하세요. 투자구분이 다르면 8030 오류가 납니다.
                </span>
              </span>
            </label>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-bold text-slate-800">현재 상태: {query.data.status}</p>
              <p className="mt-1">Secret: {query.data.secretPreview ?? "저장되지 않음"}</p>
              <p className="mt-1">투자구분: {draft.useMock ? "모의투자" : "실전투자"}</p>
              <p className="mt-1">API 주소: {draft.useMock ? "https://mockapi.kiwoom.com" : "https://api.kiwoom.com"}</p>
              {query.data.updatedAt ? <p className="mt-1">마지막 저장: {formatDateTime(query.data.updatedAt)}</p> : null}
              {query.data.source === "ENV" ? <p className="mt-1 text-blue-600">환경변수 키가 감지되었습니다. 화면에서 저장하면 DB 저장 키가 우선 사용됩니다.</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveCredential.mutate()} disabled={saveCredential.isPending}>
                {saveCredential.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                키 저장
              </Button>
              <Button variant="secondary" onClick={() => connectKiwoom.mutate({})} disabled={connectKiwoom.isPending || query.data.source === "NONE"}>
                {connectKiwoom.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                저장된 키로 계좌 조회
              </Button>
              <Button variant="ghost" onClick={() => deleteCredential.mutate()} disabled={!canDelete || deleteCredential.isPending}>
                삭제
              </Button>
            </div>
            {discoveredAccounts.length > 0 ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-slate-950">조회된 영웅문 계좌</p>
                    <p className="mt-1 text-xs text-slate-500">같은 키움 App Key로 조회되는 계좌를 여러 개 등록할 수 있습니다.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => connectKiwoom.mutate({ accountNos: unregisteredAccountNos })}
                    disabled={connectKiwoom.isPending || unregisteredAccountNos.length === 0}
                  >
                    미등록 계좌 전체 등록
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {discoveredAccounts.map((account) => {
                    const accountNo = account.brokerAccountNo ?? "";
                    const registered = Boolean(accountNo && registeredAccountNos.has(accountNo));
                    return (
                      <div key={accountNo || account.accountAlias} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-950">{account.accountAlias}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {accountNo ? maskAccountNoForUi(accountNo) : "계좌번호 없음"}
                            </p>
                          </div>
                          <span className={cn("rounded-full px-2 py-1 text-xs font-black", registered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                            {registered ? "등록됨" : "미등록"}
                          </span>
                        </div>
                        <Button
                          className="mt-3"
                          size="sm"
                          onClick={() => accountNo && connectKiwoom.mutate({ accountNo })}
                          disabled={connectKiwoom.isPending || !accountNo || registered}
                        >
                          계좌 등록
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : statusQuery.data?.accounts.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-slate-950">등록된 영웅문 계좌</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {statusQuery.data.accounts.map((account) => (
                    <div key={account.accountId} className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="font-black text-slate-950">{account.accountAlias}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {account.brokerAccountNo ? maskAccountNoForUi(account.brokerAccountNo) : "계좌번호 없음"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RebalancePanel({ token }: { token: string }) {
  const { notify } = useToast();
  const [targets, setTargets] = useState(defaultTargets);
  const mutation = useMutation({
    mutationFn: () => api.rebalance(targets, token),
    onSuccess: () => notify({ kind: "success", title: "리밸런싱 계산 완료", description: "현재 보유금액 기준 추천안을 생성했습니다." }),
    onError: (error) => notify({ kind: "error", title: "계산 실패", description: (error as Error).message })
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <SettingsMini targets={targets} setTargets={setTargets} onCalculate={() => mutation.mutate()} loading={mutation.isPending} />
      <Card>
        <CardHeader>
          <CardTitle>추천 결과</CardTitle>
        </CardHeader>
        <CardContent>
          {!mutation.data && !mutation.isError ? <EmptyState title="계산 대기 중" description="목표 비중을 입력하고 계산을 누르세요." /> : null}
          {mutation.isError ? <ErrorState message={(mutation.error as Error).message} onRetry={() => mutation.mutate()} /> : null}
          {mutation.data ? (
            <div className="space-y-3">
              {mutation.data.recommendations.map((item) => (
                <div key={item.targetKey} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_auto_auto]">
                  <div>
                    <p className="font-black text-slate-950">{item.targetKey}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.reason}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>현재 {item.currentWeight.toFixed(1)}%</p>
                    <p>목표 {item.targetWeight.toFixed(1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-lg font-black", item.action === "BUY" ? "text-red-500" : item.action === "SELL" ? "text-blue-500" : "text-slate-600")}>
                      {item.action === "BUY" ? "매수" : item.action === "SELL" ? "매도" : "유지"}
                    </p>
                    <p className="text-sm font-bold">{formatKrw(item.differenceAmount)}</p>
                    <p className="text-xs text-slate-500">추천 점수 {item.score}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsMini({
  targets,
  setTargets,
  onCalculate,
  loading
}: {
  targets: PortfolioTargetInput[];
  setTargets: (targets: PortfolioTargetInput[]) => void;
  onCalculate: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>목표 비중 입력</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {targets.map((target, index) => (
          <label key={target.targetKey} className="block text-sm font-bold text-slate-700">
            {target.targetKey}
            <Input
              className="mt-2"
              type="number"
              value={target.targetWeight}
              onChange={(event) => {
                const next = [...targets];
                next[index] = { ...target, targetWeight: Number(event.target.value) };
                setTargets(next);
              }}
            />
          </label>
        ))}
        <Button className="w-full" onClick={onCalculate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          리밸런싱 계산
        </Button>
      </CardContent>
    </Card>
  );
}

function AiPanel({ token, marketIndicators }: { token: string; marketIndicators?: MarketIndicatorsResult }) {
  const query = useQuery({ queryKey: ["summary", "ai"], queryFn: () => api.summary(token) });
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  return query.data ? <AiInsightCard data={query.data} marketIndicators={marketIndicators} onNavigate={() => undefined} /> : null;
}

function SimpleAnalysisPanel({ token, kind }: { token: string; kind: "dividend" | "tax" }) {
  const query = useQuery({ queryKey: ["summary", kind], queryFn: () => api.summary(token) });
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const data = query.data;
  if (!data) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{kind === "dividend" ? "배당 캘린더" : "세금/절세 분석"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard icon={Gift} label="연간 배당 예상" value={formatKrw(data.metrics.annualDividendEstimate)} caption="보유 종목 기준" tone="purple" />
          <KpiCard icon={CircleDollarSign} label="예상 과세 후보" value="12,450,000원" caption="사용자 입력 필요" tone="red" />
          <KpiCard icon={Globe2} label="환율 노출도" value={`${data.metrics.fxExposureRate.toFixed(1)}%`} caption="USD 기준" tone="green" />
        </div>
      </CardContent>
    </Card>
  );
}

function logout(router: ReturnType<typeof useRouter>, notify: ReturnType<typeof useToast>["notify"]) {
  localStorage.removeItem("invest-hub-token");
  localStorage.removeItem("invest-hub-user");
  notify({ kind: "info", title: "로그아웃", description: "로그인 화면으로 이동합니다." });
  router.push("/login");
}

function navLabel(view: ViewKey) {
  if (isAccountView(view)) return "계좌 대시보드";
  const labels: Record<StaticViewKey, string> = {
    overview: "종합",
    upload: "업로드 관리",
    settings: "설정",
    ai: "AI 분석",
    rebalance: "리밸런싱 추천",
    dividend: "배당 캘린더",
    tax: "세금/절세",
    market: "시장 지표",
    alerts: "알림 센터"
  };
  return labels[view];
}

function isAccountView(view: ViewKey): view is AccountViewKey {
  return view.startsWith("account:");
}

function buildAccountNavigation(summary?: PortfolioSummary): AccountNavigationItem[] {
  if (!summary?.holdings.length) return [];
  const grouped = new Map<string, Holding[]>();

  for (const holding of summary.holdings) {
    const key = `${holding.broker}|${cleanDisplayName(holding.accountAlias)}|${holding.accountType}`;
    grouped.set(key, [...(grouped.get(key) ?? []), holding]);
  }

  return Array.from(grouped.entries())
    .map(([rawKey, holdings]) => {
      const first = holdings[0];
      const metrics = metricsFromHoldings(holdings);
      const brokerLabel = brokerLabels[first.broker];
      const accountAlias = cleanDisplayName(first.accountAlias);
      const shortName = buildAccountShortName(first.broker, accountAlias, first.accountType, holdings);

      return {
        key: `account:${stableHash(rawKey)}` as AccountViewKey,
        id: rawKey,
        broker: first.broker,
        brokerLabel,
        accountAlias,
        accountType: first.accountType,
        displayName: `${brokerShortLabel(first.broker)} ${shortName}`,
        shortName,
        holdings,
        marketValue: metrics.totalMarketValue,
        profitLoss: metrics.totalProfitLoss,
        returnRate: metrics.returnRate,
        annualDividendEstimate: metrics.annualDividendEstimate
      };
    })
    .sort((a, b) => brokerOrder(a.broker) - brokerOrder(b.broker) || b.marketValue - a.marketValue);
}

function buildBrokerAccountGroups(accounts: AccountNavigationItem[]) {
  const groups = new Map<BrokerKey, { broker: BrokerKey; label: string; accounts: AccountNavigationItem[] }>();
  for (const account of accounts) {
    const group = groups.get(account.broker) ?? { broker: account.broker, label: account.brokerLabel, accounts: [] };
    group.accounts.push(account);
    groups.set(account.broker, group);
  }

  return Array.from(groups.values()).sort((a, b) => brokerOrder(a.broker) - brokerOrder(b.broker));
}

function brokerOrder(broker: BrokerKey) {
  const order: Record<BrokerKey, number> = { TOSS: 0, NAMUH: 1, KIWOOM: 2 };
  return order[broker] ?? 99;
}

function buildAccountShortName(broker: BrokerKey, alias: string, accountType: string, holdings: Holding[]) {
  const typeLabel = accountTypeLabel(accountType);
  const genericNames = [brokerLabels[broker], brokerShortLabel(broker), "키움 계좌", "토스증권", "나무증권"];
  const normalizedAlias = alias.replace(/\s+/g, " ").trim();
  const maskedAccount = normalizedAlias.match(/\d{2}\*+\d{2}/)?.[0];
  const marketLabel = holdings.every((holding) => !isDomesticHolding(holding))
    ? "해외주식"
    : holdings.every(isDomesticHolding)
      ? "국내주식"
      : typeLabel;

  if (maskedAccount) {
    return `${maskedAccount} ${marketLabel === "국내주식" || marketLabel === "해외주식" ? marketLabel : typeLabel}`;
  }
  if (!normalizedAlias || genericNames.some((name) => normalizedAlias === name || normalizedAlias.startsWith(`${name} `))) {
    return marketLabel === "국내주식" || marketLabel === "해외주식" ? marketLabel : typeLabel;
  }
  if (normalizedAlias.includes(typeLabel)) return normalizedAlias;
  if (typeLabel === "일반계좌" && (marketLabel === "국내주식" || marketLabel === "해외주식")) return `${normalizedAlias} ${marketLabel}`;
  return `${normalizedAlias} ${typeLabel}`;
}

function metricsFromHoldings(holdings: Holding[]): Metric {
  const totalMarketValue = holdings.reduce((sum, holding) => sum + safeNumber(holding.marketValue), 0);
  const totalProfitLoss = holdings.reduce((sum, holding) => sum + safeNumber(holding.profitLoss), 0);
  const totalCost = Math.max(0, totalMarketValue - totalProfitLoss);
  const annualDividendEstimate = holdings.reduce((sum, holding) => sum + safeNumber(holding.annualDividendEstimate), 0);
  const usdMarketValue = holdings.filter((holding) => holding.currency === "USD").reduce((sum, holding) => sum + safeNumber(holding.marketValue), 0);

  return {
    totalMarketValue,
    totalProfitLoss,
    returnRate: totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0,
    annualDividendEstimate,
    fxExposureRate: totalMarketValue > 0 ? (usdMarketValue / totalMarketValue) * 100 : 0,
    fxImpactAmount: 0
  };
}

function assetAllocationFromHoldings(holdings: Holding[]): ChartDatum[] {
  const total = holdings.reduce((sum, holding) => sum + safeNumber(holding.marketValue), 0);
  const cashValue = Math.max(0, total * 0.044);
  const investedTotal = Math.max(0, total - cashValue);
  const overseasStockValue = holdings
    .filter((holding) => !isDomesticHolding(holding) && holding.assetType !== "ETF")
    .reduce((sum, holding) => sum + holding.marketValue, 0);
  const domesticStockValue = holdings
    .filter((holding) => isDomesticHolding(holding) && holding.assetType !== "ETF")
    .reduce((sum, holding) => sum + holding.marketValue, 0);
  const etfValue = holdings.filter((holding) => holding.assetType === "ETF").reduce((sum, holding) => sum + holding.marketValue, 0);
  const rawInvestedTotal = overseasStockValue + domesticStockValue + etfValue;
  const scale = rawInvestedTotal > 0 ? investedTotal / rawInvestedTotal : 1;
  const buckets = [
    {
      name: "해외 주식",
      value: overseasStockValue * scale,
      color: "#3b82f6"
    },
    {
      name: "국내 주식",
      value: domesticStockValue * scale,
      color: "#48c6a7"
    },
    {
      name: "ETF",
      value: etfValue * scale,
      color: "#8b5cf6"
    },
    {
      name: "현금",
      value: cashValue,
      color: "#f4bc4f"
    }
  ];

  return buckets.map((bucket) => ({
    ...bucket,
    rate: total > 0 ? (bucket.value / total) * 100 : 0
  }));
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function brokerGroupIcon(broker: BrokerKey) {
  const icons: Record<BrokerKey, ElementType> = {
    TOSS: Wallet,
    NAMUH: PieIcon,
    KIWOOM: BarChart3
  };
  return icons[broker];
}

function brokerGroupIconSrc(broker: BrokerKey) {
  const icons: Partial<Record<BrokerKey, string>> = {
    TOSS: "/brokers/toss-symbol-primary.png",
    KIWOOM: "/brokers/kiwoom-ci-symbol.png"
  };
  return icons[broker];
}

function brokerAccentClass(broker: BrokerKey) {
  const classes: Record<BrokerKey, string> = {
    TOSS: "bg-blue-500",
    NAMUH: "bg-emerald-500",
    KIWOOM: "bg-violet-500"
  };
  return classes[broker];
}

function brokerColor(broker: BrokerKey) {
  const colors: Record<BrokerKey, string> = {
    TOSS: "#3B82F6",
    NAMUH: "#22C55E",
    KIWOOM: "#A855F7"
  };
  return colors[broker];
}

function sortMarketIndicators(indicators: MarketIndicatorsResult["indicators"]) {
  const order = ["KOSPI", "KOSDAQ", "SPX", "NASDAQ100", "NDX", "WTI", "USD_KRW", "FEAR_GREED", "VIX", "BTC"];
  const seen = new Set<string>();

  return [...indicators]
    .filter((indicator) => order.includes(indicator.symbol))
    .sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol))
    .filter((indicator) => {
      const group = indicator.symbol === "NASDAQ100" || indicator.symbol === "NDX" ? "NASDAQ" : indicator.symbol;
      if (seen.has(group)) return false;
      seen.add(group);
      return true;
    })
    .slice(0, 7);
}

function selectDashboardMarketIndicators(indicators: MarketIndicatorsResult["indicators"]) {
  const order = ["KOSPI", "KOSDAQ", "SPX", "NASDAQ100", "NDX", "WTI", "USD_KRW"];
  const seen = new Set<string>();

  return [...indicators]
    .filter((indicator) => order.includes(indicator.symbol))
    .sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol))
    .filter((indicator) => {
      const group = indicator.symbol === "NASDAQ100" || indicator.symbol === "NDX" ? "NASDAQ" : indicator.symbol;
      if (seen.has(group)) return false;
      seen.add(group);
      return true;
    })
    .slice(0, 6);
}

function findFearGreedIndicator(data?: MarketIndicatorsResult) {
  return data?.indicators.find((indicator) => indicator.symbol === "FEAR_GREED") ?? null;
}

function buildHeroChartData(totalValue: number, todayChange: number) {
  const base = Math.max(1, safeNumber(totalValue));
  const safeChange = safeNumber(todayChange);
  const start = Math.max(1, base - safeChange - base * 0.018);
  const pattern = [0, -0.018, -0.011, 0.009, -0.004, 0.014, 0.01, 0.032, 0.027, 0.041, 0.036, 0.058, 0.055, 0.073, 0.084, 0.079, 0.097, 0.104, 0.119, 0.126, 0.141, 0.137, 0.153, 0.151];

  return pattern.map((point, index) => ({
    name: index.toString(),
    value: start + (base - start) * (index / (pattern.length - 1)) + base * 0.035 * point
  }));
}

function buildIndicatorSparklineData(indicator: MarketIndicatorsResult["indicators"][number]) {
  const current = safeNumber(indicator.value);
  const change = safeNumber(indicator.change);
  if (!Number.isFinite(current) || current <= 0 || Math.abs(change) < 0.000001) return [];

  const previous = current - change;
  const amplitude = Math.max(Math.abs(change) * 0.32, Math.abs(current) * 0.0008);
  const direction = change >= 0 ? 1 : -1;

  return Array.from({ length: 10 }).map((_, index) => {
    const t = index / 9;
    const trend = previous + change * t;
    const curve = Math.sin(t * Math.PI * 2.4) * amplitude * (1 - Math.abs(t - 0.5) * 0.7);
    return trend + curve * direction;
  });
}

function buildAggregatedHoldings(data: PortfolioSummary, searchText: string, sortKey: HoldingSortKey): AggregatedHolding[] {
  const totalMarketValue = data.metrics.totalMarketValue;
  const grouped = new Map<string, AggregatedHolding>();

  for (const holding of data.holdings) {
    const key = `${holding.symbol}:${holding.marketCountry}`;
    const existing =
      grouped.get(key) ??
      ({
        key,
        securityId: holding.securityId,
        symbol: holding.symbol,
        name: holding.name,
        marketCountry: holding.marketCountry,
        currency: holding.currency,
        assetType: holding.assetType,
        logoUrl: holding.logoUrl,
        companyDomain: holding.companyDomain,
        logoSource: holding.logoSource,
        totalQuantity: 0,
        marketValue: 0,
        costAmount: 0,
        profitLoss: 0,
        profitLossRate: 0,
        portfolioWeight: 0,
        brokerCount: 0,
        accountCount: 0,
        brokers: [],
        accounts: []
      } satisfies AggregatedHolding);

    existing.totalQuantity += holding.quantity;
    existing.marketValue += holding.marketValue;
    existing.costAmount += holding.costAmount;
    existing.profitLoss += holding.profitLoss;
    existing.accounts.push({
      id: holding.id,
      broker: holding.broker,
      accountAlias: holding.accountAlias,
      accountType: holding.accountType,
      quantity: holding.quantity,
      marketValue: holding.marketValue,
      profitLoss: holding.profitLoss,
      profitLossRate: holding.profitLossRate,
      weightWithinHolding: 0
    });

    grouped.set(key, existing);
  }

  const query = searchText.trim().toLowerCase();
  return Array.from(grouped.values())
    .map((holding) => {
      const brokers = Array.from(new Set(holding.accounts.map((account) => account.broker)));
      const accounts = holding.accounts
        .map((account) => ({
          ...account,
          weightWithinHolding: holding.marketValue > 0 ? (account.marketValue / holding.marketValue) * 100 : 0
        }))
        .sort((a, b) => b.marketValue - a.marketValue);

      return {
        ...holding,
        profitLossRate: holding.costAmount > 0 ? (holding.profitLoss / holding.costAmount) * 100 : 0,
        portfolioWeight: totalMarketValue > 0 ? (holding.marketValue / totalMarketValue) * 100 : 0,
        brokers,
        brokerCount: brokers.length,
        accountCount: accounts.length,
        accounts
      };
    })
    .filter((holding) => !query || `${holding.symbol} ${holding.name}`.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sortKey === "weight") return b.portfolioWeight - a.portfolioWeight;
      if (sortKey === "return") return b.profitLossRate - a.profitLossRate;
      return b.marketValue - a.marketValue;
    });
}

function buildTossHoldingRows(holdings: Holding[], totalMarketValue: number, searchText: string, sortKey: TossHoldingSortKey): TossHoldingRow[] {
  const grouped = new Map<string, TossHoldingRow>();

  for (const holding of holdings) {
    const quantity = safeNumber(holding.quantity);
    const marketValue = safeNumber(holding.marketValue);
    const costAmount = safeNumber(holding.costAmount);
    const profitLoss = safeNumber(holding.profitLoss);
    const averagePurchasePrice = safeNumber(holding.averagePurchasePrice) || (quantity > 0 ? costAmount / quantity : 0);
    const marketPrice = safeNumber(holding.marketPrice) || (quantity > 0 ? marketValue / quantity : 0);
    const key = `${holding.symbol}:${holding.marketCountry}`;
    const existing =
      grouped.get(key) ??
      ({
        key,
        securityId: holding.securityId,
        symbol: holding.symbol,
        name: holding.name,
        marketCountry: holding.marketCountry,
        currency: holding.currency,
        assetType: holding.assetType,
        logoUrl: holding.logoUrl,
        companyDomain: holding.companyDomain,
        logoSource: holding.logoSource,
        totalQuantity: 0,
        averagePurchasePrice: 0,
        marketPrice: 0,
        marketValue: 0,
        costAmount: 0,
        profitLoss: 0,
        profitLossRate: 0,
        portfolioWeight: 0,
        brokerCount: 0,
        accountCount: 0,
        brokers: [],
        accounts: [],
        brokerBreakdown: []
      } satisfies TossHoldingRow);

    existing.totalQuantity += quantity;
    existing.averagePurchasePrice += averagePurchasePrice * quantity;
    existing.marketPrice += marketPrice * quantity;
    existing.marketValue += marketValue;
    existing.costAmount += costAmount;
    existing.profitLoss += profitLoss;
    existing.accounts.push({
      id: holding.id,
      broker: holding.broker,
      accountAlias: holding.accountAlias,
      accountType: holding.accountType,
      quantity,
      averagePurchasePrice,
      marketPrice,
      marketValue,
      costAmount,
      profitLoss,
      profitLossRate: safeNumber(holding.profitLossRate),
      weightWithinHolding: 0
    });

    grouped.set(key, existing);
  }

  const query = searchText.trim().toLowerCase();
  return Array.from(grouped.values())
    .map((holding) => {
      const brokers = Array.from(new Set(holding.accounts.map((account) => account.broker)));
      const accounts = holding.accounts
        .map((account) => ({
          ...account,
          weightWithinHolding: holding.marketValue > 0 ? (account.marketValue / holding.marketValue) * 100 : 0
        }))
        .sort((a, b) => b.marketValue - a.marketValue);
      const brokerBreakdown = brokers
        .map((broker) => {
          const brokerAccounts = accounts.filter((account) => account.broker === broker);
          return {
            broker,
            quantity: brokerAccounts.reduce((sum, account) => sum + account.quantity, 0),
            marketValue: brokerAccounts.reduce((sum, account) => sum + account.marketValue, 0)
          };
        })
        .sort((a, b) => b.marketValue - a.marketValue);

      return {
        ...holding,
        averagePurchasePrice: holding.totalQuantity > 0 ? holding.averagePurchasePrice / holding.totalQuantity : 0,
        marketPrice: holding.totalQuantity > 0 ? holding.marketPrice / holding.totalQuantity : 0,
        profitLossRate: holding.costAmount > 0 ? (holding.profitLoss / holding.costAmount) * 100 : 0,
        portfolioWeight: totalMarketValue > 0 ? (holding.marketValue / totalMarketValue) * 100 : 0,
        brokers,
        brokerCount: brokers.length,
        accountCount: accounts.length,
        accounts,
        brokerBreakdown
      };
    })
    .filter((holding) => !query || `${holding.symbol} ${holding.name}`.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sortKey === "return") return b.profitLossRate - a.profitLossRate;
      if (sortKey === "profit") return b.profitLoss - a.profitLoss;
      if (sortKey === "name") return (a.name || a.symbol).localeCompare(b.name || b.symbol, "ko-KR");
      return b.marketValue - a.marketValue;
    });
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function cleanDisplayName(value: string) {
  const maskedAccount = value.match(/\d{2}\*+\d{2}/)?.[0];
  if (value.includes("?ㅼ") || value.includes("영웅문")) return maskedAccount ? `키움 ${maskedAccount}` : "키움 계좌";
  if (value.includes("?좎") || value.toLowerCase().includes("toss")) return maskedAccount ? `토스 ${maskedAccount}` : "토스증권";
  if (value.includes("?섎") || value.toLowerCase().includes("namuh")) return maskedAccount ? `나무 ${maskedAccount}` : "나무증권";
  return value;
}

function isDomesticHolding(holding: { marketCountry: string; currency: string }) {
  const country = holding.marketCountry.toUpperCase();
  return country === "KR" || country === "KOR" || country === "KOREA" || holding.currency === "KRW";
}

function marketCountryFlag(holding: { marketCountry: string; currency: string }) {
  if (isDomesticHolding(holding)) return "🇰🇷";
  if (holding.marketCountry.toUpperCase() === "US" || holding.currency === "USD") return "🇺🇸";
  return "해외";
}

function brokerShortLabel(broker: BrokerKey) {
  const labels: Record<BrokerKey, string> = {
    TOSS: "토스",
    NAMUH: "나무",
    KIWOOM: "키움"
  };
  return labels[broker];
}

function formatHoldingPrice(value: number, currency: string) {
  const safeValue = safeNumber(value);
  if (currency === "USD" && Math.abs(safeValue) > 0 && Math.abs(safeValue) < 10000) {
    return `$${safeValue.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
  return formatKrw(safeValue);
}

function formatMarketIndicatorValue(indicator: MarketIndicatorsResult["indicators"][number]) {
  if (indicator.symbol === "USD_KRW") return `${indicator.value.toLocaleString("ko-KR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}원`;
  if (indicator.unit === "USD") return `$${indicator.value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  if (indicator.unit === "PERCENT") return `${indicator.value.toFixed(2)}%`;
  if (indicator.unit === "SCORE") return Math.round(indicator.value).toString();
  return indicator.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function compactIndicatorName(name: string, symbol: string) {
  const names: Record<string, string> = {
    KOSPI: "KOSPI",
    KOSDAQ: "KOSDAQ",
    USD_KRW: "달러/원",
    FEAR_GREED: "공포탐욕",
    US10Y: "미국 10년물",
    SPX: "S&P 500",
    NASDAQ100: "Nasdaq 100",
    NDX: "Nasdaq 100",
    BTC: "비트코인"
  };
  return names[symbol] ?? name.replace("원/달러 환율", "USD/KRW").replace("국제유가 ", "");
}

function formatMarketIndicatorChange(indicator: MarketIndicatorsResult["indicators"][number]) {
  if (indicator.symbol === "USD_KRW") return `${indicator.change.toFixed(2)}원`;
  if (indicator.unit === "USD") return `$${indicator.change.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  if (indicator.unit === "PERCENT") return `${indicator.change.toFixed(2)}%p`;
  return indicator.change.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function formatSignedKrw(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatKrw(Math.abs(value))}`;
}

function formatQuantity(value: number) {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 6 });
}

function accountTypeLabel(value: string) {
  const labels: Record<string, string> = {
    BROKERAGE: "일반계좌",
    ISA: "ISA",
    PENSION_SAVINGS: "연금저축",
    MANUAL: "수동입력"
  };
  return labels[value] ?? value;
}

function formatDateTime(value?: string | null) {
  if (!value) return "아직 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatShortDateTime(value?: string | null) {
  if (!value) return "가격 확인";
  return `${formatDateTime(value)} 기준`;
}

function formatHeaderTime(value?: string | null) {
  if (!value) return "14:31:24";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatInterval(value?: number) {
  if (!value) return "확인 중";
  if (value < 60_000) return `${Math.round(value / 1000)}초`;
  return `${Math.round(value / 60_000)}분`;
}
