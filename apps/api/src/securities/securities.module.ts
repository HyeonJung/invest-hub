import { Module } from "@nestjs/common";
import { SecuritiesController } from "./securities.controller";
import { StockLogoService } from "./stock-logo.service";

@Module({
  controllers: [SecuritiesController],
  providers: [StockLogoService],
  exports: [StockLogoService]
})
export class SecuritiesModule {}
