import React, { useState, useMemo, useEffect } from 'react';
import { 
    TrendingUp, 
    TrendingDown, 
    Wallet, 
    Activity, 
    ShieldCheck, 
    Lock, 
    Zap,
    ArrowUpRight,
    Info,
    HelpCircle as HelpIcon,
    RefreshCw,
    Target
} from 'lucide-react';
import { MetricRegistry } from '../core/reporting/metricRegistry';
import { ExplainableKPI } from '../components/shared/ExplainableKPI';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccounting } from '../hooks/useAccounting';
import { generateDashboardReport } from '../core/reporting/dashboardReporter';
import { IntegrityBadge } from '../components/dashboard/IntegrityBadge';
import { PremiumDatePicker } from '../components/common/PremiumDatePicker';
import { generateMultiYearSimulation } from '../core/simulation/journalGenerator';
import { SCENARIO_CONFIGS } from '../core/simulation/scenarioConfigs';

/**
 * [REALITY CENTER] Dashboard
 * Rule: Displays ACTUAL historical data.
 * Labels: Explicitly uses '(현재)' to distinguish from simulations.
 */
export const Dashboard = () => {
    const { 
        ledger, trialBalance, accountingLedger, subLedger, 
        selectedDate, setSelectedDate, setTab, 
        actualFinancials, isDev, 
        loadSimulation, scenarioResults, resetData
    } = useAccounting();
    
    const [selectedScenario, setSelectedScenario] = useState<'SURVIVAL' | 'STANDARD' | 'GROWTH'>('STANDARD');
    const [isSimulating, setIsSimulating] = useState(false);
    const isScenarioActive = scenarioResults && scenarioResults.length > 0;

    const scenarioMetaData = {
        'SURVIVAL': { title: '생존 우선 (Survival)', desc: '보수적 지출 및 마진 최적화 중심', color: 'text-amber-400', bg: 'bg-amber-500/10' },
        'STANDARD': { title: '표준 성장 (Standard)', desc: '시장 평균 가이드라인 준행', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        'GROWTH':   { title: '공격 전개 (Growth)', desc: '점유율 확보를 위한 공격적 마케팅', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    };

    const handleRunSimulation = async (years: number[]) => {
        setIsSimulating(true);
        const result = generateMultiYearSimulation(years, SCENARIO_CONFIGS[selectedScenario]);
        loadSimulation(result);
        if (years.length > 0) {
            setSelectedDate(`${years[years.length - 1]}-12-31`);
        }
        setTimeout(() => setIsSimulating(false), 800);
    };

    const analytics = useMemo(() => {
        const actualOnlyLedger = ledger.filter(e => e.scope !== 'scenario');
        const report = generateDashboardReport(actualOnlyLedger, selectedDate);
        return {
            ...report,
            hasActivity: actualOnlyLedger.length > 0
        };
    }, [ledger, selectedDate]);

    const metricResults = useMemo(() => {
        if (!trialBalance || !ledger) return null;
        const f = actualFinancials;
        const actualLedger = ledger.filter(e => e.scope !== 'scenario');
        
        // 0.7 vs 0.4 Runway logic fix: Always calculated on actual ledger for Dashboard
        const liquidCash = f.cash - f.ap;
        const runway = MetricRegistry.calculateRunway(liquidCash, actualLedger, selectedDate);
        
        return { 
            liquidCash: { value: f.realAvailableCash, inputs: { '가용 현금': f.cash, '미지급금(AP)': f.ap }, formula: 'Cash - AP', period: '현재 시점 (실측)', dataSource: 'actual' as any }, 
            actualNetProfit: { value: f.netIncome, inputs: { '수입': f.revenue, '비용': f.expenses }, formula: 'Total Revenue - Total Expenses', period: '당기 누적 (실측)', dataSource: 'actual' as any }, 
            runway: {
                ...runway,
                label: 'Runway (현재)',
                dataSource: 'actual' as any,
                period: '실측 기반 (Baseline)'
            },
            burn: {
                netBurn: runway.inputs['평금 소모액 (최근 3개월)'] as number || 0,
            }
        };
    }, [actualFinancials, ledger, trialBalance, selectedDate]);

    return (
        <div className="flex-1 bg-[#0B1221] space-y-8 animate-in fade-in duration-500 pb-12 px-8 overflow-y-auto custom-scrollbar h-screen">
            <header className="flex flex-col gap-6 mt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <IntegrityBadge ledger={ledger} accountingLedger={subLedger} trialBalance={trialBalance} financials={actualFinancials} reportingDate={selectedDate} />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                            <Activity size={28} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-white bg-slate-800 px-3 py-0.5 rounded-full uppercase tracking-widest border border-white/5">
                                    Reality Center
                                </span>
                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-0.5 rounded-full uppercase tracking-widest border border-emerald-500/20">
                                    ACTUAL DATA ONLY
                                </span>
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3 italic uppercase">
                                CFO COMMAND CENTER
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-[#151D2E] px-4 py-2 rounded-2xl border border-white/5 shadow-xl">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">분석 기준일:</span>
                            <PremiumDatePicker value={selectedDate} onChange={setSelectedDate} />
                        </div>
                        
                        <button 
                            onClick={() => {
                                if (window.confirm('⚠️ 데이터 초기화 경고\n\n현재 장부에 입력된 모든 실제 전표와 파트너, 자산 정보가 영구적으로 삭제됩니다. 계속하시겠습니까?')) {
                                    resetData();
                                    alert('시스템이 초기화되었습니다.');
                                }
                            }}
                            className="p-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl border border-rose-500/20 transition-all flex items-center justify-center gap-2 group"
                            title="전체 데이터 리셋"
                        >
                            <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">System Reset</span>
                        </button>

                        <button 
                            onClick={() => setTab('closing')}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black tracking-widest uppercase transition-all shadow-xl shadow-emerald-600/20 flex items-center gap-2 border border-emerald-400/30"
                        >
                            <Lock size={14} /> 결산 실행
                        </button>
                    </div>
                </div>

                {/* Strategy Command Bar (Always Present for Strategic Intent) */}
                <div className="flex flex-col gap-4 p-6 bg-[#151D2E]/50 border border-white/5 rounded-[2.5rem] backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">SCENARIO:</span>
                                <div className="flex gap-1.5">
                                    {(['SURVIVAL', 'STANDARD', 'GROWTH'] as const).map(mode => (
                                        <button 
                                            key={mode}
                                            onClick={() => setSelectedScenario(mode)}
                                            className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${selectedScenario === mode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'}`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-2xl border border-indigo-500/20">
                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest italic">INTENT:</span>
                                <span className="text-xs font-bold text-white uppercase">{scenarioMetaData[selectedScenario].title}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                             <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic mr-4">Preview on Strategic Compass Tab →</p>
                            <button 
                                onClick={() => handleRunSimulation([2026, 2027, 2028])}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-all rounded-2xl text-xs font-black tracking-widest uppercase flex items-center gap-2 border border-indigo-400/30"
                            >
                                {isSimulating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} className="animate-pulse" />}
                                {isSimulating ? 'SIMULATING...' : 'PREVIEW FULL SCENARIO'}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* 메인 KPI 섹션 - Click to Expand Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div>
                    <ExplainableKPI 
                        label="💸 Runway (현재)" 
                        result={metricResults?.runway || { value: 0, inputs: {}, formula: '', period: '', dataSource: 'actual' as any }}
                        description="현재 자금과 실측 데이터를 기반으로 한 생존 기간입니다. 클릭하여 계산 근거(Cash / Burn)를 확인하세요."
                        color={(metricResults?.runway?.value || 0) < 6 ? 'text-rose-400' : 'text-blue-400'}
                        icon={<Activity size={16} />}
                        formatValue={(v) => (v === Infinity || metricResults?.runway?.isInfinite) ? "지속 가능" : `${v.toFixed(1)}개월`}
                    />
                </div>
                <div>
                    <ExplainableKPI 
                        label="🔥 Burn (현재)" 
                        result={{
                            value: metricResults?.burn.netBurn || 0,
                            inputs: { '최근 평균 소모액': metricResults?.burn.netBurn || 0 }, 
                            formula: 'Monthly Avg Cash Outflow',
                            period: '최근 3개월 평균 (실측)',
                            dataSource: 'actual' as any
                        }}
                        description="실제 장부 기록을 바탕으로 매달 소모되는 현금 평균액입니다."
                        color={(metricResults?.burn.netBurn || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}
                        icon={<TrendingDown size={16} />}
                    />
                </div>
                <div>
                    <ExplainableKPI 
                        label="💰 Cash (순유동성)" 
                        result={metricResults?.liquidCash || { value: 0, inputs: {}, formula: '', period: '', dataSource: 'actual' as any }}
                        description="현재 시점의 즉시 가용 순유동성입니다 (Cash - AP)."
                        color="text-blue-400"
                        icon={<Wallet size={16} />}
                    />
                </div>
                <div>
                    <ExplainableKPI 
                        label="영업 매출 (현재)" 
                        result={metricResults?.actualNetProfit ? { value: analytics.operatingRevenue, dataSource: 'actual' as any, inputs: { '총 매출': analytics.totalRevenue, '보조금 제외': analytics.grantIncome }, formula: 'Total Revenue - Grants', period: '당기 누적 (실측)' } : { value: 0, dataSource: 'actual' as any, inputs: {}, formula: '', period: '' }}
                        description="보조금을 제외한 비즈니스 모델 기반의 실제 매출액입니다."
                        color="text-emerald-400"
                        icon={<TrendingUp size={16} />}
                    />
                </div>
                <div>
                    <ExplainableKPI 
                        label="당기 순이익 (현재)" 
                        result={metricResults?.actualNetProfit || { value: 0, inputs: {}, formula: '', period: '', dataSource: 'actual' as any }}
                        description="모든 수익과 비용이 반영된 현재의 최종 결과입니다."
                        color="text-indigo-400"
                        icon={<Activity size={16} />}
                    />
                </div>
            </div>

            {/* 추세 그래프 */}
            <div className="grid grid-cols-1 gap-8">
                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden group">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                                <TrendingUp size={24} />
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight italic uppercase">Historical Financial Trend <span className="text-slate-500 not-italic text-sm ml-2">(ACTUAL)</span></h3>
                        </div>
                    </div>
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics.cashFlowData}>
                                <defs>
                                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={val => `${(val / 1000000).toFixed(0)}M`} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', padding: '12px' }} 
                                    formatter={(value: any, name: any) => [`₩${(value ?? 0).toLocaleString()}`, name === 'income' ? '실제 수입' : '실제 지출']}
                                />
                                <Area type="monotone" dataKey="income" name="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIn)" />
                                <Area type="monotone" dataKey="expense" name="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorOut)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
