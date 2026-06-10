import { Body, Controller, Delete, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService
  ) {}

  @Get("targets")
  async listTargets(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.listTargets(userId);
  }

  @Post("targets")
  async saveTargets(
    @Body() body: { targets: Array<{ targetType: string; targetKey: string; targetWeight: number }> },
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.saveTargets(userId, body.targets);
  }

  @Get("toss-credentials")
  async listTossCredentials(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.listTossCredentials(userId);
  }

  @Post("toss-accounts")
  async createTossAccount(
    @Body() body: { accountAlias?: string; accountType?: "BROKERAGE" | "PENSION_SAVINGS" | "ISA" | "MANUAL"; externalAccountId?: string },
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.createTossAccount(userId, body);
  }

  @Post("toss-credentials")
  async saveTossCredential(
    @Body() body: { accountId: string; clientId: string; clientSecret?: string },
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.saveTossCredential(userId, body);
  }

  @Delete("toss-credentials/:accountId")
  async deleteTossCredential(
    @Param("accountId") accountId: string,
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.deleteTossCredential(userId, accountId);
  }

  @Get("kiwoom-credential")
  async getKiwoomCredential(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.getKiwoomCredential(userId);
  }

  @Get("kiwoom-credentials")
  async listKiwoomCredentials(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.listKiwoomCredentials(userId);
  }

  @Post("kiwoom-credential")
  async saveKiwoomCredential(
    @Body() body: { connectionId?: string; label?: string; appKey: string; secretKey?: string; useMock?: boolean },
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.saveKiwoomCredential(userId, body);
  }

  @Post("kiwoom-credentials")
  async saveKiwoomCredentialProfile(
    @Body() body: { connectionId?: string; label?: string; appKey: string; secretKey?: string; useMock?: boolean },
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.saveKiwoomCredentialProfile(userId, body);
  }

  @Delete("kiwoom-credential")
  async deleteKiwoomCredential(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.deleteKiwoomCredential(userId);
  }

  @Delete("kiwoom-credentials/:connectionId")
  async deleteKiwoomCredentialProfile(
    @Param("connectionId") connectionId: string,
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.deleteKiwoomCredentialProfile(userId, connectionId);
  }

  @Get("namuh-credentials")
  async listNamuhCredentials(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.listNamuhCredentials(userId);
  }

  @Post("namuh-credentials")
  async saveNamuhCredentialProfile(
    @Body()
    body: {
      connectionId?: string;
      label?: string;
      loginId: string;
      loginPassword?: string;
      certificatePassword?: string;
      accountPassword?: string;
      certificateMode?: "PC" | "CLOUD";
      environment?: "REAL" | "MOCK";
    },
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.saveNamuhCredentialProfile(userId, body);
  }

  @Delete("namuh-credentials/:connectionId")
  async deleteNamuhCredentialProfile(
    @Param("connectionId") connectionId: string,
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.deleteNamuhCredentialProfile(userId, connectionId);
  }

  @Get("upbit-credentials")
  async listUpbitCredentials(@Req() request: Request) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.listUpbitCredentials(userId);
  }

  @Post("upbit-credentials")
  async saveUpbitCredentialProfile(
    @Body() body: { connectionId?: string; label?: string; accessKey: string; secretKey?: string },
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.saveUpbitCredentialProfile(userId, body);
  }

  @Delete("upbit-credentials/:connectionId")
  async deleteUpbitCredentialProfile(
    @Param("connectionId") connectionId: string,
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.settingsService.deleteUpbitCredentialProfile(userId, connectionId);
  }
}
