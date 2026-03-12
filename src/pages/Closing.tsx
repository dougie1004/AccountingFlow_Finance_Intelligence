import React from 'react';
import { Lock, Clock, Calendar, User, FileText, CheckCircle, ShieldCheck } from 'lucide-react';

const formatCurrency = (val: number) => new Intl.NumberFormat('ko-KR').format(val);

export const Closing: React.FC = () => {
    return (
        <div className="flex-1 bg-[#1A1F2B] min-h-screen text-slate-100 p-8 space-y-6">
            <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 pb-6 border-b border-white/5">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
                            <Lock size={24} />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">결산 및 마감 관리 (Closing)</h1>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-12">Fiscal Period Finalization & Integrity Sealing</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="px-4 py-2 bg-[#21283B] text-slate-300 border border-white/5 rounded-lg text-[10px] font-bold flex items-center gap-2">
                        <span className="text-indigo-400 uppercase tracking-widest">Dimension Time</span>
                        2027-12-31 <Clock size={12} className="ml-2 text-indigo-400" />
                    </div>
                    <div className="px-4 py-2 bg-[#21283B] text-slate-300 border border-white/5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg">
                        2027년 12월 <Calendar size={14} className="ml-2 text-slate-400" />
                    </div>
                </div>
            </header>

            <div className="space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock size={16} className="text-indigo-400" /> 결산 이력 및 스냅샷 (Closing History)
                </h2>

                <div className="bg-[#151A25] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-[#1A1F2B] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-1">대상 기간</div>
                        <div className="col-span-2">마감 일시</div>
                        <div className="col-span-2">재무 요약 (Assets / Profit)</div>
                        <div className="col-span-1">마감 스냅샷</div>
                        <div className="col-span-6">메모</div>
                    </div>

                    {/* Row 1 */}
                    <div className="grid grid-cols-12 gap-4 p-6 border-b border-white/5 relative">
                        <div className="col-span-1 flex items-start gap-2 text-sm font-black text-white">
                            <Calendar size={14} className="text-indigo-400 mt-1 flex-shrink-0" />
                            2027-<br />12
                        </div>
                        <div className="col-span-2 space-y-1">
                            <p className="text-xs text-slate-400 font-bold">2026. 2. 22. 오후 3:29:13</p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1 font-bold">
                                <User size={10} /> ADMIN USER
                            </p>
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <p className="text-[10px] text-slate-500 font-bold tracking-widest">자산:</p>
                            <p className="text-lg font-black text-white">₩72,928,103</p>
                            <p className="text-xs font-bold text-rose-400 flex justify-between">
                                <span className="text-slate-500">순이익:</span> ₩-2,671,683
                            </p>
                            <p className="text-[10px] text-slate-500 flex justify-between">
                                <span>고정자산(NBV):</span> ₩8,000,000
                            </p>
                        </div>
                        <div className="col-span-1 space-y-2">
                            <div className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-bold rounded flex justify-between">
                                <span>가계정:</span> <span>₩0</span>
                            </div>
                            <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-bold rounded flex justify-between">
                                <span>결산:</span> <span>₩0</span>
                            </div>
                        </div>
                        <div className="col-span-6 space-y-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                                <FileText size={12} /> "test"
                            </div>
                            <div className="bg-[#1A1F2B] border border-indigo-500/20 rounded-xl p-5 shadow-lg relative overflow-hidden">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 tracking-widest uppercase">
                                        <ShieldCheck size={14} /> AI Closing Intelligence
                                    </div>
                                    <span className="text-[9px] text-indigo-500/50">Ref: Rule #7, #8</span>
                                </div>
                                <div className="space-y-4 text-xs leading-relaxed text-slate-300 font-bold">
                                    <p>[AI 경영 브리핑]</p>
                                    <p className="text-white">문제점:</p>
                                    <p>1. 심각한 순손실 발생: 이번 달 ₩2,671,683원의 순손실은 매우 우려스러운 상황입니다. 매출액(₩10,149,650원) 대비 과도한 비용 지출이 발생했음을 시사합니다. 특히 급여(₩7,800,000원)와 광고선전비(₩3,328,000원)가 매출액 대비 큰 비중을 차지하고 있습니다.</p>
                                    <p className="text-white">개선 방향:</p>
                                    <ol className="list-decimal pl-4 space-y-2 text-slate-400">
                                        <li>비용 구조 긴급 점검 및 효율화:
                                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                                <li>급여 수준의 적정성 및 인력 운영 효율성을 검토하고, 불필요한 인력 감축 또는 업무 재분배를 고려해야 합니다.</li>
                                                <li>광고선전비 지출의 효과를 측정하고, ROI가 낮은 광고 채널을 즉시 중단해야 합니다.</li>
                                                <li>지급임차료 외 다른 운영 비용에 대한 심층 분석을 통해 절감 방안을 모색해야 합니다.</li>
                                            </ul>
                                        </li>
                                        <li>매출 증대 방안 강구:
                                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                                <li>SaaS 제품의 경쟁력을 강화하고, 신규 고객 유치 및 기존 고객 유지율을 높이기 위한 전략을 수립해야 합니다.</li>
                                                <li>매출 다각화를 위해 새로운 수익 모델 개발을 고려해야 합니다.</li>
                                            </ul>
                                        </li>
                                    </ol>
                                    <p className="text-white pt-2">칭찬할 점:</p>
                                    <p>1. 건전한 자산 및 리스 상태: 고정자산 상각율이 0%이고, 현재 인식된 리스 부채가 없다는 점은 재무적으로 안정적인 상태임을 나타냅니다. 다만, 자산 활용도를 높여 수익 창출에 기여할 수 있도록 관리해야 합니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-12 gap-4 p-6 relative">
                        <div className="col-span-1 flex items-start gap-2 text-sm font-black text-white">
                            <Calendar size={14} className="text-indigo-400 mt-1 flex-shrink-0" />
                            2028-<br />12
                        </div>
                        <div className="col-span-2 space-y-1">
                            <p className="text-xs text-slate-400 font-bold">2026. 2. 22. 오후 3:28:50</p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1 font-bold">
                                <User size={10} /> ADMIN USER
                            </p>
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <p className="text-[10px] text-slate-500 font-bold tracking-widest">자산:</p>
                            <p className="text-lg font-black text-white">₩135,393,357</p>
                            <p className="text-xs font-bold text-emerald-400 flex justify-between">
                                <span className="text-slate-500">순이익:</span> ₩10,885,437
                            </p>
                            <p className="text-[10px] text-slate-500 flex justify-between">
                                <span>고정자산(NBV):</span> ₩8,000,000
                            </p>
                        </div>
                        <div className="col-span-1 space-y-2">
                            <div className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-bold rounded flex justify-between">
                                <span>가계정:</span> <span>₩0</span>
                            </div>
                            <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-bold rounded flex justify-between">
                                <span>결산:</span> <span>₩0</span>
                            </div>
                        </div>
                        <div className="col-span-6 space-y-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                                <FileText size={12} /> "test"
                            </div>
                            <div className="bg-[#1A1F2B] border border-indigo-500/20 rounded-xl p-5 shadow-lg relative overflow-hidden">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 tracking-widest uppercase">
                                        <ShieldCheck size={14} /> AI Closing Intelligence
                                    </div>
                                    <span className="text-[9px] text-indigo-500/50">Ref: Rule #2, #8</span>
                                </div>
                                <div className="space-y-4 text-xs leading-relaxed text-slate-300 font-bold">
                                    <p>[AI 경영 브리핑]</p>
                                    <p className="text-white">문제점:</p>
                                    <p>1. 높은 광고선전비 비율: 매출액 대비 광고선전비 비중이 20%에 달합니다. 이는 초기 성장 단계에서 공격적인 마케팅 전략으로 해석될 수 있으나, 장기적인 수익성 확보를 위해서는 견고 효율 분석 및 최적화가 필요합니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
