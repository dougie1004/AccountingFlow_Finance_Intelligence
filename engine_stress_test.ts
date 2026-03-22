import { unrollJournalToLedger } from './src/core/engine/journalEngine';
import { calculateTrialBalance } from './src/core/engine/trialBalanceEngine';
import { calculateFinancialsFromTB } from './src/core/reporting/incomeStatement';
import { JournalEntry } from './src/types';
import * as fs from 'fs';

/**
 * [STRESS TEST] Production-Grade Accounting Scenarios
 */
const stressTestData: JournalEntry[] = [
    // 1. 적자 시나리오 (Revenue < Expense)
    {
        id: 'DEFICIT-REV',
        date: '2026-06-01',
        description: '소액 매출 발생',
        vendor: 'Customer',
        debitAccount: '보통예금',
        debitAccountId: 'acc_103',
        creditAccount: '상품매출',
        creditAccountId: 'acc_401',
        amount: 1000000,
        vat: 100000,
        type: 'Revenue',
        status: 'Approved'
    },
    {
        id: 'DEFICIT-EXP',
        date: '2026-06-05',
        description: '거대 광고비 집행 (적자 유발)',
        vendor: 'Meta',
        debitAccount: '마케팅비',
        debitAccountId: 'acc_830',
        creditAccount: '보통예금',
        creditAccountId: 'acc_103',
        amount: 5000000,
        vat: 500000,
        type: 'Expense',
        status: 'Approved'
    },
    // 2. 부채 발생 (Bank Loan)
    {
        id: 'LOAN-001',
        date: '2026-06-10',
        description: '은행 단기 차입금 실행',
        vendor: '신한은행',
        debitAccount: '보통예금',
        debitAccountId: 'acc_103',
        creditAccount: '미지급금', // 임시로 부채 계정 사용
        creditAccountId: 'acc_253',
        amount: 20000000,
        vat: 0,
        type: 'Asset', // 자산 증가 이벤트
        status: 'Approved'
    },
    // 3. 감가상각 (Depreciation) - Complex Line 사용
    {
        id: 'DEPR-2026-06',
        date: '2026-06-30',
        description: '6월분 비품 감가상각비 계상',
        vendor: 'Internal',
        debitAccount: '감가상각비',
        debitAccountId: 'acc_818',
        creditAccount: '비품', // 직접 상각법 (단순화)
        creditAccountId: 'acc_212',
        amount: 500000,
        vat: 0,
        type: 'Expense',
        status: 'Approved'
    },
    // 4. 선수수익 (Unearned Revenue / Liability)
    {
        id: 'UNEARNED-001',
        date: '2026-06-15',
        description: '1년치 선결제 구독료 수취 (부채로 인식)',
        vendor: 'VVIP Customer',
        debitAccount: '보통예금',
        debitAccountId: 'acc_103',
        creditAccount: '선수금',
        creditAccountId: 'acc_259',
        amount: 12000000,
        vat: 1200000,
        type: 'Asset', // 자산과 부채 동시 증가
        status: 'Approved'
    },
    // 5. 외상매출 (Accounts Receivable)
    {
        id: 'AR-001',
        date: '2026-06-20',
        description: '서비스 제공 완료 (대금은 내달 수취)',
        vendor: 'B2B Client',
        debitAccount: '외상매출금',
        debitAccountId: 'acc_108',
        creditAccount: '서비스매출',
        creditAccountId: 'acc_402',
        amount: 3000000,
        vat: 300000,
        type: 'Revenue',
        status: 'Approved'
    }
];

const runStressTest = () => {
    let output = "";
    const log = (msg: string) => {
        console.log(msg);
        output += msg + "\n";
    };

    log("=== [STRESS TEST START] ===");
    
    // 1. Unroll
    const lines = unrollJournalToLedger(stressTestData);
    log(`- Generated ${lines.length} Ledger Lines`);

    // 2. TB Calculation
    const tb = calculateTrialBalance(lines, '2026-06-01', '2026-06-30');
    const tbLines = Object.values(tb);

    // 3. Integrity Check (Sum logic)
    const totalDr = tbLines.reduce((s, i) => s + i.closingDebit, 0);
    const totalCr = tbLines.reduce((s, i) => s + i.closingCredit, 0);
    const diff = totalDr - totalCr;

    log(`- Integrity Check: Dr ${totalDr.toLocaleString()} / Cr ${totalCr.toLocaleString()} (Diff: ${diff})`);
    if (Math.abs(diff) < 0.01) log("  [PASS] Double-entry bookkeeping balance maintained.");
    else log("  [FAIL] Balance broken!");

    // 4. Case Specific Validations
    const fins = calculateFinancialsFromTB(tb);

    log(`\n- Case 1 (Deficit Check): Revenue ${fins.revenue.toLocaleString()} / Exp ${fins.expenses.toLocaleString()}`);
    log(`  Net Income: ${fins.netIncome.toLocaleString()} (${fins.netIncome < 0 ? 'LOSS DETECTED - OK' : 'ERROR'})`);

    log(`\n- Case 2 & 4 (Liabilities Check):`);
    log(`  Total Liabilities: ${fins.totalLiabilities.toLocaleString()} (Expected > 20M Loan + 12M Advance + VAT)`);

    log(`\n- Case 5 (Accounts Receivable Check):`);
    log(`  AR Balance: ${fins.ar.toLocaleString()} (Expected 3M + 300K VAT?)`);
    // Wait, AR normally includes VAT in Dr AR, Cr Revenue, Cr Output VAT. 
    // Let's see how our engine handled it.

    log(`\n- Final Accounting Equation (A = L + E):`);
    log(`  Assets(${fins.totalAssets.toLocaleString()}) = Liab(${fins.totalLiabilities.toLocaleString()}) + Equity(${fins.totalEquity.toLocaleString()})`);
    const equationDiff = fins.totalAssets - (fins.totalLiabilities + fins.totalEquity);
    log(`  Difference: ${equationDiff.toLocaleString()}`);
    
    if (Math.abs(equationDiff) < 1) log("  [PASS] Accounting Flow Constitution Maintained.");
    else log("  [FAIL] Engine Leaking!");

    log("\n=== [STRESS TEST END] ===");

    fs.writeFileSync('tmp/stress_report.txt', output, 'utf8');
};

runStressTest();
