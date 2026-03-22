// src/core/engine/marketingEngine.ts

export interface MarketingPoint {
  date: string;
  spend: number;
}

export interface MarketingConfig {
  timeline: MarketingPoint[];
}

export function resolveMarketingSpend(
  date: string,
  config: MarketingConfig
): number {
  if (!config.timeline.length) return 0;
  
  const sorted = [...config.timeline].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let current = sorted[0].spend;

  for (const point of sorted) {
    if (new Date(date) >= new Date(point.date)) {
      current = point.spend;
    }
  }

  return current;
}
