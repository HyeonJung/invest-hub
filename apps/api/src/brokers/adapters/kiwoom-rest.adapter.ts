import { BadRequestException, Injectable } from "@nestjs/common";
import { Broker, ConnectionStatus, Prisma } from "@prisma/client";
import {
  decryptCredentialSecret,
  encryptCredentialSecret,
  previewCredentialSecret
} from "../../common/credential-crypto";
import { PrismaService } from "../../prisma/prisma.service";
import {
  BrokerAccount,
  BrokerAdapter,
  BrokerCashBalance,
  BrokerConnectResult,
  BrokerHolding,
  BrokerPortfolioValue,
  BrokerQuote,
  BrokerSyncResult
} from "./broker-adapter";

const KIWOOM_BASE_URL = process.env.KIWOOM_API_BASE_URL ?? "https://api.kiwoom.com";
const KIWOOM_MOCK_BASE_URL = process.env.KIWOOM_MOCK_API_BASE_URL ?? "https://mockapi.kiwoom.com";
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

type KiwoomToken = {
  token: string;
  tokenType: string;
  expiresAt: Date;
  baseUrl: string;
  appKey: string;
  useMock: boolean;
  connectionId: string | null;
  label: string | null;
};

type KiwoomRuntime = {
  accessToken: string;
  baseUrl: string;
  appKey: string;
  connectionId: string | null;
  token: KiwoomToken;
};

type KiwoomAppCredential = {
  appKey: string;
  secretKey: string;
  useMock: boolean;
  baseUrl: string;
  source: "DB" | "ENV";
  connectionId: string | null;
  label: string | null;
};

@Injectable()
export class KiwoomRestAdapter implements BrokerAdapter {
  readonly broker = Broker.KIWOOM;

  constructor(private readonly prisma: PrismaService) {}

  async connect(
    userId: string,
    options: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string } = {}
  ): Promise<BrokerConnectResult> {
    const token = await this.issueToken(userId, options.credentialId);
    await this.saveConnectionToken(userId, token, "ACTIVE", token.connectionId ?? undefined);

    const accounts = await this.getAccountsWithToken(token.token, token.baseUrl);
    if (accounts.length === 0) {
      throw new BadRequestException("?ㅼ? REST API?먯꽌 議고쉶 媛?ν븳 怨꾩쥖媛 ?놁뒿?덈떎.");
    }

    const requestedAccountNos = new Set(
      [options.accountNo, ...(options.accountNos ?? [])]
        .map((accountNo) => accountNo?.trim())
        .filter((accountNo): accountNo is string => Boolean(accountNo))
    );
    const selectedAccounts = options.connectAll
      ? accounts
      : requestedAccountNos.size > 0
        ? accounts.filter((account) => account.brokerAccountNo && requestedAccountNos.has(account.brokerAccountNo))
        : accounts.length === 1
          ? accounts
          : [];

    if (requestedAccountNos.size > 0 && selectedAccounts.length !== requestedAccountNos.size) {
      throw new BadRequestException("선택한 키움 계좌를 API 응답에서 찾을 수 없습니다.");
    }

    const registeredAccountNos: string[] = [];
    for (const selected of selectedAccounts) {
      const account = await this.upsertInvestmentAccount(userId, selected);
      await this.saveAccountToken(userId, account.id, token);
      if (selected.brokerAccountNo) {
        registeredAccountNos.push(selected.brokerAccountNo);
      }
    }
    let saved = 0;
    const syncErrors: string[] = [];
    for (const accountNo of registeredAccountNos) {
      try {
        const result = await this.syncAll(userId, { accountNo, credentialId: token.connectionId ?? undefined });
        saved += result.saved;
      } catch (error) {
        syncErrors.push(`${maskAccountNo(accountNo)}: ${(error as Error).message}`);
      }
    }

    return {
      broker: this.broker,
      connected: registeredAccountNos.length > 0,
      accounts,
      selectedAccountNo: registeredAccountNos[0] ?? null,
      registeredAccountNos,
      saved,
      syncErrors,
      credentialId: token.connectionId ?? undefined,
      message:
        registeredAccountNos.length > 0 && syncErrors.length > 0
          ? `키움 계좌 ${registeredAccountNos.map(maskAccountNo).join(", ")} 등록은 완료됐지만 보유종목 동기화에 실패했습니다.`
          : registeredAccountNos.length > 0
          ? `키움 계좌 ${registeredAccountNos.map(maskAccountNo).join(", ")} 등록과 보유종목 ${saved}개 동기화가 완료되었습니다.`
          : "키움 계좌를 조회했습니다. 등록할 계좌를 선택하세요."
    };
  }

  async refreshToken(userId: string): Promise<string> {
    const token = await this.issueToken(userId);
    await this.saveConnectionToken(userId, token, "ACTIVE", token.connectionId ?? undefined);

    const accounts = await this.prisma.investmentAccount.findMany({
      where: { userId, broker: "KIWOOM" }
    });
    await Promise.all(accounts.map((account) => this.saveAccountToken(userId, account.id, token)));

    return token.token;
  }

  async getAccounts(userId: string): Promise<BrokerAccount[]> {
    const runtime = await this.ensureAccessToken(userId);
    return this.getAccountsWithToken(runtime.accessToken, runtime.baseUrl);
  }

  async getHoldings(userId: string, options: { accountNo?: string } = {}): Promise<BrokerHolding[]> {
    const runtime = await this.ensureAccessToken(userId);
    const portfolio = await this.getPortfolioResponse(runtime.accessToken, runtime.baseUrl);
    return normalizeKiwoomHoldings(portfolio);
  }

  async getCashBalance(userId: string): Promise<BrokerCashBalance> {
    const runtime = await this.ensureAccessToken(userId);
    const json = await this.callKiwoomApi(runtime.accessToken, runtime.baseUrl, "kt00001", "/api/dostk/acnt", { qry_tp: "2" });
    const currencyRows = Array.isArray(json.stk_entr_prst) ? json.stk_entr_prst : [];

    return {
      cashKrw: readSignedNumber(json.entr),
      orderableCashKrw: readSignedNumber(json.ord_alow_amt),
      currencyBalances: currencyRows.map((row: any) => ({
        currency: String(row.crnc_cd ?? "KRW"),
        cash: readSignedNumber(row.fx_entr),
        orderableCash: readSignedNumber(row.ord_alow_amt_entr)
      }))
    };
  }

  async getPortfolioValue(userId: string): Promise<BrokerPortfolioValue> {
    const runtime = await this.ensureAccessToken(userId);
    const portfolio = await this.getPortfolioResponse(runtime.accessToken, runtime.baseUrl);
    return normalizePortfolioValue(portfolio);
  }

  async getQuotes(userId: string, symbols: string[]): Promise<Map<string, BrokerQuote>> {
    const domesticSymbols = Array.from(
      new Set(symbols.map(normalizeKiwoomSymbol).filter((symbol) => /^\d{6}$/.test(symbol)))
    );
    const quotes = new Map<string, BrokerQuote>();
    if (domesticSymbols.length === 0) return quotes;

    const runtime = await this.ensureAccessToken(userId);
    for (const symbol of domesticSymbols) {
      const json = await this.callKiwoomApi(runtime.accessToken, runtime.baseUrl, "ka10001", "/api/dostk/stkinfo", { stk_cd: symbol });
      const price = Math.abs(readSignedNumber(json.cur_prc));
      if (!Number.isFinite(price) || price <= 0) continue;

      quotes.set(`${symbol}:KR`, {
        symbol,
        marketCountry: "KR",
        currency: "KRW",
        price,
        priceKrw: price,
        changeRate: readSignedNumber(json.flu_rt),
        source: "KIWOOM_REST_API",
        fetchedAt: new Date()
      });
    }

    return quotes;
  }

  async getMarketData(userId: string, symbols: string[]): Promise<Map<string, BrokerQuote>> {
    return this.getQuotes(userId, symbols);
  }

  async syncAll(userId: string, options: { accountNo?: string; credentialId?: string } = {}): Promise<BrokerSyncResult> {
    const credentialId = options.credentialId ?? (await this.credentialIdForAccount(userId, options.accountNo));
    const runtime = await this.ensureAccessToken(userId, credentialId ?? undefined);
    const accounts = await this.getAccountsWithToken(runtime.accessToken, runtime.baseUrl);
    if (accounts.length === 0) {
      throw new BadRequestException("?ㅼ? 怨꾩쥖瑜?癒쇱? ?곌껐?섏꽭??");
    }

    const registeredAccounts = await this.prisma.investmentAccount.findMany({
      where: { userId, broker: "KIWOOM", apiCredential: { isNot: null } },
      include: { apiCredential: true },
      orderBy: { createdAt: "asc" }
    });
    const defaultAccountNo = options.accountNo ?? registeredAccounts.find((account) => {
      const metadata = readMetadata(account.apiCredential?.metadata);
      return !credentialId || metadata.connectionId === credentialId;
    })?.brokerAccountNo ?? registeredAccounts[0]?.brokerAccountNo ?? undefined;
    const selectedAccount = selectAccount(accounts, defaultAccountNo);
    const account = await this.upsertInvestmentAccount(userId, selectedAccount);
    const [cashBalance, portfolioResponse] = await Promise.all([
      this.getCashBalance(userId),
      this.getPortfolioResponse(runtime.accessToken, runtime.baseUrl)
    ]);
    const portfolioValue = normalizePortfolioValue(portfolioResponse);
    const holdings = normalizeKiwoomHoldings(portfolioResponse);

    await this.prisma.investmentAccount.update({
      where: { id: account.id },
      data: {
        snapshotMarketValue: portfolioValue.totalMarketValue,
        snapshotProfitLoss: portfolioValue.totalProfitLoss,
        snapshotReturnRate: portfolioValue.totalReturnRate,
        snapshotSource: "KIWOOM_REST_API",
        snapshotSyncedAt: new Date()
      }
    });
    await this.prisma.holding.deleteMany({ where: { accountId: account.id } });

    for (const holding of holdings) {
      const security = await this.prisma.security.upsert({
        where: {
          symbol_marketCountry: {
            symbol: holding.symbol,
            marketCountry: holding.marketCountry
          }
        },
        create: {
          symbol: holding.symbol,
          name: holding.name,
          marketCountry: holding.marketCountry,
          currency: holding.currency,
          assetType: holding.assetType,
          riskType: null
        },
        update: {
          name: holding.name,
          currency: holding.currency,
          assetType: holding.assetType
        }
      });

      await this.prisma.holding.create({
        data: {
          accountId: account.id,
          securityId: security.id,
          quantity: holding.quantity,
          averagePurchasePrice: holding.averagePurchasePrice,
          marketPrice: holding.marketPrice,
          marketValue: holding.marketValue,
          costAmount: holding.costAmount,
          profitLoss: holding.profitLoss,
          profitLossRate: holding.profitLossRate,
          annualDividendEstimate: holding.annualDividendEstimate,
          sourceType: "API"
        }
      });
    }

    await this.saveAccountToken(userId, account.id, await this.currentTokenForStorage(userId, runtime.connectionId ?? undefined));
    await this.touchConnection(userId, "ACTIVE", runtime.connectionId ?? undefined);

    return {
      broker: this.broker,
      accounts: 1,
      saved: holdings.length,
      cashBalance,
      portfolioValue,
      syncedAt: new Date().toISOString()
    };
  }

  async getConnectionStatus(userId: string) {
    const connections = await this.prisma.brokerConnection.findMany({
      where: { userId, broker: "KIWOOM" },
      include: { credential: true },
      orderBy: { createdAt: "asc" }
    });
    const connection = [...connections].reverse().find((row) => {
      const metadata = readMetadata(row.credential?.metadata);
      return row.credential?.clientId && row.credential.encryptedSecret && metadata.credentialType === "kiwoom-app";
    });
    const accounts = await this.prisma.investmentAccount.findMany({
      where: { userId, broker: "KIWOOM", apiCredential: { isNot: null } },
      include: { apiCredential: true },
      orderBy: { createdAt: "asc" }
    });

    const metadata = readMetadata(connection?.credential?.metadata);
    const hasStoredCredential =
      Boolean(connection?.credential?.clientId) &&
      Boolean(connection?.credential?.encryptedSecret) &&
      metadata.credentialType === "kiwoom-app";
    const envAppKey = process.env.KIWOOM_APP_KEY?.trim();
    const envSecretKey = process.env.KIWOOM_SECRET_KEY?.trim();
    const hasApiConnection = connection?.connectionType === "API" && accounts.length > 0;
    return {
      connected: connection?.status === "ACTIVE" && hasApiConnection,
      status: hasApiConnection ? connection?.status ?? "INACTIVE" : "INACTIVE",
      brokerType: connection?.brokerType ?? "KIWOOM",
      connectionType: connection?.connectionType ?? "API",
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      tokenExpiresAt: metadata.expiresAt ?? null,
      baseUrl: metadata.baseUrl ?? this.baseUrl(Boolean(metadata.useMock)),
      hasStoredCredential,
      credentialSource: hasStoredCredential ? "DB" : envAppKey && envSecretKey ? "ENV" : "NONE",
      appKeyPreview: hasStoredCredential
        ? previewCredentialSecret(connection?.credential?.clientId ?? "")
        : envAppKey
          ? previewCredentialSecret(envAppKey)
          : null,
      credentials: connections
        .filter((row) => {
          const rowMetadata = readMetadata(row.credential?.metadata);
          return Boolean(row.credential?.clientId) && Boolean(row.credential?.encryptedSecret) && rowMetadata.credentialType === "kiwoom-app";
        })
        .map((row, index) => {
          const rowMetadata = readMetadata(row.credential?.metadata);
          return {
            connectionId: row.id,
            label: rowMetadata.label ?? `키움 키 ${index + 1}`,
            appKeyPreview: previewCredentialSecret(row.credential?.clientId ?? ""),
            secretPreview: rowMetadata.secretPreview ?? null,
            status: row.status,
            useMock: Boolean(rowMetadata.useMock),
            baseUrl: rowMetadata.baseUrl ?? this.baseUrl(Boolean(rowMetadata.useMock)),
            tokenExpiresAt: rowMetadata.expiresAt ?? null,
            updatedAt: rowMetadata.updatedAt ?? null
          };
        }),
      accounts: accounts.map((account) => ({
        credentialConnectionId: readMetadata(account.apiCredential?.metadata).connectionId ?? null,
        credentialLabel: readMetadata(account.apiCredential?.metadata).label ?? null,
        accountId: account.id,
        accountAlias: account.accountAlias,
        brokerAccountNo: account.brokerAccountNo,
        externalAccountId: account.externalAccountId,
        credential: account.apiCredential
          ? {
              clientId: account.apiCredential.clientId,
              secretPreview: account.apiCredential.secretPreview,
              status: account.apiCredential.status,
              lastValidatedAt: account.apiCredential.lastValidatedAt,
              lastUsedAt: account.apiCredential.lastUsedAt,
              updatedAt: account.apiCredential.updatedAt
            }
          : null
      }))
    };
  }

  private async credentialIdForAccount(userId: string, accountNo?: string) {
    if (!accountNo) return null;
    const account = await this.prisma.investmentAccount.findFirst({
      where: { userId, broker: "KIWOOM", brokerAccountNo: accountNo },
      include: { apiCredential: true }
    });
    const metadata = readMetadata(account?.apiCredential?.metadata);
    return typeof metadata.connectionId === "string" ? metadata.connectionId : null;
  }

  private async resolveAppCredential(userId: string, credentialId?: string): Promise<KiwoomAppCredential> {
    const connection = await this.prisma.brokerConnection.findFirst({
      where: { userId, broker: "KIWOOM", ...(credentialId ? { id: credentialId } : {}) },
      include: { credential: true },
      orderBy: { createdAt: "desc" }
    });
    const metadata = readMetadata(connection?.credential?.metadata);

    if (
      connection?.credential?.clientId &&
      connection.credential.encryptedSecret &&
      metadata.credentialType === "kiwoom-app"
    ) {
      const useMock = Boolean(metadata.useMock);
      return {
        appKey: connection.credential.clientId,
        secretKey: decryptCredentialSecret(connection.credential.encryptedSecret),
        useMock,
        baseUrl: metadata.baseUrl ?? this.baseUrl(useMock),
        source: "DB",
        connectionId: connection.id,
        label: metadata.label ?? null
      };
    }

    if (credentialId) {
      throw new BadRequestException("선택한 키움 API 키를 찾을 수 없습니다.");
    }

    const appKey = process.env.KIWOOM_APP_KEY?.trim();
    const secretKey = process.env.KIWOOM_SECRET_KEY?.trim();
    if (appKey && secretKey) {
      const useMock = process.env.KIWOOM_USE_MOCK_API === "true";
      return {
        appKey,
        secretKey,
        useMock,
        baseUrl: this.baseUrl(useMock),
        source: "ENV",
        connectionId: null,
        label: "환경변수 키"
      };
    }

    throw new BadRequestException("설정에서 키움 App Key와 Secret Key를 먼저 저장하세요.");
  }

  private async issueToken(userId: string, credentialId?: string): Promise<KiwoomToken> {
    const credential = await this.resolveAppCredential(userId, credentialId);
    const response = await fetch(`${credential.baseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: credential.appKey,
        secretkey: credential.secretKey
      })
    });

    const json = (await response.json().catch(() => ({}))) as any;
    if (!response.ok || json.return_code || !json.token) {
      const message = String(json.return_msg ?? json.message ?? response.statusText);
      const returnCode = String(json.return_code ?? "");
      if (returnCode === "8030" || message.includes("투자구분")) {
        throw new BadRequestException(
          `키움 토큰 발급 실패: App Key의 투자구분이 현재 설정과 다릅니다. ${
            credential.useMock
              ? "실전 App Key를 사용 중이면 설정에서 '모의투자 API 사용'을 해제하세요."
              : "모의투자 App Key를 사용 중이면 설정에서 '모의투자 API 사용'을 체크하세요."
          } 원문: ${message}`
        );
      }
      throw new BadRequestException(`키움 토큰 발급 실패: ${message}`);
    }

    return {
      token: String(json.token),
      tokenType: String(json.token_type ?? "Bearer"),
      expiresAt: parseKiwoomExpiresAt(json.expires_dt),
      baseUrl: credential.baseUrl,
      appKey: credential.appKey,
      useMock: credential.useMock,
      connectionId: credential.connectionId,
      label: credential.label
    };
  }

  private async ensureAccessToken(userId: string, credentialId?: string): Promise<KiwoomRuntime> {
    const connection = await this.prisma.brokerConnection.findFirst({
      where: { userId, broker: "KIWOOM", ...(credentialId ? { id: credentialId } : {}) },
      include: { credential: true },
      orderBy: { createdAt: "desc" }
    });
    const metadata = readMetadata(connection?.credential?.metadata);
    const expiresAt = metadata.expiresAt ? new Date(metadata.expiresAt) : null;
    const tokenEncrypted = typeof metadata.tokenEncrypted === "string" ? metadata.tokenEncrypted : null;

    if (
      tokenEncrypted &&
      connection?.credential?.clientId &&
      expiresAt &&
      expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS
    ) {
      const token = {
        token: decryptCredentialSecret(tokenEncrypted),
        tokenType: metadata.tokenType ?? "Bearer",
        expiresAt,
        baseUrl: metadata.baseUrl ?? this.baseUrl(Boolean(metadata.useMock)),
        appKey: connection.credential.clientId,
        useMock: Boolean(metadata.useMock),
        connectionId: connection.id,
        label: metadata.label ?? null
      };
      return {
        accessToken: token.token,
        baseUrl: token.baseUrl,
        appKey: token.appKey,
        connectionId: token.connectionId,
        token
      };
    }

    const token = await this.issueToken(userId, credentialId);
    await this.saveConnectionToken(userId, token, "ACTIVE", token.connectionId ?? undefined);
    return {
      accessToken: token.token,
      baseUrl: token.baseUrl,
      appKey: token.appKey,
      connectionId: token.connectionId,
      token
    };
  }

  private async currentTokenForStorage(userId: string, credentialId?: string): Promise<KiwoomToken> {
    const connection = await this.prisma.brokerConnection.findFirst({
      where: { userId, broker: "KIWOOM", ...(credentialId ? { id: credentialId } : {}) },
      include: { credential: true },
      orderBy: { createdAt: "desc" }
    });
    const metadata = readMetadata(connection?.credential?.metadata);
    const tokenEncrypted = typeof metadata.tokenEncrypted === "string" ? metadata.tokenEncrypted : null;
    if (connection?.credential?.clientId && tokenEncrypted && metadata.expiresAt) {
      return {
        token: decryptCredentialSecret(tokenEncrypted),
        tokenType: metadata.tokenType ?? "Bearer",
        expiresAt: new Date(metadata.expiresAt),
        baseUrl: metadata.baseUrl ?? this.baseUrl(Boolean(metadata.useMock)),
        appKey: connection.credential.clientId,
        useMock: Boolean(metadata.useMock),
        connectionId: connection.id,
        label: metadata.label ?? null
      };
    }
    const token = await this.issueToken(userId, credentialId);
    await this.saveConnectionToken(userId, token, "ACTIVE", token.connectionId ?? undefined);
    return token;
  }

  private async getAccountsWithToken(accessToken: string, baseUrl: string): Promise<BrokerAccount[]> {
    const json = await this.callKiwoomApi(accessToken, baseUrl, "ka00001", "/api/dostk/acnt", {});
    const accountNos = normalizeAccountNumbers(json);
    return accountNos.map((accountNo) => ({
      broker: this.broker,
      externalAccountId: accountNo,
      brokerAccountNo: accountNo,
      accountAlias: `?ㅼ? ${maskAccountNo(accountNo)}`,
      accountType: "BROKERAGE",
      currencyBase: "KRW"
    }));
  }

  private async getPortfolioResponse(accessToken: string, baseUrl: string) {
    return this.callKiwoomApi(accessToken, baseUrl, "kt00018", "/api/dostk/acnt", {
      qry_tp: "1",
      dmst_stex_tp: "KRX"
    });
  }

  private async callKiwoomApi(accessToken: string, baseUrl: string, apiId: string, path: string, body: Record<string, unknown>) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        authorization: `Bearer ${accessToken}`,
        "api-id": apiId
      },
      body: JSON.stringify(body)
    });
    const json = (await response.json().catch(() => ({}))) as any;
    if (!response.ok || (json.return_code && String(json.return_code) !== "0")) {
      throw new BadRequestException(
        `?ㅼ? API ?몄텧 ?ㅽ뙣(${apiId}): ${json.return_msg ?? json.message ?? response.statusText}`
      );
    }
    return json;
  }

  private async upsertInvestmentAccount(userId: string, account: BrokerAccount) {
    const existing = await this.prisma.investmentAccount.findFirst({
      where: {
        userId,
        broker: "KIWOOM",
        brokerAccountNo: account.brokerAccountNo ?? account.externalAccountId
      }
    });

    return this.prisma.investmentAccount.upsert({
      where: { id: existing?.id ?? crypto.randomUUID() },
      create: {
        id: crypto.randomUUID(),
        userId,
        broker: "KIWOOM",
        externalAccountId: account.externalAccountId,
        brokerAccountNo: account.brokerAccountNo ?? account.externalAccountId,
        accountAlias: account.accountAlias,
        accountType: account.accountType,
        currencyBase: account.currencyBase
      },
      update: {
        externalAccountId: account.externalAccountId,
        brokerAccountNo: account.brokerAccountNo ?? account.externalAccountId,
        accountAlias: account.accountAlias,
        currencyBase: account.currencyBase
      }
    });
  }

  private async saveConnectionToken(userId: string, token: KiwoomToken, status: ConnectionStatus, credentialId?: string) {
    const existing = await this.prisma.brokerConnection.findFirst({
      where: { userId, broker: "KIWOOM", ...(credentialId ? { id: credentialId } : {}) },
      include: { credential: true }
    });
    const existingMetadata = readMetadata(existing?.credential?.metadata);
    const appCredential = await this.resolveAppCredential(userId, credentialId);
    const encryptedAppSecret =
      existing?.credential?.encryptedSecret && existingMetadata.credentialType === "kiwoom-app"
        ? existing.credential.encryptedSecret
        : encryptCredentialSecret(appCredential.secretKey);
    const secretPreview = existingMetadata.secretPreview ?? previewCredentialSecret(appCredential.secretKey);
    const connection = await this.prisma.brokerConnection.upsert({
      where: { id: existing?.id ?? crypto.randomUUID() },
      create: {
        id: crypto.randomUUID(),
        userId,
        broker: "KIWOOM",
        brokerType: "KIWOOM",
        connectionType: "API",
        status,
        lastSyncedAt: new Date()
      },
      update: {
        brokerType: "KIWOOM",
        connectionType: "API",
        status,
        lastSyncedAt: new Date()
      }
    });

    await this.prisma.brokerCredential.upsert({
      where: { connectionId: connection.id },
      create: {
        connectionId: connection.id,
        clientId: token.appKey,
        encryptedSecret: encryptedAppSecret,
        metadata: tokenMetadata(token, secretPreview)
      },
      update: {
        clientId: token.appKey,
        encryptedSecret: encryptedAppSecret,
        metadata: tokenMetadata(token, secretPreview)
      }
    });
  }

  private async saveAccountToken(userId: string, accountId: string, token: KiwoomToken) {
    await this.prisma.accountApiCredential.upsert({
      where: { accountId },
      create: {
        userId,
        accountId,
        broker: "KIWOOM",
        clientId: token.appKey,
        encryptedSecret: encryptCredentialSecret(token.token),
        secretPreview: previewCredentialSecret(token.token),
        status: "ACTIVE",
        lastValidatedAt: new Date(),
        lastUsedAt: new Date(),
        metadata: tokenMetadata(token)
      },
      update: {
        clientId: token.appKey,
        encryptedSecret: encryptCredentialSecret(token.token),
        secretPreview: previewCredentialSecret(token.token),
        status: "ACTIVE",
        lastValidatedAt: new Date(),
        lastUsedAt: new Date(),
        metadata: tokenMetadata(token)
      }
    });
  }

  private async touchConnection(userId: string, status: ConnectionStatus, credentialId?: string) {
    const existing = await this.prisma.brokerConnection.findFirst({
      where: { userId, broker: "KIWOOM", ...(credentialId ? { id: credentialId } : {}) }
    });
    if (!existing) return;
    await this.prisma.brokerConnection.update({
      where: { id: existing.id },
      data: {
        brokerType: "KIWOOM",
        connectionType: "API",
        status,
        lastSyncedAt: new Date()
      }
    });
  }

  private baseUrl(useMock = process.env.KIWOOM_USE_MOCK_API === "true") {
    return useMock ? KIWOOM_MOCK_BASE_URL : KIWOOM_BASE_URL;
  }
}

function normalizeAccountNumbers(json: any) {
  const raw = json.acctNo ?? json.acct_no ?? json.acnt_no ?? json.accountNo ?? json.accounts ?? json.acctNoList;
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value.acctNo ?? value.acct_no ?? value).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,\s|]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function selectAccount(accounts: BrokerAccount[], accountNo?: string) {
  if (!accountNo) return accounts[0];
  const account = accounts.find((row) => row.brokerAccountNo === accountNo || row.externalAccountId === accountNo);
  if (!account) {
    throw new BadRequestException("?좏깮???ㅼ? 怨꾩쥖瑜?李얠쓣 ???놁뒿?덈떎.");
  }
  return account;
}

function normalizeKiwoomHoldings(json: any): BrokerHolding[] {
  const rows = Array.isArray(json.acnt_evlt_remn_indv_tot) ? json.acnt_evlt_remn_indv_tot : [];
  return rows
    .map((row: any) => {
      const symbol = normalizeKiwoomSymbol(row.stk_cd);
      const quantity = readSignedNumber(row.rmnd_qty);
      const marketPrice = Math.abs(readSignedNumber(row.cur_prc));
      const marketValue = readSignedNumber(row.evlt_amt) || quantity * marketPrice;
      const costAmount = readSignedNumber(row.pur_amt) || quantity * readSignedNumber(row.pur_pric);
      const profitLoss = readSignedNumber(row.evltv_prft) || marketValue - costAmount;

      return {
        symbol,
        name: String(row.stk_nm ?? symbol),
        marketCountry: "KR",
        currency: "KRW",
        assetType: inferAssetType(symbol, String(row.stk_nm ?? "")),
        quantity,
        averagePurchasePrice: readSignedNumber(row.pur_pric),
        marketPrice,
        marketValue,
        costAmount,
        profitLoss,
        profitLossRate: readSignedNumber(row.prft_rt) || (costAmount > 0 ? (profitLoss / costAmount) * 100 : 0),
        annualDividendEstimate: estimateDividend(inferAssetType(symbol, String(row.stk_nm ?? "")), marketValue),
        sourceType: "API"
      } satisfies BrokerHolding;
    })
    .filter((holding: BrokerHolding) => holding.symbol && holding.quantity > 0);
}

function normalizePortfolioValue(json: any): BrokerPortfolioValue {
  return {
    totalPurchaseAmount: readSignedNumber(json.tot_pur_amt),
    totalMarketValue: readSignedNumber(json.tot_evlt_amt),
    totalProfitLoss: readSignedNumber(json.tot_evlt_pl),
    totalReturnRate: readSignedNumber(json.tot_prft_rt)
  };
}

function normalizeKiwoomSymbol(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^[AJQ]/i, "")
    .replace(/_(NX|AL)$/i, "");
}

function readSignedNumber(value: unknown) {
  if (typeof value === "number") return value;
  const text = String(value ?? "0")
    .replace(/,/g, "")
    .replace(/[^\d.+-]/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferAssetType(symbol: string, name: string) {
  const text = `${symbol} ${name}`.toUpperCase();
  if (text.includes("ETF") || text.includes("ETN") || text.includes("KODEX") || text.includes("TIGER")) return "ETF";
  return "STOCK";
}

function estimateDividend(assetType: string, marketValue: number) {
  return Math.max(0, marketValue * (assetType === "ETF" ? 0.018 : 0.008));
}

function maskAccountNo(accountNo: string) {
  if (accountNo.length <= 4) return accountNo;
  return `${accountNo.slice(0, 2)}****${accountNo.slice(-2)}`;
}

function parseKiwoomExpiresAt(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    const [, yyyy, mm, dd, hh, mi, ss] = match;
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+09:00`);
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function tokenMetadata(token: KiwoomToken, secretPreview?: string | null): Prisma.InputJsonValue {
  return {
    provider: "kiwoom-rest-api",
    credentialType: "kiwoom-app",
    authType: "client_credentials",
    storage: "broker_connection",
    useMock: token.useMock,
    secretPreview: secretPreview ?? null,
    connectionId: token.connectionId,
    label: token.label,
    tokenEncrypted: encryptCredentialSecret(token.token),
    tokenType: token.tokenType,
    expiresAt: token.expiresAt.toISOString(),
    baseUrl: token.baseUrl,
    refreshStrategy: "reissue"
  };
}

function readMetadata(value: Prisma.JsonValue | null | undefined): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}
