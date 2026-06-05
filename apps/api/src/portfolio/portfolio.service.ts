import { Injectable } from "@nestjs/common";
import { Broker } from "@prisma/client";
import { MarketIndicatorsService } from "../market-indicators/market-indicators.service";
import { PrismaService } from "../prisma/prisma.service";
import { StockLogoService } from "../securities/stock-logo.service";

const COLORS = ["#3b73ff", "#48c6a7", "#8b5cf6", "#f4bc4f", "#ef6c73", "#27b7d7"];

type MarketContext = Awaited<ReturnType<MarketIndicatorsService["getMarketContext"]>>;

type HoldingRow = {
  id: string;
  accountId: string;
  broker: Broker;
  accountAlias: string;
  accountType: string;
  accountSnapshotMarketValue: number | null;
  accountSnapshotProfitLoss: number | null;
  accountSnapshotReturnRate: number | null;
  securityId: string;
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  assetType: string;
  logoUrl: string | null;
  companyDomain: string | null;
  logoSource: string;
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

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketIndicatorsService: MarketIndicatorsService,
    private readonly stockLogoService: StockLogoService
  ) {}

  async getSummary(userId: string) {
    const marketContext = await this.marketIndicatorsService.getMarketContext(userId);
    const holdings = await this.getHoldingRows(userId, undefined, marketContext.usdKrwRate);
    return this.buildSummary(holdings, marketContext);
  }

  async getBrokerPortfolio(userId: string, broker: string) {
    const usdKrwRate = await this.marketIndicatorsService.getUsdKrwRate(userId);
    const holdings = await this.getHoldingRows(userId, broker as Broker, usdKrwRate);
    return {
      broker,
      metrics: this.metrics(holdings),
      holdings
    };
  }

  async getHoldingRows(userId: string, broker?: Broker, usdKrwRate?: number): Promise<HoldingRow[]> {
    const effectiveUsdKrwRate = usdKrwRate ?? (await this.marketIndicatorsService.getUsdKrwRate(userId));
    const rows = await this.prisma.holding.findMany({
      where: {
        account: {
          userId,
          ...(broker ? { broker } : {})
        }
      },
      include: {
        security: true,
        account: true
      },
      orderBy: { marketValue: "desc" }
    });
    const prices =
      rows.length > 0
        ? await this.prisma.currentPrice.findMany({
            where: {
              OR: rows.map((row) => ({
                symbol: row.security.symbol,
                marketCountry: row.security.marketCountry
              }))
            }
          })
        : [];
    const priceMap = new Map(prices.map((price) => [`${price.symbol}:${price.marketCountry}`, price]));
    const logoMap = await this.stockLogoService.getLogosForSecurities(rows.map((row) => row.security));

    return rows.map((row) => {
      const quantity = Number(row.quantity);
      const storedMarketPrice = Number(row.marketPrice);
      const averagePurchasePrice = Number(row.averagePurchasePrice);
      const rawMarketValue = Number(row.marketValue);
      const rawCostAmount = Number(row.costAmount);
      const rawAnnualDividendEstimate = Number(row.annualDividendEstimate);
      const cachedPrice = priceMap.get(`${row.security.symbol}:${row.security.marketCountry}`);
      const shouldConvertUsdAmounts = shouldConvertUsdToKrw({
        currency: row.security.currency,
        quantity,
        marketPrice: storedMarketPrice,
        marketValue: rawMarketValue
      });
      const cachedNativePrice = cachedPrice
        ? Number(cachedPrice.displayPrice ?? cachedPrice.price)
        : null;
      const storedDisplayPrice = row.displayPrice == null ? null : Number(row.displayPrice);
      const nativeMarketPrice = validPrice(cachedNativePrice) ?? validPrice(storedDisplayPrice) ?? storedMarketPrice;
      const liveKrwMarketPrice = cachedPrice
        ? Number(cachedPrice.priceKrw)
        : row.security.currency === "USD"
          ? nativeMarketPrice * effectiveUsdKrwRate
          : nativeMarketPrice;
      const marketValue =
        liveKrwMarketPrice > 0 && quantity > 0
          ? quantity * liveKrwMarketPrice
          : shouldConvertUsdAmounts
            ? rawMarketValue * effectiveUsdKrwRate
            : rawMarketValue;
      const costAmount = shouldConvertUsdAmounts ? rawCostAmount * effectiveUsdKrwRate : rawCostAmount;
      const profitLoss = marketValue - costAmount;
      const logo = logoMap.get(row.security.id);
      const priceSource = cachedPrice?.priceSource ?? row.priceSource ?? null;
      const priceUpdatedAt =
        cachedPrice?.priceUpdatedAt?.toISOString() ??
        cachedPrice?.fetchedAt?.toISOString() ??
        row.priceUpdatedAt?.toISOString() ??
        null;

      return {
        id: row.id,
        accountId: row.account.id,
        broker: row.account.broker,
        accountAlias: row.account.accountAlias,
        accountType: row.account.accountType,
        accountSnapshotMarketValue: row.account.snapshotMarketValue == null ? null : Number(row.account.snapshotMarketValue),
        accountSnapshotProfitLoss: row.account.snapshotProfitLoss == null ? null : Number(row.account.snapshotProfitLoss),
        accountSnapshotReturnRate: row.account.snapshotReturnRate == null ? null : Number(row.account.snapshotReturnRate),
        securityId: row.security.id,
        symbol: row.security.symbol,
        name: row.security.name,
        marketCountry: row.security.marketCountry,
        currency: row.security.currency,
        assetType: row.security.assetType,
        logoUrl: logo?.logoUrl ?? row.security.logoUrl ?? null,
        companyDomain: logo?.companyDomain ?? row.security.companyDomain ?? null,
        logoSource: logo?.logoSource ?? row.security.logoSource ?? "FALLBACK",
        quantity,
        averagePurchasePrice,
        marketPrice: nativeMarketPrice,
        regularMarketPrice: toNullableNumber(cachedPrice?.regularMarketPrice ?? row.regularMarketPrice),
        extendedMarketPrice: toNullableNumber(cachedPrice?.extendedMarketPrice ?? row.extendedMarketPrice),
        lastPrice: toNullableNumber(cachedPrice?.lastPrice ?? row.lastPrice),
        previousClose: toNullableNumber(cachedPrice?.previousClose ?? row.previousClose),
        displayPrice: toNullableNumber(cachedPrice?.displayPrice ?? row.displayPrice),
        priceSource,
        priceUpdatedAt,
        isStale: Boolean(cachedPrice?.isStale ?? row.isStale),
        marketValue,
        costAmount,
        profitLoss,
        profitLossRate: costAmount > 0 ? (profitLoss / costAmount) * 100 : Number(row.profitLossRate),
        annualDividendEstimate: shouldConvertUsdAmounts
          ? rawAnnualDividendEstimate * effectiveUsdKrwRate
          : rawAnnualDividendEstimate
      };
    }).sort((a, b) => b.marketValue - a.marketValue);
  }

  buildSummary(holdings: HoldingRow[], marketContext: MarketContext) {
    const metrics = this.metrics(holdings, marketContext);
    return {
      metrics,
      assetAllocation: this.assetAllocation(holdings),
      accountValues: this.accountValues(holdings),
      accountReturns: this.accountReturns(holdings),
      topHoldings: holdings.slice(0, 5),
      duplicateHoldings: this.duplicates(holdings).slice(0, 3),
      aiInsights: this.aiInsights(metrics, holdings),
      todayAssetMovement: this.todayAssetMovement(holdings, marketContext),
      holdings
    };
  }

  metrics(holdings: HoldingRow[], marketContext?: MarketContext) {
    const accountMetrics = this.accountMetrics(holdings);
    const totalMarketValue = sum(accountMetrics.map((account) => account.marketValue));
    const totalProfitLoss = sum(accountMetrics.map((account) => account.profitLoss));
    const totalCost = Math.max(0, totalMarketValue - totalProfitLoss);
    const annualDividendEstimate = sum(holdings.map((holding) => holding.annualDividendEstimate));
    const usdMarketValue = sum(
      holdings.filter((holding) => holding.currency === "USD").map((holding) => holding.marketValue)
    );

    return {
      totalMarketValue,
      totalProfitLoss,
      returnRate: totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0,
      annualDividendEstimate,
      fxExposureRate: totalMarketValue > 0 ? (usdMarketValue / totalMarketValue) * 100 : 0,
      fxImpactAmount: marketContext ? usdMarketValue * (marketContext.usdKrwChangeRate / 100) : 0
    };
  }

  private todayAssetMovement(holdings: HoldingRow[], marketContext: MarketContext) {
    const usdMarketValue = sum(holdings.filter((holding) => holding.currency === "USD").map((holding) => holding.marketValue));
    const stockImpact = usdMarketValue * (marketContext.usIndexChangeRate / 100);
    const fxImpact = usdMarketValue * (marketContext.usdKrwChangeRate / 100);
    const dividendImpact = 0;

    return {
      stockImpact,
      fxImpact,
      dividendImpact,
      totalChange: stockImpact + fxImpact + dividendImpact
    };
  }

  private assetAllocation(holdings: HoldingRow[]) {
    const total = sum(holdings.map((holding) => holding.marketValue));
    const buckets = [
      {
        name: "해외 주식",
        value: sum(holdings.filter((holding) => holding.marketCountry === "US").map((holding) => holding.marketValue))
      },
      {
        name: "국내 주식",
        value: sum(holdings.filter((holding) => holding.marketCountry === "KR").map((holding) => holding.marketValue))
      },
      {
        name: "ETF",
        value: sum(holdings.filter((holding) => holding.assetType === "ETF").map((holding) => holding.marketValue))
      },
      {
        name: "현금",
        value: Math.max(0, total * 0.044)
      }
    ];

    return buckets.map((bucket, index) => ({
      ...bucket,
      rate: total > 0 ? (bucket.value / total) * 100 : 0,
      color: COLORS[index]
    }));
  }

  private accountValues(holdings: HoldingRow[]) {
    const accountMetrics = this.accountMetrics(holdings);
    const total = sum(accountMetrics.map((account) => account.marketValue));
    return accountMetrics.map((account, index) => ({
      name: account.name,
      value: account.marketValue,
      rate: total > 0 ? (account.marketValue / total) * 100 : 0,
      color: COLORS[index % COLORS.length]
    }));
  }

  private accountReturns(holdings: HoldingRow[]) {
    const accountMetrics = this.accountMetrics(holdings);
    return accountMetrics.map((account, index) => {
      return {
        name: account.name,
        value: account.returnRate,
        rate: account.returnRate,
        color: COLORS[index % COLORS.length]
      };
    });
  }

  private accountMetrics(holdings: HoldingRow[]) {
    const grouped = groupBy(holdings, (holding) => holding.accountId);
    return Object.values(grouped).map((rows) => {
      const first = rows[0];
      const fallbackMarketValue = sum(rows.map((row) => row.marketValue));
      const fallbackProfitLoss = sum(rows.map((row) => row.profitLoss));
      const marketValue = fallbackMarketValue;
      const profitLoss = fallbackProfitLoss;
      const cost = Math.max(0, marketValue - profitLoss);

      return {
        id: first?.accountId ?? "",
        name: first?.accountAlias ?? "",
        marketValue,
        profitLoss,
        returnRate: cost > 0 ? (profitLoss / cost) * 100 : 0
      };
    });
  }

  private duplicates(holdings: HoldingRow[]) {
    const grouped = groupBy(holdings, (holding) => holding.symbol);
    return Object.entries(grouped)
      .filter(([, rows]) => new Set(rows.map((row) => row.accountAlias)).size > 1)
      .map(([symbol, rows]) => {
        const totalMarketValue = sum(rows.map((row) => row.marketValue));
        const totalCostAmount = sum(rows.map((row) => row.costAmount));
        const totalProfitLoss = sum(rows.map((row) => row.profitLoss));

        return {
          symbol,
          name: rows[0]?.name ?? symbol,
          securityId: rows[0]?.securityId ?? "",
          marketCountry: rows[0]?.marketCountry ?? "",
          currency: rows[0]?.currency ?? "",
          logoUrl: rows[0]?.logoUrl ?? null,
          companyDomain: rows[0]?.companyDomain ?? null,
          logoSource: rows[0]?.logoSource ?? "FALLBACK",
          accounts: Array.from(new Set(rows.map((row) => row.accountAlias))),
          totalQuantity: sum(rows.map((row) => row.quantity)),
          totalMarketValue,
          profitLoss: totalProfitLoss,
          profitLossRate: totalCostAmount > 0 ? (totalProfitLoss / totalCostAmount) * 100 : 0
        };
      })
      .sort((a, b) => b.totalMarketValue - a.totalMarketValue);
  }

  private aiInsights(metrics: ReturnType<PortfolioService["metrics"]>, holdings: HoldingRow[]) {
    const topHolding = holdings[0];
    const duplicateCount = this.duplicates(holdings).length;
    return [
      {
        type: "warning",
        title: `${topHolding?.symbol ?? "상위 종목"} 비중이 높습니다.`,
        description: "리밸런싱 목표 대비 상위 종목 집중도를 점검하세요."
      },
      {
        type: "info",
        title: `${duplicateCount}개 종목이 여러 계좌에 분산되어 있습니다.`,
        description: "계좌 통합 또는 계좌별 역할 분리를 검토할 수 있어요."
      },
      {
        type: "success",
        title: "연간 배당 예상이 전년 대비 증가할 가능성이 있습니다.",
        description: `현재 입력 기준 연간 배당 예상은 ${Math.round(metrics.annualDividendEstimate).toLocaleString("ko-KR")}원입니다.`
      }
    ];
  }
}

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0);
}

function toNullableNumber(value: unknown) {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function validPrice(value: number | null | undefined) {
  return Number.isFinite(value ?? NaN) && (value ?? 0) > 0 ? (value as number) : null;
}

function groupBy<T>(rows: T[], keyGetter: (row: T) => string) {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    const key = keyGetter(row);
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});
}

function shouldConvertUsdToKrw({
  currency,
  quantity,
  marketPrice,
  marketValue
}: {
  currency: string;
  quantity: number;
  marketPrice: number;
  marketValue: number;
}) {
  if (currency !== "USD" || quantity <= 0 || marketPrice <= 0 || marketValue <= 0) return false;
  if (marketPrice >= 5000) return false;

  const expectedUsdMarketValue = quantity * marketPrice;
  if (expectedUsdMarketValue <= 0) return false;

  const ratio = marketValue / expectedUsdMarketValue;

  // 토스 Open API는 미장 평가금액을 USD로 줄 수 있다. 이 경우 원화 대시보드 표시 전에 환산한다.
  return ratio > 0.2 && ratio < 5;
}
