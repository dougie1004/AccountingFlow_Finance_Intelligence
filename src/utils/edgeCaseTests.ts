import { JournalEntry, LedgerLine } from '../types';

/**
 * Antigravity Edge Case Test Runner
 * Checks the physical unrolling logic against specific criteria.
 */
export const performEdgeCaseTests = (
    unrollFn: (ledger: JournalEntry[], selectedDate: string) => LedgerLine[]
) => {
    const results: any = {};

    // Case 1: Multi-line Journal (Dr 3, Cr 2)
    const complexEntry: JournalEntry = {
        id: 'CASE-1',
        date: '2026-12-31',
        description: 'Multi-line Test',
        debitAccount: '',
        creditAccount: '',
        amount: 1000,
        vat: 0,
        type: 'Expense',
        status: 'Approved',
        complexLines: [
            { account: '복리후생비', debit: 500, credit: 0 },
            { account: '소모품비', debit: 300, credit: 0 },
            { account: '여비교통비', debit: 200, credit: 0 },
            { account: '보통예금', debit: 0, credit: 600 },
            { account: '미지급금', debit: 0, credit: 400 }
        ]
    };
    const res1 = unrollFn([complexEntry], '2026-12-31');
    results.case1 = {
        passed: res1.length === 5 && 
                res1.filter(l => l.debit > 0).length === 3 &&
                res1.filter(l => l.credit > 0).length === 2,
        details: `Lines generated: ${res1.length}`
    };

    // Case 2: VAT Splitting (Revenue)
    const vatEntry: JournalEntry = {
        id: 'CASE-2',
        date: '2026-12-31',
        description: 'VAT Revenue Test',
        debitAccount: '외상매출금',
        creditAccount: '상품매출',
        amount: 1000,
        vat: 100,
        type: 'Revenue',
        status: 'Approved'
    };
    const res2 = unrollFn([vatEntry], '2026-12-31');
    results.case2 = {
        passed: res2.length === 3 &&
                res2.some(l => l.account === '부가가치세예수금' && l.credit === 100),
        details: `VAT split correctly into 3 lines.`
    };

    // Case 3: Period Cutoff (12/31 vs 01/01)
    const cutoffEntries: JournalEntry[] = [
        { id: 'C3-A', date: '2026-12-31', description: 'Old Year', debitAccount: 'A', creditAccount: 'B', amount: 100, vat: 0, type: 'Expense', status: 'Approved' },
        { id: 'C3-B', date: '2027-01-01', description: 'New Year', debitAccount: 'A', creditAccount: 'B', amount: 100, vat: 0, type: 'Expense', status: 'Approved' }
    ];
    const res3 = unrollFn(cutoffEntries, '2026-12-31');
    results.case3 = {
        passed: res3.length === 2 && res3.every(l => l.date === '2026-12-31'),
        details: `Only 2026 entries included at 2026-12-31 cutoff.`
    };

    // Case 4: Reversal Entry
    const reversalEntries: JournalEntry[] = [
        { id: 'C4-A', date: '2026-12-15', description: 'Original', debitAccount: '지급임차료', creditAccount: '보통예금', amount: 1000, vat: 0, type: 'Expense', status: 'Approved' },
        { id: 'C4-B', date: '2026-12-16', description: 'Reversal', debitAccount: '보통예금', creditAccount: '지급임차료', amount: 1000, vat: 0, type: 'Expense', status: 'Approved' }
    ];
    const res4 = unrollFn(reversalEntries, '2026-12-31');
    const netCash = res4.filter(l => l.account === '보통예금').reduce((sum, l) => sum + (l.debit - l.credit), 0);
    results.case4 = {
        passed: netCash === 0,
        details: `Net impact on Cash is 0 as expected.`
    };

    // Case 5: Large Volume (10,000)
    const largeLedger: JournalEntry[] = [];
    for (let i = 0; i < 10000; i++) {
        largeLedger.push({
            id: `VOL-${i}`,
            date: '2026-10-01',
            description: `Vol Test ${i}`,
            debitAccount: 'A',
            creditAccount: 'B',
            amount: 1,
            vat: 0,
            type: 'Expense',
            status: 'Approved'
        });
    }
    const start = performance.now();
    const res5 = unrollFn(largeLedger, '2026-12-31');
    const end = performance.now();
    results.case5 = {
        passed: res5.length === 20000 && (end - start) < 500, // Should process in < 500ms
        details: `Processed 10k journals into 20k lines in ${(end - start).toFixed(2)}ms`
    };

    return results;
};
