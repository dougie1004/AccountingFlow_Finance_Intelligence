/**
 * [V11 NEW] Cash vs P&L Bridge Logic
 * Computes the gap between Accrual-based Operating Burn and Cash-based outflows.
 */
export function calculateCashVsPLBridge(
  operatingBurn: number,
  cashOut: number
) {
  const diff = operatingBurn - cashOut;

  return {
    operatingBurn,
    cashOut,
    diff,
    type:
      Math.abs(diff) < 1000
        ? "ALIGNED"
        : diff > 0
        ? "ACCRUAL_HEAVY"   // 비용 > 현금
        : "CASH_HEAVY",     // 현금 > 비용
  };
}
