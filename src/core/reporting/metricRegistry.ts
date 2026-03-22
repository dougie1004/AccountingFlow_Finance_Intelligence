import { JournalEntry, TrialBalance } from '../../types';

export type MetricSource = 'actual' | 'scenario' | 'snapshot';

export interface MetricResult {
    value: number;
    inputs: Record<string, number | string>;
    formula: string;
    period: string;
    dataSource: MetricSource;
    isInfinite?: boolean;
    label?: string;
    monthlyDeltas?: { date: string; cashDelta: number }[];
}

const CASH_ACCOUNTS = ['acc_101', 'acc_103'];
const PAYABLE_ACCOUNTS = ['acc_251', 'acc_253']; 
const ACCRUED_EXPENSES = ['acc_255'];           

export function analyzeTrajectory(cashSeries: number[]) {
  if (!cashSeries || cashSeries.length === 0) return null;
  const last = cashSeries[cashSeries.length - 1];
  const first = cashSeries[0];
  const slope = (last - first) / cashSeries.length;

  return {
    last,
    slope,
    trend: slope > 0 ? "IMPROVING" : slope < 0 ? "DETERIORATING" : "FLAT"
  };
}

export const MetricRegistry = {
    calculateLiquidCash: (tb: TrialBalance): MetricResult => {
        let cash = 0;
        Object.values(tb).forEach(item => {
            if (CASH_ACCOUNTS.includes(item.meta.id)) {
                cash += (item.closingDebit - item.closingCredit);
            }
        });
        return { 
            value: cash, 
            inputs: { '현금 잔액': cash }, 
            formula: '현금 계정 합계', 
            period: '현재 시점', 
            dataSource: 'actual' 
        };
    },

    calculateLiquidity: (tb: TrialBalance): MetricResult => {
        let cash = 0;
        let payables = 0;
        let accruals = 0;

        Object.values(tb).forEach(item => {
            const id = item.meta.id;
            const balance = item.closingDebit - item.closingCredit;

            if (CASH_ACCOUNTS.includes(id)) cash += balance;
            if (PAYABLE_ACCOUNTS.includes(id)) payables += -balance; 
            if (ACCRUED_EXPENSES.includes(id)) accruals += -balance;
        });

        // ✅ Pure logic: Just the 3 things
        return {
            value: cash - (payables + accruals),
            inputs: {
                '현금 잔액': cash,
                '미지급금': payables,
                '미지급비용': accruals
            },
            formula: '현금 - (미지급금 + 미지급비용)',
            period: '현재 시점',
            dataSource: 'actual',
            label: `순유동성: ${Math.round(cash - (payables + accruals)).toLocaleString()}`
        };
    },

    calculateRunway: (liquidity: number, ledger: JournalEntry[], selectedDate: string): MetricResult => {
        const expenses = ledger.filter(e => 
            e.date <= selectedDate && (e.type === 'Expense' || e.type === 'Payroll')
        );
        
        const monthlyBurn = new Map<string, number>();
        expenses.forEach(e => {
            const m = e.date.substring(0, 7);
            monthlyBurn.set(m, (monthlyBurn.get(m) || 0) + e.amount);
        });

        const sortedBurn = Array.from(monthlyBurn.values()).slice(-3);
        const avgBurn = sortedBurn.length > 0 
            ? sortedBurn.reduce((a, b) => a + b, 0) / sortedBurn.length 
            : 0;

        if (avgBurn <= 0) return { value: 24, isInfinite: true, label: "Sustainable", inputs: {}, formula: '', period: '', dataSource: 'actual' };

        const runway = Math.min(liquidity / avgBurn, 24);

        return {
            value: Math.round(runway * 10) / 10,
            isInfinite: runway >= 24,
            label: runway >= 24 ? "24.0+ 개월" : `${runway.toFixed(1)}개월`,
            inputs: { '순유동성': liquidity, '평균 소모액 (최근 3개월)': avgBurn },
            formula: '유동성 / 평균 소모액',
            period: '최근 3개월 평균',
            dataSource: 'actual'
        };
    },

    calculateProjectedRunway: (liquidity: number, scenarioLedger: JournalEntry[], selectedDate: string): MetricResult => {
        const futureEntries = scenarioLedger.filter(e => e.date > selectedDate);
        const monthlyDeltas = new Map<string, number>();

        futureEntries.forEach(e => {
            const month = e.date.substring(0, 7);
            let delta = 0;
            if (e.type === 'Revenue') delta += e.amount;
            else delta -= e.amount;
            
            monthlyDeltas.set(month, (monthlyDeltas.get(month) || 0) + delta);
        });

        const sortedMonths = Array.from(monthlyDeltas.keys()).sort();
        let runningLiquidity = liquidity;
        let exhaustionMonth = -1;

        for (let i = 0; i < sortedMonths.length; i++) {
            runningLiquidity += (monthlyDeltas.get(sortedMonths[i]) || 0);
            if (runningLiquidity <= 0) {
                exhaustionMonth = i + 1;
                break;
            }
        }

        return {
            value: exhaustionMonth === -1 ? 24.1 : exhaustionMonth,
            isInfinite: exhaustionMonth === -1,
            label: exhaustionMonth === -1 ? "24.0+ 개월" : `${exhaustionMonth}개월`,
            inputs: { '현재 유동성': liquidity },
            formula: '누적 현금 흐름 (시나리오 필터링)',
            period: '미래 지표 분석',
            dataSource: 'scenario',
            monthlyDeltas: sortedMonths.map(m => ({ date: m, cashDelta: monthlyDeltas.get(m) || 0 }))
        };
    },

    getObligationsWithin: (ledger: JournalEntry[], days: number): number => {
        const now = new Date();
        const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const limitStr = limit.toISOString().substring(0, 10);
        
        return ledger
            .filter(e => e.date <= limitStr && (PAYABLE_ACCOUNTS.includes(e.debitAccountId!) || ACCRUED_EXPENSES.includes(e.debitAccountId!)))
            .reduce((sum, e) => sum + e.amount, 0);
    },

    calculateNetProfit: (tb: TrialBalance): MetricResult => {
        let rev = 0; let exp = 0;
        Object.values(tb).forEach(i => {
            if (i.meta.nature === 'REVENUE') rev += (i.movementCredit - i.movementDebit);
            if (i.meta.nature === 'EXPENSE') exp += (i.movementDebit - i.movementCredit);
        });
        return { value: rev - exp, inputs: { '매출': rev, '비용': exp }, formula: '매출 - 비용', period: '연누계 (YTD)', dataSource: 'actual' };
    },
    calculateCashDelta: (ledger: any[], start: string, end: string): MetricResult => {
        let flow = 0;
        ledger.forEach(e => {
            if (e.date >= start && e.date <= end) {
                if (CASH_ACCOUNTS.includes(e.debitAccountId)) flow += e.amount;
                if (CASH_ACCOUNTS.includes(e.creditAccountId)) flow -= e.amount;
            }
        });
        return { value: flow, inputs: { '순금액': flow }, formula: '입금 - 출금', period: '조회 기간', dataSource: 'actual' };
    },
    analyzeProfitDrivers: (b: any[], s: any[]): any => ({ delta: 0, impact: 'NEUTRAL' }),
    getProjectionStatus: (r: number, threshold?: number, deltas?: any[]) => ({ 
        status: r < (threshold || 3) ? 'CRITICAL' : 'SAFE', 
        message: r < (threshold || 3) ? 'High Risk' : 'Stable' 
    }),
    calculateBurnMultiple: (ledger: any[], date: string): MetricResult => ({
        value: 0, inputs: {}, formula: '지출 / 연간반복매출(ARR)', period: '데이터 없음', dataSource: 'scenario'
    }),
    calculateSurvivalProbability: (r: number): MetricResult => {
        let prob = 50;
        let label = "위험 진입 (데스밸리)";
        
        if (r > 18) {
            prob = 95;
            label = "매우 안전 (안정권)";
        } else if (r > 12) {
            prob = 85;
            label = "양호 (자금 여력 충분)";
        } else if (r > 6) {
            prob = 50;
            label = "경계 (데스밸리 진입)";
        } else if (r > 3) {
            prob = 25;
            label = "매우 위험 (조달 시급)";
        } else {
            prob = 10;
            label = "부도 위기 (긴급 자금 필요)";
        }

        return {
            value: prob,
            label,
            inputs: { '현금 생존 가능 기간': r.toFixed(1) + '개월' },
            formula: '단계별 선형 사망 리스크 모델 (Statistical Sample)',
            period: '미래 예측',
            dataSource: 'scenario'
        };
    }
};

// Force refresh
console.log("[MetricRegistry] Core Engine Initialized.");
