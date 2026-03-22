import { generateMultiYearSimulation } from '../src/core/simulation/journalGenerator';
import { unrollJournalToLedger, calculateTrialBalance } from '../src/core/engine';
import { calculateFinancialsFromTB } from '../src/core/reporting/incomeStatement';
import { CHART_OF_ACCOUNTS } from '../src/core/coa';
import { ALL_ACCOUNTS, MASTER_ACCOUNTS } from '../src/constants/accounts';

const ACCOUNTS = { ...CHART_OF_ACCOUNTS };
ALL_ACCOUNTS.forEach(acc => {
    if (!ACCOUNTS[acc.name]) {
        const nature = (Object.keys(MASTER_ACCOUNTS).find(k => (MASTER_ACCOUNTS as any)[k].some((a: any) => a.code === acc.code)) || 'EXPENSE') as any;
        ACCOUNTS[acc.name] = {
            id: `acc_${acc.code}`,
            code: acc.code,
            name: acc.name,
            nature,
            statement: ['ASSET', 'LIABILITY', 'EQUITY'].includes(nature) ? 'BS' : 'PL',
            section: '기본 계정',
            group: '표준 계정과목'
        };
    }
});

const simulation = generateMultiYearSimulation([2026, 2027, 2028], 'STANDARD');
const ledgerLines = unrollJournalToLedger(simulation.ledger);
const tb = calculateTrialBalance(ledgerLines, '2026-01-01', '2028-12-31', 'actual', ACCOUNTS);
const fs = calculateFinancialsFromTB(tb);

let manualCashSum = 0;
ledgerLines.forEach(line => {
    if (line.accountId === 'acc_101' || line.accountId === 'acc_103') {
        manualCashSum += (line.debit - line.credit);
    }
});

console.log('--- REPORT DATA ---');
console.log(`TB_DEBIT: ${Object.values(tb).reduce((sum, item) => sum + item.movementDebit, 0)}`);
console.log(`TB_CREDIT: ${Object.values(tb).reduce((sum, item) => sum + item.movementCredit, 0)}`);
console.log(`BS_ASSETS: ${fs.totalAssets}`);
console.log(`BS_L_PLUS_E: ${fs.totalLiabilities + fs.totalEquity}`);
console.log(`NI: ${fs.netIncome}`);
console.log(`SYSTEM_CASH: ${fs.cash}`);
console.log(`CALC_CASH: ${manualCashSum}`);
