// src/core/metrics/metricRegistry.ts

export interface RunwayInput {
  currentCash: number;          // latest actual cash ONLY
  futureCashDeltas: number[];   // projectionLedger 기반 ONLY
}

/**
 * 1. Operating Burn (ACCRUAL)
 * = 총 비용 / 기간 (P&L 기준)
 * 최근 N개 기간 중 실질 지출이 있는 달만 선별하여 계산 가능
 */
export function calculateOperatingBurn(totalExpenses: number, months: number): number {
    if (months <= 0) return 0;
    // Note: If totalExpenses is 0, it returns 0. 
    // If the caller provides the average of non-zero months, it's better.
    return Math.abs(totalExpenses) / months;
}

/**
 * [V2.8.1] Robust Operating Burn for P&L
 * Filter out zero-expense months from a series
 */
export function calculateRobustOperatingBurn(expenseSeries: number[]): number {
    const validMonths = expenseSeries.filter(v => v > 0);
    if (validMonths.length === 0) return 0;
    return validMonths.reduce((a, b) => a + b, 0) / validMonths.length;
}

/**
 * [V12] Raw-Entry Based Burn Calculation (REPLACES aggregate logic)
 * Ensures deterministic distinction between Inflow/Outflow.
 */
export function calculateBurn(entries: any[]) {
    if (!entries || entries.length === 0) {
      console.log("🔥 [Burn Fixed] Empty entries");
      return { inflow: 0, outflow: 0, netBurn: 0, grossBurn: 0 };
    }
  
    let inflow = 0;
    let outflow = 0;
  
    for (const e of entries) {
      const amount = Number(e.amount) || 0;
      const type = (e.type || "").toUpperCase();
  
      // ✅ 현금 유입/유출 라벨 기반 처리
      if (type === "INFLOW" || (e.scope === 'future' && amount > 0)) {
        inflow += Math.abs(amount);
      } else if (type === "OUTFLOW" || (e.scope === 'future' && amount < 0)) {
        outflow += Math.abs(amount);
      }
    }
  
    const grossBurn = outflow;
    // 🔥 핵심 수정: netBurn은 반드시 양수(소진) 또는 0(건강)
    const netBurn = Math.max(outflow - inflow, 0);
  
    console.log("🔥 [Burn Fixed]", {
      inflow,
      outflow,
      netBurn,
      grossBurn,
      totalEntries: entries.length
    });
  
    return {
      inflow,
      outflow,
      netBurn,
      grossBurn
    };
}

/**
 * [V11 FIX] Cash Burn Breakdown (Aggregated Version) - Deprecated in favor of calculateBurn
 */
export function calculateCashBurnBreakdown(monthlyData: { cashIn: number, cashOut: number }[]) {
    if (!monthlyData || monthlyData.length === 0) return { cashIn: 0, cashOut: 0, netBurn: 0 };
    
    const count = monthlyData.length;
    const totalIn = monthlyData.reduce((a, b) => a + (b.cashIn || 0), 0);
    const totalOut = monthlyData.reduce((a, b) => a + (b.cashOut || 0), 0);
    
    const avgIn = totalIn / count;
    const avgOut = totalOut / count;

    const netCash = avgIn - avgOut;
    const netBurn = netCash < 0 ? Math.abs(netCash) : 0;

    return {
        cashIn: Math.round(avgIn),
        cashOut: Math.round(avgOut),
        netBurn: Math.round(netBurn)
    };
}

/**
 * 2. Cash Burn (CASH) - Standard Wrapper
 */
export function calculateCashBurn(futureCashDeltas: number[]): number {
    const monthlyData = futureCashDeltas.map(d => ({
        cashIn: d > 0 ? d : 0,
        cashOut: d < 0 ? Math.abs(d) : 0
    }));
    const breakdown = calculateCashBurnBreakdown(monthlyData);
    return breakdown.netBurn;
}

/**
 * OLD version support (deprecated) - converts raw deltas to positive/negative split
 * Use this ONLY if monthly aggregation is not possible.
 */
export function calculateCashBurnBreakdownLegacy(deltas: number[]) {
    const monthlyData = deltas.map(d => ({
        cashIn: d > 0 ? d : 0,
        cashOut: d < 0 ? Math.abs(d) : 0
    }));
    return calculateCashBurnBreakdown(monthlyData);
}

/**
 * [Standardized] Runway Calculation
 * Formula: Runway = Net Liquidity / Cash Burn
 */
export function calculateCashRunway(netLiquidity: number, cashBurn: number): number | null {
    if (cashBurn <= 0) return null; // [V12] Infinity 금지
    const runway = netLiquidity / cashBurn;
    return runway > 0 ? runway : 0;
}

/**
 * [Scenario Model] Sequential Cash-Out (Legacy Support for Strategic Compass)
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
      if (delta >= 0) break; // 🔥 [V12] Sustainable/Income -> Simulation break for runway
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

// Deprecated: use specific burn functions
export function calculateAvgBurn(futureCashDeltas: number[]): number {
    return calculateCashBurn(futureCashDeltas);
}

export function calculateRunway(input: RunwayInput): number {
    return calculateSequentialRunway(input);
}
