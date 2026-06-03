import { Body, Controller, Headers, Post } from "@nestjs/common";
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
    @Headers("authorization") authorization?: string
  ) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.rebalanceService.calculate(userId, body.targets);
  }
}
