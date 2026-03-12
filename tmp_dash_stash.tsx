import React, { useMemo, useState } from 'react';
import { useAccounting } from '../hooks/useAccounting';
import {
    Activity, Wallet, Target, Info, Calendar, Search, ShieldCheck, Play, ArrowUpRight, ArrowDownRight, TrendingUp, HelpCircle, FileText, CheckCircle2, AlertTriangle, AlertCircle, X, ExternalLink
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { RiskSnapshot } from '../components/dashboard/RiskSnapshot';

// Inline formatCurrency instead of importing from non-existent location
const formatCurrency = (val: number) => new Intl.NumberFormat('ko-KR').format(val);

export const Dashboard: React.FC<{ setTab: (tab: string) => void }> = ({ setTab }) => {
    const { ledger, financials, config } = useAccounting();
    const [period, setPeriod] = useState('YEAR');
    const [activeModal, setActiveModal] = useState<'runway' | 'concentration' | null>(null);

    const currentCash = financials?.realAvailableCash || financials?.cash || 0;
    const netIncome = financials?.netIncome || 0;
    const monthlyBurn = financials?.expenses ? financials.expenses / 12 : 0; // Simple approximation for now
    const runwayMonths = monthlyBurn > 0 ? (currentCash / monthlyBurn).toFixed(1) : '∞';

    // Generate bar chart data from ledger
    const chartData = useMemo(() => {
        const dailyData: Record<string, { inflow: number; outflow: number }> = {};

        // Populate standard month days
        for (let i = 1; i <= 31; i++) {
            const day = `27/12/${String(i).padStart(2, '0')}`;
            // Use just simple day for display to match layout
            dailyData[String(i).padStart(2, '0')] = { inflow: 0, outflow: 0 };
        }

        const approvedLedger = ledger.filter(e => e.status === 'Approved');
        approvedLedger.forEach(entry => {
            if (!entry.date) return;
            const dateParts = entry.date.split('-');
            if (dateParts.length >= 3) {
                const day = dateParts[2].substring(0, 2);
                if (dailyData[day]) {
                    if (entry.type === 'Revenue') {
                        dailyData[day].inflow += entry.amount;
                    } else if (entry.type === 'Expense' || entry.type === 'Payroll') {
                        dailyData[day].outflow += entry.amount;
                    }
                }
            }
        });

        // Convert to array
        return Object.keys(dailyData).map(day => ({
            day: `27/12/${day}`, // Defaulting year/month to 27/12 to match UI
            displayDay: day,
            inflow: dailyData[day].inflow,
            outflow: dailyData[day].outflow
        })).sort((a, b) => a.displayDay.localeCompare(b.displayDay));
    }, [ledger]);

    // CfoRiskModal components
    const runwayModal = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-[#121620] w-[600px] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#1A1F2B]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                            <AlertTriangle size={16} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-tight">CFO 리스크 구조 분석</h2>
                            <p className="text-xs text-slate-500">엔진이 해당 리스크를 판정한 근거 데이터입니다.</p>
                        </div>
                    </div>
                    <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-[#1A1F2B] border border-white/5 rounded-xl p-6 text-center shadow-inner">
                        <p className="text-sm font-bold text-slate-400 mb-2">잔여 가용 자금</p>
                        <h1 className="text-4xl font-black text-white">₩59,545,830</h1>

                        <div className="flex justify-between items-center mt-6 pt-6 border-t border-white/5">
                            <div className="text-left">
                                <p className="text-[10px] font-bold text-slate-500 mb-1">월 평균 소모 속도 (Burn Rate)</p>
                                <p className="text-lg font-bold text-rose-400">₩10,251,776/월</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-500 mb-1">잔여 버퍼 (Runway)</p>
                                <p className="text-lg font-bold text-emerald-400">5.8 개월</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#2A231E] border border-amber-500/30 p-5 rounded-xl text-left">
                        <p className="text-[11px] text-amber-500/80 leading-relaxed font-bold">
                            <span className="text-slate-300">CFO Insight:</span> 어떠한 수입도 들어오지 않는 최악의 상황을 가정했을 때, 현재의 지출 구조를 유지할 경우 남은 생명줄입니다. 런웨이가 6개월 밑으로 떨어졌다면 오늘부터 투자 혹한기에 대비한 생존 계획(Layoff 등)을 시뮬레이션 하십시오.
                        </p>
                    </div>

                    <button onClick={() => { setActiveModal(null); setTab('strategic-compass'); }} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                        미래 손익 시뮬레이터 확인 <ExternalLink size={16} />
                    </button>
                </div>
            </div>
        </div>
    );

    const concentrationModal = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-[#121620] w-[650px] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#1A1F2B]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                            <AlertTriangle size={16} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-tight">CFO 리스크 구조 분석</h2>
                            <p className="text-xs text-slate-500">엔진이 해당 리스크를 판정한 근거 데이터입니다.</p>
                        </div>
                    </div>
                    <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#2A1E24] border border-rose-500/20 rounded-xl p-5 text-center">
                            <p className="text-[11px] font-bold text-slate-400 mb-1">월말 (28~31일) 기장 건수</p>
                            <h2 className="text-3xl font-black text-rose-400">3건</h2>
                        </div>
                        <div className="bg-[#1A1F2B] border border-white/5 rounded-xl p-5 text-center">
                            <p className="text-[11px] font-bold text-slate-400 mb-1">1~27일 분산 기장 건수</p>
                            <h2 className="text-3xl font-black text-slate-300">4건</h2>
                        </div>
                    </div>

                    <div className="bg-[#1A1F2B] border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mb-2">
                            <Calendar size={14} /> 월말 몰아치기 기장 샘플 내역
                        </div>
                        <div className="bg-[#151A25] rounded p-3 flex justify-between items-center text-[10px] font-mono text-slate-300 border border-white/5">
                            <span>[2027-12-28] [매출] SaaS 구독 수익 (329...</span>
                            <span className="text-rose-400">10,149,650</span>
                        </div>
                        <div className="bg-[#151A25] rounded p-3 flex justify-between items-center text-[10px] font-mono text-slate-300 border border-white/5">
                            <span>[2027-12-30] [자동] 감가상각비 인식 (개발용 워...</span>
                            <span className="text-rose-400">83,333</span>
                        </div>
                        <div className="bg-[#151A25] rounded p-3 flex justify-between items-center text-[10px] font-mono text-slate-300 border border-white/5">
                            <span>[2027-12-30] [자동] 감가상각비 인식 (BM특허 ...</span>
                            <span className="text-rose-400">50,000</span>
                        </div>
                    </div>

                    <div className="bg-[#2A231E] border border-amber-500/30 p-5 rounded-xl text-left">
                        <p className="text-[11px] text-amber-500/80 leading-relaxed font-bold">
                            <span className="text-slate-300">CFO Insight:</span> 월말에 전표가 비정상적으로 쏠려있습니다. 이는 실무자가 영수증을 모아놨다가 막판에 '치워버리는' 전형적인 기장 방식입니다. 횡령과 비용 부풀리기를 방어하기 위한 통제가 완전히 마감일에 붕괴된 상태입니다.
                        </p>
                    </div>

                    <button onClick={() => { setActiveModal(null); setTab('settlement'); }} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                        월마감/통제 센터 이동 <ExternalLink size={16} />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex-1 bg-[#1A1F2B] min-h-screen text-slate-100 p-8 space-y-6 overflow-x-hidden">
            {activeModal === 'runway' && runwayModal}
            {activeModal === 'concentration' && concentrationModal}
            {/* Top Header */}
            <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 pb-2 border-b border-white/5">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
                            <Activity size={24} />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">경영 대시보드 (Dashboard)</h1>
                    </div>
                    <p className="text-sm text-slate-400 font-bold ml-12">마지막 결산 확정일: <span className="text-blue-400">내역 없음</span></p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 bg-[#21283B] p-2 rounded-xl border border-white/5">
                        <span className="text-xs font-bold text-slate-400 ml-2">기준일: 2027-12-31</span>
                        <div className="flex gap-1 ml-4">
                            {['주간 (7일)', '단기 (14일)', '월간', '연간'].map((p, i) => (
                                <button key={p} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${i === 3 ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                        <div className="ml-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-2">
                            <ShieldCheck size={14} /> 실시간 장부연결 상태
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">SCENARIO MODE:</span>
                        <div className="flex gap-1">
                            <button className="px-3 py-1 rounded text-[10px] font-bold bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30">절약(LEAN/SURVIVAL)</button>
                            <button className="px-3 py-1 rounded text-[10px] font-bold bg-white/5 text-slate-400 hover:text-white">표준(GRANT)</button>
                            <button className="px-3 py-1 rounded text-[10px] font-bold bg-white/5 text-slate-400 hover:text-white">공격(GROWTH)</button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setTab('strategic-compass')} className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg text-[10px] font-black tracking-widest uppercase transition-all shadow-lg flex items-center gap-2">
                            <Play size={12} /> 3개년 시뮬레이션 RUN
                        </button>
                        <button className="px-4 py-2 bg-[#21283B] hover:bg-[#2A3143] border border-white/5 text-slate-300 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all">RUN 2026 PACK</button>
                        <button className="px-4 py-2 bg-[#21283B] hover:bg-[#2A3143] border border-white/5 text-slate-300 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all">RUN 2027 PACK</button>
                        <button className="px-4 py-2 bg-[#21283B] hover:bg-[#2A3143] border border-white/5 text-slate-300 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all">RUN 2028 PACK</button>
                    </div>
                    <button className="w-full mt-1 px-4 py-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-black uppercase text-center flex items-center justify-center gap-2">
                        <AlertCircle size={12} /> Risk Briefing (Phase 4.5)
                    </button>
                </div>
            </header>

            {/* Risk Snapshot Area */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-400" />
                    경영 밸런스 요약 (CFO Risk Snapshot)
                </h3>
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-[#21283B] p-5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-slate-400">거래의 의존도</p>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold flex items-center gap-1">
                                <CheckCircle2 size={10} /> STABLE
                            </span>
                        </div>
                        <h4 className="text-2xl font-black text-white mb-2">0.0%</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            상위위치 진단 기준 거래 값이 82C 또는 풀드랍 타수 기록에 맞춤화 되었습니다. 거래 기반 리스크가 거의 없습니다.
                        </p>
                    </div>
                    <div className="bg-[#21283B] p-5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-slate-400">이익 vs 현금 괴리율</p>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold flex items-center gap-1">
                                <CheckCircle2 size={10} /> STABLE
                            </span>
                        </div>
                        <h4 className="text-2xl font-black text-white mb-2">0.0%</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            모든 자본이 미장 없이 현금 기반으로 회수되었습니다. 악성 매입 재고 누가가 삭감됩니다.
                        </p>
                    </div>
                    <div className="bg-[#2A231E] border border-amber-500/30 p-5 rounded-2xl shadow-lg relative overflow-hidden cursor-pointer hover:bg-[#332A24] transition-colors" onClick={() => setActiveModal('runway')}>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-amber-500">RUNWAY</p>
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded text-[9px] font-bold flex items-center gap-1">
                                <AlertTriangle size={10} /> WATCH
                            </span>
                        </div>
                        <h4 className="text-2xl font-black text-white mb-2">{runwayMonths}개월</h4>
                        <p className="text-[10px] text-amber-500/70 leading-relaxed">
                            런웨이가 6개월 밑(5.8개월)으로 떨어졌습니다. 차기 투자 유치 또는 생존 대책 마련을 즉시 시작하십시오.
                        </p>
                    </div>
                    <div className="bg-[#21283B] p-5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden cursor-pointer hover:bg-[#2A3143] transition-colors" onClick={() => setActiveModal('concentration')}>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-slate-400">자산 집중도</p>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold flex items-center gap-1">
                                <CheckCircle2 size={10} /> STABLE
                            </span>
                        </div>
                        <h4 className="text-2xl font-black text-white mb-2">42.9%</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            안전 자산 비율이 42.9%입니다. 유동자산 대비 낮은 비율이므로 자산 배분을 재검토하시기 바랍니다.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Metrics */}
            <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4 bg-[#21283B] p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden">
                    <div className="absolute right-[-20%] top-[-20%] opacity-10">
                        <Activity size={250} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <Activity size={14} className="text-blue-500" />
                            순수익금 (NET INCOME) (2027) <HelpCircle size={12} />
                        </p>
                        <h2 className={`text-3xl font-black mb-1 ${netIncome < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            ₩{formatCurrency(netIncome)}
                        </h2>
                        <p className="text-xs text-slate-500">정기추적기 (단기 지표 검토)</p>
                    </div>
                </div>

                <div className="col-span-4 bg-[#21283B] p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                <Wallet size={14} className="text-emerald-500" />
                                CURRENT CASH (2027-12-31) <HelpCircle size={12} />
                            </p>
                            <h2 className="text-3xl font-black text-white mb-1">₩{formatCurrency(currentCash)}</h2>
                        </div>
                        <div className="flex justify-between items-end mt-4">
                            <div className="text-[10px] text-slate-500">
                                <p>Inflow</p>
                                <p>Outflow</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-span-4 bg-[#21283B] p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <Target size={14} className="text-amber-500" />
                            AVG. MONTHLY BURN <HelpCircle size={12} />
                        </p>
                        <h2 className="text-3xl font-black text-white mb-1">₩{formatCurrency(monthlyBurn)}</h2>
                        <p className="text-xs text-slate-500">최근 3개월 기준 평균 지출액</p>
                    </div>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-12 gap-4 h-[350px]">
                {/* Chart */}
                <div className="col-span-8 bg-[#21283B] p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col relative">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                현금 흐름 및 매출 추세 <HelpCircle size={12} className="text-slate-500" />
                            </h3>
                            <p className="text-[10px] text-slate-500">실제 자금 유입(Inflow)과 지출 추이(Outflow) 분석</p>
                        </div>
                        <div className="flex bg-[#1A1F2B] p-1 rounded-lg border border-white/5">
                            <button className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-white rounded">DAY</button>
                            <button className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-white rounded">WEEK</button>
                            <button className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-white rounded">MONTH</button>
                            <button className="px-3 py-1 text-[10px] font-bold bg-blue-600 text-white rounded shadow-sm">YEAR</button>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-0 bg-[#1A1F2B] rounded-xl p-4 border border-white/5">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barGap={0}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(val) => `${val / 1000000}M`} />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#070C18', border: '1px solid #1e293b', borderRadius: '8px' }}
                                />
                                <Bar dataKey="inflow" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={4} />
                                <Bar dataKey="outflow" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={4} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Empty State / Call to Action */}
                <div className="col-span-4 bg-[#21283B] p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col items-center justify-center text-center relative">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <ShieldCheck size={28} className="text-slate-500" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">대기 중인 결산 정보가 없습니다</h3>
                    <p className="text-[11px] text-slate-400 max-w-[200px] leading-relaxed mb-6">
                        시스템의 신뢰도를 달성하기 위해 월간 결산을 진행하고 확정된 재무 상태를 확인하세요.
                    </p>
                    <button onClick={() => setTab('settlement')} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 focus:ring-4 focus:ring-indigo-600/30 text-white rounded-xl text-xs font-bold transition-all w-48 shadow-lg shadow-indigo-600/20">
                        결산 관리로 이동
                    </button>
                </div>
            </div>
        </div>
    );
};
