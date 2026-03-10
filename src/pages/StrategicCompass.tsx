import React, { useState, useEffect } from 'react';
import {
    Compass,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Zap,
    RefreshCw,
    Info,
    ChevronRight,
    ShieldCheck,
    Target
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { invoke } from '@tauri-apps/api/core';
import { JournalEntry, ScenarioDefinition, ScenarioAssumption } from '../types';

const StrategicCompass: React.FC = () => {
    const [actualLedger, setActualLedger] = useState<JournalEntry[]>([]);
    const [scenarioLedger, setScenarioLedger] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(false);

    // Assumptions (Sliders)
    const [revenueMult, setRevenueMult] = useState(1.0);
    const [expenseMult, setExpenseMult] = useState(1.0);
    const [fixedCostDelta, setFixedCostDelta] = useState(0);

    useEffect(() => {
        loadActualData();
    }, []);

    const loadActualData = async () => {
        try {
            const response: any = await invoke('run_simulation_data');
            setActualLedger(response.ledger || []);
            // Sync initial scenario
            runScenario(response.ledger || []);
        } catch (err) {
            console.error('Failed to load ledger', err);
        }
    };

    const runScenario = async (ledger: JournalEntry[]) => {
        setLoading(true);
        try {
            const definition: ScenarioDefinition = {
                id: `SC-${Date.now()}`,
                name: "Strategic Hypothesis A",
                baseSnapshotId: "SNAPSHOT-2026-03",
                createdAt: new Date().toISOString(),
                assumptions: [
                    { key: 'revenue_multiplier', value: revenueMult, description: 'Projected Sales Growth' },
                    { key: 'expense_multiplier', value: expenseMult, description: 'Efficiency Optimization' },
                    { key: 'fixed_cost_delta', value: fixedCostDelta, description: 'Incremental Fixed Costs' }
                ]
            };

            const result: JournalEntry[] = await invoke('run_strategic_scenario', {
                definition,
                ledger
            });
            setScenarioLedger(result);
        } catch (err) {
            console.error('Scenario projection failed', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(val);

    // Grouping for Chart
    const prepareChartData = () => {
        const months = ['01', '02', '03', '04', '05', '06']; // Simplified mock timeline
        return months.map(m => {
            const actualRevenue = actualLedger
                .filter(e => e.date.includes(`-0${m}`) && e.scope === 'Actual' && e.debitAccount === '현금')
                .reduce((sum, e) => sum + e.amount, 0);

            const scenarioRevenue = scenarioLedger
                .filter(e => e.date.includes(`-0${m}`) && e.scope === 'Scenario' && e.debitAccount === '현금')
                .reduce((sum, e) => sum + e.amount, 0);

            return {
                month: `${m}월`,
                Actual: actualRevenue,
                Scenario: scenarioRevenue
            };
        });
    };

    return (
        <div className="min-h-screen bg-[#050505] text-slate-100 p-8 font-sans">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-3">
                        <Compass className="w-8 h-8 text-blue-400" />
                        전략 나침반 (Strategic Compass)
                    </h1>
                    <p className="text-slate-400 mt-2 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        L4 Immutable Snapshot 기반 - 장부 오염 없는 실시간 전략 시뮬레이션
                    </p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => runScenario(actualLedger)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-lg transition-all shadow-lg active:scale-95"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        시뮬레이션 실행
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Left: Controllers (Assumptions) */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-xl">
                        <div className="flex items-center gap-2 mb-6 text-emerald-400 font-bold">
                            <Zap className="w-5 h-5" />
                            전략적 가정 (Assumptions)
                        </div>

                        <div className="space-y-8">
                            {/* Revenue Multiplier */}
                            <div>
                                <div className="flex justify-between mb-4">
                                    <label className="text-sm font-medium text-slate-300">매출 성장 동력 (Revenue x{revenueMult})</label>
                                    <span className={`text-sm font-bold ${revenueMult >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {Math.round((revenueMult - 1) * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range" min="0.5" max="2.0" step="0.1" value={revenueMult}
                                    onChange={(e) => setRevenueMult(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            {/* Expense Multiplier */}
                            <div>
                                <div className="flex justify-between mb-4">
                                    <label className="text-sm font-medium text-slate-300">비용 효율화 (Expense x{expenseMult})</label>
                                    <span className={`text-sm font-bold ${expenseMult <= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {Math.round((expenseMult - 1) * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range" min="0.5" max="1.5" step="0.05" value={expenseMult}
                                    onChange={(e) => setExpenseMult(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                            </div>

                            {/* Fixed Cost Delta */}
                            <div>
                                <div className="flex justify-between mb-4">
                                    <label className="text-sm font-medium text-slate-300">신규 고정비 투자 (월 ₩)</label>
                                    <span className="text-sm font-bold text-blue-400">+{formatCurrency(fixedCostDelta)}</span>
                                </div>
                                <input
                                    type="range" min="0" max="50000000" step="1000000" value={fixedCostDelta}
                                    onChange={(e) => setFixedCostDelta(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-2xl">
                        <h3 className="text-blue-400 font-bold flex items-center gap-2 mb-3">
                            <Info className="w-4 h-4" />
                            CFO Advice
                        </h3>
                        <p className="text-sm text-blue-300/80 leading-relaxed">
                            매출 성장률이 {revenueMult}배 상승하더라도, 고정비가 {formatCurrency(fixedCostDelta)} 증가할 경우
                            현금 소진 시점(Burn Date)은 오히려 앞당겨질 수 있습니다.
                            <strong> {revenueMult > 1.5 ? '공격적 확장' : '안정적 성장'}</strong> 전략이 권장됩니다.
                        </p>
                    </div>
                </div>

                {/* Right: Visualization */}
                <div className="col-span-12 lg:col-span-8 space-y-6">
                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl h-[500px]">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Target className="w-5 h-5 text-blue-400" />
                                Strategic Impact Analysis
                            </h2>
                            <div className="flex gap-4 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 bg-slate-500 rounded-full" /> 실제 장부 (Actual)
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full" /> 전략 가정 (Scenario)
                                </div>
                            </div>
                        </div>

                        <ResponsiveContainer width="100%" height="85%">
                            <AreaChart data={prepareChartData()}>
                                <defs>
                                    <linearGradient id="colorScenario" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                <XAxis dataKey="month" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" tickFormatter={val => `${val / 1000000}M`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#f8fafc' }}
                                    formatter={(val: any) => formatCurrency(Number(val))}
                                />
                                <Area type="monotone" dataKey="Actual" stroke="#94a3b8" fillOpacity={0} strokeDasharray="5 5" />
                                <Area type="monotone" dataKey="Scenario" stroke="#3b82f6" fillOpacity={1} fill="url(#colorScenario)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm">전략 적용 후 순이익 변화</p>
                                <h4 className={`text-2xl font-bold mt-1 ${revenueMult > expenseMult ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {revenueMult > expenseMult ? <TrendingUp className="inline w-6 h-6 mr-1" /> : <TrendingDown className="inline w-6 h-6 mr-1" />}
                                    {Math.round((revenueMult / expenseMult - 1) * 100)}%
                                </h4>
                            </div>
                            <ChevronRight className="text-slate-600" />
                        </div>
                        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm">임계점 (Break-even Point)</p>
                                <h4 className="text-2xl font-bold mt-1 text-slate-100">2027-04 예측</h4>
                            </div>
                            <ChevronRight className="text-slate-600" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StrategicCompass;
