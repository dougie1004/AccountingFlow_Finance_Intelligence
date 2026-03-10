import React from 'react';
import { ShieldAlert, Zap, Calendar, Target, HelpCircle, ArrowUpRight } from 'lucide-react';
import { FinancialSignal } from '../../core_engine/SignalEngine';
import { Tooltip } from '../common/Tooltip';

interface RiskSnapshotProps {
    signals: FinancialSignal[];
    onSignalClick?: (signal: FinancialSignal) => void;
}

export const RiskSnapshot: React.FC<RiskSnapshotProps> = ({ signals, onSignalClick }) => {
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Stable': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'Warning': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'Critical': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-white/5';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="text-indigo-400" size={18} />
                    <h3 className="text-sm font-black text-white tracking-tight">경영 방어선 요약 (CFO Risk Snapshot)</h3>
                </div>
                <div className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                    Real-time Analysis
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {signals.map((signal) => (
                    <div
                        key={signal.id}
                        onClick={() => onSignalClick?.(signal)}
                        className="bg-[#151D2E] border border-white/5 p-5 rounded-2xl hover:border-indigo-500/30 transition-all group relative overflow-hidden cursor-pointer active:scale-[0.98]"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-tighter ${getStatusStyle(signal.status)}`}>
                                {signal.status}
                            </span>
                            <div className="text-slate-500 group-hover:text-indigo-400 transition-colors">
                                <ArrowUpRight size={14} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                {signal.title}
                                <Tooltip content={signal.description} position="top">
                                    <HelpCircle size={10} className="cursor-help" />
                                </Tooltip>
                            </p>
                            <div className="flex items-baseline gap-2">
                                <h4 className="text-2xl font-black text-white tracking-tighter">{signal.value}</h4>
                                {signal.changeText && (
                                    <span className={`text-[10px] font-bold ${signal.trend === 'Up' ? 'text-emerald-400' : signal.trend === 'Down' ? 'text-rose-400' : 'text-slate-500'}`}>
                                        {signal.changeText}
                                    </span>
                                )}
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-400 font-bold mt-3 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">
                            {signal.description}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};
