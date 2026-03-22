import { ScenarioConfig, PricingMixPoint, MarketingPoint } from "../simulation/scenarioConfigs";

/**
 * [SSOT Layer] Scenario Config Resolver
 * Derives financial metrics from config objects with fallbacks to engine defaults.
 */

export function resolveMix(date: Date, timeline: PricingMixPoint[]): number[] {
  if (!timeline.length) throw new Error("mixTimeline missing");

  const sorted = [...timeline].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let current = sorted[0].mix;

  for (const point of sorted) {
    if (date >= new Date(point.date)) {
      current = point.mix;
    } else {
      break;
    }
  }

  return current;
}

export function resolveARPU(date: Date, config: ScenarioConfig): number {
  const { plans, mixTimeline } = config.pricing;

  const mix = resolveMix(date, mixTimeline);

  const rawARPU = plans.reduce((sum, plan, i) => {
    return sum + plan.price * mix[i];
  }, 0);

  // [USER REQ] 2. Effective ARPU (Paying Ratio 60%)
  return rawARPU * 0.6;
}

export function resolveMarketing(date: Date, config: ScenarioConfig): number {
  const timeline = config.marketingPolicy?.timeline || [];
  if (!timeline.length) return 0;

  const sorted = [...timeline].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let current = sorted[0].amount;

  for (const point of sorted) {
    if (date >= new Date(point.date)) {
      current = point.amount;
    } else {
      break;
    }
  }

  return current;
}

export function isRevenueActive(date: Date, config: ScenarioConfig): boolean {
  return date >= new Date(config.revenuePolicy.startDate);
}

export function resolveCAC(config: ScenarioConfig): number {
  return config.userModel?.baseCAC ?? 0;
}

export function resolveChurn(config: ScenarioConfig): number {
  return config.userModel?.baseChurn ?? 0;
}

export function resolveVariableCost(config: ScenarioConfig): number {
  return config.unitEconomics?.variableCostPerUser ?? 0;
}


export function resolveInjectionAmount(config: ScenarioConfig): number {
  return config.fundingPolicy?.injectionAmount ?? 0;
}

export function shouldInjectFunding(
  cash: number,
  burn: number,
  config: ScenarioConfig
): boolean {
  const policy = config.fundingPolicy;
  if (!policy?.enabled) return false;

  if (policy.trigger.type === "runway") {
    const runway = burn > 0 ? cash / burn : 999;
    return runway <= (policy.trigger.thresholdMonths ?? 0);
  }

  if (policy.trigger.type === "cash") {
    return cash <= (policy.trigger.thresholdCash ?? 0);
  }

  return false;
}
