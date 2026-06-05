import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { logoUploadDir } from "./logo-upload-paths";

@Controller("api/uploads/logos")
export class LogoFilesController {
  @Get(":fileName")
  serve(@Param("fileName") fileName: string, @Res() response: Response) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
      throw new NotFoundException("로고 파일을 찾을 수 없습니다.");
    }

    const filePath = join(logoUploadDir(), fileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException("로고 파일을 찾을 수 없습니다.");
    }

    response.type("image/png");
    createReadStream(filePath).pipe(response);
  }
}
