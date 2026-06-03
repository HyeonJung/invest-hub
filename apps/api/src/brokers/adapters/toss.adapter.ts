import { BadRequestException, Injectable } from "@nestjs/common";
import { Broker } from "@prisma/client";
import { TossOpenApiService } from "../toss-open-api.service";
import {
  BrokerAdapter,
  BrokerCashBalance,
  BrokerConnectResult,
  BrokerHolding,
  BrokerPortfolioValue,
  BrokerQuote,
  BrokerSyncResult
} from "./broker-adapter";

@Injectable()
export class TossAdapter implements BrokerAdapter {
  readonly broker = Broker.TOSS;

  constructor(private readonly tossOpenApiService: TossOpenApiService) {}

  async connect(userId: string): Promise<BrokerConnectResult> {
    const result = await this.tossOpenApiService.syncHoldings(userId);
    return {
      broker: this.broker,
      connected: true,
      accounts: [],
      selectedAccountNo: null,
      message: `토스증권 ${result.accounts}개 계좌를 연결했습니다.`
    };
  }

  async refreshToken(): Promise<string> {
    throw new BadRequestException("토스증권 토큰은 동기화 시점에 새로 발급합니다.");
  }

  async getAccounts(): Promise<[]> {
    return [];
  }

  async getHoldings(): Promise<BrokerHolding[]> {
    return [];
  }

  async getCashBalance(): Promise<BrokerCashBalance> {
    return { cashKrw: 0, orderableCashKrw: 0, currencyBalances: [] };
  }

  async getPortfolioValue(): Promise<BrokerPortfolioValue> {
    return { totalPurchaseAmount: 0, totalMarketValue: 0, totalProfitLoss: 0, totalReturnRate: 0 };
  }

  async getQuotes(): Promise<Map<string, BrokerQuote>> {
    return new Map();
  }

  async getMarketData(): Promise<Map<string, BrokerQuote>> {
    return new Map();
  }

  async syncAll(userId: string): Promise<BrokerSyncResult> {
    const result = await this.tossOpenApiService.syncHoldings(userId);
    return {
      broker: this.broker,
      accounts: result.accounts,
      saved: result.saved,
      syncedAt: new Date().toISOString()
    };
  }
}
