"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const loginErrorMessages: Record<string, string> = {
  access_denied: "로그인이 취소되었습니다. 다시 시도해주세요.",
  email_required: "이메일 제공 동의가 필요합니다. 이메일 항목에 동의한 뒤 다시 로그인해주세요.",
  invalid_state: "로그인 보안 검증에 실패했습니다. 브라우저를 새로고침한 뒤 다시 시도해주세요.",
  oauth_config: "OAuth 설정값이 아직 준비되지 않았습니다. 환경변수를 확인해주세요.",
  oauth_failed: "소셜 로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
};

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingProvider, setLoadingProvider] = useState<"kakao" | "naver" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error");
    if (errorCode) {
      setErrorMessage(loginErrorMessages[errorCode] ?? loginErrorMessages.oauth_failed);
    }

    api
      .me()
      .then(() => {
        if (alive) router.replace("/dashboard");
      })
      .catch(() => {
        if (alive) setCheckingSession(false);
      });

    return () => {
      alive = false;
    };
  }, [router]);

  function startSocialLogin(provider: "kakao" | "naver") {
    setLoadingProvider(provider);
    window.location.href = api.authUrl(provider);
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-[#E6EAF0] bg-white px-5 py-4 text-sm font-black text-[#0F172A] shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" />
          로그인 상태를 확인하고 있습니다
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F6F8FB] p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.14),transparent_34rem),radial-gradient(circle_at_78%_8%,rgba(20,184,166,0.10),transparent_30rem)]" />
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#E6EAF0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.10)] lg:grid-cols-[1.03fr_0.97fr]">
        <div className="bg-[#07111F] p-8 text-white sm:p-10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white">
              <img src="/favicon.svg" alt="Invest Hub" className="h-9 w-9" />
            </span>
            <div>
              <p className="text-xl font-black tracking-[-0.01em]">INVEST HUB</p>
              <p className="text-sm font-semibold text-blue-100/80">나만의 투자 통합 대시보드</p>
            </div>
          </div>

          <div className="mt-16 max-w-md">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">Wealth Dashboard</p>
            <h1 className="mt-4 text-[34px] font-black leading-tight tracking-[-0.02em] sm:text-[42px]">
              흩어진 증권계좌를 하나의 투자 대시보드로 관리하세요.
            </h1>
            <p className="mt-5 text-sm font-semibold leading-7 text-slate-300">
              카카오 또는 네이버 계정으로 안전하게 로그인하고, 연결된 계좌와 포트폴리오 데이터는 사용자별로 분리해서 관리합니다.
            </p>
          </div>

          <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-black">HttpOnly 세션 기반 로그인</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">
                  인증 토큰은 브라우저 JavaScript 저장소에 보관하지 않습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <BriefcaseBusiness className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-black tracking-[-0.02em] text-[#0F172A]">로그인</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#64748B]">소셜 계정으로 빠르게 시작하세요.</p>

          {errorMessage ? (
            <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold leading-6 text-orange-800">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-8 space-y-3">
            <Button
              type="button"
              className="h-[52px] w-full justify-between rounded-2xl bg-[#FEE500] px-4 text-[15px] font-black text-[#191600] shadow-none hover:bg-[#F6D900]"
              onClick={() => startSocialLogin("kakao")}
              disabled={Boolean(loadingProvider)}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#191600] text-sm font-black text-[#FEE500]">K</span>
                카카오로 계속하기
              </span>
              {loadingProvider === "kakao" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              className="h-[52px] w-full justify-between rounded-2xl bg-[#03C75A] px-4 text-[15px] font-black text-white shadow-none hover:bg-[#02B552]"
              onClick={() => startSocialLogin("naver")}
              disabled={Boolean(loadingProvider)}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-[#03C75A]">N</span>
                네이버로 계속하기
              </span>
              {loadingProvider === "naver" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>

          <p className="mt-8 rounded-2xl bg-[#F8FAFC] px-4 py-3 text-xs font-semibold leading-5 text-[#64748B]">
            로그인하면 INVEST HUB의 개인정보 처리 안내와 서비스 이용 약관에 동의한 것으로 간주됩니다.
            소셜 계정의 이메일, 이름, 프로필 이미지만 최소한으로 저장합니다.
          </p>
        </div>
      </section>
    </main>
  );
}
