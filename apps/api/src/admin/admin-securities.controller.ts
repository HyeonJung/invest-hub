import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import { AdminLogoPayload, AdminSecuritiesQuery, AdminSecuritiesService } from "./admin-securities.service";

@Controller("api/admin/securities")
@UseGuards(AuthGuard, AdminGuard)
export class AdminSecuritiesController {
  constructor(private readonly adminSecuritiesService: AdminSecuritiesService) {}

  @Get()
  list(@Query() query: AdminSecuritiesQuery) {
    return this.adminSecuritiesService.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.adminSecuritiesService.get(id);
  }

  @Patch(":id/logo")
  updateLogo(@Param("id") id: string, @Body() body: AdminLogoPayload) {
    return this.adminSecuritiesService.updateLogo(id, body);
  }

  @Post(":id/logo/upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 1024 * 1024 } }))
  uploadLogo(@Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.adminSecuritiesService.uploadLogo(id, file);
  }

  @Post(":id/logo/refresh")
  refreshLogo(@Param("id") id: string) {
    return this.adminSecuritiesService.refreshLogo(id);
  }

  @Delete(":id/logo")
  deleteLogo(@Param("id") id: string) {
    return this.adminSecuritiesService.deleteLogo(id);
  }
}
