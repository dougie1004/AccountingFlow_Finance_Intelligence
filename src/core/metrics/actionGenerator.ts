import { JournalEntry, FinancialSummary, AccountDefinition } from '../../types';

export interface TacticalAction {
    id: string;
    type: 'critical' | 'warning' | 'info';
    label: string;
    description: string;
    impact?: string;
    category?: 'LIQUIDITY' | 'FUNDING' | 'EFFICIENCY' | 'GROWTH' | 'RISK';
}

const formatCurrency = (val: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(val);

/**
 * [V3 Action Layer] Tactical Intelligence Generator
 * Converts raw metrics into executive-level decision support.
 */
export function generateTacticalActions(
    financials: FinancialSummary,
    runway: number,
    reliability: number
): TacticalAction[] {
    const actions: TacticalAction[] = [];

    // 1. Runway Criticality (Cash Management)
    if (runway <= 1) {
        actions.push({
            id: 'act_liquidity_crisis',
            type: 'critical',
            label: '🚨 30일 내 긴급 자금 확보 필요',
            description: `현재 가용 현금(${formatCurrency(financials.cash)})으로 한 달을 버티기 어렵습니다. 즉각적인 유입 대책이 필요합니다.`,
            impact: 'Survival',
            category: 'LIQUIDITY'
        });
    } else if (runway < 3) {
        actions.push({
            id: 'act_funding_urgent',
            type: 'critical',
            label: '⚠️ 3개월 내 자금 수혈 시급',
            description: '운영 자금이 90일 미만입니다. 브릿지 론 또는 긴급 펀딩 라운드 개시를 추천합니다.',
            impact: '+3m Runway',
            category: 'FUNDING'
        });
    } else if (runway < 6) {
        actions.push({
            id: 'act_efficiency_audit',
            type: 'warning',
            label: '⚠️ 6개월 내 자금 확보 권고',
            description: '안정권(6개월) 미만으로 진입했습니다. 불필요한 고정비 지출을 점검하고 효율성을 높여야 합니다.',
            impact: 'Burn Reduction',
            category: 'EFFICIENCY'
        });
    }

    // 2. Data Reliability Audit
    if (reliability < 80) {
        actions.push({
            id: 'action_reliability',
            type: 'warning',
            label: '📊 데이터 신뢰도 저하: 비용 전수 검토 권고',
            description: `장부의 ${100 - reliability}%가 AI 추론 단계에 머물러 있습니다. 주요 비용 항목에 대한 사용자 확정이 필요합니다.`,
            impact: '재무 정합성 확보'
        });
    }

    // 3. Efficiency Check (Burn Multiple approximation)
    const netBurn = Math.max(financials.expenses - financials.revenue, 0);
    if (netBurn > 0 && financials.revenue > 0) {
        const burnMultiple = netBurn / financials.revenue;
        if (burnMultiple > 2.5) {
            actions.push({
                id: 'action_efficiency',
                type: 'warning',
                label: '💸 자금 효율성 경보 (Burn Multiple)',
                description: '매출액 대비 현금 소모량이 과도합니다. 마케팅 채널별 효율성(CAC) 재검토와 비핵심 고정비 삭감을 제안합니다.',
                impact: '런웨이 2.5개월 연장 기대'
            });
        }
    }

    // 4. Structural Risk: Payroll Concentration
    if (financials.expenses > 0 && (financials.payrollExpenses / financials.expenses) > 0.6) {
        actions.push({
            id: 'action_payroll',
            type: 'info',
            label: '👤 인건비 비중 과다 (60% 초과)',
            description: '전체 지출 중 인건비가 차지하는 비중이 매우 높습니다. 신규 채용 동결 및 외주 리소스 효율화가 필요한 시점입니다.',
            impact: '영업이익률 개선'
        });
    }

    // 5. Default Success Message
    if (actions.length === 0) {
        actions.push({
            id: 'action_success',
            type: 'info',
            label: '✅ 재무 건전성 양호',
            description: '현재 지표상 즉각적인 조치가 필요한 리스크는 발견되지 않았습니다. 현재의 성장 기조를 유지하십시오.',
        });
    }

    return actions;
}
