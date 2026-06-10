import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CsvAdapter } from "./adapters/csv.adapter";
import { KiwoomRestAdapter } from "./adapters/kiwoom-rest.adapter";
import { NamuhOpenApiAdapter } from "./adapters/namuh-open-api.adapter";
import { TossAdapter } from "./adapters/toss.adapter";
import { UpbitExchangeAdapter } from "./adapters/upbit-exchange.adapter";
import { BrokersController } from "./brokers.controller";
import { TossOpenApiService } from "./toss-open-api.service";

@Module({
  imports: [AuthModule],
  controllers: [BrokersController],
  providers: [TossOpenApiService, TossAdapter, KiwoomRestAdapter, NamuhOpenApiAdapter, UpbitExchangeAdapter, CsvAdapter],
  exports: [TossOpenApiService, TossAdapter, KiwoomRestAdapter, NamuhOpenApiAdapter, UpbitExchangeAdapter, CsvAdapter]
})
export class BrokersModule {}
