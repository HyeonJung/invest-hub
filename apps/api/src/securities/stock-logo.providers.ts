import { LogoSource } from "@prisma/client";

export type LogoProviderResult = {
  logoUrl: string | null;
  companyDomain?: string | null;
  source: LogoSource;
};

export type DomesticLogoMapping = {
  logoUrl: string;
  companyDomain?: string;
};

const DOMESTIC_LOGO_MAP: Record<string, DomesticLogoMapping> = {
  "005930": { logoUrl: "/logos/domestic/005930.svg", companyDomain: "samsung.com" },
  "009150": { logoUrl: "/logos/domestic/009150.svg", companyDomain: "samsungsem.com" },
  "035420": { logoUrl: "/logos/domestic/035420.svg", companyDomain: "navercorp.com" },
  "000660": { logoUrl: "/logos/domestic/000660.svg", companyDomain: "skhynix.com" },
  "005380": { logoUrl: "/logos/domestic/005380.svg", companyDomain: "hyundai.com" },
  "051910": { logoUrl: "/logos/domestic/051910.svg", companyDomain: "lgchem.com" },
  "035720": { logoUrl: "/logos/domestic/035720.svg", companyDomain: "kakaocorp.com" },
  "068270": { logoUrl: "/logos/domestic/068270.svg", companyDomain: "celltrion.com" },
  "005490": { logoUrl: "/logos/domestic/005490.svg", companyDomain: "posco-inc.com" },
  "373220": { logoUrl: "/logos/domestic/373220.svg", companyDomain: "lgensol.com" }
};

const US_DOMAIN_MAP: Record<string, string> = {
  AAPL: "apple.com",
  MSFT: "microsoft.com",
  GOOGL: "abc.xyz",
  GOOG: "abc.xyz",
  NVDA: "nvidia.com",
  AVGO: "broadcom.com",
  MU: "micron.com",
  ORCL: "oracle.com",
  JOBY: "jobyaviation.com",
  VOO: "vanguard.com",
  QQQ: "invesco.com",
  QQQM: "invesco.com",
  SCHD: "schwabassetmanagement.com",
  SPY: "ssga.com",
  IVV: "ishares.com"
};

export class FinnhubLogoProvider {
  async resolve(symbol: string): Promise<LogoProviderResult | null> {
    const token = process.env.FINNHUB_API_KEY?.trim();
    if (!token) return null;

    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;

    const json = (await response.json()) as { logo?: unknown; weburl?: unknown };
    const logoUrl = typeof json.logo === "string" && json.logo.trim() ? json.logo.trim() : null;
    const companyDomain = domainFromUrl(typeof json.weburl === "string" ? json.weburl : null);
    if (!logoUrl) {
      return companyDomain ? { logoUrl: null, companyDomain, source: "FINNHUB" } : null;
    }

    return { logoUrl, companyDomain, source: "FINNHUB" };
  }
}

export class LogoDevProvider {
  resolve(companyDomain?: string | null): LogoProviderResult | null {
    const token = process.env.LOGO_DEV_API_KEY?.trim();
    const domain = normalizeDomain(companyDomain);
    if (!token || !domain) return null;

    return {
      logoUrl: `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&format=png&size=128`,
      companyDomain: domain,
      source: "LOGO_DEV"
    };
  }
}

export class BrandfetchProvider {
  async resolve(companyDomain?: string | null): Promise<LogoProviderResult | null> {
    const token = process.env.BRANDFETCH_API_KEY?.trim();
    const domain = normalizeDomain(companyDomain);
    if (!token || !domain) return null;

    const response = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    if (!response.ok) return null;

    const json = (await response.json()) as { logos?: Array<{ formats?: Array<{ src?: unknown }> }> };
    const logoUrl = json.logos
      ?.flatMap((logo) => logo.formats ?? [])
      .map((format) => (typeof format.src === "string" ? format.src : null))
      .find(Boolean);
    if (!logoUrl) return null;

    return { logoUrl, companyDomain: domain, source: "BRANDFETCH" };
  }
}

export class ManualDomesticLogoProvider {
  resolve(symbol: string): LogoProviderResult | null {
    const mapping = DOMESTIC_LOGO_MAP[normalizeSymbol(symbol)];
    if (!mapping) return null;
    return {
      logoUrl: mapping.logoUrl,
      companyDomain: mapping.companyDomain ?? null,
      source: "MANUAL"
    };
  }
}

export class FallbackLogoProvider {
  resolve(): LogoProviderResult {
    return { logoUrl: null, source: "FALLBACK" };
  }
}

export function domainForUsSymbol(symbol: string) {
  return US_DOMAIN_MAP[normalizeSymbol(symbol)] ?? null;
}

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function normalizeDomain(value?: string | null) {
  if (!value) return null;
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase() || null;
}

function domainFromUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(`https://${value}`);
    return normalizeDomain(url.hostname);
  } catch {
    return normalizeDomain(value);
  }
}
