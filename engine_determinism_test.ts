import { unrollJournalToLedger } from './src/core/engine/journalEngine';
import { calculateTrialBalance } from './src/core/engine/trialBalanceEngine';
import { calculateFinancialsFromTB } from './src/core/reporting/incomeStatement';
import { JournalEntry } from './src/types';

const E1: JournalEntry = {
    id: 'TX-001',
    date: '2026-06-01',
    description: 'Capital Injection',
    vendor: 'Founder',
    debitAccount: '보통예금',
    debitAccountId: 'acc_103',
    creditAccount: '자본금',
    creditAccountId: 'acc_301',
    amount: 1000,
    vat: 0,
    type: 'Equity',
    status: 'Approved'
};

const E2: JournalEntry = {
    id: 'TX-002',
    date: '2026-06-02',
    description: 'Office Rent',
    vendor: 'Landlord',
    debitAccount: '임차료',
    debitAccountId: 'acc_819',
    creditAccount: '보통예금',
    creditAccountId: 'acc_103',
    amount: 500,
    vat: 50,
    type: 'Expense',
    status: 'Approved'
};

const runDeterminismTest = () => {
    console.log("=== DETERMINISM TEST (Posting Order) ===");
    
    // Order 1: E1 then E2
    const lines1 = unrollJournalToLedger([E1, E2]);
    const tb1 = calculateTrialBalance(lines1, '2026-06-01', '2026-06-30');
    const fins1 = calculateFinancialsFromTB(tb1);

    // Order 2: E2 then E1
    const lines2 = unrollJournalToLedger([E2, E1]);
    const tb2 = calculateTrialBalance(lines2, '2026-06-01', '2026-06-30');
    const fins2 = calculateFinancialsFromTB(tb2);

    console.log(`Order 1 Net Income: ${fins1.netIncome}`);
    console.log(`Order 2 Net Income: ${fins2.netIncome}`);
    console.log(`Order 1 Assets: ${fins1.totalAssets}`);
    console.log(`Order 2 Assets: ${fins2.totalAssets}`);
    
    const isDeterministic = fins1.netIncome === fins2.netIncome && fins1.totalAssets === fins2.totalAssets;
    console.log(`Result: ${isDeterministic ? 'PASSED (Deterministic)' : 'FAILED'}`);
};

const runIdempotencyTest = () => {
    console.log("\n=== IDEMPOTENCY TEST (Duplicate IDs) ===");
    
    // Single Processing
    const linesSingle = unrollJournalToLedger([E1]);
    const tbSingle = calculateTrialBalance(linesSingle, '2026-06-01', '2026-06-30');
    const finsSingle = calculateFinancialsFromTB(tbSingle);

    // Duplicate Processing (Sending E1 twice)
    // Note: unrollJournalToLedger currently doesn't deduplicate INSIDE the function.
    // We want to see if the engine as a whole handles it or if we need to add a guard.
    const linesDouble = unrollJournalToLedger([E1, E1]);
    const tbDouble = calculateTrialBalance(linesDouble, '2026-06-01', '2026-06-30');
    const finsDouble = calculateFinancialsFromTB(tbDouble);

    console.log(`Single E1 Assets: ${finsSingle.totalAssets}`);
    console.log(`Double E1 Assets: ${finsDouble.totalAssets}`);

    if (finsSingle.totalAssets === finsDouble.totalAssets) {
        console.log("Result: PASSED (Idempotent)");
    } else {
        console.log("Result: FAILED (Double counting detected - GUARD NEEDED)");
    }
};

runDeterminismTest();
runIdempotencyTest();
