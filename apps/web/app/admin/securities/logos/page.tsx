"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImageUp, Loader2, RefreshCw, Save, Search, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, AdminSecurity, SecurityLogoSource } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SecurityLogo } from "@/components/security-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/state";
import { useToast } from "@/components/toast-provider";

type MarketFilter = "ALL" | "KR" | "US";

const token = "cookie-session";
const sourceOptions: SecurityLogoSource[] = ["MANUAL", "UPLOAD", "FINNHUB", "LOGO_DEV", "BRANDFETCH", "FALLBACK"];

export default function AdminSecurityLogosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [searchText, setSearchText] = useState("");
  const [marketCountry, setMarketCountry] = useState<MarketFilter>("ALL");
  const [selected, setSelected] = useState<AdminSecurity | null>(null);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.me(),
    retry: false
  });
  const isAdmin = meQuery.data?.role === "ADMIN";
  const securitiesQuery = useQuery({
    queryKey: ["admin", "securities", searchText, marketCountry],
    queryFn: () => api.adminSecurities({ q: searchText, marketCountry, limit: 120 }, token),
    enabled: isAdmin,
    retry: false
  });

  useEffect(() => {
    if (meQuery.error) router.replace("/login");
  }, [meQuery.error, router]);

  const refreshMutation = useMutation({
    mutationFn: (securityId: string) => api.refreshAdminSecurityLogo(securityId, token),
    onSuccess: () => {
      notify({ kind: "success", title: "외부 로고 갱신 완료", description: "사용 가능한 provider 기준으로 로고를 다시 확인했습니다." });
      void queryClient.invalidateQueries({ queryKey: ["admin", "securities"] });
    },
    onError: (error) => notify({ kind: "error", title: "로고 갱신 실패", description: error instanceof Error ? error.message : "다시 시도해주세요." })
  });

  if (meQuery.isLoading) return <LoadingState label="관리자 권한을 확인하고 있습니다." />;

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] p-6">
        <section className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-2xl font-black text-slate-950">관리자 권한이 필요합니다</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">종목 로고 관리는 ADMIN 계정에서만 사용할 수 있습니다.</p>
          <Button className="mt-6 w-full" variant="outline" onClick={() => router.replace("/dashboard")}>
            대시보드로 돌아가기
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F9FC] px-5 py-8 text-slate-950 lg:px-8">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-blue-600">
              <ArrowLeft className="h-4 w-4" />
              대시보드
            </Link>
            <h1 className="mt-4 text-[30px] font-black tracking-[-0.01em] text-slate-950">종목 로고 관리</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">로고 URL, 업로드 이미지, 외부 provider 갱신을 한곳에서 관리합니다.</p>
          </div>
          <div className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
            ADMIN
          </div>
        </header>

        <section className="rounded-[24px] border border-[#E5EAF0] bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-12 rounded-2xl pl-11 text-sm font-semibold"
                value={searchText}
                placeholder="티커, 종목명, 도메인 검색"
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-3 rounded-2xl bg-slate-100 p-1">
              {(["ALL", "KR", "US"] as MarketFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "h-10 rounded-xl text-sm font-black transition",
                    marketCountry === value ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-950"
                  )}
                  onClick={() => setMarketCountry(value)}
                >
                  {value === "ALL" ? "전체" : value}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs font-bold text-slate-400">
            총 {securitiesQuery.data?.total ?? 0}개 중 {securitiesQuery.data?.items.length ?? 0}개 표시
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {securitiesQuery.isLoading ? (
            <div className="col-span-full rounded-[24px] border border-[#E5EAF0] bg-white p-10">
              <LoadingState label="종목을 불러오고 있습니다." />
            </div>
          ) : (
            securitiesQuery.data?.items.map((security) => (
              <SecurityLogoCard
                key={security.id}
                security={security}
                refreshing={refreshMutation.isPending}
                onEdit={() => setSelected(security)}
                onRefresh={() => refreshMutation.mutate(security.id)}
              />
            ))
          )}
        </section>
      </div>

      <LogoEditModal
        security={selected}
        onClose={() => setSelected(null)}
        onSaved={(security) => {
          setSelected(security);
          void queryClient.invalidateQueries({ queryKey: ["admin", "securities"] });
        }}
      />
    </main>
  );
}

function SecurityLogoCard({
  security,
  refreshing,
  onEdit,
  onRefresh
}: {
  security: AdminSecurity;
  refreshing: boolean;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  return (
    <article className="min-w-0 rounded-[22px] border border-[#E5EAF0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-w-0 items-start gap-4">
        <SecurityLogo
          symbol={security.symbol}
          name={security.name}
          logoUrl={security.logoUrl}
          marketCountry={security.marketCountry}
          size="lg"
          showCountryBadge
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-950">{security.symbol}</h2>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">{security.name}</p>
            </div>
            <LogoSourceBadge source={security.logoSource} />
          </div>
          <p className="mt-3 truncate text-xs font-bold text-slate-400">{security.companyDomain || security.logoUrl || "로고 정보 없음"}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button className="h-10 rounded-xl" variant="outline" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          외부 갱신
        </Button>
        <Button className="h-10 rounded-xl" onClick={onEdit}>
          설정 관리
        </Button>
      </div>
    </article>
  );
}

function LogoEditModal({
  security,
  onClose,
  onSaved
}: {
  security: AdminSecurity | null;
  onClose: () => void;
  onSaved: (security: AdminSecurity) => void;
}) {
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [marketCountry, setMarketCountry] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoSource, setLogoSource] = useState<SecurityLogoSource>("MANUAL");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!security) return;
    setName(security.name);
    setMarketCountry(security.marketCountry);
    setCompanyDomain(security.companyDomain ?? "");
    setLogoUrl(security.logoUrl ?? "");
    setLogoSource((sourceOptions.includes(security.logoSource as SecurityLogoSource) ? security.logoSource : "MANUAL") as SecurityLogoSource);
    setFile(null);
    setPreviewUrl(null);
  }, [security]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!security) throw new Error("종목을 선택하세요.");
      const updated = await api.updateAdminSecurityLogo(
        security.id,
        {
          name,
          marketCountry,
          companyDomain: companyDomain || null,
          logoUrl: logoUrl || null,
          logoSource
        },
        token
      );
      return file ? api.uploadAdminSecurityLogo(updated.id, file, token) : updated;
    },
    onSuccess: (updated) => {
      notify({ kind: "success", title: "로고 저장 완료", description: `${updated.symbol} 로고 정보를 저장했습니다.` });
      onSaved(updated);
      setFile(null);
      setPreviewUrl(null);
    },
    onError: (error) => notify({ kind: "error", title: "저장 실패", description: error instanceof Error ? error.message : "다시 시도해주세요." })
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!security) throw new Error("종목을 선택하세요.");
      return api.deleteAdminSecurityLogo(security.id, token);
    },
    onSuccess: (updated) => {
      notify({ kind: "success", title: "로고 삭제 완료", description: "fallback 아이콘으로 전환했습니다." });
      onSaved(updated);
      setLogoUrl("");
      setLogoSource("FALLBACK");
    },
    onError: (error) => notify({ kind: "error", title: "삭제 실패", description: error instanceof Error ? error.message : "다시 시도해주세요." })
  });

  const preview = useMemo(() => previewUrl || logoUrl || security?.logoUrl || null, [logoUrl, previewUrl, security?.logoUrl]);

  if (!security) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <section className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <SecurityLogo
              symbol={security.symbol}
              name={security.name}
              logoUrl={preview}
              marketCountry={marketCountry || security.marketCountry}
              size="xl"
              showCountryBadge
            />
            <div className="min-w-0">
              <p className="text-sm font-black text-blue-600">로고 설정 관리</p>
              <h2 className="mt-1 truncate text-2xl font-black text-slate-950">{security.symbol}</h2>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">{security.name}</p>
            </div>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-950" onClick={onClose} aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SettingInput label="종목명" value={name} onChange={setName} />
          <SettingInput label="시장" value={marketCountry} onChange={setMarketCountry} />
          <SettingInput label="회사 도메인" value={companyDomain} onChange={setCompanyDomain} placeholder="apple.com" />
          <label className="space-y-2">
            <span className="text-xs font-black text-slate-500">로고 소스</span>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              value={logoSource}
              onChange={(event) => setLogoSource(event.target.value as SecurityLogoSource)}
            >
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <SettingInput label="로고 URL" value={logoUrl} onChange={setLogoUrl} placeholder="https://..." />
          </div>
          <label className="md:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <div className="flex flex-col items-center justify-center text-center">
              <ImageUp className="h-7 w-7 text-blue-500" />
              <p className="mt-2 text-sm font-black text-slate-950">이미지 업로드</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">png, jpg, jpeg, webp · 최대 1MB · 256px로 저장</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  if (!nextFile) return;
                  if (nextFile.size > 1024 * 1024) {
                    notify({ kind: "error", title: "업로드 불가", description: "로고 이미지는 1MB 이하만 사용할 수 있습니다." });
                    return;
                  }
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setFile(nextFile);
                  setPreviewUrl(URL.createObjectURL(nextFile));
                  setLogoSource("UPLOAD");
                }}
              />
              {file ? <span className="mt-3 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{file.name}</span> : null}
            </div>
          </label>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Button className="h-11 rounded-xl" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            저장
          </Button>
          <Button className="h-11 rounded-xl" variant="outline" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            로고 삭제
          </Button>
          <Button className="h-11 rounded-xl" variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </section>
    </div>
  );
}

function SettingInput({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <Input
        className="h-11 rounded-xl text-sm font-semibold"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function LogoSourceBadge({ source }: { source: string }) {
  const className =
    source === "UPLOAD" || source === "MANUAL"
      ? "bg-blue-50 text-blue-700"
      : source === "FALLBACK"
        ? "bg-slate-100 text-slate-500"
        : "bg-emerald-50 text-emerald-700";

  return <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black", className)}>{source}</span>;
}
