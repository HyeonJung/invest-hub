import { Controller, Get, Headers, Param } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { PortfolioService } from "./portfolio.service";

@Controller("portfolio")
export class PortfolioController {
  constructor(
    private readonly authService: AuthService,
    private readonly portfolioService: PortfolioService
  ) {}

  @Get("summary")
  async summary(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.portfolioService.getSummary(userId);
  }

  @Get("brokers/:broker")
  async broker(@Param("broker") broker: string, @Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.portfolioService.getBrokerPortfolio(userId, broker);
  }
}
