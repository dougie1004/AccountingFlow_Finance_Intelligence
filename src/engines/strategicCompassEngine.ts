import { calculateSequentialRunway, calculateCashRunway, calculateBurn } from '../core/metrics/metricRegistry';

export interface StrategicEngineInput {
    chartData: any[];
    ssotMetrics: any;
    projectionLedger: any[];
    selectedDate: string;
    preMoneyValuation: number;
    investmentAmount: number;
    actualNetProfit: number;
    liquidCash: any; // Object { value, inputs, ... }
    actualLedger?: any[]; // Raw ledger access
    asOfDate?: string;     // Sync with dashboard date
}

/**
 * [PHASE 2 CRITICAL FIX] Strategic Compass Interpreter Engine
 * 엔진은 더 이상 직접 연산하지 않고, 주입된 데이터의 상태를 정렬하여 전달합니다.
 */
export function runStrategicCompassEngine(input: StrategicEngineInput) {
    const { 
        chartData, ssotMetrics, projectionLedger, selectedDate, 
        preMoneyValuation, investmentAmount, actualNetProfit, liquidCash,
        actualLedger = []
    } = input;

    // 🔥 [V13.1] DATA BOUNDARY RESTORATION
    // 1. Burn(소모액) 및 현재 지표는 오직 '과거 실적(Actual)' 기반으로 앵커링한다.
    const burnResult = calculateBurn(actualLedger);
    const months = actualLedger.length > 0 ? new Set(actualLedger.map(e => e.date.substring(0, 7))).size : 1;
    const avgInflow = (burnResult.revenue || 0) / (months || 1);
    const avgOutflow = (burnResult.expenses || 0) / (months || 1);

    const burnBreakdown = {
        cashIn: avgInflow,
        cashOut: avgOutflow,
        netCashAvg: avgOutflow - avgInflow,
        isBurning: avgOutflow > avgInflow
    };

    const runway = {
        survival: calculateCashRunway(liquidCash.value, burnBreakdown.netCashAvg),
        strategic: calculateSequentialRunway({ 
            currentCash: liquidCash.value, 
            futureCashDeltas: ssotMetrics.cashflow.map((cf: any) => cf.delta) 
        })
    };

    const inputs = {
        cash: liquidCash?.value || 0,
        inflow: avgInflow,
        outflow: avgOutflow
    };

    const stats = {
        netBurn: burnBreakdown.netCashAvg,
        grossBurn: burnBreakdown.cashOut,

        burnBreakdown,   // 🔥 UI CONTRACT
        runway,          // 🔥 UI CONTRACT
        inputs,          // 🔥 UI CONTRACT

        survivalRunway: runway.survival,
        strategicRunway: runway.strategic,
        cashBalance: liquidCash?.value || 0,
        liquidCash, // 🔥 RESTORED FOR UI COMPATIBILITY
        actualNetProfit,
        insight: {
            label: burnBreakdown.isBurning ? "현금 흐름 개선 필요" : "현금 흐름 최적화 상태",
            message: burnBreakdown.isBurning 
                ? "현재 소모율 대비 매출 유입이 부족합니다. 비용 효율화 및 매출 가속화 전략이 필요합니다."
                : "매출 유입이 지출 규모를 상회하고 있습니다. 성장성 가속을 위한 재투자를 고려하십시오.",
            color: burnBreakdown.isBurning ? "text-rose-400" : "text-emerald-400"
        }
    };

    return {
        chartData,
        stats
    };
}
