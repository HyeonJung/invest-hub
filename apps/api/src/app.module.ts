import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { BrokersModule } from "./brokers/brokers.module";
import { MarketIndicatorsModule } from "./market-indicators/market-indicators.module";
import { PortfolioModule } from "./portfolio/portfolio.module";
import { PricesModule } from "./prices/prices.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RebalanceModule } from "./rebalance/rebalance.module";
import { SecuritiesModule } from "./securities/securities.module";
import { SettingsModule } from "./settings/settings.module";
import { UploadsModule } from "./uploads/uploads.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BrokersModule,
    MarketIndicatorsModule,
    PortfolioModule,
    PricesModule,
    UploadsModule,
    RebalanceModule,
    SecuritiesModule,
    SettingsModule
  ]
})
export class AppModule {}
