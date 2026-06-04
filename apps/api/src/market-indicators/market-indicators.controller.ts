import { Controller, Get, Headers, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { MarketIndicatorsService } from "./market-indicators.service";

@Controller(["market-indicators", "api/market-indicators"])
export class MarketIndicatorsController {
  constructor(
    private readonly authService: AuthService,
    private readonly marketIndicatorsService: MarketIndicatorsService
  ) {}

  @Get()
  async list(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.marketIndicatorsService.getIndicators(userId);
  }

  @Get("exchange-rate")
  async exchangeRate(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.marketIndicatorsService.getExchangeRate(userId);
  }

  @Post("refresh")
  async refresh(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.marketIndicatorsService.refreshIndicators(true, userId);
  }
}
