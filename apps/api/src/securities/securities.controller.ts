import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import { StockLogoService } from "./stock-logo.service";

@Controller("api/securities")
export class SecuritiesController {
  constructor(private readonly stockLogoService: StockLogoService) {}

  @Get(":id/logo")
  logo(@Param("id") id: string) {
    return this.stockLogoService.getLogoForSecurity(id);
  }

  @Post(":id/logo/refresh")
  @UseGuards(AuthGuard, AdminGuard)
  refreshLogo(@Param("id") id: string) {
    return this.stockLogoService.refreshLogo(id);
  }
}
