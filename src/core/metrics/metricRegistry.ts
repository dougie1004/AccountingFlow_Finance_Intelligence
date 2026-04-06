import { JournalEntry, FinancialSummary, AccountDefinition } from '../../types';

/**
 * [V14 SSOT] Core Indicator Window
 */
export function calculateBurn(ledger: JournalEntry[]) {
    let revenue = 0;
    let expenses = 0;
    
    ledger.forEach(e => {
        const type = e.type || e.accountType;
        if (type === 'Revenue' || (e.accountType === 'AR' && e.amount > 0)) revenue += e.amount;
        if (type === 'Expense' || type === 'Payroll' || (e.accountType === 'AP' && e.amount > 0)) expenses += e.amount;
    });

    return {
        revenue,
        expenses,
        netBurn: Math.max(expenses - revenue, 0),
        grossBurn: expenses
    };
}

/**
 * [V14 SSOT] Unified Runway Calculation
 */
export function calculateRunway(params: { netLiquidity: number; netBurn: number }) {
    const { netLiquidity, netBurn } = params;
    if (netBurn <= 0) return Infinity;
    return netLiquidity / netBurn;
}

export function calculateOperatingBurn(ledger: JournalEntry[]) {
    const expenses = ledger.filter(e => e.type === 'Expense' || e.type === 'Payroll' || e.accountType === 'AP');
    return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * [V14] Robust Operating Burn (Excluding non-operational flows)
 */
export function calculateRobustOperatingBurn(ledger: JournalEntry[]) {
    const opExpenses = ledger.filter(e => 
        (e.type === 'Expense' || e.type === 'Payroll') && 
        !e.debitAccount?.includes('투자') && 
        !e.debitAccount?.includes('자산')
    );
    return opExpenses.reduce((sum, e) => sum + e.amount, 0);
}

// SSOT: Sequential Cash Depletion Model
export function calculateSequentialRunway(params: { 
    currentCash: number; 
    futureCashDeltas: number[]; 
}) {
    let cash = params.currentCash;
    let months = 0;

    for (const delta of params.futureCashDeltas) {
        cash += delta;
        if (cash <= 0) break;
        months++;
        if (months >= 60) break; 
    }
    return months;
}

export function calculateCashRunway(currentCash: number, monthlyBurn: number) {
    if (monthlyBurn <= 0) return 60; 
    return Math.min(currentCash / monthlyBurn, 60);
}

export function calculateCashBurn(deltas: number[]) {
    if (!deltas || deltas.length === 0) return 0;
    const netOut = deltas.filter(d => d < 0).reduce((sum, d) => sum + Math.abs(d), 0);
    return netOut / deltas.length;
}

/**
 * [V14] Cash Burn Breakdown by Category
 */
export function calculateCashBurnBreakdown(ledger: JournalEntry[]) {
    const expenses = ledger.filter(e => e.type === 'Expense' || e.type === 'Payroll' || e.accountType === 'AP');
    const categories: Record<string, number> = {};
    
    expenses.forEach(e => {
        const cat = e.creditAccount || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + e.amount;
    });

    return Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));
}
