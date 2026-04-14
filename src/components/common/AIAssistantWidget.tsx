import React, { useState, useRef, useEffect, useContext } from 'react';
import { Bot, X, Send, Sparkles, Wand2, MessageSquare, Zap, Target, ShieldCheck, Loader2, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { AccountingContext } from '../../context/AccountingContext';

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

const summarizeLedger = (ledger: any[]) => {
    const count = ledger.length;
    let totalRevenue = 0;
    let totalExpense = 0;
    let largestExpense = { amount: 0, description: "" };

    const analyzeSet = count > MAX_LEDGER_ANALYSIS ? ledger.slice(-MAX_LEDGER_ANALYSIS) : ledger;

    analyzeSet.forEach(entry => {
        const amount = entry.amount || 0;
        const acc = (entry.debitAccount || "").trim();
        const isRevenue = entry.type === 'Revenue' || entry.creditAccount?.includes("매출") || entry.creditAccount?.includes("Revenue");
        
        const accId = (entry.debitAccountId || entry.accountId || "").toString();

        // Refined Expense Detection: Type is 'Expense' OR 'Payroll' OR ends with '비' (excluding '비품' asset)
        const isExpense = entry.type === 'Expense' || entry.type === 'Payroll' || 
                         (acc.endsWith("비") && !acc.includes("비품")) || 
                         acc.includes("Expense") || acc.includes("비용") ||
                         acc.includes("지급") || acc.includes("급여") || 
                         accId.startsWith("acc_8") || accId.startsWith("8") ||
                         accId.startsWith("acc_5") || accId.startsWith("5");

        if (isRevenue) {
            totalRevenue += amount;
        }
        if (isExpense) {
            totalExpense += amount;
            if (amount > largestExpense.amount) {
                largestExpense = { amount, description: entry.description };
            }
        }
    });

    return {
        transaction_count: count,
        total_revenue: totalRevenue,
        total_expense: totalExpense,
        largest_expense: largestExpense,
        recent_activity: analyzeSet.slice(-10).map(e => `[${e.date}] ${e.description}: ${e.amount}`).join("\n")
    };
};

interface Message {
    role: "bot" | "user";
    content: string;
}

export const AIAssistantWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: "bot", content: "안녕하세요, 대표님. AccountingFlow의 AI CFO 보좌관입니다. 실시간 장부 데이터와 100% 동기화된 전략적 자금 분석 서비스를 제공합니다. 궁금하신 경영 지표가 있으신가요?" }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { config, ledger, financials, companyKnowledge, selectedDate, refreshQuota } = useContext(AccountingContext)!;



    const clearHistory = () => {
        setMessages([
            { role: "bot", content: "안녕하세요, 대표님. AccountingFlow의 AI CFO 보좌관입니다. 실시간 장부 데이터와 100% 동기화된 전략적 자금 분석 서비스를 제공합니다. 궁금하신 경영 지표가 있으신가요?" }
        ]);
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const buildAIContext = () => {
        const ldr = ledger || [];
        const summary = summarizeLedger(ldr);
        const fin = financials || { totalAssets: 0, totalLiabilities: 0, netIncome: 0, revenue: 0, expenses: 0 };
        
        return `
[AI_CONTEXT]
Identity: AccountingFlow AI CFO Assistant
Goal: You are a professional CFO Assistant. Use "AccountingFlow" or "본 시스템" to refer to the system. NEVER use "AuditFlow".

Company Rules:
${companyKnowledge || "표준 회계 규정 준수"}

Financial Summary (Real-time Full Ledger):
- Total Revenue: ${(fin.revenue || 0).toLocaleString()} KRW
- Total Expense: ${(fin.expenses || 0).toLocaleString()} KRW
- Current Net Income: ${(fin.netIncome || 0).toLocaleString()} KRW
- Assets/Liabilities: ${(fin.totalAssets || 0).toLocaleString()} / ${(fin.totalLiabilities || 0).toLocaleString()}

Latest Ledger Insight (Recent 10 entries):
${summary.recent_activity}

[INSTRUCTION]
If the user asks about periodic performance, prioritize the 'Financial Summary' figures shown above. State that these figures are based on the entire simulation period.
`;
    };

    const handleSend = async (textOverride?: string) => {
        if (isTyping) return; // Loading Guard

        const text = textOverride || input;
        if (!text.trim()) return;

        setMessages(prev => [...prev, { role: "user", content: text }]);
        setInput("");
        setIsTyping(true);

        try {
            const aiContext = buildAIContext();
            const structuredPrompt = `${aiContext}\n\nUser Question: ${text}`;

            const response = await safeInvoke("ask_ai_assistant", {
                message: structuredPrompt,
                tenantId: config.tenantId,
                tier: config.tier || "Free"
            });


            if (!response || typeof response !== "string") {
                throw new Error("Invalid response from analysis engine.");
            }

            setMessages(prev => [...prev, { role: "bot", content: response }]);
            refreshQuota();
            setIsTyping(false);
        } catch (err: any) {
            console.error("AI Assistant Widget Error:", err);
            const errorMessage = err?.message || err || "분석 엔진 연결 중 오류가 발생했습니다.";
            setMessages(prev => [...prev, { role: "bot", content: `죄송합니다. 오류가 발생했습니다: ${errorMessage}` }]);
            setIsTyping(false);
        }
    };

    const suggestions = [
        "이번 달 예상 순이익은?",
        "접대비 한도 초과 위험이 있나요?",
        "런웨이(Runway)를 늘릴 방법은?",
        "매출 채권 회수 현황 요약해줘"
    ];

    return (
        <div className="fixed bottom-6 right-6 z-[9999] opacity-90 hover:opacity-100 transition-opacity duration-300">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ 
                            opacity: 1, 
                            scale: 1, 
                            y: 0,
                            width: isMaximized ? '80vw' : '400px',
                            height: isMaximized ? '80vh' : '600px',
                            right: isMaximized ? '10vw' : '0'
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="absolute bottom-20 bg-[#0F172A]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-4xl flex flex-col overflow-hidden ring-1 ring-white/5"
                    >
                        {/* Widget Header */}
                        <div className="p-6 bg-gradient-to-r from-indigo-600 to-blue-600 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <Sparkles size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-sm uppercase tracking-widest">AI CFO Assistant</h3>
                                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-tighter">Live Financial Sync Active</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={clearHistory} className="text-white/40 hover:text-rose-400 transition-colors title='Clear History'">
                                    <Trash2 size={16} />
                                </button>
                                <button onClick={() => setIsMaximized(!isMaximized)} className="text-white/40 hover:text-white transition-colors">
                                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Chat Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                                        msg.role === 'user' 
                                            ? 'bg-indigo-600 text-white ml-8 rounded-tr-none' 
                                            : 'bg-white/5 border border-white/10 text-slate-200 mr-8 rounded-tl-none'
                                    }`}>
                                        <ReactMarkdown 
                                            components={{
                                                p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                                strong: ({node, ...props}) => <span className="font-black text-indigo-400" {...props} />,
                                                ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
                                                li: ({node, ...props}) => <li className="mb-1" {...props} />,
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-2">
                                        <Loader2 size={14} className="text-indigo-400 animate-spin" />
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Analyzing Data...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Suggestions */}
                        <div className="px-6 py-2 flex gap-2 overflow-x-auto no-scrollbar">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(s)}
                                    className="whitespace-nowrap px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-slate-400 hover:bg-indigo-600/20 hover:text-indigo-400 transition-all"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-6 border-t border-white/5 space-y-4">
                            <div className="relative">
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="무엇이든 물어보세요..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim()}
                                    className={`absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                        input.trim() ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-600'
                                    }`}
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                            <div className="flex items-center justify-center gap-2 opacity-30">
                                <ShieldCheck size={10} className="text-slate-500" />
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Secure AI Banking Protocol Active</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all relative group ${
                    isOpen ? 'bg-slate-800 lg:rotate-90' : 'bg-gradient-to-br from-indigo-600 to-blue-600'
                }`}
            >
                <div className="absolute inset-0 rounded-full bg-white/20 animate-ping scale-150 opacity-0 group-hover:opacity-10" />
                {isOpen ? <X className="text-white" /> : <Bot className="text-white" size={28} />}
                
                {!isOpen && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-[#0B1221] animate-bounce" />
                )}
            </motion.button>
            <style dangerouslySetInnerHTML={{ __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
};
