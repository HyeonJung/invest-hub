import { Controller, Get, Post } from "@nestjs/common";
import { MarketIndicatorsService } from "./market-indicators.service";

@Controller(["market-indicators", "api/market-indicators"])
export class MarketIndicatorsController {
  constructor(private readonly marketIndicatorsService: MarketIndicatorsService) {}

  @Get()
  async list() {
    return this.marketIndicatorsService.getIndicators();
  }

  @Get("exchange-rate")
  async exchangeRate() {
    return this.marketIndicatorsService.getExchangeRate();
  }

  @Post("refresh")
  async refresh() {
    return this.marketIndicatorsService.refreshIndicators();
  }
}
