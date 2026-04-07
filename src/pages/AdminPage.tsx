import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle, XCircle, ShieldAlert } from 'lucide-react';

export const AdminPage: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        fetchPendingUsers();
    }, []);

    const fetchPendingUsers = async () => {
        const { data, error } = await supabase
            .from('user_profile')
            .select('*')
            .eq('upgrade_status', 'pending');
        if (data) setUsers(data);
    };

    const handleApprove = async (userId: string, requestedPlan: string) => {
        const { error } = await supabase
            .from('user_profile')
            .update({
                access_type: 'paid',
                plan: requestedPlan,
                requested_plan: 'none',
                upgrade_status: 'none',
                access_start: new Date().toISOString(),
                approved_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (!error) {
            alert('승인되었습니다.');
            fetchPendingUsers();
        } else {
            alert('승인 실패: ' + error.message);
        }
    };

    const handleReject = async (userId: string) => {
        const { error } = await supabase
            .from('user_profile')
            .update({
                requested_plan: 'none',
                upgrade_status: 'none'
            })
            .eq('user_id', userId);

        if (!error) {
            alert('거절되었습니다.');
            fetchPendingUsers();
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <ShieldAlert className="text-indigo-400" /> 관리자 전용: 플랜 승인 센터
            </h1>
            <div className="mt-8">
                {users.length === 0 ? (
                    <p className="text-slate-400">대기 중인 승인 요청이 없습니다.</p>
                ) : (
                    <div className="space-y-4">
                        {users.map(u => (
                            <div key={u.user_id} className="bg-[#151D2E] p-6 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-white font-bold">{u.user_id}</p>
                                    <p className="text-sm text-indigo-400">요청 플랜: {u.requested_plan.toUpperCase()}</p>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => handleApprove(u.user_id, u.requested_plan)}
                                        className="bg-emerald-600/20 text-emerald-400 px-4 py-2 rounded-lg font-bold hover:bg-emerald-600/40"
                                    >
                                        승인
                                    </button>
                                    <button 
                                        onClick={() => handleReject(u.user_id)}
                                        className="bg-rose-600/20 text-rose-400 px-4 py-2 rounded-lg font-bold hover:bg-rose-600/40"
                                    >
                                        거절
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
