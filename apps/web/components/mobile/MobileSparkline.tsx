"use client";

import { cn } from "@/lib/utils";

type MobileSparklineProps = {
  values: number[];
  positive?: boolean;
  className?: string;
};

export function MobileSparkline({ values, positive = true, className }: MobileSparklineProps) {
  const points = buildPoints(values, 70, 28);

  if (!points) {
    return <svg className={cn("h-[28px] w-[70px]", className)} viewBox="0 0 70 28" aria-hidden="true" />;
  }

  return (
    <svg className={cn("h-[28px] w-[70px] overflow-hidden", className)} viewBox="0 0 70 28" aria-hidden="true">
      <path d={points} fill="none" stroke={positive ? "#EF4444" : "#2563EB"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function buildPoints(values: number[], width: number, height: number) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length < 2) return null;

  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || Math.max(1, Math.abs(max));
  const padding = 3;

  return safeValues
    .map((value, index) => {
      const x = (index / (safeValues.length - 1)) * width;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
