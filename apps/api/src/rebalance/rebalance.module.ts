import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PortfolioModule } from "../portfolio/portfolio.module";
import { RebalanceController } from "./rebalance.controller";
import { RebalanceService } from "./rebalance.service";

@Module({
  imports: [AuthModule, PortfolioModule],
  controllers: [RebalanceController],
  providers: [RebalanceService]
})
export class RebalanceModule {}
