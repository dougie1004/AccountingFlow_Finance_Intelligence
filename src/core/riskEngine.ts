import { JournalEntry } from '../types';

/**
 * 🧭 SSOT 리스크 엔진 (v14 - Dual-Insight AI Engine)
 * 원칙: 원본 장부의 '신성불가침(Immutability)'을 지키면서, AI가 실질적인 '상계 통찰'을 제공한다.
 */

interface VendorBalance {
    grossBalance: number; // 꼬리표(Matching)가 없는 모든 발생 전표의 합
    netBalance: number;   // 계정 내부의 모든 전표를 합산한 순 실질 잔액 (BS와 일치)
    oldestDate: Date;
    count: number;
}

const getVendorBalances = (ledger: JournalEntry[], now: Date, accountType: 'AR' | 'AP') => {
    const balances: Record<string, VendorBalance> = {};

    ledger.forEach(e => {
        const eDate = new Date(e.date);
        if (eDate > now) return;
        if (e.scope === 'future') return; // 시뮬레이션 중 미래 데이터 제외
        
        const currentAccType = (e.accountType || '').toUpperCase();
        if (currentAccType !== accountType) return;

        const totalAmount = e.amount + (e.vat || 0);
        const key = e.referenceId || e.vendor || 'global';
        
        const dAcc = (e.debitAccount || "").toLowerCase();
        const cAcc = (e.creditAccount || "").toLowerCase();
        const dId = (e.debitAccountId || "").toLowerCase();
        const cId = (e.creditAccountId || "").toLowerCase();

        if (!balances[key]) {
            balances[key] = { grossBalance: 0, netBalance: 0, oldestDate: eDate, count: 0 };
        }

        let delta = 0;
        let isInvoice = false;

        if (accountType === 'AR') {
            const isARAccount = (name: string, id: string) => 
                name.includes('매출채권') || name.includes('외상매출') || name.includes('미수') || id.includes('acc_108') || id.includes('acc_120');

            if (isARAccount(dAcc, dId)) { delta += totalAmount; isInvoice = true; }
            if (isARAccount(cAcc, cId)) { delta -= totalAmount; isInvoice = false; }
        } else {
            const isAPAccount = (name: string, id: string) => 
                name.includes('매입채무') || name.includes('외상매입') || name.includes('미지급') || id.includes('acc_251') || id.includes('acc_253');

            if (isAPAccount(cAcc, cId)) { delta += totalAmount; isInvoice = true; }
            if (isAPAccount(dAcc, dId)) { delta -= totalAmount; isInvoice = false; }
        }

        if (delta !== 0) {
            // 💡 Net Balance: 무조건 합산 (재무상태표-BS 논리)
            balances[key].netBalance += delta;
            
            // 💡 Gross Balance (Unmatched): 매칭되지 않은 '발생(Invoice)' 전표만 합산 (관리 논리)
            if (isInvoice && e.matchingStatus !== 'matched') {
                balances[key].grossBalance += delta;
            }

            if (eDate < balances[key].oldestDate) balances[key].oldestDate = eDate;
            if (isInvoice) balances[key].count++;
        }
    });

    return balances;
};

/**
 * [v14] 통합 리스크 분석 결과 (정밀 분리)
 */
export const calculateComprehensiveRisk = (ledger: JournalEntry[], now: Date) => {
    const arMap = getVendorBalances(ledger, now, 'AR');
    const apMap = getVendorBalances(ledger, now, 'AP');

    const sum = (map: Record<string, VendorBalance>, type: 'gross' | 'net') => 
        Object.values(map).reduce((s, b) => {
            const val = type === 'gross' ? b.grossBalance : b.netBalance;
            return val > 100 ? s + val : s;
        }, 0);

    const overdue = (map: Record<string, VendorBalance>, days: number) => {
        const threshold = days * 24 * 60 * 60 * 1000;
        let amount = 0;
        let count = 0;
        Object.values(map).forEach(b => {
            const diff = now.getTime() - b.oldestDate.getTime();
            // 💡 실질 연차 리스크는 Net Balance(실질 잔액)를 기준으로 산정한다.
            if (b.netBalance > 100 && diff > threshold) {
                amount += b.netBalance;
                count++;
            }
        });
        return { amount, count };
    };

    return {
        ar: {
            gross: sum(arMap, 'gross'),
            net: sum(arMap, 'net'), // 재무상태표(BS) 외상매출금과 일치해야 함
            overdue30: overdue(arMap, 30)
        },
        ap: {
            gross: sum(apMap, 'gross'),
            net: sum(arMap, 'net'), // (주의) 위 로직 오타 방지: apMap 사용
            netReal: sum(apMap, 'net'), 
            overdue30: overdue(apMap, 30)
        }
    };
};

// --- Legacy Compatibility Wrappers (for Reporter/UI) ---

export const calculateUnmatchedRisk = (ledger: JournalEntry[], now: Date) => {
    const res = calculateComprehensiveRisk(ledger, now);
    return res.ar.gross + res.ap.gross; // 원본 장부의 '미결제' 총액 (사용자가 정산 처리를 해야 할 총량)
};

export const calculateSplitOverdueRisk = (ledger: JournalEntry[], now: Date) => {
    const res = calculateComprehensiveRisk(ledger, now);
    return {
        arAmount: res.ar.overdue30.amount,
        arCount: res.ar.overdue30.count,
        apAmount: res.ap.overdue30.amount,
        apCount: res.ap.overdue30.count
    };
};

export const calculateProactiveCashRisk = (currentCash: number, monthlyBurn: number, totalPayablesFromBS: number) => {
  const needed = monthlyBurn * 3;
  const netLiquidity = currentCash - totalPayablesFromBS;
  const deficit = needed - netLiquidity;
  return deficit > 0 ? deficit : 0;
};
