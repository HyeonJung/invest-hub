"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/toast-provider";

export default function LoginPage() {
  const router = useRouter();
  const { notify } = useToast();
  const [email, setEmail] = useState("demo@investhub.kr");
  const [password, setPassword] = useState("demo123");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.login(email, password);
      window.localStorage.setItem("invest-hub-token", result.token);
      window.localStorage.setItem("invest-hub-user", JSON.stringify(result.user));
      notify({ kind: "success", title: "로그인 완료", description: `${result.user.name} 님의 대시보드로 이동합니다.` });
      router.push("/dashboard");
    } catch (error) {
      notify({
        kind: "error",
        title: "로그인 실패",
        description: error instanceof Error ? error.message : "다시 시도해주세요."
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.35),transparent_35rem),radial-gradient(circle_at_80%_10%,rgba(69,196,159,0.18),transparent_30rem)]" />
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[1.05fr_0.95fr]">
        <div className="dark-panel p-10 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500">
              <BriefcaseBusiness className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xl font-black">INVEST HUB</p>
              <p className="text-sm text-blue-100">멀티 증권계좌 포트폴리오 SaaS</p>
            </div>
          </div>
          <h1 className="mt-16 text-4xl font-black leading-tight">
            토스, 나무, 키움 계좌를
            <br />
            하나의 투자 판단 화면으로
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-blue-100">
            토스증권과 키움은 API로 자동 연동하고, 나무증권은 CSV/XLSX 업로드로 통합합니다.
            중복 보유, 환율 노출, 리밸런싱 추천까지 실제 계산합니다.
          </p>
          <div className="mt-12 rounded-xl border border-white/10 bg-white/10 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <p className="text-sm font-semibold">데모 계정이 자동 입력되어 있습니다.</p>
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="p-10">
          <p className="text-sm font-bold text-blue-600">MVP 로그인</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">대시보드 시작하기</h2>
          <p className="mt-2 text-sm text-slate-500">실제 서비스 확장을 고려한 API 서버와 연결됩니다.</p>
          <label className="mt-8 block text-sm font-bold text-slate-700">
            이메일
            <Input className="mt-2" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="mt-5 block text-sm font-bold text-slate-700">
            비밀번호
            <Input
              className="mt-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button className="mt-8 w-full" size="lg" type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            로그인
          </Button>
          <Button
            className="mt-3 w-full"
            type="button"
            variant="outline"
            onClick={() => {
              setEmail("demo@investhub.kr");
              setPassword("demo123");
              notify({ kind: "info", title: "데모 계정 입력", description: "바로 로그인할 수 있습니다." });
            }}
          >
            데모 계정 다시 입력
          </Button>
        </form>
      </section>
    </main>
  );
}
