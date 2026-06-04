import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BrokersModule } from "../brokers/brokers.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CachedMarketDataService } from "./cached-market-data.service";
import { MarketIndicatorsController } from "./market-indicators.controller";
import { MarketIndicatorsService } from "./market-indicators.service";
import { MockMarketDataProvider } from "./mock-market-data.provider";
import { RealMarketDataProvider } from "./real-market-data.provider";

@Module({
  imports: [PrismaModule, AuthModule, BrokersModule],
  controllers: [MarketIndicatorsController],
  providers: [
    MarketIndicatorsService,
    CachedMarketDataService,
    MockMarketDataProvider,
    RealMarketDataProvider
  ],
  exports: [MarketIndicatorsService]
})
export class MarketIndicatorsModule {}
