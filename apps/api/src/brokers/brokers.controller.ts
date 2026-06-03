import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { KiwoomRestAdapter } from "./adapters/kiwoom-rest.adapter";
import { NamuhOpenApiAdapter } from "./adapters/namuh-open-api.adapter";
import { TossOpenApiService } from "./toss-open-api.service";

@Controller("brokers")
export class BrokersController {
  constructor(
    private readonly authService: AuthService,
    private readonly tossOpenApiService: TossOpenApiService,
    private readonly kiwoomRestAdapter: KiwoomRestAdapter,
    private readonly namuhOpenApiAdapter: NamuhOpenApiAdapter
  ) {}

  @Post("toss/sync")
  async syncToss(
    @Body() body: { accountId?: string; clientId?: string; clientSecret?: string },
    @Headers("authorization") authorization?: string
  ) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.tossOpenApiService.syncHoldings(userId, body.clientId, body.clientSecret, body.accountId);
  }

  @Get("kiwoom/status")
  async kiwoomStatus(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.kiwoomRestAdapter.getConnectionStatus(userId);
  }

  @Get("kiwoom/accounts")
  async kiwoomAccounts(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.kiwoomRestAdapter.getAccounts(userId);
  }

  @Post("kiwoom/connect")
  async connectKiwoom(
    @Body() body: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string },
    @Headers("authorization") authorization?: string
  ) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.kiwoomRestAdapter.connect(userId, {
      accountNo: body.accountNo,
      accountNos: body.accountNos,
      connectAll: body.connectAll,
      credentialId: body.credentialId
    });
  }

  @Post("kiwoom/sync")
  async syncKiwoom(
    @Body() body: { accountNo?: string; credentialId?: string },
    @Headers("authorization") authorization?: string
  ) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.kiwoomRestAdapter.syncAll(userId, { accountNo: body.accountNo, credentialId: body.credentialId });
  }

  @Get("namuh/status")
  async namuhStatus(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.namuhOpenApiAdapter.getConnectionStatus(userId);
  }

  @Get("namuh/accounts")
  async namuhAccounts(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.namuhOpenApiAdapter.getAccounts(userId);
  }

  @Post("namuh/connect")
  async connectNamuh(
    @Body() body: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string },
    @Headers("authorization") authorization?: string
  ) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.namuhOpenApiAdapter.connect(userId, {
      accountNo: body.accountNo,
      accountNos: body.accountNos,
      connectAll: body.connectAll,
      credentialId: body.credentialId
    });
  }

  @Post("namuh/sync")
  async syncNamuh(
    @Body() body: { accountNo?: string; credentialId?: string },
    @Headers("authorization") authorization?: string
  ) {
    const userId = await this.authService.userIdFromToken(authorization);
    return this.namuhOpenApiAdapter.syncAll(userId, { accountNo: body.accountNo, credentialId: body.credentialId });
  }
}
