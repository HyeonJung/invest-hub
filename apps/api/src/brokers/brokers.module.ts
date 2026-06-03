import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CsvAdapter } from "./adapters/csv.adapter";
import { KiwoomRestAdapter } from "./adapters/kiwoom-rest.adapter";
import { NamuhOpenApiAdapter } from "./adapters/namuh-open-api.adapter";
import { TossAdapter } from "./adapters/toss.adapter";
import { BrokersController } from "./brokers.controller";
import { TossOpenApiService } from "./toss-open-api.service";

@Module({
  imports: [AuthModule],
  controllers: [BrokersController],
  providers: [TossOpenApiService, TossAdapter, KiwoomRestAdapter, NamuhOpenApiAdapter, CsvAdapter],
  exports: [TossOpenApiService, TossAdapter, KiwoomRestAdapter, NamuhOpenApiAdapter, CsvAdapter]
})
export class BrokersModule {}
