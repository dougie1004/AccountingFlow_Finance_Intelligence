import { JournalEntry } from '../types';

/**
 * 🧭 SSOT 리스크 엔진 (v7 - Accounting-Sign Corrected)
 * 리스크 = [거래단위 + 기호보정] 잔액 합산 (AR/AP 분기)
 */

export const calculateRiskAmount = (
  ledger: JournalEntry[],
  now: Date
) => {
  const balanceMap: Record<string, number> = {};

  ledger.forEach(entry => {
    const entryDate = new Date(entry.date);
    if (entryDate > now) return;
    if (entry.scope === 'scenario' || entry.scope === 'future') return;

    // AR/AP만 리스크로 집계
    if (!['AR', 'AP'].includes(entry.accountType || '')) return;

    const monthKey = entry.date.slice(0, 7); // YYYY-MM
    const key = `${entry.referenceId || entry.vendor || 'global'}_${monthKey}`;
    
    let change = 0;
    
    // 🔥 [핵심 v7] 계정 타입 기준 기호 처리
    // JournalEntry의 debitAccount/creditAccount 기반으로 가상 debitAmount/creditAmount 추출
    const isDeAR = entry.debitAccount.includes('외상매출');
    const isCrAR = entry.creditAccount.includes('외상매출');
    const isCrAP = entry.creditAccount.includes('미지급') || entry.creditAccount.includes('외상매입');
    const isDeAP = entry.debitAccount.includes('미지급') || entry.debitAccount.includes('외상매입');

    if (entry.accountType === 'AR') {
      // 자산 (AR): 차변(+) 증가, 대변(-) 감소
      const d = isDeAR ? entry.amount : 0;
      const c = isCrAR ? entry.amount : 0;
      change = d - c;
    } else if (entry.accountType === 'AP') {
      // 부채 (AP): 대변(+) 증가, 차변(-) 감소
      const c = isCrAP ? entry.amount : 0;
      const d = isDeAP ? entry.amount : 0;
      change = c - d;
    }

    balanceMap[key] = (balanceMap[key] || 0) + change;
  });

  return Object.values(balanceMap).reduce((sum, balance) => {
    return sum + Math.abs(balance);
  }, 0);
};

export const calculateOverdueRisk = (
  ledger: JournalEntry[],
  now: Date
) => {
  const DAYS_90 = 90 * 24 * 60 * 60 * 1000;
  const balanceMap: Record<string, number> = {};

  ledger.forEach(entry => {
    if (entry.accountType !== 'AR') return; 
    
    const entryDate = new Date(entry.date);
    if (entryDate > now) return;
    if (entry.scope === 'scenario' || entry.scope === 'future') return;

    const diff = now.getTime() - entryDate.getTime();
    if (diff <= DAYS_90) return;

    const monthKey = entry.date.slice(0, 7);
    const key = `${entry.referenceId || entry.vendor || 'global'}_${monthKey}`;
    
    const d = entry.debitAccount.includes('외상매출') ? entry.amount : 0;
    const c = entry.creditAccount.includes('외상매출') ? entry.amount : 0;
    const change = d - c;
    
    balanceMap[key] = (balanceMap[key] || 0) + change;
  });

  return Object.values(balanceMap).reduce((sum, balance) => {
    return sum + Math.abs(balance);
  }, 0);
};

export const calculateUnmatchedRisk = (
  ledger: JournalEntry[],
  now: Date
) => {
  const balanceMap: Record<string, number> = {};

  ledger.forEach(entry => {
    if (!['AR', 'AP'].includes(entry.accountType || '')) return;
    if (entry.matchingStatus === 'matched') return;

    const entryDate = new Date(entry.date);
    if (entryDate > now) return;
    if (entry.scope === 'scenario' || entry.scope === 'future') return;

    const monthKey = entry.date.slice(0, 7);
    const key = `${entry.referenceId || entry.vendor || 'global'}_${monthKey}`;
    
    let change = 0;
    if (entry.accountType === 'AR') {
        const d = entry.debitAccount.includes('외상매출') ? entry.amount : 0;
        const c = entry.creditAccount.includes('외상매출') ? entry.amount : 0;
        change = d - c;
    } else {
        const c = (entry.creditAccount.includes('미지급') || entry.creditAccount.includes('외상매입')) ? entry.amount : 0;
        const d = (entry.debitAccount.includes('미지급') || entry.debitAccount.includes('외상매입')) ? entry.amount : 0;
        change = c - d;
    }

    balanceMap[key] = (balanceMap[key] || 0) + change;
  });

  return Object.values(balanceMap).reduce((sum, balance) => {
    return sum + Math.abs(balance);
  }, 0);
};

export const calculateProactiveCashRisk = (
  currentCash: number,
  monthlyBurn: number
) => {
  const threeMonthNeed = monthlyBurn * 3;
  return currentCash < threeMonthNeed ? threeMonthNeed - currentCash : 0;
};
