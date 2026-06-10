import { getApiBaseUrl } from "@/lib/utils";

type RequestOptions = RequestInit & {
  token?: string | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? body.error?.message ?? "요청 처리에 실패했습니다.");
  }

  return response.json() as Promise<T>;
}

export const api = {
  authUrl: (provider: "kakao" | "naver") => `${getApiBaseUrl()}/auth/${provider}`,
  me: () => request<AuthUser>("/auth/me"),
  logout: () =>
    request<{ ok: true }>("/auth/logout", {
      method: "POST"
    }),
  login: (email: string, password: string) =>
    request<AuthUser>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  summary: (token: string | null) => request<PortfolioSummary>("/portfolio/summary", { token }),
  broker: (broker: BrokerKey, token: string | null) =>
    request<BrokerPortfolio>(`/portfolio/brokers/${broker}`, { token }),
  priceStatus: (token: string | null) => request<PriceRefreshResult>("/prices/status", { token }),
  refreshPrices: (token: string | null) =>
    request<PriceRefreshResult>("/prices/refresh", {
      method: "POST",
      token
    }),
  marketIndicators: (token?: string | null) => request<MarketIndicatorsResult>("/api/market-indicators", { token }),
  exchangeRate: (token?: string | null) => request<MarketIndicatorsResult>("/api/market-indicators/exchange-rate", { token }),
  refreshMarketIndicators: (token?: string | null) =>
    request<MarketIndicatorsResult>("/api/market-indicators/refresh", {
      method: "POST",
      token
    }),
  securityLogo: (securityId: string, token?: string | null) =>
    request<SecurityLogoResult>(`/api/securities/${securityId}/logo`, { token }),
  refreshSecurityLogo: (securityId: string, token?: string | null) =>
    request<SecurityLogoResult>(`/api/securities/${securityId}/logo/refresh`, {
      method: "POST",
      token
    }),
  adminSecurities: (params: { q?: string; marketCountry?: string; limit?: number } = {}, token?: string | null) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.marketCountry) search.set("marketCountry", params.marketCountry);
    if (params.limit) search.set("limit", String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<AdminSecuritiesResult>(`/api/admin/securities${suffix}`, { token });
  },
  adminSecurity: (securityId: string, token?: string | null) =>
    request<AdminSecurity>(`/api/admin/securities/${securityId}`, { token }),
  updateAdminSecurityLogo: (
    securityId: string,
    payload: { name?: string; marketCountry?: string; companyDomain?: string | null; logoUrl?: string | null; logoSource?: SecurityLogoSource | null },
    token?: string | null
  ) =>
    request<AdminSecurity>(`/api/admin/securities/${securityId}/logo`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      token
    }),
  uploadAdminSecurityLogo: (securityId: string, file: File, token?: string | null) => {
    const body = new FormData();
    body.append("file", file);
    return request<AdminSecurity>(`/api/admin/securities/${securityId}/logo/upload`, {
      method: "POST",
      body,
      token
    });
  },
  refreshAdminSecurityLogo: (securityId: string, token?: string | null) =>
    request<SecurityLogoResult>(`/api/admin/securities/${securityId}/logo/refresh`, {
      method: "POST",
      token
    }),
  deleteAdminSecurityLogo: (securityId: string, token?: string | null) =>
    request<AdminSecurity>(`/api/admin/securities/${securityId}/logo`, {
      method: "DELETE",
      token
    }),
  syncToss: (payload: { accountId?: string; clientId?: string; clientSecret?: string }, token: string | null) =>
    request<{ accounts: number; saved: number }>("/brokers/toss/sync", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  kiwoomStatus: (token: string | null) => request<KiwoomStatus>("/brokers/kiwoom/status", { token }),
  kiwoomAccounts: (token: string | null) => request<KiwoomAccount[]>("/brokers/kiwoom/accounts", { token }),
  connectKiwoom: (payload: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string }, token: string | null) =>
    request<KiwoomConnectResult>("/brokers/kiwoom/connect", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  syncKiwoom: (payload: { accountNo?: string; credentialId?: string }, token: string | null) =>
    request<KiwoomSyncResult>("/brokers/kiwoom/sync", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  namuhStatus: (token: string | null) => request<NamuhStatus>("/brokers/namuh/status", { token }),
  namuhAccounts: (token: string | null) => request<NamuhAccount[]>("/brokers/namuh/accounts", { token }),
  connectNamuh: (payload: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string }, token: string | null) =>
    request<NamuhConnectResult>("/brokers/namuh/connect", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  syncNamuh: (payload: { accountNo?: string; credentialId?: string }, token: string | null) =>
    request<NamuhSyncResult>("/brokers/namuh/sync", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  upbitStatus: (token: string | null) => request<UpbitStatus>("/brokers/upbit/status", { token }),
  testUpbitCredential: (payload: { accessKey: string; secretKey: string }, token: string | null) =>
    request<{ ok: true; message: string }>("/brokers/upbit/test", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  connectUpbit: (payload: { credentialId?: string }, token: string | null) =>
    request<UpbitConnectResult>("/brokers/upbit/connect", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  syncUpbit: (payload: { credentialId?: string }, token: string | null) =>
    request<UpbitSyncResult>("/brokers/upbit/sync", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  uploadPreview: (file: File, broker: BrokerKey, accountType: string, token: string | null) => {
    const body = new FormData();
    body.append("file", file);
    body.append("broker", broker);
    body.append("accountType", accountType);
    return request<UploadPreview>("/uploads/preview", { method: "POST", body, token });
  },
  uploadCommit: (payload: UploadCommitPayload, token: string | null) =>
    request<{ saved: number; accountId: string }>("/uploads/commit", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  targets: (token: string | null) => request<PortfolioTarget[]>("/settings/targets", { token }),
  saveTargets: (targets: PortfolioTargetInput[], token: string | null) =>
    request<PortfolioTarget[]>("/settings/targets", {
      method: "POST",
      body: JSON.stringify({ targets }),
      token
    }),
  tossCredentials: (token: string | null) => request<TossCredentialAccount[]>("/settings/toss-credentials", { token }),
  createTossAccount: (payload: { accountAlias?: string; accountType?: string; externalAccountId?: string }, token: string | null) =>
    request<TossCredentialAccount[]>("/settings/toss-accounts", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  saveTossCredential: (payload: { accountId: string; clientId: string; clientSecret?: string }, token: string | null) =>
    request<TossCredentialAccount[]>("/settings/toss-credentials", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  deleteTossCredential: (accountId: string, token: string | null) =>
    request<TossCredentialAccount[]>(`/settings/toss-credentials/${accountId}`, {
      method: "DELETE",
      token
    }),
  kiwoomCredential: (token: string | null) => request<KiwoomCredentialSetting>("/settings/kiwoom-credential", { token }),
  kiwoomCredentials: (token: string | null) => request<KiwoomCredentialProfile[]>("/settings/kiwoom-credentials", { token }),
  saveKiwoomCredential: (payload: { connectionId?: string; label?: string; appKey: string; secretKey?: string; useMock?: boolean }, token: string | null) =>
    request<KiwoomCredentialSetting>("/settings/kiwoom-credential", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  saveKiwoomCredentialProfile: (payload: { connectionId?: string; label?: string; appKey: string; secretKey?: string; useMock?: boolean }, token: string | null) =>
    request<KiwoomCredentialProfile[]>("/settings/kiwoom-credentials", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  deleteKiwoomCredential: (token: string | null) =>
    request<KiwoomCredentialSetting>("/settings/kiwoom-credential", {
      method: "DELETE",
      token
    }),
  deleteKiwoomCredentialProfile: (connectionId: string, token: string | null) =>
    request<KiwoomCredentialProfile[]>(`/settings/kiwoom-credentials/${connectionId}`, {
      method: "DELETE",
      token
    }),
  namuhCredentials: (token: string | null) => request<NamuhCredentialProfile[]>("/settings/namuh-credentials", { token }),
  saveNamuhCredentialProfile: (
    payload: {
      connectionId?: string;
      label?: string;
      loginId: string;
      loginPassword?: string;
      certificatePassword?: string;
      accountPassword?: string;
      certificateMode?: "PC" | "CLOUD";
      environment?: "REAL" | "MOCK";
    },
    token: string | null
  ) =>
    request<NamuhCredentialProfile[]>("/settings/namuh-credentials", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  deleteNamuhCredentialProfile: (connectionId: string, token: string | null) =>
    request<NamuhCredentialProfile[]>(`/settings/namuh-credentials/${connectionId}`, {
      method: "DELETE",
      token
    }),
  upbitCredentials: (token: string | null) => request<UpbitCredentialProfile[]>("/settings/upbit-credentials", { token }),
  saveUpbitCredentialProfile: (payload: { connectionId?: string; label?: string; accessKey: string; secretKey?: string }, token: string | null) =>
    request<UpbitCredentialProfile[]>("/settings/upbit-credentials", {
      method: "POST",
      body: JSON.stringify(payload),
      token
    }),
  deleteUpbitCredentialProfile: (connectionId: string, token: string | null) =>
    request<UpbitCredentialProfile[]>(`/settings/upbit-credentials/${connectionId}`, {
      method: "DELETE",
      token
    }),
  rebalance: (targets: PortfolioTargetInput[], token: string | null) =>
    request<RebalanceResult>("/rebalance", {
      method: "POST",
      body: JSON.stringify({ targets }),
      token
    })
};

export type BrokerKey = "TOSS" | "NAMUH" | "KIWOOM" | "UPBIT";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
  role: "USER" | "ADMIN";
  lastLoginAt: string | null;
  providers: Array<"KAKAO" | "NAVER">;
};

export type Metric = {
  totalMarketValue: number;
  totalProfitLoss: number;
  returnRate: number;
  annualDividendEstimate: number;
  fxExposureRate: number;
  fxImpactAmount: number;
};

export type ChartDatum = {
  name: string;
  value: number;
  rate?: number;
  color?: string;
};

export type Holding = {
  id: string;
  securityId: string;
  broker: BrokerKey;
  accountAlias: string;
  accountType: string;
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  assetType: string;
  logoUrl: string | null;
  companyDomain: string | null;
  logoSource: SecurityLogoSource | string;
  quantity: number;
  averagePurchasePrice: number;
  marketPrice: number;
  regularMarketPrice: number | null;
  extendedMarketPrice: number | null;
  lastPrice: number | null;
  previousClose: number | null;
  displayPrice: number | null;
  priceSource: string | null;
  priceUpdatedAt: string | null;
  isStale: boolean;
  marketValue: number;
  costAmount: number;
  profitLoss: number;
  profitLossRate: number;
  annualDividendEstimate: number;
};

export type SecurityLogoResult = {
  securityId: string | null;
  symbol: string;
  name: string;
  marketCountry: string;
  logoUrl: string | null;
  companyDomain: string | null;
  logoSource: SecurityLogoSource | string;
  logoLastCheckedAt: string | null;
  logoFailedAt: string | null;
};

export type SecurityLogoSource = "MANUAL" | "UPLOAD" | "FINNHUB" | "LOGO_DEV" | "BRANDFETCH" | "FALLBACK";

export type AdminSecurity = {
  id: string;
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  assetType: string;
  companyDomain: string | null;
  logoUrl: string | null;
  logoSource: SecurityLogoSource | string;
  logoLastCheckedAt: string | null;
  logoFailedAt: string | null;
};

export type AdminSecuritiesResult = {
  total: number;
  limit: number;
  items: AdminSecurity[];
};

export type PortfolioSummary = {
  metrics: Metric;
  assetAllocation: ChartDatum[];
  accountValues: ChartDatum[];
  accountReturns: ChartDatum[];
  topHoldings: Holding[];
  duplicateHoldings: Array<{
    securityId: string;
    symbol: string;
    name: string;
    marketCountry: string;
    currency: string;
    logoUrl: string | null;
    companyDomain: string | null;
    logoSource: SecurityLogoSource | string;
    accounts: string[];
    totalQuantity: number;
    totalMarketValue: number;
    profitLoss: number;
    profitLossRate: number;
  }>;
  aiInsights: Array<{
    type: "warning" | "info" | "success";
    title: string;
    description: string;
  }>;
  todayAssetMovement: {
    stockImpact: number;
    fxImpact: number;
    dividendImpact: number;
    totalChange: number;
  };
  holdings: Holding[];
};

export type BrokerPortfolio = {
  broker: BrokerKey;
  metrics: Metric;
  holdings: Holding[];
};

export type PriceRefreshResult = {
  refreshedAt: string | null;
  lastSuccessAt: string | null;
  refreshIntervalMs: number;
  marketSession: {
    domesticOpen: boolean;
    usOpen: boolean;
    session: "OPEN" | "CLOSED";
    refreshIntervalMs: number;
    label: string;
  };
  symbolsRequested: number;
  symbolsFetched: number;
  holdingsUpdated: number;
  source: string;
  skipped: string[];
  errors: string[];
};

export type MarketIndicator = {
  id: string;
  symbol: string;
  name: string;
  category: string;
  value: number;
  change: number;
  changeRate: number;
  status: "UP" | "DOWN" | "NEUTRAL" | "DELAYED" | "GREED" | "EXTREME_GREED" | "FEAR" | "EXTREME_FEAR";
  rawStatus: string;
  currency: string | null;
  unit: "KRW" | "USD" | "PERCENT" | "POINT" | "SCORE" | string | null;
  marketState: string | null;
  source: string;
  refreshIntervalMs: number;
  lastUpdatedAt: string;
  errorMessage: string | null;
  isDelayed: boolean;
};

export type MarketIndicatorsResult = {
  refreshedAt: string;
  lastSuccessAt: string | null;
  nextRefreshIntervalMs: number;
  indicators: MarketIndicator[];
  errors: string[];
};

export type UploadPreview = {
  importId: string;
  mapping: Record<string, string>;
  rows: Array<Record<string, unknown>>;
  normalizedRows: Array<NormalizedUploadRow>;
  validation: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    messages: string[];
  };
};

export type NormalizedUploadRow = {
  symbol: string;
  name: string;
  currency: string;
  quantity: number;
  averagePurchasePrice: number;
  marketPrice: number;
  marketValue: number;
  costAmount: number;
  profitLoss: number;
  assetType: string;
  marketCountry: string;
  status: "VALID" | "WARNING" | "ERROR";
  errors: string[];
};

export type UploadCommitPayload = {
  broker: BrokerKey;
  accountType: string;
  accountAlias: string;
  rows: NormalizedUploadRow[];
};

export type PortfolioTarget = {
  id: string;
  targetType: string;
  targetKey: string;
  targetWeight: number;
};

export type PortfolioTargetInput = {
  targetType: string;
  targetKey: string;
  targetWeight: number;
};

export type TossCredentialAccount = {
  accountId: string;
  accountAlias: string;
  accountType: string;
  externalAccountId: string | null;
  currencyBase: string;
  credential: null | {
    clientId: string;
    secretPreview: string;
    status: "ACTIVE" | "ERROR" | "INACTIVE";
    lastValidatedAt: string | null;
    lastUsedAt: string | null;
    updatedAt: string;
  };
};

export type KiwoomAccount = {
  broker: "KIWOOM";
  externalAccountId: string;
  brokerAccountNo: string | null;
  accountAlias: string;
  accountType: string;
  currencyBase: string;
};

export type KiwoomConnectResult = {
  broker: "KIWOOM";
  connected: boolean;
  accounts: KiwoomAccount[];
  selectedAccountNo: string | null;
  registeredAccountNos?: string[];
  credentialId?: string;
  message: string;
};

export type KiwoomStatus = {
  connected: boolean;
  status: "ACTIVE" | "ERROR" | "INACTIVE";
  brokerType: string;
  connectionType: string;
  lastSyncedAt: string | null;
  tokenExpiresAt: string | null;
  baseUrl: string;
  hasStoredCredential: boolean;
  credentialSource: "DB" | "ENV" | "NONE";
  appKeyPreview: string | null;
  credentials?: Array<{
    connectionId: string;
    label: string;
    appKeyPreview: string;
    secretPreview: string | null;
    status: "ACTIVE" | "ERROR" | "INACTIVE";
    useMock: boolean;
    baseUrl: string;
    tokenExpiresAt: string | null;
    updatedAt: string | null;
  }>;
  accounts: Array<{
    credentialConnectionId?: string | null;
    credentialLabel?: string | null;
    accountId: string;
    accountAlias: string;
    brokerAccountNo: string | null;
    externalAccountId: string | null;
    credential: null | {
      clientId: string;
      secretPreview: string;
      status: "ACTIVE" | "ERROR" | "INACTIVE";
      lastValidatedAt: string | null;
      lastUsedAt: string | null;
      updatedAt: string;
    };
  }>;
};

export type KiwoomCredentialSetting = {
  appKey: string | null;
  secretPreview: string | null;
  status: "ACTIVE" | "ERROR" | "INACTIVE";
  useMock: boolean;
  baseUrl: string;
  source: "DB" | "ENV" | "NONE";
  updatedAt: string | null;
};

export type KiwoomCredentialProfile = {
  connectionId: string;
  label: string;
  appKey: string | null;
  appKeyPreview: string;
  secretPreview: string | null;
  status: "ACTIVE" | "ERROR" | "INACTIVE";
  useMock: boolean;
  baseUrl: string;
  source: "DB";
  updatedAt: string | null;
  accounts: Array<{
    accountId: string;
    accountAlias: string;
    brokerAccountNo: string | null;
    externalAccountId: string | null;
    credentialStatus: "ACTIVE" | "ERROR" | "INACTIVE";
    lastUsedAt: string | null;
    updatedAt: string | null;
  }>;
};

export type KiwoomSyncResult = {
  broker: "KIWOOM";
  accounts: number;
  saved: number;
  syncedAt: string;
  cashBalance?: {
    cashKrw: number;
    orderableCashKrw: number;
    currencyBalances: Array<{
      currency: string;
      cash: number;
      orderableCash: number;
    }>;
  };
  portfolioValue?: {
    totalPurchaseAmount: number;
    totalMarketValue: number;
    totalProfitLoss: number;
    totalReturnRate: number;
  };
};

export type NamuhAccount = {
  broker: "NAMUH";
  externalAccountId: string;
  brokerAccountNo: string | null;
  accountAlias: string;
  accountType: string;
  currencyBase: string;
};

export type NamuhConnectResult = {
  broker: "NAMUH";
  connected: boolean;
  accounts: NamuhAccount[];
  selectedAccountNo: string | null;
  registeredAccountNos?: string[];
  credentialId?: string;
  message: string;
};

export type NamuhStatus = {
  connected: boolean;
  status: "ACTIVE" | "ERROR" | "INACTIVE";
  brokerType: string;
  connectionType: string;
  lastSyncedAt: string | null;
  bridgeUrl: string | null;
  hasBridge: boolean;
  documentProfile: {
    sdk: string;
    auth: string;
    accountListEvent: string;
    balanceTrCode: string;
    domesticQuoteTrCode: string;
    realtimeTradeCode: string;
    mockTrading: string;
    transport: string;
  };
  credentials: NamuhCredentialProfile[];
  accounts: Array<{
    credentialConnectionId?: string | null;
    credentialLabel?: string | null;
    accountId: string;
    accountAlias: string;
    brokerAccountNo: string | null;
    externalAccountId: string | null;
    credential: null | {
      clientId: string;
      secretPreview: string;
      status: "ACTIVE" | "ERROR" | "INACTIVE";
      lastValidatedAt: string | null;
      lastUsedAt: string | null;
      updatedAt: string;
    };
  }>;
};

export type NamuhCredentialProfile = {
  connectionId: string;
  label: string;
  loginId: string | null;
  loginIdPreview: string;
  passwordPreview: string | null;
  certificatePasswordPreview: string | null;
  accountPasswordPreview: string | null;
  status: "ACTIVE" | "ERROR" | "INACTIVE";
  environment: "REAL" | "MOCK";
  certificateMode: "PC" | "CLOUD";
  bridgeUrl: string | null;
  source: "DB";
  updatedAt: string | null;
  errorMessage?: string | null;
  accounts: Array<{
    accountId: string;
    accountAlias: string;
    brokerAccountNo: string | null;
    externalAccountId: string | null;
    credentialStatus: "ACTIVE" | "ERROR" | "INACTIVE";
    lastUsedAt: string | null;
    updatedAt: string | null;
  }>;
};

export type NamuhSyncResult = {
  broker: "NAMUH";
  accounts: number;
  saved: number;
  syncedAt: string;
  cashBalance?: {
    cashKrw: number;
    orderableCashKrw: number;
    currencyBalances: Array<{
      currency: string;
      cash: number;
      orderableCash: number;
    }>;
  };
  portfolioValue?: {
    totalPurchaseAmount: number;
    totalMarketValue: number;
    totalProfitLoss: number;
    totalReturnRate: number;
  };
};

export type UpbitCredentialProfile = {
  connectionId: string;
  label: string;
  accessKey: string | null;
  accessKeyPreview: string | null;
  secretPreview: string | null;
  status: "ACTIVE" | "ERROR" | "INACTIVE";
  source: "DB" | "ENV";
  baseUrl: string;
  updatedAt: string | null;
  lastSyncedAt: string | null;
  lastPriceSyncedAt: string | null;
  errorMessage: string | null;
  holdingsCount: number;
  cashKrw: number;
};

export type UpbitStatus = {
  connected: boolean;
  status: "ACTIVE" | "ERROR" | "INACTIVE";
  brokerType: "UPBIT";
  connectionType: "API";
  baseUrl: string;
  hasEnvCredential: boolean;
  credentials: UpbitCredentialProfile[];
};

export type UpbitConnectResult = {
  broker: "UPBIT";
  connected: boolean;
  credentialId: string;
  message: string;
  accounts: Array<{
    broker: "UPBIT";
    externalAccountId: string;
    brokerAccountNo: string | null;
    accountAlias: string;
    accountType: "CRYPTO";
    currencyBase: "KRW";
  }>;
};

export type UpbitSyncResult = {
  broker: "UPBIT";
  connectionId: string;
  accounts: number;
  saved: number;
  syncedAt: string;
  source: "UPBIT_REST_API";
  cashBalances: Array<{
    currency: string;
    balance: number;
    locked: number;
  }>;
  portfolioValue: {
    totalPurchaseAmount: number;
    totalMarketValue: number;
    totalProfitLoss: number;
    totalReturnRate: number;
  };
  errors: string[];
};

export type RebalanceResult = {
  totalMarketValue: number;
  recommendations: Array<{
    targetKey: string;
    currentWeight: number;
    targetWeight: number;
    differenceAmount: number;
    action: "BUY" | "SELL" | "HOLD";
    score: number;
    reason: string;
  }>;
};
