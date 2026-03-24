import { describe, it, expect } from 'vitest';
import { calculateTrialBalance } from '../core/engine';
import { CHART_OF_ACCOUNTS } from '../core/coa';
import { unrollJournalToLedger } from '../core/ledger';
import { JournalEntry } from '../types';

describe('Accounting Engine Stabilization Tests', () => {
    
    // Helper to unroll ledger (simulating the logic in AccountingContext)
    // Use the immutable core unroll logic
    const unrollLedger = unrollJournalToLedger;

    const mockEntries: JournalEntry[] = [
        { id: 'S1', date: '2026-01-01', description: 'Capital', amount: 10000, vat: 0, type: 'Funding', status: 'Approved', debitAccount: '보통예금', debitAccountId: 'acc_103', creditAccount: '자본금', creditAccountId: 'acc_301' },
        { id: 'S2', date: '2026-01-02', description: 'Rent', amount: 2000, vat: 200, type: 'Expense', status: 'Approved', debitAccount: '임차료', debitAccountId: 'acc_819', creditAccount: '보통예금', creditAccountId: 'acc_103' },
    ];

    it('🧪 TEST 1: Ledger Rebuild Determinism', () => {
        const lines1 = unrollLedger(mockEntries);
        const lines2 = unrollLedger(mockEntries);
        expect(lines1).toEqual(lines2); // Must be exactly identical
    });

    it('🧪 TEST 2: Aggregation Accuracy (Expected vs Actual)', () => {
        const lines = unrollLedger(mockEntries);
        const tb = calculateTrialBalance(lines, '2026-01-01', '2026-01-31', 'actual', CHART_OF_ACCOUNTS);
        
        // After 10,000 in, 2,200 out -> 7,800
        expect(tb['acc_103']?.closingDebit).toBe(7800);
        expect(tb['acc_301']?.closingCredit).toBe(10000);
        expect(tb['acc_819']?.closingDebit).toBe(2000);
    });

    it('🧪 TEST 3: Ordering Independence', () => {
        const lines = unrollLedger(mockEntries);
        const reversedLines = [...lines].reverse();
        
        const tb1 = calculateTrialBalance(lines, '2026-01-01', '2026-01-31', 'actual', CHART_OF_ACCOUNTS);
        const tb2 = calculateTrialBalance(reversedLines, '2026-01-01', '2026-01-31', 'actual', CHART_OF_ACCOUNTS);
        
        expect(tb1['acc_103']?.closingDebit).toBe(tb2['acc_103']?.closingDebit);
    });

    it('🧪 TEST 4: Negative Scenario - Missing ID rejecting logic', () => {
        const badEntry: JournalEntry = {
            id: 'BAD1', date: '2026-01-01', description: 'Ghost', amount: 100, vat: 0, type: 'Expense', status: 'Approved',
            debitAccount: 'Ghost', debitAccountId: undefined, // Missing ID
            creditAccount: '보통예금', creditAccountId: 'acc_103'
        };
        const lines = unrollLedger([badEntry]);
        const hasMissingId = lines.some(l => !l.accountId);
        expect(hasMissingId).toBe(true);
    });
});
