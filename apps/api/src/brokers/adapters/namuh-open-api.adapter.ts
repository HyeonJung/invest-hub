import { BadRequestException, Injectable } from "@nestjs/common";
import { Broker, ConnectionStatus, Prisma } from "@prisma/client";
import { decryptCredentialSecret, encryptCredentialSecret, previewCredentialSecret } from "../../common/credential-crypto";
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

const NAMUH_PROVIDER = "namuh-wmca-openapi";
const NAMUH_CREDENTIAL_TYPE = "namuh-wmca-login";

type NamuhSecretBundle = {
  loginPassword?: string;
  certificatePassword?: string;
  accountPassword?: string;
};

type NamuhCredential = {
  connectionId: string;
  label: string;
  loginId: string;
  secret: NamuhSecretBundle;
  environment: "REAL" | "MOCK";
  certificateMode: "PC" | "CLOUD";
  bridgeUrl: string | null;
  status: ConnectionStatus;
};

type NamuhBridgeAccount = {
  accountNo?: string;
  accountName?: string;
  productCode?: string;
  currencyBase?: string;
};

type NamuhBridgeHolding = Record<string, unknown>;

type NamuhBridgePortfolio = {
  accounts?: NamuhBridgeAccount[];
  cashBalance?: Record<string, unknown>;
  portfolioValue?: Record<string, unknown>;
  holdings?: NamuhBridgeHolding[];
  sessionId?: string;
  message?: string;
};

@Injectable()
export class NamuhOpenApiAdapter implements BrokerAdapter {
  readonly broker = Broker.NAMUH;

  constructor(private readonly prisma: PrismaService) {}

  async connect(
    userId: string,
    options: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string } = {}
  ): Promise<BrokerConnectResult> {
    const credential = await this.resolveCredential(userId, options.credentialId);
    const response = await this.callBridge<NamuhBridgePortfolio>(credential, "connect", {
      login: this.buildBridgeLoginPayload(credential)
    });
    const accounts = normalizeNamuhAccounts(response.accounts ?? []);

    if (accounts.length === 0) {
      await this.markConnection(credential.connectionId, "ERROR", "WMCA 로그인은 성공했지만 조회 가능한 계좌가 없습니다.");
      throw new BadRequestException("나무 WMCA에서 조회 가능한 계좌가 없습니다.");
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
      throw new BadRequestException("선택한 나무 계좌를 WMCA 응답에서 찾을 수 없습니다.");
    }

    const registeredAccountNos: string[] = [];
    for (const account of selectedAccounts) {
      const savedAccount = await this.upsertInvestmentAccount(userId, account);
      await this.saveAccountCredential(userId, savedAccount.id, credential);
      if (account.brokerAccountNo) registeredAccountNos.push(account.brokerAccountNo);
    }

    await this.markConnection(credential.connectionId, "ACTIVE", null, response.sessionId);

    return {
      broker: this.broker,
      connected: registeredAccountNos.length > 0,
      accounts,
      selectedAccountNo: registeredAccountNos[0] ?? null,
      registeredAccountNos,
      credentialId: credential.connectionId,
      message:
        registeredAccountNos.length > 0
          ? `나무 계좌 ${registeredAccountNos.map(maskAccountNo).join(", ")} 등록이 완료되었습니다.`
          : "나무 계좌를 조회했습니다. 등록할 계좌를 선택하세요."
    };
  }

  async refreshToken(userId: string, options: { credentialId?: string } = {}) {
    const credential = await this.resolveCredential(userId, options.credentialId);
    const response = await this.callBridge<NamuhBridgePortfolio>(credential, "connect", {
      login: this.buildBridgeLoginPayload(credential)
    });
    await this.markConnection(credential.connectionId, "ACTIVE", null, response.sessionId);
    return response.sessionId ?? "WMCA_SESSION";
  }

  async validateConnection(userId: string, options: { credentialId?: string } = {}) {
    const credential = await this.resolveCredential(userId, options.credentialId);
    await this.callBridge<NamuhBridgePortfolio>(credential, "status", {
      connectionId: credential.connectionId
    });
    await this.markConnection(credential.connectionId, "ACTIVE", null);
    return true;
  }

  async getAccounts(userId: string, options: { credentialId?: string } = {}) {
    const credential = await this.resolveCredential(userId, options.credentialId);
    const response = await this.callBridge<NamuhBridgePortfolio>(credential, "accounts", {
      login: this.buildBridgeLoginPayload(credential)
    });
    return normalizeNamuhAccounts(response.accounts ?? []);
  }

  async getHoldings(userId: string, options: { accountNo?: string; credentialId?: string } = {}) {
    const credential = await this.resolveCredential(userId, options.credentialId);
    const accountNo = options.accountNo ?? (await this.defaultAccountNo(userId, credential.connectionId));
    if (!accountNo) throw new BadRequestException("나무 계좌를 먼저 등록하세요.");

    const response = await this.callBridge<NamuhBridgePortfolio>(credential, "holdings", {
      accountNo,
      trCode: "c8201",
      balanceType: "1",
      assetBasis: "1",
      quoteMarketCode: "UNT",
      login: this.buildBridgeLoginPayload(credential)
    });
    return normalizeNamuhHoldings(response.holdings ?? []);
  }

  async getCashBalance(userId: string, options: { accountNo?: string; credentialId?: string } = {}) {
    const credential = await this.resolveCredential(userId, options.credentialId);
    const accountNo = options.accountNo ?? (await this.defaultAccountNo(userId, credential.connectionId));
    if (!accountNo) return { cashKrw: 0, orderableCashKrw: 0, currencyBalances: [] };

    const response = await this.callBridge<NamuhBridgePortfolio>(credential, "holdings", {
      accountNo,
      trCode: "c8201",
      login: this.buildBridgeLoginPayload(credential)
    });
    const cash = response.cashBalance ?? {};
    const cashKrw = pickNumber(cash, ["cashKrw", "예수금", "cash", "d2Deposit", "D2예수금"]);
    const orderableCashKrw = pickNumber(cash, ["orderableCashKrw", "주문가능액", "orderableCash", "출금가능금액"]);
    return {
      cashKrw,
      orderableCashKrw,
      currencyBalances: [{ currency: "KRW", cash: cashKrw, orderableCash: orderableCashKrw }]
    };
  }

  async getPortfolioValue(userId: string, options: { accountNo?: string; credentialId?: string } = {}) {
    const holdings = await this.getHoldings(userId, options);
    return portfolioValueFromHoldings(holdings);
  }

  async getQuotes(userId: string, symbols: string[]) {
    const domesticSymbols = Array.from(new Set(symbols.map((symbol) => symbol.trim()).filter((symbol) => /^\d{6}$/.test(symbol))));
    const quotes = new Map<string, BrokerQuote>();
    if (domesticSymbols.length === 0) return quotes;

    const credential = await this.resolveCredential(userId);
    const response = await this.callBridge<{ quotes?: Array<Record<string, unknown>> }>(credential, "quotes", {
      trCode: "IVWUTKMST04",
      realtimeCode: "mc",
      symbols: domesticSymbols,
      login: this.buildBridgeLoginPayload(credential)
    });

    for (const row of response.quotes ?? []) {
      const symbol = pickString(row, ["symbol", "종목코드", "단축종목코드"]).replace(/^A/, "");
      if (!/^\d{6}$/.test(symbol)) continue;
      const price = Math.abs(pickNumber(row, ["price", "현재가", "curPrice", "last"]));
      if (!Number.isFinite(price) || price <= 0) continue;
      quotes.set(`${symbol}:KR`, {
        symbol,
        marketCountry: "KR",
        currency: "KRW",
        price,
        priceKrw: price,
        change: pickOptionalNumber(row, ["change", "등락폭"]) ?? undefined,
        changeRate: pickOptionalNumber(row, ["changeRate", "등락률"]) ?? undefined,
        source: "NAMUH_WMCA",
        fetchedAt: new Date()
      });
    }

    return quotes;
  }

  async getDomesticQuotes(userId: string, symbols: string[]) {
    return this.getQuotes(userId, symbols);
  }

  async getOverseasQuotes(): Promise<Map<string, BrokerQuote>> {
    throw new BadRequestException("제공된 나무 WMCA 문서에는 해외주식 현재가 TR이 없습니다. 해외주식은 CSV/XLSX 또는 별도 해외 API 문서가 필요합니다.");
  }

  async getMarketData(userId: string, symbols: string[]) {
    return this.getQuotes(userId, symbols);
  }

  async syncAccounts(userId: string, options: { credentialId?: string } = {}) {
    return this.connect(userId, { credentialId: options.credentialId });
  }

  async syncHoldings(userId: string, options: { accountNo?: string; credentialId?: string } = {}) {
    return this.syncAll(userId, options);
  }

  async syncPrices(userId: string) {
    const holdings = await this.prisma.holding.findMany({
      where: { account: { userId, broker: "NAMUH" } },
      include: { security: true }
    });
    return this.getQuotes(userId, holdings.map((holding) => holding.security.symbol));
  }

  async syncAll(userId: string, options: { accountNo?: string; credentialId?: string } = {}): Promise<BrokerSyncResult> {
    const credential = await this.resolveCredential(userId, options.credentialId);
    const registeredAccounts = await this.prisma.investmentAccount.findMany({
      where: {
        userId,
        broker: "NAMUH",
        ...(options.accountNo ? { brokerAccountNo: options.accountNo } : {}),
        apiCredential: { isNot: null }
      },
      include: { apiCredential: true },
      orderBy: { createdAt: "asc" }
    });
    const accountsForCredential = registeredAccounts.filter((account) => {
      const metadata = readMetadata(account.apiCredential?.metadata);
      return !options.credentialId || metadata.connectionId === credential.connectionId;
    });

    if (accountsForCredential.length === 0) {
      throw new BadRequestException("나무 계좌를 먼저 조회하고 등록하세요.");
    }

    let saved = 0;
    let lastCashBalance: BrokerCashBalance | undefined;
    let lastPortfolioValue: BrokerPortfolioValue | undefined;
    const syncedAt = new Date();

    for (const account of accountsForCredential) {
      const accountNo = account.brokerAccountNo ?? account.externalAccountId;
      if (!accountNo) continue;
      const response = await this.callBridge<NamuhBridgePortfolio>(credential, "holdings", {
        accountNo,
        trCode: "c8201",
        balanceType: "1",
        assetBasis: "1",
        quoteMarketCode: "UNT",
        login: this.buildBridgeLoginPayload(credential)
      });
      const holdings = normalizeNamuhHoldings(response.holdings ?? []);
      const cashBalance = normalizeNamuhCashBalance(response.cashBalance ?? {});
      const portfolioValue = normalizeNamuhPortfolioValue(response.portfolioValue ?? {}, holdings);
      lastCashBalance = cashBalance;
      lastPortfolioValue = portfolioValue;

      await this.prisma.investmentAccount.update({
        where: { id: account.id },
        data: {
          snapshotMarketValue: new Prisma.Decimal(portfolioValue.totalMarketValue),
          snapshotProfitLoss: new Prisma.Decimal(portfolioValue.totalProfitLoss),
          snapshotReturnRate: new Prisma.Decimal(portfolioValue.totalReturnRate),
          snapshotSource: "NAMUH_WMCA",
          snapshotSyncedAt: syncedAt
        }
      });
      await this.prisma.holding.deleteMany({ where: { accountId: account.id, sourceType: "API" } });

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
            quantity: new Prisma.Decimal(holding.quantity),
            averagePurchasePrice: new Prisma.Decimal(holding.averagePurchasePrice),
            marketPrice: new Prisma.Decimal(holding.marketPrice),
            marketValue: new Prisma.Decimal(holding.marketValue),
            costAmount: new Prisma.Decimal(holding.costAmount),
            profitLoss: new Prisma.Decimal(holding.profitLoss),
            profitLossRate: new Prisma.Decimal(holding.profitLossRate),
            annualDividendEstimate: new Prisma.Decimal(holding.annualDividendEstimate),
            sourceType: "API",
            snapshotDate: syncedAt
          }
        });
        saved += 1;
      }
    }

    await this.markConnection(credential.connectionId, "ACTIVE", null);

    return {
      broker: this.broker,
      accounts: accountsForCredential.length,
      saved,
      cashBalance: lastCashBalance,
      portfolioValue: lastPortfolioValue,
      syncedAt: syncedAt.toISOString()
    };
  }

  async getConnectionStatus(userId: string) {
    const credentials = await this.listCredentialProfiles(userId);
    const accounts = await this.prisma.investmentAccount.findMany({
      where: { userId, broker: "NAMUH" },
      include: { apiCredential: true },
      orderBy: { createdAt: "asc" }
    });
    const latestConnection = await this.prisma.brokerConnection.findFirst({
      where: { userId, broker: "NAMUH" },
      orderBy: { lastSyncedAt: "desc" }
    });

    return {
      connected: accounts.some((account) => account.apiCredential?.status === "ACTIVE"),
      status: latestConnection?.status ?? "INACTIVE",
      brokerType: "NAMUH_WMCA",
      connectionType: "API",
      lastSyncedAt: latestConnection?.lastSyncedAt?.toISOString() ?? null,
      bridgeUrl: bridgeUrl(),
      hasBridge: Boolean(bridgeUrl()),
      documentProfile: namuhDocumentProfile(),
      credentials,
      accounts: accounts.map((account) => {
        const metadata = readMetadata(account.apiCredential?.metadata);
        return {
          credentialConnectionId: metadata.connectionId ?? null,
          credentialLabel: metadata.label ?? null,
          accountId: account.id,
          accountAlias: account.accountAlias,
          brokerAccountNo: account.brokerAccountNo,
          externalAccountId: account.externalAccountId,
          credential: account.apiCredential
            ? {
                clientId: account.apiCredential.clientId,
                secretPreview: account.apiCredential.secretPreview,
                status: account.apiCredential.status,
                lastValidatedAt: account.apiCredential.lastValidatedAt?.toISOString() ?? null,
                lastUsedAt: account.apiCredential.lastUsedAt?.toISOString() ?? null,
                updatedAt: account.apiCredential.updatedAt.toISOString()
              }
            : null
        };
      })
    };
  }

  async listCredentialProfiles(userId: string) {
    const [connections, accounts] = await Promise.all([
      this.prisma.brokerConnection.findMany({
        where: { userId, broker: "NAMUH" },
        include: { credential: true },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.investmentAccount.findMany({
        where: { userId, broker: "NAMUH", apiCredential: { isNot: null } },
        include: { apiCredential: true },
        orderBy: { createdAt: "asc" }
      })
    ]);

    return connections
      .filter((connection) => {
        const metadata = readMetadata(connection.credential?.metadata);
        return metadata.provider === NAMUH_PROVIDER && metadata.credentialType === NAMUH_CREDENTIAL_TYPE;
      })
      .map((connection, index) => {
        const metadata = readMetadata(connection.credential?.metadata);
        const profileAccounts = accounts.filter(
          (account) => readMetadata(account.apiCredential?.metadata).connectionId === connection.id
        );
        return {
          connectionId: connection.id,
          label: String(metadata.label ?? `나무 계정 ${index + 1}`),
          loginId: connection.credential?.clientId ?? null,
          loginIdPreview: previewCredentialSecret(connection.credential?.clientId ?? ""),
          passwordPreview: metadata.passwordPreview ?? null,
          certificatePasswordPreview: metadata.certificatePasswordPreview ?? null,
          accountPasswordPreview: metadata.accountPasswordPreview ?? null,
          status: connection.status,
          environment: metadata.environment ?? "REAL",
          certificateMode: metadata.certificateMode ?? "PC",
          bridgeUrl: bridgeUrl(),
          source: "DB",
          updatedAt: metadata.updatedAt ?? null,
          accounts: profileAccounts.map((account) => ({
            accountId: account.id,
            accountAlias: account.accountAlias,
            brokerAccountNo: account.brokerAccountNo,
            externalAccountId: account.externalAccountId,
            credentialStatus: account.apiCredential?.status ?? "INACTIVE",
            lastUsedAt: account.apiCredential?.lastUsedAt?.toISOString() ?? null,
            updatedAt: account.apiCredential?.updatedAt.toISOString() ?? null
          }))
        };
      });
  }

  private async resolveCredential(userId: string, connectionId?: string): Promise<NamuhCredential> {
    const connection = connectionId
      ? await this.prisma.brokerConnection.findFirst({
          where: { id: connectionId, userId, broker: "NAMUH" },
          include: { credential: true }
        })
      : await this.prisma.brokerConnection.findFirst({
          where: {
            userId,
            broker: "NAMUH",
            credential: { isNot: null }
          },
          include: { credential: true },
          orderBy: { createdAt: "asc" }
        });

    if (!connection?.credential?.clientId || !connection.credential.encryptedSecret) {
      throw new BadRequestException("설정에서 나무 WMCA 로그인 정보를 먼저 저장하세요.");
    }

    const metadata = readMetadata(connection.credential.metadata);
    if (metadata.provider !== NAMUH_PROVIDER) {
      throw new BadRequestException("나무 WMCA 형식의 연결 정보가 아닙니다.");
    }

    let secret: NamuhSecretBundle;
    try {
      secret = JSON.parse(decryptCredentialSecret(connection.credential.encryptedSecret)) as NamuhSecretBundle;
    } catch {
      throw new BadRequestException("나무 WMCA 암호화 정보 복호화에 실패했습니다.");
    }

    return {
      connectionId: connection.id,
      label: String(metadata.label ?? "나무 계정"),
      loginId: connection.credential.clientId,
      secret,
      environment: metadata.environment === "MOCK" ? "MOCK" : "REAL",
      certificateMode: metadata.certificateMode === "CLOUD" ? "CLOUD" : "PC",
      bridgeUrl: bridgeUrl(),
      status: connection.status
    };
  }

  private async defaultAccountNo(userId: string, connectionId: string) {
    const account = await this.prisma.investmentAccount.findFirst({
      where: {
        userId,
        broker: "NAMUH",
        apiCredential: {
          is: {
            metadata: {
              path: ["connectionId"],
              equals: connectionId
            }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });
    return account?.brokerAccountNo ?? account?.externalAccountId ?? null;
  }

  private async callBridge<T>(credential: NamuhCredential, action: string, payload: Record<string, unknown>): Promise<T> {
    if (!credential.bridgeUrl) {
      await this.markConnection(
        credential.connectionId,
        "ERROR",
        "NAMUH_WMCA_BRIDGE_URL이 설정되지 않았습니다. WMCA는 32비트 Windows 브리지가 필요합니다."
      );
      throw new BadRequestException(
        "나무 WMCA 브리지 URL이 없습니다. 제공 문서는 32비트 wmca.dll 기반이라 Nest 서버에서 직접 호출할 수 없고, NAMUH_WMCA_BRIDGE_URL 설정이 필요합니다. CSV/XLSX 업로드는 계속 사용할 수 있습니다."
      );
    }

    const url = new URL(action.replace(/^\/+/, ""), credential.bridgeUrl.endsWith("/") ? credential.bridgeUrl : `${credential.bridgeUrl}/`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: credential.connectionId,
        environment: credential.environment,
        documentProfile: namuhDocumentProfile(),
        ...payload
      })
    });
    const json = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };

    if (!response.ok) {
      const message = json.message ?? json.error ?? `나무 WMCA 브리지 호출 실패: ${response.status}`;
      await this.markConnection(credential.connectionId, "ERROR", message);
      throw new BadRequestException(message);
    }

    return json;
  }

  private buildBridgeLoginPayload(credential: NamuhCredential) {
    return {
      loginId: credential.loginId,
      loginPassword: credential.secret.loginPassword,
      certificatePassword: credential.secret.certificatePassword,
      accountPassword: credential.secret.accountPassword,
      certificateMode: credential.certificateMode,
      mediaType: "T",
      userType: "W"
    };
  }

  private async upsertInvestmentAccount(userId: string, account: BrokerAccount) {
    const existing = await this.prisma.investmentAccount.findFirst({
      where: {
        userId,
        broker: "NAMUH",
        OR: [
          { brokerAccountNo: account.brokerAccountNo ?? undefined },
          { externalAccountId: account.externalAccountId }
        ]
      }
    });

    if (existing) {
      return this.prisma.investmentAccount.update({
        where: { id: existing.id },
        data: {
          externalAccountId: account.externalAccountId,
          brokerAccountNo: account.brokerAccountNo,
          accountAlias: account.accountAlias,
          accountType: account.accountType,
          currencyBase: account.currencyBase
        }
      });
    }

    return this.prisma.investmentAccount.create({
      data: {
        userId,
        broker: "NAMUH",
        externalAccountId: account.externalAccountId,
        brokerAccountNo: account.brokerAccountNo,
        accountAlias: account.accountAlias,
        accountType: account.accountType,
        currencyBase: account.currencyBase
      }
    });
  }

  private async saveAccountCredential(userId: string, accountId: string, credential: NamuhCredential) {
    await this.prisma.accountApiCredential.upsert({
      where: { accountId },
      create: {
        userId,
        accountId,
        broker: "NAMUH",
        clientId: credential.loginId,
        encryptedSecret: encryptCredentialSecret(JSON.stringify({ connectionId: credential.connectionId })),
        secretPreview: previewCredentialSecret(credential.loginId),
        status: "ACTIVE",
        lastValidatedAt: new Date(),
        metadata: {
          provider: NAMUH_PROVIDER,
          connectionId: credential.connectionId,
          label: credential.label,
          environment: credential.environment
        }
      },
      update: {
        clientId: credential.loginId,
        encryptedSecret: encryptCredentialSecret(JSON.stringify({ connectionId: credential.connectionId })),
        secretPreview: previewCredentialSecret(credential.loginId),
        status: "ACTIVE",
        lastValidatedAt: new Date(),
        metadata: {
          provider: NAMUH_PROVIDER,
          connectionId: credential.connectionId,
          label: credential.label,
          environment: credential.environment
        }
      }
    });
  }

  private async markConnection(connectionId: string, status: ConnectionStatus, errorMessage: string | null, sessionId?: string) {
    const connection = await this.prisma.brokerConnection.findUnique({
      where: { id: connectionId },
      include: { credential: true }
    });
    const metadata = readMetadata(connection?.credential?.metadata);

    await this.prisma.brokerConnection.update({
      where: { id: connectionId },
      data: {
        status,
        lastSyncedAt: status === "ACTIVE" ? new Date() : connection?.lastSyncedAt
      }
    });

    if (connection?.credential) {
      await this.prisma.brokerCredential.update({
        where: { connectionId },
        data: {
          metadata: {
            ...metadata,
            errorMessage,
            sessionId: sessionId ?? metadata.sessionId ?? null,
            updatedAt: new Date().toISOString()
          }
        }
      });
    }
  }
}

export function normalizeNamuhAccounts(rows: NamuhBridgeAccount[]): BrokerAccount[] {
  return rows
    .map((row, index) => {
      const accountNo = String(row.accountNo ?? "").trim();
      const accountName = String(row.accountName ?? "").trim();
      return {
        broker: Broker.NAMUH,
        externalAccountId: accountNo || `NAMUH-${index + 1}`,
        brokerAccountNo: accountNo || null,
        accountAlias: accountName || `나무증권 ${index + 1}`,
        accountType: "BROKERAGE" as const,
        currencyBase: row.currencyBase ?? "KRW"
      };
    })
    .filter((account) => Boolean(account.externalAccountId));
}

export function normalizeNamuhHoldings(rows: NamuhBridgeHolding[]): BrokerHolding[] {
  return rows
    .map((row) => {
      const symbol = pickString(row, ["symbol", "종목번호", "종목코드", "shortCode"]).replace(/^A/, "").trim();
      const quantity = pickNumber(row, ["quantity", "잔고수량", "보유수량", "qty"]);
      const averagePurchasePrice = pickNumber(row, ["averagePurchasePrice", "평균매입가", "avgPrice"]);
      const marketPrice = pickNumber(row, ["marketPrice", "현재가", "curPrice"]);
      const marketValue = pickNumber(row, ["marketValue", "평가금액", "evalAmount"], quantity * marketPrice);
      const costAmount = pickNumber(row, ["costAmount", "매입금액", "매입원가", "purchaseAmount"], quantity * averagePurchasePrice);
      const profitLoss = pickNumber(row, ["profitLoss", "손익", "평가손익", "profit"], marketValue - costAmount);
      const profitLossRate = pickNumber(row, ["profitLossRate", "손익율", "수익률", "returnRate"], costAmount > 0 ? (profitLoss / costAmount) * 100 : 0);

      return {
        symbol,
        name: pickString(row, ["name", "종목명"], symbol),
        marketCountry: "KR",
        currency: "KRW",
        assetType: inferAssetType(symbol, pickString(row, ["name", "종목명"], symbol)),
        quantity,
        averagePurchasePrice,
        marketPrice,
        marketValue,
        costAmount,
        profitLoss,
        profitLossRate,
        annualDividendEstimate: 0,
        sourceType: "API" as const
      };
    })
    .filter((holding) => /^\d{6}$/.test(holding.symbol) && holding.quantity > 0);
}

export function namuhDocumentProfile() {
  return {
    sdk: "WMCA 32bit regular DLL",
    auth: "wmcaConnect 또는 wmcaConnectCert",
    accountListEvent: "CA_CONNECTED",
    balanceTrCode: "c8201",
    domesticQuoteTrCode: "IVWUTKMST04",
    realtimeTradeCode: "mc",
    mockTrading: "문서상 모의투자 서비스 2023-05-31 중단",
    transport: "wmca.nhsec.com:8200"
  };
}

function normalizeNamuhCashBalance(row: Record<string, unknown>): BrokerCashBalance {
  const cashKrw = pickNumber(row, ["cashKrw", "예수금", "cash", "D2예수금"]);
  const orderableCashKrw = pickNumber(row, ["orderableCashKrw", "주문가능액", "출금가능금액"]);
  return {
    cashKrw,
    orderableCashKrw,
    currencyBalances: [{ currency: "KRW", cash: cashKrw, orderableCash: orderableCashKrw }]
  };
}

function normalizeNamuhPortfolioValue(row: Record<string, unknown>, holdings: BrokerHolding[]): BrokerPortfolioValue {
  const fallback = portfolioValueFromHoldings(holdings);
  const totalMarketValue = pickNumber(row, ["totalMarketValue", "평가금액", "평가금액(계좌합산)"], fallback.totalMarketValue);
  const totalPurchaseAmount = pickNumber(row, ["totalPurchaseAmount", "매입원가", "매입원가(계좌합산)"], fallback.totalPurchaseAmount);
  const totalProfitLoss = pickNumber(row, ["totalProfitLoss", "총평가손익"], fallback.totalProfitLoss);
  const totalReturnRate = pickNumber(row, ["totalReturnRate", "수익율", "수익률"], fallback.totalReturnRate);
  return { totalPurchaseAmount, totalMarketValue, totalProfitLoss, totalReturnRate };
}

function portfolioValueFromHoldings(holdings: BrokerHolding[]): BrokerPortfolioValue {
  const totalMarketValue = sum(holdings.map((holding) => holding.marketValue));
  const totalPurchaseAmount = sum(holdings.map((holding) => holding.costAmount));
  const totalProfitLoss = totalMarketValue - totalPurchaseAmount;
  return {
    totalPurchaseAmount,
    totalMarketValue,
    totalProfitLoss,
    totalReturnRate: totalPurchaseAmount > 0 ? (totalProfitLoss / totalPurchaseAmount) * 100 : 0
  };
}

function pickString(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return fallback;
}

function pickNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  const value = pickOptionalNumber(row, keys);
  return value ?? fallback;
}

function pickOptionalNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = row[key];
    if (raw == null) continue;
    const normalized = typeof raw === "number" ? raw : Number(String(raw).replace(/[,+%원$]/g, "").trim());
    if (Number.isFinite(normalized)) return normalized;
  }
  return null;
}

function inferAssetType(symbol: string, name: string) {
  if (/ETF|ETN|KODEX|TIGER|ACE|SOL|RISE|KOSEF|HANARO/i.test(name)) return "ETF";
  return /^\d{6}$/.test(symbol) ? "STOCK" : "OTHER";
}

function readMetadata(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function bridgeUrl() {
  return process.env.NAMUH_WMCA_BRIDGE_URL?.trim() || null;
}

function maskAccountNo(accountNo: string) {
  if (accountNo.length <= 4) return accountNo;
  return `${accountNo.slice(0, 2)}****${accountNo.slice(-2)}`;
}

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0);
}
