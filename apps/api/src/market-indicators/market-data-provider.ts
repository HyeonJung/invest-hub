export type MarketIndicatorInput = {
  symbol: string;
  name: string;
  category: string;
  value: number;
  change: number;
  changeRate: number;
  status: string;
  currency?: string | null;
  unit?: string;
  marketState?: string;
  source: string;
  refreshIntervalMs: number;
  lastUpdatedAt?: Date;
};

export interface MarketDataProvider {
  getExchangeRate(): Promise<MarketIndicatorInput[]>;
  getFearGreedIndex(): Promise<MarketIndicatorInput[]>;
  getOilPrices(): Promise<MarketIndicatorInput[]>;
  getBondYields(): Promise<MarketIndicatorInput[]>;
  getMarketIndexes(): Promise<MarketIndicatorInput[]>;
  getCommodities(): Promise<MarketIndicatorInput[]>;
  getCryptoPrices(): Promise<MarketIndicatorInput[]>;
  getAllIndicators(): Promise<MarketIndicatorInput[]>;
}

export const MARKET_DATA_PROVIDER = Symbol("MARKET_DATA_PROVIDER");
