"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useMarketIndicators(enabled = true) {
  const [refetchInterval, setRefetchInterval] = useState(60_000);
  const query = useQuery({
    queryKey: ["market-indicators"],
    queryFn: () => api.marketIndicators(),
    enabled,
    refetchInterval,
    refetchIntervalInBackground: true,
    retry: false
  });

  useEffect(() => {
    if (query.data?.nextRefreshIntervalMs) {
      setRefetchInterval(query.data.nextRefreshIntervalMs);
    }
  }, [query.data?.nextRefreshIntervalMs]);

  return query;
}
