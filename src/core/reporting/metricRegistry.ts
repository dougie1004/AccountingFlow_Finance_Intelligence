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

const CASH_ACCOUNTS = [
    'acc_101', // 현금
    'acc_102', // 당좌예금 (Liquid)
    'acc_103', // 보통예금 (Liquid)
    'acc_106', // 기타예금 (Liquid)
];
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

        // 🔥 [SSOT v8] Cumulative Drawdown Simulation
        const sortedMonths = Array.from(monthlyDeltas.keys()).sort();
        let runningCash = liquidity;
        let monthsToZero = 0;
        
        for (const m of sortedMonths) {
            const d = monthlyDeltas.get(m) || 0;
            runningCash += d;
            if (runningCash <= 0) break;
            monthsToZero++;
            if (monthsToZero >= 36) break;
        }

        const exhaustionMonth = (runningCash > 0 && monthsToZero >= sortedMonths.length) ? 36.1 : monthsToZero;

        return {
            value: exhaustionMonth,
            isInfinite: exhaustionMonth >= 36,
            label: exhaustionMonth >= 36 ? "36.0+ 개월" : `${exhaustionMonth.toFixed(1)}개월`,
            inputs: { '현재 유동성': liquidity, '임계 예상 지점': exhaustionMonth.toFixed(1) + '개월' },
            formula: '누적 현금 흐름 순차 소진 모델 (Sequential Cash-Out)',
            period: '미래 지표 분석',
            dataSource: 'scenario'
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
    calculateBurnMultiple: (futureLedger: JournalEntry[], date: string): MetricResult => {
        const futureEntries = futureLedger.filter(e => e.date > date);
        let rev = 0; let exp = 0;
        futureEntries.forEach(e => {
            if (e.type === 'Revenue') rev += e.amount;
            else if (e.type === 'Expense' || e.type === 'Payroll') exp += e.amount;
        });
        const netBurn = (exp - rev) > 0 ? (exp - rev) : 0;
        const newRevenue = rev; 

        // [V11] Normalize to Monthly Average for intuitive interpretation
        const months = futureEntries.length > 0 ? new Set(futureEntries.map(e => e.date.substring(0, 7))).size : 1;
        const avgNetBurn = netBurn / months;
        const avgNewRevenue = newRevenue / months;
        
        // Burn Multiple = Net Burn / New Revenue (Ratio remains same as Total/Total)
        const value = newRevenue > 0 ? (netBurn / newRevenue) : (netBurn > 0 ? Infinity : 0);
        
        return {
            value,
            inputs: { 
                '시뮬레이션 월평균 순 적자(Burn)': Math.round(avgNetBurn).toLocaleString(), 
                '시뮬레이션 월평균 신규 매출': Math.round(avgNewRevenue).toLocaleString(),
                '분석 대상 기간': months + '개월'
            },
            formula: '월평균 Net Burn / 월평균 신규 매출',
            period: `시나리오 ${months}개월 분석`,
            dataSource: 'scenario' as MetricSource,
            label: value === 0 ? "Excellent (Profitable)" : value === Infinity ? "N/A" : (value <= 1.0 ? "Excellent" : value <= 2.0 ? "Good" : "Warning")
        };
    },
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
    },
    getStrategicKPIs: (params: any) => {
        return {
            survival: {
                runway: params.projectedRunway,
                liquidity: params.liquidityRunway,
                status: params.projectionResult
            },
            efficiency: {
                burnMultiple: params.burnMultipleResult,
                burnBridge: {
                    value: params.burnBridge.diff || 0,
                    inputs: {
                        'Operating Burn (P&L)': params.burnBridge.pnlBurn,
                        'Cash Out (Actual)': params.burnBridge.cashOut,
                        'Status': params.burnBridge.explanation || ""
                    },
                    formula: 'Operating Burn (P&L) - Cash Out (Cash)',
                    period: 'Historical Average',
                    dataSource: 'actual' as MetricSource
                }
            },
            breakEven: {
                monthly: {
                    value: params.breakEvenMonth || 0,
                    label: params.breakEvenMonth ? `${params.breakEvenMonth}개월` : "N/A",
                    formula: '월간 수익 >= 운영 비용 시점',
                    dataSource: 'scenario' as MetricSource
                },
                cumulative: {
                    value: params.cumulativeBreakEvenMonth || 0,
                    label: params.cumulativeBreakEvenMonth ? `${params.cumulativeBreakEvenMonth}개월` : "N/A",
                    formula: 'Σ(과거 실적 + 미래 예측) >= 0 시점',
                    dataSource: 'scenario' as MetricSource
                }
            },
            risk: {
                deathValley: {
                    value: params.minCash || 0,
                    formula: '최저 예상 잔액 지점 추적',
                    dataSource: 'scenario' as MetricSource
                }
            }
        };
    }
};

// Force refresh
console.log("[MetricRegistry] Core Engine Initialized.");
