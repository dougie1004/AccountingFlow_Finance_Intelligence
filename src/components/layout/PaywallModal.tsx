import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export const PaywallModal = ({ onClose, onSuccess, forceLock = false }: { onClose: () => void, onSuccess: () => void, forceLock?: boolean }) => {
    const [selectedPlan, setSelectedPlan] = useState<'basic' | 'standard' | 'pro'>('pro');

    const handleUpgrade = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.id) return;

            const { error } = await supabase
                .from("user_profile")
                .update({
                    requested_plan: selectedPlan,
                    upgrade_status: 'pending'
                })
                .eq("user_id", user.id);

            if (error) throw error;
            onSuccess();
        } catch (err: any) {
            alert("요청 중 오류가 발생했습니다: " + err.message);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={forceLock ? undefined : onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
                
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-[#0F172A] w-full max-w-3xl rounded-3xl border border-white/10 shadow-2xl p-8 z-10">
                    {!forceLock && (
                        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white">
                            <X size={24} />
                        </button>
                    )}

                    <h2 className="text-2xl font-black text-white italic mb-2">
                        {forceLock ? 'Trial Expired. Upgrade Required.' : 'Upgrade Subscription'}
                    </h2>
                    <p className="text-slate-400 mb-8">
                        {forceLock ? 'Your free trial has ended. Please request a plan upgrade to continue using AccountingFlow.' : 'Choose the best plan for your business limits.'}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {['basic', 'standard', 'pro'].map((plan) => (
                            <div 
                                key={plan}
                                onClick={() => setSelectedPlan(plan as any)}
                                className={`cursor-pointer rounded-2xl border-2 p-6 transition-all ${selectedPlan === plan ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5 hover:border-white/20'}`}
                            >
                                <h3 className="text-xl font-bold text-white uppercase">{plan}</h3>
                                <p className="text-slate-400 text-sm mt-2 mb-6">
                                    {plan === 'basic' ? '소규모 기업용' : plan === 'standard' ? '중소기업 추천' : '엔터프라이즈 제한 없음'}
                                </p>
                                <ul className="space-y-3 mb-6">
                                    <li className="flex items-center gap-2 text-sm text-slate-300">
                                        <Check size={16} className="text-indigo-400" /> AI Queries: {plan === 'basic' ? '50' : plan === 'standard' ? '200' : 'Unlimited'}
                                    </li>
                                </ul>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={handleUpgrade}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black transition-all shadow-lg shadow-indigo-600/30 uppercase tracking-widest"
                    >
                        승인 요청하기 (무통장 입금)
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-4">
                        *요청 시 관리자 승인을 통해 요금제가 즉시 적용됩니다.
                    </p>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
