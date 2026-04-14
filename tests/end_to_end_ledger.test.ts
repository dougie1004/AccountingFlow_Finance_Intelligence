import { describe, it, expect } from 'vitest';
import { generateMultiYearSimulation } from '../src/core/simulation/journalGenerator';
import { SCENARIO_CONFIGS, ScenarioConfig } from '../src/core/simulation/scenarioConfigs';
import { unrollJournalToLedger } from '../src/core/engine/journalEngine';
import { calculateTrialBalance } from '../src/core/engine/trialBalanceEngine';

describe('REAL ENGINE: End-to-End Ledger 6-Month Test', () => {
    // 1. Simulate Company for 6 months
    // Use shallow copy for top level and modify what we need safely
    const baseCfg = SCENARIO_CONFIGS['STANDARD'];
    const cfg: ScenarioConfig = {
        ...baseCfg,
        userModel: {
            ...baseCfg.userModel,
            initialUsers: 100
        },
        revenuePolicy: {
            ...baseCfg.revenuePolicy,
            startDate: "2026-05-01"
        }
    };

    const simResult = generateMultiYearSimulation([2026], cfg);
    const ledgerLines = unrollJournalToLedger(simResult.ledger);

    it('Checkpoint 1: Assets = Liabilities + Equity (Balance Sheet Integrity)', () => {
        const tb = calculateTrialBalance(ledgerLines, '2026-01-01', '2026-10-31', 'all');
        const tbItems = Object.values(tb);

        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;
        let netIncome = 0;

        tbItems.forEach(item => {
            const nature = item.meta.nature;
            const bal = (item.closingDebit || 0) - (item.closingCredit || 0);

            if (nature === 'ASSET') totalAssets += bal;
            else if (nature === 'LIABILITY') totalLiabilities -= bal;
            else if (nature === 'EQUITY') totalEquity -= bal;
            else if (nature === 'REVENUE') netIncome -= bal;
            else if (nature === 'EXPENSE') netIncome -= bal;
        });

        const totalCredits = totalLiabilities + totalEquity + netIncome;
        
        console.log(`[BS_CHECK] Assets: ${totalAssets.toLocaleString()}, L+E+NI: ${totalCredits.toLocaleString()}`);
        expect(Math.abs(totalAssets - totalCredits)).toBeLessThan(10); 
    });

    it('Checkpoint 2: M+1 Settlement (Cash Flow Lag)', () => {
        const juneAR = simResult.ledger.find(e => e.date.startsWith('2026-06') && e.debitAccountId === 'acc_108');
        expect(juneAR).toBeDefined();

        const julyCollection = simResult.ledger.find(e => 
            e.date.startsWith('2026-07') && 
            e.debitAccountId === 'acc_103' && 
            e.creditAccountId === 'acc_108'
        );
        expect(julyCollection).toBeDefined();

        console.log(`[M+1_CHECK] June Rev Recognition: ${juneAR?.amount.toLocaleString()}, July Cash Collection: ${julyCollection?.amount.toLocaleString()}`);
        expect(julyCollection?.amount).toBeGreaterThan(0);
    });

    it('Checkpoint 3: Quarterly VAT Event (Tax Filing)', () => {
        const vatEvent = simResult.ledger.find(e => 
            e.date === '2026-07-25' && 
            e.description.includes('부가세 정산')
        );

        expect(vatEvent).toBeDefined();
        console.log(`[VAT_CHECK] July 25 VAT Payout: ${vatEvent?.amount.toLocaleString()}`);
        expect(vatEvent?.amount).toBeGreaterThan(0);
    });

    it('Checkpoint 4: Asset Depreciation (Non-cash Expense)', () => {
        const depEntries = simResult.ledger.filter(e => e.id.includes('DEP-') && e.date <= '2026-10-31');
        
        console.log(`[DEP_CHECK] Total Depreciation Entries (May-Oct): ${depEntries.length}`);
        expect(depEntries.length).toBeGreaterThanOrEqual(1);
    });
});
