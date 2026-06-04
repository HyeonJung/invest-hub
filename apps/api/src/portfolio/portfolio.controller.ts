import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import type { AuthenticatedUser } from "../auth/oauth.types";
import { PortfolioService } from "./portfolio.service";

@Controller("portfolio")
@UseGuards(AuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get("summary")
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return this.portfolioService.getSummary(user.id);
  }

  @Get("brokers/:broker")
  async broker(@Param("broker") broker: string, @CurrentUser() user: AuthenticatedUser) {
    return this.portfolioService.getBrokerPortfolio(user.id, broker);
  }
}
