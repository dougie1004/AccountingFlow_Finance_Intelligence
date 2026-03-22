import { JournalEntry } from '../types';

export interface FinancialSignal {
    id: string;
    title: string;
    value: string;
    description: string;
    status: 'Stable' | 'Warning' | 'Critical';
    score: number; // 0 to 100
    trend: 'Up' | 'Down' | 'Stable';
    changeText?: string; // e.g. "+15% vs last month"
}

export interface SignalReport {
    signals: FinancialSignal[];
    priorityOrder: string[];
}

export interface PeriodSummary {
    totalIn: number;
    totalOut: number;
    revenue: number;
    expense: number;
    entryCount: number;
    sampleEntries: JournalEntry[];
    marginRate?: number; // Gross Margin Rate (0~1)
}

export class SignalEngine {
    constructor(private ledger: JournalEntry[], private cash: number) { }

    // [Stage 1.7] 기간 분리 로직 (현재/이전)
    // monthsAgo: 0 = 이번 달, 1 = 지난달
    private getLedgerByPeriod(monthsAgo: number): JournalEntry[] {
        const now = new Date();
        // 실제 운영시는 현재 날짜 기준이지만, 데모 데이터가 과거인 경우가 많으므로 
        // 장부의 마지막 데이터 날짜를 기준으로 '이번 달'을 판별하는 것이 더 안정적임.
        let baseDate = now;
        if (this.ledger.length > 0) {
            const sorted = [...this.ledger].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            baseDate = new Date(sorted[0].date);
        }

        const targetYear = baseDate.getFullYear();
        const targetMonth = baseDate.getMonth() - monthsAgo;

        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 1);

        return this.ledger.filter(e => {
            const d = new Date(e.date);
            return d >= startDate && d < endDate && e.status === 'Approved';
        });
    }

    // 1. Runway Calculation (Cash + Short-term Obligations)
    // Rule: (Cash - (Payables + Accruals)) / Monthly Burn
    private calculateRunway(entries: JournalEntry[]): number {
        const PAYABLE_ACCOUNTS = ['acc_251', 'acc_253', 'acc_255']; 
        
        const expenses = entries.filter(e => e.type === 'Expense' || e.type === 'Payroll');
        const monthlyBurn = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        
        if (monthlyBurn === 0) return 99;

        // ✅ Corrected: Subtract short-term obligations from cash
        const obligations = entries
            .filter(e => e.debitAccountId && PAYABLE_ACCOUNTS.includes(e.debitAccountId))
            .reduce((s, e) => s + (e.amount || 0), 0);

        return Math.max(0, (this.cash - obligations) / monthlyBurn);
    }

    // New: Obligation schedule as requested
    public getObligationSchedule(entries: JournalEntry[]) {
        const PAYABLE_ACCOUNTS = ['acc_251', 'acc_253', 'acc_255'];
        return entries
            .filter(e => e.debitAccountId && PAYABLE_ACCOUNTS.includes(e.debitAccountId))
            .map(e => ({
                amount: e.amount,
                dueMonth: e.date.substring(0, 7) // Simple month extraction
            }));
    }

    // [Main Engine] Simplified Report
    generateReport(): SignalReport {
        const currentLedger = this.getLedgerByPeriod(0);
        const prevLedger = this.getLedgerByPeriod(1);

        const curRunway = this.calculateRunway(currentLedger);
        const preRunway = this.calculateRunway(prevLedger);

        const signals: FinancialSignal[] = [
            {
                id: 'RUNWAY',
                title: '현금 런웨이',
                value: `${curRunway === 99 ? '∞' : curRunway.toFixed(1) + '개월'}`,
                description: curRunway < 3 ? '자금 고갈 리스크가 매우 높습니다.' : '운영 자금이 여유로운 상태입니다.',
                status: curRunway < 3 ? 'Critical' : (curRunway < 6 ? 'Warning' : 'Stable'),
                score: (curRunway < 3 ? 100 : (curRunway < 6 ? 60 : 0)),
                trend: curRunway > preRunway ? 'Up' : (curRunway < preRunway ? 'Down' : 'Stable'),
            }
        ];
        return { signals, priorityOrder: ['RUNWAY'] };
    }

    // Restore minimal margin calculation for summary
    private calculateMargin(entries: JournalEntry[]): number {
        const revenue = entries.filter(e => e.type === 'Revenue').reduce((s, e) => s + e.amount, 0);
        const cogs = entries.filter(e =>
            e.type === 'Expense' &&
            (e.debitAccount.includes('원가') || e.debitAccount.includes('상품'))
        ).reduce((s, e) => s + e.amount, 0);
        if (revenue === 0) return 0;
        return (revenue - cogs) / revenue;
    }

    getPeriodSummary(dateQuery: string): PeriodSummary {
        const targetEntries = this.ledger.filter(e => e.date.startsWith(dateQuery) && e.status === 'Approved');
        const isCash = (n: string) => n.toLowerCase().includes('예금') || n.toLowerCase().includes('현금');

        const totalIn = targetEntries.filter(e => isCash(e.debitAccount)).reduce((s, e) => s + (e.amount + (e.vat || 0)), 0);
        const totalOut = targetEntries.filter(e => isCash(e.creditAccount)).reduce((s, e) => s + (e.amount + (e.vat || 0)), 0);
        const revenue = targetEntries.filter(e => e.type === 'Revenue').reduce((s, e) => s + e.amount, 0);
        const expense = targetEntries.filter(e => e.type === 'Expense' || e.type === 'Payroll').reduce((s, e) => s + e.amount, 0);
        const curMargin = this.calculateMargin(targetEntries);

        return {
            totalIn, totalOut, revenue, expense,
            entryCount: targetEntries.length,
            sampleEntries: targetEntries.slice(0, 10),
            marginRate: curMargin
        };
    }
}
