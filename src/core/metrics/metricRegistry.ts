// src/core/metrics/metricRegistry.ts

export type KPIType = 'runway' | 'burn' | 'cash';

export interface RunwayInput {
  currentCash: number;          // latest actual cash ONLY
  futureCashDeltas: number[];   // projectionLedger 기반 ONLY
}

/**
 * [V14 SSOT] Unified Burn Calculation
 * Ensures deterministic distinction between Inflow/Outflow.
 */
export function calculateBurn(entries: any[]) {
    if (!entries || entries.length === 0) {
      return { inflow: 0, outflow: 0, netBurn: 0, grossBurn: 0 };
    }
  
    let inflow = 0;
    let outflow = 0;
  
    for (const e of entries) {
      const amount = Number(e.amount) || 0;
      const type = (e.type || "").toUpperCase();
  
      if (type === "INFLOW" || (e.scope === 'future' && amount > 0)) {
        inflow += Math.abs(amount);
      } else if (type === "OUTFLOW" || (e.scope === 'future' && amount < 0)) {
        outflow += Math.abs(amount);
      }
    }
  
    const grossBurn = outflow;
    const netBurn = Math.max(outflow - inflow, 0);
  
    return {
      inflow,
      outflow,
      netBurn,
      grossBurn
    };
}

/**
 * [V14 SSOT] Unified Runway Calculation
 * Formula: Runway = Net Liquidity / Net Burn
 */
export function calculateRunway({
    netLiquidity,
    netBurn,
}: {
    netLiquidity: number;
    netBurn: number;
}): number {
    if (netBurn <= 0) return Infinity; // UI에서는 "지속 가능"으로 표시됨
    const runway = netLiquidity / netBurn;
    return runway > 0 ? runway : 0;
}

/**
 * [Scenario Model] Sequential Cash-Out (Simulation Outcome)
 * This is used for "Simulation Outcome" / "Projected Depletion Point"
 */
export function calculateSequentialRunway({
  currentCash,
  futureCashDeltas
}: RunwayInput): number {
  if (currentCash <= 0 && (!futureCashDeltas || futureCashDeltas.every(d => d <= 0))) return 0;
  
  let runningCash = currentCash;
  let months = 0;
  
  for (const delta of futureCashDeltas) {
      runningCash += delta;
      if (delta >= 0) break; // Sustainable/Income -> Simulation break for runway
      if (runningCash <= 0) break;
      months++;
      if (months >= 36) break;
  }
  
  if (runningCash > 0 && months >= futureCashDeltas.length) {
      const isProfitableOverall = futureCashDeltas.reduce((a, b) => a + b, 0) >= 0;
      return isProfitableOverall ? Infinity : 36.1;
  }
  return months;
}

// Support for older calls while we transition
export function calculateCashRunway(netLiquidity: number, cashBurn: number): number {
    return calculateRunway({ netLiquidity, netBurn: cashBurn });
}

export function calculateCashBurn(futureCashDeltas: number[]): number {
    if (!futureCashDeltas || futureCashDeltas.length === 0) return 0;
    let net = 0;
    futureCashDeltas.forEach(d => {
        if (d < 0) net += Math.abs(d);
        else net -= d;
    });
    return Math.max(net / futureCashDeltas.length, 0);
}

export function calculateOperatingBurn(totalExpenses: number, months: number): number {
    if (months <= 0) return 0;
    return Math.abs(totalExpenses) / months;
}

/**
 * [V2.8.2] Cash Burn Breakdown Utility
 * Calculates inflow, outflow, and net cash burn from monthly interval data.
 */
export function calculateCashBurnBreakdown(historicalMonthsData: any[]) {
    if (!historicalMonthsData || historicalMonthsData.length === 0) {
        return { inflow: 0, outflow: 0, netBurn: 0 };
    }

    const totalInflow = historicalMonthsData.reduce((sum, m) => sum + (m.cashIn || 0), 0);
    const totalOutflow = historicalMonthsData.reduce((sum, m) => sum + (m.cashOut || 0), 0);
    const avgInflow = totalInflow / historicalMonthsData.length;
    const avgOutflow = totalOutflow / historicalMonthsData.length;

    return {
        inflow: avgInflow,
        outflow: avgOutflow,
        netBurn: Math.max(avgOutflow - avgInflow, 0)
    };
}

/**
 * [V2.8.2] Robust Operating Burn Calculation
 * Averages out a list of periodic expenses to provide a stable burn figure.
 */
export function calculateRobustOperatingBurn(expenseHistory: number[]): number {
    if (!expenseHistory || expenseHistory.length === 0) return 0;
    const total = expenseHistory.reduce((sum, val) => sum + Math.abs(val), 0);
    return total / expenseHistory.length;
}
