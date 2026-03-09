
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
    Calendar,
    Lock,
    Unlock,
    PlayCircle,
    CheckCircle,
    AlertTriangle,
    FileText,
    ArrowRight,
    ShieldCheck,
    RefreshCw,
    Printer,
    FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

interface AccountingPeriod {
    id: string;
    year: number;
    month: number;
    status: 'OPEN' | 'CLOSED' | 'TRIAL' | 'SOFT_LOCKED';
    closed_at: string | null;
    closed_by: string | null;
    ledger_hash: string | null;
}

interface JournalEntry {
    id: string;
    date: string;
    description: string;
    debit_account: string;
    credit_account: string;
    amount: number;
}

const PeriodClosing: React.FC = () => {
    const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<AccountingPeriod | null>(null);
    const [trialEntries, setTrialEntries] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    useEffect(() => {
        fetchPeriods();
    }, []);

    const fetchPeriods = async () => {
        try {
            const result = await invoke<AccountingPeriod[]>('get_accounting_periods');
            setPeriods(result);
        } catch (error) {
            console.error('Failed to fetch periods:', error);
        }
    };

    const handleRunPreview = async () => {
        if (!selectedPeriod) return;
        setIsLoading(true);
        setTrialEntries([]);
        setMessage(null);

        try {
            const result = await invoke<JournalEntry[]>('run_closing_preview', { periodId: selectedPeriod.id });
            setTrialEntries(result);
            if (result.length === 0) {
                setMessage({ type: 'error', text: '결산할 대상 전표가 없습니다. 기간 내 승인된 전표를 확인하세요.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: `미리보기 생성 실패: ${error}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportExcel = () => {
        if (trialEntries.length === 0) return;

        const data = trialEntries.map(e => ({
            '날짜 (Date)': e.date,
            '적요 (Description)': e.description,
            '차변 계정 (Debit)': e.debit_account,
            '대변 계정 (Credit)': e.credit_account,
            '금액 (Amount)': e.amount
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Simulation");
        XLSX.writeFile(wb, `Closing_Simulation_${selectedPeriod?.year}_${selectedPeriod?.month}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExecuteClosing = async () => {
        if (!selectedPeriod) return;
        setIsLoading(true);
        setShowConfirmModal(false);

        try {
            await invoke('run_closing_execution', {
                periodId: selectedPeriod.id,
                user: 'System Admin' // In real app, get from auth
            });
            setMessage({ type: 'success', text: `${selectedPeriod.year}년 ${selectedPeriod.month}월 결산이 성공적으로 마감(HARD LOCK)되었습니다.` });
            setTrialEntries([]);
            fetchPeriods(); // Refresh
            setSelectedPeriod(null);
        } catch (error) {
            setMessage({ type: 'error', text: `결산 마감 실패: ${error}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSoftLock = async () => {
        if (!selectedPeriod) return;
        setIsLoading(true);

        try {
            await invoke('run_soft_lock', {
                periodId: selectedPeriod.id,
                user: 'System Admin'
            });
            setMessage({ type: 'success', text: `${selectedPeriod.year}년 ${selectedPeriod.month}월 기간이 소프트 마감(SOFT LOCK) 처리되었습니다.` });
            fetchPeriods();
            setSelectedPeriod(null);
        } catch (error) {
            setMessage({ type: 'error', text: `소프트 마감 실패: ${error}` });
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'CLOSED':
                return <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-bold flex items-center gap-1"><Lock className="w-3 h-3" /> 마감됨</span>;
            case 'SOFT_LOCKED':
                return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> 소프트마감</span>;
            case 'TRIAL':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> 가결산중</span>;
            default:
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold flex items-center gap-1"><Unlock className="w-3 h-3" /> 가동중</span>;
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Lock className="w-6 h-6 text-blue-600" /> 회계 기간 마감 (Period Closing)
                    </h2>
                    <p className="text-slate-500 mt-1">결산 마감 시 해당 기간의 전표는 수정이 불가능한 'Immutable' 상태로 고정됩니다.</p>
                </div>
                <button
                    onClick={fetchPeriods}
                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors bg-white rounded-lg border border-slate-200 shadow-sm"
                    title="새로고침"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
                {/* Period Selection */}
                <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> 회계 기간 목록
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                        {periods.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedPeriod(p)}
                                className={`w-full text-left p-4 hover:bg-blue-50 transition-colors flex justify-between items-center ${selectedPeriod?.id === p.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                            >
                                <div>
                                    <p className="font-bold text-slate-900">{p.year}년 {p.month}월</p>
                                    <p className="text-[10px] text-slate-400 mt-1">{p.id.substring(0, 8)}...</p>
                                </div>
                                {getStatusBadge(p.status)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Closing Action Area */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    {!selectedPeriod ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                            <ShieldCheck className="w-16 h-16 mb-4 opacity-10" />
                            <p className="text-lg font-bold">마감할 회계 기간을 선택해주세요.</p>
                            <p className="text-sm mt-1">좌측 목록에서 마감 프로세스를 진행할 연월을 선택하세요.</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col p-6 space-y-6">
                            <div className="flex justify-between items-start border-b pb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{selectedPeriod.year}년 {selectedPeriod.month}월 결산 프로세스</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        {getStatusBadge(selectedPeriod.status)}
                                        <span className="text-sm text-slate-500">|</span>
                                        <span className="text-sm text-slate-500">상태: {selectedPeriod.status === 'OPEN' ? '전표 수정 가능' : '수정 불가'}</span>
                                    </div>
                                </div>
                                {selectedPeriod.status === 'OPEN' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleRunPreview}
                                            disabled={isLoading}
                                            className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2 text-sm"
                                        >
                                            <PlayCircle className="w-4 h-4" /> 미리보기 (Simulation)
                                        </button>
                                        <button
                                            onClick={handleSoftLock}
                                            disabled={isLoading}
                                            className="px-4 py-2 bg-orange-100 text-orange-700 font-bold rounded-lg hover:bg-orange-200 transition-colors flex items-center gap-2 text-sm"
                                            title="소프트 마감 (관리자 이외 수정 제한)"
                                        >
                                            <ShieldCheck className="w-4 h-4" /> SOFT LOCK
                                        </button>
                                        {trialEntries.length > 0 && (
                                            <>
                                                <button
                                                    onClick={handleExportExcel}
                                                    className="px-4 py-2 bg-emerald-100 text-emerald-700 font-bold rounded-lg hover:bg-emerald-200 transition-colors flex items-center gap-2 text-sm"
                                                    title="엑셀로 내보내기"
                                                >
                                                    <FileSpreadsheet className="w-4 h-4" /> EXCEL
                                                </button>
                                                <button
                                                    onClick={handlePrint}
                                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm"
                                                    title="인쇄"
                                                >
                                                    <Printer className="w-4 h-4" /> PRINT
                                                </button>
                                                <button
                                                    onClick={() => setShowConfirmModal(true)}
                                                    className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center gap-2 text-sm"
                                                >
                                                    <Lock className="w-4 h-4" /> 최종 마감 실행
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {message && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}
                                >
                                    {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                                    <p className="text-sm font-medium">{message.text}</p>
                                </motion.div>
                            )}

                            {trialEntries.length > 0 ? (
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <div className="mb-4">
                                        <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-blue-600" /> 생성 예정 결산 전표 (Simulation Results)
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-1">수익/비용 마감 및 이익잉여금 대체 전표입니다.</p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto border rounded-lg border-slate-100 shadow-inner bg-slate-50">
                                        <table className="min-w-full divide-y divide-slate-200">
                                            <thead className="bg-slate-100 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">날짜</th>
                                                    <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">적요</th>
                                                    <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">차변 계정</th>
                                                    <Th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">대변 계정</Th>
                                                    <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase">금액</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {trialEntries.map(entry => (
                                                    <tr key={entry.id} className="text-sm bg-white hover:bg-blue-50/50">
                                                        <td className="px-4 py-2 font-mono text-xs">{entry.date}</td>
                                                        <td className="px-4 py-2 text-xs">{entry.description}</td>
                                                        <td className="px-4 py-2 text-xs font-bold text-blue-900">{entry.debit_account}</td>
                                                        <td className="px-4 py-2 text-xs font-bold text-slate-600">{entry.credit_account}</td>
                                                        <td className="px-4 py-2 text-right font-bold text-blue-600">₩{entry.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                !isLoading && !message && (
                                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                                        <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center max-w-sm">
                                            <PlayCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                            <p className="text-sm text-slate-600 font-medium">'미리보기'를 실행하여 결산 전표를 확인하십시오.</p>
                                            <p className="text-[11px] text-slate-400 mt-2">시스템이 자동으로 수익과 비용을 집계하여 마감 전표를 생성합니다.</p>
                                        </div>
                                    </div>
                                )
                            )}

                            {isLoading && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                                    <div className="text-center">
                                        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                                        <p className="font-bold text-slate-800 italic">Financial Engine Running...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {showConfirmModal && selectedPeriod && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowConfirmModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-8 border border-slate-200"
                        >
                            <div className="text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                                    <Lock className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">최종 결산 마감</h3>
                                <p className="text-slate-500 mb-6 leading-relaxed">
                                    <strong>{selectedPeriod.year}년 {selectedPeriod.month}월</strong> 회계를 마감하시겠습니까?<br />
                                    마감이 완료되면 해당 기간의 모든 데이터는 수정이 불가능하며, 소급 입력을 할 수 없습니다.
                                </p>

                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-left mb-6 space-y-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Summary</p>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600">생성될 전표 수</span>
                                        <span className="font-bold text-slate-900">{trialEntries.length}건</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600">수행 주체</span>
                                        <span className="font-bold text-blue-600">System Admin</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowConfirmModal(false)}
                                        className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleExecuteClosing}
                                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        마감 실행 <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Th: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
    <th className={className}>{children}</th>
);

export default PeriodClosing;
