export type PriceMarketState = "REGULAR" | "PRE_MARKET" | "AFTER_MARKET" | "CLOSED";

export type DisplayPriceSource = "REGULAR" | "EXTENDED" | "LAST" | "PREVIOUS_CLOSE" | "LAST_SUCCESSFUL";

export type DisplayPriceInput = {
  marketCountry: string;
  regularMarketPrice?: number | null;
  extendedMarketPrice?: number | null;
  lastPrice?: number | null;
  previousClose?: number | null;
  lastSuccessfulPrice?: number | null;
};

export type DisplayPriceResult = {
  displayPrice: number;
  priceSource: DisplayPriceSource;
  isStale: boolean;
};

export function resolveDisplayPrice(input: DisplayPriceInput): DisplayPriceResult | null {
  const marketCountry = input.marketCountry.toUpperCase();
  const candidates: Array<[DisplayPriceSource, number | null | undefined]> =
    marketCountry === "US"
      ? [
          ["REGULAR", input.regularMarketPrice],
          ["EXTENDED", input.extendedMarketPrice],
          ["LAST", input.lastPrice],
          ["PREVIOUS_CLOSE", input.previousClose],
          ["LAST_SUCCESSFUL", input.lastSuccessfulPrice]
        ]
      : [
          ["REGULAR", input.regularMarketPrice],
          ["LAST", input.lastPrice],
          ["EXTENDED", input.extendedMarketPrice],
          ["PREVIOUS_CLOSE", input.previousClose],
          ["LAST_SUCCESSFUL", input.lastSuccessfulPrice]
        ];

  for (const [source, value] of candidates) {
    const price = toPositiveNumber(value);
    if (price == null) continue;
    return {
      displayPrice: price,
      priceSource: source as DisplayPriceSource,
      isStale: source === "PREVIOUS_CLOSE" || source === "LAST_SUCCESSFUL"
    };
  }

  return null;
}

export function calculateHoldingMarketValue({
  quantity,
  displayPrice,
  currency,
  usdKrwRate
}: {
  quantity: number;
  displayPrice: number;
  currency: string;
  usdKrwRate: number;
}) {
  const nativeMarketValue = Math.max(0, quantity) * Math.max(0, displayPrice);
  return currency.toUpperCase() === "USD" ? nativeMarketValue * usdKrwRate : nativeMarketValue;
}

export function getPriceMarketState(marketCountry: string, now = new Date()): PriceMarketState {
  if (marketCountry.toUpperCase() === "US") return getUsPriceMarketState(now);
  if (marketCountry.toUpperCase() === "KR") return getKoreanPriceMarketState(now);
  return "CLOSED";
}

function getUsPriceMarketState(now: Date): PriceMarketState {
  const parts = getZonedParts(now, "America/New_York");
  if (parts.weekday === 0 || parts.weekday === 6) return "CLOSED";
  const minutes = parts.hour * 60 + parts.minute;
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return "PRE_MARKET";
  if (minutes >= 9 * 60 + 30 && minutes <= 16 * 60) return "REGULAR";
  if (minutes > 16 * 60 && minutes <= 20 * 60) return "AFTER_MARKET";
  return "CLOSED";
}

function getKoreanPriceMarketState(now: Date): PriceMarketState {
  const parts = getZonedParts(now, "Asia/Seoul");
  if (parts.weekday === 0 || parts.weekday === 6) return "CLOSED";
  const minutes = parts.hour * 60 + parts.minute;
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 30 ? "REGULAR" : "CLOSED";
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

function toPositiveNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}
