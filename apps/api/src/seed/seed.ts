import { PrismaClient, Broker, AccountType, SourceType } from "@prisma/client";

const prisma = new PrismaClient();

type SeedHolding = {
  broker: Broker;
  accountAlias: string;
  accountType: AccountType;
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  assetType: string;
  quantity: number;
  marketValue: number;
  profitLoss: number;
  dividendRate: number;
};

const holdings: SeedHolding[] = [
  {
    broker: "TOSS",
    accountAlias: "토스증권",
    accountType: "BROKERAGE",
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    marketCountry: "US",
    currency: "USD",
    assetType: "ETF",
    quantity: 25,
    marketValue: 32560000,
    profitLoss: 3560000,
    dividendRate: 0.014
  },
  {
    broker: "TOSS",
    accountAlias: "토스증권",
    accountType: "BROKERAGE",
    symbol: "AAPL",
    name: "애플",
    marketCountry: "US",
    currency: "USD",
    assetType: "STOCK",
    quantity: 12,
    marketValue: 7920000,
    profitLoss: 602000,
    dividendRate: 0.005
  },
  {
    broker: "TOSS",
    accountAlias: "토스증권",
    accountType: "BROKERAGE",
    symbol: "MSFT",
    name: "마이크로소프트",
    marketCountry: "US",
    currency: "USD",
    assetType: "STOCK",
    quantity: 5,
    marketValue: 2980000,
    profitLoss: 390000,
    dividendRate: 0.008
  },
  {
    broker: "TOSS",
    accountAlias: "토스증권",
    accountType: "BROKERAGE",
    symbol: "SCHD",
    name: "Schwab U.S. Dividend Equity ETF",
    marketCountry: "US",
    currency: "USD",
    assetType: "ETF",
    quantity: 18,
    marketValue: 7850000,
    profitLoss: 503000,
    dividendRate: 0.036
  },
  {
    broker: "TOSS",
    accountAlias: "토스증권",
    accountType: "BROKERAGE",
    symbol: "005930",
    name: "삼성전자",
    marketCountry: "KR",
    currency: "KRW",
    assetType: "STOCK",
    quantity: 84,
    marketValue: 6200000,
    profitLoss: -136000,
    dividendRate: 0.018
  },
  {
    broker: "TOSS",
    accountAlias: "토스증권",
    accountType: "BROKERAGE",
    symbol: "NVDA",
    name: "엔비디아",
    marketCountry: "US",
    currency: "USD",
    assetType: "STOCK",
    quantity: 10,
    marketValue: 4320000,
    profitLoss: 820000,
    dividendRate: 0.001
  },
  {
    broker: "TOSS",
    accountAlias: "토스증권",
    accountType: "BROKERAGE",
    symbol: "QQQ",
    name: "Invesco QQQ ETF",
    marketCountry: "US",
    currency: "USD",
    assetType: "ETF",
    quantity: 16,
    marketValue: 11090000,
    profitLoss: 1218000,
    dividendRate: 0.006
  },
  {
    broker: "TOSS",
    accountAlias: "토스증권",
    accountType: "BROKERAGE",
    symbol: "TIGER-US",
    name: "TIGER 미국S&P500",
    marketCountry: "KR",
    currency: "KRW",
    assetType: "ETF",
    quantity: 700,
    marketValue: 10020000,
    profitLoss: 855000,
    dividendRate: 0.01
  },
  {
    broker: "NAMUH",
    accountAlias: "나무증권",
    accountType: "ISA",
    symbol: "AAPL",
    name: "애플",
    marketCountry: "US",
    currency: "USD",
    assetType: "STOCK",
    quantity: 13,
    marketValue: 5280000,
    profitLoss: 395000,
    dividendRate: 0.005
  },
  {
    broker: "NAMUH",
    accountAlias: "나무증권",
    accountType: "ISA",
    symbol: "MSFT",
    name: "마이크로소프트",
    marketCountry: "US",
    currency: "USD",
    assetType: "STOCK",
    quantity: 10,
    marketValue: 5970000,
    profitLoss: 760000,
    dividendRate: 0.008
  },
  {
    broker: "NAMUH",
    accountAlias: "나무증권",
    accountType: "ISA",
    symbol: "KODEX-200",
    name: "KODEX 200",
    marketCountry: "KR",
    currency: "KRW",
    assetType: "ETF",
    quantity: 210,
    marketValue: 7950000,
    profitLoss: 310000,
    dividendRate: 0.012
  },
  {
    broker: "NAMUH",
    accountAlias: "나무증권",
    accountType: "ISA",
    symbol: "SCHD",
    name: "Schwab U.S. Dividend Equity ETF",
    marketCountry: "US",
    currency: "USD",
    assetType: "ETF",
    quantity: 8,
    marketValue: 3480000,
    profitLoss: 170000,
    dividendRate: 0.036
  },
  {
    broker: "NAMUH",
    accountAlias: "나무증권",
    accountType: "ISA",
    symbol: "005930",
    name: "삼성전자",
    marketCountry: "KR",
    currency: "KRW",
    assetType: "STOCK",
    quantity: 100,
    marketValue: 6120000,
    profitLoss: -82000,
    dividendRate: 0.018
  },
  {
    broker: "KIWOOM",
    accountAlias: "키움(영웅문)",
    accountType: "BROKERAGE",
    symbol: "AAPL",
    name: "애플",
    marketCountry: "US",
    currency: "USD",
    assetType: "STOCK",
    quantity: 10,
    marketValue: 4000000,
    profitLoss: 290000,
    dividendRate: 0.005
  },
  {
    broker: "KIWOOM",
    accountAlias: "키움(영웅문)",
    accountType: "BROKERAGE",
    symbol: "NVDA",
    name: "엔비디아",
    marketCountry: "US",
    currency: "USD",
    assetType: "STOCK",
    quantity: 0,
    marketValue: 0,
    profitLoss: 0,
    dividendRate: 0.001
  },
  {
    broker: "KIWOOM",
    accountAlias: "키움(영웅문)",
    accountType: "BROKERAGE",
    symbol: "MSFT",
    name: "마이크로소프트",
    marketCountry: "US",
    currency: "USD",
    assetType: "STOCK",
    quantity: 0,
    marketValue: 0,
    profitLoss: 0,
    dividendRate: 0.008
  },
  {
    broker: "KIWOOM",
    accountAlias: "키움(영웅문)",
    accountType: "BROKERAGE",
    symbol: "TIGER-DIV",
    name: "TIGER 미국배당다우존스",
    marketCountry: "KR",
    currency: "KRW",
    assetType: "ETF",
    quantity: 540,
    marketValue: 7250000,
    profitLoss: 210000,
    dividendRate: 0.028
  },
  {
    broker: "KIWOOM",
    accountAlias: "키움(영웅문)",
    accountType: "BROKERAGE",
    symbol: "QQQ",
    name: "Invesco QQQ ETF",
    marketCountry: "US",
    currency: "USD",
    assetType: "ETF",
    quantity: 9,
    marketValue: 6420000,
    profitLoss: 530000,
    dividendRate: 0.006
  },
  {
    broker: "KIWOOM",
    accountAlias: "키움(영웅문)",
    accountType: "BROKERAGE",
    symbol: "005930",
    name: "삼성전자",
    marketCountry: "KR",
    currency: "KRW",
    assetType: "STOCK",
    quantity: 75,
    marketValue: 5400000,
    profitLoss: -180000,
    dividendRate: 0.018
  }
];

async function main() {
  await prisma.holding.deleteMany();
  await prisma.security.deleteMany();
  await prisma.accountApiCredential.deleteMany();
  await prisma.investmentAccount.deleteMany();
  await prisma.brokerCredential.deleteMany();
  await prisma.brokerConnection.deleteMany();
  await prisma.portfolioTarget.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: "demo@investhub.kr",
      name: "김투자",
      passwordHash: "demo123",
      plan: "PREMIUM",
      role: "ADMIN"
    }
  });

  for (const broker of ["TOSS", "NAMUH", "KIWOOM"] as Broker[]) {
    await prisma.brokerConnection.create({
      data: {
        userId: user.id,
        broker,
        connectionType: broker === "TOSS" ? "API" : "CSV",
        status: "ACTIVE",
        lastSyncedAt: new Date("2024-05-20T09:30:00+09:00"),
        credential:
          broker === "TOSS"
            ? {
                create: {
                  clientId: "demo_client",
                  encryptedSecret: "encrypted_demo_secret",
                  metadata: { mode: "mock" }
                }
              }
            : undefined
      }
    });
  }

  const accountMap = new Map<string, string>();
  for (const item of holdings.filter((holding) => holding.marketValue > 0)) {
    const key = `${item.broker}:${item.accountAlias}`;
    if (!accountMap.has(key)) {
      const account = await prisma.investmentAccount.create({
        data: {
          userId: user.id,
          broker: item.broker,
          accountAlias: item.accountAlias,
          accountType: item.accountType,
          externalAccountId: `${item.broker}-001`,
          currencyBase: "KRW"
        }
      });
      accountMap.set(key, account.id);
    }

    const security = await prisma.security.upsert({
      where: {
        symbol_marketCountry: {
          symbol: item.symbol,
          marketCountry: item.marketCountry
        }
      },
      create: {
        symbol: item.symbol,
        name: item.name,
        marketCountry: item.marketCountry,
        currency: item.currency,
        assetType: item.assetType,
        riskType: item.symbol.includes("TIGER") ? "ETF_DOMESTIC" : null
      },
      update: {
        name: item.name,
        assetType: item.assetType
      }
    });

    const costAmount = item.marketValue - item.profitLoss;
    const averagePurchasePrice = item.quantity > 0 ? costAmount / item.quantity : 0;
    const marketPrice = item.quantity > 0 ? item.marketValue / item.quantity : 0;

    await prisma.holding.create({
      data: {
        accountId: accountMap.get(key)!,
        securityId: security.id,
        quantity: item.quantity,
        averagePurchasePrice,
        marketPrice,
        marketValue: item.marketValue,
        costAmount,
        profitLoss: item.profitLoss,
        profitLossRate: costAmount > 0 ? (item.profitLoss / costAmount) * 100 : 0,
        annualDividendEstimate: item.marketValue * item.dividendRate,
        sourceType: item.broker === "TOSS" ? SourceType.API : SourceType.CSV
      }
    });
  }

  await prisma.portfolioTarget.createMany({
    data: [
      { userId: user.id, targetType: "ASSET", targetKey: "해외 주식", targetWeight: 55 },
      { userId: user.id, targetType: "ASSET", targetKey: "국내 주식", targetWeight: 25 },
      { userId: user.id, targetType: "ASSET", targetKey: "ETF", targetWeight: 55 },
      { userId: user.id, targetType: "ASSET", targetKey: "개별주", targetWeight: 40 }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("시드 데이터 생성이 완료되었습니다.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
