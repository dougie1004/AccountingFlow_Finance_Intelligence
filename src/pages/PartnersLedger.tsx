import React, { useState, useMemo } from 'react';
import { useAccounting } from '../hooks/useAccounting';
import { FileText, Search, Calendar, ChevronDown, ArrowUpDown, ChevronUp, Users, Building2 } from 'lucide-react';

const PartnersLedger: React.FC = () => {
    const { accountingLedger, allLinesLedger, partners, selectedDate } = useAccounting();

    // Filtering state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    React.useEffect(() => {
        if (!startDate && !endDate && selectedDate) {
            const d = new Date(selectedDate);
            const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            setStartDate(start);
            setEndDate(end);
        }
    }, [selectedDate, startDate, endDate]);
    const [selectedPartner, setSelectedPartner] = useState('전체 거래처');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'all' | 'subledger'>('subledger');
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'vendor' | 'amount'; direction: 'asc' | 'desc' }>({
        key: 'date',
        direction: 'desc'
    });

    // [STRICT] Selection determines source (Approved vs All)
    const activeData = useMemo(() => {
        return viewMode === 'subledger' ? accountingLedger : allLinesLedger;
    }, [viewMode, accountingLedger, allLinesLedger]);

    const activePartners = useMemo(() => {
        const ps = new Set<string>();
        activeData.forEach(e => {
            if ((e as any).vendor && (e as any).vendor !== '-') {
                ps.add((e as any).vendor);
            }
        });
        return Array.from(ps).sort();
    }, [activeData]);

    const processedData = useMemo(() => {
        const rows = activeData.map((line, idx) => {
            return {
                id: `${line.id}-${idx}`,
                date: line.date,
                vendor: (line as any).vendor || '-', 
                description: line.description,
                account: line.account,
                amount: line.debit || line.credit,
                isDebit: line.debit > 0,
                ocrData: (line as any).ocrData
            };
        });

        const filtered = rows.filter(row => {
            // Partner filter
            const matchesPartner = selectedPartner === '전체 거래처' || row.vendor === selectedPartner;

            // Search filter
            const matchesSearch = !searchTerm ||
                row.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.account.toLowerCase().includes(searchTerm.toLowerCase());

            // Date range filter
            const matchesDate = (!startDate || row.date >= startDate) &&
                (!endDate || row.date <= endDate);

            // [STRICT] Partner Ledger only shows rows with vendors
            const hasVendor = row.vendor !== '-' && row.vendor !== '';

            return matchesPartner && matchesSearch && matchesDate && hasVendor;
        });

        // Sorting
        return [...filtered].sort((a, b) => {
            const { key, direction } = sortConfig;
            let comparison = 0;

            if (key === 'amount') {
                comparison = a.amount - b.amount;
            } else {
                const valA = (a[key as keyof typeof a] || '').toString().toLowerCase();
                const valB = (b[key as keyof typeof b] || '').toString().toLowerCase();
                comparison = valA.localeCompare(valB);
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }, [activeData, selectedPartner, searchTerm, startDate, endDate, sortConfig]);

    const handleSort = (key: 'date' | 'vendor' | 'amount') => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Calculate Balance for Selected Partner
    const balanceStats = useMemo(() => {
        if (selectedPartner === '전체 거래처') return null;

        let totalInflow = 0; // Receipts from Customer or Payments back to Vendor
        let totalOutflow = 0; // Payments to Vendor or Receipts back from Customer (Returns)
        
        processedData.forEach(row => {
            // This is a simplified view of AP/AR
            // If it's Debit '외상매출금' -> AR Increase (Outflow of credit?)
            // If it's Credit '외상매입금' -> AP Increase
            
            // For now, let's just show basic Total Transaction Amount
            if (row.isDebit) totalInflow += row.amount;
            else totalOutflow += row.amount;
        });

        return { totalInflow, totalOutflow, balance: Math.abs(totalInflow - totalOutflow) };
    }, [processedData, selectedPartner]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">거래처별 원장 (Entity Ledger)</h1>
                    <p className="text-slate-400 font-bold">특정 거래처와의 모든 거래 내역과 미결제 잔액을 관리합니다.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex gap-2 p-1.5 bg-[#151D2E]/50 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setViewMode('subledger')}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'subledger' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            Sub-ledger (승인됨)
                        </button>
                        <button
                            onClick={() => setViewMode('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'all' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            All Logs (미승인 포함)
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-[#151D2E] p-2 rounded-2xl border border-white/5 shadow-inner">
                        <Calendar size={18} className="text-slate-500 ml-2" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-white outline-none focus:ring-0"
                        />
                        <span className="text-slate-700">~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-white outline-none focus:ring-0 mr-2"
                        />
                    </div>
                </div>
            </div>

            {/* Filter & Summary Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#151D2E] p-6 rounded-[2rem] border border-white/5 shadow-2xl space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="적요 또는 계정 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-[#0B1221] border border-white/5 rounded-2xl text-sm font-bold text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all shadow-inner placeholder:text-slate-600"
                            />
                        </div>

                        <div className="relative w-full md:w-64">
                            <select
                                value={selectedPartner}
                                onChange={(e) => setSelectedPartner(e.target.value)}
                                className="w-full pl-4 pr-10 py-3 bg-[#0B1221] border border-white/5 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 appearance-none cursor-pointer shadow-inner"
                            >
                                <option>전체 거래처</option>
                                {activePartners.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>

                {balanceStats && (
                    <div className="bg-[#151D2E] p-6 rounded-[2rem] border border-white/5 shadow-2xl text-white flex flex-col justify-center gap-1 group overflow-hidden relative">
                         <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                            <Building2 size={80} className="text-indigo-400" />
                        </div>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest relative z-10">{selectedPartner} 누적 정산액</p>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <h3 className="text-3xl font-black">₩{balanceStats.balance.toLocaleString()}</h3>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Active Balance</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-[10px] font-black text-slate-500 relative z-10">
                            <span>입금/차변: ₩{balanceStats.totalInflow.toLocaleString()}</span>
                            <span>출금/대변: ₩{balanceStats.totalOutflow.toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Data Table */}
            <div className="bg-[#151D2E] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden p-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-white/[0.02]">
                                <th
                                    className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 cursor-pointer hover:text-indigo-400 transition-colors"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-2">
                                        일자
                                        {sortConfig.key === 'date' ? (
                                            sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-indigo-400" /> : <ChevronDown size={12} className="text-indigo-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="text-slate-600" />
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 cursor-pointer hover:text-indigo-400 transition-colors"
                                    onClick={() => handleSort('vendor')}
                                >
                                    <div className="flex items-center gap-2">
                                        거래처 (Entity)
                                        {sortConfig.key === 'vendor' ? (
                                            sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-indigo-400" /> : <ChevronDown size={12} className="text-indigo-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="text-slate-600" />
                                        )}
                                    </div>
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">적요 / 추론</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">계정 구분</th>
                                <th
                                    className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 text-right cursor-pointer hover:text-indigo-400 transition-colors"
                                    onClick={() => handleSort('amount')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        금액
                                        {sortConfig.key === 'amount' ? (
                                            sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-indigo-400" /> : <ChevronDown size={12} className="text-indigo-400" />
                                        ) : (
                                            <ArrowUpDown size={12} className="text-slate-600" />
                                        )}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {processedData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <Users className="mx-auto text-slate-700 mb-4" size={48} />
                                        <div className="text-slate-500 font-black text-lg mb-2">조회된 거래처 내역이 없습니다.</div>
                                        <p className="text-slate-600 text-sm font-bold">필터 조건을 변경하거나 거래처 명칭이 기록된 전표가 있는지 확인해 보세요.</p>
                                    </td>
                                </tr>
                            ) : (
                                processedData.map((row) => (
                                    <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-6 text-xs font-bold text-slate-400 font-mono">{row.date}</td>
                                        <td className="px-8 py-6">
                                            <span className="font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{row.vendor}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-sm font-bold text-slate-300">"{row.description}"</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${row.isDebit
                                                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                    }`}>
                                                    {row.isDebit ? 'Debit' : 'Credit'}
                                                </span>
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                                    {row.account}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-sm font-black text-white text-right font-mono">
                                            ₩{row.amount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PartnersLedger;
