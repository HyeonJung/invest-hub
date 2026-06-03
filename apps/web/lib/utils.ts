import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKrw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function formatPercent(value: number, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  if (typeof window !== "undefined") {
    const currentHost = window.location.hostname;

    try {
      const url = new URL(configured);
      const isLocalPage = currentHost === "localhost" || currentHost === "127.0.0.1";
      const isLocalApi = url.hostname === "localhost" || url.hostname === "127.0.0.1";

      if (isLocalPage && isLocalApi) {
        url.hostname = currentHost;
        return url.toString().replace(/\/$/, "");
      }
    } catch {
      return configured.replace(/\/$/, "");
    }
  }

  return configured.replace(/\/$/, "");
}
