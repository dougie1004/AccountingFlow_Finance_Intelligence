
import { generateBaselineFuture, applyStrategicAdjustments } from './src/core/simulation/simulationEngine';
import { JournalEntry, MacroAssumptions } from './src/types';

// Mock data
const mockActualLedger: JournalEntry[] = [
    {
        id: '1', date: '2026-03-05', description: 'Sale', debitAccount: '보통예금', debitAccountId: 'acc_103',
        creditAccount: '상품매출', creditAccountId: 'acc_401', amount: 10000000, vat: 1000000, type: 'Revenue', status: 'Approved', scope: 'actual'
    },
    {
        id: '2', date: '2026-03-10', description: 'Expense', debitAccount: '기타비용', debitAccountId: 'acc_899',
        creditAccount: '보통예금', creditAccountId: 'acc_103', amount: 5000000, vat: 0, type: 'Expense', status: 'Approved', scope: 'actual'
    }
];

const mockMacro: MacroAssumptions = {
    inflationRate: 0.1, // 10%
    wageGrowthRate: 0.1,
    otherExpenseGrowth: 0.1,
    revenueNaturalGrowth: 0.2 // 20%
};

const selectedDate = '2026-03-17';
const projectionMonths = 12;

console.log('[Phase 1: Baseline Validation]');
const baseline = generateBaselineFuture(mockActualLedger, selectedDate, mockMacro, projectionMonths);

if (baseline.length > 0) {
    const firstMonthRev = baseline.find(e => e.id === 'BASE-REV-1')?.amount || 0;
    const lastMonthRev = baseline.find(e => e.id === `BASE-REV-${projectionMonths}`)?.amount || 0;
    console.log(`Month 1 Revenue: ${firstMonthRev}`);
    console.log(`Month ${projectionMonths} Revenue: ${lastMonthRev}`);
    console.log(`-> 변화 여부: ${lastMonthRev !== firstMonthRev ? 'YES' : 'NO'}`);
} else {
    console.log('Baseline empty');
}

console.log('\n[Phase 2: Strategic Adjustment Validation]');
const revenueMult = 2.0;
const expenseMult = 0.5;
const fixedCostDelta = 0;

const adjusted = applyStrategicAdjustments(baseline, revenueMult, expenseMult, fixedCostDelta);

for (let i = 0; i < Math.min(5, baseline.length); i++) {
    console.log(`Entry ${i+1}:`);
    console.log(` - Before: amount ${baseline[i].amount} (${baseline[i].type})`);
    console.log(` - After: amount ${adjusted[i].amount} (${adjusted[i].type})`);
}

const firstRevAdjusted = adjusted.find(e => e.id.includes('BASE-REV-1'))?.amount || 0;
const firstRevBaseline = baseline.find(e => e.id === 'BASE-REV-1')?.amount || 0;
console.log(`-> 변경 여부: ${firstRevAdjusted !== firstRevBaseline ? 'YES' : 'NO'}`);
