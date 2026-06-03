import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MarketIndicatorsModule } from "../market-indicators/market-indicators.module";
import { PortfolioController } from "./portfolio.controller";
import { PortfolioService } from "./portfolio.service";

@Module({
  imports: [AuthModule, MarketIndicatorsModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService]
})
export class PortfolioModule {}
