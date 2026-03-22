import React, { useState, useMemo, useContext } from 'react';
import { 
    Download, TrendingUp, Zap, ArrowUpRight, MessageCircle, Layers, Target, Activity, Clock, Database, Table, Calculator as CalcIcon, Calculator
} from 'lucide-react';
import { MetricRegistry } from '../core/reporting/metricRegistry';
import { ExplainableKPI } from '../components/shared/ExplainableKPI';
import { AccountingContext } from '../context/AccountingContext';
import { JournalEntry } from '../types';
import { generateMultiYearSimulation } from '../core/simulation/journalGenerator';
import { generateMonthlyPnL, MonthlyPnLRow } from '../core/reporting/generateMonthlyPnL';
import { SCENARIO_CONFIGS } from '../core/simulation/scenarioConfigs';

export const MonthlyPnL: React.FC = () => {
    const { ledger: actualLedger, selectedDate } = useContext(AccountingContext)!;
    const [selectedYear, setSelectedYear] = useState<number | 'ALL'>('ALL');
    const [selectedScenario, setSelectedScenario] = useState<string>('STANDARD');

    const SCENARIO_PRESETS = [
        { id: 'SURVIVAL', name: '생존 (Survival)', color: 'hover:bg-rose-500/20 text-rose-400 border-rose-500/30' },
        { id: 'STANDARD', name: '표준 (Standard)', color: 'hover:bg-blue-500/20 text-blue-400 border-blue-500/30' },
        { id: 'GROWTH', name: '성장 (Growth)', color: 'hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
        { id: 'DEATH_VALLEY', name: '데스밸리 (Death Valley)', color: 'hover:bg-amber-500/20 text-amber-400 border-amber-500/30' }
    ];

    const formatCurrency = (val: number) => {
        if (val === 0) return '0';
        const formatted = new Intl.NumberFormat('ko-KR').format(Math.abs(val));
        return val < 0 ? `(${formatted})` : formatted;
    };

    const analytics = useMemo(() => {
        // Generate simulated ledger for the selected scenario
        // Rules: In Simulation Mode, we use the pure generator.
        const simulatedResult = generateMultiYearSimulation([2026, 2027, 2028], SCENARIO_CONFIGS[selectedScenario]);
        const simLedger = simulatedResult.ledger;

        const tableData = generateMonthlyPnL(simLedger, [2026, 2027, 2028], selectedDate);
        
        // [Dynamic Context] Filter data used for Sensitivity/Leverage based on Selected Year
        const kpiBaseData = selectedYear === 'ALL' 
            ? tableData 
            : tableData.filter(r => r.month.startsWith(String(selectedYear)));

        // Dynamic KPI Calculation (Operating Focus)
        const bepMonth = tableData.find((r: MonthlyPnLRow) => r.revenue > 0 && r.operatingProfit > 0 && r.month >= '2026-05')?.month || 'N/A';
        
        const totalRevenue = kpiBaseData.reduce((sum: number, r: MonthlyPnLRow) => sum + r.revenue, 0);
        const totalOpex = Math.abs(kpiBaseData.reduce((sum: number, r: MonthlyPnLRow) => sum + (r.payroll + r.marketing + r.rent + r.depreciation + r.misc), 0));
        const totalNetProfit = kpiBaseData.reduce((sum: number, r: MonthlyPnLRow) => sum + r.netIncome, 0);
        const totalSubRevenue = kpiBaseData.reduce((sum: number, r: MonthlyPnLRow) => sum + r.operatingRevenue, 0);
        const totalCogs = Math.abs(kpiBaseData.reduce((sum: number, r: MonthlyPnLRow) => sum + r.cogs, 0));
        const totalFullCost = totalOpex + totalCogs;
        
        const revenueLeverage = totalRevenue / (totalOpex || 1);
        const netExpenseLeverage = totalSubRevenue > 0 ? totalFullCost / totalSubRevenue : 0;

        // [V2.6] Cumulative BEP Calculation (Refined: Sustainable Profitability)
        let runningNetIncome = 0;
        let cumulativeBepMonth = 'N/A';
        for (let i = 0; i < tableData.length; i++) {
            const row = tableData[i];
            runningNetIncome += row.netIncome;
            
            if (runningNetIncome >= 0) {
                // Sustainability Condition: All subsequent monthly net incomes must be non-negative
                const isSustainable = tableData.slice(i).every(r => r.netIncome >= 0);
                if (isSustainable) {
                    cumulativeBepMonth = row.month;
                    break;
                }
            }
        }

        return {
            tableData,
            kpis: {
                monthlyBep: bepMonth,
                cumulativeBep: cumulativeBepMonth,
                revenueLeverage: `${revenueLeverage.toFixed(2)}x`,
                expenseLeverage: `${netExpenseLeverage.toFixed(2)}x`
            },
            totalNetProfit,
            // [V2.6] Explainable Summary Results
            metricResults: {
                totalProfit: {
                    value: totalNetProfit,
                    inputs: { 'Revenue': totalRevenue, 'OPEX': totalOpex },
                    formula: 'Revenue - OPEX',
                    period: selectedYear === 'ALL' ? '3-Year Total' : `${selectedYear} Total`,
                    dataSource: 'scenario' as any
                },
                leverage: {
                    value: revenueLeverage,
                    inputs: { 'Revenue': totalRevenue, 'Variable Costs': totalOpex },
                    formula: 'Revenue / Variable Costs',
                    period: 'Average',
                    dataSource: 'scenario' as any
                },
                expenseLeverage: {
                    value: netExpenseLeverage,
                    inputs: { '운영 비용(Cost)': totalFullCost, '전용 매출(Subscription)': totalSubRevenue },
                    formula: 'Operating Cost / Subscription Revenue',
                    period: 'Average',
                    dataSource: 'scenario' as any
                },
                cumulativeBep: {
                    value: 0,
                    inputs: { 'Peak Cumulative Profit': totalNetProfit, 'Break-even Point': cumulativeBepMonth },
                    formula: 'Σ(Net Income) > 0',
                    period: 'Life-to-Date (Projection)',
                    dataSource: 'scenario' as any
                }
            }
        };
    }, [selectedScenario, selectedDate, selectedYear]);

    const filteredTableData = useMemo(() => {
        if (selectedYear === 'ALL') return analytics.tableData;
        return analytics.tableData.filter(r => r.month.startsWith(String(selectedYear)));
    }, [analytics.tableData, selectedYear]);

    const totalRow = useMemo(() => {
        const initial = {
            revenue: 0, 
            operatingRevenue: 0,
            grantIncome: 0,
            cogs: 0, 
            grossProfit: 0, 
            payroll: 0, 
            marketing: 0, 
            rent: 0,
            depreciation: 0, 
            misc: 0, 
            operatingProfit: 0,
            netIncome: 0, 
            investment: 0, 
            voucherExecution: 0, 
            monthlyNetCashFlow: 0,
            carryoverCash: 0
        };
        
        const totals = filteredTableData.reduce((acc, r) => {
            acc.revenue += r.revenue;
            acc.operatingRevenue += r.operatingRevenue;
            acc.grantIncome += r.grantIncome;
            acc.cogs += r.cogs;
            acc.grossProfit += r.grossProfit;
            acc.payroll += r.payroll;
            acc.marketing += r.marketing;
            acc.rent += r.rent;
            acc.depreciation += r.depreciation;
            acc.misc += r.misc;
            acc.operatingProfit += r.operatingProfit;
            acc.netIncome += r.netIncome;
            acc.investment += r.investment;
            acc.voucherExecution += r.voucherExecution;
            acc.monthlyNetCashFlow += r.monthlyNetCashFlow;
            acc.carryoverCash = r.carryoverCash;
            return acc;
        }, initial);

        return totals;
    }, [filteredTableData]);

    return (
        <div className="flex-1 bg-[#0B1221] h-screen text-slate-100 flex flex-col p-8 pt-0 overflow-hidden relative">
            {/* 1. Header Area (Fixed - Always Visible) */}
            <div className="flex-shrink-0 bg-[#0B1221] pt-8 pb-6 space-y-8 border-b border-white/5 shadow-2xl z-20">
                <header className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tighter italic">
                                월별 손익 현황 (Monthly P&L)
                            </h1>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                                REAL-TIME LEDger BASED MONTHLY FINANCIAL ANALYSIS
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-xl shadow-indigo-600/20 border border-indigo-400/30">
                                <Download size={14} /> EXPORT
                            </button>
                        </div>
                    </div>

                    {/* Sub-navigation & Filters */}
                    <div className="flex items-center justify-between bg-[#151D2E]/50 border border-white/5 p-5 rounded-[2rem] backdrop-blur-xl">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg text-[10px] font-black uppercase border border-indigo-500/20">
                                <Target size={12} /> SCENARIO SIMULATION
                            </div>
                            <div className="flex gap-2">
                                {SCENARIO_PRESETS.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedScenario(p.id)}
                                        className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                                            selectedScenario === p.id 
                                            ? 'bg-white/10 border-white/20 text-white shadow-lg' 
                                            : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                            {(['ALL', 2026, 2027, 2028] as const).map(year => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${selectedYear === year ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {year === 'ALL' ? 'ALL' : `${year}Y`}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* KPI Cards Row (Unified Registry Integration) */}
                <div className="grid grid-cols-5 gap-6 px-1">
                    <ExplainableKPI 
                        label="BEP Detection" 
                        result={{ value: 0, inputs: { 'Detected Month': analytics.kpis.monthlyBep }, formula: 'Detection: First Operating Profit > 0', period: 'Timeline Scan', dataSource: 'scenario' }}
                        description="선택된 시뮬레이션 데이터 중 최초로 '영업 이익'이 양수가 되는 달입니다. 이 시점부터 회사는 외부 자금 수혈 없이도 생존이 가능해지는 구조적 전환점을 맞이합니다."
                        color="text-indigo-400" icon={<Clock size={16} />} 
                        formatValue={() => analytics.kpis.monthlyBep}
                    />
                    <ExplainableKPI 
                        label="Projected Total Profit" 
                        result={analytics.metricResults.totalProfit} 
                        description="총 시계열(2026-2028) 동안의 누적 순이익 총계입니다. 보조금과 영업비용을 모두 반영한 최종 결과물로, 법인의 실질적인 잉여 현금 창출력을 나타냅니다."
                        color={totalRow.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                        icon={<Activity size={16} />}
                    />
                    <ExplainableKPI 
                        label="Revenue Leverage" 
                        result={analytics.metricResults.leverage} 
                        description="영업비용(OPEX) 한 단위를 투입했을 때 발생하는 매출액의 배수입니다. 이 수치가 높을수록 소액의 운영비용으로 고효율 성장이 가능한 '플랫폼형' 비즈니스 모델에 가깝습니다."
                        color="text-blue-400" icon={<TrendingUp size={16} />}
                        formatValue={(v) => `${v.toFixed(2)}x`}
                    />
                    <ExplainableKPI 
                        label="Expense Leverage" 
                        result={analytics.metricResults.expenseLeverage} 
                        description="보조금을 제외한 순수 상품 매출액(Subscription) 대비 전체 운영 비용(매출원가 포함)의 비중입니다. 1.0x보다 낮을수록 본업의 수익만으로도 모든 운영비를 충당할 수 있음을 의미합니다."
                        color="text-amber-400" icon={<Zap size={16} />}
                        formatValue={(v) => `${v.toFixed(2)}x`}
                    />
                    
                    <ExplainableKPI 
                        label="Cumulative BEP" 
                        result={analytics.metricResults.cumulativeBep} 
                        description="회적 이익(Total Net Income)이 최초로 양전환되는 시점입니다. 초기 투자비용과 영업손실을 모두 회수하고 법인이 실질적인 수익 구간에 진입하는 시기를 의미합니다."
                        color="text-purple-400" icon={<Layers size={16} />}
                        formatValue={() => analytics.kpis.cumulativeBep}
                    />
                </div>
            </div>

            {/* 2. Main Table Content (Independent Scroll) */}
            <div className="flex-1 min-h-0 bg-[#151D2E] rounded-[2.5rem] border border-white/5 shadow-2xl mt-8 overflow-hidden">
                <div className="h-full overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[2200px]">
                        <thead className="sticky top-0 z-30 shadow-md">
                            <tr className="bg-[#0B1221] border-b border-white/5 uppercase text-[9px] font-black text-slate-500 tracking-widest">
                                <th className="p-5 sticky left-0 bg-[#0B1221] z-40 w-[120px]">Period</th>
                                <th className="p-5 bg-[#0B1221]">상품 매출액 (Net)</th>
                                <th className="p-5 bg-[#0B1221] text-emerald-400">보조금 수익 (Grant)</th>
                                <th className="p-5 bg-[#0B1221]">총 합계 (Total Rev)</th>
                                <th className="p-5 bg-[#0B1221]">매출원가</th>
                                <th className="p-5 bg-[#0B1221]">매출총이익</th>
                                <th className="p-5 bg-[#0B1221] text-indigo-400">인건비</th>
                                <th className="p-5 bg-[#0B1221]">마케팅비</th>
                                <th className="p-5 bg-[#0B1221]">임차료</th>
                                <th className="p-5 bg-[#0B1221]">감가상각</th>
                                <th className="p-5 bg-[#0B1221]">기타비용</th>
                                <th className="p-5 bg-[#0B1221]">영업이익</th>
                                <th className="p-5 bg-[#0B1221]">당기순이익</th>
                                <th className="p-5 bg-[#0B1221] text-rose-400">투자/자본금</th>
                                <th className="p-5 bg-[#0B1221] text-amber-400">보조금 집행(바우처)</th>
                                <th className="p-5 bg-[#3b82f6]/20 text-blue-400 font-black">Net Cash Flow</th>
                                <th className="p-5 bg-[#0B1221]/80 backdrop-blur-sm z-10 sticky right-0">이월현금 (Balance)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-[11px] font-bold">
                            {filteredTableData.map((row) => (
                                <tr key={row.month} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-5 sticky left-0 bg-[#151D2E] group-hover:bg-[#1e293b] z-10 transition-colors uppercase italic font-black">{row.month}</td>
                                    <td className="p-5">{formatCurrency(row.operatingRevenue)}</td>
                                    <td className="p-5 text-emerald-400">{formatCurrency(row.grantIncome)}</td>
                                    <td className="p-5 font-black text-slate-300">{formatCurrency(row.revenue)}</td>
                                    <td className="p-5 text-slate-500">{formatCurrency(row.cogs)}</td>
                                    <td className="p-5">{formatCurrency(row.grossProfit)}</td>
                                    <td className="p-5 text-indigo-400">{formatCurrency(row.payroll)}</td>
                                    <td className="p-5">{formatCurrency(row.marketing)}</td>
                                    <td className="p-5">{formatCurrency(row.rent)}</td>
                                    <td className="p-5 text-slate-500">{formatCurrency(row.depreciation)}</td>
                                    <td className="p-5">{formatCurrency(row.misc)}</td>
                                    <td className={`p-5 font-black ${row.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(row.operatingProfit)}</td>
                                    <td className={`p-5 font-black ${row.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(row.netIncome)}</td>
                                    <td className="p-5 text-rose-400">{row.investment > 0 ? `+${formatCurrency(row.investment)}` : '-'}</td>
                                    <td className="p-5 text-amber-500/50">{formatCurrency(row.voucherExecution)}</td>
                                    <td className={`p-5 font-black italic bg-blue-500/5 ${row.monthlyNetCashFlow >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{formatCurrency(row.monthlyNetCashFlow)}</td>
                                    <td className="p-5 bg-white/5 font-black text-indigo-300 sticky right-0 z-10 backdrop-blur-sm">{formatCurrency(row.carryoverCash)}</td>
                                </tr>
                            ))}
                            {/* TOTAL ROW - Must strictly align with <thead> */}
                            <tr className="bg-[#0B1221] border-t-2 border-indigo-500/20 text-[11px] font-black uppercase italic">
                                <td className="p-5 sticky left-0 bg-[#0B1221] z-10">TOTAL (YTD)</td>
                                <td className="p-5 text-white">{formatCurrency(totalRow.operatingRevenue)}</td>
                                <td className="p-5 text-emerald-400">{formatCurrency(totalRow.grantIncome)}</td>
                                <td className="p-5 text-slate-400">{formatCurrency(totalRow.revenue)}</td>
                                <td className="p-5 text-slate-500">{formatCurrency(totalRow.cogs)}</td>
                                <td className="p-5 text-white">{formatCurrency(totalRow.grossProfit)}</td>
                                <td className="p-5 text-indigo-400">{formatCurrency(totalRow.payroll)}</td>
                                <td className="p-5 text-white">{formatCurrency(totalRow.marketing)}</td>
                                <td className="p-5 text-white">{formatCurrency(totalRow.rent)}</td>
                                <td className="p-5 text-slate-500">{formatCurrency(totalRow.depreciation)}</td>
                                <td className="p-5 text-white">{formatCurrency(totalRow.misc)}</td>
                                <td className={`p-5 ${totalRow.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(totalRow.operatingProfit)}</td>
                                <td className={`p-5 ${totalRow.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(totalRow.netIncome)}</td>
                                <td className="p-5 text-rose-400">{totalRow.investment > 0 ? `+${formatCurrency(totalRow.investment)}` : '-'}</td>
                                <td className="p-5 text-amber-500/50">{formatCurrency(totalRow.voucherExecution)}</td>
                                <td className={`p-5 italic bg-blue-500/10 ${totalRow.monthlyNetCashFlow >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{formatCurrency(totalRow.monthlyNetCashFlow)}</td>
                                <td className="p-5 bg-white/20 text-indigo-300 sticky right-0 z-10 backdrop-blur-sm">{formatCurrency(totalRow.carryoverCash)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const KPICard: React.FC<{ label: string, val: string, sub: string, icon: any, trend?: string, color?: string }> = ({ label, val, sub, icon, trend, color = "text-white" }) => (
    <div className="bg-[#151D2E] p-6 rounded-3xl border border-white/5 shadow-xl group hover:border-indigo-500/30 transition-all cursor-default">
        <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
            <div className="p-2 bg-white/5 rounded-xl text-slate-600 group-hover:text-indigo-400 transition-colors">
                {icon}
            </div>
        </div>
        <div className="space-y-1">
            <h4 className={`text-2xl font-black italic tracking-tighter ${color}`}>{val}</h4>
            <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold text-slate-600 uppercase italic">{sub}</p>
                {trend && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <ArrowUpRight size={8} className="text-emerald-400" />
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">{trend}</span>
                    </div>
                )}
            </div>
        </div>
    </div>
);

export default MonthlyPnL;
