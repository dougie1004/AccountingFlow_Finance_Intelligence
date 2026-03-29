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
import { motion, AnimatePresence } from 'framer-motion';

import { useAccounting } from '../hooks/useAccounting';
import { generateRiskReport } from '../core/reporting/riskReporter';

export const RiskControl: React.FC = () => {
    const { ledger, selectedDate, financials } = useAccounting();
    
    // PART 1 — Verify Ledger Connection
    const report = React.useMemo(() => 
        generateRiskReport(ledger, selectedDate), 
    [ledger, selectedDate]);

    const [activeKpi, setActiveKpi] = React.useState<string | null>(null);

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
        { name: '정상 미결 (Open)', value: report.unsettledNet - report.overdueAP.amount, color: '#3b82f6' },
        { name: '기한 경과 (High Risk)', value: report.overdueAP.amount, color: '#ef4444' }
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
                                <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">Unified Settlement Risk & Financial Integrity Dashboard</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-4xl font-black text-white tracking-tighter italic">
                                    결산 및 자금 통제 <span className="text-slate-500 text-xl font-bold not-italic ml-2">(Risk Control)</span>
                                </h1>
                                <div className="px-5 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">
                                    ACCRUAL VIEW → 손익(P&L) 기반 분석
                                </div>
                            </div>
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

            {/* PART 5 — Close Readiness Panel */}
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
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Global Close Progress (Matching)</span>
                            <span className="text-xl font-black text-white">{report.matchingStatus.completed}%</span>
                        </div>
                        <div className="w-32 bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                            <div 
                                className="bg-emerald-500 h-full transition-all duration-1000" 
                                style={{ width: `${report.matchingStatus.completed}%` }} 
                            />
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Matching (Accuracy)', value: `${report.matchingStatus.accuracy}%`, status: report.matchingStatus.accuracy >= 99 ? 'Completed' : 'In Progress' },
                        { label: 'Pending Items', value: `${report.matchingStatus.pending}건`, status: report.matchingStatus.pending === 0 ? 'Completed' : 'In Progress' },
                        { label: 'Amortization', value: report.amortizationStatus, status: report.amortizationStatus }
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

            {/* Row 2 — Metric Grid (Split AR/AP & Dual-Insight) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                    { id: 'blockedAmount', label: 'Blocked Amount', value: formatCurrency(report.blockedAmount), sub: `${report.blockedCount}건의 승인 보류`, icon: ShieldAlert, color: 'text-rose-500' },
                    { id: 'overdueAR', label: '30일 초과 미회수(AR)', value: formatCurrency(report.overdueAR.amount), sub: `${report.overdueAR.count}건의 기한 경과`, icon: Clock, color: 'text-amber-500' },
                    { id: 'overdueAP', label: '30일 초과 미지급(AP)', value: formatCurrency(report.overdueAP.amount), sub: `${report.overdueAP.count}건의 기한 경과`, icon: Clock, color: 'text-rose-400' },
                    { id: 'clearingRisk', label: '미결제 리스크', value: formatCurrency(report.unsettledNet), sub: `장부상 순잔액 (Net) vs 미매칭 합계 (Gross) ₩${formatCurrency(report.unsettledGross)}`, icon: BarChart3, color: 'text-blue-500' },
                    { id: 'cashRisk', label: '현금 리스크', value: formatCurrency(report.cashRisk), sub: '월간 소진액 대비 3개월 부족분', icon: Activity, color: 'text-emerald-500' }
                ].map((m, idx) => (
                    <motion.div 
                        key={idx} 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveKpi(activeKpi === m.id ? null : m.id)}
                        className={`bg-[#151D2E] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group cursor-pointer transition-all ${
                            activeKpi === m.id ? 'ring-2 ring-indigo-500/50 bg-indigo-500/5' : ''
                        }`}
                    >
                        <div className="absolute right-[-10%] top-[-10%] opacity-5 group-hover:scale-110 transition-transform">
                            <m.icon size={80} className={m.color} />
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex justify-between items-center">
                            {m.label}
                            {activeKpi === m.id && <Zap size={10} className="text-indigo-400" />}
                        </p>
                        <h2 className="text-2xl font-black text-white tracking-tighter italic mb-2">{m.value}</h2>
                        <p className="text-[10px] font-bold text-slate-500">{m.sub}</p>
                        
                        {(m.id === 'clearingRisk' || m.id === 'overdueAR' || m.id === 'overdueAP') && (
                            <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-1">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">📢 Data Integrity Notice</span>
                                <p className="text-[10px] font-bold text-slate-400">
                                    재무제표 기준(Net Balance)은 실제 장부와 일치하며, 정산 기준(Gross Exposure)은 미매칭을 포함합니다.
                                </p>
                                <p className="text-[10px] font-bold text-slate-500 italic">"재무제표 기준(Net) vs 정산 기준(Gross) 차이 존재 가능"</p>
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* AI Basis Panel (Rationale) */}
            <AnimatePresence>
                {activeKpi && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -20, height: 0 }}
                        className="bg-indigo-600/10 border border-indigo-500/30 rounded-[2.5rem] p-8 overflow-hidden shadow-xl"
                    >
                        <div className="flex items-start gap-6">
                            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-600/20">
                                <BrainCircuit size={28} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-black text-white italic mb-2 tracking-tight">AI 계산 근거 및 통제 규칙 <span className="text-indigo-400 opacity-60 not-italic ml-2">(Logic Rationale)</span></h4>
                                <p className="text-slate-300 leading-relaxed font-black text-sm">
                                    {activeKpi === 'overdueAR' && `전표일 기준 30일 이상 미회수된 실제 매출채권(AR) 항목입니다. (BS 잔액 기준 상계 완료)`}
                                    {activeKpi === 'overdueAP' && `전표일 기준 30일 이상 지연된 영업 미지급금(AP) 항목입니다. (BS 잔액 기준 상계 완료)`}
                                    {activeKpi !== 'overdueAR' && activeKpi !== 'overdueAP' && (report.logicRationale[activeKpi] || "부합하는 계산 근거를 찾을 수 없습니다.")}
                                </p>
                                <div className="mt-4 flex gap-4">
                                    <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[9px] font-black text-slate-500 uppercase tracking-widest">Dataset: ACTUAL</div>
                                    <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[9px] font-black text-slate-500 uppercase tracking-widest">Dimension: {selectedDate}</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Row 3 — Intelligence Findings */}
            <div className="bg-[#151D2E] rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-white/5 flex items-center gap-4 bg-indigo-600/5">
                    <BrainCircuit size={20} className="text-indigo-400" />
                    <h3 className="text-lg font-black text-white italic">인텔리전스 경영 통찰 <span className="text-slate-500 not-italic">(Intelligence Findings)</span></h3>
                </div>
                <div className="p-8">
                    {report.overdueAR.amount > 0 || report.overdueAP.amount > 0 || report.cashRisk > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {report.overdueAR.amount > 0 && (
                                <div className="flex items-start gap-4 p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl">
                                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                                        <TrendingUp size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-1">AR Aging Warning</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed font-black">
                                            30일 이상 미회수된 {formatCurrency(report.overdueAR.amount)} 규모의 채권이 존재합니다. 매출 채권 회수 독려가 필요합니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                            {report.overdueAP.amount > 0 && (
                                <div className="flex items-start gap-4 p-6 bg-rose-500/5 border border-rose-500/20 rounded-3xl">
                                    <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-1">AP Aging Warning</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed font-black">
                                            30일 이상 미지급된 {formatCurrency(report.overdueAP.amount)} 규모의 채무가 존재합니다. 지불 기한 관리가 시급합니다.
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
                                        <p className="text-xs text-slate-400 leading-relaxed font-black">
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

            {/* Row 4 — Charts Row (Distribution & Status) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-[#151D2E] p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                    <h3 className="text-lg font-black text-white italic flex items-center gap-3 mb-10">
                        <PieChart size={20} className="text-blue-400" /> 리스크 유형 분포 <span className="text-slate-500 not-italic">(Risk Pillars)</span>
                    </h3>
                    <div className="h-[300px]">
                        {RISK_DATA.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie data={RISK_DATA} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                                        {RISK_DATA.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ backgroundColor: '#151D2E', border: 'none', borderRadius: '12px', fontSize: '11px' }} />
                                </RePieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 italic">No Distribution Data</div>
                        )}
                    </div>
                </div>
                <div className="bg-[#151D2E] p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                    <h3 className="text-lg font-black text-white italic flex items-center gap-3 mb-10">
                        <BarChart3 size={20} className="text-rose-400" /> 정산 집중 관리 상태 <span className="text-slate-500 not-italic">(Clearing Status)</span>
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={CLEARING_STATUS} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip contentStyle={{ backgroundColor: '#151D2E', border: 'none', borderRadius: '12px', fontSize: '11px' }} />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={32}>
                                    {CLEARING_STATUS.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
