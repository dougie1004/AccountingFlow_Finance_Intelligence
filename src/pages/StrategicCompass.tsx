import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Compass, TrendingUp, TrendingDown, Zap, RefreshCw, ShieldCheck, Target,
    Activity, Lock, LineChart as LineChartIcon, PieChart as PieChartIcon,
    Calculator, Database, Clock, ChevronRight, Info, AlertCircle, Layers, CheckCircle
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, Tooltip,
    ResponsiveContainer, PieChart as RePieChart, Pie, Cell, ReferenceLine, ReferenceDot, ReferenceArea, Line, Label
} from 'recharts';
import { invoke } from '@tauri-apps/api/core';
import { JournalEntry, ScenarioDefinition, MacroAssumptions } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccounting } from '../hooks/useAccounting';
import { MetricRegistry, analyzeTrajectory } from '../core/reporting/metricRegistry';
import { ExplainableKPI } from '../components/shared/ExplainableKPI';
import {
    calculateDilution,
    requiredFunding,
    analyzeEquityControl,
    analyzeFundingTiming,
    generateEquityInsight
} from '../engines/equityEngine';
import { calculateRunway, calculateAvgBurn } from '../core/metrics/metricRegistry';
import { generateCFOInsight, INSIGHT_UI_MAP } from '../engines/cfoInsight';



import { verifyJournalIntegrity } from '../utils/debugIntegrity';
import { generateMonthlyPnL } from '../core/reporting/generateMonthlyPnL';
import { generateCashFlow } from '../core/reporting/generateCashFlow';
import { projectScenarioFrontend } from '../core/simulation/strategicSimulator';

const CustomChartTooltip = ({ active, payload, label, stats }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const isCashOut = stats.cashOutMonth !== null && data.index === stats.cashOutMonth;
        const isBEP = stats.breakEvenMonth !== null && data.index === stats.breakEvenMonth;

        // Custom Sort Order: Baseline -> Scenario -> Actual
        const orderWeight: Record<string, number> = {
            'BaselineLife': 1,
            'ScenarioLife': 2,
            'ActualLife': 3
        };

        const getWeight = (name: string) => {
            if (name.includes('베이스라인')) return 1;
            if (name.includes('시나리오')) return 2;
            if (name.includes('실제')) return 3;
            return 99;
        };

        const sortedPayload = [...payload].sort((a, b) => getWeight(a.name) - getWeight(b.name));

        const cashItems = sortedPayload.filter(p => p.name.includes('현금'));
        const profitItems = sortedPayload.filter(p => p.name.includes('이익') || p.name.includes('손익'));

        const formatValue = (v: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(v);

        const scenarioProfit = data.ScenarioNetIncome ?? 0;
        const scenarioCash = data.ScenarioCash ?? 0;
        const isGenerating = scenarioProfit > 0;
        const absBurn = Math.abs(scenarioProfit);
        const monthsLeft = isGenerating ? Infinity : (absBurn > 0 ? scenarioCash / absBurn : Infinity);

        return (
            <div className="bg-[#0B1221] border border-white/5 p-6 rounded-[2.5rem] shadow-4xl min-w-[320px] backdrop-blur-2xl">
                <div className="flex justify-between items-center mb-5 border-b border-white/5 pb-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{label}</p>
                    <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${isGenerating ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {isGenerating ? '💸 Generating' : '🔥 Burning'}
                    </div>
                </div>

                {/* 💰 CASH FLOW GROUP */}
                <div className="space-y-2.5 mb-6">
                    <p className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest flex items-center gap-1.5 px-1">
                        <Database size={10} /> 현금 잔액 (Total Cumulative Cash)
                    </p>
                    {cashItems.map((entry: any, index: number) => (
                        <div key={`cash-${index}`} className="flex justify-between items-center gap-4 bg-white/5 px-4 py-3 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-[10px] font-bold text-slate-300">{entry.name}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-black text-white">{formatValue(entry.value)}</p>
                                {!isGenerating && entry.name.includes('시나리오') && (
                                    <p className="text-[8px] font-bold text-rose-400/60 mt-0.5">Est. {monthsLeft > 24 ? '24+' : monthsLeft.toFixed(1)}m left</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 📈 P&L GROUP */}
                <div className="space-y-2.5">
                    <p className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest flex items-center gap-1.5 px-1">
                        <Activity size={10} /> 월간 손익 (Monthly Cash Flow)
                    </p>
                    {profitItems.map((entry: any, index: number) => (
                        <div key={`pnl-${index}`} className="flex justify-between items-center gap-4 bg-white/5 px-4 py-3 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-[10px] font-bold text-slate-300">{entry.name}</span>
                            </div>
                            <span className="text-[11px] font-black text-white">{formatValue(entry.value)}</span>
                        </div>
                    ))}
                </div>

                {isBEP && (
                    <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-[1.5rem] flex items-center gap-3">
                        <Zap size={14} className="text-emerald-400" />
                        <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest italic">Break-even Point 달성</p>
                    </div>
                )}
                {isCashOut && (
                    <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-[1.5rem] flex items-center gap-3 animate-pulse">
                        <AlertCircle size={14} className="text-rose-400" />
                        <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest italic">Cash Out 고갈 임계점</p>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const SurvivalGauge: React.FC<{ value: number }> = ({ value }) => {
    const data = [
        { name: 'Survival', value: value, fill: value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#f43f5e' },
        { name: 'Risk', value: 100 - value, fill: 'rgba(255,255,255,0.05)' }
    ];
    return (
        <div className="w-8 h-8 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                    <Pie
                        data={data}
                        innerRadius={10}
                        outerRadius={15}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                        animationDuration={1000}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>
                </RePieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[8px] font-black text-white italic tracking-tighter">{value}%</span>
            </div>
        </div>
    );
};

const CONTROL_LABEL: Record<string, string> = {
    ABSOLUTE_CONTROL: 'ABSOLUTE CONTROL',
    BLOCKING_POWER_LOST: 'BLOCKING POWER LOST',
    CONTROL_LOST: 'CONTROL LOST',
    MINORITY_RISK: 'MINORITY RISK'
};

function getProjectionStatusUI(runway: number, horizon: number, burnMonths: { cashDelta: number }[] = []) {
    if (isNaN(runway)) {
        return {
            status: "UNKNOWN",
            message: "분석 데이터 부족",
            color: "text-slate-400",
            bg: "bg-slate-500/10"
        };
    }

    const burnCount = burnMonths.filter(m => m.cashDelta < 0).length;

    if (burnCount > 0 && burnCount < 3) {
        return {
            status: "TRANSITION",
            message: `현재 흑자 상태 (최근 ${burnCount}개월 적자)`,
            color: "text-indigo-400",
            bg: "bg-indigo-500/10"
        };
    }

    return {
        status: "SAFE",
        message: "안정적인 흐름 성찰 중",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10"
    };
}

export function getEquitySignal(runwayMonths?: number) {
    if (!runwayMonths) return null;

    if (runwayMonths < 6) {
        return {
            level: 'HIGH_RISK',
            color: '#ef4444',
            label: 'Dilution Likely'
        };
    }

    if (runwayMonths < 12) {
        return {
            level: 'MEDIUM_RISK',
            color: '#f59e0b',
            label: 'Watch Dilution'
        };
    }

    return {
        level: 'SAFE',
        color: '#10b981',
        label: 'Stable'
    };
}

export function getFundingTiming(runwayMonthsIndex?: number) {
    if (!runwayMonthsIndex) return null;

    // 너무 늦게 투자하면 위험하니까 buffer 둔다 (투자 준비 시간)
    const buffer = 3;
    const triggerMonth = Math.max(runwayMonthsIndex - buffer, 0);

    return {
        monthOffset: triggerMonth,
        label: 'Funding Needed',
        color: '#3b82f6'
    };
}

// Note: Operational (CFO) and Strategic (Equity) Insight engines have been extracted to separate modules.
// Reference: src/engines/cfoInsight.tsx and src/engines/equityEngine.ts.


const StrategicCompass: React.FC = () => {
    const {
        ledger: globalLedger,
        financials,
        selectedDate,
        setTab,
        trialBalance,
        accounts,
        baselineSnapshot,
        setBaselineSnapshot,
        scenarioResults: scenarioLedger,
        setScenarioResults: setScenarioLedger,
        baselineEntries,
        setBaselineEntries,
        baselineTimestamp,
        setBaselineTimestamp,
        revenueMult,
        setRevenueMult,
        expenseMult,
        setExpenseMult,
        fixedCostDelta,
        setFixedCostDelta,
        preMoneyValuation,
        setPreMoneyValuation,
        projectionMonths,
        setProjectionMonths,
        macro,
        setMacro,
        founderInitialOwnership,
        setFounderInitialOwnership,
        investmentAmount,
        setInvestmentAmount
    } = useAccounting();

    const [actualLedger, setActualLedger] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const [savedStrategies, setSavedStrategies] = useState<any[]>([]);

    // [V2.6] Deterministic Equity Control Report
    const report = useMemo(() => {
        // Use preMoneyValuation directly, defaulting to 1B if not set
        const result = analyzeEquityControl(preMoneyValuation || 1000000000, investmentAmount);
        return {
            ...result,
            founderRatio: result.founderRatio,
            dilutionRatio: result.dilutionRatio,
            controlState: result.controlState,
            warnings: result.warnings
        } as any;
    }, [preMoneyValuation, investmentAmount]);



    const handleExportAll = async () => {
        if (!actualLedger || !selectedDate) return;
        setLoading(true);
        try {
            const msg = await invoke('run_full_scenario_export', {
                ledger: actualLedger,
                selectedDate: selectedDate
            });
            alert(msg);
        } catch (err: any) {
            alert("Export failed: " + err);
        } finally {
            setLoading(false);
        }
    };

    // [v4] Deterministic Sorting Logic
    const getSortKey = (e: JournalEntry) => {
        if (e.id) return e.id;
        // Fallback key: Date + Description + Amount + Accounts
        return `${e.date}_${e.description}_${e.amount}_${e.debitAccount}_${e.creditAccount}`;
    };

    const sortLedger = (ledger: JournalEntry[]) => {
        return [...ledger].sort((a, b) => {
            const dateComp = a.date.localeCompare(b.date);
            if (dateComp !== 0) return dateComp;
            return getSortKey(a).localeCompare(getSortKey(b));
        });
    };

    // [v5] Deterministic Hash for Change Detection
    const getLedgerHash = (ledger: JournalEntry[]) => {
        const digest = ledger.map(e => `${e.date}|${e.amount}|${getSortKey(e)}`).join('::');
        let hash = 0;
        for (let i = 0; i < digest.length; i++) {
            hash = ((hash << 5) - hash) + digest.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString();
    };

    const currentLedgerHash = useMemo(() => getLedgerHash(actualLedger), [actualLedger]);



    const handleGenerateBaseline = useCallback(async (scenarioName: string = "Standard Baseline Projection") => {
        if (!financials || !selectedDate || !actualLedger) return;
        setLoading(true);

        try {
            const sortedActual = sortLedger(actualLedger);

            // [Baseline] Always use 1.0 multiplier for current macro anchor
            const result = projectScenarioFrontend(
                sortedActual,
                selectedDate,
                { revenueMult: 1.0, expenseMult: 1.0, fixedCostDelta: 0 },
                macro,
                projectionMonths // ✅ Use dynamic duration
            );

            setBaselineEntries(result);
            setBaselineTimestamp(Date.now());
            setBaselineSnapshot({
                date: selectedDate,
                hash: currentLedgerHash, // Save current actual ledger hash
                ledger: sortedActual, // Immutable and Deterministically Sorted
                macro: { ...macro } // [Audit Trail] Commit current macro assumptions
            });
            console.log(`[Compass v3] JS-Based Baseline Future Ledger Refresh Complete.`);
        } catch (err) {
            console.error('Baseline Generation Failed', err);
        } finally {
            setLoading(false);
        }
    }, [financials, selectedDate, actualLedger, macro, setBaselineEntries, setBaselineTimestamp, setBaselineSnapshot]);

    // Local Stale Detection for UI Hinting
    const isBaselineStale = useMemo(() => {
        if (!baselineSnapshot) return true;
        const dateMismatch = baselineSnapshot.date !== selectedDate;
        const hashMismatch = baselineSnapshot.hash !== currentLedgerHash;
        const macroMismatch = JSON.stringify(baselineSnapshot.macro) !== JSON.stringify(macro);
        return dateMismatch || hashMismatch || macroMismatch;
    }, [selectedDate, currentLedgerHash, baselineSnapshot, macro]);

    // Sync Actual Ledger with Global Ledger
    useEffect(() => {
        if (globalLedger && globalLedger.length > 0) {
            const sanitizedActual = globalLedger.map((e: JournalEntry) => ({
                ...e,
                scope: (e.scope ?? 'actual').toLowerCase() as any
            }));
            setActualLedger(sanitizedActual);
        }
    }, [globalLedger]);

    // 🔥 [FULL PATCH Step 2] Unified Simulation Structure & SSOT Definition
    const scenarioConfig = useMemo(() => ({
        revenueMult,
        expenseMult,
        fixedCostDelta,
        macro: baselineSnapshot?.macro || macro, // [Audit Trail] Use committed macro if available
        projectionMonths,
        preMoneyValuation
    }), [revenueMult, expenseMult, fixedCostDelta, macro, projectionMonths, preMoneyValuation, baselineSnapshot]);

    /**
     * 핵심: projectionLedger를 단일 소스화하여 상태 파편화를 막는다.
     */
    const executeSimulation = useCallback(async () => {
        if (!baselineSnapshot?.ledger || baselineSnapshot.ledger.length === 0) return;

        setLoading(true);
        try {
            // [UX GUIDE-PROJECT] Unified JS Simulation Pipeline
            const result = projectScenarioFrontend(
                baselineSnapshot.ledger,
                baselineSnapshot.date,
                {
                    revenueMult: scenarioConfig.revenueMult,
                    expenseMult: scenarioConfig.expenseMult,
                    fixedCostDelta: scenarioConfig.fixedCostDelta
                },
                scenarioConfig.macro,
                scenarioConfig.projectionMonths
            );

            if (!result || result.length === 0) {
                console.warn("⚠️ Simulation returned empty");
                return;
            }

            console.log(`[Compass] Pipeline Active: Generated ${result.length} scenario entries.`);
            setScenarioLedger(result);
        } catch (err) {
            console.error('Simulation Failed', err);
        } finally {
            setLoading(false);
        }
    }, [baselineSnapshot, scenarioConfig, setScenarioLedger]);

    // 🔥 [FULL PATCH Step 3] useEffect 구조 정리 (Dependencies Clean)
    useEffect(() => {
        executeSimulation();
    }, [executeSimulation]);

    // [Step 6] 디버깅 로그
    useEffect(() => {
        console.log("📊 projectionLedger (scenarioPart) size:", scenarioLedger?.length);
    }, [scenarioLedger]);

    // Equity control is now handled reactively by equityReport useMemo

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: 'KRW',
            maximumFractionDigits: 0
        }).format(val);

    function isCashAccount(name?: string) {
        if (!name) return false;
        const n = name.toLowerCase();
        return (
            n.includes("cash") ||
            n.includes("bank") ||
            n.includes("보통예금") ||
            n.includes("현금")
        );
    }

    const handleSaveStrategy = () => {
        const name = prompt("저장할 전략의 이름을 입력하세요:");
        if (name) {
            setSavedStrategies(prev => [
                ...prev,
                {
                    name,
                    revenueMult,
                    expenseMult,
                    fixedCostDelta,
                    timestamp: new Date().toLocaleString()
                }
            ]);
        }
    };

    // 🔥 [CONSTITUTION 2-3] Projection Ledger (The Single Source of Truth)
    const projectionLedger = useMemo(() => {
        const combined = [
            ...actualLedger,
            ...scenarioLedger
        ];
        // [DEBUG 7-1] Ledger Verification
        console.log("🔥 [SSOT] Projection Size:", combined.length);
        const hasFuture = combined.some(e => e.scope === "future" || e.type === "Scenario");
        console.log("🔥 [SSOT] Has Future (Scenario):", hasFuture);

        return combined;
    }, [actualLedger, scenarioLedger]);

    // 🔥 [CONSTITUTION 2-4] Triple Source of PnL for Comparison
    const ANALYSIS_YEARS = useMemo(() => {
        if (!selectedDate) return [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
        const startY = new Date(selectedDate).getFullYear();
        const endY = new Date(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth() + projectionMonths).getFullYear();
        const years = [];
        // Support past 3 years to future projection end
        for (let y = Math.min(2025, startY - 2); y <= endY; y++) {
            years.push(y);
        }
        return years;
    }, [selectedDate, projectionMonths]);

    const actualPnL = useMemo(() =>
        generateMonthlyPnL(actualLedger, ANALYSIS_YEARS, selectedDate),
        [actualLedger, selectedDate]);

    const scenarioPnL = useMemo(() =>
        generateMonthlyPnL([...actualLedger, ...scenarioLedger], ANALYSIS_YEARS, selectedDate),
        [actualLedger, scenarioLedger, selectedDate]);

    const baselinePnL = useMemo(() =>
        generateMonthlyPnL([...actualLedger, ...baselineEntries], ANALYSIS_YEARS, selectedDate),
        [actualLedger, baselineEntries, selectedDate]);

    // [CONSTITUTION 3-2] Cash Flow Generation (Explicit Splits)
    const scenarioCashFlow = useMemo(() =>
        generateCashFlow([...actualLedger, ...scenarioLedger], 0),
        [actualLedger, scenarioLedger]);

    const baselineCashFlow = useMemo(() =>
        generateCashFlow([...actualLedger, ...baselineEntries], 0),
        [actualLedger, baselineEntries]);

    const getProfitDelta = useCallback((e: JournalEntry) => {
        let profitImpact = 0;
        const getImp = (name: string, id: string | undefined, dr: number, cr: number) => {
            // [MISSION] Strictly forbidden to use name-based lookup
            const acc = id ? Object.values(accounts).find(a => a.id === id) : null;

            if (!acc) {
                console.error("[FATAL][COA] Missing accountId or invalid mapping in entry:", {
                    desc: e.description,
                    accountId: id,
                    name: name
                });
                return 0;
            }

            const nature = acc.nature;
            const impact = (nature === 'REVENUE' || nature === 'EXPENSE') ? cr - dr : 0;

            return impact;
        };

        if (e.complexLines && e.complexLines.length > 0) {
            e.complexLines.forEach(l => {
                profitImpact += getImp(l.account, (l as any).accountId, l.debit, l.credit);
            });
        } else {
            profitImpact += getImp(e.debitAccount, (e as any).debitAccountId, e.amount, 0);
            profitImpact += getImp(e.creditAccount, (e as any).creditAccountId, 0, e.amount);
        }
        return profitImpact;
    }, [accounts]);

    const { chartData, anchorValidation } = useMemo(() => {
        if (!financials || !actualLedger.length) return { chartData: [], anchorValidation: null };

        // Final Patch: Map standardized CashFlow/PnL reports to chart points
        const anchorDate = actualLedger.reduce((max, e) => e.date > max ? e.date : max, actualLedger[0].date);
        const anchorMonthFormatted = anchorDate.substring(0, 7);

        // Pivot Offset: Align T0 Cash to financials.cash
        const anchorCF = scenarioCashFlow.find((c: any) => c.date === anchorMonthFormatted);
        const currentPivotCash = anchorCF ? anchorCF.cash : 0;
        const offset = financials.cash - currentPivotCash;

        // ✅ Step 5. 생성 결과 비교 로그 (Ledger 수준)
        console.log('[COMPARE_LEDGER]', {
            baselineEntriesCount: baselineEntries.length,
            scenarioLedgerCount: scenarioLedger.length,
            baselineFirst: baselineEntries[0],
            scenarioFirst: scenarioLedger[0]
        });

        // 🚨 Step 6. 동일성 체크 (핵심)
        if (baselineEntries.length > 0 && scenarioLedger.length > 0 && (revenueMult !== 1 || expenseMult !== 1)) {
            const isSame = JSON.stringify(baselineEntries.slice(0, 5)) === JSON.stringify(scenarioLedger.slice(0, 5));
            if (isSame) {
                console.error('[CRITICAL] Scenario == Baseline (NO STRATEGY EFFECT)');
            }
        }

        // Group PnL by month for easy lookup
        const actualPnLMap = new Map(actualPnL.map((p: any) => [p.month, p]));
        const scenarioPnLMap = new Map(scenarioPnL.map((p: any) => [p.month, p]));
        const baselinePnLMap = new Map(baselinePnL.map((p: any) => [p.month, p]));
        const baseCFMap = new Map(baselineCashFlow.map((c: any) => [c.date, c]));

        // ✅ Step 7. PnL 비교 로그 (특정 월 추출)
        // 3개월 후 시점(projection) 데이터 확인
        const testMonth = new Date(new Date(anchorMonthFormatted).getFullYear(), new Date(anchorMonthFormatted).getMonth() + 3, 1)
            .toISOString().substring(0, 7);

        const testActual = actualPnLMap.get(testMonth)?.netIncome;
        const testScenario = scenarioPnLMap.get(testMonth)?.netIncome;
        const testBaseline = baselinePnLMap.get(testMonth)?.netIncome;

        console.log('[COMPARE_PNL]', {
            month: testMonth,
            actual: testActual,
            scenario: testScenario,
            baseline: testBaseline
        });

        // 🚨 Step 8. 동일값 감지 시 에러
        if (testScenario !== undefined && testScenario !== 0 && (revenueMult !== 1 || expenseMult !== 1)) {
            if (testScenario === testActual && testScenario === testBaseline) {
                console.error('[CRITICAL] All PnL identical → Simulation broken');
            }
        }

        const nowIndex = scenarioCashFlow.findIndex((cf: any) => cf.date === anchorMonthFormatted);

        const data = scenarioCashFlow.map((cf: any, index: number) => {
            const actual = actualPnLMap.get(cf.date);
            const scenario = scenarioPnLMap.get(cf.date);
            const baseline = baselinePnLMap.get(cf.date);
            const baseCF = baseCFMap.get(cf.date);

            const isFuture = index > nowIndex; // index based comparison is safer
            const isNow = index === nowIndex;

            return {
                month: cf.date.substring(2).replace('-', '/'),
                fullMonth: cf.date,
                BaselineCash: (baseCF?.cash ?? 0) + offset,
                ScenarioCash: cf.cash + offset,
                ScenarioProfit: scenario?.operatingProfit ?? 0, // [V2.6] Operating Core BEP focus
                ScenarioNetIncome: scenario?.netIncome ?? 0,   // [V2.6] Total cash recovery focus
                // Only show actual profit for historical period
                ActualProfit: index <= nowIndex ? (actual?.operatingProfit ?? 0) : 0,
                BaselineProfit: baseline?.operatingProfit ?? 0,
                isFuture,
                isNow,
                index
            };
        });

        return {
            chartData: data,
            anchorValidation: {
                isValid: true,
                discrepancy: 0,
                anchor: financials.cash,
                ssot: financials.cash
            }
        };
    }, [financials, actualLedger, scenarioCashFlow, baselineCashFlow, actualPnL, scenarioPnL, baselinePnL]);

    // [V2.6] Unified Metric Results (Financial Truth Engine)
    const metricResults = useMemo(() => {
        if (!financials || !trialBalance) return null;

        // 1. Liquidity (Cash - Short-term Payables) - The core 3 things
        const liquidCash = MetricRegistry.calculateLiquidity(trialBalance);

        // 2. Net Profit
        const actualNetProfit = MetricRegistry.calculateNetProfit(trialBalance);

        // 3. Runway (Deterministic Strategy Execution)
        const currentCash = financials.cash; // Latest actual cash ONLY
        const futureCashDeltas = scenarioCashFlow.map(cf => cf.delta);

        const runwayVal = calculateRunway({
            currentCash,
            futureCashDeltas
        });

        // [V2.6] Liquidity Runway: Adjusted for unsettled liabilities
        const liquidRunwayVal = liquidCash.value > 0 ? liquidCash.value / (calculateAvgBurn(futureCashDeltas) || 1) : 0;

        const runway = {
            value: runwayVal,
            inputs: { 
                'Gross Cash': currentCash, 
                'Liquid Cash (Net)': liquidCash.value,
                'Monthly Avg Burn': Math.round(calculateAvgBurn(futureCashDeltas)) 
            },
            formula: 'Cash / Avg Burn (scenario)',
            period: '시뮬레이션 예측',
            dataSource: 'scenario' as any,
            monthlyDeltas: scenarioCashFlow.map(cf => ({ date: cf.date, cashDelta: cf.delta }))
        };
        const projectedRunway = runway;
        const liquidityRunway = { ...runway, value: liquidRunwayVal, label: 'Liquidity Runway' };

        // 4. Scenario Profit (Simplified)
        const burnMonths = projectionLedger.filter(e => e.date > selectedDate);
        let scenarioProfitTotal = burnMonths.reduce((sum, e) => sum + getProfitDelta(e), 0);

        return {
            liquidCash,
            actualNetProfit,
            runway,
            projectedRunway,
            liquidityRunway,
            scenarioProfit: {
                value: scenarioProfitTotal,
                inputs: { '분석 대상 개월 수': Array.from(new Set(burnMonths.map(m => m.date.substring(0, 7)))).length },
                formula: '시나리오 상의 누적 현금 영향 합계',
                period: '시뮬레이션 전체 기간',
                dataSource: 'scenario' as any
            }
        };
    }, [financials, trialBalance, projectionLedger, selectedDate, getProfitDelta, scenarioCashFlow, scenarioPnL]);


    const stats = useMemo(() => {
        if (!metricResults) return null;

        // [v4] Derived indices for trajectory and BEP
        let cashOutMonth = null;
        let breakEvenMonthIndex = null;
        let minCash = Infinity;
        for (let i = 0; i < chartData.length; i++) {
            if (chartData[i].isFuture) {
                if (chartData[i].ScenarioCash < minCash) minCash = chartData[i].ScenarioCash;
                if (cashOutMonth === null && chartData[i].ScenarioCash < 0) {
                    cashOutMonth = i;
                }
                if (breakEvenMonthIndex === null && chartData[i].ScenarioProfit > 0) {
                    breakEvenMonthIndex = i;
                }
            }
        }

        const trajectory = analyzeTrajectory(
            Array.isArray(chartData)
                ? chartData.map(d => d?.ScenarioCash ?? 0)
                : []
        );
        const drivers = MetricRegistry.analyzeProfitDrivers(baselinePnL, scenarioPnL);

        const runwayMonths = metricResults.projectedRunway.value;
        const currentBurn = metricResults.liquidCash.value / (runwayMonths > 0 ? runwayMonths : 1);

        const projectionStatus = MetricRegistry.getProjectionStatus(
            metricResults.projectedRunway.value,
            chartData.filter(d => d.isFuture).length,
            metricResults.projectedRunway.monthlyDeltas || []
        );
        const deathValleyRisk = projectionStatus.status;
        const deathValleyMessage = projectionStatus.message;

        const burnMultipleResult = MetricRegistry.calculateBurnMultiple(projectionLedger, selectedDate);

        // [PHASE 10 Refinement] Rename "Probability" to "Score"
        const survivalProbResult = MetricRegistry.calculateSurvivalProbability(runwayMonths);
        const survivalScore = survivalProbResult.value;

        const rawInsight = generateCFOInsight({
            projection: chartData,
            metrics: {
                runwayMonths,
                trajectory,
                drivers
            }
        });
        const insight = rawInsight ? { ...rawInsight, ...INSIGHT_UI_MAP[rawInsight.status] || INSIGHT_UI_MAP['CRITICAL'] } : null;

        const projectionResult = {
            value: 0,
            label: "N/A",
            message: projectionStatus.message,
            inputs: {
                '예측 Runway': `${metricResults.projectedRunway.value.toFixed(1)}개월`,
                '시뮬레이션 범위': `${chartData.filter(d => d.isFuture).length}개월`,
                '월간 순손실(적자) 발생 여부': (metricResults.projectedRunway.monthlyDeltas || []).filter((d: any) => d.cashDelta < 0).length > 0 ? 'Yes' : 'No'
            },
            formula: 'Runway와 시뮬레이션 종료 시점 간의 여유 기간 기반 상태 판별',
            period: '시나리오 미래 예측',
            dataSource: 'scenario' as any
        };

        if (chartData.length > 0) {
            const lastData = chartData[chartData.length - 1];
            projectionResult.value = lastData.ScenarioCash;
            projectionResult.label = projectionStatus.status; // Use projectionStatus.status for label
        }

        return {
            ...metricResults,
            cashOutMonth,
            breakEvenMonth: breakEvenMonthIndex,
            minCash,
            runwayMonths,
            deathValleyRisk,
            deathValleyMessage,
            survivalProbability: survivalProbResult.value,
            burnMultipleResult,
            survivalProbResult,
            projectionResult,
            cashOutDateLabel: cashOutMonth !== null && chartData[cashOutMonth] ? chartData[cashOutMonth].month : "N/A",
            deathValleyExpl: deathValleyMessage,
            survivalExpl: `현금 생존 기간(Runway) 기준 판정:
• 95% (안정): Runway 18개월 초과 (투자 유치 직후 등)
• 85% (양호): Runway 12개월 ~ 18개월
• 50% (경계): Runway 6개월 ~ 12개월 (현재 ${runwayMonths.toFixed(1)}개월로 이 구간 해당) - '데스밸리 진입' 단계. 통계적으로 추가 투자 유치나 수익 전환이 일어나지 않으면 생존을 장담할 수 없는 반반의 확률로 봅니다.
• 25% (위험): Runway 3개월 ~ 6개월
• 10% (부도 위기): Runway 3개월 미만`,
            insight,
            monthlyBurn: currentBurn,
            burnMultiple: burnMultipleResult.value,
            burnMultipleExpl: "미래 성장 효율성 지표입니다. 1원의 추가 매출을 만들기 위해 시뮬레이션상에서 얼마나 많은 현금을 지출(Burn)하는지 나타냅니다. (예상 비용-매출) / 예상 매출",
            projectedRunwayMonths: metricResults.projectedRunway.value,
            projectedRunwayDeltas: metricResults.projectedRunway.monthlyDeltas,
            scenarioHorizonMonths: chartData.filter(d => d.isFuture).length,
        };
    }, [metricResults, chartData, selectedDate, projectionLedger, baselinePnL, scenarioPnL]);

    const advice = stats?.insight;
    const equitySignal = getEquitySignal(stats?.runwayMonths);
    const fundingSignal = getFundingTiming(stats?.runwayMonths ?? undefined);

    const nowIndex = useMemo(() => chartData.findIndex(d => d.isNow), [chartData]);

    const fundingX = useMemo(() => {
        if (!fundingSignal || !chartData?.length || nowIndex === -1) return null;
        const targetIndex = nowIndex + Math.round(fundingSignal.monthOffset);
        if (targetIndex >= chartData.length || targetIndex < 0) return null;
        return chartData[targetIndex]?.month;
    }, [fundingSignal, chartData, nowIndex]);

    const cashOutX = useMemo(() => {
        if (!stats?.cashOutMonth || !chartData[stats.cashOutMonth]) return null;
        return chartData[stats.cashOutMonth]?.month;
    }, [stats?.cashOutMonth, chartData]);

    const bepX = useMemo(() => {
        if (stats?.breakEvenMonth === null || stats?.breakEvenMonth === undefined || !chartData[stats.breakEvenMonth]) return null;
        return chartData[stats.breakEvenMonth]?.month;
    }, [stats?.breakEvenMonth, chartData]);

    const equityX = useMemo(() => {
        if (!stats?.cashOutMonth || !chartData.length) return null;
        // Dilution Alert starts 6 months before Cash Out
        const targetIndex = Math.max(stats.cashOutMonth - 6, 0);
        return chartData[targetIndex]?.month;
    }, [stats?.cashOutMonth, chartData]);

    // 🔥 [FULL PATCH Step 2 & 5] 핵심 로직 (Unified Control SSOT)
    const equityAnalysis = useMemo(() => {
        if (!stats || !scenarioCashFlow || nowIndex === -1) {
            return null;
        }

        // [STEP 1] Do Nothing Scenario: Cash Zero 시점 탐색
        const failIndex = scenarioCashFlow.findIndex((cf, i) => i >= nowIndex && cf.cash <= 0);

        // [STEP 2] Funding 시점을 "Runway < 6m" 기준으로 탐색
        const futureDeltas = scenarioCashFlow.map(cf => cf.delta);
        let fundingIndex = -1;
        let fundingRemainingRunway = 0;

        for (let i = nowIndex; i < scenarioCashFlow.length; i++) {
            const remRunway = calculateRunway({
                currentCash: scenarioCashFlow[i].cash,
                futureCashDeltas: futureDeltas.slice(i)
            });
            if (remRunway < 6) {
                fundingIndex = i;
                fundingRemainingRunway = remRunway;
                break;
            }
        }

        if (fundingIndex === -1) {
            return {
                failIndex,
                fundingNeeded: 0,
                fundingIndex: -1,
                dilution: null,
                delayAnalysis: null,
                control: report.controlState,
                timing: null,
                insight: null
            };
        }

        // [STEP 3] Funding Amount도 "그 시점(fundingIndex)" 기준으로 산출
        const futureBurnMonths = futureDeltas.slice(fundingIndex).filter(d => d < 0);
        const avgBurn = futureBurnMonths.length > 0
            ? futureBurnMonths.reduce((a, b) => a + Math.abs(b), 0) / futureBurnMonths.length
            : 0;

        const fundingNeeded = requiredFunding(
            fundingRemainingRunway,
            18, // Target Runway 18m
            avgBurn
        );

        const dilution = calculateDilution(
            preMoneyValuation || 500000000,
            fundingNeeded
        );

        // [STEP 4] Timing Sensitivity: 3개월 지연 시 영향 분석
        let delayAnalysis = null;
        const delayGap = 3;
        if (fundingIndex + delayGap < scenarioCashFlow.length) {
            const di = fundingIndex + delayGap;
            const dRemRunway = calculateRunway({
                currentCash: scenarioCashFlow[di].cash,
                futureCashDeltas: futureDeltas.slice(di)
            });
            const dBurnMonths = futureDeltas.slice(di).filter(d => d < 0);
            const dAvgBurn = dBurnMonths.length > 0
                ? dBurnMonths.reduce((a, b) => a + Math.abs(b), 0) / dBurnMonths.length
                : 0;
            const dFundingNeeded = requiredFunding(dRemRunway, 18, dAvgBurn);
            const dDilution = calculateDilution(preMoneyValuation || 500000000, dFundingNeeded);

            delayAnalysis = {
                monthsDelayed: delayGap,
                date: chartData[di]?.month,
                fundingNeeded: dFundingNeeded,
                investorShare: dDilution.investorShare,
                dilutionDelta: dDilution.investorShare - dilution.investorShare
            };
        }

        const controlReport = analyzeEquityControl(
            preMoneyValuation || 500000000,
            fundingNeeded
        );

        const control = controlReport.controlState;

        const timing = analyzeFundingTiming({
            runwayMonths: fundingRemainingRunway
        });

        const insight = generateEquityInsight({
            runway: fundingRemainingRunway,
            dilution,
            control,
            timing
        });

        return {
            failIndex,
            fundingNeeded,
            fundingIndex,
            fundingRemainingRunway,
            dilution,
            delayAnalysis,
            control,
            timing,
            insight
        };
    }, [stats, preMoneyValuation, scenarioCashFlow, nowIndex, report.controlState, chartData]);

    // 🔥 [V2.6 FIX] Sync Simulation Result to Manual Simulator
    useEffect(() => {
        if (equityAnalysis?.fundingNeeded && investmentAmount === 0) {
            console.log("[Equity] Syncing suggested funding to simulator:", equityAnalysis.fundingNeeded);
            setInvestmentAmount(equityAnalysis.fundingNeeded);
        }
    }, [equityAnalysis?.fundingNeeded, setInvestmentAmount]);

    const dilutionAnalysis = useMemo(() => {
        const requiredFundingVal = equityAnalysis?.fundingNeeded;
        if (!requiredFundingVal || requiredFundingVal <= 0) return null;

        const postMoney = preMoneyValuation + requiredFundingVal;
        const investorShare = requiredFundingVal / postMoney;
        const founderShare = 1 - investorShare;

        let controlState: 'ABSOLUTE_CONTROL' | 'MAJORITY_CONTROL' | 'CONTROL_LOST';
        if (founderShare >= 0.667) controlState = 'ABSOLUTE_CONTROL';
        else if (founderShare >= 0.5) controlState = 'MAJORITY_CONTROL';
        else controlState = 'CONTROL_LOST';

        return {
            investmentAmount: requiredFundingVal,
            postMoney,
            investorShare,
            founderShare,
            controlState,
        };
    }, [equityAnalysis?.fundingNeeded, preMoneyValuation]);

    const dilutionRiskSignal = useMemo(() => {
        if (!dilutionAnalysis) return null;
        const { founderShare } = dilutionAnalysis;

        if (founderShare < 0.5) {
            return { level: 'CRITICAL', message: '펀딩 후 경영권 상실 리스크' };
        }
        if (founderShare < 0.667) {
            return { level: 'WARNING', message: '절대 경영권 희석 (<66.7%)' };
        }
        return { level: 'SAFE', message: '경영권 성공적 방어 가능' };
    }, [dilutionAnalysis]);

    const fundingEvent = useMemo(() => {
        if (!equityAnalysis || !chartData || equityAnalysis.fundingIndex === -1) return null;
        const idx = equityAnalysis.fundingIndex;

        return {
            index: idx,
            date: chartData[idx]?.month,
            failDate: equityAnalysis.failIndex !== -1 ? chartData[equityAnalysis.failIndex]?.month : null,
            fundingNeeded: equityAnalysis.fundingNeeded,
            remainingRunway: equityAnalysis.fundingRemainingRunway
        };
    }, [chartData, equityAnalysis]);

    const controlRunwayState = useMemo(() => {
        const runway = stats?.runwayMonths;
        const control = report.controlState;
        if (!runway || !control) return null;
        return { runway, control };
    }, [stats?.runwayMonths, report.controlState]);

    const breakEvenMonth = useMemo(() => {
        const initialProfits = chartData.slice(0, 3).every((d: any) => d.ScenarioProfit > 0);
        if (initialProfits) return "이미 달성";

        let found = null;
        for (let i = 1; i < chartData.length; i++) {
            if (chartData[i - 1].ScenarioProfit <= 0 && chartData[i].ScenarioProfit > 0) {
                found = chartData[i];
                break;
            }
        }

        if (!found) return null;
        return `${found.fullMonth}`;
    }, [chartData]);

    const cumulativeBreakEvenMonth = useMemo(() => {
        let runningSum = 0;
        let found = null;
        for (let i = 0; i < chartData.length; i++) {
            // [V2.6] Cumulative Payback includes all income (grants, etc.)
            runningSum += chartData[i].ScenarioNetIncome || chartData[i].ActualProfit; 
            if (runningSum >= 0 && i > nowIndex) {
                 found = chartData[i];
                 break;
            }
        }
        if (!found) return null;
        return `${found.fullMonth}`;
    }, [chartData, nowIndex]);

    return (
        <div className="flex-1 bg-[#07090F] min-h-screen text-slate-100 p-8 lg:p-12 animate-in fade-in duration-700">
            {/* Header: Tactical Insight */}
            <header className="flex items-center justify-between pb-10 border-b border-white/5 mb-12 flex-wrap gap-8">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-600/30 border border-blue-400/20">
                        <Compass size={32} className={loading ? 'animate-spin' : ''} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg uppercase tracking-widest border border-blue-500/20">실험적 전략 모드 (Experimental)</span>
                            {anchorValidation?.isValid ? (
                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1">
                                    <ShieldCheck size={10} /> Anchor Validated
                                </span>
                            ) : (
                                <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-3 py-1 rounded-lg uppercase tracking-widest border border-rose-500/20 flex items-center gap-1">
                                    <AlertCircle size={10} /> Anchor Discrepancy: {formatCurrency(anchorValidation?.discrepancy || 0)}
                                </span>
                            )}
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter italic">전략 나침반 <span className="text-slate-500 text-xl font-bold not-italic ml-2">(Strategic Compass v2)</span></h1>
                        <p className="text-slate-500 text-sm font-bold mt-2 uppercase tracking-tight italic">실제 장부(selectedDate 기준)를 Anchor로 사용하는 CFO 시뮬레이션입니다.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setRevenueMult(1.0);
                            setExpenseMult(1.0);
                            setFixedCostDelta(0);
                            setScenarioLedger([]);
                            setBaselineEntries([]);
                            setBaselineSnapshot(null);
                            setBaselineTimestamp(null);
                            console.log("[Compass] Strategic Simulation Session Reset.");
                        }}
                        className="flex items-center gap-2 h-12 px-5 bg-[#1A1F2B] hover:bg-[#252B3A] border border-white/5 rounded-xl text-[10px] font-black text-white transition-all uppercase tracking-widest"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 초기화
                    </button>
                    <button
                        onClick={handleSaveStrategy}
                        className="flex items-center gap-2 h-12 px-5 bg-[#1A1F2B] hover:bg-[#252B3A] border border-white/5 rounded-xl text-[10px] font-black text-white transition-all uppercase tracking-widest"
                    >
                        <ShieldCheck size={12} /> 저장
                    </button>
                    <button
                        onClick={handleExportAll}
                        disabled={loading}
                        className="flex items-center gap-2 h-12 px-6 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black text-white transition-all shadow-lg shadow-blue-600/20 uppercase tracking-widest disabled:bg-slate-800"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 데이터 내보내기
                    </button>
                </div>
            </header>

            {/* Page Layout Reorganized */}
            <div className="flex flex-col gap-6">
                {/* CFO Insight - Moved to Top for immediate visibility */}
                <section className={`${advice?.bg ?? "bg-slate-500/10"} border-2 ${advice?.border ?? "border-slate-500/20"} p-6 h-auto rounded-[3rem] relative overflow-hidden shadow-2xl`}>
                    <div className="absolute right-[-20px] top-[-20px] opacity-5 text-current transform rotate-12">
                        {advice && advice.Icon && (
                            <advice.Icon size={180} />
                        )}
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className={`p-4 rounded-2xl bg-white/5 ${advice?.color ?? "text-slate-400 shadow-xl"}`}>
                                {advice && advice.Icon && (
                                    <advice.Icon size={32} />
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">CFO Strategic Intelligence</p>
                                <h3 className={`${advice?.color ?? "text-slate-100"} text-2xl font-black italic uppercase tracking-tighter`}>
                                    {advice?.label ?? "분석 대기 중"}
                                </h3>
                                <h4 className="text-xl font-black text-white italic tracking-tight mt-1 max-w-2xl">
                                    "{advice?.message ?? "시나리오 조정을 통해 구체적인 전략 조언을 확인하세요."}"
                                </h4>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-10">
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Info size={14} /> Drivers
                                </p>
                                <ul className="flex flex-col gap-2">
                                    {advice?.reason.slice(0, 2).map((r: string, i: number) => (
                                        <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-300 italic">
                                            <span className={`${advice?.color} opacity-40`}>•</span> {r}
                                        </li>
                                    ))}
                                    {(!advice?.reason || advice.reason.length === 0) && <li className="text-xs text-slate-600 font-bold italic">특이 사항 없음</li>}
                                </ul>
                            </div>
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Zap size={14} /> Actions
                                </p>
                                <div className="flex gap-2">
                                    {advice?.action.slice(0, 2).map((a: string, i: number) => (
                                        <span key={i} className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-black text-slate-200 italic">
                                            {a}
                                        </span>
                                    ))}
                                    {(!advice?.action || advice.action.length === 0) && <span className="text-xs text-slate-600 font-bold italic">전략 유지</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Row 2: KPI Summary - Compressed vertical space */}
                <div className="grid grid-cols-2 lg:grid-cols-8 gap-4">
                    <ExplainableKPI
                        label="번 멀티플 (Burn Multiple)"
                        result={stats?.burnMultipleResult || null}
                        description={stats?.burnMultipleExpl ?? ""}
                        color={(stats?.burnMultiple ?? 0) <= 1.5 ? 'text-emerald-400' : 'text-rose-400'}
                        formatValue={(v) => `${v.toFixed(1)}x`}
                    />
                    <ExplainableKPI
                        label="현금 생존 기간 (RUNWAY)"
                        result={stats?.projectedRunway || null}
                        description="미래 시나리오를 가미했을 때의 유동성 상태입니다."
                        color={(stats?.projectedRunwayMonths ?? 0) >= 12 ? 'text-emerald-400' : 'text-rose-400'}
                        formatValue={(v) => v === Infinity ? "무한" : `${v.toFixed(1)}개월`}
                    />
                    <ExplainableKPI
                        label="유동성 런웨이 (Liquidity Runway)"
                        result={stats?.liquidityRunway || null}
                        description="미지급금을 차감한 순 가용 유동성 기준의 런웨이입니다. (V2.6 SSOT)"
                        color={(stats?.liquidityRunway?.value ?? 0) >= 6 ? 'text-blue-400' : 'text-rose-400'}
                        formatValue={(v) => v === Infinity ? "무한" : `${v.toFixed(1)}개월`}
                    />
                    <ExplainableKPI
                        label="생존 상태 (Projection)"
                        result={stats?.projectionResult || null}
                        description="시나리오 결과에 따른 예측 상태입니다."
                        color={stats?.deathValleyRisk === 'SAFE' ? 'text-emerald-400' : 'text-rose-400'}
                        formatValue={(v) => stats?.projectionResult?.label || "UNKNOWN"}
                    />
                    <ExplainableKPI
                        label="월간 흑자 전환 (Monthly BEP)"
                        result={{
                            value: stats?.breakEvenMonth || 0,
                            inputs: { '분석 대상 개월수': projectionMonths, '현재 월 순이익': stats?.actualNetProfit.value || 0 },
                            formula: '시나리오 월간 수익이 처음으로 0보다 커지는 시점 탐색',
                            period: '전체 분석 시계',
                            dataSource: 'scenario'
                        }}
                        description="월간 수익(Revenue)이 운영 비용(OPEX)을 처음으로 넘어서는 시점입니다. 이 시점부터 외부 자금 수혈 없이 자립이 가능해집니다."
                        color="text-indigo-400"
                        formatValue={(v) => breakEvenMonth || "N/A"}
                    />
                    <ExplainableKPI
                        label="누적 투자 회수 (Cumulative BEP)"
                        result={{
                            value: 0,
                            inputs: { '분석 기간': projectionMonths },
                            formula: 'Σ(과거 실적 + 미래 예측) >= 0이 되는 시점',
                            period: 'Life-to-Date',
                            dataSource: 'scenario'
                        }}
                        description="창업 이후 발생한 모든 누적 손실을 만회하고 법인이 실질적인 순자산 증가 구간에 진입하는 시점입니다. (v2.6 신설)"
                        color="text-purple-400"
                        formatValue={(v) => cumulativeBreakEvenMonth || "N/A"}
                    />
                    <ExplainableKPI
                        label="데스밸리 리스크 (Debt Valley)"
                        result={{
                            value: stats?.minCash || 0,
                            inputs: { '최저 예상 잔액': stats?.minCash || 0, '현재 Runway': stats?.runwayMonths || 0 },
                            formula: '전체 시뮬레이션 기간 중 가장 낮은 현금 잔액 탐색',
                            period: '36개월 분석 범위',
                            dataSource: 'scenario'
                        }}
                        description={stats?.deathValleyExpl ?? ""}
                        color={stats?.deathValleyRisk === 'SAFE' ? 'text-emerald-400' : 'text-rose-400'}
                        formatValue={(v) => stats?.deathValleyRisk || "SAFE"}
                    />
                    <ExplainableKPI
                        label="스타트업 생존 확률"
                        result={stats?.survivalProbResult || null}
                        description={stats?.survivalExpl ?? ""}
                        color={(stats?.survivalProbability ?? 0) >= 70 ? 'text-emerald-400' : (stats?.survivalProbability ?? 0) >= 40 ? 'text-amber-400' : 'text-rose-400'}
                        formatValue={(v) => `${v}%`}
                        icon={<SurvivalGauge value={stats?.survivalProbability ?? 0} />}
                    />
                    <ExplainableKPI
                        label="현금 고갈 시점 예측"
                        result={{
                            value: stats?.cashOutMonth || 0,
                            inputs: { '기준 일자': selectedDate, '가용 현금 잔액': stats?.liquidCash.value || 0 },
                            formula: '누적 시나리오 현금이 처음으로 0 미만이 되는 시점',
                            period: '고갈 타임라인',
                            dataSource: 'scenario'
                        }}
                        description={`현재 지출 및 매출 추세 기반으로 예상되는 현금 고갈 월입니다. ${stats?.cashOutMonth !== null && stats?.cashOutMonth !== undefined ? `${stats.cashOutMonth}개월 후 고갈이 예측됩니다.` : '현재 시뮬레이션 기간 내 고갈 위험이 발견되지 않았습니다.'}`}
                        color={(stats?.cashOutMonth ?? 100) < 12 ? 'text-rose-400' : 'text-emerald-400'}
                        formatValue={(v) => stats?.cashOutDateLabel || "N/A"}
                    />
                </div>

                {/* Main Interactive Simulation Zone - Refined 10-Column Pattern */}
                <div className="grid grid-cols-1 xl:grid-cols-10 gap-6 items-stretch">
                    {/* Left Panel: Strategic Inputs & Presets (col-span-3) - Tightened for a-glance-fit */}
                    <aside className="xl:col-span-3 flex flex-col gap-2 max-h-[720px] overflow-y-auto pr-2 custom-scrollbar">
                        {/* Macro Environment */}
                        <section className="bg-[#0B1221] border border-white/5 p-4 rounded-[1.5rem] shadow-2xl relative overflow-hidden transition-all duration-300">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-400">
                                    <TrendingUp size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white italic tracking-tighter uppercase leading-none">Macro <span className="text-rose-500 not-italic">Environment</span></h3>
                                    <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">외부 경제 환경 Baseline</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <SimulationSlider
                                        label="예측 기간 (Time Horizon)"
                                        val={projectionMonths}
                                        setVal={setProjectionMonths}
                                        min={3} max={60} step={3}
                                        color="accent-slate-500"
                                        suffix="개월"
                                    />
                                    <SimulationSlider
                                        label="물가상승률 (Inflation)"
                                        val={macro.inflationRate}
                                        setVal={(v) => setMacro({ ...macro, inflationRate: v })}
                                        min={0} max={0.2} step={0.005}
                                        color="accent-rose-500"
                                        percentage
                                    />
                                    <SimulationSlider
                                        label="임금상승률 (Wage Growth)"
                                        val={macro.wageGrowthRate}
                                        setVal={(v) => setMacro({ ...macro, wageGrowthRate: v })}
                                        min={0} max={0.3} step={0.01}
                                        color="accent-rose-500"
                                        percentage
                                    />
                                    <SimulationSlider
                                        label="자연 매출 성장률"
                                        val={macro.revenueNaturalGrowth}
                                        setVal={(v) => setMacro({ ...macro, revenueNaturalGrowth: v })}
                                        min={-0.1} max={0.5} step={0.01}
                                        color="accent-emerald-500"
                                        percentage
                                    />
                                </div>
                                <div className="pt-3 border-t border-white/5 space-y-2">
                                    <div className="flex items-center gap-2 min-h-[28px]">
                                        {baselineTimestamp ? (
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2 text-emerald-400 text-[7px] font-black uppercase tracking-widest leading-none">
                                                    <ShieldCheck size={9} /> Baseline active
                                                </div>
                                                <div className="text-[6px] text-slate-500 font-bold uppercase tracking-tighter">
                                                    Generated: {new Date(baselineTimestamp).toLocaleString()}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-amber-500 text-[8px] font-black uppercase tracking-widest">
                                                <AlertCircle size={10} /> Setup baseline
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleGenerateBaseline()}
                                        disabled={loading}
                                        className={`w-full flex items-center justify-center gap-2 h-9 rounded-lg text-[8px] font-black text-white transition-all shadow-xl uppercase tracking-widest ${isBaselineStale
                                            ? 'bg-rose-600 hover:bg-rose-500'
                                            : 'bg-emerald-600 hover:bg-emerald-500'
                                            } disabled:bg-slate-800`}
                                    >
                                        <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
                                        {baselineEntries.length > 0 ? '🔄 베이스라인 갱신' : '베이스라인 생성'}
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Strategy Controls */}
                        <section className="bg-[#121620] border border-white/5 p-4 rounded-[1.5rem] shadow-2xl relative overflow-hidden transition-all duration-300">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                                    <Zap size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white italic tracking-tighter uppercase leading-none">Strategy <span className="text-emerald-500 not-italic">Parameters</span></h3>
                                    <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">경영 가정 조정</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <SimulationSlider
                                    label="성장 엔진 가속 (Sales x)"
                                    val={revenueMult}
                                    setVal={setRevenueMult}
                                    min={0.5} max={3.0} step={0.1}
                                    color="accent-blue-500"
                                    trend={revenueMult >= 1 ? 'emerald' : 'rose'}
                                />
                                <SimulationSlider
                                    label="운영 효율화 (Cost Cut)"
                                    val={expenseMult}
                                    setVal={setExpenseMult}
                                    min={0.5} max={1.5} step={0.05}
                                    color="accent-amber-500"
                                    trend={expenseMult <= 1 ? 'emerald' : 'rose'}
                                />
                                <SimulationSlider
                                    label="신규 투자 규모 (Investment)"
                                    val={fixedCostDelta}
                                    setVal={setFixedCostDelta}
                                    min={0} max={100_000_000} step={1_000_000}
                                    color="accent-indigo-500"
                                    isCurrency
                                />
                                <div className="space-y-2 mt-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Pre-Money Valuation</label>
                                        <span className="text-[10px] font-black italic text-purple-400">₩{(preMoneyValuation / 100_000_000).toFixed(1)}억</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={100_000_000}
                                        max={100_000_000_000}
                                        step={100_000_000}
                                        value={preMoneyValuation}
                                        onChange={(e) => setPreMoneyValuation(Number(e.target.value))}
                                        className="w-full h-1.5 bg-purple-500/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Saved Strategy Presets */}
                        <AnimatePresence>
                            {savedStrategies.length > 0 && (
                                <motion.section
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-[#121620] border border-white/5 p-4 rounded-[1.5rem] shadow-xl overflow-hidden"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400">
                                            <Lock size={14} />
                                        </div>
                                        <h3 className="text-sm font-black text-white italic tracking-tighter uppercase">Presets</h3>
                                    </div>

                                    <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                        {savedStrategies.map((s, i) => (
                                            <div key={i} className="bg-white/5 p-3 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group relative">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <h4 className="text-xs font-black text-white italic truncate pr-8">{s.name}</h4>
                                                    <button
                                                        onClick={() => {
                                                            setRevenueMult(s.revenueMult);
                                                            setExpenseMult(s.expenseMult);
                                                            setFixedCostDelta(s.fixedCostDelta);
                                                        }}
                                                        className="p-1 bg-blue-600 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all absolute top-2 right-2"
                                                    >
                                                        <ChevronRight size={12} />
                                                    </button>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div>
                                                        <p className="text-[7px] text-slate-500 font-bold uppercase">Rev</p>
                                                        <p className="text-[9px] font-black text-blue-400">{s.revenueMult}x</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] text-slate-500 font-bold uppercase">Exp</p>
                                                        <p className="text-[9px] font-black text-amber-400">{s.expenseMult}x</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] text-slate-500 font-bold uppercase">Inv</p>
                                                        <p className="text-[9px] font-black text-purple-400">₩{(s.fixedCostDelta / 1_000_000).toFixed(0)}M</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.section>
                            )}
                        </AnimatePresence>
                    </aside>

                    {/* Right Panel: Simulation Result & Insight (col-span-7) - Main Focused Area */}
                    <main className="xl:col-span-7 flex flex-col gap-8 min-w-0">
                        {/* Simulation Chart */}
                        <section className="bg-[#121620] border border-white/5 p-10 rounded-[3rem] shadow-3xl relative">
                            <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                                        <Activity size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Cash Flow Survival <span className="text-blue-500 not-italic">Trajectory</span></h3>
                                        <div className="flex gap-6 mt-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-slate-500" />
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Actual: 과거 및 현재 실적</span>
                                            </div>
                                            <div className="flex items-center gap-2 border-l border-white/5 pl-6">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Baseline: 거시 지표만 반영된 현 상태 유지 경로</span>
                                            </div>
                                            <div className="flex items-center gap-2 border-l border-white/5 pl-6">
                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Scenario: 전략 시뮬레이션 실행 결과</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[600px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={chartData}
                                        margin={{ top: 60, right: 30, left: 0, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Legend
                                            verticalAlign="bottom"
                                            height={64}
                                            align="center"
                                            iconType="circle"
                                            itemSorter={(item: any) => {
                                                const order: Record<string, number> = {
                                                    '실제 영업이익': 1,
                                                    '베이스라인 영업이익': 2,
                                                    '시나리오 영업이익': 3,
                                                    '베이스라인 현금 (Macro)': 4,
                                                    '시나리오 현금 (Strategy)': 5
                                                };
                                                return order[item.value] || 99;
                                            }}
                                            formatter={(value: string) => {
                                                const isProfit = value.includes('영업이익');
                                                const icon = isProfit ? '📈' : '💰';
                                                const colorClass = isProfit ? 'text-blue-400/90' : 'text-emerald-400/90';
                                                return (
                                                    <span className={`text-[10px] font-black ${colorClass} flex items-center gap-1.5 uppercase tracking-widest px-2 py-1 bg-white/5 rounded-lg border border-white/5 ml-2`}>
                                                        <span className="text-xs">{icon}</span> {value}
                                                    </span>
                                                );
                                            }}
                                        />
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                        <XAxis
                                            dataKey="month"
                                            stroke="#475569"
                                            fontSize={10}
                                            fontWeight="black"
                                            axisLine={false}
                                            tickLine={false}
                                            interval={2}
                                        />
                                        <YAxis
                                            yAxisId="cash"
                                            orientation="left"
                                            stroke="#10b981"
                                            fontSize={10}
                                            fontWeight="black"
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(val: number) => `₩${(val / 1_000_000).toFixed(0)}M`}
                                        />
                                        <YAxis
                                            yAxisId="pnl"
                                            orientation="right"
                                            stroke="#3b82f6"
                                            fontSize={10}
                                            fontWeight="black"
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(val: number) => `₩${(val / 1_000_000).toFixed(1)}M`}
                                        />
                                        <Tooltip content={<CustomChartTooltip stats={stats} />} />

                                        {chartData.some(d => !d.isFuture) && (
                                            <ReferenceLine
                                                yAxisId="cash"
                                                x={selectedDate.substring(2, 7).replace('-', '/')}
                                                stroke="#475569"
                                                strokeWidth={2}
                                                strokeDasharray="3 3"
                                                label={{ value: 'NOW', position: 'top', fill: '#475569', fontSize: 10, fontWeight: 900 }}
                                            />
                                        )}

                                        {chartData.some(d => d.isFuture) && (
                                            <ReferenceArea
                                                yAxisId="cash"
                                                x1={selectedDate.substring(2, 7).replace('-', '/')}
                                                x2={chartData[chartData.length - 1].month}
                                                fill="#ffffff"
                                                fillOpacity={0.03}
                                            />
                                        )}

                                        <Area
                                            yAxisId="cash"
                                            type="monotone"
                                            dataKey="BaselineCash"
                                            name="베이스라인 현금 (Macro)"
                                            stroke="#10b98166"
                                            fillOpacity={0}
                                            strokeWidth={2}
                                            strokeDasharray="6 6"
                                            animationDuration={1000}
                                        />
                                        <Area
                                            yAxisId="cash"
                                            type="monotone"
                                            dataKey="ScenarioCash"
                                            name="시나리오 현금 (Strategy)"
                                            stroke="#10b981"
                                            fillOpacity={1}
                                            fill="url(#colorCash)"
                                            strokeWidth={4}
                                            animationDuration={1500}
                                            animationEasing="ease-in-out"
                                        />

                                        <Line
                                            yAxisId="pnl"
                                            type="monotone"
                                            dataKey="ActualProfit"
                                            name="실제 영업이익"
                                            stroke="#ffffff88"
                                            strokeWidth={3}
                                            dot={false}
                                            animationDuration={1000}
                                        />
                                        {fundingEvent && (
                                            <ReferenceLine
                                                x={fundingEvent.date}
                                                stroke="#ef4444"
                                                strokeWidth={3}
                                                strokeDasharray="6 6"
                                                label={{
                                                    value: `Runway < 6m → Funding (${fundingEvent.remainingRunway?.toFixed(1)}m)`,
                                                    position: "top",
                                                    fill: "#ef4444",
                                                    fontSize: 10,
                                                    fontWeight: 900
                                                }}
                                            />
                                        )}
                                        {fundingEvent && fundingEvent.failDate && (
                                            <ReferenceLine
                                                x={fundingEvent.failDate}
                                                stroke="#ff0000"
                                                strokeWidth={3}
                                                strokeDasharray="3 3"
                                                label={{
                                                    value: `CASH ZERO (FAILURE) 💀`,
                                                    position: "bottom",
                                                    fill: "#ff0000",
                                                    fontSize: 10,
                                                    fontWeight: 900
                                                }}
                                            />
                                        )}
                                        <Line
                                            yAxisId="pnl"
                                            type="monotone"
                                            dataKey="BaselineProfit"
                                            name="베이스라인 영업이익"
                                            stroke="#3b82f666"
                                            strokeWidth={2}
                                            strokeDasharray="4 4"
                                            dot={false}
                                            animationDuration={1200}
                                        />
                                        <Line
                                            yAxisId="pnl"
                                            type="monotone"
                                            dataKey="ScenarioProfit"
                                            name="시나리오 영업이익"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            dot={false}
                                            animationDuration={1500}
                                        />

                                        {fundingEvent && (
                                            <ReferenceDot x={fundingEvent.date} y={0} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                                        )}

                                        {cashOutX && (
                                            <ReferenceLine
                                                x={cashOutX}
                                                stroke="#ef4444"
                                                strokeWidth={3}
                                                strokeDasharray="6 6"
                                                label={{ value: 'Cash Out', position: 'top', fill: '#ef4444', fontSize: 12, fontWeight: 700 }}
                                            />
                                        )}
                                        {bepX && (
                                            <ReferenceLine
                                                x={bepX}
                                                stroke="#22c55e"
                                                strokeWidth={3}
                                                strokeDasharray="6 6"
                                                label={{ value: 'BEP', position: 'top', fill: '#22c55e', fontSize: 12, fontWeight: 700 }}
                                            />
                                        )}
                                        {fundingX && fundingSignal && (
                                            <ReferenceLine
                                                yAxisId="cash"
                                                x={fundingX}
                                                stroke={fundingSignal.color}
                                                strokeDasharray="3 3"
                                                label={{
                                                    value: fundingSignal.label,
                                                    position: 'top',
                                                    fill: fundingSignal.color,
                                                    fontSize: 10,
                                                    fontWeight: 700
                                                }}
                                            />
                                        )}
                                        {equityX && equitySignal && (
                                            <ReferenceLine
                                                yAxisId="cash"
                                                x={equityX}
                                                stroke={equitySignal.color}
                                                strokeDasharray="4 4"
                                                label={{
                                                    value: `🛡️ ${equitySignal.label}`,
                                                    position: 'insideTopLeft',
                                                    fill: equitySignal.color,
                                                    fontSize: 12,
                                                    fontWeight: 900,
                                                    dy: 40,
                                                    dx: 5
                                                }}
                                            />
                                        )}
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        {/* Funding Target Details Moved below Chart for density */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                {equityAnalysis && equityAnalysis.fundingNeeded > 0 && (
                                    <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-[2rem] flex items-center justify-between gap-4 h-full">
                                        <div>
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Runway 6개월 미만 진입 시 필요 자금 (Target: 18m)</p>
                                            <p className="text-2xl font-black text-white">₩{(equityAnalysis.fundingNeeded / 100000000).toFixed(1)}억</p>
                                            <p className="text-[9px] font-bold text-blue-500/60 mt-0.5 italic">현재 번레이트 기준 최소 수혈액</p>

                                            {dilutionAnalysis && (
                                                <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                                                        <span>예상 희석률:</span>
                                                        <span className="text-white">{(dilutionAnalysis.investorShare * 100).toFixed(1)}%</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                                                        <span>창업자 지분율:</span>
                                                        <span className="text-white">{(dilutionAnalysis.founderShare * 100).toFixed(1)}%</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                                                        <span>경영권 상태:</span>
                                                        <span className={`italic ${dilutionAnalysis.controlState === 'ABSOLUTE_CONTROL' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {dilutionAnalysis.controlState === 'ABSOLUTE_CONTROL' ? '절대 경영권 확보' :
                                                                dilutionAnalysis.controlState === 'MAJORITY_CONTROL' ? '과반 경영권 유지' : '경영권 취약'}
                                                        </span>
                                                    </div>

                                                    {/* Timing Sensitivity (New) */}
                                                    {equityAnalysis.delayAnalysis && (
                                                        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                                                            <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                                                <Clock size={10} /> 타이밍 민감도 (3개월 지연 시)
                                                            </p>
                                                            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                                                                <span>추가 지분 희석:</span>
                                                                <span className="text-rose-400">+{(equityAnalysis.delayAnalysis.dilutionDelta * 100).toFixed(1)}% 더 희석</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                                                                <span>추가 자금 필요액:</span>
                                                                <span className="text-white">₩{((equityAnalysis.delayAnalysis.fundingNeeded - equityAnalysis.fundingNeeded) / 100000000).toFixed(1)}억 추가 필요</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {dilutionRiskSignal && (
                                                <div className={`
                                                    mt-3 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2
                                                    ${dilutionRiskSignal.level === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : ''}
                                                    ${dilutionRiskSignal.level === 'WARNING' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/20' : ''}
                                                    ${dilutionRiskSignal.level === 'SAFE' ? 'bg-green-500/20 text-green-300 border border-green-500/20' : ''}
                                                `}>
                                                    <AlertCircle size={12} /> {dilutionRiskSignal.message}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400">
                                            <Zap size={24} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                </div>

                {/* Cap Table Simulator (Separated at bottom) */}
                <section className="relative mt-24 group">
                    <div className="absolute -top-12 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                    {(!equityAnalysis || equityAnalysis.fundingNeeded <= 0) && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#7c3aed] text-white text-[10px] font-black px-6 py-3 rounded-full shadow-[0_0_50px_rgba(124,58,237,0.5)] border border-white/20 uppercase tracking-[0.2em] flex items-center gap-3">
                            <Lock size={14} /> Funding scenario 설정 시 활성화됩니다
                        </div>
                    )}

                    <div className={`transition-all duration-1000 ${(!equityAnalysis || equityAnalysis.fundingNeeded <= 0) ? 'opacity-30 blur-[2px] pointer-events-none grayscale' : 'opacity-100'}`}>
                        <div className="bg-[#121620] border border-white/5 p-16 rounded-[4rem] shadow-3xl relative overflow-hidden bg-gradient-to-br from-[#121620] to-[#0A0D14]">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full -mr-48 -mt-48" />

                            <div className="flex justify-between items-center mb-16 relative z-10">
                                <div className="flex items-center gap-6">
                                    <div className="p-5 bg-purple-500/10 rounded-[2rem] text-purple-400 border border-purple-500/20 shadow-inner">
                                        <PieChartIcon size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Equity & <span className="text-purple-500 not-italic">Cap Table</span> Simulation</h3>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em] mt-2">지분 희석 및 경영권 제어 시뮬레이션</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 mb-16 items-center relative z-10">
                                <div className="space-y-12">
                                    <SimulationSlider
                                        label="Pre-money Valuation (기업가치)"
                                        val={preMoneyValuation}
                                        setVal={setPreMoneyValuation}
                                        min={10000000000} max={100000000000} step={1000000000}
                                        color="accent-purple-500"
                                        isCurrency
                                    />
                                    <SimulationSlider
                                        label="Investment Amount (투자 금액)"
                                        val={investmentAmount}
                                        setVal={setInvestmentAmount}
                                        min={0} max={50000000000} step={1000000000}
                                        color="accent-blue-500"
                                        isCurrency
                                    />
                                </div>
                                <div className="relative flex items-center justify-center">
                                    <div className="absolute inset-0 bg-purple-500/10 blur-[120px] rounded-full scale-150" />
                                    <div className="w-full h-80 relative z-10">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={[
                                                        { name: '창업자 지분', value: report.founderRatio },
                                                        { name: '투자자 지분', value: report.dilutionRatio * 100 }
                                                    ]}
                                                    innerRadius={100}
                                                    outerRadius={140}
                                                    paddingAngle={12}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    <Cell fill={report.controlState === 'ABSOLUTE_CONTROL' ? '#10b981' : (report.controlState === 'BLOCKING_POWER_LOST' ? '#f59e0b' : '#f43f5e')} />
                                                    <Cell fill="rgba(255,255,255,0.05)" />
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value: any, name: any) => [`${parseFloat(value).toFixed(1)}%`, name]}
                                                    contentStyle={{ backgroundColor: '#0B1221', border: 'none', borderRadius: '24px', fontSize: '12px', fontWeight: 'black', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', color: '#fff' }}
                                                />
                                            </RePieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                                            <span className="text-5xl font-black text-white italic tracking-tighter leading-none">{report.founderRatio.toFixed(1)}%</span>
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest mt-3">Founder Share</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* [V2.6] New Control Status Panel */}
                            <div className={`p-10 rounded-[3rem] border-2 flex flex-col md:flex-row items-center gap-12 transition-all duration-500 ${report.controlState === 'ABSOLUTE_CONTROL' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' :
                                report.controlState === 'BLOCKING_POWER_LOST' ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' :
                                    'bg-rose-500/5 border-rose-500/10 text-rose-400'
                                }`}>
                                <div className="p-6 bg-white/5 rounded-3xl flex flex-col items-center min-w-[160px] shadow-inner border border-white/5">
                                    {report.controlState === 'ABSOLUTE_CONTROL' ? <ShieldCheck size={48} /> : <AlertCircle size={48} />}
                                    <span className="text-[11px] font-black mt-3 opacity-60 uppercase tracking-widest">Ownership</span>
                                    <span className="text-2xl font-black italic tracking-tighter mt-1">{report.founderRatio.toFixed(1)}%</span>
                                </div>
                                <div className="space-y-6 flex-1">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mb-2">CFO Control Intelligence</p>
                                        <h4 className="text-4xl font-black italic tracking-tighter uppercase mb-2">
                                            CONTROL STATE: {CONTROL_LABEL[report.controlState]}
                                        </h4>
                                        <p className="text-xl font-bold opacity-80 italic">창업자 최종 지분율: {report.founderRatio.toFixed(1)}% (시뮬레이션 설정 결과)</p>
                                    </div>

                                    <div className="pt-6 border-t border-white/5 flex flex-wrap gap-12">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Integrated Runway</span>
                                            <span className="text-lg font-black italic text-white/80">{stats?.runwayMonths === Infinity ? '∞' : stats?.runwayMonths.toFixed(1)} Months</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Control Integrity</span>
                                            <span className="text-lg font-black italic text-white/80">{CONTROL_LABEL[report.controlState]}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {report.warnings.map((w: string, i: number) => (
                                            <div key={i} className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${report.controlState === 'ABSOLUTE_CONTROL' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                <span className="text-[10px] font-bold text-white/60 italic">{w}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="hidden xl:block">
                                    <div className="px-8 py-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Engine Version</span>
                                        <p className="text-xs font-black italic text-white/20">EquityControl v2.6</p>
                                        <p className="text-[9px] font-bold text-purple-500/30 mt-1">DETERMINISTIC_MODE</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

const SimulationSlider: React.FC<{
    label: string,
    val: number,
    setVal: (v: number) => void,
    min: number, max: number, step: number,
    color: string,
    trend?: 'emerald' | 'rose',
    isCurrency?: boolean,
    percentage?: boolean,
    suffix?: string
}> = ({ label, val, setVal, min, max, step, color, trend, isCurrency, percentage, suffix }) => (
    <div className="group">
        <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors leading-none">{label}</span>
            <span className={`text-xs font-black italic leading-none ${trend === 'emerald' ? 'text-emerald-400' : trend === 'rose' ? 'text-rose-400' : 'text-blue-400'}`}>
                {isCurrency ? (val === 0 ? '₩0' : `₩${(val / 100_000_000).toLocaleString()}억`) :
                    percentage ? `${(val * 100).toFixed(1)}%` :
                        suffix ? (label.includes("기간") && val % 12 === 0 ? `${val / 12}년` : `${val}${suffix}`) :
                            `${Math.round((val - 1) * 100)}%`}
            </span>
        </div>
        <input
            type="range" min={min} max={max} step={step} value={val}
            onChange={(e) => setVal(parseFloat(e.target.value))}
            className={`w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer ${color} hover:bg-white/10 transition-all`}
        />
    </div>
);

const TooltipWrapper: React.FC<{ explanation?: string, children: React.ReactNode }> = ({ explanation, children }) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative h-full"
        >
            {children}
            <AnimatePresence>
                {isHovered && explanation && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-4 w-72 p-5 bg-[#0B1221] border border-white/10 rounded-[2rem] shadow-3xl z-[100] pointer-events-none"
                    >
                        <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Info size={14} /> Insight Tooltip
                        </p>
                        <p className="text-xs text-slate-400 leading-relaxed font-bold whitespace-normal italic">
                            {explanation}
                        </p>
                        <div className="absolute -bottom-1.5 left-10 w-3 h-3 bg-[#0B1221] border-b border-r border-white/10 transform rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const KPICard: React.FC<{ label: string, val: string, color: string, sub?: string, explanation?: string }> = ({ label, val, color, sub, explanation }) => (
    <TooltipWrapper explanation={explanation}>
        <div className="bg-[#121620] h-full p-5 rounded-[1.8rem] border border-white/5 flex flex-col gap-1 shadow-xl hover:border-white/10 transition-all cursor-help group">
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</p>
            <h4 className={`text-2xl font-black tracking-tighter italic ${color}`}>{val}</h4>
            {sub && <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight italic mt-1">{sub}</p>}
        </div>
    </TooltipWrapper>
);

const SummaryCard: React.FC<{ label: string, val: string, color: string, icon: any, sub?: string, explanation?: string }> = ({ label, val, color, icon: Icon, sub, explanation }) => (
    <TooltipWrapper explanation={explanation}>
        <div className="bg-[#121620] h-full p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-4 shadow-xl group hover:border-white/10 hover:-translate-y-1 transition-all cursor-help">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">{label}</p>
                    <h4 className={`text-3xl font-black tracking-tighter italic ${color}`}>{val}</h4>
                    {sub && <p className="text-xs font-bold text-slate-600 uppercase tracking-tight italic">{sub}</p>}
                </div>
                <div className={`p-4 bg-white/5 rounded-2xl text-slate-700 group-hover:${color} transition-all`}>
                    <Icon size={32} />
                </div>
            </div>
        </div>
    </TooltipWrapper>
);

export default StrategicCompass;

