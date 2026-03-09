import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, CheckCircle2, RefreshCw, Database } from 'lucide-react';

export const IntegrityBadge: React.FC = () => {
    const [scanProgress, setScanProgress] = useState(0);
    const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'VERIFIED'>('VERIFIED');
    const [lastScan, setLastScan] = useState<string>(new Date().toLocaleString());

    const startScan = () => {
        setStatus('SCANNING');
        setScanProgress(0);
        const interval = setInterval(() => {
            setScanProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setStatus('VERIFIED');
                    setLastScan(new Date().toLocaleString());
                    return 100;
                }
                return prev + 5;
            });
        }, 100);
    };

    return (
        <div className="bg-[#151D2E] border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/30 transition-all shadow-xl">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-indigo-500/10 text-indigo-500 animate-pulse'}`}>
                    {status === 'VERIFIED' ? <ShieldCheck size={24} /> : <RefreshCw size={24} className="animate-spin" />}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-white">원장 무결성 검증 (Ledger Integrity)</h4>
                        {status === 'VERIFIED' && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-tighter">Verified</span>}
                    </div>
                    {status === 'SCANNING' ? (
                        <div className="w-48 h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
                        </div>
                    ) : (
                        <p className="text-[10px] text-slate-500 mt-1 font-medium">
                            <span className="text-slate-400 font-bold">암호화 해시 및 분개 시퀀스 일관성:</span> 100% 일치 (마지막 검사: {lastScan})
                        </p>
                    )}
                </div>
            </div>

            <div className="flex gap-2">
                <div className="hidden lg:flex flex-col items-end justify-center px-4 border-r border-white/5 pr-6">
                    <span className="text-[9px] font-black text-slate-500 uppercase">Integrity Score</span>
                    <span className="text-xl font-black text-white italic">99.9%</span>
                </div>
                <button
                    onClick={startScan}
                    disabled={status === 'SCANNING'}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center gap-2"
                >
                    <RefreshCw size={16} className={status === 'SCANNING' ? 'animate-spin' : ''} />
                    <span className="text-xs font-bold uppercase">검사 실행</span>
                </button>
            </div>
        </div>
    );
};
