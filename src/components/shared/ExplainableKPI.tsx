import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Info, ChevronDown, ChevronUp, Database, Clock } from 'lucide-react';
import { MetricResult } from '../../core/reporting/metricRegistry';

interface ExplainableKPIProps {
    label: string;
    result: MetricResult | null;
    color?: string;
    icon?: React.ReactNode;
    formatValue?: (val: number) => React.ReactNode;
    description?: string; // Qualitative explanation (hover tooltip)
    onClick?: () => void;
}

export const ExplainableKPI: React.FC<ExplainableKPIProps> = ({ 
    label, 
    result, 
    color = "text-blue-400", 
    icon, 
    formatValue = (v) => v.toLocaleString(),
    description,
    onClick
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    if (!result) return null;

    return (
        <div className="relative group/wrapper h-full">
            {/* Tooltip Layer (Qualitative) */}
            <AnimatePresence>
                {isHovered && description && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-4 w-72 p-5 bg-[#0B1221] border border-white/10 rounded-[2rem] shadow-3xl z-[100] pointer-events-none"
                    >
                         <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                             <Info size={14} /> 지표 통찰 (Metric Insight)
                        </p>
                        <p className="text-xs text-slate-400 leading-relaxed font-bold whitespace-normal italic">
                            {description}
                        </p>
                        <div className="absolute -bottom-1.5 left-10 w-3 h-3 bg-[#0B1221] border-b border-r border-white/10 transform rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>

            <div 
                className={`bg-[#121620] rounded-[2rem] border border-white/5 shadow-xl transition-all flex flex-col h-full overflow-hidden ${onClick ? 'cursor-pointer hover:border-indigo-500/30' : 'hover:border-white/10'}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div 
                    className="p-6 cursor-pointer group flex-1 flex flex-col"
                    onClick={(e) => {
                        if (onClick) {
                            onClick();
                        } else {
                            setIsExpanded(!isExpanded);
                        }
                    }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest leading-tight">{label}</p>
                            {description && <Info size={10} className="text-slate-700 group-hover:text-indigo-400 transition-colors" />}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-slate-600 group-hover:text-blue-400 transition-colors overflow-hidden">
                                {icon || <Calculator size={16} />}
                            </div>
                            {!onClick && (isExpanded ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />)}
                        </div>
                    </div>
                    
                    <div className="mt-auto">
                        <h4 className={`text-2xl font-black italic tracking-tighter ${color}`}>
                            {formatValue(result.value)}
                        </h4>
                        
                        <p className="text-[11px] font-bold text-slate-600 uppercase italic mt-1 flex items-center gap-1">
                            <Database size={10} /> {result.dataSource === 'scenario' ? 'SCENARIO (시뮬레이션)' : 'ACTUAL (실제 장부)'} 데이터 기반
                        </p>
                    </div>
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-black/20 border-t border-white/5"
                        >
                            <div className="p-6 space-y-4">
                                <div>
                                    <p className="text-[13px] font-black text-blue-400 uppercase tracking-tighter mb-2 flex items-center gap-2">
                                        <Calculator size={14} /> 계산 근거 분석 (Calculation Analysis)
                                    </p>
                                    <div className="space-y-2">
                                        {Object.entries(result.inputs ?? {}).map(([key, val]) => (
                                            <div key={key} className="flex justify-between items-center text-[12px]">
                                                <span className="text-slate-500 font-bold">{key}</span>
                                                <span className="text-white font-mono">{typeof val === 'number' ? val.toLocaleString() : val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-white/5">
                                    <p className="text-[12px] font-black text-emerald-400 uppercase tracking-tighter mb-1">산정 공식 (Formula)</p>
                                    <p className="text-[12px] font-mono text-slate-300 bg-white/5 p-2 rounded-lg italic text-wrap break-all">
                                        {result.formula}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest pt-2">
                                    <span className="flex items-center gap-1.5"><Clock size={10} /> {result.period}</span>
                                    <span className="text-blue-500/50">#투명한_계산_검증</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
