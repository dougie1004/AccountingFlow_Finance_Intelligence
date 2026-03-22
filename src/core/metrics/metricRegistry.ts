// src/core/metrics/metricRegistry.ts

export interface RunwayInput {
  currentCash: number;          // latest actual cash ONLY
  futureCashDeltas: number[];   // projectionLedger 기반 ONLY
}

export function calculateAvgBurn(futureCashDeltas: number[]): number {
  if (!futureCashDeltas || futureCashDeltas.length === 0) return 0;
  
  const burnMonths = futureCashDeltas.filter(d => d < 0);
  if (burnMonths.length === 0) return 0;

  return burnMonths.reduce((sum, val) => sum + Math.abs(val), 0) / burnMonths.length;
}

export function calculateRunway({
  currentCash,
  futureCashDeltas
}: RunwayInput): number {
  const avgBurn = calculateAvgBurn(futureCashDeltas);
  if (avgBurn === 0) return Infinity;

  return currentCash / avgBurn;
}
