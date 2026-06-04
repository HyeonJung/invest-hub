import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import type { AuthenticatedUser } from "../auth/oauth.types";
import { KiwoomRestAdapter } from "./adapters/kiwoom-rest.adapter";
import { NamuhOpenApiAdapter } from "./adapters/namuh-open-api.adapter";
import { TossOpenApiService } from "./toss-open-api.service";

@Controller("brokers")
@UseGuards(AuthGuard)
export class BrokersController {
  constructor(
    private readonly tossOpenApiService: TossOpenApiService,
    private readonly kiwoomRestAdapter: KiwoomRestAdapter,
    private readonly namuhOpenApiAdapter: NamuhOpenApiAdapter
  ) {}

  @Post("toss/sync")
  async syncToss(
    @Body() body: { accountId?: string; clientId?: string; clientSecret?: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.tossOpenApiService.syncHoldings(user.id, body.clientId, body.clientSecret, body.accountId);
  }

  @Get("kiwoom/status")
  async kiwoomStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.kiwoomRestAdapter.getConnectionStatus(user.id);
  }

  @Get("kiwoom/accounts")
  async kiwoomAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.kiwoomRestAdapter.getAccounts(user.id);
  }

  @Post("kiwoom/connect")
  async connectKiwoom(
    @Body() body: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.kiwoomRestAdapter.connect(user.id, {
      accountNo: body.accountNo,
      accountNos: body.accountNos,
      connectAll: body.connectAll,
      credentialId: body.credentialId
    });
  }

  @Post("kiwoom/sync")
  async syncKiwoom(
    @Body() body: { accountNo?: string; credentialId?: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.kiwoomRestAdapter.syncAll(user.id, { accountNo: body.accountNo, credentialId: body.credentialId });
  }

  @Get("namuh/status")
  async namuhStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.namuhOpenApiAdapter.getConnectionStatus(user.id);
  }

  @Get("namuh/accounts")
  async namuhAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.namuhOpenApiAdapter.getAccounts(user.id);
  }

  @Post("namuh/connect")
  async connectNamuh(
    @Body() body: { accountNo?: string; accountNos?: string[]; connectAll?: boolean; credentialId?: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.namuhOpenApiAdapter.connect(user.id, {
      accountNo: body.accountNo,
      accountNos: body.accountNos,
      connectAll: body.connectAll,
      credentialId: body.credentialId
    });
  }

  @Post("namuh/sync")
  async syncNamuh(
    @Body() body: { accountNo?: string; credentialId?: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.namuhOpenApiAdapter.syncAll(user.id, { accountNo: body.accountNo, credentialId: body.credentialId });
  }
}
