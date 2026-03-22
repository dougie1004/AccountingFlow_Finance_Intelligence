import { JournalEntry } from "../../types";

/**
 * [STRATEGIC CASH FLOW ENGINE - CONSTITUTION V2.1]
 * Final Patch: Strict Cash-Account Delta Tracking
 */

// ✅ 현금 계정 정의 (보통예금 및 소액현금)
const CASH_ACCOUNT_IDS = ["acc_101", "acc_103"]; 

const isCashAccount = (accountId?: string) => {
  if (!accountId) return false;
  return CASH_ACCOUNT_IDS.includes(accountId);
};

// ✅ 월별 그룹핑 함수 (안전 버전)
const groupByMonth = (entries: JournalEntry[]) => {
  const map = new Map<string, JournalEntry[]>();

  entries.forEach((e) => {
    // Handling YYYY-MM-DD string
    const parts = e.date.split('-');
    const key = `${parts[0]}-${parts[1]}`; // YYYY-MM format for consistency

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(e);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => ({ date, entries }));
};

/**
 * 핵심 함수: generateCashFlow
 * ❗ 절대 규칙: 현금 계정의 변동(Debit/Credit)만 delta에 반영한다.
 */
export function generateCashFlow(entries: JournalEntry[], initialCash: number = 0) {
  console.log("🧪 CASH INPUT SIZE:", entries.length);

  const hasFuture = entries.some((e) => e.scope === "future" || e.type === "Scenario");
  console.log("🧪 CASH HAS FUTURE:", hasFuture);

  const monthly = groupByMonth(entries);

  let cash = initialCash; 
  const result: { date: string; cash: number; delta: number }[] = [];

  monthly.forEach((month) => {
    let delta = 0;

    month.entries.forEach((e) => {
      // ✅ Debit: 현금 계정으로의 입금 (현금 증가)
      if (isCashAccount(e.debitAccountId)) {
        delta += e.amount;
      }

      // ✅ Credit: 현금 계정에서의 출금 (현금 감소)
      if (isCashAccount(e.creditAccountId)) {
        delta -= e.amount;
      }

      // 복합 전표 처리 (있을 경우)
      if (e.complexLines) {
          e.complexLines.forEach(l => {
              if (isCashAccount(l.accountId)) {
                delta += (l.debit - l.credit);
              }
          });
      }
    });

    cash += delta;

    result.push({
      date: month.date,
      cash,
      delta,
    });

    // excessive logging can slow down, so only first few and last few if needed,
    // but user requested this log specifically.
    // console.log(`🧪 [${month.date}] delta:`, delta, "cash:", cash);
  });

  console.log("🧪 CASH FLOW GENERATED. SAMPLE:", result.slice(0, 3));
  return result;
}
