import React, { useState, useEffect, useContext } from 'react';
import {
    LayoutDashboard,
    BookOpen,
    Users,
    Settings,
    LogOut,
    TrendingUp,
    Menu,
    X,
    Calculator,
    Landmark,
    FileText,
    PieChart,
    Wallet,
    Database,
    RotateCcw,
    Zap,
    TrendingDown,
    ShieldCheck,
    ShoppingCart,
    Package,
    Moon,
    Activity,
    Compass,
    Target,
    Lock,
    Sparkles
} from 'lucide-react';
import { AccountingContext } from '../../context/AccountingContext';
import { useTheme } from '../../context/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';
import { Tooltip } from '../common/Tooltip';
import { signOut } from '@/services/authService';
import { mockUpgrade } from '@/services/paymentService';
import { useAccessStatus } from '@/hooks/useAccessStatus'; // [추가]

interface SidebarProps {
    activeTab: string;
    setTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (!mobile) setIsOpen(true);
            else setIsOpen(false);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const menuGroups = [

        {
            title: '경영 및 전략 (STRATEGY)',
            items: [
                { id: 'dashboard', label: 'CFO 대시보드', description: '실시간 자금 흐름과 전사적 성과 지표를 모니터링합니다.', icon: LayoutDashboard },
                { id: 'reports', label: '경영 성과 리포트', description: '경영진 전용 보고서를 조회합니다.', icon: TrendingUp },
                { id: 'strategic-compass', label: '전략 나침반', description: '장기 성장 전략을 수립합니다.', icon: Target },
            ]
        },
        {
            title: '회계 및 운영 (OPERATIONS)',
            items: [
                { id: 'ai-assistant', label: 'AI 지능형 보좌관', description: 'AI assistant에게 경영 및 회계 관련 질문을 합니다.', icon: Sparkles },
                { id: 'cashflow', label: '자금일보 (Daily Cash Report)', description: '금일 자금 흐름과 시세 마감을 관리합니다.', icon: Zap },
                { id: 'approval-desk', label: 'AI 승인 검토 (Approval)', description: 'AI가 분석한 전표를 최종 검토 및 승인합니다.', icon: ShieldCheck },
                { id: 'ledger', label: '분개 전표 (Journal)', description: '모든 회계 거래 내역을 관리합니다.', icon: BookOpen },
                { id: 'ledger-view', label: '총계정원장 (GL)', description: '계정별 상세 원장을 조회합니다.', icon: FileText },
                { id: 'financial-statements', label: '재무제표 (Financial Statements)', description: 'B/S, P/L을 산출합니다.', icon: Database },
                { id: 'closing', label: '월마감 센터', description: '회계 기간을 공식적으로 마감하고 리포트를 봉인합니다.', icon: Lock },
                { id: 'risk-dashboard', label: '결산 및 자금 통제', description: '잠재적 위험 요소를 탐지하고 정산 현황을 모니터링합니다.', icon: ShieldCheck },
                { id: 'monthly-pnl', label: '월별 손익 현황', description: '월 단위 정밀 손익 분석을 확인합니다.', icon: PieChart },
            ]
        },
        {
            title: '상세 관리 (ADMIN)',
            items: [
                { id: 'settlement', label: '채권/채무 정산 (Settlement)', description: '미수금/미지급금을 정산합니다.', icon: Calculator },
                { id: 'assets', label: '고정자산 관리', description: '유무형 자산 및 상각을 관리합니다.', icon: Landmark },
                { id: 'lease-ledger', label: '리스 부채 관리 (IFRS 16)', description: '리스 회계를 처리합니다.', icon: TrendingDown },
                { id: 'partners-ledger', label: '거래처 원장', description: '거래처별 상세 내역을 확인합니다.', icon: Users },
                { id: 'partners', label: '거래처 정보 관리', description: '파트너사 데이터를 관리합니다.', icon: Settings },
                // { id: 'scenario-manager', label: '사업 계획 및 예산', description: '예산 편성 및 실적을 대비합니다.', icon: Target },
            ]
        }
    ];

const SidebarContent = () => {
    const { resetData, setIsPlanSelectorOpen } = useContext(AccountingContext)!;
    const { theme, setTheme } = useTheme();
    const access = useAccessStatus();

    const handleSubscriptionManage = () => {
        setIsPlanSelectorOpen(true);
    };

    return (
            <div className="flex flex-col h-full bg-[#070C18] text-slate-400 border-r border-[#151D2E] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="h-[90px] flex flex-col justify-center px-6 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-black text-xl tracking-tight italic">AccountingFlow</span>
                        <span className="text-indigo-400 font-black text-xs uppercase tracking-tighter">Enterprise</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600/20 border border-indigo-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">DEVELOPER EDITION</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar">
                    {menuGroups.map((group) => (
                        <div key={group.title} className="space-y-1">
                            <h3 className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.15em] mb-3">{group.title}</h3>
                            <div className="space-y-1">
                                {group.items.map((item) => (
                                    <Tooltip key={item.id} content={item.description} position="right">
                                        <button
                                            onClick={() => {
                                                setTab(item.id);
                                                if (isMobile) setIsOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${activeTab === item.id
                                                ? 'bg-indigo-600/20 text-indigo-400 font-bold border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.1)]'
                                                : 'hover:bg-white/5 hover:text-slate-200'
                                                }`}
                                        >
                                            <item.icon size={18} className={`transition-colors shrink-0 ${activeTab === item.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                            <span className="font-bold text-[13px] tracking-wide truncate">
                                                {item.label}
                                            </span>
                                        </button>
                                    </Tooltip>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Bottom Section: System & Onboarding */}
                <div className="p-5 border-t border-white/5 bg-[#0A101E] shrink-0">
                    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/5 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            {/* 🚀 [Dynamic Plan Name] 실시간 구독 등급 투영 */}
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                {access.plan?.toUpperCase()} PLAN
                            </span>
                            <div className="flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                <Zap size={8} className="text-indigo-400 fill-indigo-400" />
                                <span className="text-[8px] font-black text-indigo-400">AI Plus</span>
                            </div>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full mb-3 overflow-hidden">
                            <div className="bg-indigo-500 h-full w-[84%]" />
                        </div>
                        <button 
                            onClick={handleSubscriptionManage}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Manage Subscription
                        </button>
                    </div>

                    <div className="space-y-1">
                        <button 
                            onClick={() => {
                                setTab('migration');
                                if (isMobile) setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-all rounded-lg group ${activeTab === 'migration' ? 'text-indigo-400 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Database size={14} className={activeTab === 'migration' ? 'text-indigo-400' : ''} />
                            <span className="text-xs font-bold">데이터 연동 및 이관</span>
                        </button>
                        {/* 🛡️ [Security Gate] 관리자(isAdmin)에게만 노출되는 전용 메뉴 */}
                        {access.isAdmin && (
                            <button 
                                onClick={() => {
                                    setTab('admin');
                                    if (isMobile) setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-all rounded-lg group ${activeTab === 'admin' ? 'text-indigo-400 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <ShieldCheck size={14} className={activeTab === 'admin' ? 'text-indigo-400' : ''} />
                                <span className="text-xs font-bold text-indigo-400/80">관리자 승인 센터</span>
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                setTab('settings');
                                if (isMobile) setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-all rounded-lg group ${activeTab === 'settings' ? 'text-indigo-400 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Settings size={14} className={activeTab === 'settings' ? 'text-indigo-400' : ''} />
                            <span className="text-xs font-bold">시스템 설정</span>
                        </button>
                        <button 
                            onClick={async () => {
                                await signOut();
                                if (resetData) resetData();
                                // App.tsx의 onAuthStateChange가 감지하여 자동으로 AuthPage로 보냅니다.
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-slate-400 hover:text-white transition-all rounded-lg group"
                        >
                            <LogOut size={14} />
                            <span className="text-xs font-bold font-black tracking-tight underline-offset-4 decoration-indigo-500">로그아웃</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="lg:hidden fixed top-4 left-4 z-[50]">
                <button
                    onClick={() => setIsOpen(true)}
                    className="p-3 bg-[#151D2E] rounded-xl shadow-2xl text-white hover:bg-[#1c283d] border border-white/5 transition-all active:scale-95"
                >
                    <Menu size={20} />
                </button>
            </div>

            <aside className="hidden lg:block w-[260px] h-screen shrink-0 fixed top-0 left-0 z-[100]">
                <SidebarContent />
            </aside>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                            className="fixed inset-y-0 left-0 z-[100] w-[260px] lg:hidden"
                        >
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
