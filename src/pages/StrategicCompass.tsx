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
import {
    calculateSequentialRunway,
    calculateCashRunway,
    calculateCashBurn,
    calculateCashBurnBreakdown,
    calculateOperatingBurn
} from '../core/metrics/metricRegistry';

import { verifyJournalIntegrity } from '../utils/debugIntegrity';
import { projectScenarioFrontend } from '../core/simulation/strategicSimulator';
import { runStrategicCompassEngine } from '../engines/strategicCompassEngine';
import { sumCashAccounts } from '../core/ssot/cashTruth';

const CustomChartTooltip = ({ active, payload, label, stats }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const isCashOut = stats?.cashOutMonth !== null && stats?.cashOutMonth !== undefined && data.index === stats.cashOutMonth;
        const isBEP = stats?.breakEvenMonth !== null && stats?.breakEvenMonth !== undefined && data.index === stats.breakEvenMonth;

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

export function getEquitySignal(runwayMonths?: number) {
    if (!runwayMonths) return null;
    if (runwayMonths < 6) return { level: 'HIGH_RISK', color: '#ef4444', label: 'Dilution Likely' };
    if (runwayMonths < 12) return { level: 'MEDIUM_RISK', color: '#f59e0b', label: 'Watch Dilution' };
    return { level: 'SAFE', color: '#10b981', label: 'Stable' };
}

const StrategicCompass: React.FC = () => {
    const {
        ledger: globalLedger,
        financials,
        selectedDate,
        accounts,
        setBaselineSnapshot,
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
        investmentAmount,
        setInvestmentAmount,
        trialBalance,
        setScenarioResults: setScenarioLedger,
        setBaselineEntries,
        baselineEntries,
        setBaselineTimestamp,
        baselineTimestamp
    } = useAccounting();

    const [actualLedger, setActualLedger] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
    const [version, setVersion] = useState(0); // 🔥 강제 재랜더 트리거

    // 🚨 전역 장부 변경 시 반응성 강제 보강
    useEffect(() => {
        if (globalLedger && globalLedger.length > 0) {
            setActualLedger(globalLedger.map((e: JournalEntry) => ({ ...e, scope: (e.scope ?? 'actual').toLowerCase() as any })));
            setVersion(v => v + 1); 
        }
    }, [globalLedger]);

    const report = useMemo(() => {
        const result = analyzeEquityControl(preMoneyValuation || 1000000000, investmentAmount);
        return result as any;
    }, [preMoneyValuation, investmentAmount]);

    const handleExportAll = async () => {
        if (!actualLedger || !selectedDate) return;
        setLoading(true);
        try {
            const msg = await invoke('run_full_scenario_export', { ledger: actualLedger, selectedDate: selectedDate });
            alert(msg);
        } catch (err: any) {
            alert("Export failed: " + err);
        } finally {
            setLoading(false);
        }
    };

    const sortLedger = (ledger: JournalEntry[]) => {
        return [...ledger].sort((a, b) => a.date.localeCompare(b.date));
    };

    const getLedgerHash = (ledger: JournalEntry[]) => {
        const digest = ledger.map(e => `${e.date}|${e.amount}`).join('::');
        let hash = 0;
        for (let i = 0; i < digest.length; i++) {
            hash = ((hash << 5) - hash) + digest.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString();
    };

    const currentLedgerHash = useMemo(() => getLedgerHash(actualLedger), [actualLedger]);

    const handleGenerateBaseline = useCallback(async () => {
        if (!financials || !selectedDate || !actualLedger) return;
        setLoading(true);
        try {
            const sortedActual = sortLedger(actualLedger);
            const result = projectScenarioFrontend(sortedActual, selectedDate, { revenueMult: 1.0, expenseMult: 1.0, fixedCostDelta: 0 }, macro, projectionMonths);
            setBaselineEntries(result);
            setBaselineTimestamp(Date.now());
            setBaselineSnapshot({ date: selectedDate, hash: currentLedgerHash, ledger: sortedActual, macro: { ...macro } });
        } catch (err) {
            console.error('Baseline Generation Failed', err);
        } finally {
            setLoading(false);
        }
    }, [financials, selectedDate, actualLedger, macro, projectionMonths, currentLedgerHash, setBaselineEntries, setBaselineTimestamp, setBaselineSnapshot]);

    // 🔥 [V12.1] baselineSnapshot 강제 재계산 (Stale 방지)
    const baselineSnapshot = useMemo(() => {
        if (!actualLedger.length) return null;
        return { 
            date: selectedDate, 
            hash: currentLedgerHash, 
            ledger: actualLedger, 
            macro: { ...macro } 
        };
    }, [actualLedger, selectedDate, currentLedgerHash, macro, version]);

    const isBaselineStale = useMemo(() => {
        if (!baselineSnapshot) return true;
        return baselineSnapshot.date !== selectedDate || baselineSnapshot.hash !== currentLedgerHash;
    }, [selectedDate, currentLedgerHash, baselineSnapshot]);

    useEffect(() => {
        if (globalLedger && globalLedger.length > 0) {
            setActualLedger(globalLedger.map((e: JournalEntry) => ({ ...e, scope: (e.scope ?? 'actual').toLowerCase() as any })));
        }
    }, [globalLedger]);

    const scenarioLedger = useMemo(() => {
        if (!actualLedger || actualLedger.length === 0) return [];
        return projectScenarioFrontend(actualLedger, selectedDate, { revenueMult, expenseMult, fixedCostDelta }, macro, projectionMonths);
    }, [actualLedger, selectedDate, revenueMult, expenseMult, fixedCostDelta, macro, projectionMonths]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val);

    const handleSaveStrategy = () => {
        const name = prompt("저장할 전략의 이름을 입력하세요:");
        if (name) setSavedStrategies(prev => [...prev, { name, revenueMult, expenseMult, fixedCostDelta, timestamp: new Date().toLocaleString() }]);
    };

    const handleReset = () => {
        setRevenueMult(1.0);
        setExpenseMult(1.0);
        setFixedCostDelta(0);
        setProjectionMonths(36);
        setScenarioLedger([]); // 🔥 시나리오 레저 초기화 (SSOT Fallback 트리거)
        setVersion(v => v + 1); // 강제 재로그 및 렌더링 트리거
        console.log("🔥 [RESET] Scenario data cleared. Falling back to Actual Ledger.");
    };


    // 🚨 SSOT RULE: KPI calculations MUST NOT be implemented in this file.
    // All metrics must come from engineResult.stats (metricRegistry / engine layer).
    const engineResult = useMemo(() => {
        if (!selectedDate || !actualLedger.length || !trialBalance) return null;
        
        const liquidityFromTB = MetricRegistry.calculateLiquidity(trialBalance);
        const liquidCashData = {
            ...liquidityFromTB,
            grossCash: sumCashAccounts(actualLedger, selectedDate)
        };

        return runStrategicCompassEngine({
            actualLedger,
            projectionLedger: scenarioLedger,
            baselineEntries,
            selectedDate,
            preMoneyValuation,
            investmentAmount,
            liquidCashData,
            projectionMonths,
            coa: accounts
        });
    }, [trialBalance, scenarioLedger, actualLedger, baselineEntries, selectedDate, preMoneyValuation, investmentAmount, projectionMonths, version]);

    const stats = engineResult?.stats as any;

    // 🚨 SYNC AUDIT: Slider changes must trigger immediate engine re-run.
    useEffect(() => {
        if (stats) {
            console.log("[STRATEGIC SYNC] Parameters updated, stats recalculated.", {
                revenueMult, expenseMult, fixedCostDelta,
                survival: stats.survivalRunway,
                strategic: stats.strategicRunway
            });
        }
    }, [revenueMult, expenseMult, fixedCostDelta, macro, stats]);

    // Survival Runway = 현재 현금 / 최근 Burn (매출 0 가정, 정적)
    // Strategic Runway = forward simulation 기반 cash depletion 시점 (성장 반영)
    const {
        survivalRunway = 0,
        strategicRunway = 0,
        netBurn = 0,
        grossBurn = 0,
        cashBalance = 0,
        breakEvenMonth,
        actualNetProfit = 0,
        cashBurn = 0,
        burnBreakdown
    } = stats || {};

    const chartData = engineResult?.chartData || [];
    const advice = stats?.insight;
    const equityAnalysis = stats?.equityAnalysis;
    const equitySignal = getEquitySignal(strategicRunway);

    const nowIndex = useMemo(() => chartData.findIndex(d => d.isNow), [chartData]);
    const cashOutX = useMemo(() => (stats?.cashOutMonth && chartData[stats.cashOutMonth]) ? chartData[stats.cashOutMonth].month : null, [stats?.cashOutMonth, chartData]);
    const bepX = useMemo(() => (breakEvenMonth != null && chartData[breakEvenMonth]) ? chartData[breakEvenMonth].month : null, [breakEvenMonth, chartData]);
    const equityX = useMemo(() => (stats?.cashOutMonth && chartData.length) ? chartData[Math.max(stats.cashOutMonth - 6, 0)]?.month : null, [stats?.cashOutMonth, chartData]);

    const fundingEvent = useMemo(() => {
        if (!equityAnalysis || !chartData || equityAnalysis.fundingIndex === -1) return null;
        const idx = equityAnalysis.fundingIndex as number;
        return { 
            index: idx, 
            date: chartData[idx]?.month, 
            failDate: equityAnalysis.failIndex !== -1 ? chartData[equityAnalysis.failIndex as number]?.month : null, 
            fundingNeeded: equityAnalysis.fundingNeeded, 
            remainingRunway: equityAnalysis.timing?.runwayMonths || 0, 
            reason: equityAnalysis.fundingReason 
        };
    }, [chartData, equityAnalysis]);

    const fundingX = fundingEvent?.date || null;
    const fundingSignal = fundingEvent ? { label: '🔴 Funding Needed', color: '#ef4444' } : null;

    return (
        <div className="flex-1 bg-[#07090F] min-h-screen text-slate-100 p-8 lg:p-12">
            <header className="flex items-center justify-between pb-10 border-b border-white/5 mb-12 flex-wrap gap-8">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-600/30 border border-blue-400/20">
                        <Compass size={32} className={loading ? 'animate-spin' : ''} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="text-[10px] font-black text-white bg-emerald-500 px-3 py-1 rounded-full uppercase tracking-widest">CASH VIEW</span>
                            <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg uppercase tracking-widest border border-blue-500/20">Experimental Strategy Mode</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter italic">전략 나침반 <span className="text-slate-500 text-xl font-bold not-italic ml-2">(Strategic Compass v2.6)</span></h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => { setRevenueMult(1.0); setExpenseMult(1.0); setFixedCostDelta(0); setScenarioLedger([]); setBaselineEntries([]); }} className="h-12 px-5 bg-[#1A1F2B] border border-white/5 rounded-xl text-[10px] font-black text-white hover:bg-[#252B3A] transition-all uppercase tracking-widest">초기화</button>
                    <button onClick={handleSaveStrategy} className="h-12 px-5 bg-[#1A1F2B] border border-white/5 rounded-xl text-[10px] font-black text-white hover:bg-[#252B3A] transition-all uppercase tracking-widest">저장</button>
                    <button onClick={handleExportAll} disabled={loading} className="h-12 px-6 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black text-white shadow-lg transition-all uppercase tracking-widest">엑스포트</button>
                </div>
            </header>

            <div className="flex flex-col gap-6">
                <section className={`${advice?.bg ?? "bg-slate-500/10"} border-2 ${advice?.border ?? "border-slate-500/20"} p-8 rounded-[3rem] relative overflow-hidden shadow-2xl`}>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className={`p-4 rounded-2xl bg-white/5 ${advice?.color ?? "text-slate-400"}`}>
                                {advice && advice.Icon && <advice.Icon size={32} />}
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">CFO Intelligence</p>
                                <h3 className={`${advice?.color ?? "text-slate-100"} text-2xl font-black italic uppercase tracking-tighter`}>{advice?.label ?? "분석 대기 중"}</h3>
                                <h4 className="text-xl font-black text-white italic tracking-tight mt-1">"{advice?.message ?? "시나리오를 조정하여 인텔리전스를 활성화하세요."}"</h4>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-10">
                            <ExplainableKPI
                                label="최근 평균 현금 소진액"
                                result={{ 
                                    value: Math.abs(burnBreakdown?.netCashAvg || 0), 
                                    formula: 'Cash In - Cash Out (Avg)', 
                                    period: 'Recent 6m', 
                                    dataSource: 'scenario',
                                    inputs: { 'Net Cash Delta (Avg)': burnBreakdown?.netCashAvg || 0 }
                                }}
                                color={burnBreakdown?.isBurning ? "text-rose-500" : "text-emerald-400"}
                                formatValue={(v) => <span className="text-xl font-black italic">{formatCurrency(v)}</span>}
                            />
                        </div>
                    </div>
                </section>

                {/* 🚫 DO NOT add new burn models or burn bridge logic here. Use stats only. */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ExplainableKPI label="💸 Survival Runway" result={stats?.liquidityRunway || null} color={survivalRunway >= 6 ? 'text-blue-400' : 'text-rose-400'} formatValue={(v) => <span className="text-xl font-black italic">{(v === null || v === undefined) ? "지속 가능" : (v === Infinity ? "∞" : `${v.toFixed(1)}개월`)}</span>} />
                    <ExplainableKPI label="📈 Strategic Runway" result={stats?.runway || null} color={strategicRunway >= 12 ? 'text-emerald-400' : 'text-rose-400'} formatValue={(v) => <span className="text-xl font-black italic">{(v === null || v === undefined) ? "지속 가능" : (v === Infinity ? "∞" : `${v.toFixed(1)}개월`)}</span>} />
                    <ExplainableKPI label="흑자 전환 시점" result={{ value: stats?.breakEvenOffset || 0, formula: 'Scenario Net Income > 0 Check', period: 'Simulation', dataSource: 'scenario' } as any} color="text-indigo-400" formatValue={(v) => <span className="text-xl font-black italic">{stats?.breakEvenOffset != null ? `${stats.breakEvenOffset}개월` : "N/A"}</span>} />
                    <ExplainableKPI label="Gross Burn" result={{ value: grossBurn, formula: 'Avg Cash Outflow', period: 'Recent 6m', dataSource: 'scenario' } as any} color="text-slate-400" formatValue={(v) => <span className="text-xl font-black italic">{formatCurrency(v)}</span>} />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-10 gap-6 items-stretch">
                    <aside className="xl:col-span-3 flex flex-col gap-4 max-h-[720px] overflow-y-auto pr-2">
                        <section className="bg-[#0B1221] border border-white/5 p-6 rounded-[2rem] shadow-2xl">
                             <h3 className="text-sm font-black text-white italic tracking-tighter uppercase mb-6 flex items-center gap-2"><TrendingUp size={16} /> Macro Environment</h3>
                             <div className="space-y-6">
                                <SimulationSlider label="예측 기간 (Time Horizon)" val={projectionMonths} setVal={setProjectionMonths} min={3} max={60} step={3} color="accent-slate-500" suffix="개월" />
                                <SimulationSlider label="물가상승률" val={macro.inflationRate} setVal={(v) => setMacro({ ...macro, inflationRate: v })} min={0} max={0.2} step={0.005} color="accent-rose-500" percentage />
                                <SimulationSlider label="임금 상승률" val={macro.wageGrowthRate} setVal={(v) => setMacro({ ...macro, wageGrowthRate: v })} min={0} max={0.2} step={0.005} color="accent-emerald-500" percentage />
                                <SimulationSlider label="기타 비용 증가율" val={macro.otherExpenseGrowth} setVal={(v) => setMacro({ ...macro, otherExpenseGrowth: v })} min={0} max={0.2} step={0.005} color="accent-amber-500" percentage />
                                <SimulationSlider label="자연 매출 성장률" val={macro.revenueNaturalGrowth} setVal={(v) => setMacro({ ...macro, revenueNaturalGrowth: v })} min={0} max={0.3} step={0.005} color="accent-blue-500" percentage />
                                <button onClick={() => handleGenerateBaseline()} disabled={loading} className={`w-full h-10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isBaselineStale ? 'bg-rose-600' : 'bg-emerald-600'} text-white`}>베이스라인 갱신</button>
                             </div>
                        </section>
                        <section className="bg-[#121620] border border-white/5 p-6 rounded-[2rem] shadow-2xl">
                             <h3 className="text-sm font-black text-white italic tracking-tighter uppercase mb-6 flex items-center gap-2"><Zap size={16} /> Strategy Parameters</h3>
                             <div className="space-y-6">
                                <SimulationSlider label="성장 가속 (Sales x)" val={revenueMult} setVal={setRevenueMult} min={0.5} max={3.0} step={0.1} color="accent-blue-500" />
                                <SimulationSlider label="비용 절감 (Cost Cut)" val={expenseMult} setVal={setExpenseMult} min={0.5} max={1.5} step={0.05} color="accent-amber-500" />
                                <SimulationSlider label="추가 고정비 (Investment)" val={fixedCostDelta} setVal={setFixedCostDelta} min={0} max={100_000_000} step={1_000_000} color="accent-indigo-500" isCurrency />
                             </div>
                        </section>
                        <section className="bg-[#181121] border border-white/5 p-6 rounded-[2rem] shadow-2xl">
                             <h3 className="text-sm font-black text-white italic tracking-tighter uppercase mb-6 flex items-center gap-2"><Database size={16} /> Data Integrity</h3>
                             <div className="space-y-4">
                                <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Anchor Basis</span>
                                    <span className="text-[10px] font-black italic text-emerald-400">LEDGER TRUTH</span>
                                </div>
                             </div>
                        </section>
                    </aside>

                    <main className="xl:col-span-7 flex flex-col gap-6">
                        <section className="bg-[#121620] border border-white/5 p-10 rounded-[3rem] shadow-3xl relative">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3"><Activity size={24} className="text-blue-500" /> Cash Flow Survival Trajectory</h3>
                            </div>

                            <div style={{ width: "100%", height: 600 }} className="relative overflow-hidden flex items-center justify-center">
                                {chartData && chartData.length > 0 ? (
                                    <div className="relative w-full h-full">
                                        <ResponsiveContainer width="100%" height={600}>
                                            <AreaChart data={chartData} margin={{ top: 60, right: 30, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                <XAxis dataKey="month" stroke="#475569" fontSize={10} fontWeight="black" axisLine={false} tickLine={false} interval={2} />
                                                <YAxis yAxisId="cash" stroke="#10b981" fontSize={10} fontWeight="black" axisLine={false} tickLine={false} tickFormatter={(val) => `₩${(val / 1000000).toFixed(0)}M`} />
                                                <YAxis yAxisId="pnl" orientation="right" stroke="#3b82f6" fontSize={10} fontWeight="black" axisLine={false} tickLine={false} tickFormatter={(val) => `₩${(val / 1000000).toFixed(1)}M`} />
                                                <Tooltip content={<CustomChartTooltip stats={stats} />} />
                                                
                                                <Area yAxisId="cash" type="monotone" dataKey="BaselineCash" name="베이스라인 현금" stroke="#10b98166" fillOpacity={0} strokeWidth={2} strokeDasharray="6 6" />
                                                <Area yAxisId="cash" type="monotone" dataKey="ScenarioCash" name="시나리오 현금" stroke="#10b981" fillOpacity={1} fill="url(#colorCash)" strokeWidth={4} />
                                                <Line yAxisId="pnl" type="monotone" dataKey="ActualProfit" name="실제 이익" stroke="#ffffff88" strokeWidth={3} dot={false} />
                                                <Line yAxisId="pnl" type="monotone" dataKey="ScenarioProfit" name="시나리오 이익" stroke="#3b82f6" strokeWidth={3} dot={false} />

                                                {cashOutX && <ReferenceLine yAxisId="cash" x={cashOutX} stroke="#f87171" strokeWidth={3} strokeDasharray="6 6" label={{ value: 'CASH OUT', fill: '#f87171', fontSize: 10, fontWeight: 900 }} />}
                                                {bepX && <ReferenceLine x={bepX} stroke="#22c55e" strokeWidth={3} strokeDasharray="6 6" label={{ value: 'BEP', fill: '#22c55e', fontSize: 10, fontWeight: 700 }} />}
                                                {equityX && equitySignal && <ReferenceLine yAxisId="cash" x={equityX} stroke={equitySignal.color} strokeDasharray="4 4" label={{ value: equitySignal.label, fill: equitySignal.color, fontSize: 10 }} />}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 opacity-40">
                                        <RefreshCw size={48} className="animate-spin text-blue-500" />
                                        <p className="text-xl font-black italic text-blue-400 uppercase tracking-widest">Synchronizing Engine...</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-8 bg-blue-500/10 border border-blue-500/20 rounded-[2.5rem] flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Recommended Funding Target</p>
                                    <h4 className="text-3xl font-black text-white italic leading-none">
                                        {(equityAnalysis?.fundingNeeded ?? 0) > 0 
                                            ? `₩${((equityAnalysis?.fundingNeeded || 0) / 100000000).toFixed(1)}억` 
                                            : 'Stable (No Funding Needed)'}
                                    </h4>
                                    <p className="text-[10px] font-bold text-slate-500 mt-2 italic">Strategic Runway 확보를 위한 목표치</p>
                                </div>
                                <Zap size={32} className="text-blue-500" />
                            </div>
                        </div>
                    </main>
                </div>

                <section className="mt-12 bg-[#121620] border border-white/5 p-16 rounded-[4rem] shadow-3xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
                    <div className="flex items-center gap-6 mb-16">
                        <div className="p-5 bg-purple-500/10 rounded-[2rem] text-purple-400 border border-purple-500/20"><PieChartIcon size={32} /></div>
                        <div>
                            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Equity & Cap Table <span className="text-purple-500 not-italic">Simulation</span></h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">지분 희석 및 경영권 제어</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                        <div className="space-y-12">
                            <SimulationSlider label="Pre-money Valuation" val={preMoneyValuation} setVal={setPreMoneyValuation} min={10000000000} max={100000000000} step={1000000000} color="accent-purple-500" isCurrency />
                            <SimulationSlider label="Investment Amount" val={investmentAmount} setVal={setInvestmentAmount} min={0} max={50000000000} step={1000000000} color="accent-blue-500" isCurrency />
                        </div>
                        <div className="flex flex-col items-center gap-8">
                            <div className="relative w-64 h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie data={[{ name: 'Founder', value: report.founderRatio }, { name: 'Investor', value: 100 - report.founderRatio }]} innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                                            <Cell fill={report.founderRatio >= 50 ? '#10b981' : '#f43f5e'} />
                                            <Cell fill="rgba(255,255,255,0.05)" />
                                        </Pie>
                                    </RePieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                                    <span className="text-4xl font-black text-white italic">{report.founderRatio.toFixed(1)}%</span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Founder</span>
                                </div>
                            </div>
                            <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl">
                                <span className="text-[12px] font-black uppercase text-purple-400">Control State: {CONTROL_LABEL[report.controlState]}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

const SimulationSlider: React.FC<{
    label: string, val: number, setVal: (v: number) => void, min: number, max: number, step: number, color: string, trend?: 'emerald' | 'rose', isCurrency?: boolean, percentage?: boolean, suffix?: string
}> = ({ label, val, setVal, min, max, step, color, isCurrency, percentage, suffix }) => (
    <div className="group">
        <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{label}</span>
            <span className="text-xs font-black italic text-blue-400">
                {isCurrency ? (val === 0 ? '₩0' : `₩${(val / 100000000).toLocaleString()}억`) : percentage ? `${(val * 100).toFixed(1)}%` : suffix ? `${val}${suffix}` : `${val.toFixed(1)}x`}
            </span>
        </div>
        <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => setVal(parseFloat(e.target.value))} className={`w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer ${color} accent-current`} />
    </div>
);

export default StrategicCompass;
