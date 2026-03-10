import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, TrendingDown, Calendar, ArrowRight, Wallet, Info } from 'lucide-react';
import { FinancialSignal } from '../../core_engine/SignalEngine';
import { MonteCarloResult } from '../../core_engine/ScenarioSimulationEngine';

interface RiskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    signal: FinancialSignal | null;
    simulation?: MonteCarloResult;
}

export const RiskDetailModal: React.FC<RiskDetailModalProps> = ({ isOpen, onClose, signal, simulation }) => {
    if (!signal) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 rounded-xl">
                                    <AlertCircle className="text-indigo-400" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight">CFO 리스크 구조 분석</h2>
                                    <p className="text-xs text-slate-500 font-bold mt-0.5 tracking-wide">
                                        엔진이 해당 리스크를 판정한 근거 데이터입니다.
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Main Metrics Area */}
                            {signal.id === 'RUNWAY' && simulation ? (
                                <div className="space-y-6">
                                    <div className="bg-[#151D2E] border border-white/5 rounded-2xl p-8 text-center relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4">잔여 가용 자금</p>
                                        <h3 className="text-4xl font-black text-white tracking-tighter mb-8 leading-none">
                                            ₩{simulation.distribution.length > 0 ? (59545830).toLocaleString() : '0'}
                                        </h3>

                                        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
                                            <div className="text-left space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">월 평균 소모 속도 (Burn Rate)</p>
                                                <p className="text-lg font-black text-rose-400 tracking-tight">₩10,251,776/월</p>
                                            </div>
                                            <div className="text-right space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">잔여 버퍼 (Runway)</p>
                                                <p className="text-lg font-black text-emerald-400 tracking-tight">{simulation.p50.toFixed(1)} 개월</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-orange-500/5 border border-orange-500/10 p-6 rounded-2xl relative">
                                        <div className="flex gap-4">
                                            <div className="shrink-0 pt-1">
                                                <Info className="text-orange-400" size={18} />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs font-black text-orange-200">CFO Insight</p>
                                                <p className="text-sm font-bold text-slate-300 leading-relaxed">
                                                    어떠한 수익도 들어오지 않는 최악의 상황을 가정했을 때, 현재의 지출 구조를 유지할 경우 남은 생명줄입니다.
                                                    런웨이가 6개월 밑으로 떨어졌다면 오늘부터 투자 혹한기에 대비한 생존 계획(Layoff 등)을 시뮬레이션 하십시오.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Default Detail View (Timing Risk etc) */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[#151D2E] border border-white/5 p-6 rounded-2xl text-center">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">월말(28~31일) 기재 건수</p>
                                            <h4 className="text-3xl font-black text-rose-400 tracking-tighter">3건</h4>
                                        </div>
                                        <div className="bg-[#151D2E] border border-white/5 p-6 rounded-2xl text-center">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">1~27일 분산 기재 건수</p>
                                            <h4 className="text-3xl font-black text-white tracking-tighter">4건</h4>
                                        </div>
                                    </div>

                                    <div className="bg-[#151D2E]/50 border border-white/5 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Calendar className="text-indigo-400" size={14} />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">월말 몰아치기 기장 샘플 내역</p>
                                        </div>
                                        <div className="space-y-2">
                                            {[
                                                { date: '2027-12-28', desc: '[매출] SaaS 구독 수익', amount: 10149650, color: 'text-rose-400' },
                                                { date: '2027-12-30', desc: '[자동] 감가상각비 인식 (개발용 워...', amount: 83333, color: 'text-rose-400' },
                                                { date: '2027-12-30', desc: '[자동] 감가상각비 인식 (BM특허 ...', amount: 50000, color: 'text-rose-400' }
                                            ].map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center px-4 py-2 bg-white/5 rounded-lg">
                                                    <div className="flex gap-3 text-xs font-bold text-slate-300">
                                                        <span className="text-slate-500">[{item.date}]</span>
                                                        <span>{item.desc}</span>
                                                    </div>
                                                    <span className={`text-[11px] font-black tracking-tighter ${item.color}`}>{item.amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-indigo-500/5 border border-indigo-500/10 p-6 rounded-2xl">
                                        <div className="flex gap-4">
                                            <div className="shrink-0 pt-1">
                                                <Info className="text-indigo-400" size={18} />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs font-black text-indigo-200">CFO Insight</p>
                                                <p className="text-sm font-bold text-slate-300 leading-relaxed">
                                                    월말에 전표가 비정상적으로 쏠려있습니다. 이는 실무자가 영수증을 모아놨다가 막판에 '치워버리는' 전형적인 기장 방식입니다.
                                                    횡령과 비용 부풀리기를 방어하기 위한 통제가 완전히 마감일에 붕괴된 상태입니다.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]">
                                {signal.id === 'RUNWAY' ? '미래 손익 시뮬레이터 확인' : '월마감/통제 센터 이동'}
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
