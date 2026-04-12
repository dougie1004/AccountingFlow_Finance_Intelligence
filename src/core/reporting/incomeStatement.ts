import { TrialBalance, FinancialSummary } from '../../types';

/**
 * [IMMUTABLE ENGINE CORE] Financial Statement Mapping
 * Aggregates Trial Balance items into high-level metrics.
 * Rule: Based ONLY on Account Nature and Code.
 */
export const calculateFinancialsFromTB = (trialBalance: TrialBalance): FinancialSummary => {
    let cash = 0;
    let ar = 0;
    let openingAR = 0;
    let inventoryValue = 0;
    let openingInventory = 0;
    let fixedAssets = 0;
    let ap = 0;
    let openingAP = 0;
    let otherLiabilities = 0;
    let vatNet = 0;
    let operatingRevenue = 0;
    let grantRevenue = 0;
    let expenses = 0;

    Object.values(trialBalance).forEach((val) => {
        const nature = val.meta.nature;
        const name = val.meta.name;
        const code = val.meta.code;
        const bal = val.closingDebit - val.closingCredit; 
        const opBal = val.openingDebit - val.openingCredit;
        const periodBal = val.movementDebit - val.movementCredit;

        switch (nature) {
            case 'ASSET':
                // FIXED [SSOT v12]: Include all cash-equivalent accounts ( 현금, 보통예금, 당좌예금, 기타예금 )
                if (code === '101' || code === '102' || code === '103' || code === '106') cash += bal;
                else if (code === '108' || code === '120') { ar += bal; openingAR += opBal; }
                else if (code === '146') { inventoryValue += bal; openingInventory += opBal; }
                else if (code === '135') vatNet += bal; 
                else fixedAssets += bal;
                break;
            case 'LIABILITY':
                if (code === '251' || code === '253') { ap += -bal; openingAP += -opBal; }
                else if (code === '257') vatNet += bal; 
                else otherLiabilities += -bal;
                break;
            case 'REVENUE': 
                if (code === '403') grantRevenue += -periodBal;
                else operatingRevenue += -periodBal;
                break;
            case 'EXPENSE': expenses += periodBal; break;
        }
    });

    const revenue = operatingRevenue; // [CORRECTED] Revenue should only include core business operations
    const netIncome = (operatingRevenue + grantRevenue) - expenses; // Net income still includes grants as other income
    let accumulatedRetainedEarnings = 0;
    let shareCapital = 0;

    Object.values(trialBalance).forEach((val) => {
        if (val.meta.nature === 'EQUITY') {
            const bal = -(val.closingDebit - val.closingCredit); 
            if (val.meta.code === '351') accumulatedRetainedEarnings += bal;
            else shareCapital += bal;
        }
    });

    const totalRetainedEarnings = accumulatedRetainedEarnings + netIncome;
    const currentTotalEquity = shareCapital + totalRetainedEarnings;

    return {
        cash, 
        revenue, 
        operatingRevenue,
        grantRevenue,
        expenses, 
        ar, ap,
        fixedAssets, vatNet,
        netIncome, 
        capital: shareCapital, 
        retainedEarnings: totalRetainedEarnings,
        totalEquity: currentTotalEquity,
        inventoryValue,
        totalAssets: cash + ar + inventoryValue + fixedAssets + (vatNet > 0 ? vatNet : 0),
        totalLiabilities: ap + (vatNet < 0 ? -vatNet : 0) + otherLiabilities,
        deltaAR: ar - openingAR, 
        deltaAP: ap - openingAP, 
        deltaInventory: inventoryValue - openingInventory, 
        workingCapitalVariation: (openingAR - ar) + (ap - openingAP) + (openingInventory - inventoryValue),
        realAvailableCash: Math.max(0, cash - ap),
        totalGrantCash: grantRevenue 
    };
};
