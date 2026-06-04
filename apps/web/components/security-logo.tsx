"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type SecurityLogoSize = "sm" | "md" | "lg" | "xl";

type SecurityLogoProps = {
  symbol: string;
  name: string;
  logoUrl?: string | null;
  marketCountry: string;
  size?: SecurityLogoSize;
  showCountryBadge?: boolean;
  className?: string;
};

const failedLogoUrls = new Set<string>();

const sizeClasses: Record<SecurityLogoSize, { root: string; text: string; badge: string }> = {
  sm: { root: "h-8 w-8", text: "text-xs", badge: "h-4 min-w-4 text-[9px]" },
  md: { root: "h-10 w-10", text: "text-sm", badge: "h-4 min-w-4 text-[9px]" },
  lg: { root: "h-12 w-12", text: "text-base", badge: "h-5 min-w-5 text-[10px]" },
  xl: { root: "h-16 w-16", text: "text-xl", badge: "h-6 min-w-6 text-xs" }
};

const gradients = [
  ["#2563eb", "#22c55e"],
  ["#7c3aed", "#06b6d4"],
  ["#e11d48", "#f97316"],
  ["#0f766e", "#84cc16"],
  ["#1d4ed8", "#a855f7"],
  ["#334155", "#38bdf8"],
  ["#be123c", "#f59e0b"],
  ["#047857", "#14b8a6"]
];

export function SecurityLogo({
  symbol,
  name,
  logoUrl,
  marketCountry,
  size = "sm",
  showCountryBadge = false,
  className
}: SecurityLogoProps) {
  const normalizedLogoUrl = logoUrl?.trim() || null;
  const [failed, setFailed] = useState(Boolean(normalizedLogoUrl && failedLogoUrls.has(normalizedLogoUrl)));
  const shouldShowImage = Boolean(normalizedLogoUrl && !failed && !failedLogoUrls.has(normalizedLogoUrl));
  const classes = sizeClasses[size];
  const fallback = useMemo(() => fallbackLogo(symbol, name), [symbol, name]);
  const countryBadge = countryFlag(marketCountry);

  useEffect(() => {
    setFailed(Boolean(normalizedLogoUrl && failedLogoUrls.has(normalizedLogoUrl)));
  }, [normalizedLogoUrl]);

  return (
    <span className={cn("relative inline-flex shrink-0 overflow-visible", classes.root, className)} aria-label={`${name || symbol} 로고`}>
      <span
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-[var(--card-border)] bg-slate-800 font-black text-white shadow-sm",
          classes.text
        )}
        style={shouldShowImage ? undefined : { background: fallback.gradient }}
      >
        {shouldShowImage ? (
          <img
            src={normalizedLogoUrl ?? undefined}
            alt=""
            className="h-full w-full rounded-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => {
              if (normalizedLogoUrl) failedLogoUrls.add(normalizedLogoUrl);
              setFailed(true);
            }}
          />
        ) : (
          <span className="leading-none">{fallback.letter}</span>
        )}
      </span>
      {showCountryBadge ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-[var(--background)] bg-white px-0.5 leading-none shadow-sm",
            classes.badge
          )}
          aria-hidden="true"
        >
          {countryBadge}
        </span>
      ) : null}
    </span>
  );
}

function fallbackLogo(symbol: string, name: string) {
  const source = (symbol || name || "?").trim();
  const letter = source.replace(/[^a-zA-Z0-9가-힣]/g, "").slice(0, 1).toUpperCase() || "?";
  const hash = source.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [from, to] = gradients[hash % gradients.length];
  return {
    letter,
    gradient: `linear-gradient(135deg, ${from}, ${to})`
  };
}

function countryFlag(marketCountry: string) {
  const normalized = marketCountry.toUpperCase();
  if (normalized === "US") return "🇺🇸";
  if (normalized === "KR" || normalized === "KOR" || normalized === "KOREA") return "🇰🇷";
  return "🌐";
}
