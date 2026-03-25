import { useState, useRef, useEffect, useContext } from "react";
import {
    Bot, User, Sparkles, Wand2,
    MessageSquare, Zap, Target,
    ArrowRight, Loader2, ShieldCheck, Trash2,
    BookOpen, X, Save
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from "framer-motion";
import { AccountingContext } from "../context/AccountingContext";
import { AiChatMessage } from "../types";

// Tauri invoke wrapper
const safeInvoke = async (cmd: string, args?: any) => {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke(cmd, args);
    } catch (err) {
        console.error(`Tauri Invoke Error [${cmd}]:`, err);
        throw err;
    }
};

const MAX_LEDGER_ANALYSIS = 500;

const summarizeLedger = (ledger: any[], targetYearMonth?: string) => {
    const count = ledger.length;
    let totalRevenue = 0;
    let totalExpense = 0;
    let largestExpense = { amount: 0, description: "" };
    
    // Yearly stats for context mapping
    const yearlyStats: Record<string, { revenue: number, expense: number }> = {};
    const yearsFound: string[] = [];

    // Monthly-specific aggregation for current month monitoring
    const currentMonthItems: any[] = [];
    const now = targetYearMonth || "2028-12"; 

    // Full iteration for totals (crucial for SSOT alignment)
    ledger.forEach(entry => {
        const amount = entry.amount || 0;
        const entryDate = entry.date || "";
        const year = entryDate.substring(0, 4);
        const yearMonth = entryDate.substring(0, 7);

        if (year && !yearlyStats[year]) {
            yearlyStats[year] = { revenue: 0, expense: 0 };
            yearsFound.push(year);
        }

        const acc = (entry.debitAccount || "").trim();
        const isRevenue = entry.type === 'Revenue' || entry.creditAccount?.includes("매출") || entry.creditAccount?.includes("Revenue");
        const accId = (entry.debitAccountId || entry.accountId || "").toString();

        const isExpense = entry.type === 'Expense' || entry.type === 'Payroll' || 
                         (acc.endsWith("비") && !acc.includes("비품")) || 
                         acc.includes("Expense") || acc.includes("비용") ||
                         acc.includes("지급") || acc.includes("급여") || 
                         accId.startsWith("acc_8") || accId.startsWith("8") ||
                         accId.startsWith("acc_5") || accId.startsWith("5");

        if (isRevenue) {
            totalRevenue += amount;
            if (year) yearlyStats[year].revenue += amount;
        }
        if (isExpense) {
            totalExpense += amount;
            if (year) yearlyStats[year].expense += amount;
            if (amount > largestExpense.amount) {
                largestExpense = { amount, description: entry.description };
            }
            if (yearMonth === now) {
                currentMonthItems.push(entry);
            }
        }
    });

    // 15 most recent for detail
    const recentSet = ledger.slice(-20);

    return {
        transaction_count: count,
        total_revenue: totalRevenue,
        total_expense: totalExpense,
        yearly_stats: yearlyStats,
        years_range: yearsFound.sort().join(", "),
        largest_expense: largestExpense,
        current_month_detail: currentMonthItems.map(e => `[${e.date}] ${e.description}: ${e.amount.toLocaleString()} KRW`).join("\n"),
        recent_activity: recentSet.map(e => `[${e.date}] ${e.description}: ${e.amount.toLocaleString()} KRW (Type: ${e.scope || 'Actual'})`).join("\n")
    };
};

const SuggestionChip = ({ label, onClick, icon: Icon }: any) => (
    <button
        onClick={() => onClick(label)}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-slate-400 hover:border-blue-500/50 hover:text-white hover:bg-blue-600/10 transition-all shadow-sm"
    >
        {Icon && <Icon size={12} className="text-blue-500" />}
        {label}
    </button>
);

export default function AIAssistant() {
    const context = useContext(AccountingContext);
    const tenantId = context?.config.tenantId || "default-tenant";
    const messages = context?.aiMessages || [];
    const setMessages = context?.setAiMessages || (() => {});
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
    const [tempKnowledge, setTempKnowledge] = useState(context?.companyKnowledge || "");
    const [isTraining, setIsTraining] = useState(false);


    const clearHistory = () => {
        context?.clearAiMessages();
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const buildAIContext = () => {
        const actualLedger = context?.ledger || [];
        const scenarioLedger = context?.scenarioResults || [];
        
        // Target specifically 2028-12 for this context
        const summary = summarizeLedger(actualLedger, "2028-12");
        const scenarioSummary = scenarioLedger.length > 0 ? summarizeLedger(scenarioLedger, "2028-12") : null;
        
        const financials = context?.financials || { totalAssets: 0, totalLiabilities: 0, netIncome: 0 };
        
        const yearlyBreakdown = Object.entries(summary.yearly_stats)
            .map(([yr, stat]) => `- ${yr}년: 수익 ${stat.revenue.toLocaleString()}, 비용 ${stat.expense.toLocaleString()} (KRW)`)
            .join("\n");

        return `
[AI_CONTEXT]
Identity: AccountingFlow AI CFO Assistant (보좌관)
Current System Time: 2026-03-24 (Analysis focusing on current month Dec 2028 per logs)
Primary Data Source: Actual Ledger (확정 장부)

--- ACTUAL DATA (REAL WORLD) ---
- Period: ${summary.years_range}
- Current Month (2028-12) Detailed Expenses:
${summary.current_month_detail || "No entries for this month yet."}
- Total Items: ${summary.transaction_count}
- Grand Total Revenue/Expense: ${summary.total_revenue.toLocaleString()} / ${summary.total_expense.toLocaleString()} KRW

--- SCENARIO DATA (STRATEGIC PROJECTION) ---
${scenarioSummary ? `
- Scenario items detected. Note: These are NOT actual transactions.
- Scenario 2028-12 Mock Expenses:
${scenarioSummary.current_month_detail}
` : "No active strategic scenario currently mapped."}

--- YEARLY PERFORMANCE (ACTUAL) ---
${yearlyBreakdown}

[STRICT GUIDELINE]
1. If the user asks about "this month" or "current status", ALWAYS analyze the "ACTUAL DATA" first.
2. If Actual Data for 2028-12 exists, use it as the primary truth. (e.g., Marketing 8,000,000 KRW).
3. If the user asks "why is it different?", explain that the actual ledger says X, but your strategic scenario (with multipliers) predicts Y.
4. DO NOT sum entries from different months when reporting monthly totals.
`;
    };

    const handleSend = async (customText?: string) => {
        if (isTyping) return; // Loading Guard

        const text = customText || input;
        if (!text.trim()) return;

        const userMsg: AiChatMessage = { role: "user", content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        try {
            const aiContext = buildAIContext();
            const structuredPrompt = `${aiContext}\n\nUser Question: ${text}`;

            const response = await safeInvoke("ask_ai_assistant", {
                message: structuredPrompt,
                tenantId: tenantId
            });

            if (!response || typeof response !== "string") {
                throw new Error("Invalid AI response received from backend.");
            }

            setMessages(prev => [...prev, { role: "bot", content: response }]);
            setIsTyping(false);
        } catch (err) {
            console.error(err);
            const errMsg = err instanceof Error ? err.message : String(err);
            setMessages(prev => [...prev, { role: "bot", content: "죄송합니다. 요청을 처리하는 중에 오류가 발생했습니다. (Reason: " + errMsg + ")" }]);
            setIsTyping(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsTraining(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target?.result as ArrayBuffer;
                const bytes = new Uint8Array(arrayBuffer);
                const mime = file.type;

                const extractedText = await safeInvoke("train_knowledge_from_file", {
                    bytes: Array.from(bytes),
                    mime: mime
                }) as string;

                setTempKnowledge(prev => (prev ? prev + "\n\n" : "") + extractedText);
                setIsTraining(false);
            };
            reader.readAsArrayBuffer(file);
        } catch (err) {
            console.error("Training Error:", err);
            alert("문서 학습 중 오류가 발생했습니다.");
            setIsTraining(false);
        }
    };

    const suggestions = [
        { label: "경영진 보고용 핵심 요약 생성해줘", icon: Target },
        { label: "법인카드 사적 유용 의심 리스트 찾아줘", icon: ShieldCheck },
        { label: "최근 탐지된 고위험 이슈 현황 알려줘", icon: Zap },
        { label: "중복 결제 의심 거래 패턴 분석", icon: MessageSquare }
    ];

    return (
        <div className="h-screen flex flex-col bg-[#0B1221] relative overflow-hidden text-slate-300">
            {/* Background Decoration */}
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] opacity-30 z-0"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[100px] opacity-20 z-0"></div>

            {/* Header Content */}
            <div className="px-12 pt-12 pb-6 z-10 backdrop-blur-md bg-[#0B1221]/80 sticky top-0 border-b border-white/5">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[22px] flex items-center justify-center shadow-2xl shadow-blue-500/20 ring-4 ring-blue-500/10 transition-transform hover:scale-105 duration-500">
                            <Sparkles className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">AI CFO Assistant</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] antialiased">Strategic Accounting Intelligence</span>
                                <div className="h-1 w-1 rounded-full bg-blue-500/40" />
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">AccountingFlow • Pro</span>
                            </div>
                        </div>
                        <button 
                            onClick={clearHistory}
                            className="ml-auto p-3.5 bg-white/5 border border-white/10 rounded-2xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all group flex items-center gap-3 active:scale-95"
                            title="Clear History"
                        >
                            <Trash2 size={18} />
                            <span className="text-[11px] font-black uppercase tracking-widest hidden group-hover:block transition-all duration-300">Reset Session</span>
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        {suggestions.map((s, i) => (
                            <SuggestionChip key={i} label={s.label} icon={s.icon} onClick={handleSend} />
                        ))}
                        <button 
                            onClick={() => {
                                setTempKnowledge(context?.companyKnowledge || "");
                                setShowKnowledgeBase(true);
                            }}
                            className="flex items-center gap-2.5 px-5 py-2.5 bg-indigo-600/15 border border-indigo-500/30 rounded-full text-[11px] font-black text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-xl active:scale-95 group"
                        >
                            <BookOpen size={14} className="group-hover:rotate-12 transition-transform" />
                            KNOWLEDGE BASE 설정
                        </button>
                    </div>
                </div>
            </div>

            {/* Chat Container */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-6 py-10 z-10 scroll-smooth custom-scrollbar"
            >
                <div className="max-w-4xl mx-auto space-y-12">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex gap-6 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                        >
                            <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center flex-shrink-0 shadow-2xl transition-transform hover:rotate-3 ${msg.role === "bot" 
                                ? "bg-gradient-to-br from-slate-800 to-slate-900 text-blue-400 border border-white/10 ring-1 ring-white/5" 
                                : "bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-blue-500/20"
                                }`}>
                                {msg.role === "bot" ? <Bot size={24} /> : <User size={24} />}
                            </div>

                            <div className={`max-w-[85%] group`}>
                                <div className={`px-8 py-5 rounded-[28px] shadow-2xl border transition-all duration-300 ${msg.role === "bot"
                                    ? "bg-[#151D2E]/80 backdrop-blur-md border-white/5 text-slate-200 hover:bg-[#151D2E] hover:border-white/10"
                                    : "bg-blue-600/90 backdrop-blur-sm border-blue-500/30 text-white shadow-blue-500/10 hover:bg-blue-600"
                                    }`}>
                                    <div className="text-[15px] font-medium leading-relaxed tracking-wide antialiased">
                                        <ReactMarkdown
                                            components={{
                                                p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                                                strong: ({node, ...props}) => <span className="font-black text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-md" {...props} />,
                                                ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-4 space-y-2 border-l-2 border-white/5 pl-4" {...props} />,
                                                li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                                code: ({node, ...props}) => <code className="bg-black/30 px-2 py-0.5 rounded font-mono text-sm text-blue-300" {...props} />,
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                                <div className={`mt-3 flex items-center gap-2.5 px-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${msg.role === "bot" ? "bg-emerald-500 animate-pulse" : "bg-blue-400 opacity-50"}`} />
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] antialiased">
                                        {msg.role === "bot" ? "CFO Intelligence Core" : "Authorized User System"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-6 animate-in fade-in duration-300">
                            <div className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-slate-800 to-slate-900 text-blue-400 border border-white/10 flex items-center justify-center flex-shrink-0 animate-pulse">
                                <Bot size={24} className="animate-bounce duration-1000" />
                            </div>
                            <div className="bg-[#151D2E]/80 backdrop-blur-md border border-white/10 px-8 py-5 rounded-[28px] flex items-center gap-4 shadow-2xl">
                                <Loader2 size={18} className="text-blue-500 animate-spin" />
                                <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] font-outfit antialiased">
                                    Synthesizing Forensic Data...
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input Wrapper */}
            <div className="px-12 pb-12 pt-6 z-10 bg-gradient-to-t from-[#0B1221] via-[#0B1221] to-transparent">
                <div className="max-w-4xl mx-auto relative group">
                    <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-600/30 to-indigo-600/30 rounded-[35px] blur-xl opacity-0 group-focus-within:opacity-100 transition-all duration-700"></div>
                    <div className="relative flex items-center bg-[#151D2E]/90 backdrop-blur-2xl border border-white/10 rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden focus-within:border-blue-500/50 focus-within:ring-4 ring-blue-500/5 transition-all duration-500">
                        <div className="pl-8 text-blue-500/60 transition-colors group-focus-within:text-blue-400">
                            <Wand2 size={26} className="group-hover:rotate-12 transition-transform duration-500" />
                        </div>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="명령어를 입력하거나 고도화된 이상 데이터에 대한 질문을 남기세요..."
                            className="flex-1 bg-transparent px-6 py-7 text-[16px] font-bold text-white outline-none placeholder:text-slate-600 antialiased"
                        />
                        <div className="pr-5">
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() || isTyping}
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${input.trim() && !isTyping
                                    ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-2xl shadow-blue-500/30 hover:scale-105 active:scale-95 translate-x-0"
                                    : "bg-slate-800 text-slate-600 translate-x-1 opacity-50"
                                    }`}
                            >
                                {isTyping ? <Loader2 size={24} className="animate-spin" /> : <ArrowRight size={24} />}
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 px-6 flex items-center gap-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">
                        <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-blue-500" /> SECURE TUNNEL ACTIVE</span>
                        <div className="h-1 w-1 rounded-full bg-slate-800" />
                        <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-emerald-500" /> LEDGER SYNC: 100%</span>
                    </div>
                </div>
            </div>

            {/* Knowledge Base Modal */}
            <AnimatePresence>
                {showKnowledgeBase && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="w-full max-w-2xl bg-[#151D2E] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-indigo-600/5">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-500/10 rounded-2xl">
                                        <BookOpen className="text-indigo-400" size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">AI Knowledge Base</h2>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">회계 정책 및 특수 도메인 지식 학습</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowKnowledgeBase(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-8 flex-1 overflow-y-auto space-y-6 scroll-smooth custom-scrollbar">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-1">Company Rules & Contracts</label>
                                    <div className="relative">
                                        <input 
                                            type="file" 
                                            id="kd-upload" 
                                            className="hidden" 
                                            accept=".pdf,image/*" 
                                            onChange={handleFileUpload}
                                            disabled={isTraining}
                                        />
                                        <label 
                                            htmlFor="kd-upload"
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg active:scale-95 ${
                                                isTraining 
                                                ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                                                : "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white"
                                            }`}
                                        >
                                            {isTraining ? (
                                                <>
                                                    <Loader2 size={12} className="animate-spin" />
                                                    Document Training In Progress...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap size={12} />
                                                    문서 업로드 학습 (VAI)
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <textarea 
                                        value={tempKnowledge}
                                        onChange={(e) => setTempKnowledge(e.target.value)}
                                        className="w-full h-[300px] bg-[#0B1221] border border-white/10 rounded-2xl p-6 text-slate-300 font-medium leading-relaxed focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none custom-scrollbar"
                                        placeholder="이곳에 회사의 주요 계약 조건, 사내 회계 규정, 또는 AI가 참고해야 할 특이사항을 입력하세요..."
                                    />
                                    <div className="flex gap-4 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                                        <Zap className="text-indigo-400 shrink-0" size={16} />
                                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed italic">
                                            Tip: 계약서의 주요 조항이나 외부 세무 서신의 핵심 내용을 붙여넣으세요. AI가 질문을 분석할 때 이 내용을 '최우선 순위'로 참고하여 답변합니다.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-slate-900/50 border-t border-white/5 flex gap-4">
                                <button 
                                    onClick={() => setShowKnowledgeBase(false)}
                                    className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-[11px]"
                                >
                                    취소
                                </button>
                                <button 
                                    onClick={() => {
                                        context?.updateCompanyKnowledge(tempKnowledge);
                                        setShowKnowledgeBase(false);
                                    }}
                                    className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 uppercase tracking-widest text-[11px]"
                                >
                                    <Save size={16} /> 지식 베이스 업데이트
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <p className="text-center mt-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] opacity-50">
                AccountingFlow CFO Engine v5.0 • Global Integrated
            </p>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
            `}} />
        </div>
    );
}
