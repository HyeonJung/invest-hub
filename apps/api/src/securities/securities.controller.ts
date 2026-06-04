import { Controller, Get, Param, Post } from "@nestjs/common";
import { StockLogoService } from "./stock-logo.service";

@Controller("api/securities")
export class SecuritiesController {
  constructor(private readonly stockLogoService: StockLogoService) {}

  @Get(":id/logo")
  logo(@Param("id") id: string) {
    return this.stockLogoService.getLogoForSecurity(id);
  }

  @Post(":id/logo/refresh")
  refreshLogo(@Param("id") id: string) {
    return this.stockLogoService.refreshLogo(id);
  }
}
