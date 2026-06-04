import { Injectable } from "@nestjs/common";
import { MarketIndicator, Prisma } from "@prisma/client";
import { TossOpenApiService } from "../brokers/toss-open-api.service";
import { PrismaService } from "../prisma/prisma.service";
import { CachedMarketDataService } from "./cached-market-data.service";

const FALLBACK_USD_KRW_RATE = Number(process.env.USD_KRW_RATE ?? 1516.5);

@Injectable()
export class MarketIndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cachedMarketDataService: CachedMarketDataService,
    private readonly tossOpenApiService: TossOpenApiService
  ) {}

  async getIndicators(userId?: string) {
    const initialRows = await this.prisma.marketIndicator.findMany({ orderBy: { symbol: "asc" } });
    if (initialRows.length === 0) {
      return this.refreshIndicators(false, userId);
    }

    const errors = await this.refreshUsdKrwFromToss(userId);
    const rows = await this.prisma.marketIndicator.findMany({ orderBy: { symbol: "asc" } });
    const needsRefresh = rows.some((row) => row.symbol !== "USD_KRW" && row.expiresAt.getTime() <= Date.now());
    if (needsRefresh) {
      return this.refreshIndicators(false, userId);
    }

    return this.toResponse(rows, errors);
  }

  async refreshIndicators(force = true, userId?: string) {
    const now = new Date();
    const existingRows = await this.prisma.marketIndicator.findMany();
    const existingBySymbol = new Map(existingRows.map((row) => [row.symbol, row]));
    const expiredRows = existingRows.filter((row) => row.expiresAt.getTime() <= now.getTime());

    if (!force && existingRows.length > 0 && expiredRows.length === 0) {
      const errors = await this.refreshUsdKrwFromToss(userId, now, force);
      const rows = await this.prisma.marketIndicator.findMany({ orderBy: { symbol: "asc" } });
      return this.toResponse(rows, errors);
    }

    const { indicators, errors } = await this.cachedMarketDataService.getAllIndicators(force);
    const tossErrors = await this.refreshUsdKrwFromToss(userId, now, force);
    const rowsAfterToss = await this.prisma.marketIndicator.findMany();
    const usdKrwFromToss = rowsAfterToss.find((row) => row.symbol === "USD_KRW" && row.source === "TOSS_OPEN_API");
    const providerIndicators = usdKrwFromToss ? indicators.filter((indicator) => indicator.symbol !== "USD_KRW") : indicators;
    const dueIndicators = indicators.filter((indicator) => {
      const existing = existingBySymbol.get(indicator.symbol);
      return force || !existing || existing.expiresAt.getTime() <= now.getTime();
    }).filter((indicator) => !usdKrwFromToss || indicator.symbol !== "USD_KRW");

    if (dueIndicators.length === 0 && existingRows.length > 0 && errors.length === 0) {
      const rows = await this.prisma.marketIndicator.findMany({ orderBy: { symbol: "asc" } });
      return this.toResponse(rows, tossErrors);
    }

    if (providerIndicators.length === 0 && !usdKrwFromToss) {
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
    return this.toResponse(rows, [...errors, ...tossErrors]);
  }

  async getUsdKrwRate(userId?: string) {
    if (userId) {
      const cachedTossRate = await this.getFreshTossUsdKrwRate();
      if (cachedTossRate) return cachedTossRate;

      await this.refreshUsdKrwFromToss(userId);
      const refreshedTossRate = await this.getFreshTossUsdKrwRate();
      if (refreshedTossRate) return refreshedTossRate;
    }

    const indicator = await this.prisma.marketIndicator.findUnique({ where: { symbol: "USD_KRW" } });
    const value = indicator ? Number(indicator.value) : 0;
    if (value > 0) return value;

    const response = await this.getIndicators();
    const providerIndicator = response.indicators.find((row) => row.symbol === "USD_KRW");
    return providerIndicator?.value && providerIndicator.value > 0 ? providerIndicator.value : FALLBACK_USD_KRW_RATE;
  }

  async getExchangeRate(userId?: string) {
    const response = await this.getIndicators(userId);
    return {
      ...response,
      indicators: response.indicators.filter((indicator) => indicator.symbol === "USD_KRW")
    };
  }

  async getMarketContext(userId?: string) {
    const response = await this.getIndicators(userId);
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

  private async getFreshTossUsdKrwRate(now = new Date()) {
    const row = await this.prisma.marketIndicator.findUnique({ where: { symbol: "USD_KRW" } });
    const value = row ? Number(row.value) : 0;
    if (row?.source === "TOSS_OPEN_API" && row.expiresAt.getTime() > now.getTime() && value > 0) return value;
    return null;
  }

  private async refreshUsdKrwFromToss(userId?: string, now = new Date(), force = false) {
    if (!userId) return [] as string[];

    const existing = await this.prisma.marketIndicator.findUnique({ where: { symbol: "USD_KRW" } });
    const existingValue = existing ? Number(existing.value) : 0;
    const hasFreshTossRate =
      existing?.source === "TOSS_OPEN_API" && existing.expiresAt.getTime() > now.getTime() && existingValue > 0;
    if (!force && hasFreshTossRate) return [] as string[];

    try {
      const tossRate = await this.tossOpenApiService.getUsdKrwRateForUser(userId);
      if (!tossRate?.rate || tossRate.rate <= 0) return [] as string[];

      const previousValue = existing ? Number(existing.value) : tossRate.rate;
      const change = tossRate.rate - previousValue;
      const changeRate = previousValue > 0 ? (change / previousValue) * 100 : 0;

      await this.prisma.marketIndicator.upsert({
        where: { symbol: "USD_KRW" },
        create: {
          symbol: "USD_KRW",
          name: "USD/KRW 환율",
          category: "FX",
          value: new Prisma.Decimal(tossRate.rate),
          change: new Prisma.Decimal(change),
          changeRate: new Prisma.Decimal(changeRate),
          status: change > 0 ? "UP" : change < 0 ? "DOWN" : "NEUTRAL",
          currency: "KRW",
          unit: "KRW",
          marketState: null,
          source: tossRate.source,
          refreshIntervalMs: 45_000,
          lastUpdatedAt: tossRate.fetchedAt ?? now,
          expiresAt: new Date(now.getTime() + 45_000),
          errorMessage: null
        },
        update: {
          name: "USD/KRW 환율",
          category: "FX",
          value: new Prisma.Decimal(tossRate.rate),
          change: new Prisma.Decimal(change),
          changeRate: new Prisma.Decimal(changeRate),
          status: change > 0 ? "UP" : change < 0 ? "DOWN" : "NEUTRAL",
          currency: "KRW",
          unit: "KRW",
          marketState: null,
          source: tossRate.source,
          refreshIntervalMs: 45_000,
          lastUpdatedAt: tossRate.fetchedAt ?? now,
          expiresAt: new Date(now.getTime() + 45_000),
          errorMessage: null
        }
      });

      return [] as string[];
    } catch {
      return ["토스증권 환율 조회에 실패해 마지막 성공 환율을 유지했습니다."];
    }
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
