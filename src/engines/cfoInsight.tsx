import { Info, Zap, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const INSIGHT_UI_MAP: Record<string, any> = {
  CRITICAL: {
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    Icon: AlertTriangle,
    label: "생존 위기"
  },
  J_CURVE: {
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    Icon: TrendingUp,
    label: "성장 궤도 진입"
  },
  GROWING: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    Icon: TrendingUp,
    label: "수익성 개선 중"
  },
  STABLE: {
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
    Icon: Minus,
    label: "현상 유지"
  },
  DECLINING: {
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    Icon: TrendingDown,
    label: "수익성 악화"
  }

};

/**
 * 📊 CFO Insight Generator (Scenario-Based)
 * Rule: Uses projected chart data and calculated metrics to evaluate strategic health.
 */
export function generateCFOInsight({ projection, metrics }: { projection: any[], metrics: any }) {
  if (!projection || !metrics) return null;

  const runway = metrics.runwayMonths;
  const cashTrend = projection.filter(d => d.isFuture).map(m => m.ScenarioCash);
  const profitTrend = projection.filter(d => d.isFuture).map(m => m.ScenarioProfit);

  // 1. 생존 위험 (현금 고갈)
  if (runway < 6) {
    return {
      status: "CRITICAL",
      message: "현금 고갈 위험이 매우 높습니다.",
      reason: [`Runway < 6개월 (현재 ${runway.toFixed(1)}개월)`],
      action: ["비용 구조 즉시 재검토", "런웨이 확보를 위한 자금 조달 준비"]
    };
  }

  // 2. 수익성 악화 추세
  const lastProfit = profitTrend[profitTrend.length - 1];
  const firstProfit = profitTrend[0];

  if (lastProfit < 0 && lastProfit < firstProfit) {
    return {
      status: "DECLINING",
      message: "수익성이 지속적으로 악화되는 시나리오입니다.",
      reason: ["영업 비용 상승폭이 매출 성장을 상회"],
      action: ["매출 성장 가속화 전략", "고정비 효율화"]
    };
  }

  // 3. 성장 패턴 (J-Curve)
  if (lastProfit > 0 && firstProfit <= 0) {
    return {
      status: "J_CURVE",
      message: "시뮬레이션 기간 내 흑자 전환이 예상됩니다.",
      reason: ["공격적 투자가 수익으로 전환되는 구간"],
      action: ["현금 흐름 모니터링 강화", "성장 동력 집중 투입"]
    };
  }

  // 4. 안정적 성장
  if (lastProfit > firstProfit && lastProfit > 0) {
    return {
      status: "GROWING",
      message: "안정적인 수익 성장이 기대되는 전략입니다.",
      reason: ["지속적인 영업 이익률 개선"],
      action: ["기존 전략 유지 및 확장", "재투자 기회 모색"]
    };
  }

  return {
    status: "STABLE",
    message: "현재 수준의 운영 안정성이 유지됩니다.",
    reason: ["급격한 지표 변동 없는 완만한 흐름"],
    action: ["운영 효율 극대화"]
  };
}

