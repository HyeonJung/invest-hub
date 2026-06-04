import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./guards/auth.guard";
import { KakaoStrategy } from "./strategies/kakao.strategy";
import { NaverStrategy } from "./strategies/naver.strategy";

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, KakaoStrategy, NaverStrategy],
  exports: [AuthService, AuthGuard]
})
export class AuthModule {}
