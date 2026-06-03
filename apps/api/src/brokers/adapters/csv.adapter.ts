import { BadRequestException, Injectable } from "@nestjs/common";
import { Broker } from "@prisma/client";
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
export class CsvAdapter implements BrokerAdapter {
  readonly broker = Broker.MANUAL;

  async connect(): Promise<BrokerConnectResult> {
    throw new BadRequestException("CSV 연결은 업로드 관리 화면에서 파일 검증 후 저장합니다.");
  }

  async refreshToken(): Promise<string> {
    throw new BadRequestException("CSV 연결은 토큰을 사용하지 않습니다.");
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

  async syncAll(): Promise<BrokerSyncResult> {
    throw new BadRequestException("CSV 연결은 업로드 저장으로 동기화합니다.");
  }
}
