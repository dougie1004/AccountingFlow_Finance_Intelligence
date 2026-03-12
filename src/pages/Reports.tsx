import React, { useMemo } from 'react';
import { useAccounting } from '../hooks/useAccounting';
import { Download, Share2, ArrowLeft, ShieldCheck, CheckCircle2, TrendingUp, TrendingDown, Clock, FileText } from 'lucide-react';

export const Reports: React.FC = () => {
    const { financials } = useAccounting();

    // Data from screenshot 5
    const revenue = 10149650;
    const netIncome = -2671683;
    const equity = 65591973;
    const cash = 59545830;

    return (
        <div className="flex-1 bg-[#121620] min-h-screen text-slate-100 p-8 font-sans">
            {/* Header */}
            <header className="flex flex-col gap-2 mb-8 border-b border-white/5 pb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 bg-[#1A1F2B] border border-white/5 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm uppercase tracking-wider">공식 경영 리포트 (EXECUTIVE REPORT)</span>
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">2027-12 재무 성과 리포트</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-[#1A1F2B] border border-white/5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all">
                            <Download size={14} /> PDF
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg text-xs font-bold text-white transition-all shadow-lg">
                            <Share2 size={14} /> SHARE
                        </button>
                    </div>
                </div>
            </header>

            {/* Top Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-[#1A1F2B] p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10">
                        <TrendingUp size={120} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">당월 총 매출 <span className="text-slate-600">(REVENUE)</span></p>
                    <h2 className="text-2xl font-black text-white">₩10,149,650</h2>
                </div>

                <div className="bg-[#1A1F2B] p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10">
                        <Target size={120} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">당기 순이익 <span className="text-slate-600">(NET INCOME)</span></p>
                    <h2 className="text-2xl font-black text-rose-400">₩-2,671,683</h2>
                    <p className="text-[10px] text-slate-500 mt-1 font-bold">이익률: -26.3%</p>
                </div>

                <div className="bg-[#1A1F2B] p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 text-white">
                        <Activity size={120} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">자본 총계 <span className="text-slate-600">(TOTAL EQUITY)</span></p>
                    <h2 className="text-2xl font-black text-white">₩65,591,973</h2>
                    <p className="text-[10px] text-slate-500 mt-1 font-bold">부채비율: 11.2%</p>
                </div>

                <div className="bg-[#1A1F2B] p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 text-emerald-400">
                        <Zap size={120} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">기말 현금 잔액 <span className="text-slate-600">(CASH)</span></p>
                    <h2 className="text-2xl font-black text-emerald-400">₩59,545,830</h2>
                    <p className="text-[10px] text-slate-500 mt-1 font-bold">현금 유동성 확보됨</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-12 gap-6">

                {/* AI CFO 경영 브리핑 */}
                <div className="col-span-8 bg-[#121626] border-2 border-indigo-500/20 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.03]">
                        <ShieldCheck size={300} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">AI CFO 경영 브리핑</h2>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Strategic Intelligence Report</p>
                            </div>
                        </div>

                        <div className="space-y-6 text-sm leading-relaxed text-slate-300 font-medium">
                            <p>[AI 경영 브리핑]</p>

                            <p className="text-white font-bold">문제점:</p>
                            <p>1. 심각한 순손실 발생: 이번 달 ₩2,671,683원의 순손실은 매우 우려스러운 상황입니다. 매출액(₩10,149,650원) 대비 과도한 비용 지출이 발생했음을 시사합니다. 특히 급여(₩7,800,000원)와 광고선전비(₩3,328,000원)가 매출액 대비 큰 비중을 차지하고 있습니다.</p>

                            <p className="text-white font-bold mt-8">개선 방향:</p>
                            <ol className="list-decimal pl-5 space-y-4">
                                <li>
                                    <span className="text-slate-200">비용 구조 긴급 점검 및 효율화:</span>
                                    <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
                                        <li>급여 수준의 적정성 및 인력 운영 효율성을 검토하고, 불필요한 인력 감축 또는 업무 재배치를 고려해야 합니다.</li>
                                        <li>광고선전비 지출의 효과를 측정하고, ROI가 낮은 광고 채널을 즉시 중단해야 합니다.</li>
                                        <li>지급임차료 외 다른 운영 비용에 대한 심층 분석을 통해 절감 방안을 모색해야 합니다.</li>
                                    </ul>
                                </li>
                                <li>
                                    <span className="text-slate-200">매출 증대 방안 강구:</span>
                                    <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
                                        <li>SaaS 제품의 경쟁력을 강화하고, 신규 고객 유치 및 기존 고객 유지율을 높이기 위한 전략을 수립해야 합니다.</li>
                                        <li>매출 다각화를 위해 새로운 수익 모델 개발을 고려해야 합니다.</li>
                                    </ul>
                                </li>
                            </ol>

                            <p className="text-emerald-400 font-bold mt-8">칭찬할 점:</p>
                            <p>1. 건전한 자산 및 리스 상태: 고정자산 상각률이 0%이고, 현재 인식된 리스 부채가 없다는 점은 재무적으로 안정적인 상태임을 나타냅니다. 다만, 자산 활용도를 높여 수익 창출에 기여할 수 있도록 관리해야 합니다.</p>
                        </div>

                        <div className="mt-12 flex items-center justify-between border-t border-white/10 pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#121626] flex items-center justify-center text-[10px] font-bold text-slate-400">VC</div>
                                    <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-[#121626] flex items-center justify-center text-[10px] font-bold text-slate-300">CEO</div>
                                    <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-[#121626] flex items-center justify-center text-[10px] font-bold text-white">CFO</div>
                                </div>
                                <span className="text-xs font-bold text-slate-400">경영진 3명이 이 리포트를 검토했습니다.</span>
                            </div>
                            <span className="text-[10px] text-indigo-500/50 uppercase tracking-widest">Last Updated: 오후 3:29:13</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: KPIs & Notes */}
                <div className="col-span-4 flex flex-col gap-6">
                    <div className="bg-[#1A1F2B] border border-white/5 rounded-[2rem] p-8 flex-1">
                        <h3 className="text-base font-bold text-white mb-8 flex items-center gap-2">
                            <FileText size={18} className="text-blue-400" />
                            핵심 재무 비율 (KPIs)
                        </h3>

                        <div className="space-y-8">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">영업이익률 <span className="text-slate-600">(OPERATING MARGIN)</span></span>
                                    <span className="text-xs font-bold text-blue-400">-26.3%</span>
                                </div>
                                <div className="w-full bg-[#121620] h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 w-[26.3%]" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">부채 비율 <span className="text-slate-600">(DEBT RATIO)</span></span>
                                    <span className="text-xs font-bold text-amber-500">10.1%</span>
                                </div>
                                <div className="w-full bg-[#121620] h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 w-[10.1%]" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">현금 비중 <span className="text-slate-600">(CASH RATIO)</span></span>
                                    <span className="text-xs font-bold text-emerald-400">81.7%</span>
                                </div>
                                <div className="w-full bg-[#121620] h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-400 w-[81.7%]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1A1F2B] border border-white/5 rounded-2xl p-6 h-[120px]">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">담당자 노트 (MANAGER'S NOTE)</p>
                        <p className="text-sm font-mono text-slate-400 italic">"test"</p>
                    </div>
                </div>
            </div>

        </div>
    );
};

const Target = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
);
const Activity = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
);
const Zap = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
);
