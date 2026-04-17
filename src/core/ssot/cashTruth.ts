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
        
        // [V12.1] Simulation Support: If we are viewing a simulation, we WANT to sum its projected cash.
        // We only exclude if explicitly marked as something else, but 'actual', 'scenario', 'future' are allowed here
        // as the caller (AccountingContext) provides the relevant ledger slice.
        if (e.scope && e.scope !== 'actual' && e.scope !== 'scenario' && e.scope !== 'future') return;
        
        if (e.date > targetDate) return;

        // Support for Complex (Multi-line) Entries
        if (e.complexLines && e.complexLines.length > 0) {
            e.complexLines.forEach(line => {
                const isCash = CASH_ACCOUNT_IDENTIFIERS.some(id => 
                    (line.account?.toLowerCase() || '').includes(id.toLowerCase()) || 
                    (line.accountId && line.accountId.includes(id))
                );
                if (isCash) {
                    if (line.debit > 0) balance += line.debit;
                    if (line.credit > 0) balance -= line.credit;
                }
            });
        } else {
            // Standard Double-entry
            const isCashDebit = CASH_ACCOUNT_IDENTIFIERS.some(id => 
                (e.debitAccount?.toLowerCase() || '').includes(id.toLowerCase()) || 
                (e.debitAccountId && e.debitAccountId.includes(id))
            );
            const isCashCredit = CASH_ACCOUNT_IDENTIFIERS.some(id => 
                (e.creditAccount?.toLowerCase() || '').includes(id.toLowerCase()) || 
                (e.creditAccountId && e.creditAccountId.includes(id))
            );
            
            const total = (e.amount || 0) + (e.vat || 0);

            if (isCashDebit) balance += total;
            if (isCashCredit) balance -= total;
        }
    });
    return balance;
};
