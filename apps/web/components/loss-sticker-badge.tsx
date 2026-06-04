"use client";

import { cn, formatPercent } from "@/lib/utils";

export type LossStickerMode = "image" | "emoji" | "hidden";
export type ProfitStickerMode = "image" | "emoji" | "hidden";

export type LossStickerBadgeProps = {
  profitLossRate: number;
  mode?: LossStickerMode;
  maxCount?: number;
  size?: "sm" | "md";
};

export type ProfitStickerBadgeProps = {
  profitLossRate: number;
  mode?: ProfitStickerMode;
  size?: "sm" | "md";
};

export const DEFAULT_LOSS_STICKER_MODE: LossStickerMode = "image";
export const DEFAULT_PROFIT_STICKER_MODE: ProfitStickerMode = "image";

const LOSS_STICKER_IMAGE_SRC = "/drawdown-mao-sticker.png";
const LOSS_STICKER_EMOJI = "🔥";
const PROFIT_STICKER_IMAGE_SRC = "/profit-5-sticker.png";
const PROFIT_BURGER_IMAGE_SRC = "/profit-hamburger-sticker.png";
const PROFIT_STICKER_EMOJI = "🚀";
const PROFIT_BURGER_EMOJI = "🍔";

export function LossStickerBadge({
  profitLossRate,
  mode = DEFAULT_LOSS_STICKER_MODE,
  maxCount = 5,
  size = "sm"
}: LossStickerBadgeProps) {
  if (mode === "hidden" || !Number.isFinite(profitLossRate) || profitLossRate > -5) return null;

  const stickerCount = Math.min(maxCount, Math.floor(Math.abs(profitLossRate) / 5));
  if (stickerCount <= 0) return null;

  const visibleMobileCount = Math.min(3, stickerCount);
  const hiddenMobileCount = stickerCount - visibleMobileCount;
  const itemSizeClass = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const emojiSizeClass = size === "md" ? "text-[16px]" : "text-[14px]";
  const title = `손실률 ${formatPercent(profitLossRate)} · -5%당 경고 스티커 1개 · 현재 ${stickerCount}개 표시`;

  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 overflow-hidden rounded-full border align-middle opacity-95 transition group-hover:opacity-100",
        "border-blue-100 bg-blue-50 text-blue-700 shadow-[0_4px_12px_rgba(59,130,246,0.08)]",
        "dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100",
        size === "md" ? "px-2 py-1" : "px-1.5 py-0.5"
      )}
      aria-label={title}
      title={title}
    >
      {Array.from({ length: stickerCount }).map((_, index) => {
        const mobileVisibility = index >= visibleMobileCount ? "hidden sm:inline-block" : "";

        if (mode === "emoji") {
          return (
            <span
              key={`loss-emoji-${index}`}
              className={cn("leading-none transition-transform hover:scale-110", emojiSizeClass, mobileVisibility)}
              aria-hidden="true"
            >
              {LOSS_STICKER_EMOJI}
            </span>
          );
        }

        return (
          <img
            key={`loss-image-${index}`}
            src={LOSS_STICKER_IMAGE_SRC}
            alt=""
            loading="lazy"
            className={cn("shrink-0 object-contain transition-transform hover:scale-110", itemSizeClass, mobileVisibility)}
          />
        );
      })}
      {hiddenMobileCount > 0 ? (
        <span className="numeric ml-0.5 text-[10px] font-black leading-none sm:hidden">+{hiddenMobileCount}</span>
      ) : null}
    </span>
  );
}

export function ProfitStickerBadge({
  profitLossRate,
  mode = DEFAULT_PROFIT_STICKER_MODE,
  size = "sm"
}: ProfitStickerBadgeProps) {
  if (mode === "hidden" || !Number.isFinite(profitLossRate) || profitLossRate < 5) return null;

  const burgerCount = Math.floor(profitLossRate / 100);
  const stickerCount = Math.floor((profitLossRate % 100) / 5);
  if (burgerCount <= 0 && stickerCount <= 0) return null;

  const burgerSizeClass = size === "md" ? "h-7 w-7" : "h-6 w-6";
  const stickerSizeClass = size === "md" ? "h-8 w-8" : "h-7 w-7";
  const emojiSizeClass = size === "md" ? "text-[17px]" : "text-[15px]";
  const title = `수익률 ${formatPercent(profitLossRate)} · +100%당 햄버거 1개, 남은 +5%당 스티커 1개 · 햄버거 ${burgerCount}개, 스티커 ${stickerCount}개 표시`;

  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-[196px] shrink items-center gap-1 overflow-x-auto overflow-y-hidden rounded-full border align-middle opacity-95 transition group-hover:opacity-100 sm:max-w-[460px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "border-red-100 bg-red-50 px-2 py-1 text-red-700 shadow-[0_4px_12px_rgba(239,68,68,0.08)]",
        "dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100",
        size === "md" && "max-w-[260px] sm:max-w-[520px]"
      )}
      aria-label={title}
      title={title}
    >
      {Array.from({ length: burgerCount }).map((_, index) => {
        if (mode === "emoji") {
          return (
            <span key={`profit-burger-emoji-${index}`} className={cn("shrink-0 leading-none transition-transform hover:scale-110", emojiSizeClass)} aria-hidden="true">
              {PROFIT_BURGER_EMOJI}
            </span>
          );
        }

        return (
          <img
            key={`profit-burger-image-${index}`}
            src={PROFIT_BURGER_IMAGE_SRC}
            alt=""
            loading="lazy"
            className={cn("shrink-0 object-contain transition-transform hover:scale-110", burgerSizeClass)}
          />
        );
      })}
      {Array.from({ length: stickerCount }).map((_, index) => {
        if (mode === "emoji") {
          return (
            <span key={`profit-sticker-emoji-${index}`} className={cn("shrink-0 leading-none transition-transform hover:scale-110", emojiSizeClass)} aria-hidden="true">
              {PROFIT_STICKER_EMOJI}
            </span>
          );
        }

        return (
          <img
            key={`profit-sticker-image-${index}`}
            src={PROFIT_STICKER_IMAGE_SRC}
            alt=""
            loading="lazy"
            className={cn("shrink-0 rounded-full object-cover transition-transform hover:scale-110", stickerSizeClass)}
          />
        );
      })}
    </span>
  );
}
