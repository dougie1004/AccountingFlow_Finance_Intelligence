import { unrollJournalToLedger } from './src/core/engine/journalEngine';
import { calculateTrialBalance } from './src/core/engine/trialBalanceEngine';
import { calculateFinancialsFromTB } from './src/core/reporting/incomeStatement';
import { JournalEntry } from './src/types';

const testData: JournalEntry[] = [
    {
        id: 'INIT-2026-5',
        date: '2026-05-02',
        description: '[CAPITAL] 사업 개시 초기 자본금 납입',
        vendor: '대표자/창업팀',
        debitAccount: '보통예금',
        debitAccountId: 'acc_103',
        creditAccount: '자본금',
        creditAccountId: 'acc_301',
        amount: 40000000,
        vat: 0,
        type: 'Equity',
        status: 'Approved'
    },
    {
        id: 'GRANT-2026',
        date: '2026-05-20',
        description: '[GRANT] 정부지원금 바우처 할당 (4,000만원 한도)',
        vendor: '창업진흥원',
        debitAccount: '현금',
        debitAccountId: 'acc_101',
        creditAccount: '정부보조금수익',
        creditAccountId: 'acc_403',
        amount: 40000000,
        vat: 0,
        type: 'Revenue',
        status: 'Approved'
    },
    {
        id: 'ASSET-GRANT-2026',
        date: '2026-05-25',
        description: '[ASSET] 서버급 워크스테이션 도입 (지원금 집행)',
        vendor: '델 테크놀로지스',
        debitAccount: '비품',
        debitAccountId: 'acc_212',
        creditAccount: '현금',
        creditAccountId: 'acc_101',
        amount: 12000000,
        vat: 1200000,
        type: 'Asset',
        status: 'Approved'
    },
    {
        id: 'VOUCHER-EXEC-MKT-2026-5',
        date: '2026-05-28',
        description: '[VOUCHER] 마케팅비 바우처 집행 (잔액: 2200만원)',
        vendor: '창업진흥원',
        debitAccount: '마케팅비',
        debitAccountId: 'acc_830',
        creditAccount: '정부보조금수익',
        creditAccountId: 'acc_403',
        amount: 6000000,
        vat: 0,
        type: 'Revenue',
        status: 'Approved'
    },
    {
        id: 'PAY-2026-5',
        date: '2026-05-28',
        description: '[PAY] 5월 정기 인건비 (인상률 반영)',
        vendor: 'Staff',
        debitAccount: '급여',
        debitAccountId: 'acc_801',
        creditAccount: '보통예금',
        creditAccountId: 'acc_103',
        amount: 15000000,
        vat: 0,
        type: 'Payroll',
        status: 'Approved'
    },
    {
        id: 'RENT-2026-5',
        date: '2026-05-28',
        description: '[RENT] 5월 전용 공간 임차료',
        vendor: 'Bldg',
        debitAccount: '임차료',
        debitAccountId: 'acc_819',
        creditAccount: '보통예금',
        creditAccountId: 'acc_103',
        amount: 4500000,
        vat: 450000,
        type: 'Expense',
        status: 'Approved'
    }
];

const runTest = () => {
    console.log("TEST START");
    const ledgerLines = unrollJournalToLedger(testData);
    console.log("UNROLL DONE, LINES:", ledgerLines.length);
    
    const tb = calculateTrialBalance(ledgerLines, '2026-05-01', '2026-05-31');
    const tbLines = Object.values(tb);
    
    console.log("TB CALC DONE");

    console.log("\n[TRIAL BALANCE]");
    tbLines.forEach(item => {
        if (item.closingDebit > 0 || item.closingCredit > 0) {
            console.log(`${item.meta.name}: Dr ${item.closingDebit} / Cr ${item.closingCredit}`);
        }
    });

    const fins = calculateFinancialsFromTB(tb);
    console.log("\n[FINANCIAL SUMMARY]");
    console.log(`Revenue: ${fins.revenue}`);
    console.log(`Expense: ${fins.expenses}`);
    console.log(`Net Income: ${fins.netIncome}`);
    console.log(`Cash: ${fins.cash}`);
    console.log(`Assets: ${fins.totalAssets}`);
    console.log(`Liabilities: ${fins.totalLiabilities}`);
    console.log(`Equity: ${fins.totalEquity}`);
    console.log("TEST END");
};

runTest();
