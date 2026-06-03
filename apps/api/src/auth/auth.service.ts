import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.passwordHash !== password) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    return {
      token: Buffer.from(`invest-hub:${user.id}`).toString("base64url"),
      user: { id: user.id, email: user.email, name: user.name }
    };
  }

  async userIdFromToken(authHeader?: string) {
    if (!authHeader?.startsWith("Bearer ")) {
      return this.getDemoUserId();
    }

    try {
      const payload = Buffer.from(authHeader.replace("Bearer ", ""), "base64url").toString("utf8");
      const [, userId] = payload.split(":");
      if (userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return this.getDemoUserId();
        return userId;
      }
    } catch {
      return this.getDemoUserId();
    }

    return this.getDemoUserId();
  }

  async getDemoUserId() {
    const user = await this.prisma.user.findUnique({ where: { email: "demo@investhub.kr" } });
    if (!user) {
      throw new UnauthorizedException("데모 사용자가 없습니다. 먼저 시드 데이터를 생성하세요.");
    }
    return user.id;
  }
}
