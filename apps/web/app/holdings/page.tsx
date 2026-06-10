import { MobileAppShell } from "@/components/mobile/MobileAppShell";

export default function HoldingsPage() {
  return <MobileAppShell initialView="holdings" desktopRedirect="/dashboard?view=overview" />;
}
