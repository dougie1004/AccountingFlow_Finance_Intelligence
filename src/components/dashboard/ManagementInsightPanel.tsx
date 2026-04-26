import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle, Info, ArrowRight, TrendingUp } from 'lucide-react';
import { generateVendorInsights, VendorInsight } from '../../core/intelligence/vendorInsightEngine';
import { JournalEntry } from '../../types';

interface ManagementInsightPanelProps {
    ledger: JournalEntry[];
    systemNow: string;
}

export const ManagementInsightPanel: React.FC<ManagementInsightPanelProps> = ({ ledger, systemNow }) => {
    const insights = useMemo(() => {
        return generateVendorInsights(ledger, new Date(systemNow));
    }, [ledger, systemNow]);

    if (insights.length === 0) return null;

    return (
        <div className="bg-[#151D2E] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                        <Zap size={24} className="animate-pulse" />
                    </div>
                    <h3 className="text-xl font-black text-white tracking-tight italic uppercase">AI Management Insights</h3>
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    Real-time Analysis
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.map((insight, idx) => (
                    <InsightCard key={idx} insight={insight} />
                ))}
            </div>
        </div>
    );
};

const InsightCard: React.FC<{ insight: VendorInsight }> = ({ insight }) => {
    const config = {
        SUBSCRIPTION: {
            icon: <Info size={16} />,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20'
        },
        SPENDING_SPIKE: {
            icon: <AlertTriangle size={16} />,
            color: insight.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400',
            bg: insight.severity === 'CRITICAL' ? 'bg-rose-500/10' : 'bg-amber-500/10',
            border: insight.severity === 'CRITICAL' ? 'border-rose-500/20' : 'border-amber-500/20'
        },
        NEW_VENDOR: {
            icon: <TrendingUp size={16} />,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20'
        }
    };

    const style = config[insight.type];

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-3xl border ${style.border} ${style.bg} flex flex-col justify-between gap-4 group hover:bg-opacity-20 transition-all cursor-default`}
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 ${style.color}`}>
                        {style.icon}
                        <span className="text-[10px] font-black uppercase tracking-widest">{insight.type}</span>
                    </div>
                </div>
                <p className="text-sm font-bold text-white leading-relaxed">
                    {insight.message}
                </p>
            </div>
            
            <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{insight.vendor}</span>
                <div className="p-1.5 rounded-lg bg-white/5 text-slate-500 group-hover:text-white transition-colors">
                    <ArrowRight size={12} />
                </div>
            </div>
        </motion.div>
    );
};
