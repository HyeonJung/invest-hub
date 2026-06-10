import { MobileAppShell } from "@/components/mobile/MobileAppShell";

export default function AnalysisPage() {
  return <MobileAppShell initialView="analysis" desktopRedirect="/dashboard?view=ai" />;
}
