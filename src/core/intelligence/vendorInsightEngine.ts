import { JournalEntry } from '../types';

export interface VendorInsight {
    vendor: string;
    type: 'SUBSCRIPTION' | 'SPENDING_SPIKE' | 'NEW_VENDOR';
    message: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * [V15] Vendor Insight Engine
 * Detects patterns and anomalies in vendor spending.
 */
export function generateVendorInsights(ledger: JournalEntry[], systemNow: Date): VendorInsight[] {
    const insights: VendorInsight[] = [];
    
    // 1. Group transactions by vendor
    const vendorMap: Record<string, JournalEntry[]> = {};
    ledger.forEach(e => {
        if (!e.vendor || e.scope === 'future') return;
        if (!vendorMap[e.vendor]) vendorMap[e.vendor] = [];
        vendorMap[e.vendor].push(e);
    });

    const currentMonth = systemNow.getMonth();
    const currentYear = systemNow.getFullYear();

    Object.entries(vendorMap).forEach(([vendor, entries]) => {
        // Sort entries by date
        const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // A. Subscription Detection
        const isSub = detectSubscription(sorted);
        if (isSub) {
            insights.push({
                vendor,
                type: 'SUBSCRIPTION',
                message: `${vendor} 거래처에서 정기 구독 패턴이 감지되었습니다.`,
                severity: 'INFO'
            });
        }

        // B. Spending Spike Detection
        const spike = detectSpendingSpike(sorted, currentMonth, currentYear);
        if (spike) {
            insights.push({
                vendor,
                type: 'SPENDING_SPIKE',
                message: `${vendor} 지출이 지난달 대비 ${spike.ratio}% 증가했습니다. (비용 구조 점검 필요)`,
                severity: spike.ratio > 100 ? 'CRITICAL' : 'WARNING'
            });
        }
    });

    return insights;
}

function detectSubscription(entries: JournalEntry[]): boolean {
    if (entries.length < 3) return false;

    // Check for same amount in consecutive months
    let matches = 0;
    for (let i = 0; i < entries.length - 1; i++) {
        const d1 = new Date(entries[i].date);
        const d2 = new Date(entries[i+1].date);
        
        const monthDiff = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        const amountDiff = Math.abs(entries[i].amount - entries[i+1].amount) / (entries[i].amount || 1);

        if (monthDiff === 1 && amountDiff < 0.05) {
            matches++;
        }
    }

    return matches >= 2;
}

function detectSpendingSpike(entries: JournalEntry[], currentMonth: number, currentYear: number) {
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentSpending = entries
        .filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, e) => sum + e.amount, 0);

    const prevSpending = entries
        .filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === lastMonth && d.getFullYear() === lastYear;
        })
        .reduce((sum, e) => sum + e.amount, 0);

    if (prevSpending > 100000 && currentSpending > prevSpending * 1.5) {
        return {
            ratio: Math.round((currentSpending / prevSpending - 1) * 100)
        };
    }

    return null;
}
