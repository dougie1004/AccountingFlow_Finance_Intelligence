// src/core/ssotEngine.ts
import { calculateRunway } from "./metrics/metricRegistry";
import { generateCashFlow } from "./reporting/generateCashFlow";

/**
 * [V3.0] SSOT Engine - Stage 1 (Simplified)
 * Actual Ledger 파스루 및 Metric 통합 계산
 */

export function generateProjectionLedger({
  actualLedger
}: any) {
  // 현재는 actualLedger만 그대로 반환 (추후 확장 예정)
  return actualLedger;
}

export function buildMetrics(projectionLedger: any[]) {
  const cashflow = generateCashFlow(projectionLedger, 0);

  // Find which months contain future/scenario entries
  const futureMonths = new Set<string>();
  projectionLedger.forEach(e => {
    if (e.scope === 'future' || e.scope === 'scenario' || e.type === 'Scenario') {
      futureMonths.add(e.date.substring(0, 7));
    }
  });

  const nowCash = cashflow.find(cf => !futureMonths.has(cf.date))?.cash || 0; // The last 'Actual' cash
  const futureDeltas = cashflow.filter(cf => futureMonths.has(cf.date)).map(cf => cf.delta);

  return {
    runway: calculateRunway({ currentCash: nowCash, futureCashDeltas: futureDeltas }),
    cashflow
  };
}
