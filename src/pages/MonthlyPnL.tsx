import React, { useState } from 'react';
import { Download, Share2, Upload, Plus, Calculator, Settings2, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';

export const MonthlyPnL: React.FC = () => {
    const [scenario, setScenario] = useState('Base');

    return (
        <div className="flex-1 bg-slate-900 min-h-screen text-slate-100 p-8">
            <header className="flex flex-col gap-2 mb-8 border-b border-white/5 pb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm uppercase tracking-wider">STRATEGIC FORECASTING</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">월별 손익 (3개년 시뮬레이션)</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-white/5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all">
                            <Upload size={14} /> EXCEL IMPORT
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-white/5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all">
                            <Download size={14} /> EXPORT
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold text-white transition-all shadow-lg">
                            <Plus size={14} /> NEW SCENARIO
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 mt-4">
                    {['Base', 'Best Case', 'Worst Case', 'Expansion Plan'].map(s => (
                        <button
                            key={s}
                            onClick={() => setScenario(s)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${scenario === s ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-white/5 hover:bg-slate-700'}`}
                        >
                            {s} Baseline
                        </button>
                    ))}
                </div>
            </header>

            <div className="bg-[#1A1F2B] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">손익 시뮬레이션 모델 (P&L Model)</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Calculator size={14} /> 단위: 천원
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-white/10 text-slate-400 font-bold bg-[#121620]">
                                <th className="p-4 rounded-tl-lg">과목 (Account)</th>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <th key={i} className="p-4 text-right">{i + 1}월</th>
                                ))}
                                <th className="p-4 text-right text-indigo-400 rounded-tr-lg">연간 합계</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            <tr className="hover:bg-white/5">
                                <td className="p-4 font-bold text-emerald-400 flex items-center gap-2">매출액 <Settings2 size={12} /></td>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <td key={i} className="p-4 text-right font-mono">15,000</td>
                                ))}
                                <td className="p-4 text-right font-bold text-indigo-400">180,000</td>
                            </tr>
                            <tr className="hover:bg-white/5 text-slate-300">
                                <td className="p-4 flex items-center gap-2 pl-8">- 매출원가</td>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <td key={i} className="p-4 text-right font-mono">6,000</td>
                                ))}
                                <td className="p-4 text-right font-bold text-slate-400">72,000</td>
                            </tr>
                            <tr className="bg-slate-800/50 hover:bg-white/5 font-bold">
                                <td className="p-4 text-white">매출총이익</td>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <td key={i} className="p-4 text-right font-mono text-white">9,000</td>
                                ))}
                                <td className="p-4 text-right font-bold text-indigo-400">108,000</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-6">
                <div className="bg-[#1A1F2B] border border-white/5 rounded-2xl p-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><BarChart3 size={14} /> Break-Even Point (BEP)</h4>
                    <div className="text-3xl font-black text-white">₩65.2M / 월</div>
                    <div className="mt-2 text-xs text-emerald-400 bg-emerald-500/10 inline-block px-2 py-1 rounded">현재 매출 내에서 커버 가능</div>
                </div>
                <div className="bg-[#1A1F2B] border border-white/5 rounded-2xl p-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><TrendingUp size={14} /> Revenue Leverage</h4>
                    <div className="text-3xl font-black text-white">3.2x</div>
                    <div className="mt-2 text-xs text-indigo-400 bg-indigo-500/10 inline-block px-2 py-1 rounded">고정비 분산 효과 우수</div>
                </div>
                <div className="bg-[#1A1F2B] border border-white/5 rounded-2xl p-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Opex Sensitivity</h4>
                    <div className="text-3xl font-black text-white">+12%</div>
                    <div className="mt-2 text-xs text-rose-400 bg-rose-500/10 inline-block px-2 py-1 rounded">인건비 상승에 가장 취약함</div>
                </div>
            </div>
        </div>
    );
};

export default MonthlyPnL;
