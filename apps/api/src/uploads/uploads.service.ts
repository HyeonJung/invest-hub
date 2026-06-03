import { BadRequestException, Injectable } from "@nestjs/common";
import { AccountType, Broker, SourceType } from "@prisma/client";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { PrismaService } from "../prisma/prisma.service";

type RawRow = Record<string, unknown>;

type NormalizedUploadRow = {
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

const columnCandidates: Record<string, string[]> = {
  symbol: ["종목코드", "코드", "symbol", "ticker", "티커"],
  name: ["종목명", "이름", "name", "상품명"],
  currency: ["통화", "currency", "통화코드"],
  quantity: ["수량", "보유수량", "quantity", "잔고수량"],
  averagePurchasePrice: ["평균매수가", "평균단가", "매입단가", "averagePurchasePrice", "평단"],
  marketPrice: ["현재가", "평가단가", "marketPrice", "lastPrice"],
  marketValue: ["평가금액", "평가액", "marketValue"],
  costAmount: ["매입금액", "매입액", "costAmount", "투자원금"],
  profitLoss: ["손익", "평가손익", "profitLoss", "손익금액"]
};

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  preview(file: Express.Multer.File | undefined, broker: string, accountType: string) {
    if (!file) {
      throw new BadRequestException("업로드할 파일을 선택하세요.");
    }

    const rows = this.parseFile(file);
    if (rows.length === 0) {
      throw new BadRequestException("파일에 읽을 수 있는 행이 없습니다.");
    }

    const mapping = this.detectMapping(Object.keys(rows[0] ?? {}));
    const normalizedRows = rows.slice(0, 200).map((row) => this.normalize(row, mapping));
    const validation = {
      totalRows: normalizedRows.length,
      validRows: normalizedRows.filter((row) => row.status === "VALID").length,
      warningRows: normalizedRows.filter((row) => row.status === "WARNING").length,
      errorRows: normalizedRows.filter((row) => row.status === "ERROR").length,
      messages: this.validationMessages(normalizedRows)
    };

    return {
      importId: crypto.randomUUID(),
      mapping,
      rows: rows.slice(0, 20),
      normalizedRows,
      validation,
      broker,
      accountType
    };
  }

  async commit(
    userId: string,
    body: {
      broker: "TOSS" | "NAMUH" | "KIWOOM";
      accountType: string;
      accountAlias: string;
      rows: NormalizedUploadRow[];
    }
  ) {
    const validRows = body.rows.filter((row) => row.status !== "ERROR");
    if (validRows.length === 0) {
      throw new BadRequestException("저장 가능한 행이 없습니다.");
    }

    const account = await this.prisma.investmentAccount.upsert({
      where: {
        id: await this.findOrCreateStableAccountId(userId, body.broker, body.accountAlias)
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        broker: body.broker as Broker,
        accountAlias: body.accountAlias,
        accountType: parseAccountType(body.accountType),
        currencyBase: "KRW",
        externalAccountId: `${body.broker}-${body.accountAlias}`
      },
      update: {
        accountType: parseAccountType(body.accountType)
      }
    });

    await this.prisma.holding.deleteMany({ where: { accountId: account.id } });

    for (const row of validRows) {
      const security = await this.prisma.security.upsert({
        where: {
          symbol_marketCountry: {
            symbol: row.symbol,
            marketCountry: row.marketCountry
          }
        },
        create: {
          symbol: row.symbol,
          name: row.name,
          marketCountry: row.marketCountry,
          currency: row.currency,
          assetType: row.assetType,
          riskType: null
        },
        update: {
          name: row.name,
          currency: row.currency,
          assetType: row.assetType
        }
      });

      const costAmount = row.costAmount || row.averagePurchasePrice * row.quantity;
      const marketValue = row.marketValue || row.marketPrice * row.quantity;
      const profitLoss = row.profitLoss || marketValue - costAmount;

      await this.prisma.holding.create({
        data: {
          accountId: account.id,
          securityId: security.id,
          quantity: row.quantity,
          averagePurchasePrice: row.averagePurchasePrice,
          marketPrice: row.marketPrice,
          marketValue,
          costAmount,
          profitLoss,
          profitLossRate: costAmount > 0 ? (profitLoss / costAmount) * 100 : 0,
          annualDividendEstimate: estimateDividend(row.assetType, marketValue),
          sourceType: fileSource(body.broker)
        }
      });
    }

    await this.prisma.brokerConnection.upsert({
      where: {
        id: await this.findOrCreateStableConnectionId(userId, body.broker)
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        broker: body.broker as Broker,
        connectionType: "CSV",
        status: "ACTIVE",
        lastSyncedAt: new Date()
      },
      update: {
        connectionType: "CSV",
        status: "ACTIVE",
        lastSyncedAt: new Date()
      }
    });

    return { saved: validRows.length, accountId: account.id };
  }

  private parseFile(file: Express.Multer.File): RawRow[] {
    const name = file.originalname.toLowerCase();
    if (name.endsWith(".csv")) {
      return parse(file.buffer.toString("utf8"), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
      }) as RawRow[];
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as RawRow[];
    }

    throw new BadRequestException("CSV 또는 XLSX 파일만 업로드할 수 있습니다.");
  }

  private detectMapping(headers: string[]) {
    const mapping: Record<string, string> = {};
    for (const [field, candidates] of Object.entries(columnCandidates)) {
      const found = headers.find((header) =>
        candidates.some((candidate) => header.toLowerCase().replace(/\s/g, "") === candidate.toLowerCase().replace(/\s/g, ""))
      );
      if (found) {
        mapping[field] = found;
      }
    }
    return mapping;
  }

  private normalize(row: RawRow, mapping: Record<string, string>): NormalizedUploadRow {
    const symbol = readString(row, mapping.symbol).replace(/^A/i, "");
    const name = readString(row, mapping.name) || symbol;
    const quantity = readNumber(row, mapping.quantity);
    const averagePurchasePrice = readNumber(row, mapping.averagePurchasePrice);
    const marketPrice = readNumber(row, mapping.marketPrice);
    const marketValue = readNumber(row, mapping.marketValue) || quantity * marketPrice;
    const costAmount = readNumber(row, mapping.costAmount) || quantity * averagePurchasePrice;
    const profitLoss = readNumber(row, mapping.profitLoss) || marketValue - costAmount;
    const currency = readString(row, mapping.currency) || inferCurrency(symbol);
    const marketCountry = inferMarketCountry(symbol, currency);
    const assetType = inferAssetType(symbol, name);
    const errors: string[] = [];

    if (!symbol) errors.push("종목 코드가 없습니다.");
    if (!Number.isFinite(quantity) || quantity <= 0) errors.push("보유 수량이 올바르지 않습니다.");
    if (!Number.isFinite(marketValue) || marketValue <= 0) errors.push("평가금액이 올바르지 않습니다.");
    if (!currency) errors.push("통화를 판단할 수 없습니다.");

    const status = errors.length > 0 ? "ERROR" : mapping.averagePurchasePrice ? "VALID" : "WARNING";
    if (status === "WARNING") errors.push("평균 매수가가 없어 일부 수익률은 추정됩니다.");

    return {
      symbol,
      name,
      currency,
      quantity,
      averagePurchasePrice,
      marketPrice,
      marketValue,
      costAmount,
      profitLoss,
      assetType,
      marketCountry,
      status,
      errors
    };
  }

  private validationMessages(rows: NormalizedUploadRow[]) {
    const messages = new Set<string>();
    rows.forEach((row) => row.errors.forEach((error) => messages.add(error)));
    if (messages.size === 0) {
      messages.add("모든 행이 정상적으로 검증되었습니다.");
    }
    return Array.from(messages);
  }

  private async findOrCreateStableAccountId(userId: string, broker: string, alias: string) {
    const existing = await this.prisma.investmentAccount.findFirst({
      where: { userId, broker: broker as Broker, accountAlias: alias }
    });
    return existing?.id ?? crypto.randomUUID();
  }

  private async findOrCreateStableConnectionId(userId: string, broker: string) {
    const existing = await this.prisma.brokerConnection.findFirst({
      where: { userId, broker: broker as Broker }
    });
    return existing?.id ?? crypto.randomUUID();
  }
}

function readString(row: RawRow, key?: string) {
  if (!key) return "";
  const value = row[key];
  return value == null ? "" : String(value).trim();
}

function readNumber(row: RawRow, key?: string) {
  if (!key) return 0;
  const value = row[key];
  if (typeof value === "number") return value;
  return Number(String(value ?? "0").replace(/[,\s원$]/g, ""));
}

function inferCurrency(symbol: string) {
  return /^\d{6}$/.test(symbol) ? "KRW" : "USD";
}

function inferMarketCountry(symbol: string, currency: string) {
  if (/^\d{6}$/.test(symbol) || currency === "KRW") return "KR";
  return "US";
}

function inferAssetType(symbol: string, name: string) {
  const text = `${symbol} ${name}`.toUpperCase();
  if (text.includes("ETF") || ["VOO", "SCHD", "QQQ", "SPY", "IVV"].some((ticker) => text.includes(ticker))) {
    return "ETF";
  }
  return "STOCK";
}

function parseAccountType(accountType: string): AccountType {
  if (accountType === "ISA") return "ISA";
  if (accountType === "PENSION_SAVINGS") return "PENSION_SAVINGS";
  return "BROKERAGE";
}

function fileSource(broker: string): SourceType {
  return broker === "TOSS" ? "API" : "CSV";
}

function estimateDividend(assetType: string, marketValue: number) {
  return marketValue * (assetType === "ETF" ? 0.025 : 0.008);
}
