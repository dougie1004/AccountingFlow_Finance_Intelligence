export type ControlState =
  | 'ABSOLUTE_CONTROL'      // ≥ 66.7%
  | 'BLOCKING_POWER_LOST'   // < 66.7%
  | 'CONTROL_LOST'          // < 50%
  | 'MINORITY_RISK';        // < 33%

export interface EquityRiskReport {
  founderRatio: number;     // UI용 (표시)
  dilutionRatio: number;    // 내부 판단용 (정확성)
  controlState: ControlState;
  warnings: string[];
}

/**
 * 🧠 Step 1 — Dilution Engine (핵심 계산)
 * Atomic core for single round calculation
 */
export function calculateDilution(preMoney: number, investment: number) {
  const postMoney = preMoney + investment;
  if (postMoney === 0) {
    return { preMoney, investment, postMoney: 0, investorShare: 0, founderShare: 1 };
  }
  const investorShare = investment / postMoney;
  const founderShare = 1 - investorShare;
  return { preMoney, investment, postMoney, investorShare, founderShare };
}

/**
 * 🔥 확장 (multi-round 대비 구조)
 * Simulates equity degradation over multiple funding events
 */
export function simulateRounds(initialFounder = 1, rounds: { preMoney: number, investment: number }[]) {
  let founder = initialFounder;
  let history: { round: number, founder: number, investor: number }[] = [];
  
  rounds.forEach((r, i) => {
    const { investorShare } = calculateDilution(r.preMoney, r.investment);
    founder = founder * (1 - investorShare);
    history.push({ 
      round: i + 1, 
      founder: roundToTwo(founder * 100) / 100, // Normalized 0-1
      investor: roundToTwo(investorShare * 100) / 100 
    });
  });
  
  return history;
}

/**
 * 🎯 Step 2 — Runway 연결 (핵심)
 * Calculates the funding needed to bridge the gap to a target runway.
 */
export function requiredFunding(runwayMonths: number, targetRunway: number, monthlyBurn: number) {
  if (runwayMonths >= targetRunway) return 0;
  const gap = targetRunway - runwayMonths;
  return gap * monthlyBurn;
}

/**
 * 🧠 Step 3 — Control 판단
 * Threshold-based control status categorization (Purely based on percentage)
 */
export function analyzeControl(founderShare: number) {
  if (founderShare >= 0.5) return "ABSOLUTE_CONTROL";
  if (founderShare >= 0.3) return "SHARED_CONTROL";
  return "CONTROL_LOST";
}

/**
 * 🔥 Step 6 — Investment Timing Engine
 * Proactive timing strategy based on survival runway
 */
export function analyzeFundingTiming({
  runwayMonths,
  burnTrend, // optional (증가/감소)
}: {
  runwayMonths: number;
  burnTrend?: "INCREASING" | "STABLE" | "DECREASING";
}) {
  if (runwayMonths < 6) {
    return {
      timing: "IMMEDIATE" as const,
      message: "즉시 투자 필요 (생존 리스크)",
      urgency: "HIGH"
    };
  }

  if (runwayMonths < 12) {
    return {
      timing: "PREPARE" as const,
      message: "투자 준비 단계 진입",
      urgency: "MEDIUM"
    };
  }

  if (runwayMonths >= 12) {
    return {
      timing: "DELAY" as const,
      message: "지금은 투자 불필요 (희석 최소화 구간)",
      urgency: "LOW"
    };
  }

  return null;
}

/**
 * 🎯 Step 4 & 6 — Strategic Insight 연결
 * Generates actionable strategy based on runway, dilution, control, and timing.
 */
export function generateEquityInsight({
  runway,
  dilution,
  control,
  timing
}: {
  runway: number;
  dilution: number;
  control: string;
  timing: { timing: string; message: string; urgency: string } | null;
}) {
  if (timing?.timing === "IMMEDIATE") {
    return {
      status: "URGENT_FUNDING",
      message: "지금 투자하지 않으면 생존이 어렵습니다.",
      action: ["즉시 투자 검토", "비용 절감 병행"]
    };
  }

  if (timing?.timing === "DELAY" && control === "ABSOLUTE_CONTROL") {
    return {
      status: "OPTIMAL_WAIT",
      message: "지금은 투자하지 않는 것이 유리합니다 (희석 최소화)",
      action: ["성장 지표 개선", "밸류에이션 상승 후 투자"]
    };
  }

  if (control === "CONTROL_LOST") {
    return {
      status: "CONTROL_LOST",
      message: "이미 경영권이 약화된 상태입니다.",
      action: ["추가 희석 방지 필요"]
    };
  }

  return null;
}

/**
 * Deterministic Equity Control Analysis Engine
 * - NO floating point threshold issues
 * - NO external dependency
 * - PURE FUNCTION
 */
export function analyzeEquityControl(
  preMoney: number,
  investment: number
): EquityRiskReport {

  // 🛡️ Guard
  if (preMoney < 0 || investment < 0) {
    throw new Error('Invalid input: negative values not allowed');
  }

  // 🔥 Use the core engine for calculation
  const { postMoney, investorShare, founderShare } = calculateDilution(preMoney, investment);

  if (postMoney === 0) {
    return {
      founderRatio: 100,
      dilutionRatio: 0,
      controlState: 'ABSOLUTE_CONTROL',
      warnings: []
    };
  }

  const dilutionRatio = investorShare;
  const founderRatio = founderShare * 100;

  // 🎯 Threshold (비율 기준)
  const THRESHOLDS = {
    ABSOLUTE: 1 / 3,     // dilution ≤ 33.333% → founder ≥ 66.7%
    CONTROL: 1 / 2,      // dilution ≥ 50% → founder ≤ 50%
    MINORITY: 2 / 3      // dilution ≥ 66.7% → founder ≤ 33%
  };

  let controlState: ControlState;
  const warnings: string[] = [];

  // 🔥 순서 중요 (위에서 아래로 내려와야 함)
  if (dilutionRatio >= THRESHOLDS.MINORITY) {
    controlState = 'MINORITY_RISK';
    warnings.push('Founder ownership below 33%');
    warnings.push('Minority position: no blocking rights');
  } 
  else if (dilutionRatio >= THRESHOLDS.CONTROL) {
    controlState = 'CONTROL_LOST';
    warnings.push('Founder ownership below 50%');
    warnings.push('Loss of board and shareholder control');
  } 
  else if (dilutionRatio > THRESHOLDS.ABSOLUTE) {
    controlState = 'BLOCKING_POWER_LOST';
    warnings.push('Founder ownership below 66.7%');
    warnings.push('Cannot unilaterally pass special resolutions');
  } 
  else {
    controlState = 'ABSOLUTE_CONTROL';
    warnings.push('Founder retains full control');
    warnings.push('Special resolutions can be passed unilaterally');
  }

  return {
    founderRatio: roundToTwo(founderRatio),
    dilutionRatio,
    controlState,
    warnings
  };
}

/**
 * UI 표시용 안정화 함수
 */
function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}
