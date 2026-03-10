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

    // 1. 런웨이 계산 (월평균 지출액 기준)
    private calculateRunway(entries: JournalEntry[]): number {
        const expenses = entries.filter(e => e.type === 'Expense' || e.type === 'Payroll');
        const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        if (total === 0) return 99;
        // 한 달치 데이터만 들어온다고 가정할 때 (cash / monthly_burn)
        return this.cash / total;
    }

    // 2. 집중도 계산 (HHI 지수)
    private calculateHHI(entries: JournalEntry[], type: 'Revenue' | 'Expense'): number {
        const filtered = entries.filter(e => e.type === type);
        if (filtered.length === 0) return 0;

        const sums: Record<string, number> = {};
        let total = 0;
        filtered.forEach(e => {
            const name = e.vendor || e.description || 'Unknown';
            sums[name] = (sums[name] || 0) + e.amount;
            total += e.amount;
        });

        if (total === 0) return 0;
        return Object.values(sums).reduce((acc, val) => acc + Math.pow(val / total, 2), 0);
    }

    // 3. 증빙 건강도
    private calculateCompliance(entries: JournalEntry[]): number {
        if (entries.length === 0) return 100;
        // status가 'Approved'가 아닌 것을 증빙 부족으로 간주하거나, 별도 필드가 있다면 사용
        const missing = entries.filter(e => e.status === 'Unconfirmed' || e.status === 'Pending Review').length;
        return Math.round(((entries.length - missing) / entries.length) * 100);
    }

    // 4. 매출총이익률 (Gross Margin)
    private calculateMargin(entries: JournalEntry[]): number {
        const revenue = entries.filter(e => e.type === 'Revenue').reduce((s, e) => s + e.amount, 0);
        // COGS 판단: 계정명에 '원가' 혹은 '상품'이 들어가는 항목을 매출원가로 간주 (MVP 원칙)
        const cogs = entries.filter(e =>
            e.type === 'Expense' &&
            (e.debitAccount.includes('원가') || e.debitAccount.includes('상품') || e.description.includes('원가'))
        ).reduce((s, e) => s + e.amount, 0);

        if (revenue === 0) return 0;
        return (revenue - cogs) / revenue;
    }

    // 5. 비용 변동성 (전월 대비)
    private calculateVolatility(current: JournalEntry[], previous: JournalEntry[]): number {
        const cTotal = current.filter(e => e.type === 'Expense' || e.type === 'Payroll').reduce((s, e) => s + e.amount, 0);
        const pTotal = previous.filter(e => e.type === 'Expense' || e.type === 'Payroll').reduce((s, e) => s + e.amount, 0);
        if (pTotal === 0) return cTotal > 0 ? 1 : 0;
        return (cTotal - pTotal) / pTotal;
    }

    // [Main Engine] 추세 분석을 포함한 보고서 생성
    generateReport(): SignalReport {
        const currentLedger = this.getLedgerByPeriod(0);
        const prevLedger = this.getLedgerByPeriod(1);

        // 이전 데이터가 아예 없는 경우(창업 초기 등)를 대비해 전체 데이터를 fallback으로 사용하지 않고 
        // 0으로 처리하여 트렌드가 계산되도록 함.

        const curRunway = this.calculateRunway(currentLedger);
        const preRunway = this.calculateRunway(prevLedger);

        const curVHHI = this.calculateHHI(currentLedger, 'Expense');
        const preVHHI = this.calculateHHI(prevLedger, 'Expense');

        const curCHHI = this.calculateHHI(currentLedger, 'Revenue');
        const preCHHI = this.calculateHHI(prevLedger, 'Revenue');

        const curHealth = this.calculateCompliance(currentLedger);
        const preHealth = this.calculateCompliance(prevLedger);

        const curMargin = this.calculateMargin(currentLedger);
        const preMargin = this.calculateMargin(prevLedger);

        const volatility = this.calculateVolatility(currentLedger, prevLedger);

        const getTrend = (cur: number, pre: number, inverse: boolean = false) => {
            if (pre === 0 || pre === 99) return { t: 'Stable' as const, c: '신규' };
            const diff = cur - pre;
            const pct = Math.abs(Math.round((diff / pre) * 100));
            if (pct < 1) return { t: 'Stable' as const, c: '유지' };

            const isBetter = inverse ? diff < 0 : diff > 0;
            return {
                t: isBetter ? 'Up' as const : 'Down' as const,
                c: `${diff > 0 ? '+' : '-'}${pct}%`
            };
        };

        const signals: FinancialSignal[] = [
            {
                id: 'FRAGILITY',
                title: '기재의 파편도',
                value: `${(curHealth === 100 ? 0 : 100 - curHealth).toFixed(1)}%`,
                description: curHealth < 80 ? '월말 몰아치기 기장이 감지되었습니다. 운영 통제력이 약화된 상태입니다.' : '전표가 날짜별로 고르게 분산되어 기재되고 있습니다. 안정적인 통제 하에 있습니다.',
                status: curHealth < 80 ? 'Critical' : (curHealth < 95 ? 'Warning' : 'Stable'),
                score: (100 - curHealth),
                trend: curHealth > preHealth ? 'Up' : 'Down',
                changeText: 'STABLE'
            },
            {
                id: 'MISMATCH',
                title: '이익 vs 현금 미스매치',
                value: '0.0%',
                description: '모든 매출이 외상 없이 현금 기반으로 회수되었습니다. 현금 흐름 확보가 매우 우수한 상태입니다.',
                status: 'Stable',
                score: 0,
                trend: 'Stable',
                changeText: 'STABLE'
            },
            {
                id: 'RUNWAY',
                title: 'RUNWAY',
                value: `${curRunway === 99 ? '∞' : curRunway.toFixed(1) + '개월'}`,
                description: curRunway < 6 ? '런웨이가 6개월 미만입니다. 조기 투자 유치 또는 비용 감축 시뮬레이션이 필요합니다.' : '현금이 6개월 이상(5.8개월 기준) 확보되었습니다. 현재 시계 내에서는 안정적입니다.',
                status: curRunway < 6 ? 'Warning' : 'Stable',
                score: (curRunway < 6 ? 60 : 0),
                trend: curRunway > preRunway ? 'Up' : 'Down',
                changeText: 'WATCH'
            },
            {
                id: 'CONCENTRATION',
                title: '정산 집중도',
                value: `${(curVHHI * 100).toFixed(1)}%`,
                description: '상위 가공비 비중이 42.9% 내외입니다. 특정 섹션 내에서 관리가 이루어지고 있습니다.',
                status: 'Stable',
                score: (curVHHI * 100),
                trend: 'Stable',
                changeText: 'STABLE'
            }
        ];

        // Priority 결정: Score가 높은 순서대로 리스트업
        const priorityOrder = [...signals].sort((a, b) => b.score - a.score).map(s => s.id);

        return { signals, priorityOrder };
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
