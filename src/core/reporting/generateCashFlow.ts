import { JournalEntry } from "../../types";

/**
 * [STRATEGIC CASH FLOW ENGINE - CONSTITUTION V2.2]
 * [V12.1 FIX] Robust Cash Detection for better Simulation accuracy.
 */

// ✅ 현금 계정 정의 (보통예금 및 소액현금)
const CASH_ACCOUNT_IDS = ["acc_101", "acc_103"]; 

const isCashAccount = (name?: string, accountId?: string) => {
  if (!accountId && !name) return false;
  
  // ID 기반 우선 매칭 (acc_101, acc_103)
  if (accountId && CASH_ACCOUNT_IDS.includes(accountId)) return true;
  
  // 이름 기반 유연 매칭 (현금, 예금, 계좌, 보통)
  if (name && (
    name.includes('현금') || 
    name.includes('예금') || 
    name.includes('계좌') || 
    name.includes('보통') ||
    name === 'CASH'
  )) return true;
  
  return false;
};

// ✅ 월별 그룹핑 함수 (안전 버전)
const groupByMonth = (entries: JournalEntry[]) => {
  const map = new Map<string, JournalEntry[]>();

  entries.forEach((e) => {
    if (!e.date) return;
    const parts = e.date.split('-');
    if (parts.length < 2) return;
    const key = `${parts[0]}-${parts[1]}`; // YYYY-MM

    if (!map.has(key)) map.set(key, []);
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

  const monthly = groupByMonth(entries);

  // Financing 및 투자 구분 로직
  const isFinancing = (e: JournalEntry) => {
    const desc = e.description || "";
    const type = e.type || "";
    return (
      type === "Equity" ||
      type === "Funding" ||
      desc.includes("투자") ||
      desc.includes("유상증자") ||
      desc.includes("차입") ||
      desc.includes("대출") ||
      desc.includes("Capital")
    );
  };

  let cash = initialCash; 
  const result: { 
    date: string; 
    cash: number; 
    delta: number; 
    cashIn: number; 
    cashOut: number;
    operatingCashIn: number;
    financingCashIn: number;
  }[] = [];

  monthly.forEach((month) => {
    let monthlyIn = 0;
    let monthlyOut = 0;
    let monthlyOperatingIn = 0;
    let monthlyFinancingIn = 0;

    month.entries.forEach((e) => {
      // ✅ Debit: 현금 계정으로의 입금 (현금 증가)
      if (isCashAccount(e.debitAccount, e.debitAccountId)) {
        const amount = Number(e.amount) || 0;
        monthlyIn += amount;
        
        if (isFinancing(e)) {
          monthlyFinancingIn += amount;
        } else {
          monthlyOperatingIn += amount;
        }
      }

      // ✅ Credit: 현금 계정에서의 출금 (현금 감소)
      if (isCashAccount(e.creditAccount, e.creditAccountId)) {
        monthlyOut += (Number(e.amount) || 0);
      }

      // 복합 전표 처리 (있을 경우)
      if (e.complexLines && e.complexLines.length > 0) {
          e.complexLines.forEach(l => {
              if (isCashAccount(l.account, l.accountId)) {
                if (l.debit > 0) {
                  const amount = Number(l.debit) || 0;
                  monthlyIn += amount;
                  if (isFinancing(e)) monthlyFinancingIn += amount;
                  else monthlyOperatingIn += amount;
                }
                if (l.credit > 0) monthlyOut += (Number(l.credit) || 0);
              }
          });
      }
    });

    const delta = monthlyIn - monthlyOut;
    cash += delta;

    result.push({
      date: month.date,
      cash,
      delta,
      cashIn: monthlyIn,
      cashOut: monthlyOut,
      operatingCashIn: monthlyOperatingIn,
      financingCashIn: monthlyFinancingIn
    });
  });

  return result;
}
