// src/core/engine/revenueEngine.ts

export interface PricingPlan {
  name: string;
  price: number;
}

export interface PricingMixPoint {
  date: string;
  mix: Record<string, number>; // planName → %
}

export interface PricingConfig {
  plans: PricingPlan[];
  mixTimeline: PricingMixPoint[];
}

function resolveMix(date: string, config: PricingConfig): Record<string, number> {
  const sorted = [...config.mixTimeline].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let current = sorted[0].mix;

  for (const point of sorted) {
    if (new Date(date) >= new Date(point.date)) {
      current = point.mix;
    }
  }

  return current;
}

export function calculateARPU(date: string, config: PricingConfig): number {
  const mix = resolveMix(date, config);

  let arpu = 0;

  for (const plan of config.plans) {
    const weight = mix[plan.name] || 0;
    arpu += plan.price * weight;
  }

  return arpu;
}

export function calculateRevenue(users: number, arpu: number): number {
  return users * arpu;
}
