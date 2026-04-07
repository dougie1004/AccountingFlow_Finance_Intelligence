import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Lock, Mail, Key, ShieldCheck, Zap, Star, ArrowRight, Check } from 'lucide-react';

export const LoginPage = () => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [selectedPlan, setSelectedPlan] = useState<'basic' | 'standard' | 'pro'>('standard');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === 'signup') {
                const isPilot = ['@insightrix.ai.kr', 'pilot.com'].some(domain => email.toLowerCase().includes(domain));
                const trialStart = new Date();
                const trialEnd = new Date(trialStart);
                trialEnd.setDate(trialEnd.getDate() + (isPilot ? 90 : 14));

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            access_type: 'trial',
                            plan: selectedPlan
                        }
                    }
                });
                if (error) throw error;
                
                if (data.user) {
                    await supabase.from('user_profile').upsert({
                        user_id: data.user.id,
                        email: data.user.email,
                        access_type: 'trial',
                        plan: selectedPlan,
                        trial_start: trialStart.toISOString(),
                        trial_end: trialEnd.toISOString(),
                        requested_plan: 'none',
                        upgrade_status: 'none'
                    });
                }
                
                alert(`Join Free 성공! (${selectedPlan.toUpperCase()} 플랜) ${isPilot ? '3개월(Pilot)' : '14일'} 무료 체험이 시작됩니다.`);
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
            }
        } catch (error: any) {
            alert((mode === 'login' ? '로그인 실패: ' : '회원가입 실패: ') + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#070C18] flex flex-col justify-center items-center py-10 px-4 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />

            <div className={`max-w-[75rem] w-full grid grid-cols-1 ${mode === 'signup' ? 'lg:grid-cols-[1fr_400px]' : 'lg:grid-cols-2'} gap-8 items-center z-10 transition-all duration-500`}>
                
                {/* Left: Branding & Pricing */}
                <div className="p-4 md:p-8 space-y-8">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                                <Lock size={28} className="text-white" />
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight italic">AccountingFlow</h1>
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-300 leading-snug">
                            차세대 AI 재무 시스템,<br /><span className="text-indigo-400">당신의 비즈니스 스케일에 맞게.</span>
                        </h2>
                    </div>

                    {mode === 'signup' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                            {/* Basic Plan */}
                            <div 
                                onClick={() => setSelectedPlan('basic')}
                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${selectedPlan === 'basic' ? 'bg-slate-800/80 border-slate-400 shadow-lg shadow-slate-500/20' : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-500/50'}`}
                            >
                                <div className="text-slate-400 mb-2"><ShieldCheck size={24} /></div>
                                <h3 className="text-lg font-black text-white mb-1">Basic</h3>
                                <p className="text-xs text-slate-400 mb-4 h-10">스타트업 및 소호 사업자를 위한 필수 AI 장부.</p>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-[11px] text-slate-300"><Check size={12} className="text-slate-400"/> AI 쿼리 <span className="font-bold text-white">월 50회</span> 제공</li>
                                    <li className="flex items-center gap-2 text-[11px] text-slate-300"><Check size={12} className="text-slate-400"/> 기본 전표 관리 및 생성</li>
                                </ul>
                            </div>

                            {/* Standard Plan */}
                            <div 
                                onClick={() => setSelectedPlan('standard')}
                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${selectedPlan === 'standard' ? 'bg-indigo-900/40 border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-indigo-900/10 border-indigo-800/30 hover:border-indigo-600/50'}`}
                            >
                                <div className="absolute -top-3 right-4 bg-indigo-500 text-white text-[9px] font-black px-2 py-1 rounded-full tracking-wider uppercase">Most Popular</div>
                                <div className="text-indigo-400 mb-2"><Zap size={24} /></div>
                                <h3 className="text-lg font-black text-white mb-1">Standard</h3>
                                <p className="text-xs text-slate-400 mb-4 h-10">중소기업을 위한 경영 전략 및 자동화 모듈 통합.</p>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-[11px] text-slate-300"><Check size={12} className="text-indigo-400"/> AI 쿼리 <span className="font-bold text-white">월 200회</span> 제공</li>
                                    <li className="flex items-center gap-2 text-[11px] text-slate-300"><Check size={12} className="text-indigo-400"/> AI 승인 데스크 (컨플라이언스)</li>
                                </ul>
                            </div>

                            {/* Pro Plan */}
                            <div 
                                onClick={() => setSelectedPlan('pro')}
                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${selectedPlan === 'pro' ? 'bg-amber-900/20 border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-amber-900/10 border-amber-800/30 hover:border-amber-600/50'}`}
                            >
                                <div className="text-amber-400 mb-2"><Star size={24} /></div>
                                <h3 className="text-lg font-black text-white mb-1">Pro</h3>
                                <p className="text-xs text-slate-400 mb-4 h-10">엔터프라이즈 전용 최상위 전략 및 무제한 기능.</p>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-[11px] text-slate-300"><Check size={12} className="text-amber-400"/> AI 쿼리 <span className="font-bold text-amber-400">무제한</span> 제공</li>
                                    <li className="flex items-center gap-2 text-[11px] text-slate-300"><Check size={12} className="text-amber-400"/> 전략 나침반 (Simulation)</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Auth Form */}
                <div className="w-full bg-[#111827] p-8 md:p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative h-fit">
                    <div className="flex items-center justify-between mb-8 space-x-2 bg-black/20 p-1.5 rounded-2xl border border-white/5">
                        <button 
                            className={`flex-1 py-3 text-sm font-black tracking-widest uppercase transition-all rounded-xl ${mode === 'login' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-transparent text-slate-500 hover:text-slate-300'}`}
                            onClick={() => setMode('login')}
                        >
                            Login
                        </button>
                        <button 
                            className={`flex-1 py-3 text-sm font-black tracking-widest uppercase transition-all rounded-xl flex items-center justify-center gap-2 ${mode === 'signup' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-transparent text-slate-500 hover:text-slate-300'}`}
                            onClick={() => setMode('signup')}
                        >
                            Join Free
                        </button>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-6">
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                                    <input 
                                        type="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-[#0A101E] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                        placeholder="user@company.com"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Password</label>
                                <div className="relative group">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                                    <input 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-[#0A101E] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-black tracking-widest uppercase transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/40 flex justify-center items-center gap-2"
                        >
                            {loading 
                                ? 'Processing...' 
                                : (mode === 'login' ? 'Sign In To System' : 'Create Free Account')
                            }
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
