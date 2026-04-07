import { JournalEntry } from '../../types';

export const CASH_ACCOUNT_IDENTIFIERS = ['현금', '보통예금', '당좌예금', '기타예금', '예금', 'cash', 'bank', '101', '102', '103', '106'];

/**
 * [SSOT] The ONLY true way to calculate actual cash from the ledger.
 * No scenarios, no projections, just pure approved ledger data.
 */
export const sumCashAccounts = (ledger: JournalEntry[], targetDate: string): number => {
    let balance = 0;
    ledger.forEach(e => {
        // [STRICT] Only process Approved (Authorized) entries for "Actual" cash
        if (e.status !== 'Approved') return;
        // Also ensure we are not accidentally processing scenario scope entries if they leaked into the global ledger
        if (e.scope && e.scope !== 'actual') return;
        
        if (e.date > targetDate) return;

        const isCashDebit = CASH_ACCOUNT_IDENTIFIERS.some(id => 
            e.debitAccount.toLowerCase().includes(id.toLowerCase()) || 
            (e.debitAccountId && e.debitAccountId.includes(id))
        );
        const isCashCredit = CASH_ACCOUNT_IDENTIFIERS.some(id => 
            e.creditAccount.toLowerCase().includes(id.toLowerCase()) || 
            (e.creditAccountId && e.creditAccountId.includes(id))
        );
        
        const total = e.amount + (e.vat || 0);

        if (isCashDebit) balance += total;
        if (isCashCredit) balance -= total;
    });
    return balance;
};
