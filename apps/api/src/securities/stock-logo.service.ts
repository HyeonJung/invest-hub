import { Injectable, NotFoundException } from "@nestjs/common";
import { LogoSource, Security } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  BrandfetchProvider,
  FallbackLogoProvider,
  FinnhubLogoProvider,
  LogoDevProvider,
  ManualDomesticLogoProvider,
  LogoProviderResult,
  domainForUsSymbol,
  normalizeDomain,
  normalizeSymbol
} from "./stock-logo.providers";

const LOGO_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type SecurityLogoResult = {
  securityId: string | null;
  symbol: string;
  name: string;
  marketCountry: string;
  logoUrl: string | null;
  companyDomain: string | null;
  logoSource: LogoSource;
  logoLastCheckedAt: string | null;
  logoFailedAt: string | null;
};

@Injectable()
export class StockLogoService {
  private readonly finnhubProvider = new FinnhubLogoProvider();
  private readonly logoDevProvider = new LogoDevProvider();
  private readonly brandfetchProvider = new BrandfetchProvider();
  private readonly manualDomesticLogoProvider = new ManualDomesticLogoProvider();
  private readonly fallbackLogoProvider = new FallbackLogoProvider();

  constructor(private readonly prisma: PrismaService) {}

  async getLogoForSecurity(securityId: string) {
    const security = await this.prisma.security.findUnique({ where: { id: securityId } });
    if (!security) throw new NotFoundException("종목을 찾을 수 없습니다.");
    return this.resolveAndCacheSecurityLogo(security);
  }

  async refreshLogo(securityId: string) {
    const security = await this.prisma.security.findUnique({ where: { id: securityId } });
    if (!security) throw new NotFoundException("종목을 찾을 수 없습니다.");
    return this.resolveAndCacheSecurityLogo(security, { force: true });
  }

  async resolveLogoBySymbol(symbol: string, marketCountry: string) {
    const security = await this.prisma.security.findUnique({
      where: {
        symbol_marketCountry: {
          symbol: normalizeSymbol(symbol),
          marketCountry
        }
      }
    });
    if (security) return this.resolveAndCacheSecurityLogo(security);

    const result = isUsMarket(marketCountry)
      ? await this.resolveUsStockLogo(symbol)
      : await this.resolveDomesticStockLogo(symbol);
    return this.toLogoResult({
      security: null,
      symbol,
      name: symbol,
      marketCountry,
      result
    });
  }

  async resolveUsStockLogo(symbol: string, companyDomain?: string | null): Promise<LogoProviderResult> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const finnhubResult = await safeResolve(() => this.finnhubProvider.resolve(normalizedSymbol));
    if (finnhubResult?.logoUrl) return finnhubResult;

    const resolvedDomain = normalizeDomain(companyDomain) ?? finnhubResult?.companyDomain ?? domainForUsSymbol(normalizedSymbol);
    const logoDevResult = this.logoDevProvider.resolve(resolvedDomain);
    if (logoDevResult?.logoUrl) return logoDevResult;

    const brandfetchResult = await safeResolve(() => this.brandfetchProvider.resolve(resolvedDomain));
    if (brandfetchResult?.logoUrl) return brandfetchResult;

    const fallback = this.getFallbackLogo(normalizedSymbol, normalizedSymbol);
    return { ...fallback, companyDomain: resolvedDomain ?? null };
  }

  async resolveDomesticStockLogo(symbol: string): Promise<LogoProviderResult> {
    return this.manualDomesticLogoProvider.resolve(symbol) ?? this.getFallbackLogo(symbol, symbol);
  }

  getFallbackLogo(_symbol: string, _name: string): LogoProviderResult {
    return this.fallbackLogoProvider.resolve();
  }

  async getLogosForSecurities(securities: Security[]) {
    const unique = Array.from(new Map(securities.map((security) => [security.id, security])).values());
    const entries = await Promise.all(
      unique.map(async (security) => {
        const result = await this.resolveAndCacheSecurityLogo(security);
        return [security.id, result] as const;
      })
    );
    return new Map(entries);
  }

  private async resolveAndCacheSecurityLogo(security: Security, options: { force?: boolean } = {}) {
    if (!options.force && security.logoUrl) return this.fromSecurity(security);
    if (!options.force && security.logoFailedAt && Date.now() - security.logoFailedAt.getTime() < LOGO_RETRY_WINDOW_MS) {
      return this.fromSecurity(security);
    }

    const result = isUsMarket(security.marketCountry)
      ? await this.resolveUsStockLogo(security.symbol, security.companyDomain)
      : await this.resolveDomesticStockLogo(security.symbol);
    const now = new Date();
    const updated = await this.prisma.security.update({
      where: { id: security.id },
      data: {
        logoUrl: result.logoUrl,
        companyDomain: result.companyDomain ?? security.companyDomain ?? null,
        logoSource: result.source,
        logoLastCheckedAt: now,
        logoFailedAt: result.logoUrl ? null : now
      }
    });

    return this.fromSecurity(updated);
  }

  private fromSecurity(security: Security): SecurityLogoResult {
    return {
      securityId: security.id,
      symbol: security.symbol,
      name: security.name,
      marketCountry: security.marketCountry,
      logoUrl: security.logoUrl,
      companyDomain: security.companyDomain,
      logoSource: security.logoSource ?? "FALLBACK",
      logoLastCheckedAt: security.logoLastCheckedAt?.toISOString() ?? null,
      logoFailedAt: security.logoFailedAt?.toISOString() ?? null
    };
  }

  private toLogoResult({
    security,
    symbol,
    name,
    marketCountry,
    result
  }: {
    security: Security | null;
    symbol: string;
    name: string;
    marketCountry: string;
    result: LogoProviderResult;
  }): SecurityLogoResult {
    return {
      securityId: security?.id ?? null,
      symbol,
      name,
      marketCountry,
      logoUrl: result.logoUrl,
      companyDomain: result.companyDomain ?? null,
      logoSource: result.source,
      logoLastCheckedAt: null,
      logoFailedAt: result.logoUrl ? null : new Date().toISOString()
    };
  }
}

function isUsMarket(marketCountry: string) {
  return marketCountry.toUpperCase() === "US";
}

async function safeResolve<T>(resolver: () => Promise<T>) {
  try {
    return await resolver();
  } catch {
    return null;
  }
}
