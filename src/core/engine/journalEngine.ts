import { JournalEntry, LedgerLine } from '../../types';
import { getAccountMetadata } from '../coa';

/**
 * [IMMUTABLE ENGINE CORE] Journal Engine
 * Unrolls high-level Journal Entries into atomic Ledger Lines (Double Entry).
 * This is the ONLY bridge between Journal and Ledger.
 */
export const unrollJournalToLedger = (ledger: JournalEntry[], includeUnapproved = false): LedgerLine[] => {
    const lines: LedgerLine[] = [];
    const seenIds = new Set<string>();
    
    // Idempotency Guard: Ensure only unique Journal IDs are processed in a single batch
    const uniqueLedger = ledger.filter(entry => {
        if (seenIds.has(entry.id)) return false;
        seenIds.add(entry.id);
        return true;
    });

    uniqueLedger.forEach(entry => {
        if (!includeUnapproved && entry.status !== 'Approved') return;

        const base = entry.amount;
        const vat = entry.vat || 0;
        const total = base + vat;
        const scope = entry.scope || 'actual';

        const drMeta = getAccountMetadata(entry.debitAccount);
        const crMeta = getAccountMetadata(entry.creditAccount);

        const add = (acc: string, db: number, cr: number, accId?: string) => {
            lines.push({
                id: entry.id,
                date: entry.date,
                description: entry.description,
                account: acc,
                accountId: accId,
                debit: db,
                credit: cr,
                type: entry.type,
                scope,
                vendor: entry.vendor
            });
        };

        if (entry.complexLines && entry.complexLines.length > 0) {
            entry.complexLines.forEach(cl => {
                add(cl.account, cl.debit, cl.credit, cl.accountId);
            });
        } else {
            // Smart VAT Placement based on Account Nature (GPT Rule)
            // If Credit is Revenue -> Output VAT (Liability)
            // If Debit is Expense/Asset -> Input VAT (Asset)
            
            if (crMeta.nature === 'REVENUE' && vat > 0) {
                add(entry.debitAccount, total, 0, entry.debitAccountId); // DR Bank/AR
                add(entry.creditAccount, 0, base, entry.creditAccountId); // CR Revenue
                add('부가세예수금', 0, vat, 'acc_257'); // CR Output VAT
            } else if ((drMeta.nature === 'EXPENSE' || drMeta.nature === 'ASSET') && vat > 0) {
                add(entry.debitAccount, base, 0, entry.debitAccountId); // DR Expense/Asset
                add('부가세대급금', vat, 0, 'acc_135'); // DR Input VAT
                add(entry.creditAccount, 0, total, entry.creditAccountId); // CR Bank/AP
            } else {
                // Default non-VAT or simple transfer
                add(entry.debitAccount, total, 0, entry.debitAccountId);
                add(entry.creditAccount, 0, total, entry.creditAccountId);
            }
        }
    });
    
    return lines;
};
