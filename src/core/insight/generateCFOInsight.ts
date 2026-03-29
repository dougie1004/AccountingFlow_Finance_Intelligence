/**
 * [V11 NEW] Deterministic CFO Insight Generator
 * Creates Rule-based insights based on P&L and Cash comparisons.
 * Strictly no API calls (Local Function).
 */
export function generateCFOInsight({
  netCashFlow,
  operatingBurn,
  cashOut,
}: {
  netCashFlow: number;
  operatingBurn: number;
  cashOut: number;
}) {
  const isCashPositive = netCashFlow > 0;

  if (isCashPositive && operatingBurn > 0) {
    return `현재 회사는 손익 기준으로는 비용 구조를 유지하고 있으나, 현금 흐름 기준에서는 순현금 유입 상태입니다.

이는 매출 회수 타이밍 또는 미지급 비용 영향으로, 단기 유동성은 안정적이나 구조적 수익성은 추가 개선이 필요한 상태입니다.`;
  }

  if (!isCashPositive && operatingBurn > 0) {
    return `현재 회사는 손익 및 현금 흐름 모두에서 자금 유출이 발생하고 있습니다.

현금 소진 속도를 고려할 때 단기 유동성 관리가 필요하며, 비용 구조 개선 또는 자금 조달 전략 검토가 요구됩니다.`;
  }

  return `현재 회사는 현금 흐름 기준 안정 상태를 유지하고 있습니다. 단기 유동성 리스크는 낮은 수준입니다.`;
}
