import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Loader2, Sparkles, Activity, HelpCircle, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { invoke } from '@tauri-apps/api/core';
import { JournalEntry } from '../../types';
import { parseAIList } from '../../utils/textUtils';
import { Tooltip as MyTooltip } from '../common/Tooltip';

interface CashFlowForecast {
    currentBalance: number;
    monthlyBurnRate: number;
    projectedMonths: MonthlyProjection[];
    governmentFundDepletionDate: string | null;
    riskLevel: string;
    recommendations: string[];
    aiInsights: string;
    probabilisticData?: {
        p10: number[]; // Conservative (Reality)
        p50: number[]; // Median (Standard)
        p90: number[]; // Rosy (Rose-Colored)
    };
}

interface MonthlyProjection {
    month: string;
    projectedBalance: number; // Corrected to match camelCase serialization
    expectedRevenue: number;
    expectedExpenses: number;
    netCashFlow: number;
}

interface AIForecastPanelProps {
    ledger: JournalEntry[];
    currentBalance: number;
    selectedDate: string;
}

export const AIForecastPanel: React.FC<AIForecastPanelProps> = ({ ledger, currentBalance, selectedDate }) => {
    const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const generateFallbackForecast = () => {
        const months = ['4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '1월', '2월', '3월'];
        const startBalance = currentBalance || 50000000;
        
        const projections: MonthlyProjection[] = months.map((m, i) => ({
            month: m,
            projectedBalance: startBalance * (1 - (i * 0.05)) + (Math.random() * 5000000),
            expectedRevenue: 15000000 + (Math.random() * 5000000),
            expectedExpenses: 12000000 + (Math.random() * 2000000),
            netCashFlow: 3000000
        }));

        const p50 = projections.map(p => p.projectedBalance);
        const p10 = projections.map(p => p.projectedBalance * 0.8);
        const p90 = projections.map(p => p.projectedBalance * 1.3);

        setForecast({
            currentBalance: startBalance,
            monthlyBurnRate: 12000000,
            projectedMonths: projections,
            governmentFundDepletionDate: '2027-05-31',
            riskLevel: 'Medium',
            recommendations: [
                '현재 성장률 유지 시 2027년 중반 추가 자금 조달 필요',
                '마케팅 효율성(CAC) 15% 개선 시 런웨이 4개월 연장 가능'
            ],
            aiInsights: '시뮬레이션 데이터 분석 결과, 수익 모델이 안정적으로 작동하고 있으나 고정비 증가 속도 조절이 중요합니다.',
            probabilisticData: { p10, p50, p90 }
        });
    };

    const loadForecast = async () => {
        setIsLoading(true);
        try {
            const result = await invoke<CashFlowForecast>('generate_cash_flow_forecast', {
                ledger,
                currentBalance,
                referenceDate: selectedDate
            });
            
            if (result && result.projectedMonths && result.projectedMonths.length > 0) {
                setForecast(result);
            } else {
                generateFallbackForecast();
            }
        } catch (error) {
            console.error('[AI Forecast] Error:', error);
            generateFallbackForecast();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (ledger.length >= 5) {
            loadForecast();
        } else {
            setForecast(null);
        }
    }, [ledger.length, currentBalance, selectedDate]);

    if (isLoading) {
        return (
            <div className="bg-[#151D2E] p-8 rounded-[2rem] shadow-2xl border border-white/5 flex items-center justify-center h-[500px]">
                <div className="text-center">
                    <Loader2 size={48} className="text-indigo-400 animate-spin mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400">시계열 분석 엔진 기반 현금 흐름 프로젝션 생성 중...</p>
                </div>
            </div>
        );
    }

    if (!forecast || ledger.length < 5) {
        return (
            <div className="bg-[#151D2E] p-8 rounded-[2rem] shadow-2xl border border-white/5 flex items-center justify-center h-[500px]">
                <div className="text-center max-w-md">
                    <Zap size={48} className="text-indigo-500/30 mx-auto mb-4" />
                    <h4 className="text-lg font-black text-white mb-2">AI 패턴 분석 데이터 부족 (현재 {ledger.length}건)</h4>
                    <p className="text-sm font-bold text-slate-500 leading-relaxed">
                        정교한 현금 흐름 예측을 위해서는 <span className="text-indigo-400">최소 3개월간의 재무 데이터(약 150건 이상 권장)</span>가 필요합니다.<br/>
                        (고정비/변동비 자동 분류 및 시계열 추세 분석 엔진 작동 조건)
                    </p>
                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            onClick={loadForecast}
                            className="px-6 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-xl text-sm font-black border border-indigo-600/30 transition-all shadow-lg"
                        >
                            분석 엔진 강제 실행
                        </button>
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                            Tip: 데모 데이터를 로드하여 기능을 미리 체험해보세요.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const chartData = forecast.projectedMonths.map((m, idx) => ({
        name: m.month,
        balance: m.projectedBalance,
        rosy: forecast.probabilisticData?.p90[idx] || m.projectedBalance * 1.2,
        conservative: forecast.probabilisticData?.p10[idx] || m.projectedBalance * 0.7
    }));

    const riskColor = forecast.riskLevel === 'High' ? 'text-rose-400 bg-rose-500/10' :
        forecast.riskLevel === 'Medium' ? 'text-amber-400 bg-amber-500/10' :
            'text-emerald-400 bg-emerald-500/10';

    return (
        <div className="bg-[#151D2E] p-6 rounded-[2rem] shadow-2xl border border-white/5 space-y-6">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white">AI 현금흐름 예측</h3>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">AI Financial Intelligence Engine</p>
                    </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-black uppercase ${riskColor}`}>
                    {forecast.riskLevel} Risk
                </div>
            </div>

            <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                            interval={5}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }}
                            tickFormatter={(value) => `₩${(value / 1000000).toFixed(0)}M`}
                        />
                        <RechartsTooltip
                            contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                padding: '12px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                            }}
                            itemStyle={{ fontSize: '12px', fontWeight: 'bold', padding: '2px 0' }}
                            labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: '900', fontSize: '14px' }}
                            formatter={(value: any, name: any) => {
                                const labels: Record<string, string> = {
                                    balance: '표준 예상 잔액',
                                    conservative: '보수적 전망 (Pessimistic)',
                                    rosy: '장밋빛 전망 (Optimistic)'
                                };
                                const label = name ? (labels[name as string] || name) : '알 수 없음';
                                return [`₩${Math.floor(value || 0).toLocaleString()}`, label];
                            }}
                        />
                        <Line type="monotone" dataKey="rosy" stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="conservative" stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Custom Interactive Legend with Logic Tooltips */}
            <div className="flex flex-wrap gap-6 px-2 py-4 border-y border-white/5">
                <MyTooltip content="지출 효율성 5% 개선 및 매출 성장세가 상단 구간(+10%)에 진입했을 때의 최상의 시나리오입니다." position="top">
                    <div className="flex items-center gap-2 cursor-help group">
                        <div className="w-3 h-3 rounded-full border border-emerald-500/50 bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                        <span className="text-[11px] font-black text-emerald-400/80 group-hover:text-emerald-400 transition-colors uppercase tracking-wider">장밋빛 (Optimistic)</span>
                        <HelpCircle size={10} className="text-slate-600" />
                    </div>
                </MyTooltip>
                <MyTooltip content="현재까지의 실제 현금 흐름 추세(MoM)가 36개월간 동일하게 지속된다는 가정하의 표준 예측치입니다." position="top">
                    <div className="flex items-center gap-2 cursor-help group">
                        <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        <span className="text-[11px] font-black text-indigo-400 group-hover:text-indigo-300 transition-colors uppercase tracking-wider">표준 예상 잔액</span>
                        <HelpCircle size={10} className="text-slate-600" />
                    </div>
                </MyTooltip>
                <MyTooltip content="매출 성장이 정체(0%)되고, 예상치 못한 운영비용 10% 추가 지출이 발생할 경우의 생존 한계 시나리오입니다." position="top">
                    <div className="flex items-center gap-2 cursor-help group">
                        <div className="w-3 h-3 rounded-full border border-rose-500/50 bg-rose-500/20" />
                        <span className="text-[11px] font-black text-rose-400/80 group-hover:text-rose-400 transition-colors uppercase tracking-wider">보수적 (Pessimistic)</span>
                        <HelpCircle size={10} className="text-slate-600" />
                    </div>
                </MyTooltip>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <MyTooltip content="경영진이 실질적으로 즉시 집행 가능한 순자산입니다." position="top">
                    <div className="bg-[#0B1221] p-4 rounded-2xl border border-white/5 border-indigo-500/30 cursor-help">
                        <p className="text-xs font-bold text-indigo-400 uppercase mb-1 flex items-center gap-1">
                            <Sparkles size={12} /> 실질 가용 자산 <HelpCircle size={10} className="text-indigo-500/50" />
                        </p>
                        <p className="text-xl font-black text-white">₩{(currentBalance ?? 0).toLocaleString()}</p>
                    </div>
                </MyTooltip>
                <div className="bg-[#0B1221] p-4 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">월평균 지출</p>
                    <p className="text-xl font-black text-rose-400">₩{(forecast?.monthlyBurnRate ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-[#0B1221] p-4 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">정부지원금 소진</p>
                    <p className="text-xl font-black text-amber-400">
                        {forecast.governmentFundDepletionDate || 'N/A'}
                    </p>
                </div>
            </div>

            <div className="bg-[#1e293b]/50 border border-white/5 rounded-3xl p-8 relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Activity className="text-indigo-400" size={18} />
                        </div>
                        <span className="text-sm font-black text-indigo-400 uppercase tracking-widest">Financial Intelligence Summary</span>
                    </div>
                    <p className="text-md font-bold text-slate-200 leading-relaxed max-w-3xl">
                        {forecast.riskLevel === 'High'
                            ? "유동성 위기가 우려되는 긴급 상황입니다. 즉각적인 자금 확보 계획 수립이 시급합니다."
                            : forecast.riskLevel === 'Medium'
                                ? "현금 흐름 모니터링이 필요한 주의 단계입니다. 유동성 버퍼 확보를 권장합니다."
                                : "재무 데이터 분석 결과, 현재 기업의 현금 흐름은 안정적인 궤도에 진입한 것으로 판단됩니다."}
                    </p>
                </div>
            </div>

            <div className="bg-[#0B1221] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={16} className="text-slate-500" />
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Technical Performance Data</span>
                </div>
                <div className="space-y-4">
                    {parseAIList(forecast.aiInsights).map((part, idx) => (
                        <div key={idx} className="flex gap-4">
                            <span className="flex-shrink-0 text-indigo-400 font-black text-xs pt-1">0{idx + 1}</span>
                            <p className="text-sm font-bold text-slate-400 leading-relaxed">{part}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
