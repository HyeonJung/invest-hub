import { Body, Controller, Post, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthService } from "../auth/auth.service";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(
    private readonly authService: AuthService,
    private readonly uploadsService: UploadsService
  ) {}

  @Post("preview")
  @UseInterceptors(FileInterceptor("file"))
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { broker: string; accountType: string },
    @Req() request: Request
  ) {
    await this.authService.userIdFromRequest(request);
    return this.uploadsService.preview(file, body.broker, body.accountType);
  }

  @Post("commit")
  async commit(
    @Body()
    body: {
      broker: "TOSS" | "NAMUH" | "KIWOOM";
      accountType: string;
      accountAlias: string;
      rows: NormalizedUploadRow[];
    },
    @Req() request: Request
  ) {
    const userId = await this.authService.userIdFromRequest(request);
    return this.uploadsService.commit(userId, body);
  }
}

type NormalizedUploadRow = {
  symbol: string;
  name: string;
  currency: string;
  quantity: number;
  averagePurchasePrice: number;
  marketPrice: number;
  marketValue: number;
  costAmount: number;
  profitLoss: number;
  assetType: string;
  marketCountry: string;
  status: "VALID" | "WARNING" | "ERROR";
  errors: string[];
};
