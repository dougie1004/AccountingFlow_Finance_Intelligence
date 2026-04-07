import { JournalEntry, AccountDefinition } from '../../types';
import { calculateTrialBalance } from '../engine/trialBalanceEngine';
import { unrollJournalToLedger } from '../engine/journalEngine';
import { CHART_OF_ACCOUNTS } from '../coa';

export interface MonthlyPnLRow {
    month: string;
    revenue: number;          // Operating Revenue ONLY
    operatingRevenue: number; // Pure Sales
    grantIncome: number;      // Grant/Voucher (Non-operating)
    cogs: number;
    grossProfit: number;
    payroll: number;
    marketing: number;
    rent: number;
    depreciation: number;
    misc: number;
    operatingProfit: number;
    cashOperatingProfit: number; // [V2.6] OPEX + Depreciation
    netIncome: number;
    investment: number;
    voucherExecution: number;
    carryoverCash: number;
    monthlyNetCashFlow: number; 
    userCount: number;
    growthUser: string;
}

/**
 * [REPORTING ENGINE] Monthly P&L Aggregator
 * [V12.1 FIX] Robust categorization to prevent "Zero P&L" data pipeline failure.
 */
export const generateMonthlyPnL = (
    entries: JournalEntry[], 
    years: number[] = [2026, 2027, 2028], 
    currentDate: string = "2026-12-31",
    coa: Record<string, AccountDefinition> = CHART_OF_ACCOUNTS
): MonthlyPnLRow[] => {
    console.log("🧪 PnL INPUT SIZE:", entries.length);

    const months: string[] = [];
    years.forEach(y => {
        for (let m = 1; m <= 12; m++) {
            months.push(`${y}-${String(m).padStart(2, '0')}`);
        }
    });

    // includeUnapproved is true for scenarios and staging data visualization
    const ledgerLines = unrollJournalToLedger(entries, true);

    return months.map(m => {
        const [y, mm] = m.split('-').map(Number);
        const periodStart = `${m}-01`;
        const lastDay = new Date(y, mm, 0).getDate();
        const periodEnd = `${m}-${String(lastDay).padStart(2, '0')}`;

        // Calculate TB using the provided COA (Critical fix for custom accounts)
        const tb = calculateTrialBalance(ledgerLines, periodStart, periodEnd, 'all', coa);
        
        let payroll = 0;
        let marketing = 0;
        let rent = 0;
        let depreciation = 0;
        let misc = 0;
        let cogs = 0;
        let operatingRevenue = 0;
        let grantIncome = 0;
        let investment = 0;
        let monthEndCash = 0;
        let monthStartCash = 0;

        Object.values(tb).forEach(item => {
            const code = item.meta.code;
            const name = item.meta.name;
            const periodBal = item.movementDebit - item.movementCredit;
            const nature = item.meta.nature;

            if (nature === 'REVENUE') {
                const amount = -periodBal;
                // [V12.1] Flexible Revenue Categorization
                if (code === '403' || name.includes('보조금')) grantIncome += amount;
                else operatingRevenue += amount;

            } else if (nature === 'EXPENSE') {
                const amount = periodBal;
                // [V12.1] Flexible Expense Categorization (Code + Name Fallback)
                if (code === '801' || name.includes('급여') || name.includes('인건비')) payroll += amount;
                else if (code === '826' || name.includes('마케팅') || name.includes('광고')) marketing += amount;
                else if (code === '816' || name.includes('임차')) rent += amount;
                else if (code === '831' || code === '845' || name.includes('상각')) depreciation += amount;
                else if (code === '501' || name.includes('원가')) cogs += amount;
                else misc += amount;

            } else if (nature === 'EQUITY') {
                const amount = -periodBal;
                if (code === '351' || name.includes('투자')) investment += amount;
            }

            // Cash aggregation (Code check + Name check for robustness)
            if (
                code === '101' || code === '103' || 
                name.includes('현금') || name.includes('예금') || name.includes('계좌')
            ) {
                monthEndCash += (item.closingDebit - item.closingCredit);
                monthStartCash += (item.openingDebit - item.openingCredit);
            }
        });

        const revenue = operatingRevenue + grantIncome; 
        const grossProfit = operatingRevenue - cogs;
        const operatingProfit = grossProfit - payroll - marketing - rent - depreciation - misc;
        const netIncome = operatingProfit + grantIncome;
        const cashOperatingProfit = operatingProfit + depreciation;
        const voucherExecution = grantIncome; 

        return {
            month: m,
            revenue,
            operatingRevenue,
            grantIncome,
            cogs,
            grossProfit,
            payroll,
            marketing,
            rent,
            depreciation,
            misc,
            operatingProfit,
            cashOperatingProfit,
            netIncome, 
            investment,
            voucherExecution,
            carryoverCash: monthEndCash,
            monthlyNetCashFlow: monthEndCash - monthStartCash,
            userCount: 0,
            growthUser: '-'
        };
    });
};
