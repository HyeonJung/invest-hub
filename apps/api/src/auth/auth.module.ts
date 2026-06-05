import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AdminGuard } from "./guards/admin.guard";
import { AuthGuard } from "./guards/auth.guard";
import { KakaoStrategy } from "./strategies/kakao.strategy";
import { NaverStrategy } from "./strategies/naver.strategy";

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AdminGuard, KakaoStrategy, NaverStrategy],
  exports: [AuthService, AuthGuard, AdminGuard]
})
export class AuthModule {}
