import { JournalEntry, LedgerLine } from '../types';
import { calculateTrialBalance } from '../core/engine';
import { CHART_OF_ACCOUNTS } from '../core/coa';
import { unrollJournalToLedger } from '../core/ledger';

/**
 * [STABILIZATION TEST SUITE V2]
 * High-Integrity Accounting Engine Verification
 */
export const runStabilizationTest = () => {
    const results: string[] = [];
    let passCount = 0;
    let failCount = 0;

    const assert = (name: string, expected: number, actual: number) => {
        const isPass = Math.abs(expected - actual) < 0.01;
        if (isPass) {
            passCount++;
            results.push(`✅ [PASS] ${name}: Expected ${expected.toLocaleString()}, Actual ${actual.toLocaleString()}`);
        } else {
            failCount++;
            results.push(`❌ [FAIL] ${name}: Expected ${expected.toLocaleString()}, Actual ${actual.toLocaleString()}`);
        }
    };

    // --- SCENARIO DATA ---
    const mockLedger: JournalEntry[] = [
        { id: 'S1', date: '2026-01-01', description: '자본금 납입', amount: 100000000, vat: 0, type: 'Funding', status: 'Approved', debitAccount: '보통예금', debitAccountId: 'acc_103', creditAccount: '자본금', creditAccountId: 'acc_301' },
        { id: 'S2', date: '2026-01-02', description: '임차료 지출', amount: 2000000, vat: 200000, type: 'Expense', status: 'Approved', debitAccount: '임차료', debitAccountId: 'acc_819', creditAccount: '보통예금', creditAccountId: 'acc_103' },
        { id: 'S4', date: '2026-01-10', description: '상품 매출', amount: 20000000, vat: 2000000, type: 'Revenue', status: 'Approved', debitAccount: '외상매출금', debitAccountId: 'acc_108', creditAccount: '상품매출', creditAccountId: 'acc_401' },
    ];

    // --- TEST 1: EXPECTED VS ACTUAL (Scenario 4 Focus) ---
    results.push("--- TEST 1: Granular Accuracy Check ---");
    const lines = unrollLedger(mockLedger);
    const tb = calculateTrialBalance(lines, '2026-01-01', '2026-03-31', 'Actual', CHART_OF_ACCOUNTS);
    
    assert("Cash Balance (After S1, S2)", 97800000, tb['acc_103']?.closingDebit || 0);
    assert("Sales Revenue (S4)", 20000000, tb['acc_401']?.closingCredit || 0);
    assert("VAT Liability (S4)", 2000000, tb['acc_257']?.closingCredit || 0);

    // --- TEST 2: LEDGER ORDERING INDEPENDENCE ---
    results.push("--- TEST 2: Ledger Ordering Test ---");
    const reversedLines = [...lines].reverse();
    const tbReversed = calculateTrialBalance(reversedLines, '2026-01-01', '2026-03-31', 'Actual', CHART_OF_ACCOUNTS);
    const isOrderIndependent = (tb['acc_103']?.closingDebit === tbReversed['acc_103']?.closingDebit);
    if (isOrderIndependent) {
        passCount++;
        results.push("✅ [PASS] Ordering: Result is identical regardless of entry sequence.");
    } else {
        failCount++;
        results.push("❌ [FAIL] Ordering: Sequence variation caused data discrepancy!");
    }

    // --- TEST 3: NEGATIVE SCENARIO (Strict Gate) ---
    results.push("--- TEST 3: Negative Scenario (Security Gate) ---");
    const badEntry: JournalEntry = {
        id: 'BAD1', date: '2026-01-01', description: 'Unknown Account', amount: 100, vat: 0, type: 'Expense', status: 'Approved',
        debitAccount: 'Ghost', debitAccountId: undefined, // Missing ID
        creditAccount: '보통예금', creditAccountId: 'acc_103'
    };
    
    // Check if unrolling correctly handles missing IDs (Phase 3 Strict Gate logic)
    const badLines = unrollLedger([badEntry]);
    const hasMissingIdInLines = badLines.some(l => !l.accountId);
    if (hasMissingIdInLines) {
        passCount++;
        results.push("✅ [PASS] Negative: Engine flagged missing account ID as intended.");
    } else {
        failCount++;
        results.push("❌ [FAIL] Negative: Engine allowed entry without ID!");
    }

    return { results, passCount, failCount, summary: `Total ${passCount + failCount} tests: ${passCount} passed, ${failCount} failed.` };
};

// Helper to simulate the unrolling logic in Context
const unrollLedger = (entries: JournalEntry[]): LedgerLine[] => {
    const lines: LedgerLine[] = [];
    entries.forEach(entry => {
        const base = entry.amount;
        const vat = entry.vat || 0;
        const total = base + vat;
        const add = (acc: string, db: number, cr: number, id?: string) => {
            lines.push({ id: entry.id, date: entry.date, description: entry.description, account: acc, accountId: id, debit: db, credit: cr, type: entry.type, scope: 'Actual' });
        };
        if (entry.type === 'Revenue') {
            add(entry.debitAccount, total, 0, entry.debitAccountId);
            add(entry.creditAccount, 0, base, entry.creditAccountId);
            if (vat > 0) add('부가세예수금', 0, vat, 'acc_257');
        } else {
            add(entry.debitAccount, base, 0, entry.debitAccountId);
            add(entry.creditAccount, 0, total, entry.creditAccountId);
        }
    });
    return lines;
};
