"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type FearGreedLevel = "EXTREME_FEAR" | "FEAR" | "NEUTRAL" | "GREED" | "EXTREME_GREED";

export type FearGreedBadgeProps = {
  value: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  showLabel?: boolean;
  showDescription?: boolean;
  className?: string;
};

export const FEAR_GREED_META: Record<
  FearGreedLevel,
  {
    labelKo: string;
    labelEn: string;
    range: string;
    color: string;
    softColor: string;
    icon: string;
    emoji: string;
    description: string;
  }
> = {
  EXTREME_FEAR: {
    labelKo: "극단적 공포",
    labelEn: "Extreme Fear",
    range: "0 - 24",
    color: "#2563EB",
    softColor: "#EFF6FF",
    icon: "/icons/fear-greed/extreme-fear.png",
    emoji: "😭",
    description: "시장이 매우 위축되어 있어요"
  },
  FEAR: {
    labelKo: "공포",
    labelEn: "Fear",
    range: "25 - 49",
    color: "#14B8A6",
    softColor: "#ECFEFF",
    icon: "/icons/fear-greed/fear.png",
    emoji: "😰",
    description: "투자 심리가 위축되어 있어요"
  },
  NEUTRAL: {
    labelKo: "중립",
    labelEn: "Neutral",
    range: "50",
    color: "#64748B",
    softColor: "#F1F5F9",
    icon: "/icons/fear-greed/neutral.png",
    emoji: "😐",
    description: "시장 심리가 평범합니다"
  },
  GREED: {
    labelKo: "탐욕",
    labelEn: "Greed",
    range: "51 - 74",
    color: "#F59E0B",
    softColor: "#FFFBEB",
    icon: "/icons/fear-greed/greed.png",
    emoji: "😏",
    description: "투자 심리가 과열되고 있어요"
  },
  EXTREME_GREED: {
    labelKo: "극단적 탐욕",
    labelEn: "Extreme Greed",
    range: "75 - 100",
    color: "#EF4444",
    softColor: "#FEF2F2",
    icon: "/icons/fear-greed/extreme-greed.png",
    emoji: "🤩",
    description: "시장이 매우 낙관적인 상태입니다"
  }
};

export function getFearGreedLevel(value: number): FearGreedLevel {
  if (!Number.isFinite(value)) return "NEUTRAL";
  if (value <= 24) return "EXTREME_FEAR";
  if (value <= 49) return "FEAR";
  if (value === 50) return "NEUTRAL";
  if (value <= 74) return "GREED";
  return "EXTREME_GREED";
}

export function getFearGreedMeta(value: number) {
  return FEAR_GREED_META[getFearGreedLevel(value)];
}

export function getFearGreedInsight(value: number) {
  const level = getFearGreedLevel(value);
  const rounded = Math.round(value);

  if (level === "EXTREME_FEAR") {
    return `공포탐욕지수 ${rounded}: 시장이 극단적 공포 구간입니다. 저가 매수 기회와 추가 하락 위험이 함께 존재합니다.`;
  }
  if (level === "FEAR") {
    return `공포탐욕지수 ${rounded}: 투자 심리가 위축되어 있습니다. 분할 매수와 현금 비중 점검이 필요합니다.`;
  }
  if (level === "NEUTRAL") {
    return `공포탐욕지수 ${rounded}: 시장 심리는 중립 구간입니다. 과열이나 공포 신호는 강하지 않습니다.`;
  }
  if (level === "GREED") {
    return `공포탐욕지수 ${rounded}: 시장이 탐욕 구간에 있습니다. 상승 추세와 리스크 관리를 함께 봐야 합니다.`;
  }
  return `공포탐욕지수 ${rounded}: 시장이 극단적 탐욕 구간입니다. 추격 매수보다 리스크 관리가 필요합니다.`;
}

export function buildFearGreedAlerts(value: number, change: number) {
  if (!Number.isFinite(value)) return [];

  const rounded = Math.round(value);
  const alerts: Array<{ title: string; description: string; tone: "blue" | "red" | "orange" | "green" }> = [];

  if (rounded <= 25) {
    alerts.push({
      title: "공포 구간 진입",
      description: `공포탐욕지수가 ${rounded}입니다. 공포 구간에서는 변동성과 추가 하락 가능성을 함께 점검하세요.`,
      tone: "blue"
    });
  }

  if (rounded >= 75) {
    alerts.push({
      title: "탐욕 구간 진입",
      description: `공포탐욕지수가 ${rounded}입니다. 낙관 심리가 강해진 구간입니다.`,
      tone: "red"
    });
  }

  if (rounded >= 80) {
    alerts.push({
      title: "시장 과열 주의",
      description: "공포탐욕지수가 80 이상입니다. 추격 매수보다 손실 제한 기준을 먼저 확인하세요.",
      tone: "orange"
    });
  }

  if (Math.abs(change) >= 10) {
    alerts.push({
      title: "투자심리 급변",
      description: `전일 대비 ${change > 0 ? "+" : ""}${change.toFixed(0)}포인트 변동했습니다. 시장 뉴스와 지수 방향을 확인하세요.`,
      tone: change > 0 ? "red" : "blue"
    });
  }

  return alerts;
}

export function FearGreedBadge({
  value,
  size = "md",
  showValue = true,
  showLabel = true,
  showDescription = false,
  className
}: FearGreedBadgeProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const meta = getFearGreedMeta(value);
  const iconClass = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16"
  }[size];
  const valueClass = {
    sm: "text-[18px]",
    md: "text-[22px]",
    lg: "text-[32px]"
  }[size];

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-full border",
          size === "lg" ? "h-20 w-20 shadow-[0_14px_36px_rgba(15,23,42,0.12)]" : "h-11 w-11 shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
        )}
        style={{
          backgroundColor: meta.softColor,
          borderColor: `${meta.color}30`,
          boxShadow: `0 10px 28px ${meta.color}18`
        }}
      >
        {imageFailed ? (
          <span className={size === "lg" ? "text-4xl" : "text-xl"} aria-hidden="true">
            {meta.emoji}
          </span>
        ) : (
          <img
            src={meta.icon}
            alt={`${meta.labelKo} 로봇 아이콘`}
            loading="lazy"
            className={cn("object-contain", iconClass)}
            onError={() => setImageFailed(true)}
          />
        )}
      </span>
      {showValue || showLabel || showDescription ? (
        <span className="min-w-0">
          {showValue ? (
            <span className={cn("numeric block font-black leading-none text-[var(--text-primary)]", valueClass)}>
              {Math.round(value)}
            </span>
          ) : null}
          {showLabel ? (
            <span className="mt-1 block truncate text-[12px] font-black" style={{ color: meta.color }}>
              {meta.labelKo}
            </span>
          ) : null}
          {showDescription ? (
            <span className="mt-1 block truncate text-[12px] font-semibold text-[var(--text-secondary)]">
              {meta.description}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
