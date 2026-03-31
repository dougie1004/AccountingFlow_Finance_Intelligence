import { calculateSequentialRunway, calculateCashRunway } from '../core/metrics/metricRegistry';

export interface StrategicEngineInput {
    chartData: any[];
    ssotMetrics: any;
    projectionLedger: any[];
    selectedDate: string;
    preMoneyValuation: number;
    investmentAmount: number;
    actualNetProfit: number;
    liquidCash: any; // Object { value, inputs, ... }
}

/**
 * [PHASE 2 CRITICAL FIX] Strategic Compass Interpreter Engine
 * 엔진은 더 이상 계산하지 않습니다. 주입된 데이터를 해석만 합니다.
 */
export function runStrategicCompassEngine(input: StrategicEngineInput) {
    const { 
        chartData, ssotMetrics, projectionLedger, selectedDate, 
        preMoneyValuation, investmentAmount, actualNetProfit, liquidCash 
    } = input;

    // 1. 입력 무결성 검증 로깅 (Rule: Force Data Injection)
    console.log("[ENGINE INPUT SIZE]", {
        chartData: chartData.length,
        cashFlow: ssotMetrics.cashflow?.length,
        ledger: projectionLedger.length
    });

    const currentYearMonth = selectedDate.substring(0, 7);
    const nowIndex = chartData.findIndex((d: any) => d.isNow);
    const currentCash = liquidCash?.value || 0;

    // 2. Metrics & Burn Average (Injection 기반)
    // [PHASE 2 FORCED SYNC]
    const RECENT_WINDOW = 6;
    const startIdx = Math.max(0, nowIndex - RECENT_WINDOW);
    const endIdx = nowIndex; 
    const historicalSlice = chartData.slice(startIdx, endIdx);

    const totalOperatingIn = historicalSlice.reduce((sum: number, m: any) => sum + (m.operatingCashIn || 0), 0);
    const totalOut = historicalSlice.reduce((sum: number, m: any) => sum + (m.cashOut || 0), 0);
    const historicalCount = historicalSlice.length || 1;

    const avgOperatingIn = totalOperatingIn / historicalCount;
    const avgOut = totalOut / historicalCount;
    const netCashAvg = avgOperatingIn - avgOut;
    const netBurnValue = netCashAvg < 0 ? Math.abs(netCashAvg) : 0;

    const burnBreakdown = {
        cashIn: Math.round(avgOperatingIn),
        financingIn: 0,
        cashOut: Math.round(avgOut),
        netBurn: Math.round(netBurnValue),
        isBurning: netCashAvg < 0,
        netCashAvg: Math.round(netCashAvg),
        window: historicalSlice.length
    };
    const cashBurn = burnBreakdown.netBurn;

    // 3. Runway & Inflection Point (Injection 기반)
    const futureCashDeltas = chartData
        .filter((_, i) => i > nowIndex)
        .map(d => d.cashDelta || 0);
    const strategyMonths = chartData.filter((_, i) => i > nowIndex);

    let inflectionPoint = null;
    for (let i = 0; i < futureCashDeltas.length; i++) {
        if (futureCashDeltas[i] < 0) {
            inflectionPoint = { monthsOffset: i + 1, date: strategyMonths[i].fullMonth };
            break;
        }
    }

    const runway = {
        value: calculateSequentialRunway({ currentCash: liquidCash?.value || 0, futureCashDeltas }),
        inflectionPoint,
        inputs: {
            'Gross Cash': currentCash,
            'Net Liquidity': liquidCash?.value || 0,
            'Cash Burn (Avg)': Math.round(cashBurn),
            'Start Period': selectedDate
        },
        formula: 'CASH VIEW: Sequential Cash-Out',
        period: '시뮬레이션 예측',
        dataSource: 'scenario' as any,
        monthlyDeltas: ssotMetrics.cashflow.map((cf: any) => ({ date: cf.date, cashDelta: cf.delta }))
    };

    const liquidityRunway = {
        value: calculateCashRunway(liquidCash?.value || 0, cashBurn),
        inputs: { 'Net Liquidity': liquidCash?.value || 0, 'Cash Burn': Math.round(cashBurn) },
        formula: 'CASH VIEW: Liquidity / Cash Burn',
        period: '유동성 기준 런웨이',
        dataSource: 'scenario' as any
    };

    const metricResults = {
        liquidCash,
        runway,
        projectedRunway: runway,
        liquidityRunway,
        cashBurn,
        burnBreakdown,
        burnBridge: { pnlBurn: 0, cashOut: Math.round(avgOut), diff: 0 } 
    };

    // 4. Trajectory analysis
    let cashOutMonthIdx = null;
    let breakEvenMonthIdx = null;
    let minCashValue = Infinity;
    for (let i = 0; i < chartData.length; i++) {
        if (chartData[i].isFuture) {
            if (chartData[i].ScenarioCash < minCashValue) minCashValue = chartData[i].ScenarioCash;
            if (cashOutMonthIdx === null && chartData[i].ScenarioCash < 0) {
                cashOutMonthIdx = i;
            }
            if (breakEvenMonthIdx === null && chartData[i].ScenarioProfit > 0) {
                breakEvenMonthIdx = i;
            }
        }
    }

    const stats = {
        ...metricResults,
        liquidCash, 
        cashBalance: liquidCash?.value || 0,
        runwayMonths: runway.value,
        strategicRunway: runway.value,
        survivalRunway: liquidityRunway.value,
        cashBurn: cashBurn,
        netBurn: burnBreakdown.netBurn,
        grossBurn: burnBreakdown.cashOut,
        actualNetProfit,
        liquidityRunwayMonths: liquidityRunway.value,
        breakEvenMonth: breakEvenMonthIdx,
        cashOutMonth: cashOutMonthIdx,
        minCash: minCashValue,
        insight: (metricResults as any).insight || (input as any).insight
    };

    return {
        projectionLedger,
        ssotMetrics,
        metricResults,
        chartData,
        equityAnalysis: null, 
        stats
    };
}
