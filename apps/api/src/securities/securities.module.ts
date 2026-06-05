import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SecuritiesController } from "./securities.controller";
import { StockLogoService } from "./stock-logo.service";

@Module({
  imports: [AuthModule],
  controllers: [SecuritiesController],
  providers: [StockLogoService],
  exports: [StockLogoService]
})
export class SecuritiesModule {}
