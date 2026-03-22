import { LedgerLine, AccountDefinition, TrialBalanceItem, TrialBalance } from '../../types';
import { CHART_OF_ACCOUNTS, getAccountMetadata } from '../coa';

/**
 * [IMMUTABLE ENGINE CORE] Trial Balance Engine
 * The deterministic engine that converts Ledger Lines into a Trial Balance.
 * No description/text dependencies allowed.
 */
export const calculateTrialBalance = (
    ledgerLines: LedgerLine[], 
    periodStart: string,
    periodEnd: string,
    scope: 'actual' | 'scenario' | 'future' | 'all' = 'actual',
    coa: Record<string, AccountDefinition> = CHART_OF_ACCOUNTS
): TrialBalance => {
    const tb: Record<string, TrialBalanceItem> = {};
    let pastNetIncome = 0;

    // Pre-fill TB with all accounts using ID as key to ensure consistency
    Object.values(coa).forEach(meta => {
        const key = meta.id || meta.name;
        tb[key] = {
            openingDebit: 0, openingCredit: 0,
            movementDebit: 0, movementCredit: 0,
            closingDebit: 0, closingCredit: 0,
            meta
        };
    });

    ledgerLines.forEach(line => {
        if (scope !== 'all' && line.scope !== scope) return;
        if (line.date > periodEnd) return; 

        const key = line.accountId || line.account;

        if (!tb[key]) {
            let meta: AccountDefinition | undefined;
            if (line.accountId) {
                meta = Object.values(coa).find(a => a.id === line.accountId);
            }
            if (!meta) {
                meta = coa[line.account] || getAccountMetadata(line.account);
            }

            tb[key] = { 
                openingDebit: 0, openingCredit: 0, 
                movementDebit: 0, movementCredit: 0, 
                closingDebit: 0, closingCredit: 0,
                meta
            };
        }

        const item = tb[key];
        const nature = item.meta.nature;

        if (line.date < periodStart) {
            // [VIRTUAL CLOSING] Rollup past P&L items into Retained Earnings
            if (nature === 'REVENUE' || nature === 'EXPENSE') {
                pastNetIncome += (line.credit - line.debit); 
            } else {
                item.openingDebit += line.debit;
                item.openingCredit += line.credit;
            }
        } else {
            item.movementDebit += line.debit;
            item.movementCredit += line.credit;
        }
    });

    // Rollup past income into Retained Earnings (이익잉여금)
    const reId = 'acc_351';
    const reFallbackName = '이익잉여금';
    
    if (!tb[reId]) {
        const meta = Object.values(coa).find(a => a.id === reId) || coa[reFallbackName] || getAccountMetadata(reFallbackName);
        tb[reId] = { 
            openingDebit: 0, openingCredit: 0, 
            movementDebit: 0, movementCredit: 0, 
            closingDebit: 0, closingCredit: 0,
            meta
        };
    }
    const reItem = tb[reId];
    if (pastNetIncome > 0) reItem.openingCredit += pastNetIncome;
    else if (pastNetIncome < 0) reItem.openingDebit += Math.abs(pastNetIncome);

    // Calculate closing balances
    Object.values(tb).forEach(item => {
        const totalDebit = item.openingDebit + item.movementDebit;
        const totalCredit = item.openingCredit + item.movementCredit;
        const net = totalDebit - totalCredit;
        if (net > 0) {
            item.closingDebit = net;
            item.closingCredit = 0;
        } else {
            item.closingDebit = 0;
            item.closingCredit = Math.abs(net);
        }
    });

    return tb;
};
