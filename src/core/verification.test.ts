import { describe, it, expect } from 'vitest';
import { generateMultiYearSimulation } from './simulation/journalGenerator';
import { generateMonthlyPnL } from './reporting/monthlyReporter';
import { SCENARIO_CONFIGS } from './simulation/scenarioConfigs';
import { unrollJournalToLedger, calculateTrialBalance } from './engine';
import { calculateFinancialsFromTB } from './reporting/incomeStatement';
import { CHART_OF_ACCOUNTS } from './coa';
import { ALL_ACCOUNTS, MASTER_ACCOUNTS } from '../constants/accounts';
import { AccountDefinition } from '../types';

describe('Strategic Protocol - STANDARD Scenario Verification', () => {
    // Replicate AccountingContext account merge logic
    const ACCOUNTS: Record<string, AccountDefinition> = { ...CHART_OF_ACCOUNTS };
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

    const simulation = generateMultiYearSimulation([2026, 2027, 2028], SCENARIO_CONFIGS['STANDARD']);
    const ledger = simulation.ledger;
    const ledgerLines = unrollJournalToLedger(ledger);

    describe('PHASE 1: Ledger Integrity', () => {
        it('should have Debit == Credit for every journal entry', () => {
            ledger.forEach(entry => {
                if (entry.complexLines && entry.complexLines.length > 0) {
                    let sumDr = 0;
                    let sumCr = 0;
                    entry.complexLines.forEach(l => {
                        sumDr += l.debit;
                        sumCr += l.credit;
                    });
                    expect(sumDr).toBe(sumCr);
                } else {
                    const totalAmount = entry.amount + (entry.vat || 0);
                    expect(totalAmount).toBeGreaterThanOrEqual(0);
                }
            });
        });

        it('should have all account IDs valid according to merged COA', () => {
            const validIds = new Set(Object.values(ACCOUNTS).map(a => a.id));
            ledgerLines.forEach(line => {
                expect(line.accountId).toBeDefined();
                expect(validIds.has(line.accountId!)).toBe(true);
            });
        });

        it('should have Trial Balance Σ Debit == Σ Credit', () => {
            const tb = calculateTrialBalance(ledgerLines, '2026-01-01', '2028-12-31', 'actual', ACCOUNTS);
            let totalDr = 0;
            let totalCr = 0;
            Object.values(tb).forEach(item => {
                totalDr += item.movementDebit;
                totalCr += item.movementCredit;
            });
            expect(Math.abs(totalDr - totalCr)).toBeLessThan(1); // Precision
        });
    });

    describe('PHASE 2: FS Consistency', () => {
        const tb = calculateTrialBalance(ledgerLines, '2026-01-01', '2028-12-31', 'actual', ACCOUNTS);
        const fs = calculateFinancialsFromTB(tb);

        it('should satisfy Accounting Equation: Total Assets = Total Liabilities + Total Equity', () => {
            const imbalance = fs.totalAssets - (fs.totalLiabilities + fs.totalEquity);
            expect(Math.abs(imbalance)).toBeLessThan(1);
        });

        it('should have Revenue - Expenses = Net Income', () => {
            const calcNI = fs.revenue - fs.expenses;
            expect(fs.netIncome).toBe(calcNI);
        });
    });

    describe('PHASE 3: Cash Anchor Verification', () => {
        const tb = calculateTrialBalance(ledgerLines, '2026-01-01', '2028-12-31', 'actual', ACCOUNTS);
        const fs = calculateFinancialsFromTB(tb);

        it('should have Cash GL Balance == Sum of all cash movements', () => {
            let manualCashSum = 0;
            ledgerLines.forEach(line => {
                if (line.accountId === 'acc_101' || line.accountId === 'acc_103') {
                    manualCashSum += (line.debit - line.credit);
                }
            });
            expect(fs.cash).toBe(manualCashSum);
        });
    });

    describe('PHASE 4: Closing & Controls', () => {
        it('should have depreciation entries for all active assets', () => {
            const depEntries = ledger.filter(e => e.description.includes('감가상각비'));
            expect(depEntries.length).toBeGreaterThan(0);
            
            // Verify depreciation entries use the correct accounts
            depEntries.forEach(entry => {
                const accounts = [entry.debitAccount, entry.creditAccount];
                expect(accounts).toContain('감가상각누계액');
                expect(accounts.some(a => a.includes('상각비'))).toBe(true);
            });
        });
    });

    describe('PHASE 5: Strategic Compass Sanity', () => {
        const tb = calculateTrialBalance(ledgerLines, '2026-01-01', '2028-12-31', 'actual', ACCOUNTS);
        const fs = calculateFinancialsFromTB(tb);

        it('should have plausible Runway and Net Profit', () => {
            // Standard scenario expects a bridge investment or revenue growth to keep it alive
            expect(fs.cash).toBeGreaterThan(0);
            expect(fs.revenue).toBeGreaterThan(0);
        });
    });

    describe('PHASE 6: Sub-Ledger Integrations', () => {
        const tb = calculateTrialBalance(ledgerLines, '2026-01-01', '2028-12-31', 'actual', ACCOUNTS);
        const fs = calculateFinancialsFromTB(tb);

        it('should have AR/AP totals matching BS totals', () => {
            let totalAR = 0;
            let totalAP = 0;
            ledgerLines.forEach(line => {
                if (line.accountId === 'acc_108' || line.accountId === 'acc_120') totalAR += (line.debit - line.credit);
                if (line.accountId === 'acc_251' || line.accountId === 'acc_253') totalAP += -(line.debit - line.credit);
            });
            expect(fs.ar).toBe(totalAR);
            expect(fs.ap).toBe(totalAP);
        });
    });
});
