import { Shield, AlertCircle, TrendingUp, HandCoins, Zap } from 'lucide-react';

type Props = {
  equityAnalysis: any;
};

/**
 * 🧬 Equity Intelligence Panel
 * Proactive analysis of funding, dilution, and control.
 */
export default function EquityIntelligence({ equityAnalysis }: Props) {
  if (!equityAnalysis) return null;

  const { dilution, control, timing, insight, fundingNeeded } = equityAnalysis;

  return (
    <div className="p-8 rounded-[2.5rem] border bg-black/40 border-white/5 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Shield size={14} className="text-blue-400" /> EQUITY INTELLIGENCE
          </p>
          <p className="text-sm font-black text-white italic tracking-tighter">자금 조달 및 경영권 리스크 분석</p>
        </div>
        <div className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${
            timing?.urgency === 'HIGH' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 
            timing?.urgency === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          {timing?.timing || 'DELAY'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="grid grid-cols-2 gap-4 p-5 bg-white/5 rounded-3xl border border-white/5">
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-slate-500 uppercase">Founder Share</p>
            <p className="text-2xl font-black text-white italic">{(dilution.founderShare * 100).toFixed(1)}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-slate-500 uppercase">Investor Share</p>
            <p className="text-2xl font-black text-blue-400 italic">{(dilution.investorShare * 100).toFixed(1)}%</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black text-slate-500 uppercase">Control Status</p>
              <p className={`text-sm font-black italic ${control === 'CONTROL_LOST' ? 'text-rose-400' : 'text-blue-400'}`}>{control}</p>
            </div>
            {control === 'CONTROL_LOST' ? <AlertCircle size={20} className="text-rose-400" /> : <Shield size={20} className="text-blue-400" />}
          </div>
          
          <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex justify-between items-center">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black text-emerald-600/60 uppercase tracking-tighter">Required Funding (Target: 18m)</p>
              <p className="text-lg font-black text-emerald-400 italic">₩{(fundingNeeded / 100000000).toFixed(1)}억</p>
            </div>
            <HandCoins size={20} className="text-emerald-500/60" />
          </div>
        </div>
      </div>

      {insight && (
        <div className="p-5 bg-yellow-400/5 border border-yellow-400/20 rounded-3xl flex items-start gap-3">
          <Zap size={18} className="text-yellow-500 mt-1 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-black text-yellow-500/90 uppercase tracking-widest">Decision Insight</p>
            <p className="text-sm font-bold text-yellow-500/80 leading-relaxed italic">{insight.message}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {insight.action?.map((a: string, i: number) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-yellow-400/10 rounded-md text-yellow-600/80 font-black italic border border-yellow-400/10">
                  # {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-[9px] font-bold text-slate-600 italic px-2">
        {timing.message} • 번레이트 기반 자동 펀딩 간극 시뮬레이션 결과입니다.
      </p>
    </div>
  );
}
