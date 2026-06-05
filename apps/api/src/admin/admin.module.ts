import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SecuritiesModule } from "../securities/securities.module";
import { AdminSecuritiesController } from "./admin-securities.controller";
import { AdminSecuritiesService } from "./admin-securities.service";
import { LogoFilesController } from "./logo-files.controller";

@Module({
  imports: [AuthModule, SecuritiesModule],
  controllers: [AdminSecuritiesController, LogoFilesController],
  providers: [AdminSecuritiesService]
})
export class AdminModule {}
