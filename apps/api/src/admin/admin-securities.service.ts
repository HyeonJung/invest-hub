import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LogoSource, Prisma } from "@prisma/client";
import sharp from "sharp";
import { PrismaService } from "../prisma/prisma.service";
import { StockLogoService } from "../securities/stock-logo.service";
import { logoUploadDir, logoUploadUrl } from "./logo-upload-paths";

const MAX_LOGO_FILE_SIZE = 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export type AdminSecuritiesQuery = {
  q?: string;
  marketCountry?: string;
  limit?: string;
};

export type AdminLogoPayload = {
  name?: string;
  marketCountry?: string;
  companyDomain?: string | null;
  logoUrl?: string | null;
  logoSource?: LogoSource | null;
};

@Injectable()
export class AdminSecuritiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockLogoService: StockLogoService
  ) {}

  async list(query: AdminSecuritiesQuery) {
    const q = query.q?.trim();
    const marketCountry = normalizeMarketCountry(query.marketCountry);
    const limit = clamp(Number(query.limit ?? 80), 1, 150);
    const where: Prisma.SecurityWhereInput = {
      ...(marketCountry ? { marketCountry } : {}),
      ...(q
        ? {
            OR: [
              { symbol: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { companyDomain: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.security.findMany({
        where,
        orderBy: [{ marketCountry: "asc" }, { symbol: "asc" }],
        take: limit
      }),
      this.prisma.security.count({ where })
    ]);

    return {
      total,
      limit,
      items: items.map(toAdminSecurity)
    };
  }

  async get(id: string) {
    const security = await this.prisma.security.findUnique({ where: { id } });
    if (!security) throw new NotFoundException("종목을 찾을 수 없습니다.");
    return toAdminSecurity(security);
  }

  async updateLogo(id: string, payload: AdminLogoPayload) {
    await this.assertSecurity(id);
    const logoUrl = normalizeNullableString(payload.logoUrl);
    const companyDomain = normalizeNullableString(payload.companyDomain);
    const updateData: Prisma.SecurityUpdateInput = {
      ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
      ...(payload.marketCountry?.trim() ? { marketCountry: payload.marketCountry.trim().toUpperCase() } : {}),
      ...(companyDomain !== undefined ? { companyDomain } : {}),
      ...(logoUrl !== undefined
        ? {
            logoUrl,
            logoSource: normalizeLogoSource(payload.logoSource, logoUrl),
            logoLastCheckedAt: new Date(),
            logoFailedAt: logoUrl ? null : new Date()
          }
        : payload.logoSource
          ? { logoSource: payload.logoSource }
          : {})
    };

    const updated = await this.prisma.security.update({
      where: { id },
      data: updateData
    });
    return toAdminSecurity(updated);
  }

  async uploadLogo(id: string, file?: Express.Multer.File) {
    const security = await this.assertSecurity(id);
    if (!file) throw new BadRequestException("업로드할 로고 파일을 선택하세요.");
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("png, jpg, jpeg, webp 이미지만 업로드할 수 있습니다.");
    }
    if (file.size > MAX_LOGO_FILE_SIZE) {
      throw new BadRequestException("로고 이미지는 1MB 이하만 업로드할 수 있습니다.");
    }

    const output = await sharp(file.buffer)
      .rotate()
      .resize(256, 256, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png({ quality: 92 })
      .toBuffer();

    if (output.length > MAX_LOGO_FILE_SIZE) {
      throw new BadRequestException("변환된 로고 이미지가 1MB를 초과했습니다.");
    }

    await mkdir(logoUploadDir(), { recursive: true });
    const fileName = `${sanitizeFilePart(security.symbol)}-${security.id}-${Date.now()}.png`;
    await writeFile(join(logoUploadDir(), fileName), output);
    await this.deleteUploadedLogoFile(security.logoUrl);

    const updated = await this.prisma.security.update({
      where: { id },
      data: {
        logoUrl: logoUploadUrl(fileName),
        logoSource: "UPLOAD",
        logoLastCheckedAt: new Date(),
        logoFailedAt: null
      }
    });

    return toAdminSecurity(updated);
  }

  async refreshLogo(id: string) {
    return this.stockLogoService.refreshLogo(id);
  }

  async deleteLogo(id: string) {
    const security = await this.assertSecurity(id);
    await this.deleteUploadedLogoFile(security.logoUrl);

    const updated = await this.prisma.security.update({
      where: { id },
      data: {
        logoUrl: null,
        logoSource: "FALLBACK",
        logoLastCheckedAt: new Date(),
        logoFailedAt: null
      }
    });

    return toAdminSecurity(updated);
  }

  private async assertSecurity(id: string) {
    const security = await this.prisma.security.findUnique({ where: { id } });
    if (!security) throw new NotFoundException("종목을 찾을 수 없습니다.");
    return security;
  }

  private async deleteUploadedLogoFile(logoUrl?: string | null) {
    if (!logoUrl?.startsWith("/api/uploads/logos/")) return;
    const fileName = basename(logoUrl);
    if (!/^[a-zA-Z0-9_.-]+$/.test(fileName)) return;
    await rm(join(logoUploadDir(), fileName), { force: true }).catch(() => undefined);
  }
}

function toAdminSecurity(security: {
  id: string;
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  assetType: string;
  companyDomain: string | null;
  logoUrl: string | null;
  logoSource: LogoSource | null;
  logoLastCheckedAt: Date | null;
  logoFailedAt: Date | null;
}) {
  return {
    id: security.id,
    symbol: security.symbol,
    name: security.name,
    marketCountry: security.marketCountry,
    currency: security.currency,
    assetType: security.assetType,
    companyDomain: security.companyDomain,
    logoUrl: security.logoUrl,
    logoSource: security.logoSource ?? "FALLBACK",
    logoLastCheckedAt: security.logoLastCheckedAt?.toISOString() ?? null,
    logoFailedAt: security.logoFailedAt?.toISOString() ?? null
  };
}

function normalizeMarketCountry(value?: string) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || normalized === "ALL") return undefined;
  return normalized;
}

function normalizeNullableString(value?: string | null) {
  if (value === undefined) return undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeLogoSource(source: LogoSource | null | undefined, logoUrl: string | null | undefined) {
  if (!logoUrl) return "FALLBACK" as LogoSource;
  if (!source || source === "FALLBACK") return "MANUAL" as LogoSource;
  return source;
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "logo";
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
