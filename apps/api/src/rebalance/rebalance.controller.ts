import { Body, Controller, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { RebalanceService } from "./rebalance.service";

@Controller("rebalance")
export class RebalanceController {
  constructor(
    private readonly authService: AuthService,
    private readonly rebalanceService: RebalanceService
  ) {}

  @Post()
  async calculate(
    @Body() body: { targets: Array<{ targetType: string; targetKey: string; targetWeight: number }> },
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.rebalanceService.calculate(userId, body.targets);
  }
}
