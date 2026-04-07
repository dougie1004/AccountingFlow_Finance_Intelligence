import { calculateSequentialRunway, calculateCashRunway, calculateBurn } from '../core/metrics/metricRegistry';
import { 
    calculateDilution, 
    requiredFunding, 
    analyzeEquityControl, 
    analyzeFundingTiming, 
    generateEquityInsight 
} from './equityEngine';
import { sumCashAccounts } from '../core/ssot/cashTruth';
import { generateMonthlyPnL } from '../core/reporting/generateMonthlyPnL';
import { generateCashFlow } from '../core/reporting/generateCashFlow';
import { generateProjectionLedger, buildMetrics } from '../core/ssotEngine';
import { INSIGHT_UI_MAP } from './cfoInsight';

export interface StrategicEngineInput {
    actualLedger: any[];
    projectionLedger: any[];   // Scenario ledger from simulator
    baselineEntries: any[];
    selectedDate: string;
    preMoneyValuation: number;
    investmentAmount: number;
    liquidCashData: any;      // Pass TrialBalance-derived liquidity base (미지급금 등)
    coa: Record<string, any>; // Full COA for robust interpretatiton
    projectionMonths?: number;
}

/**
 * [V14.1 ADAPTER] Standardizes diverse ledger formats for legacy generator compatibility.
 * Ensures fields (amount, accountId, type) and date formats are consistent.
 */
function normalizeEntries(ledger: any[]): any[] {
    return (ledger || []).map(e => {
        // [CONTRACT] Ensure amount is numeric
        const amount = Number(e.amount) || 0;
        
        // [CONTRACT] Unify Account ID / Name
        const debitAccount = e.debitAccount || e.debit || "";
        const creditAccount = e.creditAccount || e.credit || "";
        const debitAccountId = e.debitAccountId || e.debitAccount;
        const creditAccountId = e.creditAccountId || e.creditAccount;

        // [CONTRACT] Date standardization (ISO-like string)
        let date = e.date;
        if (date instanceof Date) date = date.toISOString().split('T')[0];
        
        // [CONTRACT] Status & Scope
        const status = e.status || "Approved";
        const scope = (e.scope || "actual").toLowerCase();

        return {
            ...e,
            date,
            amount,
            debitAccount,
            debitAccountId,
            creditAccount,
            creditAccountId,
            status,
            scope
        };
    });
}

/**
 * [V14 SSOT OPERATION] Strategic Compass Interpreter Engine
 * UI의 모든 계산 로직을 엔진으로 이산화하여 단일 진실 공급원으로 기능한다.
 */
export function runStrategicCompassEngine(input: StrategicEngineInput) {
    const { 
        actualLedger = [], 
        projectionLedger = [], 
        baselineEntries = [],
        selectedDate, 
        preMoneyValuation, 
        investmentAmount, 
        liquidCashData,
        coa,
        projectionMonths = 36
    } = input;

    // 1. Anchor — 실질 현금 잔액 (UI의 SSOT와 동일하게 처리)
    const ACTUAL_CASH_TRUTH = sumCashAccounts(actualLedger, selectedDate);
    const offset = ACTUAL_CASH_TRUTH - (liquidCashData?.grossCash || 0);
    
    // 2. SSOT Metrics & PnL Generation (Adapter Applied)
    const normalizedActual = normalizeEntries(actualLedger);
    const normalizedScenario = normalizeEntries(projectionLedger);
    const normalizedBaseline = normalizeEntries(baselineEntries);

    const mergedScenarioLedger = [...normalizedActual, ...normalizedScenario];
    const mergedBaselineLedger = [...normalizedActual, ...normalizedBaseline];
    
    const startY = new Date(selectedDate).getFullYear();
    const endY = new Date(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth() + projectionMonths).getFullYear();
    const analysisYears = [];
    for (let y = startY - 2; y <= endY; y++) analysisYears.push(y);

    const actualPnL = generateMonthlyPnL(normalizedActual, analysisYears, selectedDate, coa);
    const scenarioPnL = generateMonthlyPnL(mergedScenarioLedger, analysisYears, selectedDate, coa);
    const baselinePnL = generateMonthlyPnL(mergedBaselineLedger, analysisYears, selectedDate, coa);
    
    const ssotMetrics = buildMetrics(generateProjectionLedger({ actualLedger: mergedScenarioLedger }));
    const baselineCashFlow = generateCashFlow(mergedBaselineLedger, 0);

    // 3. Chart Data Construction (UI-side Logic Moved Here)
    const anchorMonthFormatted = selectedDate.substring(0, 7);
    const actualPnLMap = new Map(actualPnL.map((p: any) => [p.month, p]));
    const scenarioPnLMap = new Map(scenarioPnL.map((p: any) => [p.month, p]));
    const baselinePnLMap = new Map(baselinePnL.map((p: any) => [p.month, p]));
    const baseCFMap = new Map(baselineCashFlow.map((c: any) => [c.date, c]));
    
    const nowIndexInMetrics = ssotMetrics.cashflow.findIndex((cf: any) => cf.date === anchorMonthFormatted);

    const chartData = ssotMetrics.cashflow.map((cf: any, index: number) => {
        const actual = actualPnLMap.get(cf.date);
        const scenario = scenarioPnLMap.get(cf.date);
        const baseline = baselinePnLMap.get(cf.date);
        const baseCF = baseCFMap.get(cf.date);
        
        return {
            month: cf.date.substring(2).replace('-', '/'),
            fullMonth: cf.date,
            BaselineCash: (baseCF?.cash ?? 0) + offset,
            ScenarioCash: cf.cash + offset,
            ScenarioProfit: scenario?.operatingProfit ?? 0,
            ScenarioNetIncome: scenario?.netIncome ?? 0,
            ActualProfit: index <= nowIndexInMetrics ? (actual?.operatingProfit ?? 0) : 0,
            BaselineProfit: baseline?.operatingProfit ?? 0,
            cashDelta: cf.delta || 0,
            isFuture: index > nowIndexInMetrics,
            isNow: index === nowIndexInMetrics,
            index
        };
    });

    // 4. Burn & Runway Analysis
    const burnResult = calculateBurn(actualLedger);
    const currentCash = ACTUAL_CASH_TRUTH - (Number(liquidCashData?.inputs?.['미지급금'] || 0) + Number(liquidCashData?.inputs?.['미지급비용'] || 0));
    
    const futureCashDeltas = chartData
        .filter((_, i) => i > nowIndexInMetrics)
        .map(d => d.cashDelta || 0);

    const runwayValue = calculateSequentialRunway({ currentCash, futureCashDeltas });
    const survivalRunway = calculateCashRunway(currentCash, burnResult.netBurn);

    // 5. Inflection / Milestones
    let cashOutMonthIdx = null;
    let breakEvenMonthIdx = null;
    let minCashValue = Infinity;
    for (let i = 0; i < chartData.length; i++) {
        if (chartData[i].isFuture) {
            if (chartData[i].ScenarioCash < minCashValue) minCashValue = chartData[i].ScenarioCash;
            if (cashOutMonthIdx === null && chartData[i].ScenarioCash < 0) cashOutMonthIdx = i;
            if (breakEvenMonthIdx === null && chartData[i].ScenarioProfit > 0) breakEvenMonthIdx = i;
        }
    }

    // 6. Equity & Dilution Analysis (UI Logic Migrated)
    const equityControl = analyzeEquityControl(preMoneyValuation || 1000000000, investmentAmount);
    
    const avgFutureBurn = Math.abs(futureCashDeltas.reduce((a, b) => a + b, 0) / (futureCashDeltas.length || 1)) || 1;
    const fundingNeeded = requiredFunding(runwayValue, 18, avgFutureBurn);
    const dilution = calculateDilution(preMoneyValuation || 500000000, fundingNeeded);
    const fundingTiming = analyzeFundingTiming({ runwayMonths: runwayValue });
    
    const equityInsight = generateEquityInsight({ 
        runway: runwayValue, 
        dilution, 
        control: equityControl.controlState, 
        timing: fundingTiming 
    });

    // 7. Advanced CFO Insight (Scenario Aware)
    // Mapping internal logic to INSIGHT_UI_MAP keys
    let insightKey = "STABLE";
    let customMessage = "현재 수준의 운영 안정성이 유지됩니다.";

    if (runwayValue < 6) {
        insightKey = "CRITICAL";
        customMessage = "현금 고갈 위험이 매우 높습니다. 즉각적인 조치가 필요합니다.";
    } else if (cashOutMonthIdx !== null && runwayValue < 12) {
        insightKey = "DECLINING";
        customMessage = "수익성이 지속적으로 악화되는 시나리오입니다. 런웨이 확보가 시급합니다.";
    } else if (breakEvenMonthIdx !== null && (breakEvenMonthIdx - nowIndexInMetrics) < 24) {
        insightKey = "J_CURVE";
        customMessage = "시뮬레이션 기간 내 흑자 전환이 예상됩니다. 성장 동력을 집중 투입하십시오.";
    } else if (equityControl.controlState === 'CONTROL_LOST' || equityControl.controlState === 'MINORITY_RISK') {
        insightKey = "CRITICAL";
        customMessage = "경영권 위기 단계입니다. 추가 지분 희석에 각별한 주의가 필요합니다.";
    } else if (futureCashDeltas.reduce((a, b) => a + b, 0) > 0) {
        insightKey = "GROWING";
        customMessage = "안정적인 수익 성장이 기대되는 전략입니다.";
    }

    const baseInsight = INSIGHT_UI_MAP[insightKey] || INSIGHT_UI_MAP.STABLE;
    const insight = {
        ...baseInsight,
        message: customMessage,
        // UI expects bg, border from insight object but INSIGHT_UI_MAP has bgColor, borderColor
        bg: baseInsight.bgColor,
        border: baseInsight.borderColor
    };

    const stats = {
        cashBalance: ACTUAL_CASH_TRUTH,
        liquidCash: { value: currentCash, inputs: liquidCashData?.inputs || {} },
        runway: runwayValue,
        strategicRunway: runwayValue,
        survivalRunway: survivalRunway,
        liquidityRunway: { 
            value: survivalRunway, 
            formula: 'Liquidity / Net Burn', 
            period: 'Current', 
            dataSource: 'actual',
            inputs: { 'Net Liquidity': currentCash, 'Net Burn': burnResult.netBurn }
        },
        netBurn: burnResult.netBurn,
        grossBurn: burnResult.grossBurn,
        breakEvenMonth: breakEvenMonthIdx,
        breakEvenOffset: breakEvenMonthIdx !== null ? breakEvenMonthIdx - nowIndexInMetrics : null,
        cashOutMonth: cashOutMonthIdx,
        insight,
        burnBreakdown: { 
            ...burnResult, 
            isBurning: burnResult.netBurn > 0, 
            netCashAvg: -burnResult.netBurn 
        },
        equityAnalysis: {
            fundingNeeded,
            dilution,
            control: equityControl.controlState,
            timing: fundingTiming,
            insight: equityInsight,
            fundingIndex: cashOutMonthIdx !== null ? Math.max(cashOutMonthIdx - 6, 0) : -1,
            failIndex: cashOutMonthIdx
        }
    };

    // 🚀 [V14.2 INTEGRITY AUDIT] Final Verification Logs for CPA-level Accuracy
    const totalActualRevenue = actualPnL.reduce((sum: number, p: any) => sum + p.revenue, 0);
    const totalActualExpense = actualPnL.reduce((sum: number, p: any) => sum + p.payroll + p.marketing + p.rent + p.depreciation + p.misc + p.cogs, 0);
    const totalMisc = actualPnL.reduce((sum: number, p: any) => sum + p.misc, 0);

    console.log("💎 [INTEGRITY AUDIT: CASH]", {
        DashboardTruth: liquidCashData?.grossCash || 0,
        EngineInitialCash: ACTUAL_CASH_TRUTH,
        Drift: ACTUAL_CASH_TRUTH - (liquidCashData?.grossCash || 0),
        Status: ACTUAL_CASH_TRUTH === (liquidCashData?.grossCash || 0) ? "✅ PERFECT" : "⚠️ OFFSET_APPLIED"
    });

    console.log("💎 [INTEGRITY AUDIT: REVENUE/EXPENSE]", {
        TotalPnLRevenue: totalActualRevenue,
        TotalPnLExpense: totalActualExpense,
        NetIncome: totalActualRevenue - totalActualExpense,
        MiscRatio: (totalMisc / (totalActualExpense || 1) * 100).toFixed(2) + "%",
        Status: totalMisc / (totalActualExpense || 1) < 0.1 ? "✅ STABLE" : "⚠️ REVIEW_MISC"
    });

    console.log("💎 [INTEGRITY AUDIT: MAPPING]", {
        MappedAccounts: Object.keys(coa || {}).length,
        UnmappedCheck: totalMisc === 0 ? "✅ ALL_MAPPED" : `ℹ️ ${totalMisc.toLocaleString()} in Misc`
    });

    return {
        chartData,
        stats,
        equityControl
    };
}
