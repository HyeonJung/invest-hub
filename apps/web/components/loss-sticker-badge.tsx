"use client";

import { cn, formatPercent } from "@/lib/utils";

export type LossStickerMode = "image" | "emoji" | "hidden";
export type ProfitStickerMode = "image" | "emoji" | "hidden";

export type LossStickerBadgeProps = {
  profitLossRate: number;
  mode?: LossStickerMode;
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
  size = "sm"
}: LossStickerBadgeProps) {
  if (mode === "hidden" || !Number.isFinite(profitLossRate) || profitLossRate > -5) return null;

  const stickerCount = Math.floor(Math.abs(profitLossRate) / 5);
  if (stickerCount <= 0) return null;

  const itemSizeClass = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const emojiSizeClass = size === "md" ? "text-[16px]" : "text-[14px]";
  const textSizeClass = size === "md" ? "text-[12px]" : "text-[11px]";
  const title = `손실률 ${formatPercent(profitLossRate)} · -5%당 경고 스티커 1개 · 현재 x${stickerCount}`;

  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-full border align-middle opacity-95 transition group-hover:opacity-100",
        "border-blue-100 bg-blue-50 text-blue-700 shadow-[0_4px_12px_rgba(59,130,246,0.08)]",
        "dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100",
        size === "md" ? "px-2 py-0.5" : "px-1.5 py-0.5"
      )}
      aria-label={title}
      title={title}
    >
      {mode === "emoji" ? (
        <span className={cn("shrink-0 leading-none transition-transform hover:scale-110", emojiSizeClass)} aria-hidden="true">
          {LOSS_STICKER_EMOJI}
        </span>
      ) : (
        <img
          src={LOSS_STICKER_IMAGE_SRC}
          alt=""
          loading="lazy"
          className={cn("shrink-0 rounded-full object-cover transition-transform hover:scale-110", itemSizeClass)}
        />
      )}
      <span className={cn("numeric font-black leading-none text-blue-700 dark:text-blue-100", textSizeClass)}>x{stickerCount}</span>
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

  const stickerSizeClass = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const emojiSizeClass = size === "md" ? "text-[16px]" : "text-[14px]";
  const textSizeClass = size === "md" ? "text-[12px]" : "text-[11px]";
  const title = `수익률 ${formatPercent(profitLossRate)} · +100%당 햄버거 1개, 남은 +5%당 스티커 1개 · 햄버거 x${burgerCount}, 스티커 x${stickerCount}`;

  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border align-middle opacity-95 transition group-hover:opacity-100",
        "border-red-100 bg-red-50 text-red-700 shadow-[0_4px_12px_rgba(239,68,68,0.08)]",
        "dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100",
        size === "md" ? "px-2 py-0.5" : "px-1.5 py-0.5"
      )}
      aria-label={title}
      title={title}
    >
      {burgerCount > 0 ? (
        <ProfitStickerToken
          count={burgerCount}
          emoji={PROFIT_BURGER_EMOJI}
          imageSrc={PROFIT_BURGER_IMAGE_SRC}
          mode={mode}
          imageClassName={stickerSizeClass}
          emojiClassName={emojiSizeClass}
          textClassName={textSizeClass}
        />
      ) : null}
      {stickerCount > 0 ? (
        <ProfitStickerToken
          count={stickerCount}
          emoji={PROFIT_STICKER_EMOJI}
          imageSrc={PROFIT_STICKER_IMAGE_SRC}
          mode={mode}
          imageClassName={stickerSizeClass}
          emojiClassName={emojiSizeClass}
          textClassName={textSizeClass}
        />
      ) : null}
    </span>
  );
}

function ProfitStickerToken({
  count,
  emoji,
  imageSrc,
  mode,
  imageClassName,
  emojiClassName,
  textClassName
}: {
  count: number;
  emoji: string;
  imageSrc: string;
  mode: ProfitStickerMode;
  imageClassName: string;
  emojiClassName: string;
  textClassName: string;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {mode === "emoji" ? (
        <span className={cn("shrink-0 leading-none transition-transform hover:scale-110", emojiClassName)} aria-hidden="true">
          {emoji}
        </span>
      ) : (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          className={cn("shrink-0 rounded-full object-cover transition-transform hover:scale-110", imageClassName)}
        />
      )}
      <span className={cn("numeric font-black leading-none text-red-700 dark:text-red-100", textClassName)}>x{count}</span>
    </span>
  );
}
