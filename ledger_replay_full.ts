import { generateMultiYearSimulation } from './src/core/simulation/journalGenerator';
import { unrollJournalToLedger } from './src/core/engine/journalEngine';
import { calculateTrialBalance } from './src/core/engine/trialBalanceEngine';
import { calculateFinancialsFromTB } from './src/core/reporting/incomeStatement';
import * as fs from 'fs';

const runFullReplay = () => {
    let output = "=== [FULL LEDGER REPLAY TEST] ===\n";
    const years = [2026, 2027, 2028];
    const scenarios = ['SURVIVAL', 'STANDARD', 'GROWTH'] as const;

    scenarios.forEach(scenario => {
        output += `\n>> SCENARIO: ${scenario}\n`;
        
        // 1. Generate Data
        const simResult = generateMultiYearSimulation(years, scenario);
        const journal = simResult.ledger;
        output += `- Generated Journal Entries: ${journal.length}\n`;

        // 2. Unroll to Ledger
        const ledgerLines = unrollJournalToLedger(journal);
        output += `- Unrolled Ledger Lines: ${ledgerLines.length}\n`;

        // 3. Final TB at 2028-12-31
        const tb = calculateTrialBalance(ledgerLines, '2026-01-01', '2028-12-31');
        const tbLines = Object.values(tb);

        // 4. Integrity Check
        const totalDr = tbLines.reduce((s, i) => s + i.closingDebit, 0);
        const totalCr = tbLines.reduce((s, i) => s + i.closingCredit, 0);
        const diff = totalDr - totalCr;
        output += `- Integrity Check (TB Balance): ${diff === 0 ? 'PASSED' : 'FAILED (Diff: ' + diff + ')'}\n`;

        // 5. Accounting Equation Check
        const fins = calculateFinancialsFromTB(tb);
        const equationDiff = fins.totalAssets - (fins.totalLiabilities + fins.totalEquity);
        output += `- Accounting Equation (A = L + E): ${Math.abs(equationDiff) < 1 ? 'PASSED' : 'FAILED (Diff: ' + equationDiff + ')'}\n`;
        
        output += `- Final Cash: ${fins.cash.toLocaleString()}\n`;
        output += `- Final Net Assets (Equity): ${fins.totalEquity.toLocaleString()}\n`;
    });

    output += "\n=== [TEST COMPLETE] ===\n";
    console.log(output);
    fs.writeFileSync('tmp/full_replay_report.txt', output, 'utf8');
};

runFullReplay();
