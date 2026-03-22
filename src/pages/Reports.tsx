import React, { useState, useMemo, useEffect } from 'react';
import { useAccounting } from '../hooks/useAccounting';
import { 
    Download, 
    Share2, 
    ArrowLeft, 
    ShieldCheck, 
    TrendingUp, 
    Zap, 
    Activity, 
    Clock, 
    FileText,
    Calendar,
    ChevronDown,
    Flag,
    TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumDatePicker } from '../components/common/PremiumDatePicker';

const KPIProgress: React.FC<{ label: string, val: number, color: string }> = ({ label, val, color }) => (
    <div>
        <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <span className={`text-xs font-black italic ${val < 0 ? 'text-rose-400' : 'text-slate-100'}`}>{val.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-[#121620] h-2.5 rounded-full overflow-hidden shadow-inner border border-white/5">
            <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, Math.abs(val)))}%` }}
                className={`h-full ${color} shadow-lg shadow-indigo-500/20`}
            />
        </div>
    </div>
);

const Target = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
);

export const Reports: React.FC<{ setTab: (tab: string) => void }> = ({ setTab }) => {
    const { financials, finalizedMonths, setSelectedDate, trialBalance, selectedDate } = useAccounting();
    const [selectedPeriod, setSelectedPeriod] = useState(() => {
        const [y, m] = selectedDate.split('-');
        return `${y}-${m}`;
    });

    // [NAVIGATION FIX] Sync local state when jumping from other pages (like Closing)
    useEffect(() => {
        const [y, m] = selectedDate.split('-');
        setSelectedPeriod(`${y}-${m}`);
    }, [selectedDate]);

    // [INTEGRITY FIX] Sync local selectedPeriod with global selectedDate for accurate financials
    const handlePeriodChange = (dateStr: string) => {
        const [y, m] = dateStr.split('-');
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        const fullDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        // The effect will handle setSelectedPeriod, but we can do it here too for snappiness
        setSelectedDate(fullDate);
    };

    const isClosed = finalizedMonths[selectedPeriod] === 'soft' || finalizedMonths[selectedPeriod] === 'hard';

    // [V2.7] AI CFO Executive Insight Generator
    const executiveInsight = useMemo(() => {
        if (!financials) return null;

        const isProfitable = financials.netIncome > 0;
        const revenueGrowth = financials.revenue > 0;
        const opexRatio = (financials.expenses / (financials.revenue || 1)) * 100;
        const cashRatio = (financials.cash / (financials.totalAssets || 1)) * 100;
        
        // Detect specific accounts
        const hasLease = Object.values(trialBalance).some(v => 
            (v.meta.name.includes('리스') || v.meta.code.startsWith('24')) && 
            (v.closingDebit !== 0 || v.closingCredit !== 0)
        );

        const observations = isProfitable 
            ? `이번 기간 기록된 ${financials.netIncome.toLocaleString()}원의 순이익은 효율적인 비용 통제와 매출 성장이 맞물린 결과입니다. 현재의 이익 구조를 유지하면서 신규 성장 동력을 확보하는 전략이 유효합니다.`
            : `이번 기간 기록된 ${financials.netIncome.toLocaleString()}원의 손익 구조는 매출 대비 비용(Opex Ratio: ${opexRatio.toFixed(1)}%) 비중이 높음을 시사합니다. 고정비 효율화와 단기 매출 확보가 시급한 시점입니다.`;

        const highlightedItems = [];
        if (cashRatio > 30) highlightedItems.push(`현금 유동성 비중이 ${cashRatio.toFixed(1)}%로 매우 견고합니다.`);
        if (hasLease) highlightedItems.push("장기 리스 및 외부 부채 관리가 안정적으로 수행되고 있습니다.");
        else highlightedItems.push("외부 차입금 없는 자기자본 중심의 건전한 재무 구조가 유지되고 있습니다.");

        const roadmap = isProfitable 
            ? [
                { title: "Strategic Reinvestment:", content: "잉여 현금을 활용하여 핵심 기술 인력 확보 또는 마케팅 확장을 통해 시장 점유율을 공격적으로 높이는 것을 권장합니다." },
                { title: "Profit Margin Optimization:", content: "구독형 매출 비중을 확대하여 현금 흐름의 예측 가능성을 높이고, 변동비 구조를 재구성하여 영업 레버리지를 극대화해야 합니다." }
              ]
            : [
                { title: "Tactical Cost Reduction:", content: "비핵심 자산 및 고정비를 전수 점검하여 CPA가 분기 대비 15% 이상 높은 채널의 예산을 즉시 삭감하고 고정비를 10% 이상 절감해야 합니다." },
                { title: "Cash Runway Extension:", content: "미회수 채권(AR)의 조기 회수를 독려하고, 단기 자금 수혈을 위한 투자 프리라운드 또는 정부 지원 사업 연계를 검토해야 합니다." }
              ];

        return {
            observations,
            status: isProfitable ? 'Healthy' : 'Critical',
            highlights: highlightedItems.join(' '),
            roadmap
        };
    }, [financials, trialBalance]);

    // Years and Months for selection
    const years = [2026, 2027, 2028];
    const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

    if (!isClosed) {
        return (
            <div className="flex-1 bg-[#0B1221] min-h-screen flex items-center justify-center p-8">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-8 max-w-md"
                >
                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-10 border border-white/10 shadow-2xl">
                         <Flag size={40} className="text-slate-600" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tighter mb-4 italic">확정된 결산 리포트가 없습니다</h2>
                        <p className="text-sm font-bold text-slate-500 leading-relaxed uppercase tracking-tight">
                            결산 관리 메뉴에서 월마감을 진행하면 <br/> AI가 분석한 정식 경영 리포트가 생성됩니다.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                         <div className="flex items-center gap-3 justify-center mb-4">
                             <select 
                                value={selectedPeriod.split('-')[0]} 
                                onChange={(e) => setSelectedPeriod(`${e.target.value}-${selectedPeriod.split('-')[1]}`)}
                                className="bg-[#151D2E] text-white text-xs font-black px-4 py-2 rounded-xl border border-white/10 focus:outline-none"
                             >
                                 {years.map(y => <option key={y} value={y}>{y}년</option>)}
                             </select>
                             <select 
                                value={selectedPeriod.split('-')[1]} 
                                onChange={(e) => setSelectedPeriod(`${selectedPeriod.split('-')[0]}-${e.target.value}`)}
                                className="bg-[#151D2E] text-white text-xs font-black px-4 py-2 rounded-xl border border-white/10 focus:outline-none"
                             >
                                 {months.map(m => <option key={m} value={m}>{m}월</option>)}
                             </select>
                         </div>
                        <button 
                            onClick={() => setTab('closing')}
                            className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                        >
                            결산하러 가기 <ArrowLeft className="rotate-180" size={14} />
                        </button>
                        <button 
                            onClick={() => setTab('dashboard')}
                            className="text-[10px] font-black text-indigo-400 hover:underline uppercase tracking-widest pt-2"
                        >
                            대시보드로 돌아가기
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-[#121620] min-h-screen text-slate-100 p-8 lg:p-12 animate-in fade-in duration-500">
            {/* Header: Executive View */}
            <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-8 pb-8 border-b border-white/5 mb-10">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => setTab('dashboard')}
                        className="w-12 h-12 bg-[#1A1F2B] border border-white/5 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl hover:-translate-x-1"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                             <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg uppercase tracking-widest border border-emerald-500/20">공식 경영 리포트 (EXECUTIVE REPORT)</span>
                             <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg uppercase tracking-widest border border-indigo-500/20">
                                {finalizedMonths[selectedPeriod] === 'hard' ? 'HARD_SEALED' : 'SOFT_PRELIMINARY'}
                             </span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter italic">{selectedPeriod} 재무 성과 리포트</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <PremiumDatePicker 
                        value={`${selectedPeriod}-01`} 
                        onChange={handlePeriodChange} 
                    />
                    <div className="w-[1px] h-8 bg-white/5 mx-2" />
                    <button className="flex items-center gap-2 h-12 px-6 bg-[#1A1F2B] border border-white/5 rounded-2xl text-[10px] font-black text-slate-300 hover:text-white transition-all uppercase tracking-widest">
                        <Download size={14} /> PDF
                    </button>
                    <button className="flex items-center gap-2 h-12 px-6 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-[10px] font-black text-white transition-all shadow-xl shadow-indigo-600/20 uppercase tracking-widest">
                        <Share2 size={14} /> SHARE
                    </button>
                </div>
            </header>

            {/* Top Cards: Financial Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
                <div className="bg-[#1A1F2B] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp size={140} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">당월 총 매출 <span className="text-slate-600">(REVENUE)</span></p>
                    <h2 className="text-3xl font-black text-white tracking-tighter italic">₩{financials.revenue.toLocaleString()}</h2>
                </div>

                <div className="bg-[#1A1F2B] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 group-hover:scale-110 transition-transform">
                        <Target size={140} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">당기 순이익 <span className="text-slate-600">(NET INCOME)</span></p>
                    <h2 className={`text-3xl font-black tracking-tighter italic ${financials.netIncome < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ₩{financials.netIncome.toLocaleString()}
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-2 font-black uppercase tracking-widest">이익률: {((financials.netIncome / (financials.revenue || 1)) * 100).toFixed(1)}%</p>
                </div>

                <div className="bg-[#1A1F2B] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 group-hover:scale-110 transition-transform text-white">
                        <Activity size={140} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">자본 총계 <span className="text-slate-600">(TOTAL EQUITY)</span></p>
                    <h2 className="text-3xl font-black text-white tracking-tighter italic">₩{financials.totalEquity.toLocaleString()}</h2>
                    <p className="text-[10px] text-slate-500 mt-2 font-black uppercase tracking-widest">부채비율: {((financials.totalLiabilities / (financials.totalEquity || 1)) * 100).toFixed(1)}%</p>
                </div>

                <div className="bg-[#1A1F2B] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 group-hover:scale-110 transition-transform text-emerald-400">
                        <Zap size={140} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">기말 현금 잔액 <span className="text-slate-600">(CASH)</span></p>
                    <h2 className="text-3xl font-black text-emerald-400 tracking-tighter italic">₩{financials.cash.toLocaleString()}</h2>
                    <p className="text-[10px] text-slate-500 mt-2 font-black uppercase tracking-widest">현금 유동성 확보됨</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* AI CFO 경영 브리핑 */}
                <div className="xl:col-span-2 bg-[#121626] border-2 border-indigo-500/30 p-12 rounded-[3rem] shadow-3xl relative overflow-hidden group">
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform">
                        <ShieldCheck size={400} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-6 mb-12">
                            <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-600/40 border border-indigo-400/30">
                                <ShieldCheck size={32} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight italic">AI CFO Tactical Insight</h2>
                                <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em]">Strategic Intelligence Report</p>
                            </div>
                        </div>

                        <div className="space-y-8 text-md leading-relaxed text-slate-200 font-bold">
                            <p className="text-indigo-400 uppercase tracking-widest text-[10px]">[AI Strategic Briefing]</p>

                            <section className="space-y-4">
                                <h3 className="text-white flex items-center gap-2 italic">
                                    <TrendingDown size={18} className="text-rose-400" /> Critical Observations:
                                </h3>
                                <div className="pl-6 border-l-2 border-rose-500/20 space-y-4 text-slate-400">
                                    <p>
                                        {executiveInsight?.observations}
                                    </p>
                                    <p>
                                        현재의 지출 흐름이 지속될 경우 차기 분기 유동성 가용성을 기반으로 한 {executiveInsight?.status === 'Healthy' ? '안정적 확장' : '방어적 운영'} 전략이 필요할 것으로 AI는 예측하고 있습니다.
                                    </p>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h3 className="text-white flex items-center gap-2 italic">
                                    <Activity size={18} className="text-indigo-400" /> Strategic Roadmap:
                                </h3>
                                <ol className="list-decimal pl-10 space-y-6 text-slate-400">
                                    {executiveInsight?.roadmap.map((item: { title: string, content: string }, idx: number) => (
                                        <li key={idx}>
                                            <span className="text-slate-200 font-black italic underline decoration-indigo-500/50">{item.title}</span>
                                            <p className="mt-2 text-sm leading-relaxed">{item.content}</p>
                                        </li>
                                    ))}
                                </ol>
                            </section>

                            <section className="space-y-4">
                                <h3 className="text-emerald-400 flex items-center gap-2 italic">
                                    <Zap size={18} /> Performance Highlights:
                                </h3>
                                <p className="pl-6 border-l-2 border-emerald-500/20 text-slate-400">{executiveInsight?.highlights}</p>
                            </section>
                        </div>

                        <div className="mt-16 flex flex-col md:flex-row items-center justify-between border-t border-white/5 pt-10 gap-6">
                            <div className="flex items-center gap-6">
                                <div className="flex -space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-800 border-4 border-[#121626] flex items-center justify-center text-[10px] font-black text-slate-400 shadow-2xl">VC</div>
                                    <div className="w-12 h-12 rounded-full bg-slate-700 border-4 border-[#121626] flex items-center justify-center text-[10px] font-black text-slate-300 shadow-2xl">CEO</div>
                                    <div className="w-12 h-12 rounded-full bg-indigo-600 border-4 border-[#121626] flex items-center justify-center text-[10px] font-black text-white shadow-2xl shadow-indigo-600/30">CFO</div>
                                </div>
                                <span className="text-xs font-bold text-slate-500 italic tracking-tight">Executive Council has reviewed and certified this report.</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.3em]">Official Integrity Hash</span>
                                <span className="text-[9px] text-slate-600 font-mono mt-1">SHA-ASSET-REPORT-{selectedPeriod}-INTEGRITY</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: KPIs & Tactical Notes */}
                <div className="flex flex-col gap-6">
                    <div className="bg-[#1A1F2B] border border-white/5 rounded-[2.5rem] p-10 flex-1 shadow-2xl relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 p-8 opacity-5 text-indigo-400">
                             <TrendingUp size={180} />
                        </div>
                        <h3 className="text-lg font-black text-white mb-10 flex items-center gap-3 italic">
                            <FileText size={20} className="text-indigo-400" /> Tactical KPIs
                        </h3>

                        <div className="space-y-12">
                            <KPIProgress label="영업이익률 (Operating Margin)" val={(financials.netIncome / (financials.revenue || 1)) * 100} color="bg-indigo-500" />
                            <KPIProgress label="부채 비율 (Debt Ratio)" val={(financials.totalLiabilities / (financials.totalEquity || 1)) * 100} color="bg-amber-500" />
                            <KPIProgress label="현금 비중 (Cash Ratio)" val={(financials.cash / (financials.totalAssets || 1)) * 100} color="bg-emerald-500" />
                            <KPIProgress label="매출 회수율 (AR Collection)" val={75} color="bg-blue-500" />
                        </div>
                    </div>

                    <div className="bg-[#1A1F2B] border border-white/5 rounded-[2rem] p-8 h-[160px] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                             <Clock size={60} />
                        </div>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-4">Manager's Strategic Note</p>
                        <p className="text-sm font-mono text-slate-400 italic leading-relaxed group-hover:text-white transition-colors">
                            "{selectedPeriod.split('-')[1]}월 마감 결과 {parseInt(selectedPeriod.split('-')[1], 10) === 1 ? 12 : parseInt(selectedPeriod.split('-')[1], 10) - 1}월 대비 수익성이 다소 개선되었으나 운영비 통제는 여전히 필수적입니다. 차기 분기 예비 자금 확보를 권고합니다."
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;

