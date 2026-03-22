import { JournalEntry, TrialBalance } from '../../types';
import { calculateTrialBalance } from '../engine/trialBalanceEngine';
import { unrollJournalToLedger } from '../engine/journalEngine';

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
 * Strictly uses Trial Balance for all amounts.
 * No description-based logic allowed here.
 */
export const generateMonthlyPnL = (
    entries: JournalEntry[], 
    years: number[] = [2026, 2027, 2028], 
    currentDate: string = "2026-12-31" // default placeholder
): MonthlyPnLRow[] => {
    console.log("🧪 PnL INPUT SIZE:", entries.length);

    const hasFuture = entries.some(e => e.scope === "future" || e.type === "Scenario");

    console.log("🧪 Contains Future Entries:", hasFuture);

    const months: string[] = [];
    years.forEach(y => {
        for (let m = 1; m <= 12; m++) {
            months.push(`${y}-${String(m).padStart(2, '0')}`);
        }
    });

    const ledgerLines = unrollJournalToLedger(entries);

    return months.map(m => {
        const [y, mm] = m.split('-').map(Number);
        const periodStart = `${m}-01`;
        const lastDay = new Date(y, mm, 0).getDate();
        const periodEnd = `${m}-${String(lastDay).padStart(2, '0')}`;

        // [OFF] Integrity Boundary - [UPDATE] Future entries allowed if they exist
        // If not, returns 0.
        const tb = calculateTrialBalance(ledgerLines, periodStart, periodEnd, 'all');
        
        // Map TB items to P&L structure
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
            const periodBal = item.movementDebit - item.movementCredit;
            const nature = item.meta.nature;

            if (nature === 'REVENUE') {
                // Net Credit is positive Revenue (-periodBal)
                const amount = -periodBal;
                if (code === '403') grantIncome += amount;
                else operatingRevenue += amount;

            } else if (nature === 'EXPENSE') {
                // Net Debit is positive Expense (periodBal)
                const amount = periodBal;
                if (code === '801') payroll += amount;
                else if (code === '826') marketing += amount;
                else if (code === '816') rent += amount;
                else if (code === '831' || code === '845') depreciation += amount;
                else if (code === '501') cogs += amount;
                else misc += amount;

            } else if (nature === 'EQUITY') {
                // Net Credit is positive Equity (-periodBal)
                const amount = -periodBal;
                if (code === '351') investment += amount;
            }

            // Cash aggregation (keep as-is)
            if (
                code === '101' || 
                code === '103' || 
                (nature === 'ASSET' && (item.meta.name.includes('현금') || item.meta.name.includes('예금')))
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
