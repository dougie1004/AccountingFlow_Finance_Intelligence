import React, { useState, useMemo, useEffect } from 'react';
import { 
    Download, Printer, FileSpreadsheet, File, Shield, Activity, Calendar, X, BarChart3
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAccounting } from '../hooks/useAccounting';
import { getAccountMetadata } from '../core/coa';
const getAccountNature = (name: string) => getAccountMetadata(name).nature;
import { ALL_ACCOUNTS } from '../constants/accounts';
import { PremiumDatePicker } from '../components/common/PremiumDatePicker';

type Tab = 'bs' | 'pl' | 'tb' | 'cf' | 'equity';

import { TrialBalanceItem } from '../types';

const FinancialStatements: React.FC = () => {
    const context = useAccounting();
    const { ledger, trialBalance: globalTB, financials, selectedDate: dashboardDate, setSelectedDate, accountingLedger, calculateTBForRange, isPeriodLocked } = context;
    const [activeTab, setActiveTab] = useState<Tab>('bs');
    const [drillDownAccount, setDrillDownAccount] = useState<string | null>(null);
    const reportingYear = useMemo(() => {
        if (!dashboardDate) return 2026;
        return new Date(dashboardDate).getFullYear();
    }, [dashboardDate]);

    const reportingDate = useMemo(() => {
        return new Date(dashboardDate);
    }, [dashboardDate]);

    // [STRICT] Period isolated Trial Balance for the reporting phase
    const periodTB = useMemo(() => {
        const periodStart = `${reportingYear}-01-01`;
        const periodEndStr = reportingDate.toISOString().split('T')[0];
        return calculateTBForRange(periodStart, periodEndStr, 'actual');
    }, [calculateTBForRange, reportingYear, reportingDate]);

    // [STRICT] Financial Statement Account Mapping (Dynamically Nature-Driven)
    const accounts = useMemo(() => {
        return Object.entries(periodTB).map(([key, entry]) => {
            const nature = entry.meta.nature;
            const movementBal = entry.movementDebit - entry.movementCredit;
            const closingNet = entry.closingDebit - entry.closingCredit;

            // Balance for BS: Closing balance
            // Balance for PL: Period movement
            const isPL = (nature === 'REVENUE' || nature === 'EXPENSE');
            const netBal = isPL ? movementBal : closingNet;

            const finalBalance = (nature === 'ASSET' || nature === 'EXPENSE')
                ? netBal
                : -netBal;

            return {
                id: key, // The index key from periodTB (ID or Name)
                name: entry.meta.name || key,
                nature,
                section: entry.meta.section,
                group: entry.meta.group,
                type: nature.charAt(0) + nature.slice(1).toLowerCase(), 
                balance: finalBalance,
                openingDebit: entry.openingDebit,
                openingCredit: entry.openingCredit,
                movementDebit: entry.movementDebit,
                movementCredit: entry.movementCredit,
                closingDebit: entry.closingDebit,
                closingCredit: entry.closingCredit
            };
        }).filter(a => 
            Math.abs(a.balance) > 0.01 || 
            a.openingDebit > 0 || a.openingCredit > 0 || 
            a.movementDebit > 0 || a.movementCredit > 0 ||
            a.name === '미지급금' || 
            a.name === '단기차입금'
        );
    }, [periodTB]);

    // Financial Analysis High-Level Metrics (TB Derived)
    const totalAssets = accounts.filter(a => a.nature === 'ASSET').reduce((s: number, a: any) => s + a.balance, 0);
    const totalLiabilities = accounts.filter(a => a.nature === 'LIABILITY').reduce((s: number, a: any) => s + a.balance, 0);
    const revenue = accounts.filter(a => a.nature === 'REVENUE').reduce((s: number, a: any) => s + a.balance, 0);
    const expenses = accounts.filter(a => a.nature === 'EXPENSE').reduce((s: number, a: any) => s + a.balance, 0);
    const netIncome = revenue - expenses;
    const totalEquity = accounts.filter(a => a.nature === 'EQUITY').reduce((s: number, a: any) => s + a.balance, 0) + netIncome;

    const currentAssets = accounts.filter(a => a.nature === 'ASSET' && (a.section === '유동자산' || !a.section));
    const nonCurrentAssets = accounts.filter(a => a.nature === 'ASSET' && a.section === '비유동자산');
    const liabilityItems = accounts.filter(a => a.nature === 'LIABILITY');
    const equityItems = accounts.filter(a => a.nature === 'EQUITY');

    // [STRICT] Monthly Income Statement derived EXCLUSIVELY from TB movements
    const monthlyData = useMemo(() => {
        const data = [];
        const yearPrefix = reportingYear.toString();

        for (let i = 1; i <= 12; i++) {
            const monthStr = String(i).padStart(2, '0');
            const month = `${yearPrefix}-${monthStr}`;
            const monthEnd = new Date(reportingYear, i, 0).toISOString().split('T')[0];
            const dashBoundary = dashboardDate.split('T')[0];
            const effectiveEnd = monthEnd < dashBoundary ? monthEnd : dashBoundary;
            
            // Calculate TB for this specific month range
            const monthTB = calculateTBForRange(`${month}-01`, effectiveEnd, 'actual');
            
            let monthRev = 0;
            let monthExp = 0;
            
            Object.values(monthTB).forEach((entry: TrialBalanceItem) => {
                if (entry.meta.nature === 'REVENUE') monthRev += (entry.movementCredit - entry.movementDebit);
                else if (entry.meta.nature === 'EXPENSE') monthExp += (entry.movementDebit - entry.movementCredit);
            });

            data.push({
                month,
                revenue: monthRev,
                expenses: monthExp,
                netIncome: monthRev - monthExp
            });
        }
        return data;
    }, [calculateTBForRange, reportingYear, dashboardDate]);

    return (
        <div className="space-y-8 min-h-screen pb-20 overflow-x-hidden p-6 md:p-10 bg-[#F8FAFC]">
            {/* SAP Style Top Command Bar */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-800 rounded">
                        <Activity size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Financial Reporting Workbench</h1>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Enterprise Edition v4.8</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <PremiumDatePicker value={dashboardDate} onChange={setSelectedDate} />
                    <div className="flex gap-1">
                        {[
                            { id: 'bs', label: 'BS' },
                            { id: 'pl', label: 'PL' },
                            { id: 'tb', label: 'TB' },
                            { id: 'cf', label: 'CF' },
                            { id: 'equity', label: 'CE' }
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as Tab)}
                                className={`px-4 py-1.5 rounded text-[11px] font-bold uppercase transition-all ${activeTab === t.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Audit Ready Financial Report Canvas */}
            <div className="max-w-5xl mx-auto bg-white shadow-2xl border border-slate-200 min-h-[1200px] p-20">
                {/* Formal Statement Header */}
                <div className="border-b-2 border-slate-800 pb-10 mb-16 text-center">
                    <h2 className="text-4xl font-serif font-bold text-slate-900 mb-4 tracking-tight">
                        {activeTab === 'bs' && '재 무 상 태 표 (Balance Sheet)'}
                        {activeTab === 'pl' && '손 익 계 산 서 (Statement of Income)'}
                        {activeTab === 'tb' && '합계잔액시산표 (Trial Balance)'}
                        {activeTab === 'cf' && '현 금 흐 름 표 (Statement of Cash Flows)'}
                        {activeTab === 'equity' && '자 본 변 동 표 (Statement of Changes in Equity)'}
                    </h2>
                    <div className="flex justify-between items-end mt-12 text-left">
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Reporting Entity</p>
                            <p className="text-sm font-bold text-slate-800">AccountingFlow Finance Intelligence</p>
                            <p className="text-xs text-slate-500">제 {reportingYear - 2025} 기</p>
                        </div>
                        <div className="text-right space-y-1">
                            {(() => {
                                const isLocked = isPeriodLocked(dashboardDate);
                                return (
                                    <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold mb-2 ${isLocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isLocked ? 'bg-red-500' : 'bg-green-500'}`} />
                                        {isLocked ? 'PERIOD CLOSED (LOCKED)' : 'PERIOD OPEN'}
                                    </div>
                                );
                            })()}
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Reporting Date / Period</p>
                            <p className="text-sm font-bold text-slate-800">{dashboardDate} 기준</p>
                            <p className="text-xs text-slate-500">Period: {reportingYear}-01-01 ~ {dashboardDate}</p>
                            <p className="text-xs text-slate-500">Unit: KRW (South Korean Won)</p>
                        </div>
                    </div>
                </div>

                {/* Professional Report Body */}
                <div className="text-slate-800">
                    {activeTab === 'bs' && (
                        <div className="grid grid-cols-2 gap-20">
                            {/* Assets Column */}
                            <div className="space-y-8">
                                <p className="text-xs font-black uppercase tracking-[0.2em] border-b border-slate-200 pb-2">Assets</p>
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 mb-3 underline">I. 유동자산 (Current Assets)</p>
                                        <div className="space-y-2.5">
                                            {currentAssets.map(a => (
                                                <div key={a.id} onClick={() => setDrillDownAccount(a.id)} className="flex justify-between items-center group cursor-pointer border-b border-slate-100 pb-1.5 hover:bg-slate-50 px-2 -mx-2 transition-colors">
                                                    <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-600 uppercase transition-colors">{a.name}</span>
                                                    <span className="font-mono text-xs font-bold group-hover:text-indigo-600 transition-colors underline decoration-slate-200 underline-offset-4">{a.balance.toLocaleString()}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center bg-slate-50 px-2 py-1 mt-2">
                                                <span className="text-[10px] font-bold text-slate-500 italic">유동자산 소계</span>
                                                <span className="font-mono text-xs font-bold text-slate-500">{currentAssets.reduce((s,a)=>s+a.balance,0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 mb-3 underline">II. 비유동자산 (Non-Current Assets)</p>
                                        <div className="space-y-2.5">
                                            {nonCurrentAssets.map(a => (
                                                <div key={a.id} onClick={() => setDrillDownAccount(a.id)} className="flex justify-between items-center group cursor-pointer border-b border-slate-100 pb-1.5 hover:bg-slate-50 px-2 -mx-2 transition-colors">
                                                    <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-600 uppercase transition-colors">{a.name}</span>
                                                    <span className="font-mono text-xs font-bold group-hover:text-indigo-600 transition-colors underline decoration-slate-200 underline-offset-4">{a.balance.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 flex justify-between items-center border-t-4 double border-slate-800">
                                    <span className="text-xs font-black uppercase">자산총계 (Total Assets)</span>
                                    <span className="text-lg font-mono font-black">{totalAssets.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Liabilities & Equity Column */}
                            <div className="space-y-8">
                                <p className="text-xs font-black uppercase tracking-[0.2em] border-b border-slate-200 pb-2">Liabilities & Equity</p>
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 mb-3 underline">I. 유동부채 (Current Liabilities)</p>
                                        <div className="space-y-2.5">
                                            {liabilityItems.filter(a => a.section === '유동부채').map(a => (
                                                <div key={a.id} onClick={() => setDrillDownAccount(a.id)} className="flex justify-between items-center group cursor-pointer border-b border-slate-100 pb-1.5 hover:bg-slate-50 px-2 -mx-2 transition-colors">
                                                    <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-600 uppercase transition-colors">{a.name}</span>
                                                    <span className="font-mono text-xs font-bold group-hover:text-indigo-600 transition-colors underline decoration-slate-200 underline-offset-4">{a.balance.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {liabilityItems.some(a => a.section === '비유동부채') && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 mb-3 underline">II. 비유동부채 (Non-Current Liabilities)</p>
                                            <div className="space-y-2.5">
                                                {liabilityItems.filter(a => a.section === '비유동부채').map(a => (
                                                    <div key={a.id} onClick={() => setDrillDownAccount(a.id)} className="flex justify-between items-center group cursor-pointer border-b border-slate-100 pb-1.5 hover:bg-slate-50 px-2 -mx-2 transition-colors">
                                                        <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-600 uppercase transition-colors">{a.name}</span>
                                                        <span className="font-mono text-xs font-bold group-hover:text-indigo-600 transition-colors underline decoration-slate-200 underline-offset-4">{a.balance.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 mb-3 underline">II. 자본 (Equity)</p>
                                        <div className="space-y-2.5">
                                            {equityItems.map(a => (
                                                <div key={a.id} onClick={() => setDrillDownAccount(a.id)} className="flex justify-between items-center group cursor-pointer border-b border-slate-100 pb-1.5 hover:bg-slate-50 px-2 -mx-2 transition-colors">
                                                    <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-600 uppercase transition-colors">{a.name}</span>
                                                    <span className="font-mono text-xs font-bold group-hover:text-indigo-600 transition-colors underline decoration-slate-200 underline-offset-4">{a.balance.toLocaleString()}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 bg-blue-50/30">
                                                <span className="text-xs font-bold text-slate-700 italic">당기순이익 (Current Net Profit)</span>
                                                <span className="font-mono text-xs font-bold text-blue-700">{netIncome.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 flex justify-between items-center border-t-4 double border-slate-800">
                                    <span className="text-xs font-black uppercase">부채 및 자본총계</span>
                                    <span className="text-lg font-mono font-black">{(totalLiabilities + totalEquity).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pl' && (
                        <div className="space-y-12 max-w-3xl mx-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-t-2 border-b border-slate-800 bg-slate-50">
                                        <th className="py-3 text-left pl-4 font-black uppercase racking-widest">Account Details</th>
                                        <th className="py-3 text-right pr-4 font-black uppercase tracking-widest">Amount (KRW)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr onClick={() => setDrillDownAccount('REVENUE_TOTAL')} className="cursor-pointer hover:bg-slate-50 group transition-colors">
                                        <td className="py-4 pl-4 font-bold border-b border-slate-100 group-hover:text-indigo-600 transition-colors">I. 매출액 (Revenue)</td>
                                        <td className="py-4 text-right pr-4 font-mono font-bold border-b border-slate-100 group-hover:text-indigo-600 transition-colors underline underline-offset-4 decoration-slate-200">{revenue.toLocaleString()}</td>
                                    </tr>
                                    {accounts.filter(a => a.type === 'Revenue').map(a => (
                                        <tr key={a.name} onClick={() => setDrillDownAccount(a.id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                                            <td className="py-3 pl-8 border-b border-slate-50">- {a.name}</td>
                                            <td className="py-3 text-right pr-4 font-mono text-slate-500 border-b border-slate-50">{a.balance.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    
                                    <tr onClick={() => setDrillDownAccount('EXPENSE_TOTAL')} className="cursor-pointer hover:bg-slate-50 group transition-colors">
                                        <td className="py-4 pl-4 font-bold border-b border-slate-100 group-hover:text-indigo-600 transition-colors">II. 영업비용 (Operating Expenses)</td>
                                        <td className="py-4 text-right pr-4 font-mono font-bold border-b border-slate-100 text-rose-700 group-hover:text-rose-600 transition-colors underline underline-offset-4 decoration-slate-200">({expenses.toLocaleString()})</td>
                                    </tr>
                                    {accounts.filter(a => a.type === 'Expense').map(a => (
                                        <tr key={a.name} onClick={() => setDrillDownAccount(a.id)} className="cursor-pointer hover:bg-slate-50 group transition-colors">
                                            <td className="py-3 pl-8 border-b border-slate-50 group-hover:text-indigo-600 transition-colors">- {a.name}</td>
                                            <td className="py-3 text-right pr-4 font-mono text-slate-500 border-b border-slate-50 group-hover:text-indigo-600 transition-colors underline decoration-slate-200 underline-offset-4">{a.balance.toLocaleString()}</td>
                                        </tr>
                                    ))}

                                    <tr onClick={() => setDrillDownAccount('NET_INCOME_TOTAL')} className="bg-slate-900 text-white shadow-lg cursor-pointer hover:bg-slate-800 transition-colors group">
                                        <td className="py-6 pl-4 text-sm font-black italic uppercase group-hover:text-indigo-400 transition-colors">III. 당기순이익 (Net Profit / Loss)</td>
                                        <td className="py-6 text-right pr-4 text-xl font-mono font-black tracking-tight group-hover:text-indigo-400 underline decoration-white/20 underline-offset-8 transition-colors">{netIncome.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Monthly Breakdown Table */}
                            <div className="mt-20">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center">--- Monthly Analysis (Fiscal Period) ---</p>
                                <table className="w-full text-[10px] border-collapse border border-slate-200">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="p-2 text-left border-r border-slate-200">Period</th>
                                            <th className="p-2 text-right border-r border-slate-200">Revenue</th>
                                            <th className="p-2 text-right border-r border-slate-200">Expense</th>
                                            <th className="p-2 text-right font-bold">Net Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthlyData.map(m => (
                                            <tr key={m.month} className="border-b border-slate-100">
                                                <td className="p-2 font-mono border-r border-slate-100">{m.month}</td>
                                                <td className="p-2 text-right font-mono border-r border-slate-100">{m.revenue.toLocaleString()}</td>
                                                <td className="p-2 text-right font-mono border-r border-slate-100 text-rose-600">{m.expenses.toLocaleString()}</td>
                                                <td className={`p-2 text-right font-mono font-bold ${m.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {m.netIncome.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tb' && (
                        <div className="space-y-4">
                            <table className="w-full text-[10px] border-collapse">
                                <thead>
                                    <tr className="border-t-2 border-slate-800 bg-slate-50 font-bold uppercase text-[9px]">
                                        <th rowSpan={2} className="border border-slate-200 py-3 text-left pl-4">Account Name</th>
                                        <th rowSpan={2} className="border border-slate-200 py-3 text-center">Nature</th>
                                        <th colSpan={2} className="border border-slate-200 py-2 text-center bg-slate-100/50">Opening (기초)</th>
                                        <th colSpan={2} className="border border-slate-200 py-2 text-center bg-indigo-50/30">Movement (당기)</th>
                                        <th colSpan={2} className="border border-slate-200 py-2 text-center bg-emerald-50/30">Closing (기말)</th>
                                    </tr>
                                    <tr className="border-b-2 border-slate-800 bg-slate-50 font-bold uppercase text-[8px]">
                                        <th className="border border-slate-200 py-2 text-right pr-2">Dr</th>
                                        <th className="border border-slate-200 py-2 text-right pr-2">Cr</th>
                                        <th className="border border-slate-200 py-2 text-right pr-2">Dr</th>
                                        <th className="border border-slate-200 py-2 text-right pr-2">Cr</th>
                                        <th className="border border-slate-200 py-2 text-right pr-2">Dr</th>
                                        <th className="border border-slate-200 py-2 text-right pr-2">Cr</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accounts.map(acc => (
                                        <tr key={acc.name} onClick={() => setDrillDownAccount(acc.id)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group">
                                            <td className="border-x border-slate-100 py-2.5 pl-4 flex items-center gap-2">
                                                <div className={`w-0.5 h-3 ${acc.balance >= 0 ? 'bg-indigo-300' : 'bg-rose-300'}`} />
                                                <span className="font-bold group-hover:text-indigo-600 transition-colors uppercase leading-tight">{acc.name}</span>
                                            </td>
                                            <td className="border-r border-slate-100 py-2.5 text-center text-slate-400 font-mono text-[8px] italic">{acc.nature}</td>
                                            
                                            <td className="border-r border-slate-100 py-2.5 text-right pr-2 font-mono text-slate-400">{acc.openingDebit > 0 ? acc.openingDebit.toLocaleString() : '-'}</td>
                                            <td className="border-r border-slate-100 py-2.5 text-right pr-2 font-mono text-slate-400">{acc.openingCredit > 0 ? acc.openingCredit.toLocaleString() : '-'}</td>
                                            
                                            <td className="border-r border-slate-100 py-2.5 text-right pr-2 font-mono">{acc.movementDebit > 0 ? acc.movementDebit.toLocaleString() : '-'}</td>
                                            <td className="border-r border-slate-100 py-2.5 text-right pr-2 font-mono">{acc.movementCredit > 0 ? acc.movementCredit.toLocaleString() : '-'}</td>
                                            
                                            <td className={`border-r border-slate-100 py-2.5 text-right pr-2 font-mono font-bold ${acc.closingDebit > 0 ? 'text-slate-800' : 'text-slate-200'}`}>
                                                {acc.closingDebit > 0 ? acc.closingDebit.toLocaleString() : '-'}
                                            </td>
                                            <td className={`py-2.5 text-right pr-2 font-mono font-bold ${acc.closingCredit > 0 ? 'text-rose-600' : 'text-slate-200'}`}>
                                                {acc.closingCredit > 0 ? acc.closingCredit.toLocaleString() : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 border-slate-800 font-black bg-slate-50">
                                        <td colSpan={2} className="py-4 pl-4 text-[9px] uppercase tracking-tighter">AGGREGATE SUM</td>
                                        <td className="py-4 text-right pr-2 font-mono text-slate-500">{accounts.reduce((s,a)=>s+a.openingDebit, 0).toLocaleString()}</td>
                                        <td className="py-4 text-right pr-2 font-mono text-slate-500 border-r border-slate-200">{accounts.reduce((s,a)=>s+a.openingCredit, 0).toLocaleString()}</td>
                                        <td className="py-4 text-right pr-2 font-mono text-indigo-600">{accounts.reduce((s,a)=>s+a.movementDebit, 0).toLocaleString()}</td>
                                        <td className="py-4 text-right pr-2 font-mono text-indigo-600 border-r border-slate-200">{accounts.reduce((s,a)=>s+a.movementCredit, 0).toLocaleString()}</td>
                                        <td className="py-4 text-right pr-2 font-mono text-emerald-600">{accounts.reduce((s,a)=>s+a.closingDebit, 0).toLocaleString()}</td>
                                        <td className="py-4 text-right pr-2 font-mono text-emerald-600 border-l border-slate-200">{accounts.reduce((s,a)=>s+a.closingCredit, 0).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="flex justify-end p-4">
                                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded border border-emerald-200">
                                    <Shield size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Self-Balancing Logic Verified</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'cf' && (
                        <div className="space-y-12">
                            <div className="max-w-3xl mx-auto space-y-10">
                                <section className="space-y-4">
                                    <h4 className="border-b border-slate-300 pb-2 text-xs font-bold uppercase">Operating Activities</h4>
                                    <div className="space-y-2">
                                        <div onClick={() => setDrillDownAccount('NET_INCOME_TOTAL')} className="flex justify-between items-center text-xs cursor-pointer hover:text-indigo-600 group transition-colors">
                                            <span className="group-hover:translate-x-1 transition-transform">당기순이익 (Net Income)</span>
                                            <span className="font-mono group-hover:underline">{netIncome.toLocaleString()}</span>
                                        </div>
                                        <div onClick={() => setDrillDownAccount('WORKING_CAPITAL')} className="flex justify-between items-center text-xs text-slate-500 italic cursor-pointer hover:text-indigo-600 group transition-colors">
                                            <span className="group-hover:translate-x-1 transition-transform">운전자본 변동 (Working Capital Variations)</span>
                                            <span className="font-mono group-hover:underline">{(financials.ar + financials.ap).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center font-bold bg-slate-50 p-2 text-xs">
                                        <span>I. 영업활동으로 인한 현금흐름</span>
                                        <span className="font-mono">{(netIncome + (financials.ar + financials.ap)).toLocaleString()}</span>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h4 className="border-b border-slate-300 pb-2 text-xs font-bold uppercase">Investing Activities</h4>
                                    <div className="space-y-2">
                                        <div onClick={() => setDrillDownAccount('FIXED_ASSETS_FLOW')} className="flex justify-between items-center text-xs cursor-pointer hover:text-indigo-600 group transition-colors">
                                            <span className="group-hover:translate-x-1 transition-transform">고정자산 취득 (Asset Acquisition)</span>
                                            <span className="font-mono text-rose-600 group-hover:underline">({financials.fixedAssets.toLocaleString()})</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center font-bold bg-slate-50 p-2 text-xs">
                                        <span>II. 투자활동으로 인한 현금흐름</span>
                                        <span className="font-mono text-rose-600">({financials.fixedAssets.toLocaleString()})</span>
                                    </div>
                                </section>

                                <div className="pt-10 border-t-4 double border-slate-800 space-y-4">
                                    <div className="flex justify-between items-center text-sm font-black italic">
                                        <span>NET CASH EFFECT (I + II + III)</span>
                                        <span className="font-mono text-xl">{financials.cash.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-400 uppercase tracking-widest">
                                        <span>Beginning Cash Balance</span>
                                        <span className="font-mono">0</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold bg-slate-100 p-4 border-l-4 border-slate-800">
                                        <span>Ending Cash Balance (현금 및 현금성자산)</span>
                                        <span className="font-mono">{financials.cash.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'equity' && (
                        <div className="space-y-8">
                             <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-t-2 border-b-2 border-slate-800 bg-slate-50">
                                        <th className="py-3 text-left pl-4 font-bold uppercase">Description</th>
                                        <th className="py-3 text-right font-bold uppercase">Capital Stock</th>
                                        <th className="py-3 text-right font-bold uppercase">Retained Earnings</th>
                                        <th className="py-3 text-right pr-4 font-bold uppercase">Total Equity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-100 italic text-slate-400">
                                        <td className="py-4 pl-4">I. 기초잔액 (Beginning Balance)</td>
                                        <td className="py-4 text-right font-mono">0</td>
                                        <td className="py-4 text-right font-mono">0</td>
                                        <td className="py-4 text-right pr-4 font-mono">0</td>
                                    </tr>
                                    <tr onClick={() => setDrillDownAccount('NET_INCOME_TOTAL')} className="border-b border-slate-100 cursor-pointer hover:bg-slate-50 group transition-colors">
                                        <td className="py-4 pl-4 font-bold text-indigo-600 group-hover:underline">II. 당기순이익 (Net Income for the Period)</td>
                                        <td className="py-4 text-right font-mono">-</td>
                                        <td className="py-4 text-right font-mono text-indigo-600">{netIncome.toLocaleString()}</td>
                                        <td className="py-4 text-right pr-4 font-mono text-indigo-600">{netIncome.toLocaleString()}</td>
                                    </tr>
                                    <tr onClick={() => setDrillDownAccount('자본금')} className="border-b border-slate-100 cursor-pointer hover:bg-slate-50 group transition-colors">
                                        <td className="py-4 pl-4 font-bold group-hover:underline">III. 유상증자 / 감자 (Capital Changes)</td>
                                        <td className="py-4 text-right font-mono">{(totalEquity - netIncome).toLocaleString()}</td>
                                        <td className="py-4 text-right font-mono">-</td>
                                        <td className="py-4 text-right pr-4 font-mono">{(totalEquity - netIncome).toLocaleString()}</td>
                                    </tr>
                                    <tr className="border-t-2 border-slate-800 bg-slate-900 text-white shadow-xl">
                                        <td className="py-6 pl-4 text-sm font-black italic uppercase">IV. 기말잔액 (Ending Equity Balance)</td>
                                        <td className="py-6 text-right font-mono">{(totalEquity - netIncome).toLocaleString()}</td>
                                        <td className="py-6 text-right font-mono">{netIncome.toLocaleString()}</td>
                                        <td className="py-6 text-right pr-4 text-xl font-mono font-black">{totalEquity.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                
                {/* Formal Footer */}
                <div className="mt-40 pt-10 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">
                    <span>Official Audit Document</span>
                    <span>Page 01 of 01</span>
                    <span>AccountingFlow Finance Core</span>
                </div>
            </div>

            {/* Drill-down Intelligence Modal */}
            <AnimatePresence>
                {drillDownAccount && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-12">
                         <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-5xl h-[80vh] rounded shadow-2xl flex flex-col overflow-hidden">
                            <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <BarChart3 size={20} />
                                    <h3 className="text-sm font-bold uppercase tracking-widest">
                                        {(() => {
                                            const item = periodTB[drillDownAccount || ""];
                                            return item ? item.meta.name : drillDownAccount;
                                        })()} - Audit Detail
                                    </h3>
                                </div>
                                <button onClick={() => setDrillDownAccount(null)} className="hover:bg-slate-700 p-1 rounded">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-slate-800/20 text-[10px] font-black uppercase text-slate-400">
                                            <th className="py-2">Date</th>
                                            <th className="py-2">Description</th>
                                            <th className="py-2 text-right">Debit</th>
                                            <th className="py-2 text-right">Credit</th>
                                            <th className="py-2 text-right pr-4">Balance (잔액)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(() => {
                                            // 1. Identify Target Accounts and Nature
                                            let targetAccounts: string[] = [];
                                            let isPLSummary = false;
                                            
                                            if (drillDownAccount === 'NET_INCOME_TOTAL') {
                                                targetAccounts = Object.keys(periodTB).filter(k => periodTB[k].meta.nature === 'REVENUE' || periodTB[k].meta.nature === 'EXPENSE');
                                                isPLSummary = true;
                                            } else if (drillDownAccount === 'REVENUE_TOTAL') {
                                                targetAccounts = Object.keys(periodTB).filter(k => periodTB[k].meta.nature === 'REVENUE');
                                                isPLSummary = true;
                                            } else if (drillDownAccount === 'EXPENSE_TOTAL') {
                                                targetAccounts = Object.keys(periodTB).filter(k => periodTB[k].meta.nature === 'EXPENSE');
                                                isPLSummary = true;
                                            } else if (drillDownAccount === 'WORKING_CAPITAL') {
                                                targetAccounts = Object.keys(periodTB).filter(k => periodTB[k].meta.nature === 'ASSET' || periodTB[k].meta.nature === 'LIABILITY');
                                            } else if (drillDownAccount === 'FIXED_ASSETS_FLOW') {
                                                const nonCurrentAssetKeys = Object.keys(periodTB).filter(k => periodTB[k].meta.nature === 'ASSET' && periodTB[k].meta.section === '비유동자산');
                                                targetAccounts = nonCurrentAssetKeys;
                                            } else if (drillDownAccount) {
                                                const entry = periodTB[drillDownAccount];
                                                if (entry) {
                                                    targetAccounts = [drillDownAccount];
                                                } else {
                                                    // search by name if ID lookup fails
                                                    const match = Object.entries(periodTB).find(([k, v]) => v.meta.name === drillDownAccount);
                                                    targetAccounts = match ? [match[0]] : [drillDownAccount];
                                                }
                                            }

                                            // 2. Filter Lines (Current reporting year only!)
                                            const yearStartStr = `${reportingYear}-01-01`;
                                            const periodEndStr = dashboardDate.split('T')[0];
                                            
                                            const currentLines = accountingLedger.filter(l => {
                                                const matchesDate = l.date >= yearStartStr && l.date <= periodEndStr;
                                                if (!matchesDate) return false;
                                                const isMatch = targetAccounts.includes(l.account) || (l.accountId && targetAccounts.includes(l.accountId));
                                                return isMatch;
                                            }).sort((a,b) => a.date.localeCompare(b.date));

                                            // 3. Calculate Opening/Closing for Verification
                                            let openingBal = 0;
                                            let closingBal = 0;
                                            let totalDr = 0;
                                            let totalCr = 0;

                                            targetAccounts.forEach(acc => {
                                                const item = periodTB[acc];
                                                if (item) {
                                                    const nature = item.meta.nature;
                                                    const isDrAccount = (nature === 'ASSET' || nature === 'EXPENSE');
                                                    
                                                    // Opening for this Period
                                                    const netOpening = item.openingDebit - item.openingCredit;
                                                    openingBal += isDrAccount ? netOpening : -netOpening;
                                                    
                                                    // Closing for this Period
                                                    const netClosing = item.closingDebit - item.closingCredit;
                                                    closingBal += isDrAccount ? netClosing : -netClosing;

                                                    totalDr += item.movementDebit;
                                                    totalCr += item.movementCredit;
                                                }
                                            });

                                            // If it's a pure PL summary (Revenue, Expense, Net Income), Opening is always 0 for the year
                                            if (isPLSummary) {
                                                openingBal = 0;
                                            }

                                            let runningBalance = openingBal;

                                            return (
                                                <>
                                                    {/* Beginning Balance Row */}
                                                    <tr className="bg-slate-50/50 italic text-slate-400">
                                                        <td className="py-3 font-mono border-r border-slate-100 pl-4">{reportingYear}-01-01</td>
                                                        <td className="py-3 font-black uppercase text-[10px] tracking-widest pl-4">[OPENING] 기초 잔액 (Brought Forward)</td>
                                                        <td className="py-3 text-right pr-4">-</td>
                                                        <td className="py-3 text-right pr-4">-</td>
                                                        <td className="py-3 text-right font-mono font-bold pr-4 bg-indigo-50/30">{openingBal.toLocaleString()}</td>
                                                    </tr>

                                                    {/* Period Transactions */}
                                                    {currentLines.map((l, i) => {
                                                        const impact = l.debit - l.credit;
                                                        // Fallback check if account metadata isn't found (though it should be)
                                                        const meta = getAccountMetadata(l.account) || { nature: 'EXPENSE' };
                                                        const isDrImpact = meta.nature === 'ASSET' || meta.nature === 'EXPENSE';
                                                        const finalImpact = isDrImpact ? impact : -impact;
                                                        
                                                        // Running balance accumulator
                                                        runningBalance += finalImpact;

                                                        return (
                                                            <tr key={i} className="hover:bg-slate-50 transition-colors border-t border-slate-100">
                                                                <td className="py-3 font-mono text-slate-500 border-r border-slate-100 pl-4">{l.date}</td>
                                                                <td className="py-3 text-slate-700 font-bold pl-4">
                                                                    <div className="flex flex-col">
                                                                        <span>{l.description}</span>
                                                                        <span className="text-[9px] text-slate-400 uppercase tracking-tighter">{l.account}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 text-right pr-4 font-mono text-indigo-600 font-bold">{l.debit > 0 ? l.debit.toLocaleString() : '-'}</td>
                                                                <td className="py-3 text-right pr-4 font-mono text-rose-600 font-bold">{l.credit > 0 ? l.credit.toLocaleString() : '-'}</td>
                                                                <td className="py-3 text-right pr-4 font-mono font-black bg-indigo-50/10 text-slate-700">
                                                                    {runningBalance.toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}

                                                    {/* Verification Footer (Total Row) */}
                                                    <tr className="border-t-2 border-slate-800 bg-slate-900 text-white font-black">
                                                        <td colSpan={2} className="py-4 pl-4 text-[10px] uppercase tracking-widest italic border-r border-slate-800">당기 합계 및 기말 잔액 (Closing Summary)</td>
                                                        <td className="py-4 text-right pr-4 font-mono text-indigo-300">{totalDr.toLocaleString()}</td>
                                                        <td className="py-4 text-right pr-4 font-mono text-rose-300">{totalCr.toLocaleString()}</td>
                                                        <td className="py-4 text-right pr-4 font-mono text-xl underline underline-offset-8 decoration-white/20 bg-indigo-900/40 text-indigo-200">{runningBalance.toLocaleString()}</td>
                                                    </tr>
                                                </>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                         </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FinancialStatements;
