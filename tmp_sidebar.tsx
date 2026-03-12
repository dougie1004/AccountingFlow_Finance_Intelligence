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
    Moon
} from 'lucide-react';
import { AccountingContext } from '../../context/AccountingContext';
import { useTheme } from '../../context/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';

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
            title: 'STRATEGY',
            items: [
                { id: 'dashboard', label: 'CFO Dashboard', icon: LayoutDashboard },
                { id: 'cashflow', label: 'Cash Flow', icon: Wallet },
                { id: 'monthly-pnl', label: 'Monthly P&L', icon: TrendingUp },
            ]
        },
        {
            title: 'ACCOUNTING',
            items: [
                { id: 'ledger', label: 'Journal', icon: BookOpen },
                { id: 'ledger-view', label: 'General Ledger', icon: FileText },
                { id: 'financial-statements', label: 'Financial Statements', icon: PieChart },
            ]
        },
        {
            title: 'OPERATIONS',
            items: [
                { id: 'settlement', label: 'Settlement', icon: Calculator },
                { id: 'vendor-ledger', label: 'Vendor Ledger', icon: Landmark },
                { id: 'partners', label: 'Vendor Management', icon: Users },
            ]
        }
    ];

    const SidebarContent = () => {
        const { resetData } = useContext(AccountingContext)!;
        const { theme, setTheme } = useTheme();

        return (
            <div className="flex flex-col h-full bg-[#1A1F2B] text-slate-400 border-r border-[#2A3143] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="h-[73px] flex items-center justify-between px-6 border-b border-white/5 shrink-0 bg-[#1A1F2B]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-lg">A</span>
                        </div>
                        <span className="text-white font-black text-sm tracking-tight text-xl ml-1">AccountingFlow</span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto custom-scrollbar bg-[#1A1F2B]">
                    {menuGroups.map((group) => (
                        <div key={group.title} className="space-y-1">
                            <h3 className="px-4 text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">{group.title}</h3>
                            <div className="space-y-0.5">
                                {group.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setTab(item.id);
                                            if (isMobile) setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300 group ${activeTab === item.id
                                            ? 'bg-[#2A3143] text-white font-bold border-l-2 border-indigo-500 rounded-l-none'
                                            : 'hover:bg-white/5 hover:text-slate-200 text-slate-400'
                                            }`}
                                    >
                                        <item.icon size={16} className={`transition-colors shrink-0 ${activeTab === item.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                        <span className="text-[13px] tracking-wide truncate">
                                            {item.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Bottom Section: System & Onboarding */}
                <div className="p-4 border-t border-white/5 bg-[#1A1F2B] shrink-0 space-y-1">
                    <h3 className="px-4 text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">SYSTEM</h3>
                    <button
                        onClick={() => {
                            setTab('migration');
                            if (isMobile) setIsOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${activeTab === 'migration' ? 'bg-[#2A3143] text-indigo-400' : 'hover:bg-white/5 text-slate-500 hover:text-slate-300'}`}
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
