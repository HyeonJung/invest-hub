import { BadRequestException, Injectable } from "@nestjs/common";
import { Broker, ConnectionStatus, Prisma } from "@prisma/client";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { decryptCredentialSecret, previewCredentialSecret } from "../../common/credential-crypto";
import { PrismaService } from "../../prisma/prisma.service";

const DEFAULT_UPBIT_API_BASE_URL = "https://api.upbit.com";
const UPBIT_ACCOUNT_ALIAS = "코인 계좌";
const INITIAL_CRYPTO_LOGOS: Record<string, string> = {
  BTC: "https://static.upbit.com/logos/BTC.png",
  ETH: "https://static.upbit.com/logos/ETH.png",
  XRP: "https://static.upbit.com/logos/XRP.png",
  SOL: "https://static.upbit.com/logos/SOL.png",
  DOGE: "https://static.upbit.com/logos/DOGE.png",
  ADA: "https://static.upbit.com/logos/ADA.png",
  AVAX: "https://static.upbit.com/logos/AVAX.png",
  LINK: "https://static.upbit.com/logos/LINK.png",
  DOT: "https://static.upbit.com/logos/DOT.png",
  MATIC: "https://static.upbit.com/logos/MATIC.png"
};

type UpbitRuntime = {
  accessKey: string;
  secretKey: string;
  baseUrl: string;
  source: "DB" | "ENV";
  connectionId: string;
  label: string;
};

export type UpbitBalanceResponse = {
  currency?: string;
  balance?: string;
  locked?: string;
  avg_buy_price?: string;
  avg_buy_price_modified?: boolean;
  unit_currency?: string;
};

export type UpbitMarketResponse = {
  market?: string;
  korean_name?: string;
  english_name?: string;
  market_warning?: string;
};

export type UpbitTickerResponse = {
  market?: string;
  trade_price?: number;
  prev_closing_price?: number;
  signed_change_price?: number;
  signed_change_rate?: number;
  timestamp?: number;
};

export type CryptoAccount = {
  broker: "UPBIT";
  externalAccountId: string;
  brokerAccountNo: string | null;
  accountAlias: string;
  accountType: "CRYPTO";
  currencyBase: "KRW";
};

export type CryptoTicker = {
  market: string;
  tradePrice: number;
  prevClosingPrice: number | null;
  signedChangePrice: number;
  signedChangeRate: number;
  timestamp: Date | null;
};

export type NormalizedCryptoHolding = {
  market: string;
  symbol: string;
  currency: string;
  balance: number;
  locked: number;
  avgBuyPrice: number;
  avgBuyPriceCurrency: string;
  currentPrice: number;
  currentPriceKrw: number;
  marketValueKrw: number;
  costAmountKrw: number;
  profitLossKrw: number;
  profitLossRate: number;
  nameKo: string | null;
  nameEn: string | null;
  logoUrl: string | null;
  priceUpdatedAt: Date | null;
};

export type NormalizedCryptoCashBalance = {
  currency: string;
  balance: number;
  locked: number;
};

@Injectable()
export class UpbitExchangeAdapter {
  readonly broker = Broker.UPBIT;

  constructor(private readonly prisma: PrismaService) {}

  async connect(userId: string, options: { credentialId?: string } = {}) {
    const result = await this.syncAll(userId, options);
    return {
      broker: "UPBIT" as const,
      connected: true,
      accounts: await this.getAccounts(userId, options),
      credentialId: result.connectionId,
      message: "업비트 코인 계좌를 연결했습니다."
    };
  }

  async validateConnection(userId: string, options: { credentialId?: string } = {}) {
    const runtime = await this.resolveRuntime(userId, options.credentialId);
    await this.getBalancesWithRuntime(runtime);
    return true;
  }

  async validateCredential(accessKey: string, secretKey: string, baseUrl = upbitBaseUrl()) {
    const runtime: UpbitRuntime = {
      accessKey: accessKey.trim(),
      secretKey: secretKey.trim(),
      baseUrl,
      source: "DB",
      connectionId: "validation",
      label: "연결 테스트"
    };
    await this.getBalancesWithRuntime(runtime);
    return { ok: true, message: "업비트 연결 테스트에 성공했습니다." };
  }

  async getAccounts(userId: string, options: { credentialId?: string } = {}): Promise<CryptoAccount[]> {
    const runtime = await this.resolveRuntime(userId, options.credentialId);
    return [
      {
        broker: "UPBIT",
        externalAccountId: runtime.connectionId,
        brokerAccountNo: null,
        accountAlias: runtime.label || UPBIT_ACCOUNT_ALIAS,
        accountType: "CRYPTO",
        currencyBase: "KRW"
      }
    ];
  }

  async getBalances(userId: string, options: { credentialId?: string } = {}) {
    const runtime = await this.resolveRuntime(userId, options.credentialId);
    return this.getBalancesWithRuntime(runtime);
  }

  async getTickers(markets: string[]): Promise<CryptoTicker[]> {
    const uniqueMarkets = Array.from(new Set(markets.map((market) => market.trim().toUpperCase()).filter(Boolean)));
    if (uniqueMarkets.length === 0) return [];

    const rows: UpbitTickerResponse[] = [];
    for (const chunk of chunkArray(uniqueMarkets, 100)) {
      const search = new URLSearchParams({ markets: chunk.join(",") });
      rows.push(...(await this.publicRequest<UpbitTickerResponse[]>(`/v1/ticker?${search.toString()}`)));
    }
    return normalizeUpbitTickers(rows);
  }

  async syncBalances(userId: string, options: { credentialId?: string } = {}) {
    return this.syncAll(userId, options);
  }

  async syncPrices(userId: string, options: { credentialId?: string } = {}) {
    return this.syncAll(userId, options);
  }

  async syncAll(userId: string, options: { credentialId?: string } = {}) {
    const runtime = await this.resolveRuntime(userId, options.credentialId);
    const syncedAt = new Date();

    try {
      const [balances, markets] = await Promise.all([
        this.getBalancesWithRuntime(runtime),
        this.getMarkets()
      ]);
      const marketMap = buildMarketMap(markets);
      const requiredMarkets = marketsForBalances(balances, marketMap);
      const quoteMarkets = quoteConversionMarkets(requiredMarkets);
      const tickers = await this.getTickers([...requiredMarkets, ...quoteMarkets]);
      const tickerMap = new Map(tickers.map((ticker) => [ticker.market, ticker]));
      const normalized = normalizeUpbitBalances(balances, marketMap, tickerMap);

      await this.persistSnapshot(userId, runtime, normalized, syncedAt);

      return {
        broker: "UPBIT" as const,
        connectionId: runtime.connectionId,
        accounts: 1,
        saved: normalized.holdings.length,
        cashBalances: normalized.cashBalances,
        syncedAt: syncedAt.toISOString(),
        source: "UPBIT_REST_API",
        portfolioValue: cryptoPortfolioValue(normalized.holdings),
        errors: [] as string[]
      };
    } catch (error) {
      const message = safeUpbitErrorMessage(error);
      await this.markConnectionError(runtime.connectionId, message);
      throw new Error(message);
    }
  }

  async getConnectionStatus(userId: string) {
    const credentials = await this.listCredentials(userId);
    const connected = credentials.some((credential) => credential.status === "ACTIVE");
    return {
      connected,
      status: connected ? "ACTIVE" : credentials[0]?.status ?? "INACTIVE",
      brokerType: "UPBIT",
      connectionType: "API",
      baseUrl: upbitBaseUrl(),
      hasEnvCredential: Boolean(process.env.UPBIT_ACCESS_KEY && process.env.UPBIT_SECRET_KEY),
      credentials
    };
  }

  async listCredentials(userId: string) {
    const connections = await this.prisma.brokerConnection.findMany({
      where: { userId, broker: "UPBIT" },
      include: { credential: true, cryptoHoldings: true, cryptoCashBalances: true },
      orderBy: { createdAt: "asc" }
    });

    return connections.map((connection, index) => {
      const metadata = readMetadata(connection.credential?.metadata);
      const cashKrw = connection.cryptoCashBalances
        .filter((cash) => cash.currency === "KRW")
        .reduce((sum, cash) => sum + Number(cash.balance) + Number(cash.locked), 0);
      return {
        connectionId: connection.id,
        label: metadata.label ?? `업비트 ${index + 1}`,
        accessKey: connection.credential?.clientId ?? null,
        accessKeyPreview: previewCredentialSecret(connection.credential?.clientId ?? ""),
        secretPreview: metadata.secretPreview ?? null,
        status: connection.status,
        source: "DB" as const,
        baseUrl: metadata.baseUrl ?? upbitBaseUrl(),
        updatedAt: metadata.updatedAt ?? connection.updatedAt.toISOString(),
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        lastPriceSyncedAt: connection.lastPriceSyncedAt?.toISOString() ?? null,
        errorMessage: connection.errorMessage ?? metadata.errorMessage ?? null,
        holdingsCount: connection.cryptoHoldings.length,
        cashKrw
      };
    });
  }

  private async resolveRuntime(userId: string, credentialId?: string): Promise<UpbitRuntime> {
    const connection = credentialId
      ? await this.prisma.brokerConnection.findFirst({
          where: { id: credentialId, userId, broker: "UPBIT" },
          include: { credential: true }
        })
      : await this.prisma.brokerConnection.findFirst({
          where: { userId, broker: "UPBIT", credential: { isNot: null } },
          include: { credential: true },
          orderBy: { updatedAt: "desc" }
        });

    if (connection?.credential?.clientId && connection.credential.encryptedSecret) {
      const metadata = readMetadata(connection.credential.metadata);
      return {
        accessKey: connection.credential.clientId,
        secretKey: decryptCredentialSecret(connection.credential.encryptedSecret),
        baseUrl: metadata.baseUrl ?? upbitBaseUrl(),
        source: "DB",
        connectionId: connection.id,
        label: metadata.label ?? UPBIT_ACCOUNT_ALIAS
      };
    }

    const envAccessKey = process.env.UPBIT_ACCESS_KEY?.trim();
    const envSecretKey = process.env.UPBIT_SECRET_KEY?.trim();
    if (envAccessKey && envSecretKey) {
      const envConnection = await this.ensureEnvConnection(userId);
      return {
        accessKey: envAccessKey,
        secretKey: envSecretKey,
        baseUrl: upbitBaseUrl(),
        source: "ENV",
        connectionId: envConnection.id,
        label: UPBIT_ACCOUNT_ALIAS
      };
    }

    throw new BadRequestException("업비트 API Key가 등록되어 있지 않습니다.");
  }

  private async ensureEnvConnection(userId: string) {
    const existing = await this.prisma.brokerConnection.findFirst({
      where: { userId, broker: "UPBIT", brokerType: "UPBIT_ENV" }
    });
    if (existing) return existing;

    return this.prisma.brokerConnection.create({
      data: {
        userId,
        broker: "UPBIT",
        brokerType: "UPBIT_ENV",
        connectionType: "API",
        status: "ACTIVE"
      }
    });
  }

  private async getBalancesWithRuntime(runtime: UpbitRuntime) {
    return this.authenticatedRequest<UpbitBalanceResponse[]>(runtime, "/v1/accounts");
  }

  private async getMarkets() {
    return this.publicRequest<UpbitMarketResponse[]>("/v1/market/all?is_details=true");
  }

  private async authenticatedRequest<T>(runtime: UpbitRuntime, path: string, params: Record<string, string | string[]> = {}): Promise<T> {
    const queryString = buildUpbitQueryString(params);
    const suffix = queryString ? `${path}?${queryString}` : path;
    return this.request<T>(`${runtime.baseUrl}${suffix}`, {
      headers: {
        Authorization: `Bearer ${buildUpbitJwt({ accessKey: runtime.accessKey, secretKey: runtime.secretKey, queryString })}`,
        Accept: "application/json"
      }
    });
  }

  private async publicRequest<T>(path: string): Promise<T> {
    return this.request<T>(`${upbitBaseUrl()}${path}`, {
      headers: {
        Accept: "application/json"
      }
    });
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": "invest-hub-upbit/0.1",
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = readUpbitError(body);
      throw new Error(`업비트 API 오류(${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  private async persistSnapshot(
    userId: string,
    runtime: UpbitRuntime,
    normalized: { holdings: NormalizedCryptoHolding[]; cashBalances: NormalizedCryptoCashBalance[] },
    syncedAt: Date
  ) {
    const holdingMarkets = normalized.holdings.map((holding) => holding.market);
    const cashCurrencies = normalized.cashBalances.map((cash) => cash.currency);

    await this.prisma.$transaction(async (tx) => {
      await tx.cryptoHolding.deleteMany({
        where: {
          connectionId: runtime.connectionId,
          ...(holdingMarkets.length > 0 ? { market: { notIn: holdingMarkets } } : {})
        }
      });
      await tx.cryptoCashBalance.deleteMany({
        where: {
          connectionId: runtime.connectionId,
          ...(cashCurrencies.length > 0 ? { currency: { notIn: cashCurrencies } } : {})
        }
      });

      for (const cash of normalized.cashBalances) {
        await tx.cryptoCashBalance.upsert({
          where: {
            connectionId_currency: {
              connectionId: runtime.connectionId,
              currency: cash.currency
            }
          },
          create: {
            userId,
            connectionId: runtime.connectionId,
            currency: cash.currency,
            balance: new Prisma.Decimal(cash.balance),
            locked: new Prisma.Decimal(cash.locked)
          },
          update: {
            balance: new Prisma.Decimal(cash.balance),
            locked: new Prisma.Decimal(cash.locked)
          }
        });
      }

      for (const holding of normalized.holdings) {
        const asset = await tx.cryptoAsset.upsert({
          where: { market: holding.market },
          create: {
            symbol: holding.symbol,
            market: holding.market,
            nameKo: holding.nameKo,
            nameEn: holding.nameEn,
            logoUrl: holding.logoUrl,
            currency: holding.currency
          },
          update: {
            symbol: holding.symbol,
            nameKo: holding.nameKo,
            nameEn: holding.nameEn,
            logoUrl: holding.logoUrl,
            currency: holding.currency
          }
        });

        await tx.cryptoHolding.upsert({
          where: {
            connectionId_market: {
              connectionId: runtime.connectionId,
              market: holding.market
            }
          },
          create: {
            userId,
            connectionId: runtime.connectionId,
            assetId: asset.id,
            market: holding.market,
            symbol: holding.symbol,
            currency: holding.currency,
            balance: new Prisma.Decimal(holding.balance),
            locked: new Prisma.Decimal(holding.locked),
            avgBuyPrice: new Prisma.Decimal(holding.avgBuyPrice),
            avgBuyPriceCurrency: holding.avgBuyPriceCurrency,
            currentPrice: new Prisma.Decimal(holding.currentPrice),
            marketValueKrw: new Prisma.Decimal(holding.marketValueKrw),
            costAmountKrw: new Prisma.Decimal(holding.costAmountKrw),
            profitLossKrw: new Prisma.Decimal(holding.profitLossKrw),
            profitLossRate: new Prisma.Decimal(holding.profitLossRate),
            priceUpdatedAt: holding.priceUpdatedAt ?? syncedAt
          },
          update: {
            assetId: asset.id,
            symbol: holding.symbol,
            currency: holding.currency,
            balance: new Prisma.Decimal(holding.balance),
            locked: new Prisma.Decimal(holding.locked),
            avgBuyPrice: new Prisma.Decimal(holding.avgBuyPrice),
            avgBuyPriceCurrency: holding.avgBuyPriceCurrency,
            currentPrice: new Prisma.Decimal(holding.currentPrice),
            marketValueKrw: new Prisma.Decimal(holding.marketValueKrw),
            costAmountKrw: new Prisma.Decimal(holding.costAmountKrw),
            profitLossKrw: new Prisma.Decimal(holding.profitLossKrw),
            profitLossRate: new Prisma.Decimal(holding.profitLossRate),
            priceUpdatedAt: holding.priceUpdatedAt ?? syncedAt
          }
        });
      }

      await tx.brokerConnection.update({
        where: { id: runtime.connectionId },
        data: {
          brokerType: runtime.source === "ENV" ? "UPBIT_ENV" : "UPBIT",
          connectionType: "API",
          status: "ACTIVE",
          lastSyncedAt: syncedAt,
          lastPriceSyncedAt: syncedAt,
          errorMessage: null
        }
      });
    });
  }

  private async markConnectionError(connectionId: string, message: string) {
    if (connectionId === "validation") return;
    await this.prisma.brokerConnection.updateMany({
      where: { id: connectionId, broker: "UPBIT" },
      data: {
        status: "ERROR",
        errorMessage: message
      }
    });
  }
}

export function buildUpbitJwt({
  accessKey,
  secretKey,
  queryString = "",
  nonce = randomUUID()
}: {
  accessKey: string;
  secretKey: string;
  queryString?: string;
  nonce?: string;
}) {
  const header = { alg: "HS512", typ: "JWT" };
  const payload: Record<string, string> = {
    access_key: accessKey,
    nonce
  };

  if (queryString) {
    payload.query_hash = createHash("sha512").update(queryString, "utf8").digest("hex");
    payload.query_hash_alg = "SHA512";
  }

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha512", secretKey).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function buildUpbitQueryString(params: Record<string, string | string[]> = {}) {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        pairs.push(`${key}=${encodeURIComponent(item)}`);
      }
    } else if (value != null && value !== "") {
      pairs.push(`${key}=${encodeURIComponent(value)}`);
    }
  }
  return pairs.join("&");
}

export function normalizeUpbitTickers(rows: UpbitTickerResponse[]): CryptoTicker[] {
  return rows
    .map((row) => ({
      market: String(row.market ?? "").toUpperCase(),
      tradePrice: toNumber(row.trade_price),
      prevClosingPrice: toNullableNumber(row.prev_closing_price),
      signedChangePrice: toNumber(row.signed_change_price),
      signedChangeRate: toNumber(row.signed_change_rate) * 100,
      timestamp: Number.isFinite(row.timestamp) ? new Date(Number(row.timestamp)) : null
    }))
    .filter((ticker) => ticker.market && ticker.tradePrice > 0);
}

export function normalizeUpbitBalances(
  balances: UpbitBalanceResponse[],
  marketMap: Map<string, UpbitMarketResponse>,
  tickerMap: Map<string, CryptoTicker>
) {
  const cashBalances: NormalizedCryptoCashBalance[] = [];
  const holdings: NormalizedCryptoHolding[] = [];
  const quoteRates = quoteCurrencyRates(tickerMap);

  for (const row of balances) {
    const symbol = String(row.currency ?? "").trim().toUpperCase();
    if (!symbol) continue;

    const balance = toNumber(row.balance);
    const locked = toNumber(row.locked);
    const totalQuantity = balance + locked;
    if (totalQuantity <= 0) continue;

    if (symbol === "KRW") {
      cashBalances.push({ currency: "KRW", balance, locked });
      continue;
    }

    const market = resolveMarketForSymbol(symbol, row.unit_currency, marketMap);
    if (!market) continue;

    const ticker = tickerMap.get(market);
    const quoteCurrency = market.split("-")[0] ?? String(row.unit_currency ?? "KRW").toUpperCase();
    const quoteRate = quoteRates.get(quoteCurrency) ?? 0;
    const currentPrice = ticker?.tradePrice ?? 0;
    const currentPriceKrw = currentPrice * quoteRate;
    const avgBuyPrice = toNumber(row.avg_buy_price);
    const avgBuyPriceCurrency = String(row.unit_currency ?? quoteCurrency ?? "KRW").trim().toUpperCase();
    const costRate = quoteRates.get(avgBuyPriceCurrency) ?? quoteRate;
    const value = calculateCryptoHoldingValue({
      balance,
      locked,
      currentPriceKrw,
      avgBuyPrice,
      avgBuyPriceCurrencyRate: costRate
    });
    const marketInfo = marketMap.get(market);

    holdings.push({
      market,
      symbol,
      currency: "KRW",
      balance,
      locked,
      avgBuyPrice,
      avgBuyPriceCurrency,
      currentPrice,
      currentPriceKrw,
      marketValueKrw: value.marketValueKrw,
      costAmountKrw: value.costAmountKrw,
      profitLossKrw: value.profitLossKrw,
      profitLossRate: value.profitLossRate,
      nameKo: marketInfo?.korean_name ?? null,
      nameEn: marketInfo?.english_name ?? null,
      logoUrl: INITIAL_CRYPTO_LOGOS[symbol] ?? null,
      priceUpdatedAt: ticker?.timestamp ?? null
    });
  }

  return { cashBalances, holdings };
}

export function calculateCryptoHoldingValue({
  balance,
  locked,
  currentPriceKrw,
  avgBuyPrice,
  avgBuyPriceCurrencyRate = 1
}: {
  balance: number;
  locked: number;
  currentPriceKrw: number;
  avgBuyPrice: number;
  avgBuyPriceCurrencyRate?: number;
}) {
  const totalQuantity = balance + locked;
  const marketValueKrw = roundNumber(totalQuantity * currentPriceKrw, 2);
  const costAmountKrw = roundNumber(totalQuantity * avgBuyPrice * avgBuyPriceCurrencyRate, 2);
  const profitLossKrw = roundNumber(marketValueKrw - costAmountKrw, 2);
  const profitLossRate = costAmountKrw > 0 ? roundNumber((profitLossKrw / costAmountKrw) * 100, 4) : 0;

  return {
    totalQuantity,
    marketValueKrw,
    costAmountKrw,
    profitLossKrw,
    profitLossRate
  };
}

function marketsForBalances(balances: UpbitBalanceResponse[], marketMap: Map<string, UpbitMarketResponse>) {
  return balances
    .map((balance) => resolveMarketForSymbol(String(balance.currency ?? "").toUpperCase(), balance.unit_currency, marketMap))
    .filter((market): market is string => Boolean(market));
}

function resolveMarketForSymbol(symbol: string, unitCurrency: string | undefined, marketMap: Map<string, UpbitMarketResponse>) {
  if (!symbol || symbol === "KRW") return null;
  const preferred = [`KRW-${symbol}`, `${String(unitCurrency ?? "").toUpperCase()}-${symbol}`, `BTC-${symbol}`, `USDT-${symbol}`]
    .filter((market) => /^[A-Z]+-[A-Z0-9]+$/.test(market));
  for (const market of preferred) {
    if (marketMap.has(market)) return market;
  }
  return Array.from(marketMap.keys()).find((market) => market.endsWith(`-${symbol}`)) ?? null;
}

function quoteConversionMarkets(markets: string[]) {
  const quoteCurrencies = new Set(markets.map((market) => market.split("-")[0]).filter((currency) => currency && currency !== "KRW"));
  const required: string[] = [];
  if (quoteCurrencies.has("BTC")) required.push("KRW-BTC");
  if (quoteCurrencies.has("USDT")) required.push("KRW-USDT");
  return required;
}

function quoteCurrencyRates(tickerMap: Map<string, CryptoTicker>) {
  const rates = new Map<string, number>([["KRW", 1]]);
  const btc = tickerMap.get("KRW-BTC");
  const usdt = tickerMap.get("KRW-USDT");
  if (btc) rates.set("BTC", btc.tradePrice);
  if (usdt) rates.set("USDT", usdt.tradePrice);
  return rates;
}

function buildMarketMap(markets: UpbitMarketResponse[]) {
  return new Map(
    markets
      .filter((market) => market.market)
      .map((market) => [String(market.market).toUpperCase(), { ...market, market: String(market.market).toUpperCase() }])
  );
}

function cryptoPortfolioValue(holdings: NormalizedCryptoHolding[]) {
  const totalMarketValue = holdings.reduce((sum, holding) => sum + holding.marketValueKrw, 0);
  const totalPurchaseAmount = holdings.reduce((sum, holding) => sum + holding.costAmountKrw, 0);
  const totalProfitLoss = totalMarketValue - totalPurchaseAmount;
  return {
    totalPurchaseAmount,
    totalMarketValue,
    totalProfitLoss,
    totalReturnRate: totalPurchaseAmount > 0 ? (totalProfitLoss / totalPurchaseAmount) * 100 : 0
  };
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function upbitBaseUrl() {
  return process.env.UPBIT_API_BASE_URL?.trim() || DEFAULT_UPBIT_API_BASE_URL;
}

function readMetadata(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function readUpbitError(body: unknown) {
  if (!body || typeof body !== "object") return "응답을 처리할 수 없습니다.";
  const error = (body as { error?: { name?: string; message?: string } }).error;
  return [error?.name, error?.message].filter(Boolean).join(" - ") || "응답을 처리할 수 없습니다.";
}

function safeUpbitErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "업비트 API 요청에 실패했습니다.";
  return message.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]");
}

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toNullableNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function roundNumber(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
