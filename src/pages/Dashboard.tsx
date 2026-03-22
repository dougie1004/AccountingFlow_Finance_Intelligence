import React, { useState, useMemo, useEffect, useContext } from 'react';
import { 
    TrendingUp, 
    TrendingDown, 
    Wallet, 
    Activity, 
    Zap, 
    ShieldCheck, 
    Calendar,
    Target,
    Lock,
    HelpCircle,
    ArrowUpRight,
    ChevronRight,
    Info,
    HelpCircle as HelpIcon,
    Table,
    Calculator as CalcIcon,
    RefreshCw, // Added RefreshCw icon
    ArrowUp // Added ArrowUp icon
} from 'lucide-react';
import { MetricRegistry } from '../core/reporting/metricRegistry';
import { ExplainableKPI } from '../components/shared/ExplainableKPI';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccounting } from '../hooks/useAccounting';
import { generateMultiYearSimulation } from '../core/simulation/journalGenerator';
import { SCENARIO_CONFIGS } from '../core/simulation/scenarioConfigs';
import { resolveARPU, resolveMarketing } from '../core/engine/scenarioResolver';
import { generateDashboardReport } from '../core/reporting/dashboardReporter';
import { IntegrityBadge } from '../components/dashboard/IntegrityBadge';
import { PremiumDatePicker } from '../components/common/PremiumDatePicker';

export const Dashboard = () => {
    const { 
        ledger, trialBalance, accountingLedger, subLedger, 
        selectedDate, setSelectedDate, setTab, 
        loadSimulation, financials, isDev, scenarioResults
    } = useAccounting();
    const [selectedScenario, setSelectedScenario] = useState<'SURVIVAL' | 'STANDARD' | 'GROWTH'>('STANDARD');
    const [isSimulating, setIsSimulating] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Simulation Parameters based on SURVIVAL/STANDARD/GROWTH
    const scenarioMetaData = {
        'SURVIVAL': { title: '생존 우선 (Survival)', desc: '보수적 지출 및 마진 최적화 중심', color: 'text-amber-400', bg: 'bg-amber-500/10' },
        'STANDARD': { title: '표준 성장 (Standard)', desc: '시장 평균 가이드라인 준행', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        'GROWTH':   { title: '공격 전개 (Growth)', desc: '점유율 확보를 위한 공격적 마케팅', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    };

    // Simulation logic is handled globally in AccountingContext

    const handleRunSimulation = async (years: number[]) => {
        setIsSimulating(true);
        // Using the multi-year generator with the selected scenario
        const result = generateMultiYearSimulation(years, SCENARIO_CONFIGS[selectedScenario]);
        loadSimulation(result);

        // Auto-adjust date to view the projected results
        if (years.length > 0) {
            const lastYear = years[years.length - 1];
            setSelectedDate(`${lastYear}-12-31`);
        }

        setTimeout(() => setIsSimulating(false), 800);
    };

    const handleScenarioChange = (scenario: 'SURVIVAL' | 'STANDARD' | 'GROWTH') => {
        setSelectedScenario(scenario);
        // Removed auto-run of simulation upon scenario card click to prevent unintentional ledger overwrites
    };

    const analytics = useMemo(() => {
        const report = generateDashboardReport(ledger, selectedDate);
        return {
            ...report,
            hasActivity: ledger.length > 0
        };
    }, [ledger, selectedDate]);

    const metricResults = useMemo(() => {
        if (!trialBalance) return null;
        const liquidCash = MetricRegistry.calculateLiquidCash(trialBalance);
        const actualNetProfit = MetricRegistry.calculateNetProfit(trialBalance);
        
        const ytStart = `${selectedDate.split('-')[0]}-01-01`;
        const cashDelta = MetricRegistry.calculateCashDelta(ledger, ytStart, selectedDate);

        return { liquidCash, actualNetProfit, cashDelta };
    }, [trialBalance, ledger, selectedDate]);

    const projectedAnalytics = useMemo(() => {
        const cfg = SCENARIO_CONFIGS[selectedScenario];
        
        // Dynamic ARPU extraction from ledger
        let latestUsers = 0;
        const revEntries = ledger.filter(e => e.description.includes('유저:'));
        if (revEntries.length > 0) {
            const lastEntry = revEntries[revEntries.length - 1];
            const match = lastEntry.description.match(/유저: (\d+)명/);
            if (match) latestUsers = parseInt(match[1]);
        }

        // Get actual monthly revenue to verify ARPU
        const arpuVal = resolveARPU(new Date(selectedDate), cfg);
        const currentArpu = latestUsers > 0 && analytics.operatingRevenue > 0 
            ? (analytics.operatingRevenue / (latestUsers || 1)) 
            : arpuVal;

        // Dynamic CAC estimation (Marketing Spend / Growth)
        // For simplicity in this metric, we use the scenario's CAC baseline but adjusted by current efficiency
        const marketingBudget = resolveMarketing(new Date(selectedDate), cfg);
        const baseCac = marketingBudget > 10000000 ? 150000 : (marketingBudget > 4000000 ? 80000 : 40000);
        
        // LTV Calculation: (ARPU - VariableCost) / Churn
        // Using scenario churn and variable cost per user as we don't have those in ledger
        const varCost = cfg.unitEconomics.variableCostPerUser;
        const churn = cfg.userModel.baseChurn;
        
        return {
            quickRatioCash: analytics.currentCash + (SCENARIO_CONFIGS[selectedScenario].bridgeCapital || 0)
        };
    }, [analytics.currentCash, analytics.operatingRevenue, ledger, selectedScenario, scenarioResults]);

    return (
        <div className="flex-1 bg-[#0B1221] space-y-8 animate-in fade-in duration-500 pb-12 px-8 overflow-y-auto custom-scrollbar h-screen">
            {/* Premium Header Section */}
            <header className="flex flex-col gap-6 mt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <IntegrityBadge ledger={ledger} accountingLedger={subLedger} trialBalance={trialBalance} financials={financials} reportingDate={selectedDate} />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                            <Activity size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3 italic">
                                CFO COMMAND CENTER <span className="text-indigo-400 not-italic">/ DASHBOARD</span>
                            </h1>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full w-fit">
                                    <ShieldCheck size={14} className="text-indigo-500" />
                                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                                        실시간 재무 원장이 통합 분석되고 있습니다.
                                    </p>
                                </div>
                                <div className={`flex items-center gap-2 px-3 py-1 ${isDev ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-amber-500/10 border-amber-500/20'} border rounded-full w-fit`}>
                                    {isDev ? <Zap size={12} className="text-indigo-400" /> : <Lock size={12} className="text-amber-500" />}
                                    <p className={`${isDev ? 'text-indigo-400' : 'text-amber-400'} font-black text-xs uppercase tracking-widest italic`}>
                                        {isDev ? 'Developer Access Active' : 'Read-Only Safety Mode'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                        <div className="flex items-center gap-4">
                            {isDev && (
                                <button 
                                    onClick={() => {
                                        if(confirm("시스템의 모든 장부 데이터를 초기화합니까?")) {
                                            const { resetData } = (window as any).useAccounting ? (window as any).useAccounting() : { resetData: () => {} };
                                            if (typeof resetData === 'function') resetData();
                                            else (window as any).resetData?.();
                                        }
                                    }}
                                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-2xl text-xs font-black tracking-widest uppercase transition-all border border-rose-500/20"
                                >
                                    System Reset
                                </button>
                            )}
                            <div className="flex items-center gap-2 bg-[#151D2E] px-4 py-2 rounded-2xl border border-white/5 shadow-xl">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">기준일:</span>
                                <PremiumDatePicker value={selectedDate} onChange={setSelectedDate} />
                            </div>
                            <button 
                                onClick={() => setTab('closing')}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black tracking-widest uppercase transition-all shadow-xl shadow-emerald-600/20 flex items-center gap-2 border border-emerald-400/30"
                            >
                                <Lock size={14} /> 결산 실행
                            </button>
                        </div>
                </div>

                {/* Strategy & Command Bar */}
                <div className="flex flex-col gap-4 p-6 bg-[#151D2E]/50 border border-white/5 rounded-[2.5rem] backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">SCENARIO MODE:</span>
                                <div className={`flex gap-1.5 ${!isDev ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`} title={!isDev ? "Scenario switching is disabled in Safety Mode" : ""}>
                                    {(['SURVIVAL', 'STANDARD', 'GROWTH'] as const).map(mode => (
                                        <button 
                                            key={mode}
                                            onClick={() => isDev && handleScenarioChange(mode)}
                                            className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${selectedScenario === mode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'}`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-2xl border border-indigo-500/20">
                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest italic">ACTIVE STRATEGY:</span>
                                <span className="text-xs font-bold text-white uppercase">{scenarioMetaData[selectedScenario].title}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={async () => {
                                    if(isDev) {
                                        console.log("[Dashboard] Triggering Full Simulation...");
                                        await handleRunSimulation([2026, 2027, 2028]);
                                    }
                                }}
                                className={`px-6 py-2 ${isDev ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-transform' : 'bg-indigo-600/20 text-indigo-400/50 cursor-not-allowed'} rounded-2xl text-xs font-black tracking-widest uppercase flex items-center gap-2 border ${isDev ? 'border-indigo-400/30' : 'border-indigo-500/10'}`}
                            >
                                {isDev ? (isSimulating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} className="animate-pulse" />) : <Lock size={14} />}
                                {isDev ? (isSimulating ? 'SIMULATING...' : 'RUN FULL SIMULATION') : 'SIMULATION LOCKED'}
                            </button>
                            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 items-center">
                                {[2026, 2027, 2028].map(y => (
                                    <button 
                                        key={y}
                                        onClick={async () => {
                                            if(isDev) {
                                                const yearRange = Array.from({ length: y - 2026 + 1 }, (_, i) => 2026 + i);
                                                await handleRunSimulation(yearRange);
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center gap-2 ${isDev ? 'hover:bg-white/5 text-slate-400 hover:text-white' : 'text-slate-600 cursor-not-allowed'}`}
                                    >
                                        <Target size={12} /> {y}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* 메인 KPI 섹션 - 클릭 시 해당 메뉴로 이동 */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div onClick={() => setTab('monthly-pnl')} className="cursor-pointer">
                    <ExplainableKPI 
                        label="영업 매출액 (OP. REVENUE)" 
                        result={{
                            value: analytics.operatingRevenue,
                            inputs: { '총 매출액': analytics.totalRevenue, '보조금 차감': analytics.grantIncome },
                            formula: '총 매출액 - 보조금 수익',
                            period: '당기 누적 (실측)',
                            dataSource: 'actual'
                        }}
                        description="왜 보조금을 제외하나요? 보조금은 일회성 수익이며 사업의 본질적인 매력도를 왜곡할 수 있습니다. 보조금을 뺀 '순수 매출'이 수혈 없이 성장이 가능한지를 보여주는 진짜 지표입니다."
                        color="text-emerald-400"
                        icon={<TrendingUp size={16} />}
                    />
                </div>
                <div onClick={() => setTab('settlement')} className="cursor-pointer">
                    <ExplainableKPI 
                        label="매출 대비 회수율 (AR VS CASH)" 
                        result={{
                            value: analytics.collectionRate,
                            inputs: { '총 매출액': analytics.totalRevenue },
                            formula: '(1 - 미수금 / 매출액) * 100',
                            period: '당기 누적 (실측)',
                            dataSource: 'actual'
                        }}
                        description="매출액 중에서 실제로 현금으로 회수된 비율입니다. 수익이 발생하더라도 현금이 돌지 않으면 흑자 도산의 위험이 있으므로 항상 주시해야 합니다."
                        color={analytics.collectionRate < 80 ? 'text-rose-400' : 'text-emerald-400'}
                        icon={<TrendingUp size={16} />}
                        formatValue={(v) => `${v.toFixed(1)}%`}
                    />
                </div>
                <div onClick={() => setTab('cashflow')} className="cursor-pointer">
                    <ExplainableKPI 
                        label="가용 현금 (LIQUID CASH)" 
                        result={metricResults?.liquidCash || { value: 0, inputs: {}, formula: '', period: '', dataSource: 'actual' }}
                        description="왜 미수금을 제외한 현금만 보나요? 회계상 수익이 났어도 통장에 돈이 없으면 부도가 날 수 있습니다. 즉시 집행 가능한 '현금'만이 위기 상황에서 회사를 지키는 방어선이기 때문입니다."
                        color="text-blue-400"
                        icon={<Wallet size={16} />}
                    />
                </div>
                <div onClick={() => setTab('monthly-pnl')} className="cursor-pointer">
                    <ExplainableKPI 
                        label="순이익 (NET PROFIT)" 
                        result={metricResults?.actualNetProfit || { value: 0, inputs: {}, formula: '', period: '', dataSource: 'actual' }}
                        description="여기서는 왜 보조금을 포함하나요? 법인세 산정이나 투자 유치, 대출 시에는 보조금을 포함한 최종 순이익이 공식적인 성적표가 됩니다. 회사의 종합적인 재무 체력을 나타냅니다."
                        color="text-indigo-400"
                        icon={<Activity size={16} />}
                    />
                </div>
            </div>

            {/* 중단 가로 레이아웃: 추세 그래프 & 시나리오 요약 */}
            <div className="grid grid-cols-1 gap-8">
                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden group">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                                <TrendingUp size={24} />
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight italic uppercase">매출 및 비용 추세 <span className="text-slate-500 not-italic text-sm ml-2">({selectedScenario} Mode)</span></h3>
                        </div>
                    </div>
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics.cashFlowData}>
                                <defs>
                                    <linearGradient id="colorOperating" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorGrant" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={val => `${(val / 1000000).toFixed(0)}M`} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', padding: '12px' }} 
                                    formatter={(value: any, name: any) => {
                                        const labelMap: Record<string, string> = {
                                            operatingIncome: '영업 매출',
                                            grantIncome: '영업외 수익 (지원금)',
                                            expense: '지출'
                                        };
                                        return [`₩${(value || 0).toLocaleString()}`, labelMap[name] || name];
                                    }}
                                />
                                <Area stackId="1" type="monotone" dataKey="operatingIncome" name="operatingIncome" stroke="#10b981" fillOpacity={1} fill="url(#colorOperating)" />
                                <Area stackId="1" type="monotone" dataKey="grantIncome" name="grantIncome" stroke="#3b82f6" fillOpacity={1} fill="url(#colorGrant)" />
                                <Area type="monotone" dataKey="expense" name="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

        </div>
    );
};

const RiskIndicatorCard: React.FC<{ label: string, title: string, val: string, color: 'orange' | 'rose' | 'emerald', desc: string, onClick?: () => void }> = ({ label, title, val, color, desc, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all cursor-pointer h-[240px]`}
    >
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                <div className={`px-2 py-0.5 rounded-full bg-${color === 'rose' ? 'rose' : color === 'orange' ? 'orange' : 'emerald'}-500/10 border border-${color === 'rose' ? 'rose' : color === 'orange' ? 'orange' : 'emerald'}-500/20 flex items-center gap-1.5`}>
                    <div className={`w-1.5 h-1.5 rounded-full bg-${color === 'rose' ? 'rose' : color === 'orange' ? 'orange' : 'emerald'}-500 animate-pulse`} />
                    <span className={`text-[9px] font-black text-${color === 'rose' ? 'rose' : color === 'orange' ? 'orange' : 'emerald'}-500 uppercase tracking-widest`}>{val}</span>
                </div>
            </div>
            <h4 className="text-3xl font-black text-white tracking-tighter italic">{title}</h4>
        </div>
        <div className="flex justify-between items-end group-hover:translate-x-1 transition-transform">
            <p className="text-[10px] font-medium text-slate-500 leading-relaxed max-w-[80%]">
                {desc}
            </p>
            <ArrowUpRight className="text-slate-700 group-hover:text-indigo-400 transition-colors" size={16} />
        </div>
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
                        <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                             <Info size={14} /> Metric Insight
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

const SummaryCard: React.FC<{ label: string, val: string, color: string, icon: any, sub?: string, explanation?: string, onClick?: () => void }> = ({ label, val, color, icon: Icon, sub, explanation, onClick }) => (
    <TooltipWrapper explanation={explanation}>
        <div 
            onClick={onClick}
            className="bg-[#151D2E]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between shadow-xl group hover:-translate-y-1 transition-all cursor-pointer h-full"
        >
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest leading-tight">{label}</p>
                    <HelpIcon size={12} className="text-slate-700 group-hover:text-indigo-400 transition-colors" />
                </div>
                <h4 className={`text-3xl font-black tracking-tighter italic ${color}`}>{val}</h4>
                {sub && <p className="text-xs font-black text-slate-600 uppercase tracking-tight italic">{sub}</p>}
            </div>
            <div className={`p-5 bg-white/5 rounded-2xl text-slate-700 group-hover:${color} transition-all`}>
                <Icon size={24} />
            </div>
        </div>
    </TooltipWrapper>
);

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0
    }).format(amount);
};


