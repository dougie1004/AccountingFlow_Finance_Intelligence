/**
 * ⚖️ Equity Intelligence Engine (Strategic Ownership Focus)
 * [CONSTITUTION V2.6]
 * Rule: CFO = Operations/Cash-Out, Equity = Control/Dilution.
 */

export interface EquityInput {
    runway: number;
    fundingAmount: number;
    preMoneyValuation: number;
}

export interface EquityInsight {
    status: 'SAFE' | 'DILUTION_RISK' | 'CONTROL_LOSS';
    message: string;
    action?: string[];
}

/**
 * 🎯 핵심 로직: 지배력 및 희석 리스크 판단
 * Equity는 '상태 판단'에 집중한다 (Projection 흐름을 보지 않음)
 */
export function generateEquityInsight(input: EquityInput): EquityInsight {
    const { runway, fundingAmount, preMoneyValuation } = input;

    // 지분 희석율 계산 (신규 투자 건에 대한 추정 희석)
    const totalValuation = preMoneyValuation + fundingAmount;
    const dilution = totalValuation > 0 ? fundingAmount / totalValuation : 0;

    // 🔥 핵심 리스크 판단 로직
    if (runway < 6 && dilution > 0.25) {
        return {
            status: 'CONTROL_LOSS',
            message: '단기 생존을 위해 높은 지분 희석 필요 (지배력 상실 위험)',
            action: ['이사 선임권 방어 전략 수립', '경영권 보호 정관 재검토']
        };
    }

    if (runway < 12 && dilution > 0.15) {
        return {
            status: 'DILUTION_RISK',
            message: '지분 희석 부담 존재 (투자 타이밍 조정 필요)',
            action: ['기업 가치(Valuation) 상승 후 투자 고려', '투자 유치 규모 축소 검토']
        };
    }

    return {
        status: 'SAFE',
        message: '지분 구조 안정적',
        action: ['현재 지분 구조 유지', '장기적 재무 로드맵 관리']
    };
}
