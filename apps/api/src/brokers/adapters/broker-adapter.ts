import { Broker, SourceType } from "@prisma/client";

export type BrokerAccount = {
  broker: Broker;
  externalAccountId: string;
  brokerAccountNo?: string | null;
  accountAlias: string;
  accountType: "BROKERAGE" | "PENSION_SAVINGS" | "ISA" | "MANUAL";
  currencyBase: string;
};

export type BrokerHolding = {
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  assetType: string;
  quantity: number;
  averagePurchasePrice: number;
  marketPrice: number;
  marketValue: number;
  costAmount: number;
  profitLoss: number;
  profitLossRate: number;
  annualDividendEstimate: number;
  sourceType: SourceType;
};

export type BrokerQuote = {
  symbol: string;
  marketCountry: string;
  currency: string;
  price: number;
  priceKrw: number;
  change?: number;
  changeRate?: number;
  source: string;
  fetchedAt: Date;
};

export type BrokerCashBalance = {
  cashKrw: number;
  orderableCashKrw: number;
  currencyBalances: Array<{
    currency: string;
    cash: number;
    orderableCash: number;
  }>;
};

export type BrokerPortfolioValue = {
  totalPurchaseAmount: number;
  totalMarketValue: number;
  totalProfitLoss: number;
  totalReturnRate: number;
};

export type BrokerConnectResult = {
  broker: Broker;
  connected: boolean;
  accounts: BrokerAccount[];
  selectedAccountNo: string | null;
  registeredAccountNos?: string[];
  credentialId?: string;
  message: string;
};

export type BrokerSyncResult = {
  broker: Broker;
  accounts: number;
  saved: number;
  cashBalance?: BrokerCashBalance;
  portfolioValue?: BrokerPortfolioValue;
  syncedAt: string;
};

export interface BrokerAdapter {
  readonly broker: Broker;
  connect(
    userId: string,
    options?: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string }
  ): Promise<BrokerConnectResult>;
  refreshToken(userId: string, options?: { credentialId?: string }): Promise<string>;
  getAccounts(userId: string, options?: { credentialId?: string }): Promise<BrokerAccount[]>;
  getHoldings(userId: string, options?: { accountNo?: string; credentialId?: string }): Promise<BrokerHolding[]>;
  getCashBalance(userId: string, options?: { accountNo?: string; credentialId?: string }): Promise<BrokerCashBalance>;
  getPortfolioValue(userId: string, options?: { accountNo?: string; credentialId?: string }): Promise<BrokerPortfolioValue>;
  getQuotes(userId: string, symbols: string[]): Promise<Map<string, BrokerQuote>>;
  getMarketData(userId: string, symbols: string[]): Promise<Map<string, BrokerQuote>>;
  syncAll(userId: string, options?: { accountNo?: string; credentialId?: string }): Promise<BrokerSyncResult>;
}
