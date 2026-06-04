import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AuthGuard } from "./guards/auth.guard";
import type { AuthenticatedUser } from "./oauth.types";
import { AuthService } from "./auth.service";

@Controller(["auth", "api/auth"])
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(body.email, body.password, response);
  }

  @Get("kakao")
  kakao(@Res() response: Response) {
    return this.authService.startOAuth("KAKAO", response);
  }

  @Get("kakao/callback")
  kakaoCallback(
    @Query() query: { code?: string; state?: string; error?: string; error_description?: string },
    @Req() request: Request,
    @Res() response: Response
  ) {
    return this.authService.completeOAuth("KAKAO", query, request, response);
  }

  @Get("naver")
  naver(@Res() response: Response) {
    return this.authService.startOAuth("NAVER", response);
  }

  @Get("naver/callback")
  naverCallback(
    @Query() query: { code?: string; state?: string; error?: string; error_description?: string },
    @Req() request: Request,
    @Res() response: Response
  ) {
    return this.authService.completeOAuth("NAVER", query, request, response);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    return this.authService.logout(response);
  }
}
