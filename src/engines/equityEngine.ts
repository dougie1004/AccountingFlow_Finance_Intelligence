/**
 * 🎨 Step 1 — Dilution 계산
 */
export function calculateDilution(preMoney: number, investment: number) {
  const postMoney = preMoney + investment;
  if (postMoney <= 0) {
    return { preMoney, investment, postMoney: 0, investorShare: 0, founderShare: 1 };
  }
  const investorShare = investment / postMoney;
  const founderShare = 1 - investorShare;

  return {
    preMoney,
    investment,
    postMoney,
    investorShare,
    founderShare
  };
}

/**
 * 🧩 Step 2 — Multi-round 시뮬레이션 (확장 대비)
 */
export function simulateRounds(initialFounder = 1, rounds: any[]) {
  let founder = initialFounder;
  let history: { round: number, founder: number, investor: number }[] = [];

  rounds.forEach((r, i) => {
    const post = r.preMoney + r.investment;
    const investor = r.investment / post;

    founder = founder * (1 - investor);

    history.push({
      round: i + 1,
      founder,
      investor
    });
  });

  return history;
}

/**
 * 🎯 Step 3 — Runway 기반 Funding 필요금액
 */
export function requiredFunding(
  runwayMonths: number,
  targetRunway: number,
  monthlyBurn: number
) {
  if (runwayMonths >= targetRunway) return 0;
  if (monthlyBurn <= 0) return 0;

  const gap = targetRunway - runwayMonths;
  return gap * monthlyBurn;
}

/**
 * ⚖️ Step 4 — [SSOT] Equity Control Analysis (V2.6)
 * Rule: Single Source of Truth for Control Status mapping.
 */
export type ControlState = "ABSOLUTE_CONTROL" | "BLOCKING_POWER_LOST" | "CONTROL_LOST" | "MINORITY_RISK";

export function analyzeEquityControl(preMoney: number, investment: number) {
  const { founderShare, investorShare } = calculateDilution(preMoney, investment);
  const founderPct = founderShare * 100;

  let controlState: ControlState = "ABSOLUTE_CONTROL";
  let warnings: string[] = [];

  if (founderPct >= 66.7) {
    controlState = "ABSOLUTE_CONTROL";
  } else if (founderPct >= 50.1) {
    controlState = "BLOCKING_POWER_LOST";
    warnings.push("특별결의 요건 충족 불가 (정관 개정 등 리스크)");
  } else if (founderPct >= 33.4) {
    controlState = "CONTROL_LOST";
    warnings.push("일반결의 요건 충족 불가 (경영권 취약 단계)");
  } else {
    controlState = "MINORITY_RISK";
    warnings.push("소수지분 전락 (심각한 경영권 간섭 노출)");
  }

  return {
    founderRatio: founderPct,
    dilutionRatio: investorShare,
    controlState,
    warnings
  };
}

/**
 * ⏳ Step 5 — 투자 타이밍 판단 (핵심)
 */
export function analyzeFundingTiming({
  runwayMonths,
  burnTrend,
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

  return {
    timing: "DELAY" as const,
    message: "지금은 투자 불필요 (희석 최소화 구간)",
    urgency: "LOW"
  };
}

/**
 * 💡 Step 6 — Strategic Insight (최종)
 */
export function generateEquityInsight({
  runway,
  dilution,
  control,
  timing
}: {
  runway: number;
  dilution: { investorShare: number; founderShare: number };
  control: ControlState;
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

  if (control === "CONTROL_LOST" || control === "MINORITY_RISK") {
    return {
      status: "CONTROL_RISK",
      message: "이미 경영권이 약화된 상태입니다. 추가 희석에 각별한 주의가 필요합니다.",
      action: ["추가 희석 방지 필요", "이사 선임권 방어 전략 수립"]
    };
  }

  return {
    status: "STABLE",
    message: "현재 지분 구조에서 런웨이 확보에 집중하십시오.",
    action: ["효율적 현금 관리", "기업 가치 상승 지표 관리"]
  };
}
