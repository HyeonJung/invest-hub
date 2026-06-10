import { Injectable } from "@nestjs/common";
import { MarketDataProvider, MarketIndicatorInput } from "./market-data-provider";

@Injectable()
export class MockMarketDataProvider implements MarketDataProvider {
  async getAllIndicators() {
    return [
      ...(await this.getExchangeRate()),
      ...(await this.getFearGreedIndex()),
      ...(await this.getOilPrices()),
      ...(await this.getBondYields()),
      ...(await this.getMarketIndexes()),
      ...(await this.getCommodities()),
      ...(await this.getCryptoPrices())
    ];
  }

  async getExchangeRate() {
    return [
      indicator({
        symbol: "USD_KRW",
        name: "USD/KRW",
        category: "FX",
        value: 1387.2,
        change: 6.2,
        changeRate: 0.45,
        currency: "KRW",
        unit: "KRW",
        marketState: "REGULAR",
        refreshIntervalMs: 45_000
      })
    ];
  }

  async getFearGreedIndex() {
    const value = Math.round(68 + wave(3));
    return [
      indicator({
        symbol: "FEAR_GREED",
        name: "공포탐욕지수",
        category: "SENTIMENT",
        value,
        change: 2,
        changeRate: 3.03,
        status: value >= 75 ? "EXTREME_GREED" : value >= 55 ? "GREED" : value >= 45 ? "NEUTRAL" : "FEAR",
        currency: null,
        unit: "SCORE",
        marketState: "CLOSED",
        refreshIntervalMs: 1_800_000
      })
    ];
  }

  async getOilPrices() {
    return [
      indicator({
        symbol: "WTI",
        name: "WTI",
        category: "ENERGY",
        value: 74.2,
        change: -0.85,
        changeRate: -1.13,
        currency: "USD",
        unit: "USD",
        marketState: "REGULAR",
        refreshIntervalMs: 180_000
      }),
      indicator({
        symbol: "BRENT",
        name: "Brent",
        category: "ENERGY",
        value: 78.45,
        change: -0.72,
        changeRate: -0.91,
        currency: "USD",
        unit: "USD",
        marketState: "REGULAR",
        refreshIntervalMs: 180_000
      })
    ];
  }

  async getBondYields() {
    return [
      indicator({
        symbol: "US10Y",
        name: "미국 10년물",
        category: "BOND",
        value: 4.42,
        change: 0.03,
        changeRate: 0.68,
        currency: "USD",
        unit: "PERCENT",
        marketState: "REGULAR",
        refreshIntervalMs: 180_000
      })
    ];
  }

  async getMarketIndexes() {
    return [
      indicator({
        symbol: "KOSPI",
        name: "KOSPI",
        category: "INDEX",
        value: 2678.19,
        change: 29.67,
        changeRate: 1.12,
        currency: "KRW",
        unit: "POINT",
        marketState: "REGULAR",
        refreshIntervalMs: 60_000
      }),
      indicator({
        symbol: "KOSDAQ",
        name: "KOSDAQ",
        category: "INDEX",
        value: 842.51,
        change: 5.68,
        changeRate: 0.68,
        currency: "KRW",
        unit: "POINT",
        marketState: "REGULAR",
        refreshIntervalMs: 60_000
      }),
      indicator({
        symbol: "SPX",
        name: "S&P 500",
        category: "INDEX",
        value: 5307.01,
        change: 28.2,
        changeRate: 0.53,
        currency: "USD",
        unit: "POINT",
        marketState: "REGULAR",
        refreshIntervalMs: 60_000
      }),
      indicator({
        symbol: "NDX",
        name: "Nasdaq 100",
        category: "INDEX",
        value: 19021.84,
        change: 132.1,
        changeRate: 0.7,
        currency: "USD",
        unit: "POINT",
        marketState: "REGULAR",
        refreshIntervalMs: 60_000
      }),
      indicator({
        symbol: "VIX",
        name: "VIX",
        category: "VOLATILITY",
        value: 13.2,
        change: -0.41,
        changeRate: -3.01,
        currency: "USD",
        unit: "POINT",
        marketState: "REGULAR",
        refreshIntervalMs: 60_000
      })
    ];
  }

  async getCommodities() {
    return [
      indicator({
        symbol: "GOLD",
        name: "금",
        category: "COMMODITY",
        value: 2352.4,
        change: 8.6,
        changeRate: 0.37,
        currency: "USD",
        unit: "USD",
        marketState: "REGULAR",
        refreshIntervalMs: 180_000
      })
    ];
  }

  async getCryptoPrices() {
    return [
      indicator({
        symbol: "BTC",
        name: "비트코인",
        category: "CRYPTO",
        value: 68120.5,
        change: 920.3,
        changeRate: 1.37,
        currency: "USD",
        unit: "USD",
        marketState: "REGULAR",
        refreshIntervalMs: 180_000
      }),
      indicator({
        symbol: "ETH",
        name: "이더리움",
        category: "CRYPTO",
        value: 3560.25,
        change: -18.4,
        changeRate: -0.51,
        currency: "USD",
        unit: "USD",
        marketState: "REGULAR",
        refreshIntervalMs: 180_000
      })
    ];
  }
}

function indicator(input: Omit<MarketIndicatorInput, "source" | "status"> & { status?: string }): MarketIndicatorInput {
  const drift = wave(Math.max(0.001, Math.abs(input.value) * 0.0008));
  const changeDrift = wave(Math.max(0.001, Math.abs(input.change || 1) * 0.08));
  const value = round(input.value + drift, input.unit === "KRW" ? 2 : 4);
  const change = round(input.change + changeDrift, input.unit === "SCORE" ? 0 : 4);
  const changeRate = round(input.value !== 0 ? (change / (input.value - input.change || input.value)) * 100 : input.changeRate, 4);

  return {
    ...input,
    value,
    change,
    changeRate,
    status: input.status ?? statusFromChange(change),
    source: "Mock Provider",
    lastUpdatedAt: new Date()
  };
}

function statusFromChange(change: number) {
  if (change > 0) return "UP";
  if (change < 0) return "DOWN";
  return "NEUTRAL";
}

function wave(scale: number) {
  const seconds = Date.now() / 1000;
  return Math.sin(seconds / 37) * scale;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
