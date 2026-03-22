import { generateMultiYearSimulation } from './src/core/simulation/journalGenerator';
import { unrollJournalToLedger, calculateTrialBalance } from './src/core/engine';
import { calculateFinancialsFromTB } from './src/core/reporting/incomeStatement';
import { CHART_OF_ACCOUNTS } from './src/core/coa';

async function run() {
    const simulation = generateMultiYearSimulation([2026, 2027, 2028], 'STANDARD');
    const ledger = simulation.ledger;
    const ledgerLines = unrollJournalToLedger(ledger);
    
    const tb = calculateTrialBalance(ledgerLines, '2026-01-01', '2028-12-31', 'actual', CHART_OF_ACCOUNTS);
    const fs = calculateFinancialsFromTB(tb);

    let tbDr = 0;
    let tbCr = 0;
    Object.values(tb).forEach(item => {
        tbDr += item.movementDebit;
        tbCr += item.movementCredit;
    });

    let manualCash = 0;
    ledgerLines.forEach(l => {
        if (l.accountId === 'acc_101' || l.accountId === 'acc_103') {
            manualCash += (l.debit - l.credit);
        }
    });

    console.log('---START_DATA---');
    console.log(`TB_DR:${tbDr}`);
    console.log(`TB_CR:${tbCr}`);
    console.log(`ASSETS:${fs.totalAssets}`);
    console.log(`LIABS:${fs.totalLiabilities}`);
    console.log(`EQUITY:${fs.totalEquity}`);
    console.log(`CASH_SYS:${fs.cash}`);
    console.log(`CASH_CALC:${manualCash}`);
    console.log(`NI:${fs.netIncome}`);
    console.log('---END_DATA---');
}

run();
