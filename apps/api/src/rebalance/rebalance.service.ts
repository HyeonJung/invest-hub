import { Injectable } from "@nestjs/common";
import { PortfolioService } from "../portfolio/portfolio.service";

@Injectable()
export class RebalanceService {
  constructor(private readonly portfolioService: PortfolioService) {}

  async calculate(userId: string, targets: Array<{ targetType: string; targetKey: string; targetWeight: number }>) {
    const holdings = await this.portfolioService.getHoldingRows(userId);
    const totalMarketValue = holdings.reduce((acc, holding) => acc + holding.marketValue, 0);
    const currentByKey = this.currentBuckets(holdings);

    const normalizedTargets = this.normalizeTargets(targets);
    const recommendations = normalizedTargets.map((target) => {
      const currentValue = currentByKey[target.targetKey] ?? 0;
      const currentWeight = totalMarketValue > 0 ? (currentValue / totalMarketValue) * 100 : 0;
      const targetValue = totalMarketValue * (target.targetWeight / 100);
      const differenceAmount = targetValue - currentValue;
      const absDiffRate = Math.abs(target.targetWeight - currentWeight);
      const action = Math.abs(differenceAmount) < totalMarketValue * 0.01 ? "HOLD" : differenceAmount > 0 ? "BUY" : "SELL";
      const score = Math.min(100, Math.round(absDiffRate * 8 + Math.abs(differenceAmount / totalMarketValue) * 70));

      return {
        targetKey: target.targetKey,
        currentWeight,
        targetWeight: target.targetWeight,
        differenceAmount,
        action,
        score,
        reason: this.reason(action, target.targetKey, differenceAmount, score)
      };
    });

    return {
      totalMarketValue,
      recommendations: recommendations.sort((a, b) => b.score - a.score)
    };
  }

  private currentBuckets(holdings: Awaited<ReturnType<PortfolioService["getHoldingRows"]>>) {
    return holdings.reduce<Record<string, number>>((acc, holding) => {
      const key = holding.marketCountry === "US" ? "해외 주식" : "국내 주식";
      acc[key] = (acc[key] ?? 0) + holding.marketValue;
      acc[holding.assetType === "ETF" ? "ETF" : "개별주"] =
        (acc[holding.assetType === "ETF" ? "ETF" : "개별주"] ?? 0) + holding.marketValue;
      return acc;
    }, {});
  }

  private normalizeTargets(targets: Array<{ targetType: string; targetKey: string; targetWeight: number }>) {
    if (targets.length > 0) {
      return targets;
    }

    return [
      { targetType: "ASSET", targetKey: "해외 주식", targetWeight: 55 },
      { targetType: "ASSET", targetKey: "국내 주식", targetWeight: 25 },
      { targetType: "ASSET", targetKey: "ETF", targetWeight: 60 },
      { targetType: "ASSET", targetKey: "개별주", targetWeight: 35 }
    ];
  }

  private reason(action: "BUY" | "SELL" | "HOLD", key: string, differenceAmount: number, score: number) {
    const amount = Math.abs(Math.round(differenceAmount)).toLocaleString("ko-KR");
    if (action === "HOLD") {
      return `${key} 비중은 목표 범위 안에 있습니다. 거래 비용을 고려해 유지가 적합합니다.`;
    }
    if (action === "BUY") {
      return `${key} 비중이 목표보다 낮습니다. 약 ${amount}원 매수를 검토하세요. 추천 점수는 ${score}점입니다.`;
    }
    return `${key} 비중이 목표보다 높습니다. 약 ${amount}원 매도를 검토하세요. 세금 영향을 함께 확인하세요.`;
  }
}
