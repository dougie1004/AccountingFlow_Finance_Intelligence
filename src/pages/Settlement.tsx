import React, { useMemo, useState } from 'react';
import { useAccounting } from '../hooks/useAccounting';
import { 
    Calculator, 
    Calendar, 
    ArrowUpRight, 
    TrendingUp, 
    AlertCircle, 
    Mail, 
    Clock, 
    DollarSign, 
    BarChart3,
    ArrowDownLeft,
    Search,
    Filter,
    ShieldAlert,
    CheckCircle2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

export const Settlement: React.FC = () => {
    const { ledger, selectedDate, addEntry, addEntries } = useAccounting();
    const [viewMode, setViewMode] = useState<'RECEIVABLES' | 'PAYABLES' | 'SUSPENSE'>('RECEIVABLES');

    // Dynamic Account Logic based on ViewMode
    const currentEntries = useMemo(() => {
        return ledger.filter(e => {
            if (viewMode === 'RECEIVABLES') {
                return e.debitAccount.includes('외상매출') || e.creditAccount.includes('외상매출');
            } else if (viewMode === 'PAYABLES') {
                return e.debitAccount.includes('외상매입') || e.creditAccount.includes('외상매입') || 
                       e.debitAccount.includes('미지급') || e.creditAccount.includes('미지급');
            } else {
                const suspenseTerms = ['선급', '선수', '가수', '가지급'];
                return suspenseTerms.some(term => e.debitAccount.includes(term) || e.creditAccount.includes(term));
            }
        });
    }, [ledger, viewMode]);

    const settledIds = useMemo(() => {
        const ids = new Set<string>();
        ledger.forEach(e => {
            if (e.id.startsWith('SETTLE-')) {
                // Formatting: SETTLE-${entry.id}-${Date.now()}
                const parts = e.id.split('-');
                if (parts.length >= 2) {
                    ids.add(parts[1]);
                }
            }
        });
        return ids;
    }, [ledger]);

    const createSettlementEntry = (entry: any, isAR: boolean) => ({
        id: `SETTLE-${entry.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        date: selectedDate,
        description: `[SETTLE] ${entry.description} ${isAR ? '수금' : '지급'} 완료`,
        vendor: entry.vendor,
        amount: entry.amount,
        vat: 0,
        type: (isAR ? 'Revenue' : 'Expense') as any,
        status: 'Approved' as const,
        debitAccount: isAR ? '보통예금' : entry.creditAccount,
        debitAccountId: isAR ? 'acc_103' : entry.creditAccountId,
        creditAccount: isAR ? entry.debitAccount : '보통예금',
        creditAccountId: isAR ? entry.debitAccountId : 'acc_103',
    });

    const handleSettle = (entry: any) => {
        const isAR = viewMode === 'RECEIVABLES';
        const isAP = viewMode === 'PAYABLES';
        
        if (!isAR && !isAP) {
            alert("가계정 항목은 상세 정산 페이지에서 처리해 주세요.");
            return;
        }

        const settlementEntry = createSettlementEntry(entry, isAR);
        addEntry(settlementEntry);
        // alert(`${isAR ? '수금' : '지급'} 처리가 장부에 반영되었습니다.`);
    };

    const handleSettleAll = () => {
        const isAR = viewMode === 'RECEIVABLES';
        const isAP = viewMode === 'PAYABLES';
        
        const pendings = currentEntries.filter(e => {
            if (settledIds.has(e.id)) return false;
            if (isAR) return !e.creditAccount.includes('외상매출');
            if (isAP) return !e.debitAccount.includes('외상매입') && !e.debitAccount.includes('미지급');
            return true;
        });

        if (pendings.length === 0) {
            alert("정산 처리할 항목이 없습니다.");
            return;
        }

        const newEntries = pendings.map(e => createSettlementEntry(e, isAR));
        
        if (window.confirm(`${pendings.length}건의 항목을 일괄 정산 처리하시겠습니까?`)) {
            addEntries(newEntries);
        }
    };

    const viewMetrics = useMemo(() => {
        let total = 0;
        let count = 0;
        let overdueCount = 0;
        
        const agingData = [
            { name: '0-30일', value: 0, color: '#10b981' },
            { name: '31-60일', value: 0, color: '#34d399' },
            { name: '61-90일', value: 0, color: '#f59e0b' },
            { name: '91-180일', value: 0, color: '#fb923c' },
            { name: '181-270일', value: 0, color: '#f97316' },
            { name: '271-360일', value: 0, color: '#fb7185' },
            { name: '360일 이상', value: 0, color: '#ef4444' }
        ];

        const getNow = (dateString: string | undefined) => {
            if (dateString) {
                const date = new Date(dateString);
                date.setHours(23, 59, 59, 999); 
                return date;
            }
            return new Date();
        };

        const systemNow = new Date();
        const analysisNow = getNow(selectedDate);
        const useSimulation = selectedDate !== undefined && selectedDate !== '';
        
        const riskNow = useSimulation ? analysisNow : systemNow;
        const prevMonth = new Date(riskNow);
        prevMonth.setMonth(riskNow.getMonth() - 1);
        
        const riskLedgerUsed = useSimulation ? currentEntries : currentEntries.filter(e => {
            const isScen = e.scope === 'scenario' || e.scope === 'future' || e.id?.includes('SIM-') || e.id?.startsWith('REV-');
            return !isScen;
        });

        // 🔥 [SSOT v8] Smart Reference Balancing for Settlement
        const refBalances = new Map<string, number>();
        riskLedgerUsed.forEach(e => {
            if (!e.referenceId || !['AR', 'AP'].includes(e.accountType || '')) return;
            const totalAmount = e.amount + (e.vat || 0);
            const isPlus = (e.accountType === 'AR' && (e.debitAccount.includes('외상매출') || e.debitAccount.includes('미수'))) ||
                           (e.accountType === 'AP' && (e.creditAccount.includes('외상매입') || e.creditAccount.includes('미지급')));
            const isMinus = (e.accountType === 'AR' && (e.creditAccount.includes('외상매출') || e.creditAccount.includes('미수'))) ||
                            (e.accountType === 'AP' && (e.debitAccount.includes('외상매입') || e.debitAccount.includes('미지급')));
            
            const delta = (isPlus ? totalAmount : 0) - (isMinus ? totalAmount : 0);
            refBalances.set(e.referenceId, (refBalances.get(e.referenceId) || 0) + delta);
        });

        const autoMatchedRefs = new Set<string>();
        refBalances.forEach((bal, id) => {
            if (Math.abs(bal) < 100) autoMatchedRefs.add(id);
        });

        // 집계 로직
        const countedRefs = new Set<string>();
        const overdueRefs = new Set<string>();
        const vendorsWithOverdue = new Set<string>();

        riskLedgerUsed.forEach(e => {
            const entryDate = new Date(e.date);
            if (entryDate > riskNow) return;

            const isAutoMatched = e.referenceId && autoMatchedRefs.has(e.referenceId);
            if (e.matchingStatus === 'matched' || isAutoMatched || settledIds.has(e.id)) return;

            // [FIX] Only sum generation entries to match the detail list filter
            // RECEIVABLES: Debit AR is generation, Credit AR is settlement
            // PAYABLES: Credit AP/Liability is generation, Debit AP/Liability is settlement
            const isAR = viewMode === 'RECEIVABLES';
            const isAP = viewMode === 'PAYABLES';
            
            const isGeneration = isAR ? e.debitAccount.includes('외상매출') : (isAP ? (e.creditAccount.includes('외상매입') || e.creditAccount.includes('미지급')) : true);
            if (!isGeneration) return;

            // Invoice 단위 집계를 위해 referenceId 또는 ID 사용
            const refKey = e.referenceId || e.id;
            
            if (!countedRefs.has(refKey)) {
                count++;
                countedRefs.add(refKey);
            }
            
            const amt = Math.abs(e.amount);
            total += amt;
            
            const diffDays = Math.floor((riskNow.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 30) agingData[0].value += amt;
            else if (diffDays <= 60) agingData[1].value += amt;
            else if (diffDays <= 90) agingData[2].value += amt;
            else if (diffDays <= 180) agingData[3].value += amt;
            else if (diffDays <= 270) agingData[4].value += amt;
            else if (diffDays <= 360) agingData[5].value += amt;
            else agingData[6].value += amt;

            if (diffDays > 30) {
                if (!overdueRefs.has(refKey)) {
                    overdueCount++;
                    overdueRefs.add(refKey);
                }
                if (e.vendor) vendorsWithOverdue.add(e.vendor);
            }
        });

        const trend = 0; // Simplified for now

        return { total, count, overdueCount, agingData, trend, criticalVendors: vendorsWithOverdue.size, autoMatchedRefs };
    }, [currentEntries, selectedDate, viewMode]);

    return (
        <div className="flex-1 bg-[#0B1221] min-h-screen text-slate-100 space-y-8 animate-in fade-in duration-500 pb-12">
            <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-8 pb-8 border-b border-white/5">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20">
                            <ShieldAlert size={32} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Operational Risk & Settlement Intelligence</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase">
                                    리스크 익스포저 및 정산 관리 <span className="text-slate-500 text-xl font-bold not-italic ml-2">(Risk Exposure)</span>
                                </h1>
                                <div className="px-5 py-1.5 bg-purple-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-600/20">
                                    SETTLEMENT VIEW → 정산/매칭 상태 기반 분석
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-[#151D2E] p-1.5 rounded-2xl border border-white/5 shadow-2xl">
                    {(['RECEIVABLES', 'PAYABLES', 'SUSPENSE'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${viewMode === mode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </header>

            {/* Metric Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group hover:bg-[#1a2335] transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-400 group-hover:scale-110 transition-transform">
                        <DollarSign size={100} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Total Risk Exposure</p>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-2">
                        ₩{Math.floor(viewMetrics.total / 10000).toLocaleString()}<span className="text-lg text-slate-500 ml-1">만원</span>
                    </h2>
                    <div className={`flex items-center gap-2 text-xs font-bold ${viewMetrics.trend >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {viewMetrics.trend >= 0 ? <TrendingUp size={14} /> : <ArrowDownLeft size={14} />} 
                        <span>전월 대비 {Math.abs(viewMetrics.trend).toFixed(1)}% {viewMetrics.trend >= 0 ? '증가' : '감소'}</span>
                    </div>
                </div>
                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group hover:bg-[#1a2335] transition-all">
                    <div className="absolute -right-4 -bottom-4 opacity-5 text-white group-hover:scale-110 transition-transform">
                        <Clock size={120} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 group-hover:text-slate-300">
                        {viewMode === 'RECEIVABLES' ? '미결제 건수' : viewMode === 'PAYABLES' ? '미지급 건수' : '정산 필요 건수'}
                    </p>
                    <h2 className="text-4xl font-black text-white mb-2 tracking-tighter group-hover:text-indigo-400 transition-colors">{viewMetrics.count}건</h2>
                    <p className="text-slate-500 text-xs font-bold italic tracking-wide group-hover:text-slate-400">
                        {viewMetrics.criticalVendors}개 주요 {viewMode === 'RECEIVABLES' ? '거래처' : '공급처'} 집중 관리 필요
                    </p>
                </div>
                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group hover:bg-[#1a2335] transition-all">
                    <div className="absolute -right-4 -bottom-4 opacity-5 text-rose-500 group-hover:scale-110 transition-transform">
                        <ShieldAlert size={120} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 group-hover:text-slate-300">
                        {viewMode === 'RECEIVABLES' ? '기한 도과 (연체)' : viewMode === 'PAYABLES' ? '지불 기한 도과' : '장기 미정산 (30일+)'}
                    </p>
                    <h2 className="text-4xl font-black text-rose-500 mb-2 tracking-tighter group-hover:scale-110 transition-transform">{viewMetrics.overdueCount}건</h2>
                    <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                        <AlertCircle size={14} /> <span>즉각적인 대응 조치 필요</span>
                    </div>
                </div>
                <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-indigo-500/20 shadow-2xl relative overflow-hidden group bg-indigo-500/5">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 italic">Risk Analysis Center</p>
                    <p className="text-[11px] font-bold text-slate-300 leading-relaxed uppercase">
                        현재 {viewMode} 기준 총 <span className="text-white font-black text-lg">₩{viewMetrics.total.toLocaleString()}</span>의 리스크 노출이 감지되었습니다. 
                    </p>
                    <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-1">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">📢 Data Integrity Notice</span>
                        <p className="text-[10px] font-bold text-slate-400">
                            재무제표 기준(Net)은 실제 장부와 일치하며, 정산 기준(Gross)은 아직 매칭되지 않은 발생 전표의 합계입니다.
                        </p>
                        <p className="text-[10px] font-bold text-slate-500 italic">"재무제표 기준(Net) vs 정산 기준(Gross) 차이 존재 가능"</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl min-h-[450px]">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                                <BarChart3 size={20} />
                            </div>
                            <h3 className="text-lg font-black text-white tracking-tight italic">
                                {viewMode === 'RECEIVABLES' ? 'Aging Report (미결제 연령 분석)' :
                                 viewMode === 'PAYABLES' ? 'Aging Report (미지급 연령 분석)' : 'Suspense Aging (미정산 기간 분석)'}
                            </h3>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={viewMetrics.agingData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 900, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={v => `₩${(v/10000).toLocaleString()}만`} />
                                <RechartsTooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#1e293b', 
                                        border: '1px solid rgba(255,255,255,0.1)', 
                                        borderRadius: '12px', 
                                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' 
                                    }}
                                    itemStyle={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}
                                    labelStyle={{ color: '#ffffff', fontSize: '13px', fontWeight: 'black', marginBottom: '4px' }}
                                    cursor={{ fill: '#ffffff05' }}
                                    formatter={(v: any) => [`₩${v.toLocaleString()}`, '금액']}
                                />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                                    {viewMetrics.agingData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-rose-500/20 bg-gradient-to-br from-[#151D2E] to-[#1a1214] shadow-2xl relative overflow-hidden group">
                        <div className="relative z-10 text-center">
                            <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-rose-500/30">
                                <ShieldAlert size={32} className="text-rose-500 animate-pulse" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-3 tracking-tight">
                                {viewMode === 'RECEIVABLES' ? '기한 관리 경보' : viewMode === 'PAYABLES' ? '지불 이행 경보' : '정산 기한 경보'}
                            </h3>
                            <p className="text-sm text-slate-400 mb-8 font-bold leading-relaxed">
                                <span className="text-rose-400">{viewMetrics.overdueCount}건</span>의 항목이 {viewMode === 'PAYABLES' ? '지불' : '정산'} 기한을 넘겼습니다. 즉각적인 조치가 필요합니다.
                            </p>
                            <button className={`w-full py-4 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl border flex items-center justify-center gap-3 ${
                                viewMode === 'RECEIVABLES' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20 border-rose-400/30' : 
                                'bg-slate-700 hover:bg-slate-600 shadow-slate-900/40 border-slate-500/30'
                            }`}>
                                <Mail size={16} /> {viewMode === 'RECEIVABLES' ? '전체 독촉 이메일 발송' : '담당자 알림 발송'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6 bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-white italic tracking-tight">
                        {viewMode === 'RECEIVABLES' ? '미결제 상세 리스트' : viewMode === 'PAYABLES' ? '미지급 상세 리스트' : '가계정 정산 상세 내역'}
                    </h3>
                    <div className="flex gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-indigo-500/50 w-64" placeholder="거래처/내용 검색..." />
                        </div>
                        <button className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all"><Filter size={18} /></button>
                        <button 
                            onClick={handleSettleAll}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all ${
                            viewMode === 'RECEIVABLES' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30 hover:bg-emerald-600/40' : 
                            'bg-indigo-600/20 text-indigo-400 border-indigo-600/30 hover:bg-indigo-600/40'
                        }`}>
                             <CheckCircle2 size={12} /> {viewMode === 'RECEIVABLES' ? '전체 수금 승인' : viewMode === 'PAYABLES' ? '전체 지급 승인' : '일괄 정산 처리'}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
                                <th className="px-6 py-4">{viewMode === 'SUSPENSE' ? '구분' : '상태'}</th>
                                <th className="px-6 py-4">날짜 / 기한</th>
                                <th className="px-6 py-4">{viewMode === 'RECEIVABLES' ? '거래처' : viewMode === 'PAYABLES' ? '공급처' : '계정항목'} / 적요</th>
                                <th className="px-6 py-4">금액 (KRW)</th>
                                <th className="px-6 py-4">{viewMode === 'SUSPENSE' ? '경과일' : 'D-DAY'}</th>
                                <th className="px-6 py-4">조치 (ACTION)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {currentEntries
                                .filter(e => {
                                     const isAutoMatched = e.referenceId && viewMetrics.autoMatchedRefs.has(e.referenceId);
                                     if (settledIds.has(e.id) || isAutoMatched) return false;
                                     if (viewMode === 'RECEIVABLES') return !e.creditAccount.includes('외상매출');
                                     if (viewMode === 'PAYABLES') return !e.debitAccount.includes('외상매입') && !e.debitAccount.includes('미지급');
                                     return true;
                                 })
                                .filter(e => new Date(e.date) <= new Date(selectedDate))
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((e, idx) => {
                                const diffDays = Math.floor((new Date(selectedDate).getTime() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24));
                                const isOverdue = diffDays > 30;
                                
                                return (
                                    <tr key={idx} className="group hover:bg-white/[0.05] transition-colors">
                                        <td className="px-6 py-6">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black border ${isOverdue ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                                {viewMode === 'SUSPENSE' ? (e.debitAccount || e.creditAccount).split(' ')[0] : (isOverdue ? '기한도과' : '정상')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 font-mono">
                                            <p className="text-sm font-black text-white tracking-widest">{e.date}</p>
                                            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">ENTRY: {e.id}</p>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400">
                                                    <Calculator size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-200">{e.vendor || '내부 정산항목'}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">{e.description}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 font-black text-lg text-white font-mono">
                                            ₩{e.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-6 font-mono">
                                            <span className={`text-[11px] font-black p-1 rounded ${isOverdue ? 'text-rose-400 bg-rose-500/5' : 'text-slate-500'}`}>
                                                {isOverdue ? `${diffDays}일 경과` : `D-${Math.max(0, 30-diffDays)}`}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6">
                                            <button 
                                                onClick={() => handleSettle(e)}
                                                className="flex items-center gap-2 px-6 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-600/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                            >
                                                <DollarSign size={12} /> {viewMode === 'RECEIVABLES' ? '수금 처리' : viewMode === 'PAYABLES' ? '지급 처리' : '정산 처리'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
