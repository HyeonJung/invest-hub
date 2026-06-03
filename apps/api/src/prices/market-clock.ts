export type MarketSession = {
  domesticOpen: boolean;
  usOpen: boolean;
  session: "OPEN" | "CLOSED";
  refreshIntervalMs: number;
  label: string;
};

export function getMarketSession(now = new Date()): MarketSession {
  const domesticOpen = isDomesticMarketOpen(now);
  const usOpen = isUsMarketOpen(now);
  const session = domesticOpen || usOpen ? "OPEN" : "CLOSED";

  return {
    domesticOpen,
    usOpen,
    session,
    refreshIntervalMs: session === "OPEN" ? 45_000 : 300_000,
    label: session === "OPEN" ? "장중 자동 갱신" : "장외 저빈도 갱신"
  };
}

function isDomesticMarketOpen(now: Date) {
  const parts = getZonedParts(now, "Asia/Seoul");
  if (parts.weekday === 0 || parts.weekday === 6) return false;
  const minutes = parts.hour * 60 + parts.minute;
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
}

function isUsMarketOpen(now: Date) {
  const parts = getZonedParts(now, "America/New_York");
  if (parts.weekday === 0 || parts.weekday === 6) return false;
  const minutes = parts.hour * 60 + parts.minute;
  return minutes >= 9 * 60 + 30 && minutes <= 16 * 60;
}

function getZonedParts(now: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const value = (type: string) => values.find((part) => part.type === type)?.value ?? "0";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value("weekday"));

  return {
    weekday,
    hour: Number(value("hour")),
    minute: Number(value("minute"))
  };
}
