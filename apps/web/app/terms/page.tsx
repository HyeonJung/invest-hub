import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F7F9FC] px-4 py-10 text-[#0F172A]">
      <section className="mx-auto max-w-[720px] rounded-[28px] border border-[#E5EAF0] bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
        <Link href="/login" className="text-sm font-black text-[#2563EB]">
          로그인으로 돌아가기
        </Link>
        <h1 className="mt-8 text-3xl font-black tracking-[-0.02em]">서비스 이용약관</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#64748B]">
          INVEST HUB는 연결된 계좌와 포트폴리오 정보를 한곳에서 확인할 수 있도록 돕는 투자 관리 서비스입니다.
        </p>
        <div className="mt-8 space-y-5 text-sm font-semibold leading-7 text-[#334155]">
          <p>사용자는 본인 명의의 계좌 정보만 연결해야 하며, 제공되는 투자 정보는 참고용으로 확인해야 합니다.</p>
          <p>서비스는 안정적인 제공을 위해 필요한 범위에서 기능을 변경하거나 점검할 수 있습니다.</p>
          <p>상세 약관은 서비스 정책에 따라 업데이트될 수 있으며, 중요한 변경 사항은 별도로 안내합니다.</p>
        </div>
      </section>
    </main>
  );
}
