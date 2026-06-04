import { Injectable } from "@nestjs/common";
import { MarketDataProvider, MarketIndicatorInput } from "./market-data-provider";

type YahooChartResult = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        symbol?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
        marketState?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }>;
    error?: unknown;
  };
};

type FredResponse = {
  observations?: Array<{ date: string; value: string }>;
};

type CnnFearGreedResponse = {
  fear_and_greed?: {
    score?: number;
    rating?: string;
    timestamp?: string;
    previous_close?: number;
  };
};

const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

@Injectable()
export class RealMarketDataProvider implements MarketDataProvider {
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
    return [await this.yahooIndicator("USDKRW=X", "USD_KRW", "USD/KRW", "FX", "KRW", "KRW", 45_000)];
  }

  async getFearGreedIndex() {
    const response = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        Accept: "application/json",
        Referer: "https://www.cnn.com/markets/fear-and-greed",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) InvestHub/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`CNN Fear & Greed 응답 실패: ${response.status}`);
    }

    const json = (await response.json()) as CnnFearGreedResponse;
    const score = Number(json.fear_and_greed?.score);
    const previousClose = Number(json.fear_and_greed?.previous_close);
    if (!Number.isFinite(score)) {
      throw new Error("CNN Fear & Greed 점수를 파싱할 수 없습니다.");
    }

    const change = Number.isFinite(previousClose) ? score - previousClose : 0;
    const changeRate = previousClose > 0 ? (change / previousClose) * 100 : 0;
    const rating = normalizeFearGreedStatus(json.fear_and_greed?.rating);

    return [
      {
        symbol: "FEAR_GREED",
        name: "공포탐욕지수",
        category: "SENTIMENT",
        value: score,
        change,
        changeRate,
        status: rating,
        currency: null,
        unit: "SCORE",
        marketState: "CLOSED",
        source: "CNN Fear & Greed",
        refreshIntervalMs: 1_800_000,
        lastUpdatedAt: json.fear_and_greed?.timestamp ? new Date(json.fear_and_greed.timestamp) : new Date()
      }
    ];
  }

  async getOilPrices() {
    return [
      await this.yahooIndicator("CL=F", "WTI", "WTI", "ENERGY", "USD", "USD", 180_000),
      await this.yahooIndicator("BZ=F", "BRENT", "Brent", "ENERGY", "USD", "USD", 180_000)
    ];
  }

  async getBondYields() {
    const fred = await this.tryFredUs10Y();
    if (fred) return [fred];
    return [normalizeTreasuryYield(await this.yahooIndicator("^TNX", "US10Y", "미국 10년물", "BOND", "USD", "PERCENT", 180_000))];
  }

  async getMarketIndexes() {
    return [
      await this.yahooIndicator("^KS11", "KOSPI", "KOSPI", "INDEX", "KRW", "POINT", 60_000),
      await this.yahooIndicator("^KQ11", "KOSDAQ", "KOSDAQ", "INDEX", "KRW", "POINT", 60_000),
      await this.yahooIndicator("^GSPC", "SPX", "S&P 500", "INDEX", "USD", "POINT", 60_000),
      await this.yahooIndicator("^NDX", "NDX", "Nasdaq 100", "INDEX", "USD", "POINT", 60_000),
      await this.yahooIndicator("^VIX", "VIX", "VIX", "VOLATILITY", "USD", "POINT", 60_000)
    ];
  }

  async getCommodities() {
    return [await this.yahooIndicator("GC=F", "GOLD", "금", "COMMODITY", "USD", "USD", 180_000)];
  }

  async getCryptoPrices() {
    return [await this.yahooIndicator("BTC-USD", "BTC", "비트코인", "CRYPTO", "USD", "USD", 60_000)];
  }

  private async yahooIndicator(
    yahooSymbol: string,
    symbol: string,
    name: string,
    category: string,
    currency: string,
    unit: string,
    refreshIntervalMs: number
  ): Promise<MarketIndicatorInput> {
    const encodedSymbol = encodeURIComponent(yahooSymbol);
    const response = await fetch(`${YAHOO_CHART_BASE_URL}/${encodedSymbol}?range=2d&interval=1d`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) InvestHub/0.1" }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance ${symbol} 응답 실패: ${response.status}`);
    }

    const json = (await response.json()) as YahooChartResult;
    const result = json.chart?.result?.[0];
    const meta = result?.meta;
    const value = firstFinite(meta?.regularMarketPrice, lastFinite(result?.indicators?.quote?.[0]?.close));
    const previousClose = firstFinite(meta?.chartPreviousClose, previousFinite(result?.indicators?.quote?.[0]?.close));

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Yahoo Finance ${symbol} 값을 파싱할 수 없습니다.`);
    }

    const change = Number.isFinite(previousClose) ? value - previousClose : 0;
    const changeRate = previousClose > 0 ? (change / previousClose) * 100 : 0;
    const lastUpdatedAt = meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date();

    return {
      symbol,
      name,
      category,
      value,
      change,
      changeRate,
      status: statusFromChange(change),
      currency: meta?.currency ?? currency,
      unit,
      marketState: meta?.marketState ?? "REGULAR",
      source: "Yahoo Finance",
      refreshIntervalMs,
      lastUpdatedAt
    };
  }

  private async tryFredUs10Y(): Promise<MarketIndicatorInput | null> {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) return null;

    const url = new URL("https://api.stlouisfed.org/fred/series/observations");
    url.searchParams.set("series_id", "DGS10");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("sort_order", "desc");
    url.searchParams.set("limit", "10");

    const response = await fetch(url, {
      headers: { "User-Agent": "InvestHub/0.1" }
    });
    if (!response.ok) return null;

    const json = (await response.json()) as FredResponse;
    const values = (json.observations ?? [])
      .map((row) => ({ date: row.date, value: Number(row.value) }))
      .filter((row) => Number.isFinite(row.value));
    const latest = values[0];
    const previous = values[1];
    if (!latest) return null;

    const change = previous ? latest.value - previous.value : 0;
    const changeRate = previous && previous.value > 0 ? (change / previous.value) * 100 : 0;

    return {
      symbol: "US10Y",
      name: "미국 10년물",
      category: "BOND",
      value: latest.value,
      change,
      changeRate,
      status: statusFromChange(change),
      currency: "USD",
      unit: "PERCENT",
      marketState: "CLOSED",
      source: "FRED",
      refreshIntervalMs: 180_000,
      lastUpdatedAt: new Date(`${latest.date}T00:00:00.000Z`)
    };
  }
}

function normalizeTreasuryYield(indicator: MarketIndicatorInput) {
  if (indicator.value <= 20) return indicator;
  return {
    ...indicator,
    value: indicator.value / 10,
    change: indicator.change / 10
  };
}

function normalizeFearGreedStatus(value?: string) {
  const normalized = (value ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (["EXTREME_GREED", "GREED", "NEUTRAL", "FEAR", "EXTREME_FEAR"].includes(normalized)) return normalized;
  return "NEUTRAL";
}

function statusFromChange(change: number) {
  if (change > 0) return "UP";
  if (change < 0) return "DOWN";
  return "NEUTRAL";
}

function firstFinite(...values: Array<number | null | undefined>) {
  return values.find((value): value is number => typeof value === "number" && Number.isFinite(value)) ?? Number.NaN;
}

function lastFinite(values?: Array<number | null>) {
  return [...(values ?? [])].reverse().find((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function previousFinite(values?: Array<number | null>) {
  const finite = (values ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return finite.length >= 2 ? finite[finite.length - 2] : undefined;
}
