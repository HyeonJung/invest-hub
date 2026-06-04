import { Controller, Get, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { PricesService } from "./prices.service";

@Controller("prices")
export class PricesController {
  constructor(
    private readonly authService: AuthService,
    private readonly pricesService: PricesService
  ) {}

  @Get("status")
  async status(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.pricesService.getStatus(userId);
  }

  @Post("refresh")
  async refresh(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.pricesService.refreshUserPrices(userId);
  }
}
