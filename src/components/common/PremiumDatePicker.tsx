import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const PremiumDatePicker: React.FC<{ value: string, onChange: (d: string) => void }> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'months' | 'days'>('months');
    const [viewMonth, setViewMonth] = useState(1);
    
    const parsedDate = useMemo(() => {
        const d = new Date(value);
        return isNaN(d.getTime()) ? new Date() : d;
    }, [value]);

    const selectedYear = parsedDate.getFullYear();
    const selectedMonth = parsedDate.getMonth() + 1;
    const selectedDay = parsedDate.getDate();

    useEffect(() => {
        if (isOpen) {
            setView('months');
            setViewMonth(selectedMonth);
        }
    }, [isOpen, selectedMonth]);

    const years = [2026, 2027, 2028, 2029, 2030];

    const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m - 1, 1).getDay();

    return (
        <div className="relative">
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="text-[11px] font-bold text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-all shadow-lg min-w-[140px] justify-between group"
            >
                <span className="group-hover:text-indigo-400 transition-colors">{value}</span>
                <Calendar size={12} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-3 w-72 bg-[#1C2333] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[70] overflow-hidden backdrop-blur-xl"
                        >
                            <div className="p-4 bg-[#252D3F] border-b border-white/5 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <h4 className="text-[13px] font-black text-white flex items-center gap-2">
                                        {view === 'months' ? `${selectedYear}년` : `${selectedYear}년 ${viewMonth}월`}
                                    </h4>
                                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest italic">
                                        {view === 'months' ? 'Select Month' : 'Select Day'}
                                    </span>
                                </div>
                                {view === 'days' && (
                                    <button 
                                        onClick={() => setView('months')}
                                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all text-[10px] font-bold flex items-center gap-1"
                                    >
                                        <ChevronRight size={12} className="rotate-180" /> Back
                                    </button>
                                )}
                            </div>

                            <div className="p-4">
                                {view === 'months' ? (
                                    <div className="space-y-4">
                                        {years.map(year => (
                                            <div key={year} className="space-y-2">
                                                <div className="flex items-center gap-2 px-1">
                                                    <span className={`text-[11px] font-black ${year === selectedYear ? 'text-indigo-400' : 'text-slate-500'}`}>{year}</span>
                                                    <div className="h-[1px] flex-1 bg-white/5" />
                                                </div>
                                                
                                                {year === selectedYear ? (
                                                    <div className="grid grid-cols-4 gap-1.5">
                                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                                                            const isSelected = selectedYear === year && selectedMonth === month;
                                                            return (
                                                                <button
                                                                    key={month}
                                                                    onClick={() => {
                                                                        setViewMonth(month);
                                                                        setView('days');
                                                                    }}
                                                                    className={`py-2 text-[10px] font-black rounded-xl transition-all ${
                                                                        isSelected 
                                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                                    }`}
                                                                >
                                                                    {month}월
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => {
                                                            onChange(`${year}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:text-slate-400 transition-colors"
                                                    >
                                                        Switch to {year}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                        <div className="grid grid-cols-7 mb-2">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                                <span key={i} className="text-[9px] font-black text-slate-500 text-center">{day}</span>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {Array.from({ length: getFirstDayOfMonth(selectedYear, viewMonth) }).map((_, i) => (
                                                <div key={`empty-${i}`} />
                                            ))}
                                            {Array.from({ length: getDaysInMonth(selectedYear, viewMonth) }).map((_, i) => {
                                                const day = i + 1;
                                                const isSelected = selectedYear === selectedYear && selectedMonth === viewMonth && selectedDay === day;
                                                return (
                                                    <button
                                                        key={day}
                                                        onClick={() => {
                                                            const dateStr = `${selectedYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                            onChange(dateStr);
                                                            setIsOpen(false);
                                                        }}
                                                        className={`h-8 w-full flex items-center justify-center text-[10px] font-bold rounded-lg transition-all ${
                                                            isSelected
                                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                                        }`}
                                                    >
                                                        {day}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
