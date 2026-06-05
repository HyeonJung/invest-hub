import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F7F9FC] px-4 py-10 text-[#0F172A]">
      <section className="mx-auto max-w-[720px] rounded-[28px] border border-[#E5EAF0] bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
        <Link href="/login" className="text-sm font-black text-[#2563EB]">
          로그인으로 돌아가기
        </Link>
        <h1 className="mt-8 text-3xl font-black tracking-[-0.02em]">개인정보 처리방침</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#64748B]">
          INVEST HUB는 로그인과 계좌 통합 관리에 필요한 최소한의 개인정보만 처리합니다.
        </p>
        <div className="mt-8 space-y-5 text-sm font-semibold leading-7 text-[#334155]">
          <p>소셜 로그인 시 이메일, 이름, 프로필 이미지와 제공자 식별자를 저장할 수 있습니다.</p>
          <p>연결된 증권 계좌와 보유 종목 정보는 사용자별로 분리해 관리하며, 다른 사용자에게 노출되지 않도록 보호합니다.</p>
          <p>상세 처리방침은 서비스 정책에 따라 업데이트될 수 있으며, 중요한 변경 사항은 별도로 안내합니다.</p>
        </div>
      </section>
    </main>
  );
}
