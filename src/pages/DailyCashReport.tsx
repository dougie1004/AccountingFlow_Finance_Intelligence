import React, { useMemo, useState } from 'react';
import { 
    TrendingUp, 
    TrendingDown, 
    Calendar, 
    ShieldCheck, 
    ArrowUpRight, 
    Zap, 
    Activity, 
    ChevronRight,
    Search,
    Filter,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    Briefcase,
    DollarSign,
    RefreshCw,
    Download,
    Plus
} from 'lucide-react';
import { useAccounting } from '../hooks/useAccounting';
import { AnimatePresence, motion } from 'framer-motion';

const DailyCashReport: React.FC = () => {
    const { ledger, selectedDate, setSelectedDate } = useAccounting();
    const [actualBalanceInput, setActualBalanceInput] = useState('');
    const [activeTab, setActiveTab] = useState('details');

    // Auto-reconcile initial input with book balance when date changes
    React.useEffect(() => {
        // Avoid overwriting if user is middle of typing, but here we want it to reflect the new date's balance
        const targetDate = new Date(selectedDate);
        let balance = 0;
        ledger.forEach(e => {
            if (e.status !== 'Approved') return;
            const isCashDebit = cashAccounts.some(acc => e.debitAccount.toLowerCase().includes(acc));
            const isCashCredit = cashAccounts.some(acc => e.creditAccount.toLowerCase().includes(acc));
            const total = e.amount + (e.vat || 0);
            if (e.date <= selectedDate) {
                if (isCashDebit) balance += total;
                if (isCashCredit) balance -= total;
            }
        });
        setActualBalanceInput(balance.toString());
    }, [selectedDate, ledger.length]); // Also sync if ledger changes (e.g. simulation run)

    const cashAccounts = ['현금', '보통예금', '예금', 'cash', 'bank'];

    const metrics = useMemo(() => {
        const targetDate = new Date(selectedDate);
        const yesterday = new Date(targetDate);
        yesterday.setDate(targetDate.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let initialBalance = 0;
        let todayInflow = 0;
        let todayOutflow = 0;

        ledger.forEach(e => {
            // [STRICT] Only process Approved (Authorized) entries for Daily Cash Report
            if (e.status !== 'Approved') return;

            const isCashDebit = cashAccounts.some(acc => e.debitAccount.toLowerCase().includes(acc));
            const isCashCredit = cashAccounts.some(acc => e.creditAccount.toLowerCase().includes(acc));
            const total = e.amount + (e.vat || 0);

            if (e.date < selectedDate) {
                if (isCashDebit) initialBalance += total;
                if (isCashCredit) initialBalance -= total;
            } else if (e.date === selectedDate) {
                if (isCashDebit) todayInflow += total;
                if (isCashCredit) todayOutflow += total;
            }
        });

        const currentBalance = initialBalance + todayInflow - todayOutflow;
        const isMatched = Math.abs(currentBalance - Number(actualBalanceInput)) < 1;

        const inflows = ledger.filter(e => e.status === 'Approved' && e.date === selectedDate && cashAccounts.some(acc => e.debitAccount.toLowerCase().includes(acc)));
        const outflows = ledger.filter(e => e.status === 'Approved' && e.date === selectedDate && cashAccounts.some(acc => e.creditAccount.toLowerCase().includes(acc)));

        const arRecords = ledger.filter(e => e.debitAccount === '외상매출금' || e.creditAccount === '외상매출금' || e.debitAccount === '미수금' || e.creditAccount === '미수금');

        return {
            yesterdayBalance: initialBalance,
            todayInflow,
            todayOutflow,
            todayBalance: currentBalance,
            isMatched,
            inflows,
            outflows,
            arRecords
        };
    }, [ledger, selectedDate, actualBalanceInput]);

    return (
        <div className="space-y-8 min-h-screen pb-20 bg-[#0B1221] p-6 lg:p-10 text-slate-100">
            {/* Header: Tactical Style */}
            <div className="flex flex-col xl:flex-row justify-between gap-6 items-start">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20">
                            <Activity size={32} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Financial Control Center</span>
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tighter italic">
                                자금일보 <span className="text-slate-500 text-xl font-bold not-italic ml-2">(Daily Cash Report)</span>
                            </h1>
                            <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest leading-none">
                                {selectedDate} 기준 자금 흐름 및 시세 마감
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                     <div className="bg-[#151D2E] px-5 py-2.5 rounded-2xl border border-white/5 flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WORLD CHECK ACTIVE</span>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="flex items-center gap-3">
                             <Calendar size={14} className="text-indigo-400" />
                             <span className="text-[11px] font-black uppercase text-slate-300">DIMENSION TIME: <span className="text-white ml-2">{selectedDate}</span></span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button className="h-12 px-6 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                             <Download size={16} /> 엑셀 업로드 (Smart)
                        </button>
                        <div className="h-12 bg-[#151D2E] px-4 rounded-2xl border border-white/5 flex items-center gap-4">
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-white text-[11px] font-black focus:outline-none cursor-pointer uppercase"
                            />
                            <Calendar size={16} className="text-slate-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-slate-400 group-hover:scale-110 transition-transform">
                        <ArrowLeft size={100} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">전일 잔액 (YESTERDAY)</p>
                    <h2 className="text-4xl font-black text-white tracking-tighter">₩{metrics.yesterdayBalance.toLocaleString()}</h2>
                </div>

                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-[10px] font-black border border-white/10 z-10 text-slate-500 group-hover:text-white transition-colors">VS</div>
                    </div>
                    <div className="flex h-full items-center justify-between">
                        <div className="text-center w-1/2">
                             <p className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter mb-2 flex items-center justify-center gap-1">
                                <TrendingUp size={10} /> 금일 입금 (IN)
                             </p>
                             <h3 className="text-3xl font-black text-emerald-500 tracking-tighter">₩{metrics.todayInflow.toLocaleString()}</h3>
                        </div>
                        <div className="text-center w-1/2">
                             <p className="text-[9px] font-black text-rose-500 uppercase tracking-tighter mb-2 flex items-center justify-center gap-1">
                                <TrendingDown size={10} /> 금일 출금 (OUT)
                             </p>
                             <h3 className="text-3xl font-black text-rose-500 tracking-tighter">₩{metrics.todayOutflow.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-indigo-600/10 p-8 rounded-[2.5rem] border-4 border-indigo-600/30 shadow-2xl relative overflow-hidden group md:col-span-2">
                    <div className="absolute -right-4 -bottom-4 opacity-5 text-indigo-400 group-hover:scale-110 transition-transform">
                        <DollarSign size={180} />
                    </div>
                    <div className="flex justify-between items-center h-full">
                        <div>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">금일 잔액 (TODAY)</p>
                            <h2 className="text-6xl font-black text-white tracking-tighter drop-shadow-2xl">₩{metrics.todayBalance.toLocaleString()}</h2>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/40">
                                LIQUIDITY_READY
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold tracking-widest">Real-time Auto Refresh active</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reconciliation Control */}
            <div className="bg-[#151D2E] p-10 rounded-[3rem] border border-white/5 shadow-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                    <ShieldCheck size={140} className="text-indigo-400" />
                </div>
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
                    <div className="flex items-center gap-8">
                        <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400">
                             <RefreshCw size={28} className={metrics.isMatched ? "" : "animate-spin"} />
                        </div>
                        <div className="max-w-md">
                            <h3 className="text-2xl font-black text-white italic mb-2">시세 마감 검증 (Reconciliation)</h3>
                            <p className="text-sm font-bold text-slate-500 leading-relaxed uppercase tracking-tight">
                                장부상 잔액과 실제 통장 잔액을 대조하여 하루를 마감하세요. 차액 발생 시 불일치 사유를 분석해야 합니다.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-10">
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">장부 잔액</span>
                            <span className="text-2xl font-mono font-black text-white">₩{metrics.todayBalance.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 bg-black/40 px-6 py-4 rounded-[2rem] border border-white/5 shadow-inner">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">실제 잔액 입력</span>
                                <input 
                                    className="bg-transparent border-none text-2xl font-mono font-black text-indigo-400 focus:outline-none w-48 text-right"
                                    value={actualBalanceInput}
                                    onChange={(e) => setActualBalanceInput(e.target.value.replace(/,/g, ''))}
                                    placeholder="숫자만 입력"
                                />
                            </div>
                            <div className={`px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] border tracking-widest transition-all ${metrics.isMatched ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                                {metrics.isMatched ? <CheckCircle2 size={14} /> : <Activity size={14} className="animate-pulse" />}
                                {metrics.isMatched ? '일치 (Matched)' : '불일치 (Mismatch)'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Container */}
            <div className="space-y-4">
                <div className="flex gap-4 p-1.5 bg-black/40 rounded-[2rem] border border-white/5 w-fit">
                    {[
                        { id: 'details', label: `일일 자금 명세 (${metrics.inflows.length + metrics.outflows.length})` },
                        { id: 'ar_ap', label: `미수금 / 외상매출 관리 (${metrics.arRecords.length})` },
                        { id: 'lease', label: '미지급금 / 리스 스케줄' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/40' : 'text-slate-500 hover:text-white'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'details' && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                        >
                            {/* Inflow Panel */}
                            <div className="bg-[#151D2E] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
                                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-emerald-500/5">
                                    <h3 className="text-xl font-black text-emerald-400 flex items-center gap-3 italic uppercase italic">
                                        <TrendingUp size={24} /> 입금 (Inflow)
                                    </h3>
                                    <span className="text-xs font-black text-slate-500">{metrics.inflows.length} 건</span>
                                </div>
                                <div className="flex-1 p-8">
                                    {metrics.inflows.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                            <Zap size={48} className="text-slate-500 mb-4" />
                                            <p className="text-sm font-black uppercase tracking-widest">금일 입금 내역이 없습니다.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full">
                                            <thead className="text-[10px] font-black text-slate-600 uppercase tracking-widest text-left">
                                                <tr className="border-b border-white/5">
                                                    <th className="py-4">상대계정 / 거래처</th>
                                                    <th className="py-4 text-right">금액 (KRW)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {metrics.inflows.map((e, idx) => (
                                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                                        <td className="py-5">
                                                            <p className="text-sm font-black text-white">{e.creditAccount}</p>
                                                            <p className="text-[10px] text-slate-500 font-bold mt-1">{e.vendor} | {e.description}</p>
                                                        </td>
                                                        <td className="py-5 text-right">
                                                            <span className="text-lg font-mono font-black text-emerald-400">₩{(e.amount + (e.vat || 0)).toLocaleString()}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                <div className="p-8 bg-black/20 border-t border-white/5 flex justify-between items-center">
                                     <span className="text-[10px] font-black text-slate-500 uppercase">Total Inflow</span>
                                     <span className="text-2xl font-black text-white font-mono tracking-tighter">₩{metrics.todayInflow.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Outflow Panel */}
                            <div className="bg-[#151D2E] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
                                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-rose-500/5">
                                    <h3 className="text-xl font-black text-rose-400 flex items-center gap-3 italic uppercase italic">
                                        <TrendingDown size={24} /> 출금 (Outflow)
                                    </h3>
                                    <span className="text-xs font-black text-slate-500">{metrics.outflows.length} 건</span>
                                </div>
                                <div className="flex-1 p-8">
                                    {metrics.outflows.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                            <Zap size={48} className="text-slate-500 mb-4" />
                                            <p className="text-sm font-black uppercase tracking-widest">금일 출금 내역이 없습니다.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full">
                                            <thead className="text-[10px] font-black text-slate-600 uppercase tracking-widest text-left">
                                                <tr className="border-b border-white/5">
                                                    <th className="py-4">상대계정 / 거래처</th>
                                                    <th className="py-4 text-right">금액 (KRW)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {metrics.outflows.map((e, idx) => (
                                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                                        <td className="py-5">
                                                            <p className="text-sm font-black text-white">{e.debitAccount}</p>
                                                            <p className="text-[10px] text-slate-500 font-bold mt-1">{e.vendor} | {e.description}</p>
                                                        </td>
                                                        <td className="py-5 text-right">
                                                            <span className="text-lg font-mono font-black text-rose-400">₩{(e.amount + (e.vat || 0)).toLocaleString()}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                <div className="p-8 bg-black/20 border-t border-white/5 flex justify-between items-center">
                                     <span className="text-[10px] font-black text-slate-500 uppercase">Total Outflow</span>
                                     <span className="text-2xl font-black text-white font-mono tracking-tighter">₩{metrics.todayOutflow.toLocaleString()}</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    {activeTab === 'ar_ap' && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-[#151D2E] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl min-h-[500px] flex flex-col"
                        >
                            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-blue-500/5">
                                <h3 className="text-xl font-black text-blue-400 flex items-center gap-3 italic uppercase italic">
                                    <Briefcase size={24} /> 미수금 / 외상매출금 관리 (Account Receivables)
                                </h3>
                                <span className="text-xs font-black text-slate-500">{metrics.arRecords.length} 건</span>
                            </div>
                            <div className="flex-1 p-8">
                                {metrics.arRecords.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 mt-20">
                                        <Zap size={48} className="text-slate-500 mb-4" />
                                        <p className="text-sm font-black uppercase tracking-widest">관리 중인 미수금/외상매출 내역이 없습니다.</p>
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead className="text-[10px] font-black text-slate-600 uppercase tracking-widest text-left">
                                            <tr className="border-b border-white/5">
                                                <th className="py-4">발생일자</th>
                                                <th className="py-4">계정과목 / 거래처</th>
                                                <th className="py-4 text-right">차변 (발생)</th>
                                                <th className="py-4 text-right">대변 (회수)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {metrics.arRecords.map((e, idx) => {
                                                const isDebit = e.debitAccount === '외상매출금' || e.debitAccount === '미수금';
                                                
                                                return (
                                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                                        <td className="py-5">
                                                            <span className="text-sm font-black text-white font-mono">{e.date}</span>
                                                        </td>
                                                        <td className="py-5">
                                                            <p className="text-sm font-black text-indigo-300">{isDebit ? e.debitAccount : e.creditAccount}</p>
                                                            <p className="text-[10px] text-slate-500 font-bold mt-1">{e.vendor} | {e.description}</p>
                                                        </td>
                                                        <td className="py-5 text-right">
                                                            {isDebit ? <span className="text-lg font-mono font-black text-white">₩{(e.amount + (e.vat || 0)).toLocaleString()}</span> : <span className="text-slate-700">-</span>}
                                                        </td>
                                                        <td className="py-5 text-right">
                                                            {!isDebit ? <span className="text-lg font-mono font-black text-emerald-400">₩{(e.amount + (e.vat || 0)).toLocaleString()}</span> : <span className="text-slate-700">-</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </motion.div>
                    )}
                    {activeTab === 'lease' && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-[#151D2E] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl min-h-[500px] flex flex-col items-center justify-center p-10 text-center"
                        >
                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                <Activity size={40} className="text-slate-600" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic mb-2">미지급금 / 리스 스케줄 모듈 준비 중</h3>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto">
                                리스 부채 상환 일정 및 기한 도래 미지급금 내역을 자동 관리하는 모듈이 다음 업데이트에 통합될 예정입니다.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            {/* Legend for CFO: Certification Stamp */}
            <div className="flex justify-start opacity-70 mt-12">
                 <div className="border-2 border-slate-800 rounded-3xl p-6 rotate-[-2deg] bg-black/20 backdrop-blur-sm border-dashed">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[.4em] mb-4 text-center">Audit Authority</p>
                    <div className="flex items-center gap-6">
                         <div className="w-16 h-16 rounded-full border-4 border-slate-700/50 flex items-center justify-center text-slate-600 font-black italic text-xl">AF</div>
                         <div>
                            <p className="text-sm font-black text-slate-400 leading-none">AI CONTROLLER</p>
                            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">Certified Real-time Integrity</p>
                            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Hash: CASH_DAILY_8129_RECON</p>
                         </div>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default DailyCashReport;
