import { MobileAppShell } from "@/components/mobile/MobileAppShell";

export default function AccountsPage() {
  return <MobileAppShell initialView="accounts" desktopRedirect="/dashboard?view=overview" />;
}
