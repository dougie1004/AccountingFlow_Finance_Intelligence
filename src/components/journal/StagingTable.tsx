import React, { useState, useContext } from 'react';
import { Loader2, Database, CheckCircle2, AlertTriangle, MessageSquare, History as HistoryIcon, FileText, Zap, Download, Shield, Trash2, Landmark, Boxes, Plus, TrendingDown, Calculator, CreditCard, BrainCircuit } from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import { useMassProcessor } from '../../hooks/useMassProcessor';
import { JournalEntry, Partner, ParsedTransaction } from '../../types';
import { AccountingContext } from '../../context/AccountingContext';
import { ALL_ACCOUNTS } from '../../constants/accounts';
import { invoke } from '@tauri-apps/api/core';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { cleanMarkdown } from '../../utils/textUtils';
import { PiiText } from '../common/PiiText';

// Check if running in Tauri environment (Desktop App)
const isTauri = () => typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

interface StagingTableProps {
    data: ParsedTransaction[];
    partners: Partner[];
    onConfirm: (entries: JournalEntry[]) => void;
    onCancel?: () => void;
}

export const StagingTable: React.FC<StagingTableProps> = ({ data, partners, onConfirm, onCancel }) => {
    
    // Convert AI semantic tags (acc_xxx) to readable names


    const context = useContext(AccountingContext) as any;
    const { addPartner, addAsset, config, accounts } = context;

    // Convert AI semantic tags (acc_xxx) to readable names
    const getDisplayAccountName = (rawName: string | undefined): string => {
        if (!rawName || rawName === '대기 중') return ''; 
        
        // 1. [SOVEREIGNTY] Try direct name match first. 
        // If the string itself is an existing account name, trust it over any code tags.
        if (accounts) {
            const accList = Object.values(accounts) as any[];
            // Direct hit on Name?
            const foundByName = accList.find(a => a.name === rawName);
            if (foundByName) return foundByName.name;

            // Direct hit on ID (Legacy support)?
            const foundById = accList.find(a => a.id === rawName);
            if (foundById) return foundById.name;
        }

        // 2. [FALLBACK] acc_ tag parsing (for when only IDs are provided)
        if (rawName.startsWith('acc_')) {
            const code = rawName.replace('acc_', '').replace('_v', '');
            const foundStatic = ALL_ACCOUNTS.find(a => a.code === code);
            if (foundStatic) return foundStatic.name;
        }

        // 3. Last Resort: Return the string as-is
        return rawName;
    };
    const { parseTransaction, isParsing } = useAI();
    const { processMassBatch } = useMassProcessor();
    const [stagedData, setStagedData] = useState<ParsedTransaction[]>(
        data.map(item => ({
            ...item,
            originalAmount: (item as any).originalAmount !== undefined ? (item as any).originalAmount : item.amount
        }))
    );
    const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null);
    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [editingCell, setEditingCell] = useState<{ index: number; field: 'date' | 'amount' } | null>(null);
    const [isMassProcessing, setIsMassProcessing] = useState(false);
    const [processProgress, setProcessProgress] = useState<{ current: number; total: number } | null>(null);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [filterMode, setFilterMode] = useState<'all' | 'critical'>('all');

    // --- Validation Logic ---
    const validateCompositeEntries = () => {
        const groups: Record<string, ParsedTransaction[]> = {};
        const singles: ParsedTransaction[] = [];

        // 1. Grouping
        stagedData.forEach(row => {
            if (row.transactionId) {
                if (!groups[row.transactionId]) groups[row.transactionId] = [];
                groups[row.transactionId].push(row);
            } else {
                singles.push(row);
            }
        });

        const imbalancedGroups: { id: string; debit: number; credit: number; diff: number }[] = [];

        // 2. Validate Groups
        Object.entries(groups).forEach(([id, rows]) => {
            let totalDebit = 0;
            let totalCredit = 0;

            rows.forEach(r => {
                const amountWithVat = Number(r.amount || 0) + Number(r.vat || 0);

                // [CFO FIX] If it's a single balanced row (Journal Mode), it contributes to BOTH sides
                if (r.isJournalMode || (r.debitAccount && r.creditAccount)) {
                    totalDebit += amountWithVat;
                    totalCredit += amountWithVat;
                    return;
                }

                if (r.position === 'Debit') totalDebit += amountWithVat;
                else if (r.position === 'Credit') totalCredit += amountWithVat;
                else {
                    // Smart Heuristics for single-line mappings
                    const drTypes = ['Expense', 'Asset', 'Payroll', 'Investment', 'Drawings'];
                    const crTypes = ['Revenue', 'Equity', 'Liability', 'Funding', 'Sales'];
                    
                    if (drTypes.includes(r.entryType || '')) totalDebit += amountWithVat;
                    else if (crTypes.includes(r.entryType || '')) totalCredit += amountWithVat;
                    else {
                        // If totally unknown, treat as Debit (Defense)
                        totalDebit += amountWithVat;
                    }
                }
            });

            if (Math.abs(totalDebit - totalCredit) > 100) { 
                imbalancedGroups.push({
                    id,
                    debit: totalDebit,
                    credit: totalCredit,
                    diff: Math.abs(totalDebit - totalCredit)
                });
            }
        });

        setValidationResult({ imbalancedGroups });
    };

    React.useEffect(() => {
        validateCompositeEntries();
    }, [stagedData]);


    // Derived data for display: Sorted and Filtered
    const getProcessedData = () => {
        let items = stagedData.map((item, originalIndex) => ({ ...item, originalIndex }));

        if (filterMode === 'critical') {
            items = items.filter(r => r.needsClarification || r.confidence !== 'High');
        }

        // Priority sort: Critical items first
        return items.sort((a, b) => {
            const aCrit = a.needsClarification || a.confidence !== 'High' ? 1 : 0;
            const bCrit = b.needsClarification || b.confidence !== 'High' ? 1 : 0;
            return bCrit - aCrit;
        });
    };

    const displayData = getProcessedData();
    const isJournalBatch = stagedData.some(r => r.isJournalMode);

    const runAIAnalysis = async () => {
        const newData = [...stagedData];

        for (let i = 0; i < newData.length; i++) {
            // Only re-analyze if needed
            setAnalyzingIndex(i);
            const row = newData[i];
            const input = `Date: ${row.date}, Desc: ${row.description}, Amount: ${row.amount}, Vendor: ${row.vendor}, This is a batch transaction.`;

            console.log(`[개별 AI] ${i + 1}/${newData.length} 정밀 분석 중:`, input);
            const result = await parseTransaction(input, "General K-IFRS", partners, "default-tenant", "Pro");

            if (result && result.transaction) {
                const tx = result.transaction;
                const newTrail = [...(tx.auditTrail || []), `[${new Date().toLocaleTimeString()}] AI 정밀 재분석 완료`];

                newData[i] = {
                    ...row,
                    ...tx,
                    date: (tx.date || row.date || '').toString(),
                    amount: Number(tx.amount || row.amount || 0),
                    vat: Number(tx.vat || row.vat || 0),
                    description: (tx.description || row.description || '').toString(),
                    entryType: (tx.entryType || row.entryType || 'Expense') as any,
                    reasoning: (tx.reasoning || row.reasoning || '').toString(),
                    auditTrail: newTrail,
                    isJournalMode: row.isJournalMode,
                    // [Sovereignty] Only overwrite accounts if NOT confirmed by user
                    debitAccount: (row.isUserConfirmed && row.debitAccount) ? row.debitAccount : (tx.debitAccount || row.debitAccount),
                    creditAccount: (row.isUserConfirmed && row.creditAccount) ? row.creditAccount : (tx.creditAccount || row.creditAccount),
                    accountName: (row.isUserConfirmed && row.accountName) ? row.accountName : (tx.accountName || row.accountName),
                    aiSuggestion: tx.accountName || tx.debitAccount // Store AI's opinion separately
                } as ParsedTransaction;
                setStagedData([...newData]);
            }
            await new Promise(r => setTimeout(r, 100));
        }
        setAnalyzingIndex(null);
        alert(`정밀 분석이 완료되었습니다.`);
    };

    const runMassAIAnalysis = async () => {
        setIsMassProcessing(true);
        setProcessProgress({ current: 0, total: stagedData.length });

        try {
            console.log('[Mass AI] 시작:', stagedData.length, '건');
            const result = await processMassBatch(stagedData);
            console.log('[Mass AI] 완료:', result);

            // 결과 강제 반영
            setStagedData([...result]);
            setProcessProgress(null);

            // 성공 알림
            const enhancedCount = result.filter(r => r.accountName).length;
            alert(`AI 분석 완료! ${enhancedCount}/${result.length}건의 계정과목이 자동 분류되었습니다.`);
        } catch (error) {
            console.error('[Mass AI] 실패:', error);
            alert(`대량 처리 중 오류가 발생했습니다:\n${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsMassProcessing(false);
            setProcessProgress(null);
        }
    };

    const handleConfirmSingle = async (idx: number) => {
        const tx = stagedData[idx];
        const isJournalReady = tx.isJournalMode || (tx.debitAccount && tx.creditAccount);
        
        if (!tx.accountName && !isJournalReady) {
            alert('계정과목을 먼저 지정해야 합니다.');
            return;
        }
        try {
            setIsValidating(true);
            const entriesToConfirm: JournalEntry[] = [];
            
            if (tx.rowType === 'summary') {
                alert('요약행(Summary)은 전표로 생성할 수 없습니다. 검증용으로만 사용하세요.');
                return;
            }

            const groupId = tx.transactionId || tx.id || crypto.randomUUID();
            const baseDate = tx.date || new Date().toISOString().split('T')[0];

            // Helper to generate IDs
            const getNewId = async () => {
                if (isTauri()) {
                    return await invoke<string>('generate_journal_id', {
                        date: baseDate,
                        entryType: tx.entryType
                    });
                }
                return crypto.randomUUID();
            };

            const finalCompliance = (tx as any).discrepancyReason
                ? `[증빙불일치 사유: ${(tx as any).discrepancyReason}] | ${tx.reasoning}`
                : tx.reasoning;

            // Standard Accounts
            let debitAccount = getDisplayAccountName(tx.debitAccount);
            let creditAccount = getDisplayAccountName(tx.creditAccount);
            const mainAccount = getDisplayAccountName(tx.accountName);

            if (!debitAccount && !creditAccount && mainAccount) {
                const type = tx.entryType || 'Expense';
                if (['Revenue', 'Equity', 'Liability'].includes(type) || mainAccount.includes('자본') || mainAccount.includes('차입') || mainAccount.includes('매출')) {
                    debitAccount = '보통예금';
                    creditAccount = mainAccount;
                } else {
                    debitAccount = mainAccount;
                    creditAccount = '미지급금';
                }
            } else {
                if (!debitAccount) debitAccount = mainAccount || '미지정 계정';
                if (!creditAccount) creditAccount = tx.entryType === 'Revenue' ? '보통예금' : '미지급금';
            }

            const hasComponents = tx.principalAmount || tx.feeAmount || tx.benefitAmount || tx.taxAmount;

            if (hasComponents) {
                // Split logic
                if (tx.principalAmount) {
                    entriesToConfirm.push({
                        id: await getNewId(),
                        transactionId: groupId,
                        date: baseDate,
                        description: `${tx.description} (원금)`,
                        vendor: tx.vendor,
                        debitAccount,
                        creditAccount,
                        amount: tx.principalAmount,
                        vat: 0,
                        type: tx.entryType as any,
                        status: 'Unconfirmed',
                        complianceContext: tx.reasoning,
                        auditTrail: [...(tx.auditTrail || []), 'Split Entry: Principal']
                    });
                }
                if (tx.feeAmount) {
                    entriesToConfirm.push({
                        id: await getNewId(),
                        transactionId: groupId,
                        date: baseDate,
                        description: `${tx.description} (수수료)`,
                        vendor: tx.vendor,
                        debitAccount: '지급수수료',
                        creditAccount,
                        amount: tx.feeAmount,
                        vat: 0,
                        type: tx.entryType as any,
                        status: 'Unconfirmed',
                        complianceContext: tx.reasoning,
                        auditTrail: [...(tx.auditTrail || []), 'Split Entry: Fee']
                    });
                }
                if (tx.taxAmount) {
                    entriesToConfirm.push({
                        id: await getNewId(),
                        transactionId: groupId,
                        date: baseDate,
                        description: `${tx.description} (세액)`,
                        vendor: tx.vendor,
                        debitAccount: '부가세대급금',
                        creditAccount,
                        amount: tx.taxAmount,
                        vat: 0,
                        type: tx.entryType as any,
                        status: 'Unconfirmed',
                        complianceContext: tx.reasoning,
                        auditTrail: [...(tx.auditTrail || []), 'Split Entry: Tax']
                    });
                }
                if (tx.benefitAmount) {
                    entriesToConfirm.push({
                        id: await getNewId(),
                        transactionId: groupId,
                        date: baseDate,
                        description: `${tx.description} (할인/혜택)`,
                        vendor: tx.vendor,
                        debitAccount: creditAccount, // Reducing AP
                        creditAccount: '잡이익',
                        amount: tx.benefitAmount,
                        vat: 0,
                        type: tx.entryType as any,
                        status: 'Unconfirmed',
                        complianceContext: tx.reasoning,
                        auditTrail: [...(tx.auditTrail || []), 'Split Entry: Benefit']
                    });
                }
            } else {
                // Fallback / Standard Single Row
                entriesToConfirm.push({
                    id: await getNewId(),
                    transactionId: groupId,
                    date: baseDate,
                    description: tx.description,
                    vendor: tx.vendor,
                    debitAccount,
                    creditAccount,
                    amount: tx.amount,
                    vat: tx.vat,
                    type: tx.entryType as any,
                    status: 'Unconfirmed',
                    complianceContext: finalCompliance,
                    attachmentUrl: (tx as any).attachmentUrl,
                    auditTrail: [...(tx.auditTrail || []), `Confirmed to Ledger (Single) on ${new Date().toLocaleDateString()}`]
                });
            }

            onConfirm(entriesToConfirm);
            
            // Remove from staging
            setStagedData(prev => prev.filter((_, i) => i !== idx));
            if (selectedRow === idx) setSelectedRow(null);
            
            alert('✅ 전표가 개별 등록되었습니다.');
        } catch (error) {
            console.error('Failed to post single entry:', error);
            alert('전표 등록 중 오류가 발생했습니다.');
        } finally {
            setIsValidating(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header / Stats */}
            <div className="flex justify-between items-center px-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                        <Database size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">일괄 처리 대기 목록 ({stagedData.length}건)</h3>
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">Batch Data Processing Workspace</p>
                            {/* Composite Validation Badge */}
                            {validationResult?.imbalancedGroups?.length > 0 ? (
                                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[10px] font-black uppercase animate-pulse">
                                    ⚠️ {validationResult.imbalancedGroups.length} Composite Errors
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-black uppercase">
                                    ✅ Composite Balanced
                                </span>
                            )}
                        </div>

                        {processProgress && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-300"
                                        style={{ width: `${(processProgress.current / processProgress.total) * 100}%` }}
                                    />
                                </div>
                                <span className="text-[10px] font-black text-indigo-400">
                                    {processProgress.current}/{processProgress.total}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {stagedData.length >= 10 && (
                        <button
                            onClick={runMassAIAnalysis}
                            disabled={isMassProcessing || analyzingIndex !== null}
                            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-2xl hover:from-purple-700 hover:to-indigo-700 disabled:from-white/5 disabled:to-white/5 disabled:text-slate-500 font-black text-sm transition-all shadow-xl shadow-purple-600/20 active:scale-95"
                        >
                            {isMassProcessing ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                            대량 AI 병렬 처리 ({stagedData.length}건)
                        </button>
                    )}
                    <button
                        onClick={runAIAnalysis}
                        disabled={isParsing || analyzingIndex !== null || isMassProcessing}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl hover:bg-indigo-700 disabled:bg-white/5 disabled:text-slate-500 font-black text-sm transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                    >
                        {analyzingIndex !== null ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                        개별 AI 정밀 분석
                    </button>
                </div>
            </div>

            {/* View Filters */}
            <div className="flex px-4 gap-2 border-b border-white/5 pb-1">
                <button
                    onClick={() => setFilterMode('all')}
                    className={`px-6 py-3 rounded-t-xl font-black text-xs tracking-widest transition-all ${filterMode === 'all' ? 'bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    전체 보기 ({stagedData.length})
                </button>
                <button
                    onClick={() => setFilterMode('critical')}
                    className={`px-6 py-3 rounded-t-xl font-black text-xs tracking-widest transition-all ${filterMode === 'critical' ? 'bg-rose-500/10 text-rose-400 border-b-2 border-rose-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    검토 필요 ({stagedData.filter(r => r.needsClarification || r.confidence !== 'High').length})
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Main Grid */}
                <div className="lg:col-span-2 xl:col-span-3 professional-card overflow-hidden">
                    <div className="overflow-x-auto max-h-[750px] scrollbar-thin scrollbar-thumb-white/10">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="sticky top-0 bg-[#151D2E] z-10 border-b border-white/5">
                                <tr className="text-slate-500 font-black uppercase text-[10px] tracking-widest">
                                    <th className="px-6 py-5">STATUS</th>
                                    <th className="px-6 py-5">DATE</th>
                                    <th className="px-6 py-5">DESCRIPTION / VENDOR</th>
                                    <th className="px-6 py-5 text-right">AMOUNT</th>
                                    <th className="px-6 py-5">AI ACCOUNT</th>
                                    <th className="px-6 py-5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {displayData.map((row, dIdx) => {
                                    const idx = row.originalIndex;
                                    const isSameGroup = dIdx > 0 && row.transactionId && displayData[dIdx-1].transactionId === row.transactionId;
                                    
                                    return (
                                        <tr
                                            key={idx}
                                            onClick={() => setSelectedRow(idx)}
                                            className={`transition-all cursor-pointer 
                                                ${idx === analyzingIndex ? 'bg-indigo-500/5' : ''} 
                                                ${selectedRow === idx ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}
                                                ${isSameGroup ? 'border-t-0' : 'border-t border-white/5'}
                                                ${row.transactionId ? 'group-row' : ''}
                                                ${isSameGroup ? '!bg-white/[0.01]' : ''}
                                            `}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {row.needsClarification || row.confidence !== 'High' ? (
                                                        <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
                                                    ) : (
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    )}
                                                    {row.transactionId && (
                                                        <span title="Protected Group Entry">
                                                            <Shield size={10} className="text-indigo-400" />
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                                                {editingCell?.index === idx && editingCell.field === 'date' ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className="bg-[#1a2235] border border-indigo-500/50 rounded px-1 py-0.5 text-white w-24 outline-none"
                                                        defaultValue={row.date || ''}
                                                        onBlur={(e) => {
                                                            const newValue = e.target.value;
                                                            const updated = [...stagedData];
                                                            updated[idx] = { ...updated[idx], date: newValue };
                                                            setStagedData(updated);
                                                            setEditingCell(null);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') e.currentTarget.blur();
                                                        }}
                                                    />
                                                ) : (
                                                    <div
                                                        className="cursor-text hover:text-indigo-400 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingCell({ index: idx, field: 'date' });
                                                        }}
                                                    >
                                                        {row.date || '날짜 없음'}
                                                    </div>
                                                )}
                                                {row.id && (
                                                    <div className="mt-1 text-[9px] text-indigo-400 font-bold">
                                                        {row.id}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-white font-black leading-tight truncate max-w-[200px]">
                                                    <PiiText text={cleanMarkdown(row.description) || '내용 없음'} type="auto" />
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                                                    <PiiText text={row.vendor && row.vendor.trim() !== '' ? row.vendor : '거래처 미지정'} type="auto" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {editingCell?.index === row.originalIndex && editingCell.field === 'amount' ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        inputMode="numeric"
                                                        className="bg-[#1a2235] border-2 border-indigo-500 rounded-xl px-2 py-1.5 text-white w-36 text-right outline-none font-black text-base shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                                                        value={stagedData[row.originalIndex].amount === 0 ? "" : stagedData[row.originalIndex].amount}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                                            const newValue = val === "" ? 0 : parseInt(val, 10);

                                                            const updated = [...stagedData];
                                                            updated[row.originalIndex] = { ...updated[row.originalIndex], amount: newValue };
                                                            setStagedData(updated);
                                                        }}
                                                        onBlur={() => setEditingCell(null)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') setEditingCell(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <div
                                                        className="cursor-text group py-1.5"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingCell({ index: row.originalIndex, field: 'amount' });
                                                        }}
                                                    >
                                                        <span className={`font-black text-lg transition-all flex items-center justify-end gap-1 ${(row as any).originalAmount !== undefined && row.amount !== (row as any).originalAmount
                                                            ? 'text-rose-400'
                                                            : 'text-white group-hover:text-indigo-400'
                                                            }`}>
                                                            {(row as any).originalAmount !== undefined && row.amount !== (row as any).originalAmount && <AlertTriangle size={14} className="animate-pulse" />}
                                                            ₩{(row.amount || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                                {row.vat > 0 && <p className="text-[10px] text-slate-500 font-bold">VAT ₩{(row.vat || 0).toLocaleString()}</p>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {analyzingIndex === idx ? (
                                                    <span className="flex items-center gap-2 text-indigo-400 animate-pulse font-black text-xs">
                                                        <Loader2 size={12} className="animate-spin" /> 연산 중
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                        {row.isJournalMode || (row.debitAccount && row.creditAccount) ? (
                                                            <>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-black border border-emerald-500/10">Dr</span>
                                                                    <span className="text-[10px] font-black text-slate-200">{getDisplayAccountName(row.debitAccount) || '미지정'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[9px] font-black border border-rose-500/10">Cr</span>
                                                                    <span className="text-[10px] font-black text-slate-200">{getDisplayAccountName(row.creditAccount) || '미지정'}</span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className={`px-3 py-1 rounded-lg font-black text-xs w-fit ${getDisplayAccountName(row.accountName) ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                                                {getDisplayAccountName(row.accountName) || '계정 미지정'}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleConfirmSingle(idx);
                                                        }}
                                                        disabled={isValidating || !row.accountName}
                                                        className="p-2 text-emerald-500 hover:text-white hover:bg-emerald-600 rounded-lg transition-all disabled:opacity-20"
                                                        title="전표 즉시 전송"
                                                    >
                                                        <Zap size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newData = stagedData.filter((_, i) => i !== idx);
                                                            setStagedData(newData);
                                                            if (selectedRow === idx) setSelectedRow(null);
                                                            else if (selectedRow !== null && selectedRow > idx) setSelectedRow(selectedRow - 1);
                                                        }}
                                                        className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                                        title="Remove from batch"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* [Integrity V2] Trial Balance Health Check (Real-time Batch Verification) */}
                    {isJournalBatch && (
                        <div className="mt-4 p-4 bg-[#0B1221] border border-white/5 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                                    <Shield size={18} />
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-black text-white uppercase">Batch Integrity Status</h4>
                                    <p className="text-[10px] font-bold text-slate-500">Staged rows vs Mapping logic balance check</p>
                                </div>
                            </div>

                            <div className="flex gap-6">
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-600 uppercase">Debit Total</p>
                                    <p className="text-sm font-black text-emerald-400">
                                        ₩{stagedData.reduce((sum, r) => {
                                            const val = Number(r.amount || 0) + Number(r.vat || 0);
                                            // [CFO FIX] Journal mode adds to both
                                            if (r.isJournalMode || (r.debitAccount && r.creditAccount)) return sum + val;
                                            
                                            const drTypes = ['Expense', 'Asset', 'Payroll', 'Investment', 'Drawings'];
                                            return sum + (r.position === 'Debit' ? val : (drTypes.includes(r.entryType || '') ? val : 0));
                                        }, 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-600 uppercase">Credit Total</p>
                                    <p className="text-sm font-black text-rose-400">
                                        ₩{stagedData.reduce((sum, r) => {
                                            const val = Number(r.amount || 0) + Number(r.vat || 0);
                                            // [CFO FIX] Journal mode adds to both
                                            if (r.isJournalMode || (r.debitAccount && r.creditAccount)) return sum + val;

                                            const crTypes = ['Revenue', 'Equity', 'Liability', 'Funding', 'Sales'];
                                            return sum + (r.position === 'Credit' ? val : (crTypes.includes(r.entryType || '') ? val : 0));
                                        }, 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="pl-4 border-l border-white/5 flex items-center">
                                    {(() => {
                                        const drTotal = stagedData.reduce((sum, r) => {
                                            const val = Number(r.amount || 0) + Number(r.vat || 0);
                                            if (r.isJournalMode || (r.debitAccount && r.creditAccount)) return sum + val;
                                            const drTypes = ['Expense', 'Asset', 'Payroll', 'Investment', 'Drawings'];
                                            return sum + (r.position === 'Debit' ? val : (drTypes.includes(r.entryType || '') ? val : 0));
                                        }, 0);
                                        const crTotal = stagedData.reduce((sum, r) => {
                                            const val = Number(r.amount || 0) + Number(r.vat || 0);
                                            if (r.isJournalMode || (r.debitAccount && r.creditAccount)) return sum + val;
                                            const crTypes = ['Revenue', 'Equity', 'Liability', 'Funding', 'Sales'];
                                            return sum + (r.position === 'Credit' ? val : (crTypes.includes(r.entryType || '') ? val : 0));
                                        }, 0);
                                        
                                        return Math.abs(drTotal - crTotal) < 500 ? (
                                            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl text-[10px] font-black">
                                                <CheckCircle2 size={14} /> COMPOSITE BALANCED
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-xl text-[10px] font-black animate-pulse">
                                                <AlertTriangle size={14} /> IMBALANCED
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Info / Audit Side Panel */}
                <div className="space-y-6">
                    {selectedRow !== null ? (
                        <div className="professional-card p-6 space-y-6 animate-in slide-in-from-right-4 duration-300">
                            {/* Row Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Selected Transaction</h4>
                                    <div className="text-xl font-black text-white mt-1">
                                        <PiiText text={cleanMarkdown(stagedData[selectedRow].description) || '내용 없음'} type="auto" />
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${stagedData[selectedRow].confidence === 'High' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {stagedData[selectedRow].confidence} Confidence
                                </div>
                            </div>

                            {/* [Antigravity] Journal Mode Direct Import Banner */}
                            {stagedData[selectedRow].isJournalMode && (
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <Database size={16} />
                                        <span className="text-xs font-black uppercase tracking-tight">Journal Mode Detected</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-300 leading-relaxed">
                                        이 파일은 이미 완성된 분개 데이터 구조를 가지고 있습니다. AI 분석을 생략하고 데이터를 직접 전표로 변환합니다.
                                    </p>
                                </div>
                            )}

                            {/* [Antigravity] AI Smart Suggestion (Non-Deterministic Layer) */}
                            {stagedData[selectedRow].suggestion && !stagedData[selectedRow].isJournalMode && (
                                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3 animate-in zoom-in-95 duration-300">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                            <Zap size={12} /> AI Rule-Based Suggestion
                                        </h4>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                            stagedData[selectedRow].suggestion.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
                                            stagedData[selectedRow].suggestion.confidence === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                            'bg-rose-500/20 text-rose-400'
                                        }`}>
                                            {stagedData[selectedRow].suggestion.confidence} Confidence
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase">Suggested Account</p>
                                            <p className="text-white font-black">{getDisplayAccountName(stagedData[selectedRow].suggestion.suggestedAccount)}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newData = [...stagedData];
                                                const suggestion = stagedData[selectedRow].suggestion;
                                                if (suggestion?.suggestedAccount) {
                                                    newData[selectedRow].accountName = suggestion.suggestedAccount;
                                                    newData[selectedRow].confidence = suggestion.confidence === 'high' ? 'High' : 'Normal';
                                                }
                                                if (suggestion?.suggestedPaymentMethod) {
                                                    newData[selectedRow].paymentMethod = suggestion.suggestedPaymentMethod as any;
                                                }
                                                newData[selectedRow].isUserConfirmed = true; // User accepted this, protect it
                                                setStagedData(newData);
                                            }}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                                        >
                                            Apply
                                        </button>
                                    </div>

                                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed italic">
                                        "{stagedData[selectedRow].suggestion.reasoning}"
                                    </p>
                                </div>
                            )}

                            {/* [V5] AI Reasoning Breakdown Display */}
                            {(stagedData[selectedRow] as any).inference ? (
                                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-400">
                                        <BrainCircuit size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">AI Reasoning Engine</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-white/5 py-1.5 px-3 rounded-lg">
                                            <span className="text-[9px] text-slate-500 font-bold uppercase">Estimated Category</span>
                                            <span className="text-[10px] text-indigo-300 font-black">{(stagedData[selectedRow] as any).inference.category}</span>
                                        </div>
                                        <p className="text-[10px] leading-relaxed text-slate-400 font-medium px-1">
                                            {(stagedData[selectedRow] as any).inference.reasoning}
                                        </p>
                                        <div className="flex items-center gap-2 pt-1">
                                            <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full ${(stagedData[selectedRow] as any).inference.confidence === 'High' || (stagedData[selectedRow] as any).inference.confidence === 'UserVerified' ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                                    style={{ width: (stagedData[selectedRow] as any).inference.confidence === 'High' || (stagedData[selectedRow] as any).inference.confidence === 'UserVerified' ? '95%' : '50%' }}
                                                />
                                            </div>
                                            <span className="text-[9px] text-slate-500 font-black">{(stagedData[selectedRow] as any).inference.confidence}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : stagedData[selectedRow].reasoning && (
                                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <Zap size={12} /> Cognitive Ledger Analytics
                                    </h4>
                                    <p className="text-sm font-bold text-slate-300 leading-relaxed indent-0">
                                        {cleanMarkdown(stagedData[selectedRow].reasoning)}
                                    </p>
                                </div>
                            )}

                            {/* Audit Trail / Source Tracking */}
                            {stagedData[selectedRow].auditTrail && stagedData[selectedRow].auditTrail!.length > 0 && (
                                <div className="p-4 bg-[#0B1221] border border-white/5 rounded-2xl space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <HistoryIcon size={12} /> Source Traceability (Audit Trail)
                                    </h4>
                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                        {stagedData[selectedRow].auditTrail?.map((trail, i) => (
                                            <div key={i} className="flex gap-2">
                                                <div className="w-1 h-1 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                                                <span className="text-[10px] font-bold text-slate-400 leading-tight">
                                                    {trail}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Compliance Callout */}
                            {stagedData[selectedRow].needsClarification && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
                                    <div className="flex items-center gap-2 text-rose-400">
                                        <AlertTriangle size={16} />
                                        <span className="text-xs font-black uppercase tracking-tight">Compliance Intervention</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-200 leading-relaxed">
                                        {cleanMarkdown(stagedData[selectedRow].clarificationPrompt) || 'AI가 해당 전표에 대해 추가 정보를 요청하고 있습니다.'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {stagedData[selectedRow].clarificationOptions?.map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    const newData = [...stagedData];
                                                    newData[selectedRow].accountName = opt;
                                                    newData[selectedRow].needsClarification = false;
                                                    newData[selectedRow].confidence = "High";
                                                    setStagedData(newData);
                                                }}
                                                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-black rounded-lg transition-all hover:scale-105 active:scale-95"
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Persistent Edit Section */}
                            <div className="bg-[#0B1221] rounded-2xl p-4 border border-white/5 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block ml-1 flex items-center justify-between">
                                        <span>Account (계정과목)</span>
                                        {stagedData[selectedRow].isUserConfirmed ? (
                                            <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 rounded tracking-normal">Manual/User</span>
                                        ) : (
                                            <span className="text-[8px] bg-slate-500/20 text-slate-500 px-1.5 rounded tracking-normal italic">AI Suggestion</span>
                                        )}
                                    </label>
                                    <input
                                        list="staging-account-list"
                                        value={getDisplayAccountName(stagedData[selectedRow].accountName) || stagedData[selectedRow].accountName || ""}
                                        onChange={async (e) => {
                                            const newAccount = e.target.value;
                                            const newData = [...stagedData];
                                            const vendor = newData[selectedRow].vendor;
                                            
                                            newData[selectedRow].accountName = newAccount;
                                            newData[selectedRow].needsClarification = false;
                                            newData[selectedRow].confidence = "High";
                                            newData[selectedRow].reasoning = `범주: 사용자 수동 지정 (Learning Activated)`;
                                            newData[selectedRow].isUserConfirmed = true;
                                            
                                            // Handle Double-Entry linkage
                                            if (!newData[selectedRow].isJournalMode) {
                                                newData[selectedRow].debitAccount = newAccount;
                                            }
                                            
                                            setStagedData(newData);

                                            // [Self-Learning] Save to local rule engine
                                            if (vendor && vendor !== "기타") {
                                                try {
                                                    await invoke('save_account_preference', { vendor, account: newAccount });
                                                    console.log(`[Learning] Saved preference for ${vendor} -> ${newAccount}`);
                                                } catch (err) {
                                                    console.error("Failed to save preference:", err);
                                                }
                                            }
                                        }}
                                        placeholder={stagedData[selectedRow].isJournalMode ? "Primary Account (Optional in Journal Mode)" : "계정과목을 입력하거나 선택하세요..."}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                    />
                                    
                                    {stagedData[selectedRow].isJournalMode && (
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[9px] font-black text-emerald-400 uppercase tracking-wider block ml-1">Debit Account (차변)</label>
                                                    {stagedData[selectedRow].isUserConfirmed && <span className="text-[7px] text-emerald-500/50 font-black">USER</span>}
                                                </div>
                                                <input
                                                    value={getDisplayAccountName(stagedData[selectedRow].debitAccount) || stagedData[selectedRow].debitAccount || ""}
                                                    onChange={(e) => {
                                                        const newData = [...stagedData];
                                                        newData[selectedRow].debitAccount = e.target.value;
                                                        newData[selectedRow].isUserConfirmed = true;
                                                        setStagedData(newData);
                                                    }}
                                                    className="w-full px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-white font-bold text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[9px] font-black text-rose-400 uppercase tracking-wider block ml-1">Credit Account (대변)</label>
                                                    {stagedData[selectedRow].isUserConfirmed && <span className="text-[7px] text-rose-500/50 font-black">USER</span>}
                                                </div>
                                                <input
                                                    value={getDisplayAccountName(stagedData[selectedRow].creditAccount) || stagedData[selectedRow].creditAccount || ""}
                                                    onChange={(e) => {
                                                        const newData = [...stagedData];
                                                        newData[selectedRow].creditAccount = e.target.value;
                                                        newData[selectedRow].isUserConfirmed = true;
                                                        setStagedData(newData);
                                                    }}
                                                    className="w-full px-3 py-2 bg-rose-500/5 border border-rose-500/20 rounded-lg text-white font-bold text-xs focus:ring-1 focus:ring-rose-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <datalist id="staging-account-list">
                                        {ALL_ACCOUNTS.map(acc => (
                                            <option key={acc.code} value={acc.name}>{acc.name} ({acc.code} - {acc.description})</option>
                                        ))}
                                    </datalist>
                                </div>

                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block ml-1">Vendor (거래처)</label>
                                        <input
                                            value={stagedData[selectedRow].vendor || ""}
                                            onChange={(e) => {
                                                const newData = [...stagedData];
                                                newData[selectedRow].vendor = e.target.value;
                                                setStagedData(newData);
                                            }}
                                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-bold text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block ml-1">
                                            {stagedData[selectedRow].principalAmount ? 'Total Amount (최종금액)' : 'Amount (금액)'}
                                        </label>
                                        
                                        {/* [Antigravity] Amount Breakdown Display */}
                                        {stagedData[selectedRow].benefitAmount && stagedData[selectedRow].benefitAmount !== 0 ? (
                                            <div className="mb-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-slate-500 font-bold uppercase">Original (이용금액)</span>
                                                    <span className="text-slate-300 font-black">₩{(stagedData[selectedRow].principalAmount || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-rose-400 font-bold uppercase">Discount (할인/혜택)</span>
                                                    <span className="text-rose-400 font-black">- ₩{(stagedData[selectedRow].benefitAmount || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xs">₩</span>
                                            <input
                                                type="text"
                                                value={(stagedData[selectedRow].amount || 0).toLocaleString()}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value.replace(/,/g, ''));
                                                    if (!isNaN(val)) {
                                                        const newData = [...stagedData];
                                                        newData[selectedRow].amount = val;
                                                        setStagedData(newData);
                                                    }
                                                }}
                                                className="w-full pl-7 pr-3 py-2 bg-indigo-500/5 border border-indigo-500/20 rounded-lg text-white font-black text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Multi-Component Breakdown UI */}
                                {(stagedData[selectedRow].principalAmount || stagedData[selectedRow].feeAmount || stagedData[selectedRow].taxAmount || stagedData[selectedRow].benefitAmount) && (
                                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CreditCard size={14} className="text-indigo-400" />
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Financial Breakdown (상세 내역)</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {stagedData[selectedRow].principalAmount !== undefined && (
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase">원금 (Principal)</label>
                                                    <div className="text-xs font-black text-white">₩{stagedData[selectedRow].principalAmount.toLocaleString()}</div>
                                                </div>
                                            )}
                                            {stagedData[selectedRow].feeAmount !== undefined && (
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase">수수료 (Fee)</label>
                                                    <div className="text-xs font-black text-amber-400">₩{stagedData[selectedRow].feeAmount.toLocaleString()}</div>
                                                </div>
                                            )}
                                            {stagedData[selectedRow].benefitAmount !== undefined && (
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase">혜택 (Benefit)</label>
                                                    <div className="text-xs font-black text-emerald-400">₩{stagedData[selectedRow].benefitAmount.toLocaleString()}</div>
                                                </div>
                                            )}
                                            {stagedData[selectedRow].taxAmount !== undefined && (
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase">세액 (Tax)</label>
                                                    <div className="text-xs font-black text-cyan-400">₩{stagedData[selectedRow].taxAmount.toLocaleString()}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        onClick={() => {
                                            const newData = [...stagedData];
                                            newData[selectedRow].needsClarification = false;
                                            newData[selectedRow].confidence = "High";
                                            if (newData[selectedRow].reasoning && !newData[selectedRow].reasoning.includes("[사용자 수동 승인]")) {
                                                newData[selectedRow].reasoning = `[사용자 수동 승인] ${newData[selectedRow].reasoning}`;
                                            }
                                            setStagedData(newData);
                                            alert('현재 전표의 계정 및 상태가 확정되었습니다.');
                                        }}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <CheckCircle2 size={16} /> 현재 전표 확인 및 상태 확정 (Confirm Entry)
                                    </button>
                                    
                                    <button
                                        onClick={() => {
                                            const base = stagedData[selectedRow];
                                            const newId = `TX-${crypto.randomUUID().slice(0, 8)}`;
                                            const transactionId = base.transactionId || newId;

                                            // Update base if it didn't have a transactionId
                                            const newData = [...stagedData];
                                            if (!base.transactionId) {
                                                newData[selectedRow] = { ...base, transactionId };
                                            }

                                            // Insert new row below
                                            const newRow: ParsedTransaction = {
                                                ...base,
                                                id: `NEW-${crypto.randomUUID().slice(0, 4)}`,
                                                transactionId,
                                                amount: 0,
                                                accountName: "",
                                                debitAccount: "",
                                                creditAccount: "",
                                                isUserConfirmed: true,
                                                reasoning: `자유 분개 추가 (Linked to ${base.description})`,
                                                auditTrail: [`[${new Date().toLocaleTimeString()}] 사용자에 의해 분개 라인 추가됨`]
                                            };

                                            newData.splice(selectedRow + 1, 0, newRow);
                                            setStagedData(newData);
                                            alert('새로운 분개 라인이 생성되었습니다. 차변/대변 금액 합계를 확인해 주세요.');
                                        }}
                                        className="w-full py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-black text-[10px] rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest mt-2"
                                    >
                                        <Plus size={14} /> 복합 분개 라인 추가 (Split/Add Line)
                                    </button>
                                </div>

                                {/* [Integrity V2] Conditional Discrepancy Reason Field */}
                                {((stagedData[selectedRow] as any).originalAmount !== undefined &&
                                    stagedData[selectedRow].amount !== (stagedData[selectedRow] as any).originalAmount) && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] font-black text-rose-400 uppercase tracking-wider block ml-1 flex items-center gap-1">
                                                <AlertTriangle size={10} /> Discrepancy Reason (증빙 불일치 사유)
                                            </label>
                                            <textarea
                                                placeholder="증빙과 금액이 다른 이유를 입력해 주세요 (예: 부분 환불, AI 오인식 수정 등)..."
                                                value={(stagedData[selectedRow] as any).discrepancyReason || ""}
                                                onChange={(e) => {
                                                    const newData = [...stagedData];
                                                    (newData[selectedRow] as any).discrepancyReason = e.target.value;
                                                    setStagedData(newData);
                                                }}
                                                className="w-full px-3 py-2 bg-rose-500/5 border border-rose-500/20 rounded-lg text-rose-200 font-bold text-[11px] focus:ring-1 focus:ring-rose-500 outline-none h-16 resize-none placeholder:text-rose-500/30"
                                            />
                                        </div>
                                    )}

                                {/* [Withholding Tax V2] Payroll Breakdown Assistant */}
                                {((stagedData[selectedRow].entryType === 'Payroll') ||
                                  (stagedData[selectedRow].description?.toUpperCase().includes('PAY')) ||
                                  (stagedData[selectedRow].description?.includes('인건비')) ||
                                  (stagedData[selectedRow].description?.includes('급여')) ||
                                  (stagedData[selectedRow].accountName?.includes('acc_801')) ||
                                  (stagedData[selectedRow].accountName?.includes('급여'))) && (
                                    <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-4 animate-in slide-in-from-right-4 duration-500">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-blue-400">
                                                <Landmark size={18} />
                                                <span className="text-xs font-black uppercase tracking-tight">Payroll Tax Assistant</span>
                                            </div>
                                            <div className="bg-blue-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">원천세 자동계산</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-500 uppercase">국민연금 (4.5%)</label>
                                                <div className="text-xs font-bold text-white">₩{Math.floor((stagedData[selectedRow]?.amount || 0) * (config.taxPolicy?.insuranceRates?.nationalPension || 0.045)).toLocaleString()}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-500 uppercase">건강보험 (3.545%)</label>
                                                <div className="text-xs font-bold text-white">₩{Math.floor((stagedData[selectedRow]?.amount || 0) * (config.taxPolicy?.insuranceRates?.healthInsurance || 0.03545)).toLocaleString()}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-500 uppercase">근로소득세 (간이세액 추정)</label>
                                                <div className="text-xs font-bold text-rose-400">₩{Math.floor((stagedData[selectedRow]?.amount || 0) * 0.03).toLocaleString()}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-500 uppercase text-emerald-400">실수령액 (Net)</label>
                                                <div className="text-sm font-black text-emerald-400">₩{Math.floor(stagedData[selectedRow].amount * 0.9).toLocaleString()}</div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                const amount = stagedData[selectedRow].amount;
                                                const pension = Math.floor(amount * (config.taxPolicy?.insuranceRates?.nationalPension || 0.045));
                                                const health = Math.floor(amount * (config.taxPolicy?.insuranceRates?.healthInsurance || 0.03545));
                                                const tax = Math.floor(amount * 0.03);
                                                const net = amount - (pension + health + tax);

                                                const groupId = `PAY-${crypto.randomUUID().slice(0, 8)}`;
                                                const baseRow = stagedData[selectedRow];

                                                const splits: ParsedTransaction[] = [
                                                    { ...baseRow, transactionId: groupId, position: 'Debit', amount, accountName: '급여', reasoning: '[원천세 분할] 총급여 인식', payrollSplit: { pension, health, tax, net } },
                                                    { ...baseRow, transactionId: groupId, position: 'Credit', amount: pension, accountName: '예수금 (국민연금)', reasoning: '[원천세 분할] 국민연금 공제', discrepancyReason: '[AI] 급여 원천세 공제 분할' } as any,
                                                    { ...baseRow, transactionId: groupId, position: 'Credit', amount: health, accountName: '예수금 (건강보험)', reasoning: '[원천세 분할] 건강보험 공제', discrepancyReason: '[AI] 급여 원천세 공제 분할' } as any,
                                                    { ...baseRow, transactionId: groupId, position: 'Credit', amount: tax, accountName: '예수금 (원천세)', reasoning: '[원천세 분할] 소득세 공제', discrepancyReason: '[AI] 급여 원천세 공제 분할' } as any,
                                                    { ...baseRow, transactionId: groupId, position: 'Credit', amount: net, accountName: '미지급급여', reasoning: '[원천세 분할] 실지급액', discrepancyReason: '[AI] 급여 원천세 공제 분할' } as any
                                                ];

                                                const newData = [...stagedData];
                                                newData.splice(selectedRow, 1, ...splits);
                                                setStagedData(newData);
                                                setSelectedRow(null);
                                                alert(`${splits.length}건의 복합 분개로 분할되었습니다. 상단 검증 배지를 확인해 주세요.`);
                                            }}
                                            className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-[10px] font-black rounded-xl transition-all border border-blue-600/30"
                                        >
                                            분개 자동 생성 및 적용
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Lease Strategy Assistant (NEW!) */}
                            {stagedData[selectedRow].description?.includes('리스') && !stagedData[selectedRow].transactionId && (
                                <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-4 animate-in zoom-in-95 duration-300">
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <TrendingDown size={18} />
                                        <span className="text-xs font-black uppercase tracking-tight">Lease Strategy Assistant</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-300 leading-relaxed">
                                        리스 거래가 감지되었습니다. 회사의 리스 이용 목적에 따라 처리 방식을 선택해 주세요.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => {
                                                const newData = [...stagedData];
                                                newData[selectedRow].accountName = '임차료';
                                                newData[selectedRow].reasoning = '운용리스 방식: 리스료 전액을 당기 비용 처리';
                                                setStagedData(newData);
                                            }}
                                            className={`p-3 rounded-xl border text-[10px] font-black transition-all ${stagedData[selectedRow].accountName === '임차료' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                        >
                                            운용리스 (비용)
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newData = [...stagedData];
                                                newData[selectedRow].accountName = '차량운반구';
                                                newData[selectedRow].reasoning = '금융리스 방식: 자산 및 부채(리스부채)로 인식';
                                                setStagedData(newData);
                                            }}
                                            className={`p-3 rounded-xl border text-[10px] font-black transition-all ${stagedData[selectedRow].accountName === '차량운반구' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                        >
                                            금융리스 (자산)
                                        </button>
                                    </div>
                                    {stagedData[selectedRow].accountName === '차량운반구' && (
                                        <div className="space-y-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-emerald-400 uppercase">Interest Rate Assistant</span>
                                                <div className="flex items-center gap-1 text-[9px] text-emerald-500">
                                                    <Calculator size={10} />
                                                    Base: {((stagedData[selectedRow].leaseInterestRate || config.taxPolicy?.defaultLeaseRate || 0.072) * 100).toFixed(1)}%
                                                    {stagedData[selectedRow].leaseInterestRate ? '(Contract)' : config.taxPolicy?.defaultLeaseRate ? '(Company)' : '(System)'}
                                                </div>
                                            </div>

                                            {/* Lease Type Selection & Guidance */}
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase">Lease Category (시장 금리 가이드)</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const newData = [...stagedData];
                                                            newData[selectedRow].leaseAssetType = 'Vehicle';
                                                            setStagedData(newData);
                                                        }}
                                                        className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${stagedData[selectedRow].leaseAssetType === 'Vehicle' ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                                                    >
                                                        자동차 리스 (8.0%±)
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const newData = [...stagedData];
                                                            newData[selectedRow].leaseAssetType = 'Machinery';
                                                            setStagedData(newData);
                                                        }}
                                                        className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${stagedData[selectedRow].leaseAssetType === 'Machinery' ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                                                    >
                                                        기계/장비 리스 (6.8%±)
                                                    </button>
                                                </div>
                                                <div className="p-2 bg-indigo-500/5 rounded border border-indigo-500/10 text-[9px] font-bold text-indigo-300 leading-tight">
                                                    <span className="text-indigo-400">💡 Smart Advice:</span> {stagedData[selectedRow].leaseAssetType === 'Vehicle'
                                                        ? "자동차는 감가상각이 빨라 캐피탈사 스프레드가 높게(1.5%~3%) 형성됩니다. 연 8.0% 내외가 현실적입니다."
                                                        : "범용 장비는 자동차보다 스프레드가 낮으나, 신용 등급에 따라 6.5%~7.5% 범위 내외에서 결정됩니다."}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 border-t border-emerald-500/10 pt-3">
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-slate-500">계약기간 (개월)</label>
                                                    <input
                                                        type="number"
                                                        value={stagedData[selectedRow].leaseTerm || 60}
                                                        onChange={(e) => {
                                                            const newData = [...stagedData];
                                                            newData[selectedRow].leaseTerm = Number(e.target.value);
                                                            setStagedData(newData);
                                                        }}
                                                        className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white outline-none focus:border-emerald-500/50"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-slate-500 flex justify-between items-center">
                                                        <span>적용 이자율 (%)</span>
                                                        <span className={`text-[7px] ${(stagedData[selectedRow].leaseInterestRate || 0.072) < 0.065 || (stagedData[selectedRow].leaseInterestRate || 0.072) > 0.085 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                            {(stagedData[selectedRow].leaseInterestRate || 0.072) >= 0.065 && (stagedData[selectedRow].leaseInterestRate || 0.072) <= 0.085 ? 'Market Ready' : 'Out of Range'}
                                                        </span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={((stagedData[selectedRow].leaseInterestRate || config.taxPolicy?.defaultLeaseRate || 0.072) * 100).toFixed(1)}
                                                        onChange={(e) => {
                                                            const newData = [...stagedData];
                                                            newData[selectedRow].leaseInterestRate = Number(e.target.value) / 100;
                                                            setStagedData(newData);
                                                        }}
                                                        className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white outline-none focus:border-emerald-500/50"
                                                    />
                                                </div>
                                            </div>
                                            <div className="h-32 w-full bg-black/20 rounded-xl p-2 border border-white/5">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={(() => {
                                                        const row = stagedData[selectedRow];
                                                        const term = row.leaseTerm || 60;
                                                        const rate = row.leaseInterestRate || config.taxPolicy?.defaultLeaseRate || 0.072;
                                                        const monthlyPayment = row.amount;
                                                        const r = rate / 12;
                                                        let balance = Math.floor(monthlyPayment * ((1 - Math.pow(1 + r, -term)) / r));
                                                        const amortData = [];
                                                        for (let i = 1; i <= term; i++) {
                                                            const interest = Math.floor(balance * r);
                                                            const principal = monthlyPayment - interest;
                                                            balance -= principal;
                                                            if (i === 1 || i === term || i % Math.ceil(term / 6) === 0) {
                                                                amortData.push({ month: `${i}개월`, interest, principal });
                                                            }
                                                        }
                                                        return amortData;
                                                    })()}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                        <XAxis dataKey="month" hide />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                                                            itemStyle={{ fontWeight: 'black' }}
                                                        />
                                                        <Area type="monotone" dataKey="principal" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="원금" />
                                                        <Area type="monotone" dataKey="interest" stackId="1" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.3} name="이자" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    const row = stagedData[selectedRow];

                                                    // Defense Wall #1: Prevent double capitalization
                                                    if (row.transactionId || row.accountName?.includes('사용권자산')) {
                                                        alert('이미 자산화 처리가 완료된 항목입니다. 중복 처리는 시스템 무결성을 위해 차단됩니다.');
                                                        return;
                                                    }

                                                    const term = row.leaseTerm || 60;
                                                    const rate = row.leaseInterestRate || config.taxPolicy?.defaultLeaseRate || 0.072;
                                                    const monthlyPayment = row.amount;

                                                    // Present Value Calculation
                                                    const r = rate / 12;
                                                    const n = term;
                                                    const pvFactor = (1 - Math.pow(1 + r, -n)) / r;
                                                    const totalPV = Math.floor(monthlyPayment * pvFactor);

                                                    const groupId = `LEASE-${crypto.randomUUID().slice(0, 8)}`;

                                                    const splits: ParsedTransaction[] = [
                                                        {
                                                            ...row,
                                                            transactionId: groupId,
                                                            position: 'Debit',
                                                            amount: totalPV,
                                                            accountName: '차량운반구 (사용권자산)',
                                                            reasoning: `[K-IFRS 1116] 자산 인식 (시장금리 가이드 준수: ${(rate * 100).toFixed(1)}%, ${term}개월 PV 계산)`,
                                                            discrepancyReason: '[K-IFRS 1116] 사용권자산 공정가치(PV) 인식'
                                                        } as any,
                                                        {
                                                            ...row,
                                                            transactionId: groupId,
                                                            position: 'Credit',
                                                            amount: totalPV,
                                                            accountName: '리스부채',
                                                            reasoning: `[K-IFRS 1116] 리스부채 총액 인식 (이자율 ${(rate * 100).toFixed(1)}%)`,
                                                            discrepancyReason: '[K-IFRS 1116] 리스부채 총액(PV) 인식'
                                                        } as any
                                                    ];

                                                    const paymentRecognition: ParsedTransaction[] = [
                                                        {
                                                            ...row,
                                                            transactionId: groupId,
                                                            position: 'Debit',
                                                            amount: monthlyPayment,
                                                            accountName: '리스부채',
                                                            reasoning: `[K-IFRS 1116] 1회차 리스료 상환`
                                                        },
                                                        {
                                                            ...row,
                                                            transactionId: groupId,
                                                            position: 'Credit',
                                                            amount: monthlyPayment,
                                                            accountName: '보통예금',
                                                            reasoning: `[K-IFRS 1116] 리스료 자동이체`
                                                        }
                                                    ];

                                                    const newData = [...stagedData];
                                                    newData.splice(selectedRow, 1, ...splits, ...paymentRecognition);
                                                    setStagedData(newData);
                                                    setSelectedRow(null);
                                                    alert(`K-IFRS 1116 리스 자산화 완료: 총 ₩${totalPV.toLocaleString()} 인식되었습니다.`);
                                                }}
                                                className="w-full py-2 bg-emerald-500 text-white text-[10px] font-black rounded-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                                            >
                                                상환 스케줄표 생성 및 자산 확정
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Payroll Actions (HomeTax Export) */}
                            {stagedData[selectedRow].entryType === 'Payroll' && (
                                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2">
                                    <button
                                        onClick={() => {
                                            const payrollRows = stagedData.filter(r => r.entryType === 'Payroll' || (r as any).payrollSplit);
                                            const exportData = payrollRows.map(r => ({
                                                '성명': r.vendor || '미지정',
                                                '지급일자': r.date,
                                                '총급여': r.amount,
                                                '국민연금': (r as any).payrollSplit?.pension || 0,
                                                '건강보험': (r as any).payrollSplit?.health || 0,
                                                '소득세': (r as any).payrollSplit?.tax || 0,
                                                '차인지급액': (r as any).payrollSplit?.net || r.amount,
                                                '비고': r.reasoning
                                            }));

                                            const ws = XLSX.utils.json_to_sheet(exportData);
                                            const wb = XLSX.utils.book_new();
                                            XLSX.utils.book_append_sheet(wb, ws, "Payroll_Report");
                                            XLSX.writeFile(wb, `HomeTax_Payroll_${new Date().toISOString().split('T')[0]}.xlsx`);
                                        }}
                                        className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-[10px] font-black rounded-lg border border-blue-600/30 flex items-center justify-center gap-2"
                                    >
                                        <Download size={14} />
                                        홈택스 신고용 엑셀 다운로드
                                    </button>
                                </div>
                            )}

                            {/* Asset Detection & Registration (NEW!) */}
                            {(stagedData[selectedRow].accountName?.includes('비품') ||
                                stagedData[selectedRow].accountName?.includes('차량') ||
                                (stagedData[selectedRow].amount > (config.taxPolicy?.aiGovernanceThreshold || 1000000) &&
                                    !stagedData[selectedRow].accountName?.includes('수수료') &&
                                    !stagedData[selectedRow].accountName?.includes('급여') &&
                                    !stagedData[selectedRow].accountName?.includes('임차료') &&
                                    !stagedData[selectedRow].accountName?.includes('비용') &&
                                    !stagedData[selectedRow].accountName?.includes('자문'))) && (
                                    <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-4 animate-in slide-in-from-bottom-2 duration-500">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-indigo-400">
                                                <Landmark size={18} />
                                                <span className="text-xs font-black uppercase tracking-tight">Fixed Asset Detected</span>
                                            </div>
                                            <div className="bg-indigo-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">High Value</div>
                                        </div>

                                        <p className="text-xs font-bold text-slate-300">
                                            이 거래는 고정자산(비품/자산)으로 등록이 권장됩니다. {stagedData[selectedRow].quantity && stagedData[selectedRow].quantity > 1 ? `수량(${stagedData[selectedRow].quantity}개)에 따라 개별 자산으로 분할 등록하시겠습니까?` : '자산 대장에 즉시 등록하시겠습니까?'}
                                        </p>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const row = stagedData[selectedRow];

                                                    // Defense Wall #2: Prevent derived entries from being registered as assets
                                                    if (row.accountName?.includes('사용권자산') || row.accountName?.includes('리스부채')) {
                                                        alert('리스 자산화로 생성된 파생 항목입니다. 원천 리스료 전표에서 자산 대장 등록을 진행하거나, 금융리스 결산 기능을 이용해 주세요.');
                                                        return;
                                                    }

                                                    const qty = row.quantity || 1;
                                                    const unitCost = row.unitPrice || (row.amount / qty);

                                                    // Audit Log Entry
                                                    for (let i = 0; i < qty; i++) {
                                                        addAsset({
                                                            id: crypto.randomUUID(),
                                                            name: qty > 1 ? `${row.description} (${i + 1}/${qty})` : row.description,
                                                            acquisitionDate: row.date,
                                                            cost: unitCost,
                                                            depreciationMethod: config.taxPolicy?.depreciationMethod === 'StraightLine' ? 'STRAIGHT_LINE' : 'DECLINING_BALANCE',
                                                            usefulLife: 5, // Default
                                                            residualValue: 0,
                                                            accumulatedDepreciation: 0,
                                                            currentValue: unitCost
                                                        });
                                                    }
                                                    alert(`${qty}건의 자산이 고정자산 대장에 등록되었습니다.`);

                                                    // Mark as processed in audit trail
                                                    const newData = [...stagedData];
                                                    newData[selectedRow].auditTrail = [...(newData[selectedRow].auditTrail || []), `[${new Date().toLocaleTimeString()}] 고정자산 대장 ${qty}건 등록 완료`];
                                                    setStagedData(newData);
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-xl transition-all active:scale-95"
                                            >
                                                <Plus size={14} /> 자산 대장 등록
                                            </button>
                                            {stagedData[selectedRow].quantity && stagedData[selectedRow].quantity > 1 && (
                                                <button className="px-3 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all">
                                                    <Boxes size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                            {/* AI 지능형 인사이트 (Accounting & Tax) */}
                            {(stagedData[selectedRow].accountName || stagedData[selectedRow].vat > 0) && (
                                <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-4 animate-in slide-in-from-bottom-2 duration-500">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-indigo-400">
                                            <Calculator size={18} />
                                            <span className="text-xs font-black uppercase tracking-tight">AI Accounting Insight</span>
                                        </div>
                                        {stagedData[selectedRow].accountName?.includes("접대비") ? (
                                            <div className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">세무 주의</div>
                                        ) : (
                                            <div className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">검토 완료</div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {/* Accounting Note */}
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase">회계 처리 의견</span>
                                            <p className="text-xs font-bold text-slate-300">
                                                {stagedData[selectedRow].accountName === '복리후생비' ?
                                                    '임직원의 사기 진작 및 복리후생을 위한 지출로 판단되어 복리후생비로 분류되었습니다.' :
                                                    stagedData[selectedRow].accountName === '접대비' ?
                                                        '외부 이해관계자와의 원활한 업무 협력을 위한 지출로 판단되어 접대비로 분류되었습니다.' :
                                                        '거래의 성격과 적격증빙 여부를 고려하여 가장 적합한 계정과목으로 분류되었습니다.'}
                                            </p>
                                        </div>

                                        {/* Tax Note */}
                                        <div className="space-y-1 border-t border-white/5 pt-2">
                                            <span className="text-[10px] font-black text-orange-400 uppercase">세무 리스크 진단</span>
                                            <p className="text-xs font-bold text-slate-300">
                                                {stagedData[selectedRow].accountName?.includes("접대비") ?
                                                    '⚠️ 접대비 관련 매입세액은 부가가치세법상 매입세액 불공제 대상입니다. 법인세법상 한도 초과 여부 확인이 필요합니다.' :
                                                    stagedData[selectedRow].vat > 0 ?
                                                        '✅ 신용카드 매출전표 등 적격증빙이 확인되므로 부가가치세 매입세액 공제가 가능합니다.' :
                                                        '증빙 서류의 적정성을 재검토하여 비용 인정 여부를 확정하시기 바랍니다.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Audit Trail */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-indigo-400">
                                    <HistoryIcon size={16} />
                                    <span className="text-xs font-black uppercase tracking-tight">Digital Audit Trail</span>
                                </div>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                                    {stagedData[selectedRow].auditTrail?.map((log, i) => (
                                        <div key={i} className="flex gap-3 text-[10px] font-bold text-slate-500 leading-relaxed py-2 border-b border-white/5 last:border-0">
                                            <span className="text-indigo-500/50 shrink-0">#{i + 1}</span>
                                            <div className="flex flex-col gap-1">
                                                <span className={log.includes("Source:") ? "text-indigo-400 font-black" : ""}>{cleanMarkdown(log)}</span>
                                                {log.includes("Source:") && (
                                                    <div className="px-2 py-1 bg-white/5 rounded border border-white/5 text-[8px] text-slate-500 italic">
                                                        * Evidence Integrity Verified (PII Masking Applied)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) || (
                                            <p className="text-[10px] font-bold text-slate-600 italic">No logs available for this transaction.</p>
                                        )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="professional-card p-12 flex flex-col items-center justify-center text-center opacity-40">
                            <FileText size={48} className="text-slate-600 mb-4" />
                            <p className="text-sm font-black text-slate-500">전표를 선택하여<br />상세 정보와 감사 로그를 확인하세요</p>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => {
                                if (window.confirm('모든 대기 중인 전표를 취소하고 처음부터 다시 시작하시겠습니까?')) {
                                    setStagedData([]);
                                    setSelectedRow(null);
                                    if (onCancel) onCancel();
                                }
                            }}
                            className="w-full bg-white/5 text-slate-400 py-3 rounded-xl font-black text-xs hover:bg-rose-500/10 hover:text-rose-400 transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} />
                            모두 취소하고 다시 업로드
                        </button>
                        <button
                            onClick={async () => {
                                // --- [NEW] EVIDENCE TAMPER PROTECTION (FLEXIBLE) ---
                                const imbalancedWithoutReason = stagedData.filter(r =>
                                    r.accountName &&
                                    (r as any).originalAmount !== undefined &&
                                    r.amount !== (r as any).originalAmount &&
                                    !(r as any).discrepancyReason?.trim()
                                );

                                if (imbalancedWithoutReason.length > 0) {
                                    alert(`🚨 [데이터 무결성 주의: 사유 누락]\n\n증빙 금액과 입력 금액이 다른 전표가 존재합니다. 업무 정당성을 위해 우측 패널에서 반드시 '불일치 사유'를 입력해 주세요.`);
                                    return;
                                }

                                if (isMassProcessing || isValidating) return;

                                // --- BLOCK CONFIRM if Imbalanced ---
                                if (validationResult?.imbalancedGroups?.length > 0) {
                                    alert(`⚠️ [복합 전표 검증 실패]\n\n${validationResult.imbalancedGroups.length}개의 전표 그룹에서 차변/대변 금액이 일치하지 않습니다.\n상단 배지를 확인하고 데이터를 수정해주세요.`);
                                    return;
                                }

                                setIsValidating(true);

                                try {
                                    // 1. Filter out Summary Rows
                                    const processableRows = stagedData.filter(r => r.rowType !== 'summary' && r.accountName);

                                    const allNewEntries: JournalEntry[] = [];

                                    for (const tx of processableRows) {
                                        const groupId = tx.transactionId || tx.id || crypto.randomUUID();
                                        const baseDate = tx.date || new Date().toISOString().split('T')[0];

                                        const getNewId = async () => {
                                            if (isTauri()) {
                                                try {
                                                    return await invoke<string>('generate_journal_id', {
                                                        date: baseDate,
                                                        entryType: tx.entryType
                                                    });
                                                } catch (e) {
                                                    return crypto.randomUUID();
                                                }
                                            }
                                            return crypto.randomUUID();
                                        };

                                        // Determine Primary Accounts
                                        let debitAccount = getDisplayAccountName(tx.debitAccount);
                                        let creditAccount = getDisplayAccountName(tx.creditAccount);
                                        const mainAccount = getDisplayAccountName(tx.accountName);

                                        if (!debitAccount && !creditAccount && mainAccount) {
                                            const type = tx.entryType || 'Expense';
                                            if (['Revenue', 'Equity', 'Liability'].includes(type) || mainAccount.includes('자본') || mainAccount.includes('차입') || mainAccount.includes('매출')) {
                                                debitAccount = '보통예금';
                                                creditAccount = mainAccount;
                                            } else {
                                                debitAccount = mainAccount;
                                                creditAccount = '미지급금';
                                            }
                                        } else {
                                            if (!debitAccount) debitAccount = mainAccount || '계정 미지정';
                                            if (!creditAccount) creditAccount = tx.entryType === 'Revenue' ? '보통예금' : '미지급금';
                                        }

                                        const hasComponents = tx.principalAmount || tx.feeAmount || tx.benefitAmount || tx.taxAmount;

                                        if (hasComponents) {
                                            if (tx.principalAmount) {
                                                allNewEntries.push({
                                                    id: await getNewId(),
                                                    transactionId: groupId,
                                                    date: baseDate,
                                                    description: `${tx.description} (원금)`,
                                                    vendor: tx.vendor,
                                                    debitAccount,
                                                    creditAccount,
                                                    amount: tx.principalAmount,
                                                    vat: 0,
                                                    type: tx.entryType as any,
                                                    status: 'Unconfirmed',
                                                    complianceContext: tx.reasoning,
                                                    auditTrail: [`Split-to-Ledger (Principal) at ${new Date().toISOString()}`]
                                                });
                                            }
                                            if (tx.feeAmount) {
                                                allNewEntries.push({
                                                    id: await getNewId(),
                                                    transactionId: groupId,
                                                    date: baseDate,
                                                    description: `${tx.description} (수수료)`,
                                                    vendor: tx.vendor,
                                                    debitAccount: '지급수수료',
                                                    creditAccount,
                                                    amount: tx.feeAmount,
                                                    vat: 0,
                                                    type: tx.entryType as any,
                                                    status: 'Unconfirmed',
                                                    complianceContext: tx.reasoning,
                                                    auditTrail: [`Split-to-Ledger (Fee) at ${new Date().toISOString()}`]
                                                });
                                            }
                                            if (tx.taxAmount) {
                                                allNewEntries.push({
                                                    id: await getNewId(),
                                                    transactionId: groupId,
                                                    date: baseDate,
                                                    description: `${tx.description} (세액)`,
                                                    vendor: tx.vendor,
                                                    debitAccount: '부가세대급금',
                                                    creditAccount,
                                                    amount: tx.taxAmount,
                                                    vat: 0,
                                                    type: tx.entryType as any,
                                                    status: 'Unconfirmed',
                                                    complianceContext: tx.reasoning,
                                                    auditTrail: [`Split-to-Ledger (Tax) at ${new Date().toISOString()}`]
                                                });
                                            }
                                            if (tx.benefitAmount) {
                                                allNewEntries.push({
                                                    id: await getNewId(),
                                                    transactionId: groupId,
                                                    date: baseDate,
                                                    description: `${tx.description} (할인/혜택)`,
                                                    vendor: tx.vendor,
                                                    debitAccount: creditAccount,
                                                    creditAccount: '잡이익',
                                                    amount: tx.benefitAmount,
                                                    vat: 0,
                                                    type: tx.entryType as any,
                                                    status: 'Unconfirmed',
                                                    complianceContext: tx.reasoning,
                                                    auditTrail: [`Split-to-Ledger (Benefit) at ${new Date().toISOString()}`]
                                                });
                                            }
                                        } else {
                                            // Standard Path
                                            allNewEntries.push({
                                                id: await getNewId(),
                                                transactionId: groupId,
                                                date: baseDate,
                                                description: tx.description,
                                                vendor: tx.vendor,
                                                debitAccount,
                                                creditAccount,
                                                amount: tx.amount,
                                                vat: tx.vat,
                                                type: tx.entryType as any,
                                                status: 'Unconfirmed',
                                                complianceContext: tx.reasoning,
                                                attachmentUrl: (tx as any).attachmentUrl,
                                                auditTrail: [`Staged-to-Ledger at ${new Date().toISOString()}`]
                                            });
                                        }
                                    }

                                    const entries = allNewEntries;

                                    if (entries.length === 0) {
                                        alert('전송할 전표가 없습니다. 먼저 AI 분석을 통해 계정과목을 지정해 주세요.');
                                        return;
                                    }

                                    // Desktop-only Validation
                                    if (isTauri()) {
                                        const result = await invoke<any>('batch_export_with_validation', { entries });
                                        if (result.anomalies && result.anomalies.length > 0) {
                                            const anomalyMsg = result.anomalies.slice(0, 5).join('\n');
                                            const confirm = window.confirm(
                                                `⚠️ 이상 징후 탐지 (${result.anomalies.length}건):\n\n${anomalyMsg}\n\n계속하시겠습니까?`
                                            );
                                            if (!confirm) {
                                                setIsValidating(false);
                                                return;
                                            }
                                        }
                                    }

                                    onConfirm(entries as any);
                                    alert(`✅ ${entries.length}건의 전표가 회계 장부에 등록되었습니다.`);
                                } catch (error) {
                                    console.error('[Batch Export] 검증 실패:', error);
                                    alert(`전송 중 오류가 발생했습니다. 다시 시도해 주세요.`);
                                } finally {
                                    setIsValidating(false);
                                }
                            }}
                            disabled={isValidating}
                            className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isValidating ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    전표 생성 및 검증 중...
                                </>
                            ) : (
                                <>
                                    <Shield size={18} />
                                    회계 장부에 일괄 전송 ({stagedData.filter(r => r.accountName).length}건)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};
