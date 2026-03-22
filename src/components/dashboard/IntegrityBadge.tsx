import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Lock, CheckCircle2, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { JournalEntry, FinancialSummary, LedgerLine, TrialBalance } from '../../types';
import { runEngineStressTest, IntegrityReport } from '../../utils/integrityChecker';

interface IntegrityBadgeProps {
    ledger: JournalEntry[];
    accountingLedger: LedgerLine[];
    trialBalance: TrialBalance;
    financials: FinancialSummary;
    reportingDate: string;
}

export const IntegrityBadge: React.FC<IntegrityBadgeProps> = ({ ledger, accountingLedger, trialBalance, financials, reportingDate }) => {
    const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'DONE'>('IDLE');
    const [scanProgress, setScanProgress] = useState(0);

    const report = useMemo(() => {
        return runEngineStressTest(ledger, accountingLedger, trialBalance, financials, reportingDate);
    }, [ledger, accountingLedger, trialBalance, financials, reportingDate]);

    useEffect(() => {
        // Simple animation to simulate scanning when report changes or components mounts
        setStatus('SCANNING');
        setScanProgress(0);
        const interval = setInterval(() => {
            setScanProgress(p => {
                if (p >= 100) {
                    clearInterval(interval);
                    setStatus('DONE');
                    return 100;
                }
                return p + 10;
            });
        }, 50);
        return () => clearInterval(interval);
    }, [report.status, reportingDate]);

    return (
        <div className="bg-[#151D2E] border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-indigo-500/30 transition-all shadow-xl">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    status === 'SCANNING' ? 'bg-indigo-500/10 text-indigo-500 animate-pulse' :
                    report.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 
                    'bg-rose-500/10 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                }`}>
                    {status === 'SCANNING' ? <RefreshCw size={24} className="animate-spin" /> :
                     report.status === 'PASS' ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-white italic tracking-tight">SYSTEM INTEGRity STATUS</h4>
                        {status === 'DONE' && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${
                                report.status === 'PASS' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                            }`}>
                                {report.status}
                            </span>
                        )}
                    </div>
                    
                    {status === 'SCANNING' ? (
                        <div className="w-48 h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 mt-1">
                            <p className="text-[10px] text-slate-500 font-medium">
                                <span className="text-slate-400 font-bold">Health Score:</span> {report.score}% | 
                                <span className="text-slate-400 font-bold ml-1">Verified Up To:</span> {reportingDate}
                            </p>
                            {report.issues.length > 0 && (
                                <div className="flex items-center gap-1.5 text-[9px] text-rose-400 font-bold">
                                    <Info size={10} />
                                    <span>Detected {report.issues.length} discrepancies in engine pipeline.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-4 items-center">
                <div className="hidden lg:flex flex-col items-end justify-center px-4 border-r border-white/5 pr-6">
                    <span className="text-[9px] font-black text-slate-500 uppercase">Integrity Score</span>
                    <span className={`text-xl font-black italic ${report.score >= 90 ? 'text-white' : report.score >= 70 ? 'text-amber-400' : 'text-rose-500'}`}>
                        {report.score}%
                    </span>
                </div>
                {report.issues.length > 0 && (
                    <div className="flex -space-x-2">
                        {report.issues.map((issue, i) => (
                            <div key={i} title={issue} className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-500">
                                <AlertTriangle size={14} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
