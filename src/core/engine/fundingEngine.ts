// src/core/engine/fundingEngine.ts

export type ControlState =
  | 'ABSOLUTE_CONTROL'
  | 'DILUTED_CONTROL'
  | 'CONTROL_LOST';

export interface FundingPolicy {
  thresholdMonths: number;   // ex: 1
  bufferMonths: number;      // ex: 3
  baseValuation: number;     // 기준 valuation
}

export interface FundingEvent {
  date: string;
  amount: number;
  preMoneyValuation: number;
}

export interface FundingImpact {
  triggered: boolean;

  runway: number;

  valuation?: number;
  dilution?: number;

  founderEquityBefore?: number;
  founderEquityAfter?: number;

  controlStateAfter?: ControlState;

  message?: string;
}

export function calculateRunway(cash: number, monthlyBurn: number): number {
  if (monthlyBurn <= 0) return Infinity;
  return cash / monthlyBurn;
}

// 🔥 Runway 기반 valuation 압박
export function estimateValuation(
  runway: number,
  baseValuation: number
): number {
  if (runway < 3) return baseValuation * 0.5;   // 급박
  if (runway < 6) return baseValuation * 0.7;   // 약한 협상력
  return baseValuation;                         // 정상
}

export function calculateDilution(
  fundingAmount: number,
  preMoney: number
): number {
  const postMoney = preMoney + fundingAmount;
  return fundingAmount / postMoney;
}

export function getControlState(equity: number): ControlState {
  if (equity > 0.5) return 'ABSOLUTE_CONTROL';
  if (equity > 0.2) return 'DILUTED_CONTROL';
  return 'CONTROL_LOST';
}

export function generateStrategicMessage(params: {
  runway: number;
  dilution: number;
  controlState: ControlState;
}): string {
  const { runway, dilution, controlState } = params;

  if (runway < 3 && controlState === 'ABSOLUTE_CONTROL') {
    return `🔥 Survival risk → likely dilution (${(dilution * 100).toFixed(1)}%)`;
  }

  if (controlState === 'DILUTED_CONTROL') {
    return `⚠️ Survived, but control weakened (-${(dilution * 100).toFixed(1)}%)`;
  }

  if (controlState === 'CONTROL_LOST') {
    return `💀 Control lost to survive (-${(dilution * 100).toFixed(1)}%)`;
  }

  return `Balanced position`;
}

export function evaluateFundingImpact(params: {
  date: string;

  cash: number;
  monthlyBurn: number;

  founderEquity: number;

  policy: FundingPolicy;
  fundingAmount: number;
}): FundingImpact {
  const {
    cash,
    monthlyBurn,
    founderEquity,
    policy,
    fundingAmount
  } = params;

  const runway = calculateRunway(cash, monthlyBurn);

  const triggerThreshold = policy.thresholdMonths + policy.bufferMonths;

  if (runway >= triggerThreshold) {
    return {
      triggered: false,
      runway
    };
  }

  // 1. valuation
  const valuation = estimateValuation(runway, policy.baseValuation);

  // 2. dilution
  const dilution = calculateDilution(fundingAmount, valuation);

  // 3. equity 변화
  const founderEquityAfter = founderEquity * (1 - dilution);

  // 4. control
  const controlStateAfter = getControlState(founderEquityAfter);

  // 5. message
  const message = generateStrategicMessage({
    runway,
    dilution,
    controlState: controlStateAfter
  });

  return {
    triggered: true,
    runway,
    valuation,
    dilution,
    founderEquityBefore: founderEquity,
    founderEquityAfter,
    controlStateAfter,
    message
  };
}
