"use client";

import type { BrokerKey, ChartDatum, Holding, MarketIndicator, MarketIndicatorsResult, Metric, PortfolioSummary } from "@/lib/api";

export type MobileTab = "home" | "accounts" | "holdings" | "analysis" | "settings";
export type MobileView = MobileTab | "account-detail";
export type MobileHoldingFilter = "ALL" | "KR" | "US" | "ETF";
export type MobileHoldingSort = "marketValue" | "returnRate" | "profitLoss" | "name";

export type MobileAccount = {
  id: string;
  rawKey: string;
  broker: BrokerKey;
  brokerLabel: string;
  accountAlias: string;
  accountType: string;
  displayName: string;
  shortName: string;
  holdings: Holding[];
  metrics: Metric;
};

export type MobileAggregatedHolding = {
  id: string;
  securityId: string;
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  assetType: string;
  logoUrl: string | null;
  totalQuantity: number;
  marketPrice: number;
  averagePurchasePrice: number;
  marketValue: number;
  costAmount: number;
  profitLoss: number;
  profitLossRate: number;
  accounts: Array<{
    id: string;
    broker: BrokerKey;
    accountAlias: string;
    accountType: string;
    quantity: number;
    marketValue: number;
    profitLoss: number;
    profitLossRate: number;
  }>;
};

export type MobilePortfolioData = {
  summary: PortfolioSummary;
  accounts: MobileAccount[];
  holdings: MobileAggregatedHolding[];
  assetAllocation: ChartDatum[];
  marketIndicators?: MarketIndicatorsResult;
  selectedAccount?: MobileAccount | null;
};

export type MobileMarketIndicator = MarketIndicator;
