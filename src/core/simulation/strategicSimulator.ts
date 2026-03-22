import { JournalEntry, MacroAssumptions } from '../../types';

/**
 * [STRATEGIC SIMULATOR - CONSTITUTION V2.2]
 * Frontend-only projection engine.
 * Rule: Projects historical averages into the future with macro-adjustments.
 * UPDATED: Revenue is now treated as CASH (acc_103) for meaningful strategic trajectories.
 */
export function projectScenarioFrontend(
    actualLedger: JournalEntry[],
    selectedDate: string,
    strategy: { revenueMult: number; expenseMult: number; fixedCostDelta: number },
    macro: MacroAssumptions,
    months: number = 36
): JournalEntry[] {
    // ✅ Step 1. 입력값 로그 강제 출력
    console.log('[SIM_INPUT]', {
        revenueMult: strategy.revenueMult,
        expenseMult: strategy.expenseMult,
        fixedCostDelta: strategy.fixedCostDelta,
        projectionMonths: months
    });

    const projectionCutoff = selectedDate;
    
    // ==========================================
    // ✅ HYBRID ANCHOR (70% Last Month + 30% Avg)
    // ==========================================
    const LOOKBACK_MONTH_COUNT = 6;

    // 1. 날짜 기준 정렬 및 데이터 필터링 (Anchor 시점 이전)
    const sorted = actualLedger
        .filter(e => e.date <= projectionCutoff && (e.scope === 'actual' || !e.scope))
        .sort((a, b) => a.date.localeCompare(b.date));

    // 2. 월별 그룹핑
    const monthlyMap = new Map<string, JournalEntry[]>();
    sorted.forEach(entry => {
        const month = entry.date.substring(0, 7); // YYYY-MM
        if (!monthlyMap.has(month)) monthlyMap.set(month, []);
        monthlyMap.get(month)!.push(entry);
    });

    const monthsPresent = Array.from(monthlyMap.keys()).sort();
    
    // 3. 최근 N개월 추출
    const recentMonths = monthsPresent.slice(-LOOKBACK_MONTH_COUNT);

    // 4. 월별 합계 계산 함수 (Revenue, Expense)
    const calcMonthlyTotals = (entries: JournalEntry[]) => {
        let rev = 0; let exp = 0;
        entries.forEach(e => {
            const debit = e.debitAccountId;
            const credit = e.creditAccountId;

            if (!debit && !credit) return;

            // 📌 Revenue (수익은 credit 기준)
            if (credit?.startsWith('acc_4')) {
                rev += e.amount;
            }

            // 📌 Expense / Payroll / COGS (비용은 debit 기준)
            if (
                debit?.startsWith('acc_5') || // COGS
                debit?.startsWith('acc_6') || // Payroll
                debit?.startsWith('acc_8')    // OPEX
            ) {
                exp += e.amount;
            }
        });
        
        // [DEBUG] Anchor Calculation Check
        console.log('[ANCHOR_DEBUG]', { rev, exp, profit: rev - exp });
        
        return { rev, exp, pay: 0 }; // pay is folded into exp as per instruction
    };


    // 5. 최근 평균 계산 (Avg)
    let revSum = 0; let expSum = 0; let paySum = 0;
    recentMonths.forEach(m => {
        const t = calcMonthlyTotals(monthlyMap.get(m)!);
        revSum += t.rev; expSum += t.exp; paySum += t.pay;
    });

    const avgRevenue = revSum / Math.max(recentMonths.length, 1);
    const avgExpense = expSum / Math.max(recentMonths.length, 1);
    const avgPayroll = paySum / Math.max(recentMonths.length, 1);

    // 6. 마지막 월 계산 (Last Month Anchor)
    const lastMonthKey = monthsPresent[monthsPresent.length - 1];
    const lastTotals = lastMonthKey ? calcMonthlyTotals(monthlyMap.get(lastMonthKey)!) : { rev: 0, exp: 0, pay: 0 };

    const lastRevenue = lastTotals.rev;
    const lastExpense = lastTotals.exp;
    const lastPayroll = lastTotals.pay;

    // 7. 🔥 HYBRID (70% last + 30% avg) - 최적의 시작점 산출
    const baseAvgRevenue = (lastRevenue * 0.7) + (avgRevenue * 0.3);
    const baseAvgOpex = (lastExpense * 0.7) + (avgExpense * 0.3);
    const baseAvgPayroll = (lastPayroll * 0.7) + (avgPayroll * 0.3);

    // ✅ 디버깅 로그 (Final Hybrid Status)
    console.log('[ANCHOR_HYBRID]', {
        lastMonth: lastMonthKey,
        lastRevenue,
        avgRevenue,
        baseAvgRevenue,
        lastExpense,
        avgExpense,
        baseAvgOpex
    });

    // 🚨 Step 4. “전략 변수 무효화 감지” (핵심)
    if (strategy.revenueMult !== 1) {
        const testRevenue = baseAvgRevenue * strategy.revenueMult;
        if (testRevenue === baseAvgRevenue && baseAvgRevenue !== 0) {
            throw new Error('[CRITICAL] revenueMult NOT applied');
        }
    }

    const futureEntries: JournalEntry[] = [];
    
    // 2. Project Months
    const anchor = new Date(selectedDate);
    const startYear = anchor.getFullYear();
    const startMonth = anchor.getMonth();

    for (let i = 1; i <= months; i++) {
        const currentProjectionDate = new Date(startYear, startMonth + i, 28);
        const dateStr = currentProjectionDate.toISOString().split('T')[0];
        
        // 🔥 [ALIGNMENT] t = 0 starts at i = 1 (Jan 2029) to match Anchor exactly.
        // Growth and Inflation indices apply from i = 2 onwards.
        const yearOffset = (i - 1) / 12;

        const growthIdx = Math.pow(1 + (macro.revenueNaturalGrowth || 0), yearOffset);
        const inflationIdx = Math.pow(1 + (macro.inflationRate || 0), yearOffset);
        const wageIdx = Math.pow(1 + (macro.wageGrowthRate || 0), yearOffset);

        const adjustedRevenue = baseAvgRevenue * strategy.revenueMult * growthIdx;
        const adjustedPayroll = baseAvgPayroll * strategy.expenseMult * wageIdx;
        const adjustedOpex = (baseAvgOpex * strategy.expenseMult * inflationIdx) + strategy.fixedCostDelta;

        // ✅ Step 2. 매출 생성 로직 로그 (첫 달만 출력)
        if (i === 1) {
            console.log('[SIM_REVENUE]', {
                baseAvgRevenue,
                revenueMult: strategy.revenueMult,
                growthIdx,
                finalRevenue: adjustedRevenue
            });
            console.log('[SIM_EXPENSE]', {
                baseAvgOpex,
                expenseMult: strategy.expenseMult,
                inflationIdx,
                finalExpense: adjustedOpex
            });
        }

        // Revenue Entry (Now CASH for better simulation clarity)
        futureEntries.push({
            id: `FUTURE-REV-${dateStr}-${i}`,
            date: dateStr,
            description: `[FUTURE] Projected Revenue (Growth: ${((macro.revenueNaturalGrowth||0)*100).toFixed(1)}%)`,
            amount: Math.round(adjustedRevenue),
            vat: 0,
            debitAccount: "보통예금", // [FIX] A/R -> CASH
            debitAccountId: "acc_103",
            creditAccount: "상품매출",
            creditAccountId: "acc_401",
            type: "Scenario",
            scope: "future",
            status: "Approved"
        });

        // Payroll Entry (CASH)
        if (adjustedPayroll > 0) {
            futureEntries.push({
                id: `FUTURE-PAY-${dateStr}-${i}`,
                date: dateStr,
                description: `[FUTURE] Projected Payroll (Wage Growth: ${((macro.wageGrowthRate||0)*100).toFixed(1)}%)`,
                amount: Math.round(adjustedPayroll),
                vat: 0,
                debitAccount: "급여",
                debitAccountId: "acc_801",
                creditAccount: "보통예금",
                creditAccountId: "acc_103",
                type: "Scenario",
                scope: "future",
                status: "Approved"
            });
        }

        // Opex Entry (Account Payable)
        if (adjustedOpex > 0) {
            futureEntries.push({
                id: `FUTURE-OPEX-${dateStr}-${i}`,
                date: dateStr,
                description: `[FUTURE] Projected Opex (Inflation: ${((macro.inflationRate||0)*100).toFixed(1)}%)`,
                amount: Math.round(adjustedOpex),
                vat: 0,
                debitAccount: "상품매출원가",
                debitAccountId: "acc_501",
                creditAccount: "미지급금",
                creditAccountId: "acc_253",
                type: "Scenario",
                scope: "future",
                status: "Approved"
            });
            
            // Simulating CASH Payment for Opex within 1 month for strategic view
            futureEntries.push({
                id: `FUTURE-OPEX-PAY-${dateStr}-${i}`,
                date: dateStr,
                description: `[FUTURE] Opex Payment (Cash)`,
                amount: Math.round(adjustedOpex),
                vat: 0,
                debitAccount: "미지급금",
                debitAccountId: "acc_253",
                creditAccount: "보통예금",
                creditAccountId: "acc_103",
                type: "Scenario",
                scope: "future",
                status: "Approved"
            });
        }
    }

    return futureEntries;
}
