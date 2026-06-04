import { Injectable } from "@nestjs/common";
import { Prisma, Security } from "@prisma/client";
import { KiwoomRestAdapter } from "../brokers/adapters/kiwoom-rest.adapter";
import { NamuhOpenApiAdapter } from "../brokers/adapters/namuh-open-api.adapter";
import { MarketIndicatorsService } from "../market-indicators/market-indicators.service";
import { PrismaService } from "../prisma/prisma.service";
import { getMarketSession } from "./market-clock";

type Quote = {
  symbol: string;
  marketCountry: string;
  price: number;
  priceKrw: number;
  currency: string;
  source: string;
};

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketIndicatorsService: MarketIndicatorsService,
    private readonly kiwoomRestAdapter: KiwoomRestAdapter,
    private readonly namuhOpenApiAdapter: NamuhOpenApiAdapter
  ) {}

  async refreshUserPrices(userId: string) {
    const startedAt = new Date();
    const marketSession = getMarketSession(startedAt);
    const usdKrwRate = await this.marketIndicatorsService.getUsdKrwRate(userId);
    const allHoldings = await this.prisma.holding.findMany({
      where: {
        account: { userId },
        NOT: {
          sourceType: "API",
          account: { broker: "TOSS" }
        }
      },
      include: { security: true, account: true }
    });
    const kiwoomApiHoldings = allHoldings.filter(
      (holding) => holding.sourceType === "API" && holding.account.broker === "KIWOOM"
    );
    const namuhApiHoldings = allHoldings.filter(
      (holding) => holding.sourceType === "API" && holding.account.broker === "NAMUH"
    );
    const holdings = allHoldings.filter(
      (holding) => !(holding.sourceType === "API" && (holding.account.broker === "KIWOOM" || holding.account.broker === "NAMUH"))
    );
    const securities = uniqueSecurities(holdings.map((holding) => holding.security));
    const kiwoomSecurities = uniqueSecurities(kiwoomApiHoldings.map((holding) => holding.security));
    const namuhSecurities = uniqueSecurities(namuhApiHoldings.map((holding) => holding.security));
    const allSecurities = uniqueSecurities(allHoldings.map((holding) => holding.security));
    const usableSecurities = securities.filter((security) => canFetchQuote(security));

    const cached = await this.getFreshCachedQuotes(usableSecurities, marketSession.refreshIntervalMs, usdKrwRate);
    const missing = usableSecurities.filter((security) => !cached.has(cacheKey(security)));
    const fetched = await this.fetchYahooQuotes(missing, usdKrwRate);
    const kiwoomResult = await this.fetchKiwoomQuotes(userId, kiwoomSecurities, marketSession.refreshIntervalMs);
    const namuhResult = await this.fetchNamuhQuotes(userId, namuhSecurities, marketSession.refreshIntervalMs);
    const quotes = new Map<string, Quote>([...cached, ...fetched, ...kiwoomResult.quotes, ...namuhResult.quotes]);

    let updatedHoldings = 0;
    const errors: string[] = [...kiwoomResult.errors, ...namuhResult.errors];
    const skipped = securities
      .filter((security) => !canFetchQuote(security))
      .map((security) => security.symbol);

    if (missing.length > 0 && fetched.size === 0) {
      errors.push("현재가 제공자 응답이 없어서 마지막 성공 가격을 유지했습니다.");
    }

    for (const holding of allHoldings) {
      const quote = quotes.get(cacheKey(holding.security));
      if (!quote) continue;

      const quantity = Number(holding.quantity);
      if (quantity <= 0) continue;

      const currentMarketPrice = Number(holding.marketPrice);
      const currentMarketValue = Number(holding.marketValue);
      const currentCostAmount = Number(holding.costAmount);
      const currentAnnualDividend = Number(holding.annualDividendEstimate);
      const costAmount = normalizeStoredAmount({
        currency: holding.security.currency,
        quantity,
        marketPrice: currentMarketPrice,
        marketValue: currentMarketValue,
        amount: currentCostAmount,
        usdKrwRate
      });
      const previousMarketValue = normalizeStoredAmount({
        currency: holding.security.currency,
        quantity,
        marketPrice: currentMarketPrice,
        marketValue: currentMarketValue,
        amount: currentMarketValue,
        usdKrwRate
      });
      const marketValue = quantity * quote.priceKrw;
      const profitLoss = marketValue - costAmount;
      const dividendRatio = previousMarketValue > 0 ? currentAnnualDividend / previousMarketValue : 0;

      await this.prisma.holding.update({
        where: { id: holding.id },
        data: {
          marketPrice: quote.priceKrw,
          marketValue,
          costAmount,
          profitLoss,
          profitLossRate: costAmount > 0 ? (profitLoss / costAmount) * 100 : 0,
          annualDividendEstimate: Math.max(0, marketValue * dividendRatio),
          snapshotDate: startedAt
        }
      });
      updatedHoldings += 1;
    }

    const successfulQuotes = Array.from(quotes.values());

    return {
      refreshedAt: startedAt.toISOString(),
      lastSuccessAt: successfulQuotes.length > 0 ? startedAt.toISOString() : await this.getLastSuccessAt(userId),
      refreshIntervalMs: marketSession.refreshIntervalMs,
      marketSession,
      symbolsRequested: allSecurities.length,
      symbolsFetched: successfulQuotes.length,
      holdingsUpdated: updatedHoldings,
      source: [
        "YAHOO_FINANCE",
        kiwoomResult.quotes.size > 0 ? "KIWOOM_REST_API" : null,
        namuhResult.quotes.size > 0 ? "NAMUH_WMCA" : null
      ].filter(Boolean).join(","),
      skipped,
      errors
    };
  }

  async getStatus(userId: string) {
    const marketSession = getMarketSession();
    return {
      refreshedAt: null,
      lastSuccessAt: await this.getLastSuccessAt(userId),
      refreshIntervalMs: marketSession.refreshIntervalMs,
      marketSession,
      symbolsRequested: 0,
      symbolsFetched: 0,
      holdingsUpdated: 0,
      source: "YAHOO_FINANCE",
      skipped: [],
      errors: []
    };
  }

  private async getFreshCachedQuotes(securities: Security[], intervalMs: number, usdKrwRate: number) {
    const now = new Date();
    const minFetchedAt = new Date(now.getTime() - Math.max(20_000, Math.floor(intervalMs * 0.75)));
    const cachedRows = await this.prisma.currentPrice.findMany({
      where: {
        OR: securities.map((security) => ({
          symbol: security.symbol,
          marketCountry: security.marketCountry
        })),
        fetchedAt: { gte: minFetchedAt },
        expiresAt: { gte: now }
      }
    });

    return new Map(
      cachedRows.map((row) => [
        `${row.symbol}:${row.marketCountry}`,
        {
          symbol: row.symbol,
          marketCountry: row.marketCountry,
          price: Number(row.price),
          priceKrw: row.currency === "USD" ? Number(row.price) * usdKrwRate : Number(row.priceKrw),
          currency: row.currency,
          source: row.source
        }
      ])
    );
  }

  private async fetchYahooQuotes(securities: Security[], usdKrwRate: number) {
    if (securities.length === 0) return new Map<string, Quote>();

    const candidates = securities.flatMap((security) =>
      yahooSymbolsFor(security).map((yahooSymbol) => ({ security, yahooSymbol }))
    );
    if (candidates.length === 0) return new Map<string, Quote>();

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      candidates.map((candidate) => candidate.yahooSymbol).join(",")
    )}`;

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "invest-hub-mvp/0.1" }
      });
      if (!response.ok) return new Map();

      const json = (await response.json()) as {
        quoteResponse?: {
          result?: Array<{
            symbol?: string;
            regularMarketPrice?: number;
            currency?: string;
          }>;
        };
      };
      const byYahooSymbol = new Map(
        (json.quoteResponse?.result ?? [])
          .filter((row) => row.symbol && Number.isFinite(row.regularMarketPrice))
          .map((row) => [row.symbol as string, row])
      );
      const quotes = new Map<string, Quote>();

      for (const security of securities) {
        const yahooSymbol = yahooSymbolsFor(security).find((symbol) => byYahooSymbol.has(symbol));
        if (!yahooSymbol) continue;

        const row = byYahooSymbol.get(yahooSymbol);
        const price = Number(row?.regularMarketPrice ?? 0);
        if (!Number.isFinite(price) || price <= 0) continue;

        const currency = row?.currency ?? security.currency;
        const quote: Quote = {
          symbol: security.symbol,
          marketCountry: security.marketCountry,
          price,
          priceKrw: currency === "USD" ? price * usdKrwRate : price,
          currency,
          source: "YAHOO_FINANCE"
        };
        quotes.set(cacheKey(security), quote);
        await this.saveQuote(quote, getMarketSession().refreshIntervalMs);
      }

      return quotes;
    } catch {
      return new Map();
    }
  }

  private async fetchKiwoomQuotes(userId: string, securities: Security[], intervalMs: number) {
    const symbols = securities.map((security) => security.symbol);
    if (symbols.length === 0) {
      return { quotes: new Map<string, Quote>(), errors: [] as string[] };
    }

    try {
      const kiwoomQuotes = await this.kiwoomRestAdapter.getQuotes(userId, symbols);
      const quotes = new Map<string, Quote>();

      for (const quote of kiwoomQuotes.values()) {
        const normalized: Quote = {
          symbol: quote.symbol,
          marketCountry: quote.marketCountry,
          price: quote.price,
          priceKrw: quote.priceKrw,
          currency: quote.currency,
          source: quote.source
        };
        quotes.set(`${quote.symbol}:${quote.marketCountry}`, normalized);
        await this.saveQuote(normalized, intervalMs);
      }

      return { quotes, errors: [] as string[] };
    } catch (error) {
      return {
        quotes: new Map<string, Quote>(),
        errors: [`키움 현재가 갱신에 실패해 마지막 성공 가격을 유지합니다: ${(error as Error).message}`]
      };
    }
  }

  private async fetchNamuhQuotes(userId: string, securities: Security[], intervalMs: number) {
    const symbols = securities.map((security) => security.symbol);
    if (symbols.length === 0) {
      return { quotes: new Map<string, Quote>(), errors: [] as string[] };
    }

    try {
      const namuhQuotes = await this.namuhOpenApiAdapter.getQuotes(userId, symbols);
      const quotes = new Map<string, Quote>();

      for (const quote of namuhQuotes.values()) {
        const normalized: Quote = {
          symbol: quote.symbol,
          marketCountry: quote.marketCountry,
          price: quote.price,
          priceKrw: quote.priceKrw,
          currency: quote.currency,
          source: quote.source
        };
        quotes.set(`${quote.symbol}:${quote.marketCountry}`, normalized);
        await this.saveQuote(normalized, intervalMs);
      }

      return { quotes, errors: [] as string[] };
    } catch (error) {
      return {
        quotes: new Map<string, Quote>(),
        errors: [`나무 현재가 갱신 실패. 마지막 성공 가격을 유지합니다. ${(error as Error).message}`]
      };
    }
  }

  private async saveQuote(quote: Quote, intervalMs: number) {
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + Math.max(20_000, Math.floor(intervalMs * 0.75)));

    await this.prisma.currentPrice.upsert({
      where: {
        symbol_marketCountry: {
          symbol: quote.symbol,
          marketCountry: quote.marketCountry
        }
      },
      create: {
        symbol: quote.symbol,
        marketCountry: quote.marketCountry,
        currency: quote.currency,
        price: new Prisma.Decimal(quote.price),
        priceKrw: new Prisma.Decimal(quote.priceKrw),
        source: quote.source,
        fetchedAt,
        expiresAt
      },
      update: {
        currency: quote.currency,
        price: new Prisma.Decimal(quote.price),
        priceKrw: new Prisma.Decimal(quote.priceKrw),
        source: quote.source,
        fetchedAt,
        expiresAt,
        errorMessage: null
      }
    });
  }

  private async getLastSuccessAt(userId: string) {
    const row = await this.prisma.holding.findFirst({
      where: { account: { userId } },
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true }
    });
    return row?.snapshotDate.toISOString() ?? null;
  }
}

function uniqueSecurities(securities: Security[]) {
  const map = new Map<string, Security>();
  for (const security of securities) {
    map.set(cacheKey(security), security);
  }
  return Array.from(map.values());
}

function cacheKey(security: Pick<Security, "symbol" | "marketCountry">) {
  return `${security.symbol}:${security.marketCountry}`;
}

function canFetchQuote(security: Security) {
  if (security.marketCountry === "US") return /^[A-Z.]{1,8}$/.test(security.symbol);
  if (security.marketCountry === "KR") return /^\d{6}$/.test(security.symbol);
  return false;
}

function yahooSymbolsFor(security: Security) {
  if (security.marketCountry === "US") return [security.symbol];
  if (security.marketCountry === "KR" && /^\d{6}$/.test(security.symbol)) {
    return [`${security.symbol}.KS`, `${security.symbol}.KQ`];
  }
  return [];
}

function normalizeStoredAmount({
  currency,
  quantity,
  marketPrice,
  marketValue,
  amount,
  usdKrwRate
}: {
  currency: string;
  quantity: number;
  marketPrice: number;
  marketValue: number;
  amount: number;
  usdKrwRate: number;
}) {
  if (currency !== "USD" || quantity <= 0 || marketPrice <= 0 || marketValue <= 0 || amount <= 0) return amount;
  if (marketPrice >= 5000) return amount;

  const expectedUsdMarketValue = quantity * marketPrice;
  if (expectedUsdMarketValue <= 0) return amount;

  const ratio = marketValue / expectedUsdMarketValue;
  return ratio > 0.2 && ratio < 5 ? amount * usdKrwRate : amount;
}
