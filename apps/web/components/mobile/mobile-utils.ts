"use client";

import type { BrokerKey, ChartDatum, Holding, MarketIndicator, Metric, PortfolioSummary } from "@/lib/api";
import type { MobileAccount, MobileAggregatedHolding, MobileHoldingFilter, MobileHoldingSort } from "@/components/mobile/mobile-types";
import { formatKrw } from "@/lib/utils";

export const mobileBrokerLabels: Record<BrokerKey, string> = {
  TOSS: "토스증권",
  NAMUH: "나무증권",
  KIWOOM: "키움증권"
};

export const mobileBrokerColors: Record<BrokerKey, string> = {
  TOSS: "#2563EB",
  NAMUH: "#16A34A",
  KIWOOM: "#8B5CF6"
};

export const mobileBrokerIconSrc: Partial<Record<BrokerKey, string>> = {
  TOSS: "/broker-icons/toss-symbol-primary.png",
  KIWOOM: "/broker-icons/kiwoom-ci-symbol.png"
};

export function buildMobileAccounts(summary?: PortfolioSummary): MobileAccount[] {
  if (!summary?.holdings.length) return [];

  const grouped = new Map<string, Holding[]>();
  for (const holding of summary.holdings) {
    const key = `${holding.broker}|${cleanMobileName(holding.accountAlias)}|${holding.accountType}`;
    grouped.set(key, [...(grouped.get(key) ?? []), holding]);
  }

  return Array.from(grouped.entries())
    .map(([rawKey, holdings]) => {
      const first = holdings[0];
      const metrics = metricsFromMobileHoldings(holdings);
      const alias = cleanMobileName(first.accountAlias);
      const shortName = buildMobileAccountShortName(first.broker, alias, first.accountType, holdings);
      const brokerLabel = mobileBrokerLabels[first.broker];

      return {
        id: stableMobileHash(rawKey),
        rawKey,
        broker: first.broker,
        brokerLabel,
        accountAlias: alias,
        accountType: first.accountType,
        displayName: `${brokerLabel} ${shortName}`,
        shortName,
        holdings,
        metrics
      };
    })
    .sort((a, b) => brokerOrder(a.broker) - brokerOrder(b.broker) || b.metrics.totalMarketValue - a.metrics.totalMarketValue);
}

export function buildMobileAggregatedHoldings(holdings: Holding[]): MobileAggregatedHolding[] {
  const grouped = new Map<string, MobileAggregatedHolding>();

  for (const holding of holdings) {
    const key = `${holding.symbol}:${holding.marketCountry}`;
    const quantity = safeNumber(holding.quantity);
    const marketValue = safeNumber(holding.marketValue);
    const costAmount = safeNumber(holding.costAmount);
    const profitLoss = safeNumber(holding.profitLoss);
    const marketPrice = safeNumber(holding.displayPrice ?? holding.marketPrice) || (quantity > 0 ? marketValue / quantity : 0);
    const averagePurchasePrice = safeNumber(holding.averagePurchasePrice) || (quantity > 0 ? costAmount / quantity : 0);
    const existing =
      grouped.get(key) ??
      ({
        id: key,
        securityId: holding.securityId,
        symbol: holding.symbol,
        name: holding.name,
        marketCountry: holding.marketCountry,
        currency: holding.currency,
        assetType: holding.assetType,
        logoUrl: holding.logoUrl,
        totalQuantity: 0,
        marketPrice: 0,
        averagePurchasePrice: 0,
        marketValue: 0,
        costAmount: 0,
        profitLoss: 0,
        profitLossRate: 0,
        accounts: []
      } satisfies MobileAggregatedHolding);

    existing.totalQuantity += quantity;
    existing.marketPrice += marketPrice * quantity;
    existing.averagePurchasePrice += averagePurchasePrice * quantity;
    existing.marketValue += marketValue;
    existing.costAmount += costAmount;
    existing.profitLoss += profitLoss;
    existing.accounts.push({
      id: holding.id,
      broker: holding.broker,
      accountAlias: holding.accountAlias,
      accountType: holding.accountType,
      quantity,
      marketValue,
      profitLoss,
      profitLossRate: safeNumber(holding.profitLossRate)
    });

    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).map((holding) => ({
    ...holding,
    marketPrice: holding.totalQuantity > 0 ? holding.marketPrice / holding.totalQuantity : 0,
    averagePurchasePrice: holding.totalQuantity > 0 ? holding.averagePurchasePrice / holding.totalQuantity : 0,
    profitLossRate: holding.costAmount > 0 ? (holding.profitLoss / holding.costAmount) * 100 : 0,
    accounts: holding.accounts.sort((a, b) => b.marketValue - a.marketValue)
  }));
}

export function filterAndSortMobileHoldings(
  holdings: MobileAggregatedHolding[],
  filter: MobileHoldingFilter,
  sort: MobileHoldingSort
) {
  return holdings
    .filter((holding) => {
      if (filter === "KR") return isDomesticMobileHolding(holding);
      if (filter === "US") return !isDomesticMobileHolding(holding);
      if (filter === "ETF") return holding.assetType === "ETF";
      return true;
    })
    .sort((a, b) => {
      if (sort === "returnRate") return b.profitLossRate - a.profitLossRate;
      if (sort === "profitLoss") return b.profitLoss - a.profitLoss;
      if (sort === "name") return (a.name || a.symbol).localeCompare(b.name || b.symbol, "ko-KR");
      return b.marketValue - a.marketValue;
    });
}

export function metricsFromMobileHoldings(holdings: Holding[]): Metric {
  const totalMarketValue = holdings.reduce((sum, holding) => sum + safeNumber(holding.marketValue), 0);
  const totalProfitLoss = holdings.reduce((sum, holding) => sum + safeNumber(holding.profitLoss), 0);
  const totalCost = Math.max(0, totalMarketValue - totalProfitLoss);
  const annualDividendEstimate = holdings.reduce((sum, holding) => sum + safeNumber(holding.annualDividendEstimate), 0);
  const usdMarketValue = holdings
    .filter((holding) => holding.currency === "USD")
    .reduce((sum, holding) => sum + safeNumber(holding.marketValue), 0);

  return {
    totalMarketValue,
    totalProfitLoss,
    returnRate: totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0,
    annualDividendEstimate,
    fxExposureRate: totalMarketValue > 0 ? (usdMarketValue / totalMarketValue) * 100 : 0,
    fxImpactAmount: 0
  };
}

export function assetAllocationFromMobileHoldings(holdings: Holding[]): ChartDatum[] {
  const total = holdings.reduce((sum, holding) => sum + safeNumber(holding.marketValue), 0);
  const buckets = [
    {
      name: "해외 주식",
      value: holdings.filter((holding) => !isDomesticMobileHolding(holding) && holding.assetType !== "ETF").reduce((sum, holding) => sum + holding.marketValue, 0),
      color: "#2563EB"
    },
    {
      name: "국내 주식",
      value: holdings.filter((holding) => isDomesticMobileHolding(holding) && holding.assetType !== "ETF").reduce((sum, holding) => sum + holding.marketValue, 0),
      color: "#14B8A6"
    },
    {
      name: "ETF",
      value: holdings.filter((holding) => holding.assetType === "ETF").reduce((sum, holding) => sum + holding.marketValue, 0),
      color: "#8B5CF6"
    }
  ];

  return buckets.map((bucket) => ({
    ...bucket,
    rate: total > 0 ? (bucket.value / total) * 100 : 0
  }));
}

export function selectMobileMarketIndicators(indicators: MarketIndicator[]) {
  const order = ["USD_KRW", "FEAR_GREED", "SPX", "NASDAQ100", "NDX", "WTI", "VIX", "BTC"];
  const seen = new Set<string>();

  return [...indicators]
    .filter((indicator) => order.includes(indicator.symbol))
    .sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol))
    .filter((indicator) => {
      const group = indicator.symbol === "NASDAQ100" || indicator.symbol === "NDX" ? "NASDAQ" : indicator.symbol;
      if (seen.has(group)) return false;
      seen.add(group);
      return true;
    })
    .slice(0, 6);
}

export function formatSignedKrwMobile(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatKrw(Math.abs(value))}`;
}

export function formatPercentMobile(value: number, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

export function formatQuantityMobile(value: number) {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 6 });
}

export function accountTypeLabelMobile(value: string) {
  const labels: Record<string, string> = {
    BROKERAGE: "일반계좌",
    ISA: "ISA",
    PENSION_SAVINGS: "연금저축",
    OVERSEAS: "해외주식",
    DOMESTIC: "국내주식",
    MANUAL: "수동입력"
  };
  return labels[value] ?? value;
}

export function formatMobileDateTime(value?: string | null) {
  if (!value) return "아직 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatMobileIndicatorValue(indicator: MarketIndicator) {
  if (indicator.symbol === "USD_KRW") return `${indicator.value.toLocaleString("ko-KR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}원`;
  if (indicator.unit === "USD") return `$${indicator.value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  if (indicator.unit === "PERCENT") return `${indicator.value.toFixed(2)}%`;
  if (indicator.unit === "SCORE") return Math.round(indicator.value).toString();
  return indicator.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

export function compactMobileIndicatorName(name: string, symbol: string) {
  const names: Record<string, string> = {
    USD_KRW: "USD/KRW",
    FEAR_GREED: "공포탐욕",
    SPX: "S&P 500",
    NASDAQ100: "NASDAQ",
    NDX: "NASDAQ",
    WTI: "WTI",
    VIX: "VIX",
    BTC: "비트코인"
  };
  return names[symbol] ?? name;
}

export function isDomesticMobileHolding(holding: { marketCountry: string; currency: string }) {
  const country = holding.marketCountry.toUpperCase();
  return country === "KR" || country === "KOR" || country === "KOREA" || holding.currency === "KRW";
}

export function marketCountryFlagMobile(holding: { marketCountry: string; currency: string }) {
  if (isDomesticMobileHolding(holding)) return "🇰🇷";
  if (holding.marketCountry.toUpperCase() === "US" || holding.currency === "USD") return "🇺🇸";
  return "🌐";
}

export function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildMobileAccountShortName(broker: BrokerKey, alias: string, accountType: string, holdings: Holding[]) {
  const typeLabel = accountTypeLabelMobile(accountType);
  const marketLabel = holdings.every((holding) => !isDomesticMobileHolding(holding))
    ? "해외주식"
    : holdings.every(isDomesticMobileHolding)
      ? "국내주식"
      : typeLabel;
  const normalizedAlias = alias.replace(/\s+/g, " ").trim();
  const maskedAccount = normalizedAlias.match(/\d{2}\*+\d{2}/)?.[0];

  if (maskedAccount) return `${maskedAccount} ${marketLabel}`;
  if (!normalizedAlias || normalizedAlias === mobileBrokerLabels[broker]) return marketLabel;
  if (normalizedAlias.includes(typeLabel)) return normalizedAlias;
  return typeLabel === "일반계좌" && (marketLabel === "국내주식" || marketLabel === "해외주식") ? `${normalizedAlias} ${marketLabel}` : `${normalizedAlias} ${typeLabel}`;
}

function cleanMobileName(value: string) {
  const maskedAccount = value.match(/\d{2}\*+\d{2}/)?.[0];
  if (value.includes("?ㅼ") || value.includes("영웅문")) return maskedAccount ? `키움 ${maskedAccount}` : "키움증권";
  if (value.includes("?좎") || value.toLowerCase().includes("toss")) return maskedAccount ? `토스 ${maskedAccount}` : "토스증권";
  if (value.includes("?섎") || value.toLowerCase().includes("namuh")) return maskedAccount ? `나무 ${maskedAccount}` : "나무증권";
  return value;
}

function stableMobileHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function brokerOrder(broker: BrokerKey) {
  const order: Record<BrokerKey, number> = { TOSS: 0, NAMUH: 1, KIWOOM: 2 };
  return order[broker] ?? 99;
}
