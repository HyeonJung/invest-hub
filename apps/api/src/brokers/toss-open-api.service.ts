import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  decryptCredentialSecret,
  encryptCredentialSecret,
  previewCredentialSecret
} from "../common/credential-crypto";

const TOSS_BASE_URL = "https://openapi.tossinvest.com";
const FALLBACK_USD_KRW_RATE = Number(process.env.USD_KRW_RATE ?? 1516.5);

@Injectable()
export class TossOpenApiService {
  constructor(private readonly prisma: PrismaService) {}

  async syncHoldings(userId: string, clientId?: string, clientSecret?: string, accountId?: string) {
    const credential = await this.resolveCredential(userId, { clientId, clientSecret, accountId });

    const token = await this.issueToken(credential.clientId, credential.clientSecret);
    const usdKrwRate = await this.getUsdKrwRate(token);
    const accountsJson = await this.getJson("/api/v1/accounts", token);
    const accounts = Array.isArray(accountsJson.result) ? accountsJson.result : [];
    if (accounts.length === 0) {
      throw new BadRequestException("동기화 가능한 토스증권 계좌가 없습니다.");
    }

    const accountsToSync = await this.selectAccountsForSync(userId, accounts, accountId);
    let saved = 0;
    for (const account of accountsToSync) {
      const investmentAccount = await this.upsertInvestmentAccount(userId, account, accountId);
      const accountSeq = String(account.accountSeq ?? investmentAccount.externalAccountId ?? "");

      const holdingsJson = await this.getJson("/api/v1/holdings", token, accountSeq);
      const overview = holdingsJson.result ?? {};
      const items = Array.isArray(overview.items) ? overview.items : [];
      const accountSnapshot = buildAccountSnapshot(overview, usdKrwRate);
      await this.prisma.investmentAccount.update({
        where: { id: investmentAccount.id },
        data: accountSnapshot
      });
      await this.prisma.holding.deleteMany({ where: { accountId: investmentAccount.id } });

      for (const item of items) {
        const symbol = String(item.symbol ?? "");
        const marketCountry = item.marketCountry ?? inferMarketCountry(symbol, item.currency);
        const security = await this.prisma.security.upsert({
          where: {
            symbol_marketCountry: {
              symbol,
              marketCountry
            }
          },
          create: {
            symbol,
            name: item.name ?? symbol,
            marketCountry,
            currency: item.currency ?? inferCurrency(symbol),
            assetType: inferAssetType(symbol, item.name ?? ""),
            riskType: null
          },
          update: {
            name: item.name ?? symbol,
            currency: item.currency ?? inferCurrency(symbol)
          }
        });

        const currency = item.currency ?? inferCurrency(symbol);
        const quantity = Number(item.quantity ?? 0);
        const averagePurchasePrice = Number(item.averagePurchasePrice ?? 0);
        const marketPrice = Number(item.lastPrice ?? item.marketPrice ?? 0);
        const marketValueInCurrency =
          readMoney(item.marketValue?.amount) || readMoney(item.marketValue) || quantity * marketPrice;
        const profitLossInCurrency =
          readMoney(item.profitLoss?.amount) || readMoney(item.profitLoss) || marketValueInCurrency - quantity * averagePurchasePrice;
        const marketValue = toKrwTradingAmount(marketValueInCurrency, currency, usdKrwRate);
        const profitLoss = toKrwTradingAmount(profitLossInCurrency, currency, usdKrwRate);
        const purchaseAmount = Math.max(0, marketValue - profitLoss);
        const profitLossRate = readRatePercent(item.profitLoss?.rate);

        await this.prisma.holding.create({
          data: {
            accountId: investmentAccount.id,
            securityId: security.id,
            quantity,
            averagePurchasePrice,
            marketPrice,
            marketValue,
            costAmount: purchaseAmount,
            profitLoss,
            profitLossRate: Number.isFinite(profitLossRate) ? profitLossRate : purchaseAmount > 0 ? (profitLoss / purchaseAmount) * 100 : 0,
            annualDividendEstimate: marketValue * (security.assetType === "ETF" ? 0.02 : 0.008),
            sourceType: "API"
          }
        });
        saved += 1;
      }
    }

    if (accountId) {
      await this.markAccountCredentialUsed(userId, accountId, {
        clientId: credential.clientId,
        clientSecret: clientSecret?.trim()
      });
    }

    await this.prisma.brokerConnection.upsert({
      where: {
        id: await this.findOrCreateConnectionId(userId)
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        broker: "TOSS",
        connectionType: "API",
        status: "ACTIVE",
        lastSyncedAt: new Date(),
        credential: {
          create: {
            clientId: credential.clientId,
            encryptedSecret: "stored-in-account-credential",
            metadata: { storage: "account" }
          }
        }
      },
      update: {
        connectionType: "API",
        status: "ACTIVE",
        lastSyncedAt: new Date()
      }
    });

    return { accounts: accountsToSync.length, saved };
  }

  private async issueToken(clientId: string, clientSecret: string) {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    });

    const response = await fetch(`${TOSS_BASE_URL}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!response.ok) {
      throw new BadRequestException("토스증권 토큰 발급에 실패했습니다. API 정보를 확인하세요.");
    }

    const json = (await response.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new BadRequestException("토스증권 토큰 응답이 올바르지 않습니다.");
    }
    return json.access_token;
  }

  private async getUsdKrwRate(token: string) {
    try {
      const json = await this.getJson("/api/v1/exchange-rate?baseCurrency=USD&quoteCurrency=KRW", token);
      const rate = Number(json.result?.rate ?? 0);
      return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_USD_KRW_RATE;
    } catch {
      return FALLBACK_USD_KRW_RATE;
    }
  }

  private async getJson(path: string, token: string, accountSeq?: string) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`
    };
    if (accountSeq) {
      headers["X-Tossinvest-Account"] = accountSeq;
    }

    const response = await fetch(`${TOSS_BASE_URL}${path}`, { headers });
    if (!response.ok) {
      throw new BadRequestException(`토스증권 API 호출에 실패했습니다: ${path}`);
    }
    return response.json() as Promise<any>;
  }

  private async findOrCreateAccountId(userId: string, externalAccountId: string) {
    const account = await this.prisma.investmentAccount.findFirst({
      where: { userId, broker: "TOSS", externalAccountId }
    });
    return account?.id ?? crypto.randomUUID();
  }

  private async findOrCreateConnectionId(userId: string) {
    const connection = await this.prisma.brokerConnection.findFirst({
      where: { userId, broker: "TOSS" }
    });
    return connection?.id ?? crypto.randomUUID();
  }

  private async resolveCredential(
    userId: string,
    options: { clientId?: string; clientSecret?: string; accountId?: string }
  ) {
    const clientId = options.clientId?.trim();
    const clientSecret = options.clientSecret?.trim();
    if (clientId && clientSecret) {
      return { clientId, clientSecret };
    }

    const saved = await this.prisma.accountApiCredential.findFirst({
      where: {
        userId,
        broker: "TOSS",
        ...(options.accountId ? { accountId: options.accountId } : {})
      },
      orderBy: { updatedAt: "desc" }
    });
    if (!saved) {
      throw new BadRequestException("설정에서 토스증권 API 키를 먼저 저장하세요.");
    }

    return {
      clientId: saved.clientId,
      clientSecret: decryptCredentialSecret(saved.encryptedSecret)
    };
  }

  private async selectAccountsForSync(userId: string, accounts: any[], accountId?: string) {
    if (!accountId) return accounts;

    const localAccount = await this.prisma.investmentAccount.findFirst({
      where: { id: accountId, userId, broker: "TOSS" }
    });
    if (!localAccount) {
      throw new BadRequestException("동기화할 토스증권 계좌를 찾을 수 없습니다.");
    }

    if (localAccount.externalAccountId) {
      const matched = accounts.find((account) => String(account.accountSeq) === localAccount.externalAccountId);
      if (matched) return [matched];
    }

    return [accounts[0]];
  }

  private async upsertInvestmentAccount(userId: string, account: any, selectedAccountId?: string) {
    const accountSeq = String(account.accountSeq ?? "");
    const accountAlias = account.accountName ?? account.nickname ?? account.alias ?? "토스증권";

    if (selectedAccountId) {
      const selected = await this.prisma.investmentAccount.findFirst({
        where: { id: selectedAccountId, userId, broker: "TOSS" }
      });
      if (!selected) {
        throw new BadRequestException("동기화할 토스증권 계좌를 찾을 수 없습니다.");
      }
      return this.prisma.investmentAccount.update({
        where: { id: selected.id },
        data: {
          externalAccountId: accountSeq || selected.externalAccountId,
          accountAlias: selected.accountAlias || accountAlias
        }
      });
    }

    return this.prisma.investmentAccount.upsert({
      where: {
        id: await this.findOrCreateAccountId(userId, accountSeq)
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        broker: "TOSS",
        externalAccountId: accountSeq,
        accountAlias,
        accountType: "BROKERAGE",
        currencyBase: "KRW"
      },
      update: {
        externalAccountId: accountSeq,
        accountAlias
      }
    });
  }

  private async markAccountCredentialUsed(
    userId: string,
    accountId: string,
    options: { clientId: string; clientSecret?: string }
  ) {
    const account = await this.prisma.investmentAccount.findFirst({
      where: { id: accountId, userId, broker: "TOSS" },
      include: { apiCredential: true }
    });
    if (!account) return;

    if (account.apiCredential) {
      await this.prisma.accountApiCredential.update({
        where: { accountId },
        data: {
          clientId: options.clientId,
          ...(options.clientSecret
            ? {
                encryptedSecret: encryptCredentialSecret(options.clientSecret),
                secretPreview: previewCredentialSecret(options.clientSecret)
              }
            : {}),
          status: "ACTIVE",
          lastValidatedAt: new Date(),
          lastUsedAt: new Date()
        }
      });
    } else if (options.clientSecret) {
      await this.prisma.accountApiCredential.create({
        data: {
          userId,
          accountId,
          broker: "TOSS",
          clientId: options.clientId,
          encryptedSecret: encryptCredentialSecret(options.clientSecret),
          secretPreview: previewCredentialSecret(options.clientSecret),
          status: "ACTIVE",
          lastValidatedAt: new Date(),
          lastUsedAt: new Date(),
          metadata: {
            provider: "toss-open-api",
            storage: "account"
          }
        }
      });
    }
  }
}

function readMoney(value: any) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(/[^0-9.-]/g, ""));
  return Number(value.amount ?? value.value ?? value.total ?? value.krw ?? value.usd ?? 0);
}

function readRatePercent(value: any) {
  const rate = readMoney(value);
  if (!Number.isFinite(rate)) return 0;
  return rate * 100;
}

function toKrwTradingAmount(value: number, currency: string, usdKrwRate: number) {
  if (!Number.isFinite(value)) return 0;
  return currency === "USD" ? value * usdKrwRate : value;
}

function readCurrencyBucket(value: any, usdKrwRate: number) {
  if (!value || typeof value !== "object") return readMoney(value);
  const krw = readMoney(value.krw);
  const usd = readMoney(value.usd);
  return krw + usd * usdKrwRate;
}

function buildAccountSnapshot(overview: any, usdKrwRate: number) {
  const marketValue = readCurrencyBucket(overview.marketValue?.amount, usdKrwRate);
  const ratePercent = readRatePercent(overview.profitLoss?.rate);
  const convertedProfitLoss = readCurrencyBucket(overview.profitLoss?.amount, usdKrwRate);
  const profitLoss =
    marketValue > 0 && Number.isFinite(ratePercent)
      ? marketValue - marketValue / (1 + ratePercent / 100)
      : convertedProfitLoss;

  return {
    snapshotMarketValue: marketValue > 0 ? marketValue : null,
    snapshotProfitLoss: Number.isFinite(profitLoss) ? profitLoss : null,
    snapshotReturnRate: Number.isFinite(ratePercent) ? ratePercent : null,
    snapshotSource: "TOSS_OPEN_API",
    snapshotSyncedAt: new Date()
  };
}
function inferCurrency(symbol: string) {
  return /^\d{6}$/.test(symbol) ? "KRW" : "USD";
}

function inferMarketCountry(symbol: string, currency?: string) {
  if (/^\d{6}$/.test(symbol) || currency === "KRW") return "KR";
  return "US";
}

function inferAssetType(symbol: string, name: string) {
  const text = `${symbol} ${name}`.toUpperCase();
  if (text.includes("ETF") || ["VOO", "SCHD", "QQQ", "SPY", "IVV"].some((ticker) => text.includes(ticker))) {
    return "ETF";
  }
  return "STOCK";
}
