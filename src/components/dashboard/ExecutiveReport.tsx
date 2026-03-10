import React from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Target,
    ShieldCheck,
    Download,
    Cpu,
    Zap,
    AlertCircle
} from 'lucide-react';

export const ExecutiveReport: React.FC = () => {
    const kpis = [
        { label: '영업이익률', value: 3.4, target: 15, color: 'bg-emerald-500' },
        { label: '부채비율', value: 2.1, target: 100, color: 'bg-indigo-500' },
        { label: '당좌비율', value: 852, target: 150, color: 'bg-emerald-500' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Report Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                            Management Confidential
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">2027-12 Financial Performance Report</h1>
                    <p className="text-slate-500 font-bold text-sm mt-1 uppercase tracking-wider">AI Generated Executive Summary</p>
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-[#151D2E] text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all border border-white/5 shadow-xl active:scale-95">
                    <Download size={14} /> PDF 리포트 다운로드
                </button>
            </div>

            {/* Top Summary Badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: '총 매출액 (Revenue)', value: '₩1,850,250,400', trend: '+12.5%', color: 'text-emerald-400' },
                    { label: '당기순이익 (Net Income)', value: '₩62,450,830', trend: '-2.1%', color: 'text-rose-400' },
                    { label: '총 자본 (Total Equity)', value: '₩2,450,000,000', trend: 'STABLE', color: 'text-indigo-400' },
                    { label: '최종 가용 현금 (Final Cash)', value: '₩59,545,830', trend: 'WATCH', color: 'text-amber-400' },
                ].map((item, idx) => (
                    <div key={idx} className="bg-[#151D2E] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                        <h4 className="text-xl font-black text-white tracking-tighter mb-2">{item.value}</h4>
                        <span className={`text-[10px] font-bold ${item.trend.startsWith('+') ? 'text-emerald-400' : item.trend.startsWith('-') ? 'text-rose-400' : 'text-slate-400'}`}>
                            {item.trend} VS Prev Month
                        </span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AI CFO Management Briefing */}
                <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900/20 to-transparent border border-indigo-500/20 rounded-3xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Cpu size={120} />
                    </div>

                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/40">
                            <Zap className="text-white" size={20} />
                        </div>
                        <h3 className="text-xl font-black text-white tracking-tight">AI CFO Management Briefing</h3>
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div className="space-y-2">
                            <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                <Target size={14} /> 핵심 재무 성과 및 리스크 진단
                            </h4>
                            <p className="text-slate-300 font-bold leading-relaxed">
                                이번 회계 기간 동안 매출은 목표 대비 102% 달성하며 견조한 성장세를 보였습니다. 다만, R&D 인력 확충에 따른 인건비 가공비 비중이
                                전 분기 대비 15% 상승하며 영업이익률이 일시적으로 하락했습니다. 현재 런웨이는 5.8개월로, 6개월 가이드라인을 하회하기 시작했습니다.
                                <span className="text-rose-400 ml-1">차월부터는 불요불급한 고정비 지출을 동결할 것을 강력히 권고합니다.</span>
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">긍정적 시그널</p>
                                <p className="text-xs font-bold text-slate-400">Naver Cloud 매출 채권 회수 완료 (₩850M)</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">부정적 시그널</p>
                                <p className="text-xs font-bold text-slate-400">기재 파편도 14.3% 상승 (월말 몰아치기 기재 관측)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Financial Ratios (KPIs) */}
                <div className="bg-[#151D2E] border border-white/5 rounded-3xl p-8 space-y-8">
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                        <ShieldCheck className="text-indigo-400" size={16} /> 핵심 재무 비율 (KPIs)
                    </h3>

                    <div className="space-y-6">
                        {kpis.map((kpi, idx) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-black text-slate-400">{kpi.label}</span>
                                    <span className="text-sm font-black text-white">{kpi.value}{idx === 0 ? '%' : idx === 1 ? '%' : '%'}</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, (kpi.value / kpi.target) * 100)}%` }}
                                        transition={{ duration: 1, delay: idx * 0.2 }}
                                        className={`h-full ${kpi.color}`}
                                    />
                                </div>
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                    <span className="text-slate-600">Min: 0</span>
                                    <span className="text-indigo-500/50">Target: {kpi.target}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-white/5">
                        <div className="flex items-start gap-3 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                            <AlertCircle className="text-amber-500 shrink-0" size={14} />
                            <p className="text-[10px] font-bold text-amber-200/70 leading-relaxed">
                                부채비율이 매우 낮으나, 이는 레버지리를 활용한 성장이 정체되었음을 의미할 수도 있습니다. 적정 수준의 타인자본 조달 검토가 필요합니다.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
