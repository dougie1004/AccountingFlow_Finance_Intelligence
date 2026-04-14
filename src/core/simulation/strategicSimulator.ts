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
    // [FIX] 사용자 시뮬레이션 데이터를 포함하기 위해 'scenario' scope까지 포함하도록 필터링 완화
    const sorted = actualLedger
        .filter(e => e.date <= projectionCutoff && (e.scope === 'actual' || e.scope === 'scenario' || !e.scope))
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
            const debit = (e.debitAccountId || e.debitAccount || "").toLowerCase();
            const credit = (e.creditAccountId || e.creditAccount || "").toLowerCase();

            // VAT 포함 총액 기준 (Cash Flow 관점)
            const total = e.amount + (e.vat || 0);

            // 📌 Revenue
            if (credit.includes('acc_4') || credit.includes('매출') || credit.includes('수익')) {
                rev += total;
            }

            // 📌 Expense (OPEX, Payroll, COGS)
            if (
                debit.includes('acc_5') || debit.includes('acc_6') || debit.includes('acc_8') ||
                debit.includes('비용') || debit.includes('급여') || debit.includes('임차') || 
                debit.includes('마케팅') || debit.includes('수수료') || debit.includes('인건비') || debit.includes('용역')
            ) {
                exp += total;
            }
        });
        
        return { rev, exp, pay: 0 };
    };


    // 5. 최근 평균 계산 (Avg)
    let revSum = 0; let expSum = 0;
    recentMonths.forEach(m => {
        const t = calcMonthlyTotals(monthlyMap.get(m)!);
        revSum += t.rev; expSum += t.exp;
    });

    const avgRevenue = revSum / Math.max(recentMonths.length, 1);
    const avgExpense = expSum / Math.max(recentMonths.length, 1);

    // 6. 마지막 월 계산 (Last Month Anchor)
    // 데이터가 있는 마지막 달을 찾는다.
    const lastMonthKey = monthsPresent[monthsPresent.length - 1];
    const lastTotals = lastMonthKey ? calcMonthlyTotals(monthlyMap.get(lastMonthKey)!) : { rev: 0, exp: 0, pay: 0 };

    const lastRevenue = lastTotals.rev;
    const lastExpense = lastTotals.exp;

    // 7. 🔥 ANCHOR REFINEMENT
    // 매출은 변동성이 크므로 Hybrid (70/30) 유지
    // 비용(Burn)은 최신 현황(인건비 포함 등)이 중요하므로 100% Last Month (또는 최신) 적극 반영
    const baseAvgRevenue = (lastRevenue * 0.7) + (avgRevenue * 0.3);
    const baseAvgOpex = lastExpense > 0 ? lastExpense : avgExpense;
    const baseAvgPayroll = 0; // exp에 통합됨

    // ✅ 디버깅 로그 (Final Hybrid Status)
    console.log('[ANCHOR_HYBRID_v11]', {
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
    
    // [V2.5] High-Fidelity Accrual Settlement Tracking
    let pendingAR = 0;
    let pendingAP = 0;

    // 2. Project Months
    const anchor = new Date(selectedDate);
    const startYear = anchor.getFullYear();
    const startMonth = anchor.getMonth();

    for (let i = 1; i <= months; i++) {
        // Recognition on 28th, Settlement on 5th of NEXT month
        const dateStr = new Date(startYear, startMonth + i, 28).toISOString().split('T')[0];
        const nextMonthSettlementDate = new Date(startYear, startMonth + i + 1, 5).toISOString().split('T')[0];
        
        // --- PHASE 1: SETTLEMENT OF PREVIOUS MONTH (Actual Cash Flow) ---
        const settlementDate = new Date(startYear, startMonth + i, 5).toISOString().split('T')[0];
        
        if (pendingAR > 0) {
            futureEntries.push({
                id: `FUTURE-SETTLE-AR-${settlementDate}-${i}`,
                date: settlementDate,
                description: `[SETTLE] Projected Revenue Collection (M+1)`,
                amount: Math.round(pendingAR),
                vat: 0,
                debitAccount: "보통예금",
                debitAccountId: "acc_103",
                creditAccount: "외상매출금",
                creditAccountId: "acc_108",
                type: "Revenue",
                scope: "future",
                status: "Approved"
            });
            pendingAR = 0;
        }

        if (pendingAP > 0) {
            futureEntries.push({
                id: `FUTURE-SETTLE-AP-${settlementDate}-${i}`,
                date: settlementDate,
                description: `[SETTLE] Projected Expense Payment (M+1)`,
                amount: Math.round(pendingAP),
                vat: 0,
                debitAccount: "미지급금",
                debitAccountId: "acc_253",
                creditAccount: "보통예금",
                creditAccountId: "acc_103",
                type: "Scenario",
                scope: "future",
                status: "Approved"
            });
            pendingAP = 0;
        }

        const yearOffset = (i - 1) / 12;

        const growthIdx = Math.pow(1 + (macro.revenueNaturalGrowth || 0), yearOffset);
        const inflationIdx = Math.pow(1 + (macro.inflationRate || 0), yearOffset);
        const wageIdx = Math.pow(1 + (macro.wageGrowthRate || 0), yearOffset);

        const adjustedRevenue = baseAvgRevenue * strategy.revenueMult * growthIdx;
        const adjustedPayroll = baseAvgPayroll * strategy.expenseMult * wageIdx;
        const adjustedOpex = (baseAvgOpex * strategy.expenseMult * inflationIdx) + strategy.fixedCostDelta;

        if (i === 1) {
            console.log('[DEBUG_SIM] Month 1:', { dateStr, adjustedRevenue, pendingAR });
        }


        // Revenue Recognition (Accounts Receivable)
        if (adjustedRevenue > 0) {
            futureEntries.push({
                id: `FUTURE-REV-${dateStr}-${i}`,
                date: dateStr,
                description: `[FUTURE] Projected Revenue (Accrual Recognition)`,
                amount: Math.round(adjustedRevenue),
                vat: 0,
                debitAccount: "외상매출금",
                debitAccountId: "acc_108",
                creditAccount: "상품매출",
                creditAccountId: "acc_401",
                type: "Revenue",
                scope: "future",
                status: "Approved"
            });
            pendingAR = adjustedRevenue; 
        }

        // Payroll Entry (Usually Cash, but we can treat as immediate for simplification if needed, or M+1)
        // keeping it immediate to reflect standard startup payroll practice (25th or last day payout)
        if (adjustedPayroll > 0) {
            futureEntries.push({
                id: `FUTURE-PAY-${dateStr}-${i}`,
                date: dateStr,
                description: `[FUTURE] Projected Payroll`,
                amount: Math.round(adjustedPayroll),
                vat: 0,
                debitAccount: "급여",
                debitAccountId: "acc_801",
                creditAccount: "보통예금",
                creditAccountId: "acc_103",
                type: "Payroll",
                scope: "future",
                status: "Approved"
            });
        }

        // Opex Entry (Account Payable)
        if (adjustedOpex > 0) {
            futureEntries.push({
                id: `FUTURE-OPEX-${dateStr}-${i}`,
                date: dateStr,
                description: `[FUTURE] Projected Opex (Accrual Recognition)`,
                amount: Math.round(adjustedOpex),
                vat: 0,
                debitAccount: "상품매출원가",
                debitAccountId: "acc_501",
                creditAccount: "미지급금",
                creditAccountId: "acc_253",
                type: "Expense",
                scope: "future",
                status: "Approved"
            });
            pendingAP = adjustedOpex;
        }
    }

    return futureEntries;
}
