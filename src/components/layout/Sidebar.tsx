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
    Target
} from 'lucide-react';
import { AccountingContext } from '../../context/AccountingContext';
import { useTheme } from '../../context/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';
import { Tooltip } from '../common/Tooltip';

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
                { id: 'dashboard', label: 'CFO 대시보드', description: '실시간 자금 흐름과 전사적 성과 지표를 한눈에 모니터링합니다.', icon: LayoutDashboard },
                { id: 'reports', label: '경영 분석 리포트', description: 'IR 및 경영진 보고용 자동 생성 리포트를 조회합니다.', icon: TrendingUp },
                { id: 'strategic-compass', label: '스트래티직 컴퍼스', description: '미래 시나리오 시뮬레이션 및 성장 전략을 수립합니다.', icon: Zap, badge: true, badgeText: "AI Simulation" },
                { id: 'monthly-pnl', label: '월별 손익 현황', description: '3개년 시뮬레이션 기반 월 단위 정밀 손익 분석을 확인합니다.', icon: PieChart },
                { id: 'risk-heatmap', label: '리스크 히트맵', description: '전사적 리스크 요인을 시각화하고 우선순위를 관리합니다.', icon: Target },
            ]
        },
        {
            title: '회계 및 세무 (ACCOUNTING)',
            items: [
                { id: 'ledger', label: '분개장 (Journal)', description: '모든 회계 거래 내역을 조회하고 관리합니다.', icon: BookOpen },
                { id: 'ledger-view', label: '총계정원장 (GL)', description: '계정 과목별 상세 원장 데이터를 확인합니다.', icon: FileText },
                { id: 'approval-desk', label: '전표 승인 데스크', description: 'AI가 분류한 전표의 신뢰도를 검증하고 최종 승인합니다.', icon: ShieldCheck, badge: true, badgeText: "Governance" },
                { id: 'trial-balance', label: '합계잔액시산표 (TB)', description: '시산표를 통해 자산, 부채, 자본의 균형을 검증합니다.', icon: Calculator },
                { id: 'financial-statements', label: '재무제표 (B/S, P/L)', description: '공식적인 재무상태표와 손익계산서를 산출합니다.', icon: PieChart },
                { id: 'tax-adjustments', label: '세무 조정 엔진', description: '법인세 추정 및 세무 조정 사항을 관리합니다.', icon: Calculator },
                { id: 'advanced-ledger', label: '특수 회계 관리', description: 'R&D 자산화, 외화 평가 등 고난도 회계 처리를 수행합니다.', icon: Zap },
            ]
        },
        {
            title: '운영 및 자산 (OPERATIONS)',
            items: [
                { id: 'scm', label: '공급망(SCM) 관리', description: '매입/매출 발주 및 물류 프로세스를 추적합니다.', icon: ShoppingCart },
                { id: 'inventory', label: '재고 자산 관리', description: '품목별 재고 현황 및 가치를 실시간으로 관리합니다.', icon: Package },
                { id: 'partners', label: '거래처 네트워크', description: '주요 파트너사의 거래 내역 및 상태를 관리합니다.', icon: Users },
                { id: 'assets', label: '고정자산 관리', description: '유/무형 자산의 취득 및 감가상각을 관리합니다.', icon: Landmark },
                { id: 'lease-ledger', label: '리스 회계 (IFRS 16)', description: '리스 자산의 부채 인식 및 상환 스케줄을 관리합니다.', icon: TrendingDown },
                { id: 'settlement', label: '채권/채무 정산', description: '미수금 및 미지급금의 연령 분석 및 정산을 수행합니다.', icon: Calculator },
            ]
        },
        {
            title: 'AI 거버넌스 (GOVERNANCE)',
            items: [
                { id: 'ai-assistant', label: 'AI CFO 어시스턴트', description: '재무적 의사결정을 돕는 AI 비서와 대화합니다.', icon: Activity },
                { id: 'scenario-manager', label: '시나리오 매니저', description: '발견된 리스크 시나리오를 관리하고 대응책을 수립합니다.', icon: ShieldCheck },
            ]
        }
    ];

    const SidebarContent = () => {
        const { resetData } = useContext(AccountingContext)!;
        const { theme, setTheme } = useTheme();

        return (
            <div className="flex flex-col h-full bg-[#070C18] text-slate-400 border-r border-[#151D2E] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="h-[73px] flex items-center justify-between px-6 border-b border-white/5 shrink-0">
                    <div className="flex flex-col">
                        <span className="text-white font-black text-sm tracking-tight text-xl ml-1">AccountingFlow</span>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500/80">Professional Controller</span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
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

                                            {item.badge && (
                                                <span className="ml-auto flex items-center gap-1 bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-700">
                                                    <ShieldCheck size={10} className="text-amber-500" />
                                                    {item.badgeText}
                                                </span>
                                            )}
                                        </button>
                                    </Tooltip>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Bottom Section: System & Onboarding */}
                <div className="p-4 border-t border-white/5 bg-slate-950/50 backdrop-blur-sm shrink-0 space-y-1">
                    <h3 className="px-4 text-[9px] font-black text-slate-700 uppercase tracking-[0.15em] mb-2">System</h3>
                    <button
                        onClick={() => {
                            setTab('migration');
                            if (isMobile) setIsOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${activeTab === 'migration' ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-white/5 text-slate-500 hover:text-slate-300'}`}
                    >
                        <Database size={16} className={activeTab === 'migration' ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                        <span className="font-bold text-[13px] tracking-wide">Data Migration</span>
                    </button>

                    <button
                        onClick={() => {
                            const nextTheme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
                            setTheme(nextTheme);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 hover:text-slate-200 transition-all duration-300 group"
                    >
                        <Moon size={16} className="text-slate-500 group-hover:text-slate-300" />
                        <span className="font-bold text-[13px] tracking-wide">
                            Dark Mode
                        </span>
                    </button>

                    <button
                        onClick={() => {
                            setTab('settings');
                            if (isMobile) setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 hover:text-slate-200 transition-all duration-300 group"
                    >
                        <Settings size={16} className="text-slate-500 group-hover:text-slate-300" />
                        <span className="font-bold text-[13px] tracking-wide">
                            System Settings
                        </span>
                    </button>

                    <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 hover:text-white transition-all duration-300 group">
                        <LogOut size={16} className="text-slate-600 shrink-0" />
                        <span className="font-bold text-[13px] tracking-wide truncate">Logout</span>
                    </button>

                    <button
                        onClick={() => {
                            if (window.confirm('디버그: 장부를 초기화 하시겠습니까?')) {
                                resetData();
                                setTab('dashboard');
                            }
                        }}
                        className="w-full mt-2 flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 group text-slate-600"
                    >
                        <RotateCcw size={12} className="shrink-0" />
                        <span className="font-bold text-[10px] tracking-wide truncate">Reset Data (Dev)</span>
                    </button>
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

            <aside className="hidden lg:block w-[260px] h-screen shrink-0 sticky top-0">
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
                            className="fixed inset-y-0 left-0 z-[70] w-[260px] lg:hidden"
                        >
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
