import { MobileAppShell } from "@/components/mobile/MobileAppShell";

export default async function AccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;

  return <MobileAppShell initialView="account-detail" accountId={accountId} desktopRedirect={`/dashboard?account=${accountId}`} />;
}
