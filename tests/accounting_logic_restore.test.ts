import { describe, it, expect } from 'vitest';
import { generateMultiYearSimulation } from '../src/core/simulation/journalGenerator';
import { projectScenarioFrontend } from '../src/core/simulation/strategicSimulator';
import { SCENARIO_CONFIGS } from '../src/core/simulation/scenarioConfigs';
import { JournalEntry } from '../src/types';

describe('Accounting Logic Integrity Tests', () => {
    const cfg = SCENARIO_CONFIGS['STANDARD'];
    const years = [2026, 2027];
    const simResult = generateMultiYearSimulation(years, cfg);
    const ledger = simResult.ledger;

    it('Point 1: Should use 광고선전비 instead of 마케팅비 and match COA', () => {
        const mktEntries = ledger.filter(e => e.description.includes('마케팅') || e.debitAccount === '광고선전비');
        expect(mktEntries.length).toBeGreaterThan(0);
        const unknownEntries = mktEntries.filter(e => e.debitAccountId === 'acc_unknown');
        expect(unknownEntries.length).toBe(0);
    });

    it('Point 2: Should use correct ID acc_825 for Voucher Service Fees', () => {
        const voucherEntries = ledger.filter(e => e.id.includes('GRANT-VOUCHER'));
        expect(voucherEntries.length).toBeGreaterThan(0);
        const allCorrect = voucherEntries.every(e => 
            e.complexLines?.some(cl => cl.account === '지급수수료' && cl.accountId === 'acc_825')
        );
        expect(allCorrect).toBe(true);
    });

    it('Point 3: Strategic Simulator should implement M+1 settlement with non-zero anchor', () => {
        const macro = { revenueNaturalGrowth: 0.0, inflationRate: 0.0, wageGrowthRate: 0.0 };
        const strategy = { revenueMult: 1.0, expenseMult: 1.0, fixedCostDelta: 0 };
        const projDate = '2026-12-31';
        
        const mockActual: JournalEntry[] = [
            { id: 'ACT-1', date: '2026-12-15', description: 'Actual Rev', amount: 1000000, vat: 0, debitAccount: '보통예금', debitAccountId: 'acc_103', creditAccount: '상품매출', creditAccountId: 'acc_401', type: 'Revenue', status: 'Approved', scope: 'actual' }
        ];

        const projections = projectScenarioFrontend(mockActual, projDate, strategy, macro, 3);
        
        console.log("PROJECTION DATES:", projections.map(p => `${p.date} (${p.debitAccount}->${p.creditAccount})`));

        const recognition = projections.find(e => e.debitAccount === '외상매출금');
        const settlement = projections.find(e => e.debitAccount === '보통예금' && e.creditAccount === '외상매출금');
        
        expect(recognition).toBeDefined();
        expect(settlement).toBeDefined();
        
        // Settlement should be exactly 1 month after (approx)
        const recDate = new Date(recognition!.date);
        const setDate = new Date(settlement!.date);
        expect(setDate.getTime()).toBeGreaterThan(recDate.getTime());
    });

    it('Point 4: Should generate Quarterly VAT Settlement entries', () => {
        const vatSettlements = ledger.filter(e => e.id.includes('VAT-FILING'));
        expect(vatSettlements.length).toBeGreaterThanOrEqual(4);
    });

    it('Point 5: Should generate Monthly Depreciation entries', () => {
        const depEntries = ledger.filter(e => e.id.includes('DEP-'));
        expect(depEntries.length).toBeGreaterThanOrEqual(12);
        expect(depEntries[0].debitAccountId).toBe('acc_831');
        expect(depEntries[0].creditAccountId).toBe('acc_213');
    });
});
