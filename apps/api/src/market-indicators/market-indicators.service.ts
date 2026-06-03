import { Injectable } from "@nestjs/common";
import { MarketIndicator, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CachedMarketDataService } from "./cached-market-data.service";

const FALLBACK_USD_KRW_RATE = Number(process.env.USD_KRW_RATE ?? 1516.5);

@Injectable()
export class MarketIndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cachedMarketDataService: CachedMarketDataService
  ) {}

  async getIndicators() {
    const rows = await this.prisma.marketIndicator.findMany({ orderBy: { symbol: "asc" } });
    const needsRefresh = rows.length === 0 || rows.some((row) => row.expiresAt.getTime() <= Date.now());
    if (needsRefresh) {
      return this.refreshIndicators(false);
    }

    return this.toResponse(rows, []);
  }

  async refreshIndicators(force = true) {
    const now = new Date();
    const existingRows = await this.prisma.marketIndicator.findMany();
    const existingBySymbol = new Map(existingRows.map((row) => [row.symbol, row]));
    const expiredRows = existingRows.filter((row) => row.expiresAt.getTime() <= now.getTime());

    if (!force && existingRows.length > 0 && expiredRows.length === 0) {
      return this.toResponse(existingRows, []);
    }

    const { indicators, errors } = await this.cachedMarketDataService.getAllIndicators(force);
    const dueIndicators = indicators.filter((indicator) => {
      const existing = existingBySymbol.get(indicator.symbol);
      return force || !existing || existing.expiresAt.getTime() <= now.getTime();
    });

    if (dueIndicators.length === 0 && existingRows.length > 0 && errors.length === 0) {
      return this.toResponse(existingRows, []);
    }

    if (indicators.length === 0) {
      errors.push("시장 지표 공급자 응답이 없어 마지막 성공 데이터를 유지했습니다.");
    }

    const delayedSymbols: string[] = [];

    for (const indicator of dueIndicators) {
      const existing = existingBySymbol.get(indicator.symbol);
      const fallbackMockShouldNotOverwrite =
        process.env.MARKET_DATA_PROVIDER !== "mock" && indicator.source === "Mock Provider" && Boolean(existing);

      if (fallbackMockShouldNotOverwrite) {
        delayedSymbols.push(indicator.symbol);
        continue;
      }

      const expiresAt = new Date(now.getTime() + indicator.refreshIntervalMs);
      await this.prisma.marketIndicator.upsert({
        where: { symbol: indicator.symbol },
        create: {
          symbol: indicator.symbol,
          name: indicator.name,
          category: indicator.category,
          value: new Prisma.Decimal(indicator.value),
          change: new Prisma.Decimal(indicator.change),
          changeRate: new Prisma.Decimal(indicator.changeRate),
          status: indicator.status,
          currency: indicator.currency,
          unit: indicator.unit,
          marketState: indicator.marketState,
          source: indicator.source,
          refreshIntervalMs: indicator.refreshIntervalMs,
          lastUpdatedAt: indicator.lastUpdatedAt ?? now,
          expiresAt,
          errorMessage: null
        },
        update: {
          name: indicator.name,
          category: indicator.category,
          value: new Prisma.Decimal(indicator.value),
          change: new Prisma.Decimal(indicator.change),
          changeRate: new Prisma.Decimal(indicator.changeRate),
          status: indicator.status,
          currency: indicator.currency,
          unit: indicator.unit,
          marketState: indicator.marketState,
          source: indicator.source,
          refreshIntervalMs: indicator.refreshIntervalMs,
          lastUpdatedAt: indicator.lastUpdatedAt ?? now,
          expiresAt,
          errorMessage: null
        }
      });
    }

    if (delayedSymbols.length > 0) {
      await this.prisma.marketIndicator.updateMany({
        where: { symbol: { in: delayedSymbols } },
        data: { errorMessage: "실제 API 호출 실패로 마지막 성공 데이터를 유지했습니다." }
      });
    } else if (errors.length > 0 && dueIndicators.length === 0) {
      await this.prisma.marketIndicator.updateMany({
        data: { errorMessage: errors.join(" ") }
      });
    }

    const rows = await this.prisma.marketIndicator.findMany({ orderBy: { symbol: "asc" } });
    return this.toResponse(rows, errors);
  }

  async getUsdKrwRate() {
    const response = await this.getIndicators();
    const indicator = response.indicators.find((row) => row.symbol === "USD_KRW");
    return indicator?.value && indicator.value > 0 ? indicator.value : FALLBACK_USD_KRW_RATE;
  }

  async getExchangeRate() {
    const response = await this.getIndicators();
    return {
      ...response,
      indicators: response.indicators.filter((indicator) => indicator.symbol === "USD_KRW")
    };
  }

  async getMarketContext() {
    const response = await this.getIndicators();
    const bySymbol = new Map(response.indicators.map((indicator) => [indicator.symbol, indicator]));
    const usdKrw = bySymbol.get("USD_KRW");
    const spx = bySymbol.get("SPX");
    const ndx = bySymbol.get("NDX");

    return {
      usdKrwRate: usdKrw?.value && usdKrw.value > 0 ? usdKrw.value : FALLBACK_USD_KRW_RATE,
      usdKrwChangeRate: usdKrw?.changeRate ?? 0,
      usIndexChangeRate: average([spx?.changeRate, ndx?.changeRate].filter(isNumber)),
      indicators: response.indicators
    };
  }

  private toResponse(rows: MarketIndicator[], errors: string[]) {
    const now = Date.now();
    const indicators = rows.map((row) => {
      const isDelayed = row.expiresAt.getTime() <= now || Boolean(row.errorMessage);
      return {
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        category: row.category,
        value: Number(row.value),
        change: Number(row.change),
        changeRate: Number(row.changeRate),
        status: isDelayed ? "DELAYED" : row.status,
        rawStatus: row.status,
        currency: row.currency,
        unit: row.unit,
        marketState: row.marketState,
        source: row.source,
        refreshIntervalMs: row.refreshIntervalMs,
        lastUpdatedAt: row.lastUpdatedAt.toISOString(),
        errorMessage: row.errorMessage,
        isDelayed
      };
    });
    const lastSuccessAt = maxDate(rows.map((row) => row.lastUpdatedAt));

    return {
      refreshedAt: new Date().toISOString(),
      lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
      nextRefreshIntervalMs: nextRefreshInterval(rows),
      indicators,
      errors
    };
  }
}

function nextRefreshInterval(rows: MarketIndicator[]) {
  if (rows.length === 0) return 60_000;
  const now = Date.now();
  const remaining = rows.map((row) => row.expiresAt.getTime() - now).filter((value) => value > 0);
  if (remaining.length === 0) return 60_000;
  return Math.max(30_000, Math.min(...remaining));
}

function maxDate(values: Date[]) {
  if (values.length === 0) return null;
  return values.reduce((latest, value) => (value.getTime() > latest.getTime() ? value : latest), values[0]);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
