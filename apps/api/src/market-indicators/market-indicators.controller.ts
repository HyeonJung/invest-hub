import { Controller, Get, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { MarketIndicatorsService } from "./market-indicators.service";

@Controller(["market-indicators", "api/market-indicators"])
export class MarketIndicatorsController {
  constructor(
    private readonly authService: AuthService,
    private readonly marketIndicatorsService: MarketIndicatorsService
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.marketIndicatorsService.getIndicators(userId);
  }

  @Get("exchange-rate")
  async exchangeRate(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.marketIndicatorsService.getExchangeRate(userId);
  }

  @Post("refresh")
  async refresh(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.marketIndicatorsService.refreshIndicators(true, userId);
  }
}
