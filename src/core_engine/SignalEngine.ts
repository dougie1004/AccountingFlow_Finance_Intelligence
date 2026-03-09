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
        const missing = entries.filter(e => !e.evidenceType || e.evidenceType === 'None').length;
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
                id: 'RUNWAY',
                title: '현금 런웨이',
                value: `${curRunway === 99 ? '∞' : curRunway.toFixed(1) + '개월'}`,
                description: curRunway < 3 ? '자금 고갈 리스크가 매우 높습니다.' : '운영 자금이 여유로운 상태입니다.',
                status: curRunway < 3 ? 'Critical' : (curRunway < 6 ? 'Warning' : 'Stable'),
                score: (curRunway < 3 ? 100 : (curRunway < 6 ? 60 : 0)) + (curRunway < preRunway && curRunway < 6 ? 20 : 0),
                trend: curRunway > preRunway ? 'Up' : (curRunway < preRunway ? 'Down' : 'Stable'),
                changeText: getTrend(curRunway, preRunway).c
            },
            {
                id: 'MARGIN',
                title: '매출총이익률',
                value: `${(curMargin * 100).toFixed(1)}%`,
                description: curMargin < 0.2 ? '수익성 개선이 시급한 구조입니다.' : '건강한 마진율을 유지하고 있습니다.',
                status: curMargin < 0.1 ? 'Critical' : (curMargin < 0.25 ? 'Warning' : 'Stable'),
                score: (curMargin < 0.1 ? 95 : (curMargin < 0.2 ? 55 : 0)) + (curMargin < preMargin ? 25 : 0),
                trend: curMargin > preMargin ? 'Up' : (curMargin < preMargin ? 'Down' : 'Stable'),
                changeText: getTrend(curMargin, preMargin).c
            },
            {
                id: 'VOLATILITY',
                title: '비용 변동성',
                value: `${(volatility * 100).toFixed(0)}%`,
                description: volatility > 0.4 ? '비용 지출이 급격히 증가했습니다.' : '안정적인 지출 패턴을 보입니다.',
                status: volatility > 0.5 ? 'Critical' : (volatility > 0.2 ? 'Warning' : 'Stable'),
                score: volatility > 0.5 ? 85 : (volatility > 0.2 ? 45 : 0),
                trend: volatility > 0 ? 'Down' : 'Up', // 비용 상승은 지표 하락으로 간주
                changeText: `${volatility > 0 ? '+' : ''}${(volatility * 100).toFixed(0)}%`
            },
            {
                id: 'VENDOR_HHI',
                title: '매입 집중도',
                value: `${(curVHHI * 100).toFixed(0)}%`,
                description: curVHHI > 0.7 ? '특정 공급처 의존이 리스크가 큽니다.' : '공급망이 잘 분산되어 있습니다.',
                status: curVHHI > 0.7 ? 'Critical' : (curVHHI > 0.4 ? 'Warning' : 'Stable'),
                score: (curVHHI > 0.7 ? 80 : (curVHHI > 0.4 ? 40 : 0)) + (curVHHI > preVHHI ? 10 : 0),
                trend: curVHHI > preVHHI ? 'Down' : (curVHHI < preVHHI ? 'Up' : 'Stable'),
                changeText: getTrend(curVHHI, preVHHI, true).c
            },
            {
                id: 'CUSTOMER_HHI',
                title: '매출 집중도',
                value: `${(curCHHI * 100).toFixed(0)}%`,
                description: curCHHI > 0.6 ? '소수 고객사 매출 의존도가 높습니다.' : '고객 포트폴리오가 안정적입니다.',
                status: curCHHI > 0.6 ? 'Critical' : (curCHHI > 0.3 ? 'Warning' : 'Stable'),
                score: (curCHHI > 0.6 ? 75 : (curCHHI > 0.3 ? 35 : 0)) + (curCHHI > preCHHI ? 10 : 0),
                trend: curCHHI > preCHHI ? 'Down' : (curCHHI < preCHHI ? 'Up' : 'Stable'),
                changeText: getTrend(curCHHI, preCHHI, true).c
            },
            {
                id: 'COMPLIANCE',
                title: '증빙 건강도',
                value: `${curHealth}%`,
                description: curHealth < 80 ? '증빙 누락으로 세무 리스크가 큽니다.' : '회계 투명성이 양호합니다.',
                status: curHealth < 80 ? 'Critical' : (curHealth < 90 ? 'Warning' : 'Stable'),
                score: (curHealth < 80 ? 70 : (curHealth < 90 ? 30 : 0)) + (curHealth < preHealth ? 15 : 0),
                trend: curHealth > preHealth ? 'Up' : (curHealth < preHealth ? 'Down' : 'Stable'),
                changeText: getTrend(curHealth, preHealth).c
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
