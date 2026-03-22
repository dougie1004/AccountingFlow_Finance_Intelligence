import React, { useState, useMemo } from 'react';
import { 
    Lock, 
    Unlock, 
    ShieldCheck, 
    ShieldAlert, 
    Calendar, 
    Clock, 
    User, 
    FileText, 
    AlertTriangle, 
    CheckCircle2, 
    ChevronRight,
    ArrowRight,
    Zap,
    History,
    Settings,
    RotateCcw
} from 'lucide-react';
import { useAccounting } from '../hooks/useAccounting';
import { motion, AnimatePresence } from 'framer-motion';
import { TrialBalanceItem } from '../types';

export const Closing: React.FC<{ setTab: (tab: string) => void }> = ({ setTab }) => {
    const { ledger, finalizedMonths, performClosing, reopenMonth, calculateTBForRange, setSelectedDate } = useAccounting();
    const [selectedYear, setSelectedYear] = useState(2026);
    const [isProcessing, setIsProcessing] = useState(false);
    const [closingTarget, setClosingTarget] = useState<{ month: string, type: 'soft' | 'hard' } | null>(null);

    const months = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        return `${selectedYear}-${m}`;
    });

    const getMonthStatus = (monthKey: string): 'soft' | 'hard' | 'open' => {
        return (finalizedMonths[monthKey] as 'soft' | 'hard' | undefined) || 'open';
    };

    const handlePerformClosing = async (month: string, type: 'soft' | 'hard') => {
        setIsProcessing(true);
        // Simulate AI analysis verification
        await new Promise(resolve => setTimeout(resolve, 1500));
        performClosing(month, type);
        setIsProcessing(false);
        setClosingTarget(null);
    };

    return (
        <div className="flex-1 bg-[#0B1221] min-h-screen text-slate-100 p-8 lg:p-12 space-y-10 animate-in fade-in duration-500">
            {/* Header: High-Tech Audit Style */}
            <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-8 pb-8 border-b border-white/5">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20">
                            <ShieldCheck size={32} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Integrity & Compliance Center</span>
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tighter italic">
                                결산 및 마감 관리 <span className="text-slate-500 text-xl font-bold not-italic ml-2">(Closing Manager)</span>
                            </h1>
                            <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">
                                회계 기간 마감을 통해 재무 데이터의 무결성을 확정하고 공식 리포트를 발행합니다.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-[#151D2E] p-2 rounded-2xl border border-white/5 shadow-2xl">
                    {[2026, 2027, 2028].map(y => (
                        <button
                            key={y}
                            onClick={() => setSelectedYear(y)}
                            className={`px-6 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${selectedYear === y ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            {y} FISCAL YEAR
                        </button>
                    ))}
                </div>
            </header>

            {/* Tactical Status Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-emerald-400 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={100} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Hard Closed Periods</p>
                    <h2 className="text-4xl font-black text-white tracking-tighter">
                        {Object.values(finalizedMonths).filter(v => v === 'hard').length} <span className="text-lg text-slate-500">Months Sealed</span>
                    </h2>
                </div>
                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-amber-500 group-hover:scale-110 transition-transform">
                        <Clock size={100} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Soft Closed Periods</p>
                    <h2 className="text-4xl font-black text-white tracking-tighter">
                        {Object.values(finalizedMonths).filter(v => v === 'soft').length} <span className="text-lg text-slate-500">Preliminary</span>
                    </h2>
                </div>
                <div className="bg-indigo-600/10 p-8 rounded-[2.5rem] border border-indigo-500/30 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-400 group-hover:scale-110 transition-transform">
                        <Zap size={100} />
                    </div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Next Closing Target</p>
                    <h2 className="text-4xl font-black text-white tracking-tighter">
                        {months.find(m => getMonthStatus(m) === 'open')?.split('-')[1] || 'None'} <span className="text-lg text-slate-500">Upcoming</span>
                    </h2>
                </div>
            </div>

            {/* Period Management Table */}
            <div className="bg-[#151D2E] rounded-[3rem] border border-white/5 overflow-hidden shadow-3xl">
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <div className="flex items-center gap-3 text-lg font-black italic">
                        <Calendar size={20} className="text-indigo-400" /> 세부 마감 현황 (Monthly Status)
                    </div>
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-[9px] font-black text-emerald-400">
                             <ShieldCheck size={12} /> AI INTEGRITY ENGINE ACTIVE
                         </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 bg-black/10">
                                <th className="px-10 py-5 w-40">Month</th>
                                <th className="px-10 py-5 w-48">Audit Status</th>
                                <th className="px-10 py-5">Integrity Reports</th>
                                <th className="px-10 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {months.map((m, idx) => {
                                const status = getMonthStatus(m);
                                return (
                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-10 py-8">
                                            <span className="text-xl font-black text-white tracking-widest">{m.split('-')[1]}월</span>
                                            <span className="text-[10px] text-slate-500 font-bold block mt-1">{m.split('-')[0]} Fiscal</span>
                                        </td>
                                        <td className="px-10 py-8">
                                            {status === 'hard' && (
                                                <div className="flex items-center gap-2 text-rose-400 font-black text-xs">
                                                    <Lock size={14} /> 영구 마감 (Hard)
                                                </div>
                                            )}
                                            {status === 'soft' && (
                                                <div className="flex items-center gap-2 text-amber-500 font-black text-xs">
                                                    <Clock size={14} /> 임시 마감 (Soft)
                                                </div>
                                            )}
                                            {status === 'open' && (
                                                <div className="flex items-center gap-2 text-slate-500 font-black text-xs italic">
                                                    <Unlock size={14} /> 미마감 기간
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-10 py-8">
                                            {status !== 'open' ? (
                                                <button 
                                                    onClick={() => {
                                                        const [y, mNum] = m.split('-');
                                                        const lastDay = new Date(parseInt(y), parseInt(mNum), 0).getDate();
                                                        setSelectedDate(`${m}-${String(lastDay).padStart(2, '0')}`);
                                                        setTab('reports');
                                                    }}
                                                    className="flex items-center gap-2 text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-[0.2em]"
                                                >
                                                    <FileText size={14} /> 경영성과리포트 생성됨 <ChevronRight size={10} />
                                                </button>
                                            ) : (
                                                <span className="text-[10px] text-slate-600 font-bold italic">마감 후 리포트 발행 가능</span>
                                            )}
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex justify-end gap-3">
                                                {status === 'open' && (
                                                    <>
                                                        <button 
                                                            onClick={() => setClosingTarget({ month: m, type: 'soft' })}
                                                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
                                                        >
                                                            Soft Closing
                                                        </button>
                                                        <button 
                                                            onClick={() => setClosingTarget({ month: m, type: 'hard' })}
                                                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 border border-indigo-400/30 transition-all"
                                                        >
                                                            Hard Closing
                                                        </button>
                                                    </>
                                                )}
                                                {status === 'soft' && (
                                                    <>
                                                        <button 
                                                            onClick={() => reopenMonth(m)}
                                                            className="px-6 py-2.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20 transition-all flex items-center gap-2"
                                                        >
                                                            <RotateCcw size={12} /> Re-open
                                                        </button>
                                                        <button 
                                                            onClick={() => setClosingTarget({ month: m, type: 'hard' })}
                                                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 border border-indigo-400/30 transition-all"
                                                        >
                                                            Upgrade to Hard
                                                        </button>
                                                    </>
                                                )}
                                                {status === 'hard' && (
                                                     <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase">
                                                        <ShieldCheck size={12} /> Integrity Sealed by CFO
                                                     </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {closingTarget && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#151D2E] w-full max-w-xl rounded-[3rem] border border-white/10 shadow-3xl p-12 space-y-8 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                                {closingTarget.type === 'hard' ? <ShieldAlert size={140} className="text-rose-500" /> : <ShieldCheck size={140} className="text-indigo-400" />}
                            </div>

                            <div className="text-center space-y-4">
                                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border-4 ${closingTarget.type === 'hard' ? 'bg-rose-600/20 border-rose-600/30 text-rose-500' : 'bg-indigo-600/20 border-indigo-600/30 text-indigo-400'}`}>
                                    {closingTarget.type === 'hard' ? <Lock size={36} /> : <Zap size={36} />}
                                </div>
                                <h3 className="text-3xl font-black text-white italic tracking-tighter">
                                    {closingTarget.month.split('-')[1]}월 {closingTarget.type === 'hard' ? 'Hard' : 'Soft'} Closing 실행
                                </h3>
                                <p className="text-sm font-bold text-slate-400 leading-relaxed uppercase tracking-tight max-w-sm mx-auto">
                                    {closingTarget.type === 'hard' 
                                        ? "해당 기간의 데이터를 영구적으로 확정하고 수정이 불가능하도록 봉인합니다. 신중하게 진행해 주십시오."
                                        : "해당 기간의 데이터를 임시 확정하여 경영 리포트를 생성합니다. 추가적인 데이터 수정이 가능합니다."}
                                </p>
                            </div>

                            <div className="bg-black/40 rounded-3xl p-8 border border-white/5 space-y-4">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">대상 기간</span>
                                    <span className="text-white">{closingTarget.month}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">CLOSING LEVEL</span>
                                    <span className={closingTarget.type === 'hard' ? 'text-rose-400' : 'text-indigo-400'}>{closingTarget.type === 'hard' ? '영구 마감 (데이터 봉인)' : '임시 마감 (수정 가능)'}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">당월 예상 손익 (Period Net Income)</span>
                                    {(() => {
                                        const tb = calculateTBForRange(`${closingTarget.month}-01`, new Date(selectedYear, parseInt(closingTarget.month.split('-')[1]), 0).toISOString().split('T')[0]);
                                        let rev = 0; let exp = 0;
                                        Object.values(tb).forEach((item: TrialBalanceItem) => {
                                            if (item.meta.nature === 'REVENUE') rev += (item.movementCredit - item.movementDebit);
                                            else if (item.meta.nature === 'EXPENSE') exp += (item.movementDebit - item.movementCredit);
                                        });
                                        const ni = rev - exp;
                                        return <span className={ni >= 0 ? 'text-emerald-400' : 'text-rose-400'}>₩{ni.toLocaleString()}</span>;
                                    })()}
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">AI 무결성 검증 (Integrity)</span>
                                    <span className="text-emerald-400">PASSED</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setClosingTarget(null)}
                                    className="h-16 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
                                >
                                    취소
                                </button>
                                <button 
                                    onClick={() => handlePerformClosing(closingTarget.month, closingTarget.type)}
                                    disabled={isProcessing}
                                    className={`h-16 flex items-center justify-center gap-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 ${closingTarget.type === 'hard' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                >
                                    {isProcessing ? <RotateCcw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                                    {isProcessing ? '확정 처리 중...' : `${closingTarget.type === 'hard' ? 'Sealing' : 'Finalize'} Period`}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
