import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  Calendar,
  Search,
  ChevronRight,
  ShieldCheck,
  Clock,
  ArrowRight
} from 'lucide-react';

interface CloseCheck {
  name: string;
  status: 'PASSED' | 'WARNING' | 'BLOCKER';
  message: string;
  value?: string;
  affectedIds?: string[];
}

interface CloseReadinessReport {
  status: 'READY' | 'OPEN' | 'BLOCKED';
  score: number;
  checks: CloseCheck[];
  warnings: string[];
  blockers: string[];
  period: string;
}

const CloseReadiness: React.FC = () => {
  const [period, setPeriod] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [report, setReport] = useState<CloseReadinessReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<CloseReadinessReport>('generate_close_readiness_report', { period });
      setReport(result);
    } catch (err: any) {
      console.error("[CLOSE READINESS] Fetch Error:", err);
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
      case 'PASSED': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'OPEN':
      case 'WARNING': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'BLOCKED':
      case 'BLOCKER': return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
      default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
    }
  };

  const getIcon = (status: string) => {
    switch (status) {
      case 'PASSED': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'WARNING': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'BLOCKER': return <AlertCircle className="w-5 h-5 text-rose-400" />;
      default: return null;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-white/5">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-slate-400 text-sm font-medium uppercase tracking-[0.2em] animate-pulse">
            <ShieldCheck className="w-4 h-4" />
            Fiscal integrity monitor
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-white via-white to-slate-500 bg-clip-text text-transparent italic">
            Close Readiness
          </h1>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="month" 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
              />
            </div>
            {report && (
              <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${getStatusColor(report.status)}`}>
                {report.status}
              </div>
            )}
          </div>
        </div>

        {report && (
          <div className="flex flex-col items-end">
            <div className="text-[72px] font-black leading-none tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              {report.score}
            </div>
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mr-1">
              Readiness index
            </div>
          </div>
        )}
      </header>

      {loading && (
        <div className="flex flex-col items-center justify-center p-32 space-y-4">
          <div className="w-12 h-12 border-2 border-slate-700 border-t-white rounded-full animate-spin"></div>
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest animate-pulse">Auditing Ledger Integrity...</p>
        </div>
      )}

      {report && !loading && (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative group p-6 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-3xl transition-all hover:bg-white/10 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="flex justify-between items-start mb-4">
                <AlertCircle className="w-8 h-8 text-rose-500" />
                <span className="text-3xl font-black text-rose-400 italic tracking-tighter">{report.blockers.length}</span>
              </div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Target Critical</p>
              <h3 className="text-white text-lg font-bold italic uppercase">Blockers</h3>
            </div>

            <div className="relative group p-6 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-3xl transition-all hover:bg-white/10 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="flex justify-between items-start mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <span className="text-3xl font-black text-amber-400 italic tracking-tighter">{report.warnings.length}</span>
              </div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Advisory risk</p>
              <h3 className="text-white text-lg font-bold italic uppercase">Warnings</h3>
            </div>

            <div className="relative group p-6 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-3xl transition-all hover:bg-white/10 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="flex justify-between items-start mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <span className="text-3xl font-black text-emerald-400 italic tracking-tighter">
                  {report.checks.filter(c => c.status === 'PASSED').length}
                </span>
              </div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Audit Passed</p>
              <h3 className="text-white text-lg font-bold italic uppercase">Integrity checks</h3>
            </div>
          </div>

          {/* CHECKLIST PANEL */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-8 py-5 bg-white/5 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Detailed Diagnostic Results</h2>
              </div>
              <div className="text-[10px] font-black uppercase tracking-tighter text-slate-600">
                Found {report.checks.length} Logical Assertions
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {report.checks.map((check, idx) => (
                <div key={idx} className="group hover:bg-white/[0.02] transition-colors">
                  <div className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-5">
                      <div className="mt-1 transition-transform group-hover:scale-110 duration-300">
                        {getIcon(check.status)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-bold text-white tracking-tight">{check.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border animate-in slide-in-from-left-2 ${getStatusColor(check.status)}`}>
                            {check.status === 'PASSED' ? 'OK' : check.status}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl font-medium tracking-tight opacity-70 group-hover:opacity-100 transition-opacity">
                          {check.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {check.value && (
                        <div className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-xs font-mono text-slate-500 uppercase">
                          {check.value}
                        </div>
                      )}
                      {check.affectedIds && check.affectedIds.length > 0 && (
                        <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-all group/btn">
                          Trace Related Ledger
                          <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FINAL CTA / GUIDANCE */}
          <div className={`p-10 rounded-3xl border-2 flex flex-col items-center text-center gap-6 shadow-2xl transition-all duration-1000 bg-gradient-to-b ${
            report.status === 'READY' 
              ? 'from-emerald-500/10 to-transparent border-emerald-500/20' 
              : 'from-white/5 to-transparent border-white/5'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              report.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
            }`}>
              {report.status === 'READY' ? <CheckCircle className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
            </div>
            
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                {report.status === 'READY' ? 'Fiscal Threshold Cleared' : 'Integrity Gap Detected'}
              </h2>
              <p className="text-slate-400 text-base font-medium tracking-tight">
                {report.status === 'READY' 
                  ? 'The engine confirms a 100% mathematical zero-error state for the period. Professional closing is authorized.' 
                  : `Fiscal period closing is suspended due to ${report.blockers.length} algorithmic blockers identified during inspection.`}
              </p>
            </div>

            <button 
              disabled={report.status !== 'READY'}
              className={`mt-4 px-12 py-4 rounded-2xl font-black text-base uppercase tracking-[0.2em] transition-all flex items-center gap-4 ${
                report.status === 'READY' 
                  ? 'bg-white text-black hover:bg-slate-200 shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95' 
                  : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
              }`}
            >
              Post Final Fiscal Closing
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CloseReadiness;
