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
        recent_activity: analyzeSet.slice(-15).map(e => `[${e.date}] ${e.description}: ${e.amount}`).join("\n")
    };
};

interface Message {
    role: "bot" | "user";
    content: string;
    type?: "standard" | "management" | "search";
}

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

    const [messages, setMessages] = useState<Message[]>([
        {
            role: "bot",
            content: "반갑습니다. AI 감사 분석관입니다. 대량의 데이터에서 리스크 패턴을 찾거나, 경영진 보고를 위한 핵심 요약이 필요하시면 언제든 말씀해 주세요."
        }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
    const [tempKnowledge, setTempKnowledge] = useState(context?.companyKnowledge || "");
    const [isTraining, setIsTraining] = useState(false);


    const clearHistory = () => {
        setMessages([
            {
                role: "bot",
                content: "반갑습니다. AI 감사 분석관입니다. 대량의 데이터에서 리스크 패턴을 찾거나, 경영진 보고를 위한 핵심 요약이 필요하시면 언제든 말씀해 주세요."
            }
        ]);
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const buildAIContext = () => {
        const ledger = context?.ledger || [];
        const summary = summarizeLedger(ledger);
        const financials = context?.financials || { totalAssets: 0, totalLiabilities: 0, netIncome: 0 };
        
        return `
[AI_CONTEXT]
Company Rules:
${context?.companyKnowledge || "N/A"}

Ledger Summary (${summary.transaction_count} transactions total):
${summary.transaction_count > MAX_LEDGER_ANALYSIS ? "*(Note: Analyzing latest " + MAX_LEDGER_ANALYSIS + " entries)*" : ""}
- Total Revenue (Analyzed): ${summary.total_revenue.toLocaleString()} KRW
- Total Expense (Analyzed): ${summary.total_expense.toLocaleString()} KRW
- Largest Expense: ${summary.largest_expense.description} (${summary.largest_expense.amount.toLocaleString()} KRW)

Financial Performance:
- Net Income: ${financials.netIncome?.toLocaleString()} KRW
- Assets/Liabilities: ${financials.totalAssets?.toLocaleString()} / ${financials.totalLiabilities?.toLocaleString()}

Recent Activity Highlight:
${summary.recent_activity}
`;
    };

    const handleSend = async (customText?: string) => {
        if (isTyping) return; // Loading Guard

        const text = customText || input;
        if (!text.trim()) return;

        const userMsg: Message = { role: "user", content: text };
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
            <div className="px-12 pt-12 pb-6 z-10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                        <Sparkles className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">AI Audit Assistant</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mt-1">Enterprise-Grade Forensic Engine</p>
                    </div>
                    <button 
                        onClick={clearHistory}
                        className="ml-auto p-3 bg-white/5 border border-white/10 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all group flex items-center gap-2"
                        title="Clear History"
                    >
                        <Trash2 size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block">Reset Session</span>
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                        <SuggestionChip key={i} label={s.label} icon={s.icon} onClick={handleSend} />
                    ))}
                    <button 
                        onClick={() => {
                            setTempKnowledge(context?.companyKnowledge || "");
                            setShowKnowledgeBase(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-full text-xs font-black text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:scale-95"
                    >
                        <BookOpen size={12} />
                        KNOWLEDGE BASE 설정
                    </button>
                </div>
            </div>

            {/* Chat Container */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-12 py-6 space-y-8 z-10 scroll-smooth custom-scrollbar"
            >
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                    >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${msg.role === "bot" ? "bg-slate-800 text-blue-400 border border-white/5" : "bg-blue-600 text-white shadow-blue-900/40"
                            }`}>
                            {msg.role === "bot" ? <Bot size={20} /> : <User size={20} />}
                        </div>

                        <div className={`max-w-[75%] group`}>
                            <div className={`px-6 py-4 rounded-[24px] shadow-sm border leading-relaxed ${msg.role === "bot"
                                ? "bg-white/5 border-white/10 text-slate-200"
                                : "bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-950/20"
                                }`}>
                                <div className="text-[14px] font-medium leading-relaxed">
                                    <ReactMarkdown
                                        components={{
                                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                            strong: ({node, ...props}) => <span className="font-black text-blue-400 bg-blue-400/5 px-1 rounded" {...props} />,
                                            ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                            <div className={`mt-2 flex items-center gap-2 px-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">
                                    {msg.role === "bot" ? "AI ANALYST • ACTIVE" : "AUDITOR • VERIFIED"}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex gap-4 animate-in fade-in duration-300">
                        <div className="w-10 h-10 rounded-2xl bg-slate-800 text-blue-400 border border-white/5 flex items-center justify-center flex-shrink-0">
                            <Bot size={20} className="animate-pulse" />
                        </div>
                        <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-[24px] flex items-center gap-3 shadow-sm">
                            <Loader2 size={16} className="text-blue-500 animate-spin" />
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] antialiased">
                                Synthesizing insights...
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Wrapper */}
            <div className="px-12 pb-10 pt-4 z-10 bg-gradient-to-t from-[#0B1221] via-[#0B1221] to-transparent">
                <div className="max-w-[1000px] mx-auto relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[32px] blur opacity-10 group-focus-within:opacity-20 transition-opacity"></div>
                    <div className="relative flex items-center bg-slate-900 border border-white/10 rounded-[28px] shadow-2xl overflow-hidden focus-within:border-blue-500/50 transition-all">
                        <div className="pl-6 text-slate-600">
                            <Wand2 size={24} />
                        </div>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="명령어를 입력하거나 궁금한 이상 데이터에 대해 질문하세요..."
                            className="flex-1 bg-transparent px-4 py-8 text-[15px] font-medium text-white outline-none placeholder:text-slate-600"
                        />
                        <div className="pr-4">
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim()}
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${input.trim()
                                    ? "bg-blue-600 text-white shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95"
                                    : "bg-slate-800 text-slate-600"
                                    }`}
                            >
                                <ArrowRight size={24} />
                            </button>
                        </div>
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
                Proprietary Forensic engine v4.1.0 • Knowledge Enhanced
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
