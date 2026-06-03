import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { MarketIndicatorInput } from "./market-data-provider";
import { MockMarketDataProvider } from "./mock-market-data.provider";
import { RealMarketDataProvider } from "./real-market-data.provider";

type CacheEntry = {
  indicators: MarketIndicatorInput[];
  errors: string[];
  expiresAt: number;
};

type ProviderJob = {
  label: string;
  runReal: () => Promise<MarketIndicatorInput[]>;
  runMock: () => Promise<MarketIndicatorInput[]>;
};

const CACHE_KEY = "invest-hub:market-indicators:all";

@Injectable()
export class CachedMarketDataService implements OnModuleDestroy {
  private readonly memoryCache = new Map<string, CacheEntry>();
  private redisClient: any | null = null;
  private redisUnavailable = false;

  constructor(
    private readonly realProvider: RealMarketDataProvider,
    private readonly mockProvider: MockMarketDataProvider
  ) {}

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => undefined);
    }
  }

  async getAllIndicators(force = false) {
    const providerMode = process.env.MARKET_DATA_PROVIDER ?? "real";
    if (providerMode === "mock") {
      const indicators = await this.mockProvider.getAllIndicators();
      return { indicators, errors: [] };
    }

    if (!force) {
      const cached = await this.getCache(CACHE_KEY);
      if (cached && cached.expiresAt > Date.now()) {
        return { indicators: cached.indicators, errors: cached.errors };
      }
    }

    const result = await this.fetchWithFallback();
    await this.setCache(CACHE_KEY, result, shortestTtl(result.indicators));
    return result;
  }

  async getExchangeRate(force = false) {
    const all = await this.getAllIndicators(force);
    return {
      indicators: all.indicators.filter((indicator) => indicator.symbol === "USD_KRW"),
      errors: all.errors
    };
  }

  private async fetchWithFallback() {
    const indicators: MarketIndicatorInput[] = [];
    const errors: string[] = [];
    const jobs: ProviderJob[] = [
      { label: "환율", runReal: () => this.realProvider.getExchangeRate(), runMock: () => this.mockProvider.getExchangeRate() },
      { label: "공포탐욕지수", runReal: () => this.realProvider.getFearGreedIndex(), runMock: () => this.mockProvider.getFearGreedIndex() },
      { label: "국제유가", runReal: () => this.realProvider.getOilPrices(), runMock: () => this.mockProvider.getOilPrices() },
      { label: "국채금리", runReal: () => this.realProvider.getBondYields(), runMock: () => this.mockProvider.getBondYields() },
      { label: "주요 지수", runReal: () => this.realProvider.getMarketIndexes(), runMock: () => this.mockProvider.getMarketIndexes() },
      { label: "원자재", runReal: () => this.realProvider.getCommodities(), runMock: () => this.mockProvider.getCommodities() },
      { label: "가상자산", runReal: () => this.realProvider.getCryptoPrices(), runMock: () => this.mockProvider.getCryptoPrices() }
    ];

    for (const job of jobs) {
      try {
        const rows = await job.runReal();
        if (rows.length === 0) throw new Error("빈 응답");
        indicators.push(...rows);
      } catch (error) {
        errors.push(`${job.label} 실제 API 실패: ${(error as Error).message}`);
        indicators.push(...(await job.runMock()));
      }
    }

    return { indicators, errors };
  }

  private async getCache(key: string) {
    const redis = await this.getRedisClient();
    if (redis) {
      const cached = await redis.get(key).catch(() => null);
      if (cached) return JSON.parse(cached) as CacheEntry;
    }

    return this.memoryCache.get(key) ?? null;
  }

  private async setCache(key: string, value: { indicators: MarketIndicatorInput[]; errors: string[] }, ttlMs: number) {
    const entry: CacheEntry = {
      ...value,
      expiresAt: Date.now() + ttlMs
    };

    const redis = await this.getRedisClient();
    if (redis) {
      await redis.set(key, JSON.stringify(entry), { PX: ttlMs }).catch(() => {
        this.memoryCache.set(key, entry);
      });
      return;
    }

    this.memoryCache.set(key, entry);
  }

  private async getRedisClient() {
    if (this.redisClient) return this.redisClient;
    if (this.redisUnavailable || !process.env.REDIS_URL) return null;

    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: process.env.REDIS_URL });
      client.on("error", () => {
        this.redisUnavailable = true;
      });
      await client.connect();
      this.redisClient = client;
      return this.redisClient;
    } catch {
      this.redisUnavailable = true;
      return null;
    }
  }
}

function shortestTtl(indicators: MarketIndicatorInput[]) {
  if (indicators.length === 0) return 60_000;
  return Math.max(30_000, Math.min(...indicators.map((indicator) => indicator.refreshIntervalMs)));
}
