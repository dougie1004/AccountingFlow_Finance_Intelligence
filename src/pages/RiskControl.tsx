import React from 'react';
import { 
    ShieldAlert, 
    AlertTriangle, 
    Clock, 
    Zap, 
    TrendingUp, 
    Activity, 
    PieChart, 
    BarChart3,
    CheckCircle2,
    Lock,
    Unlock,
    ChevronRight,
    Search,
    Filter,
    BrainCircuit
} from 'lucide-react';
import {
    PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

import { useAccounting } from '../hooks/useAccounting';
import { generateRiskReport } from '../core/reporting/riskReporter';

export const RiskControl: React.FC = () => {
    const { ledger, selectedDate, financials } = useAccounting();
    
    // PART 1 — Verify Ledger Connection
    console.log("journal entries", ledger.length);

    const report = React.useMemo(() => 
        generateRiskReport(ledger, selectedDate), 
    [ledger, selectedDate]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: 'KRW',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const RISK_DATA = report.complianceFindings
        .map(f => ({
            name: f.category,
            value: f.count,
            color: f.color
        }))
        .filter(f => f.value > 0);

    const CLEARING_STATUS = [
        { name: '정상 미결 (Open)', value: report.tradeSettlementRisk - report.unsettledLongTerm, color: '#3b82f6' },
        { name: '기한 경과/중단 (High Risk)', value: report.unsettledLongTerm, color: '#ef4444' }
    ];

    return (
        <div className="flex-1 bg-[#0B1221] min-h-screen text-slate-100 p-8 lg:p-12 space-y-10 animate-in fade-in duration-500">
            {/* Header: Tactical Risk View */}
            <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-8 pb-8 border-b border-white/5">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-600 rounded-2xl shadow-xl shadow-rose-600/20">
                            <Lock size={32} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-rose-400 uppercase tracking-[0.2em]">Unified Settlement Risk & Financial Integrity Dashboard</span>
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tighter italic">
                                결산 및 자금 통제 <span className="text-slate-500 text-xl font-bold not-italic ml-2">(Risk Control)</span>
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-[#151D2E] p-1.5 rounded-2xl border border-white/5 px-6 py-2.5">
                         <div className="flex flex-col">
                             <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Dimension Time:</span>
                             <span className="text-xs font-black text-white tracking-widest">{selectedDate}</span>
                         </div>
                    </div>
                    <button className="h-12 px-6 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20">
                        <Activity size={16} /> LIVE RISK MONITORING
                    </button>
                </div>
            </header>

            {/* PART 5 — Add Close Readiness Panel (Row 1) */}
            <section className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-8 rounded-[3rem] border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <CheckCircle2 size={24} className="text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-black text-white italic">결산 준비 상태 <span className="text-slate-500 not-italic">(Close Readiness)</span></h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Global Close Progress</span>
                            <span className="text-xl font-black text-white">{report.closeReadiness.matchingRate}%</span>
                        </div>
                        <div className="w-32 bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                            <div 
                                className="bg-emerald-500 h-full transition-all duration-1000" 
                                style={{ width: `${report.closeReadiness.matchingRate}%` }} 
                            />
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Matching', value: `${report.closeReadiness.matchingRate}% completed`, status: report.closeReadiness.matchingRate === 100 ? 'Completed' : 'In Progress' },
                        { label: 'Accrual', value: report.closeReadiness.accrualStatus, status: report.closeReadiness.accrualStatus },
                        { label: 'Amortization', value: report.closeReadiness.amortizationStatus, status: report.closeReadiness.amortizationStatus }
                    ].map((item, idx) => (
                        <div key={idx} className="bg-black/20 p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                                <p className="text-lg font-black text-white italic">{item.value}</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                                item.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                                {item.status}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* PART 6 & Row 2 — Metric Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Blocked Amount', value: formatCurrency(report.blockedAmount), sub: `${report.blockedCount}건의 승인 보류(blocked) 항목`, icon: ShieldAlert, color: 'text-rose-500' },
                    { label: '90일 초과 미정산', value: formatCurrency(report.unsettledLongTerm), sub: `${report.unsettledLongTermCount}건의 기한 경과 항목`, icon: Clock, color: 'text-amber-500' },
                    { label: '상계 미결 리스크', value: formatCurrency(report.clearingRisk), sub: 'matchingStatus !== "matched" 항목', icon: BarChart3, color: 'text-blue-500' },
                    { label: '현금 리스크', value: formatCurrency(report.cashRisk), sub: '3개월 내 예상 부족 현금 규모', icon: Activity, color: 'text-emerald-500' }
                ].map((m, idx) => (
                    <div key={idx} className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute right-[-10%] top-[-10%] opacity-5 group-hover:scale-110 transition-transform">
                            <m.icon size={120} className={m.color} />
                        </div>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">{m.label}</p>
                        <h2 className="text-3xl font-black text-white tracking-tighter italic mb-2">{m.value}</h2>
                        <p className="text-xs font-bold text-slate-500">{m.sub}</p>
                    </div>
                ))}
            </div>

            {/* Row 3 — Intelligence Findings */}
            <div className="bg-[#151D2E] rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-white/5 flex items-center gap-4 bg-indigo-600/5">
                    <BrainCircuit size={20} className="text-indigo-400" />
                    <h3 className="text-lg font-black text-white italic">인텔리전스 경영 통찰 <span className="text-slate-500 not-italic">(Intelligence Findings)</span></h3>
                </div>
                <div className="p-8">
                    {report.unsettledLongTerm > 0 || report.blockedAmount > 0 || report.cashRisk > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {report.unsettledLongTerm > 0 && (
                                <div className="flex items-start gap-4 p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl">
                                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-1">Aging Risk Warning</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed font-bold">
                                            90일 이상 미회수된 {formatCurrency(report.unsettledLongTerm)} 규모의 채권/채무가 존재합니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                            {report.blockedAmount > 0 && (
                                <div className="flex items-start gap-4 p-6 bg-rose-500/5 border border-rose-500/20 rounded-3xl">
                                    <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500">
                                        <ShieldAlert size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-1">Settlement Block Active</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed font-bold">
                                            {formatCurrency(report.blockedAmount)} 규모의 결제가 보류(blocked) 상태입니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                            {report.cashRisk > 0 && (
                                <div className="flex items-start gap-4 p-6 bg-rose-900/10 border border-rose-500/30 rounded-3xl">
                                    <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500">
                                        <TrendingUp size={20} className="rotate-180" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-1">Liquidity Risk</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed font-bold">
                                            3개월 내 {formatCurrency(report.cashRisk)} 규모의 현금 부족이 예상됩니다. 자금 조달 계획 검토가 시급합니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-10 text-slate-500 uppercase tracking-widest font-black text-xs">
                            <CheckCircle2 size={16} className="mr-2 text-emerald-500" /> All Risk Parameters Nominal
                        </div>
                    )}
                </div>
            </div>

            {/* Row 4 — Risk Pillars Chart */}
            <div className="bg-[#151D2E] p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                <div className="flex flex-col gap-1 mb-10">
                    <h3 className="text-lg font-black text-white italic flex items-center gap-3">
                        <PieChart size={20} className="text-blue-400" /> 리스크 유형 분포 <span className="text-slate-500 not-italic">(Risk Pillars)</span>
                    </h3>
                </div>
                <div className="h-[300px] flex items-center">
                    <div className="flex-1 h-full">
                        {RISK_DATA.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie data={RISK_DATA} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                                        {RISK_DATA.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#151D2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                    />
                                </RePieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 italic text-sm">No significant risk pillars detected.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 5 — Clearing Status Chart */}
            <div className="bg-[#151D2E] p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                <div className="flex flex-col gap-1 mb-10">
                    <h3 className="text-lg font-black text-white italic flex items-center gap-3">
                        <BarChart3 size={20} className="text-rose-400" /> 정산 집중 관리 상태 <span className="text-slate-500 not-italic">(Clearing Status)</span>
                    </h3>
                </div>
                <div className="h-[300px]">
                    {CLEARING_STATUS.some(s => s.value > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={CLEARING_STATUS} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff05" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#151D2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                                />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={30}>
                                    {CLEARING_STATUS.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 italic text-sm">All clearing statuses are up to date.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
