import { MobileAppShell } from "@/components/mobile/MobileAppShell";

export default function SettingsPage() {
  return <MobileAppShell initialView="settings" desktopRedirect="/dashboard?view=settings" />;
}
