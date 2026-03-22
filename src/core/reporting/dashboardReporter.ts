import { JournalEntry, FinancialSummary } from '../../types';
import { unrollJournalToLedger } from '../engine/journalEngine';
import { calculateTrialBalance } from '../engine/trialBalanceEngine';
import { calculateFinancialsFromTB } from './incomeStatement';

export interface DashboardReport {
    hasActivity: boolean;
    totalRevenue: number;
    operatingRevenue: number;
    grantIncome: number;
    currentCash: number;
    currentNetProfit: number;
    cashFlowData: { name: string; income: number; operatingIncome: number; grantIncome: number; expense: number }[];
    collectionRate: number;
}

/**
 * [REPORTING ENGINE] Dashboard Analytics Aggregator
 * Strictly uses Trial Balance and Ledger for historical calculations.
 */
export const generateDashboardReport = (ledger: JournalEntry[], currentDate: string): DashboardReport => {
    const ledgerLines = unrollJournalToLedger(ledger);
    const today = new Date(currentDate);
    
    // 1. Current Snapshot (YTD for P&L, cumulative for Cash)
    const ytStart = `${today.getFullYear()}-01-01`;
    const tb = calculateTrialBalance(ledgerLines, ytStart, currentDate);
    const financials = calculateFinancialsFromTB(tb);


    // 3. Chart Data (Last 12 months)
    const cashFlowData: { name: string; income: number; operatingIncome: number; grantIncome: number; expense: number }[] = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const start = `${mKey}-01`;
        const end = `${mKey}-${String(lastDay).padStart(2, '0')}`;
        
        if (end > currentDate) {
            cashFlowData.push({ name: `${d.getMonth() + 1}월`, income: 0, operatingIncome: 0, grantIncome: 0, expense: 0 });
            continue;
        }

        const mTB = calculateTrialBalance(ledgerLines, start, end);
        let mOperatingIncome = 0;
        let mGrantIncome = 0;
        let mExpense = 0;
        Object.values(mTB).forEach(item => {
            const periodBal = item.movementDebit - item.movementCredit;
            if (item.meta.nature === 'REVENUE') {
                if (item.meta.code === '403') {
                    mGrantIncome += -periodBal;
                } else {
                    mOperatingIncome += -periodBal;
                }
            }
            if (item.meta.nature === 'EXPENSE') mExpense += periodBal;
        });

        cashFlowData.push({ 
            name: `${d.getMonth() + 1}월`, 
            income: mOperatingIncome + mGrantIncome, 
            operatingIncome: mOperatingIncome,
            grantIncome: mGrantIncome,
            expense: mExpense 
        });
    }

    // Removed the old collectionRate calculation here as it's now in the return statement

    return {
        hasActivity: ledger.length > 0,
        totalRevenue: financials.revenue,
        operatingRevenue: financials.operatingRevenue,
        grantIncome: financials.grantRevenue,
        currentCash: financials.cash,
        currentNetProfit: financials.netIncome,
        cashFlowData,
        collectionRate: financials.revenue > 0 ? (1 - (financials.ar / financials.revenue)) * 100 : 100
    };
};
