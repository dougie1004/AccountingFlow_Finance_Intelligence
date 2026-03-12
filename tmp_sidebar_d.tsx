import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    BookOpen,
    Users,
    Settings,
    LogOut,
    TrendingUp,
    ListFilter,
    Menu,
    X,
    Calculator,
    Package,
    ShoppingCart,
    Landmark,
    ShieldCheck,
    Database,
    RotateCcw,
    FileText,
    Zap,
    PieChart,
    TrendingDown
} from 'lucide-react';
import { useContext } from 'react';
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
            title: '寃쎌쁺 諛?遺꾩꽍 (Analysis)',
            items: [
                { id: 'dashboard', label: '??쒕낫??, description: '?꾧툑 ?먮쫫, 二쇱슂 KPI ???뚯궗???щТ ?곹깭瑜??뚯븙?⑸땲??', icon: LayoutDashboard },
                { id: 'reports', label: '寃쎌쁺 遺꾩꽍 由ы룷??, description: 'IR??諛?寃쎌쁺吏?????ъ링 遺꾩꽍 由ы룷?몃? ?앹꽦?⑸땲??', icon: TrendingUp },
            ]
        },
        {
            title: '?뚭퀎 ?먯옣 (Accounting)',
            items: [
                { id: 'ledger', label: '嫄곕옒 ?꾪몴 愿由?, description: 'AI媛 異붿텧??紐⑤뱺 嫄곕옒 ?곗씠?곕? 議고쉶?섍퀬 愿由ы빀?덈떎.', icon: BookOpen },
                { id: 'ledger-view', label: '珥앷퀎?뺤썝??(G/L)', description: '?쒖? ?뚭퀎 湲곗????곕Ⅸ 怨꾩젙蹂??먯옣??議고쉶?⑸땲??', icon: FileText },
                { id: 'approval-desk', label: '?꾪몴 ?뱀씤 ?곗뒪??, description: 'AI 遺꾨쪟 ?꾪몴???좊ː?꾨? 寃利앺븯怨?理쒖쥌 ?뱀씤?⑸땲??', icon: ShieldCheck, badge: true },
                { id: 'financial-statements', label: '?щТ?쒗몴 (B/S, P/L)', description: '?李⑤?議고몴, ?먯씡怨꾩궛?????쒖? ?щТ?쒗몴瑜?議고쉶?⑸땲??', icon: PieChart },
                { id: 'lease-ledger', label: '由ъ뒪 ?뚭퀎 愿由?, description: 'K-IFRS 1116 由ъ뒪 ?먯궛/遺梨?諛??곹솚 ?ㅼ?以꾩쓣 愿由ы빀?덈떎.', icon: TrendingDown },
                { id: 'advanced-ledger', label: '?뱀닔 ?뚭퀎 愿由?, description: 'R&D ?먯궛?? ?명솕 ?됯? ??怨좊궃??泥섎━瑜??섑뻾?⑸땲??', icon: Zap },
            ]
        },
        {
            title: '?댁쁺 諛??먯궛 (Operations)',
            items: [
                { id: 'scm', label: '怨듦툒留?SCM) 愿由?, description: '留ㅼ엯/留ㅼ텧 諛쒖＜ 諛?臾쇰쪟 ?꾨줈?몄뒪瑜?愿由ы빀?덈떎.', icon: ShoppingCart },
                { id: 'inventory', label: '?ш퀬 ?먯궛 愿由?, description: '?덈ぉ蹂??ш퀬 ?꾪솴 諛?媛移섎? ?ㅼ떆媛꾩쑝濡??됯??⑸땲??', icon: Package },
                { id: 'assets', label: '怨좎젙?먯궛 愿由?, description: '??臾댄삎 ?먯궛??痍⑤뱷 諛?媛먭??곴컖??愿由ы빀?덈떎.', icon: Landmark },
                { id: 'partners', label: '嫄곕옒泥??ㅽ듃?뚰겕', description: '二쇱슂 嫄곕옒泥섏???嫄곕옒 愿怨?諛??뱀씤 ?곹깭瑜?愿由ы빀?덈떎.', icon: Users },
            ]
        },
        {
            title: '?몃Т 諛?洹쒖젣 (Tax)',
            items: [
                { id: 'tax-adjustments', label: '?몃Т 議곗젙 ?붿쭊', description: '踰뺤씤??異붿젙, 遺媛??留듯븨 ???꾨Ц ?몃Т 湲곕뒫???섑뻾?⑸땲??', icon: Calculator },
            ]
        }
    ];

    const SidebarContent = () => {
        const { ledger, resetData } = useContext(AccountingContext)!;
        const { theme, setTheme, resolvedTheme } = useTheme();
        const unconfirmedCount = ledger.filter(e => e.status === 'Unconfirmed' || e.status === 'Pending Review').length;

        return (
            <div className="flex flex-col h-full bg-[#070C18] text-slate-400 border-r border-[#151D2E] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="h-[73px] flex items-center justify-between px-6 border-b border-white/5 shrink-0">
                    <div className="flex flex-col">
                        <span className="text-white font-black text-sm tracking-tight">AccountingFlow</span>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500/80">Professional Controller</span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar">
                    {menuGroups.map((group) => (
                        <div key={group.title} className="space-y-2">
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
                                                ? 'bg-indigo-600/10 text-indigo-400 shadow-[inset_0_0_20px_rgba(79,70,229,0.1)]'
                                                : 'hover:bg-white/5 hover:text-slate-200'
                                                }`}
                                        >
                                            <item.icon size={18} className={`transition-colors shrink-0 ${activeTab === item.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                            <span className="font-bold text-[13px] tracking-wide truncate">
                                                {item.label}
                                            </span>

                                            {item.id === 'approval-desk' && unconfirmedCount > 0 && (
                                                <span className="ml-auto bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md min-w-[18px] text-center shadow-lg shadow-rose-600/20">
                                                    {unconfirmedCount}
                                                </span>
                                            )}

                                            {activeTab === item.id && (
                                                <div className={`${item.id === 'approval-desk' && unconfirmedCount > 0 ? 'ml-2' : 'ml-auto'} w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.8)] shrink-0`}></div>
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
                    <h3 className="px-4 text-[9px] font-black text-slate-700 uppercase tracking-[0.15em] mb-2">System Setup</h3>

                    <button
                        onClick={() => {
                            setTab('migration');
                            if (isMobile) setIsOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${activeTab === 'migration' ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-white/5 text-slate-500 hover:text-slate-300'}`}
                    >
                        <Database size={18} className={activeTab === 'migration' ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                        <span className="font-bold text-[13px] tracking-wide">?곗씠???곕룞 諛??닿?</span>
                    </button>

                    {/* Theme Toggle Button */}
                    <button
                        onClick={() => {
                            const nextTheme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
                            setTheme(nextTheme);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-white/5 hover:text-slate-200 transition-all duration-300 group"
                    >
                        <div className="flex items-center gap-3">
                            {resolvedTheme === 'dark' ? (
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 group-hover:text-slate-300">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 group-hover:text-slate-300">
                                    <circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                                </svg>
                            )}
                            <span className="font-bold text-[13px] tracking-wide">
                                {theme === 'auto' ? '?먮룞 ?뚮쭏' : theme === 'light' ? '?쇱씠?? : '?ㅽ겕'}
                            </span>
                        </div>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider">
                            {theme.toUpperCase()}
                        </span>
                    </button>

                    <div className="my-2 border-t border-white/5" />

                    <button
                        onClick={() => {
                            setTab('settings');
                            if (isMobile) setIsOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${activeTab === 'settings' ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-white/5 text-slate-500 hover:text-slate-300'}`}
                    >
                        <Settings size={18} className={activeTab === 'settings' ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                        <span className="font-bold text-[13px] tracking-wide">?쒖뒪???ㅼ젙</span>
                    </button>

                    <div className="my-2 border-t border-white/5" />

                    <button
                        onClick={() => {
                            if (window.confirm('?꾩옱 ?λ???紐⑤뱺 ?곗씠?곕? 珥덇린?뷀븯?쒓쿋?듬땲源? (???묒뾽? ?섎룎由????놁뒿?덈떎)')) {
                                resetData();
                                setTab('dashboard');
                            }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-orange-500/10 hover:text-orange-400 transition-all duration-300 group"
                    >
                        <RotateCcw size={18} className="text-slate-600 group-hover:text-orange-400 shrink-0" />
                        <span className="font-bold text-[13px] tracking-wide truncate">?λ? ?곗씠??珥덇린??/span>
                    </button>

                    <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 group">
                        <LogOut size={18} className="text-slate-600 group-hover:text-red-400 shrink-0" />
                        <span className="font-bold text-[13px] tracking-wide truncate">濡쒓렇?꾩썐</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Mobile Toggle Button (Visible only on lg:hidden) */}
            <div className="lg:hidden fixed top-4 left-4 z-[50]">
                <button
                    onClick={() => setIsOpen(true)}
                    className="p-3 bg-[#151D2E] rounded-xl shadow-2xl text-white hover:bg-[#1c283d] border border-white/5 transition-all active:scale-95"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Desktop Sidebar (Static space occupier) */}
            <aside className="hidden lg:block w-[320px] h-screen shrink-0 sticky top-0">
                <SidebarContent />
            </aside>

            {/* Mobile/Tablet Drawer (Animated) */}
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
                            className="fixed inset-y-0 left-0 z-[70] w-[320px] lg:hidden"
                        >
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
