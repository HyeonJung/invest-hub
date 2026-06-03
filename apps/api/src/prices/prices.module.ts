import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { KiwoomRestAdapter } from "../brokers/adapters/kiwoom-rest.adapter";
import { NamuhOpenApiAdapter } from "../brokers/adapters/namuh-open-api.adapter";
import { MarketIndicatorsModule } from "../market-indicators/market-indicators.module";
import { PricesController } from "./prices.controller";
import { PricesService } from "./prices.service";

@Module({
  imports: [AuthModule, MarketIndicatorsModule],
  controllers: [PricesController],
  providers: [PricesService, KiwoomRestAdapter, NamuhOpenApiAdapter],
  exports: [PricesService]
})
export class PricesModule {}
