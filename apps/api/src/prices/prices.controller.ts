import { Controller, Get, Headers, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { PricesService } from "./prices.service";

@Controller("prices")
export class PricesController {
  constructor(
    private readonly authService: AuthService,
    private readonly pricesService: PricesService
  ) {}

  @Get("status")
  async status(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.pricesService.getStatus(userId);
  }

  @Post("refresh")
  async refresh(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.pricesService.refreshUserPrices(userId);
  }
}
