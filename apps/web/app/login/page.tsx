"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F7F9FC] px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(37,99,235,0.12),transparent_26rem),radial-gradient(circle_at_68%_76%,rgba(20,184,166,0.10),transparent_24rem)]" />
      <section className="relative w-full max-w-[440px] rounded-[28px] border border-white/80 bg-white/95 p-7 text-center shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="flex flex-col items-center">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[#EFF6FF] shadow-sm ring-1 ring-[#E6EAF0]">
            <img src="/favicon.svg" alt="Invest Hub" className="h-10 w-10" />
          </span>
          <h1 className="mt-5 text-[26px] font-black tracking-[-0.02em] text-[#0F172A]">INVEST HUB</h1>
          <p className="mt-2 whitespace-nowrap text-sm font-bold text-[#64748B]">흩어진 증권계좌를 한눈에</p>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-left text-sm font-bold leading-6 text-orange-800">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-8 space-y-3">
          {/* <Button
            type="button"
            className="h-[52px] w-full justify-between rounded-[14px] bg-[#FEE500] px-4 text-[15px] font-black text-[#191919] shadow-none hover:bg-[#F6D900]"
            onClick={() => startSocialLogin("kakao")}
            disabled={Boolean(loadingProvider)}
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#191919] text-sm font-black text-[#FEE500]">K</span>
              카카오로 계속하기
            </span>
            {loadingProvider === "kakao" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </Button> */}
          <Button
            type="button"
            className="h-[52px] w-full justify-between rounded-[14px] bg-[#03C75A] px-4 text-[15px] font-black text-white shadow-none hover:bg-[#02B552]"
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

        <p className="mx-auto mt-6 max-w-[340px] text-xs font-semibold leading-5 text-[#64748B]">
          로그인하면{" "}
          <a href="/terms" className="text-[#2563EB] underline-offset-2 hover:underline">
            서비스 이용약관
          </a>
          과{" "}
          <a href="/privacy" className="text-[#2563EB] underline-offset-2 hover:underline">
            개인정보 처리방침
          </a>
          에 동의하게 됩니다.
        </p>
      </section>
    </main>
  );
}
