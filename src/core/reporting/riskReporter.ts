
import { JournalEntry } from '../../types';
import { unrollJournalToLedger } from '../engine/journalEngine';
import { calculateTrialBalance } from '../engine/trialBalanceEngine';
import { calculateFinancialsFromTB } from './incomeStatement';

export interface RiskReport {
    blockedAmount: number;
    blockedCount: number;
    unsettledLongTerm: number; // Over 90 days
    unsettledLongTermCount: number;
    tradeSettlementRisk: number; // Total AR + AP
    contractualRisk: number; // Prepayments + Advanced Payments
    clearingRisk: number; // Unmatched entries
    cashRisk: number; // Cash risk amount if balance < 0 in 3 months
    closeReadiness: {
        matchingRate: number;
        accrualStatus: 'Completed' | 'Pending';
        amortizationStatus: 'Completed' | 'Pending';
    };
    complianceFindings: { category: string; count: number; color: string }[];
}

/**
 * [RISK MONITORING ENGINE] Tactical Risk Aggregator
 * Calculates aging risks and settlement blocks for the CFO.
 */
export const generateRiskReport = (ledger: JournalEntry[], currentDate: string): RiskReport => {
    // 0. Connect Dashboard to Accounting Context & Log Ledger Size
    console.log("journal entries", ledger.length);
    
    // 1. Normalize Scope Filtering (Step 2: scope === 'actual')
    const actualLedger = ledger.filter(e => (e.scope || 'actual').toLowerCase() === 'actual');
    const ledgerLines = unrollJournalToLedger(actualLedger);
    const tb = calculateTrialBalance(ledgerLines, '2000-01-01', currentDate);
    
    // 2. Metric 1 - Blocked Amount (status === 'blocked')
    let blockedAmount = 0;
    let blockedCount = 0;
    actualLedger.forEach(e => {
        if (e.status === 'blocked') {
            blockedAmount += e.amount;
            blockedCount++;
        }
    });

    // 3. Metric 2 - Overdue Settlement (today - dueDate > 90 days)
    const today = new Date(currentDate);
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const overdueEntries = actualLedger.filter(e => {
        if (!e.dueDate) return false;
        // Step 3: Proper Date Parsing
        const due = new Date(e.dueDate);
        return (today.getTime() - due.getTime()) > ninetyDaysMs;
    });
    const unsettledLongTerm = overdueEntries.reduce((sum, e) => sum + e.amount, 0);

    // 4. Metric 3 - Clearing Risk (matchingStatus !== 'matched')
    const clearingLedger = actualLedger.filter(e => e.matchingStatus !== 'matched');
    const clearingRisk = clearingLedger.reduce((sum, e) => sum + e.amount, 0);

    // 5. Metric 4 - Cash Risk (Projected balance < 0 within 3 months)
    let cashRisk = 0;
    const financials = calculateFinancialsFromTB(tb);
    const currentCash = financials.cash;
    
    // Calculate 3-month burn
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    const startStr = threeMonthsAgo.toISOString().split('T')[0];
    const burnLines = ledgerLines.filter(l => l.date >= startStr && l.date <= currentDate);
    const totalOutflow = burnLines.reduce((sum, l) => sum + l.credit, 0);
    const avgMonthlyOutflow = totalOutflow / 3;
    const projectedCashIn3m = currentCash - (avgMonthlyOutflow * 3);
    
    if (projectedCashIn3m < 0) {
        cashRisk = Math.abs(projectedCashIn3m);
    }

    // 6. Close Readiness Calculation
    const totalMatchable = actualLedger.filter(e => e.debitAccount === '외상매출금' || e.creditAccount === '외상매입금').length;
    const matchedCount = actualLedger.filter(e => (e.debitAccount === '외상매출금' || e.creditAccount === '외상매입금') && e.matchingStatus === 'matched').length;
    const matchingRate = totalMatchable > 0 ? Math.round((matchedCount / totalMatchable) * 100) : 100;

    const hasAccruals = actualLedger.some(e => e.description.toLowerCase().includes('미지급비용') || e.description.toLowerCase().includes('accrual'));
    const hasAmortization = actualLedger.some(e => e.description.toLowerCase().includes('상각') || e.description.toLowerCase().includes('amortization'));

    // Trade stats for other categories
    const arBalance = (tb['acc_108']?.closingDebit || 0) - (tb['acc_108']?.closingCredit || 0);
    const apBalance = (tb['acc_251']?.closingCredit || 0) - (tb['acc_251']?.closingDebit || 0);
    const tradeSettlementRisk = Math.abs(arBalance) + Math.abs(apBalance);
    const prepayBal = (tb['acc_131']?.closingDebit || 0) - (tb['acc_131']?.closingCredit || 0);
    const advancedBal = (tb['acc_259']?.closingCredit || 0) - (tb['acc_259']?.closingDebit || 0);
    const contractualRisk = Math.abs(prepayBal) + Math.abs(advancedBal);

    return {
        blockedAmount,
        blockedCount,
        unsettledLongTerm,
        unsettledLongTermCount: overdueEntries.length,
        tradeSettlementRisk,
        contractualRisk,
        clearingRisk,
        cashRisk,
        closeReadiness: {
            matchingRate,
            accrualStatus: hasAccruals ? 'Completed' : 'Pending',
            amortizationStatus: hasAmortization ? 'Completed' : 'Pending'
        },
        complianceFindings: [
            { category: '가계정 (Compliance)', count: actualLedger.filter(e => e.debitAccount === '미수금' || e.creditAccount === '미지급금').length, color: '#f43f5e' },
            { category: '결산/상각 관리 (Matching)', count: actualLedger.filter(e => e.type === 'Asset' || e.type === 'Payroll').length % 20, color: '#10b981' },
            { category: '상거래 미결 (Operational)', count: overdueEntries.length, color: '#3b82f6' }
        ]
    };
};
