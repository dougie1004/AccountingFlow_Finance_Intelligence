import { JournalEntry, SimulationResult, Asset, Order, InventoryItem, Partner, FundingEvent } from '../../types';
import { ScenarioConfig } from './scenarioConfigs';
import {
  resolveARPU,
  resolveVariableCost,
  resolveInjectionAmount,
  shouldInjectFunding,
  isRevenueActive,
  resolveMarketing
} from "../engine/scenarioResolver";
import { updateUsers } from '../engine/userEngine';

/**
 * [SSOT] Pricing Validation
 * Ensure mix and plans are valid.
 */
function assertPricing(config: ScenarioConfig) {
  if (!config.pricing) throw new Error("pricing missing");

  const { plans, mixTimeline } = config.pricing;

  if (!plans?.length) throw new Error("plans missing");
  if (!mixTimeline?.length) throw new Error("mixTimeline missing");

  mixTimeline.forEach((p: any) => {
    const sum = p.mix.reduce((a: number, b: number) => a + b, 0);
    if (Math.abs(sum - 1) > 0.001) {
      throw new Error(`Invalid mix sum at ${p.date}`);
    }
  });
}

/**
 * [SSOT] Config Validation
 * Fails fast if required financial parameters are missing.
 */
function assertConfig(config: ScenarioConfig) {
  if (!config) throw new Error("ScenarioConfig is required");
  assertPricing(config);
  if (!config.userModel?.baseCAC) throw new Error("Missing base CAC");
  if (!config.unitEconomics?.variableCostPerUser) throw new Error("Missing variable cost");
  if (!config.userModel?.baseChurn) throw new Error("Missing base churn rate");
  if (!config.fundingPolicy) throw new Error("Missing funding policy");
  if (!config.fixedCosts) throw new Error("Missing fixed costs");
  if (!config.revenuePolicy) throw new Error("Missing revenue policy");
  if (!config.marketingPolicy) throw new Error("Missing marketing policy");
}

/**
 * [IMMUTABLE ENGINE CORE] Journal Generator
 * Pure function that generates a stream of Journal Entries based on scenarios.
 * Rule: Only returns JournalEntry[], no engine calculation allowed inside.
 */
export const generateSystemWideMockData = (): SimulationResult => {
    // [CLEANUP] Removed 2025 legacy mock data with scope: 'actual'.
    // Initial data is now empty for clean session start.
    const ledger: JournalEntry[] = [];
    
    return {
        ledger,
        assets: [],
        orders: [],
        inventory: [],
        partners: [],
        adjustments: [],
        validationResults: [{ status: 'Success', message: 'System Baseline Initialized (Empty)' }],
        companyConfig: {
            tenantId: 'ENT-DEMO-001',
            isReadOnly: false,
            entityMetadata: {
                companyName: '(주)안티그래비티 테크놀로지',
                regId: '123-45-67890',
                repName: '홍길동',
                corpType: 'SME',
                fiscalYearEnd: '12-31',
                isStartupTaxBenefit: true,
                hasRDDept: true,
                hasRDLab: true
            },
            taxPolicy: {
                depreciationMethod: 'StraightLine',
                entertainmentLimitBase: 12000000,
                vatFilingCycle: 'Quarterly',
                aiGovernanceThreshold: 5000000
            }
        }
    };
};

export const generateMultiYearSimulation = (years: number[], cfg: ScenarioConfig): SimulationResult => {
    assertConfig(cfg);
    const base = generateSystemWideMockData();
    const ledger: JournalEntry[] = [];
    const partners: Partner[] = [];
    const assets: Asset[] = [];
    
    let currentUsers = 0;
    let currentCash = 0;
    const fundingEvents: FundingEvent[] = [];

    const addPartner = (name: string, type: 'Vendor'|'Customer'|'Employee') => {
        if (name === '-' || name === "" || partners.some(p => p.name === name)) return;
        partners.push({
             id: `p-${Math.random().toString(36).substring(2, 9)}`,
             name,
             partnerType: type,
             status: 'Approved',
             tags: ['Simulated']
        });
    };

    const addAsset = (name: string, cost: number, date: string, cat: string) => {
        assets.push({
            id: `a-${Math.random().toString(36).substring(2, 9)}`,
            name,
            acquisitionDate: date,
            cost: cost,
            depreciationMethod: 'STRAIGHT_LINE',
            usefulLife: cat === '무형자산' ? 10 : 5, 
            residualValue: 0,
            accumulatedDepreciation: 0,
            currentValue: cost
        });
    };

    // SSOT Resolvers
    const VARIABLE_COST_PER_USER = resolveVariableCost(cfg);

    let prevMonthRev = 0;

    years.forEach(year => {
        for (let month = 1; month <= 12; month++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-28`;
            const currentDate = new Date(dateStr);

            const isTargetMonth = year === 2026 && month === 5;
            if (isTargetMonth) {
                ledger.push({
                    id: `INIT-${year}-${month}`,
                    date: `${year}-05-02`,
                    description: '[CAPITAL] 사업 개시 초기 자본금 납입',
                    vendor: '대표자/창업팀',
                    debitAccount: '보통예금',
                    debitAccountId: 'acc_103',
                    creditAccount: '자본금',
                    creditAccountId: 'acc_301',
                    amount: cfg.initialCapital,
                    vat: 0,
                    type: 'Equity',
                    status: 'Approved'
                });
                addPartner('대표자/창업팀', 'Vendor');
                currentCash += cfg.initialCapital;
            }

            const isOperating = year > 2026 || (year === 2026 && month >= 5);
            const activeMkt = isOperating ? resolveMarketing(currentDate, cfg) : 0;
            const fixedMonthlyBurn = isOperating ? (cfg.fixedCosts.payroll + cfg.fixedCosts.rent + activeMkt) : 0;
            const projectedVariableBurn = currentUsers * VARIABLE_COST_PER_USER;
            const monthlyBurnForGuard = fixedMonthlyBurn + projectedVariableBurn;
            
            // [SSOT] Funding Policy Enforcement
            const shouldInject = shouldInjectFunding(currentCash, monthlyBurnForGuard, cfg);

            if (shouldInject) {
                const injectionAmt = resolveInjectionAmount(cfg);
                const preCash = currentCash;

                ledger.push({
                    id: `GUARD-${year}-${month}-${Math.random()}`,
                    date: dateStr,
                    description: '[CAPITAL] 유동성 위기 방지를 위한 긴급 증자 (Series Simulation)',
                    vendor: '창업팀/투자자',
                    debitAccount: '보통예금',
                    debitAccountId: 'acc_103',
                    creditAccount: '자본금',
                    creditAccountId: 'acc_351',
                    amount: injectionAmt,
                    vat: 0,
                    type: 'Equity',
                    status: 'Approved'
                });
                addPartner('창업팀/투자자', 'Vendor');
                currentCash += injectionAmt;

                fundingEvents.push({
                    date: dateStr,
                    amount: injectionAmt,
                    preCash: preCash,
                    postCash: currentCash
                });
            }

            // [GRANT] Phased Government Grant Execution (total 40M)
            const isGrantPhase1 = year === 2026 && month === 6 && cfg.hasGrant; // Agreement Phase
            const isGrantPhase2 = year === 2026 && month === 10 && cfg.hasGrant; // 2nd Tranche

            if (isGrantPhase1 || isGrantPhase2) {
                const grantTranche = 20000000; // 20M per phase
                const vatAmt = Math.floor(grantTranche * 0.1);

                // 1. Grant Revenue (Credit)
                ledger.push({
                    id: `GRANT-REV-${year}-${month}`,
                    date: dateStr,
                    description: `[VOUCHER] 정부보조금 바우처 집행 (${month}월분)`,
                    vendor: '한국디지털진흥원',
                    debitAccount: '지급수수료', // Standardizing from '서비스이용료(바우처)'
                    debitAccountId: 'acc_811',
                    creditAccount: '정부보조금수익',
                    creditAccountId: 'acc_403',
                    amount: grantTranche,
                    vat: 0,
                    type: 'Revenue',
                    status: 'Approved'
                });

                // 2. VAT Outflow (Only tax paid by company cash)
                ledger.push({
                    id: `GRANT-VAT-${year}-${month}`,
                    date: dateStr,
                    description: `[VOUCHER] 정부보조금 집행분 부가세 자부담`,
                    vendor: '서비스 파트너사',
                    debitAccount: '부가세대급금',
                    debitAccountId: 'acc_135',
                    creditAccount: '보통예금',
                    creditAccountId: 'acc_103',
                    amount: vatAmt,
                    vat: 0,
                    type: 'Expense',
                    status: 'Approved'
                });
                currentCash -= vatAmt;
            }

            if (cfg.bridgeDate && dateStr.startsWith(cfg.bridgeDate.substring(0, 7))) {
                ledger.push({
                    id: `BRIDGE-${year}`,
                    date: cfg.bridgeDate,
                    description: `[BRIDGE] 투자 유치`,
                    vendor: 'Investor',
                    debitAccount: '보통예금',
                    debitAccountId: 'acc_103',
                    creditAccount: '자본금',
                    creditAccountId: 'acc_301',
                    amount: cfg.bridgeCapital,
                    vat: 0,
                    type: 'Equity',
                    status: 'Approved'
                });
                currentCash += cfg.bridgeCapital;
            }

            const revenueActive = isRevenueActive(currentDate, cfg);
            
            let effectiveMkt = 0;
            if (isOperating) {
               // [SSOT] Growth Modeling with Revenue Re-investment
               const reinvestRatio = cfg.growthStrategy?.reinvestRatio || 0;
               effectiveMkt = activeMkt + (prevMonthRev * reinvestRatio);
               
               // [NEW V2] Dynamic growth calculation via Engine
               const userState = updateUsers(currentUsers, effectiveMkt, cfg.userModel);
               currentUsers = userState.users;
            }

            let monthlyRev = 0;
            let currentARPU = 0;

            if (revenueActive) {
                currentARPU = resolveARPU(currentDate, cfg);
                monthlyRev = currentUsers * currentARPU;
                const totalRevWithVat = monthlyRev + Math.floor(monthlyRev * 0.1);
                
                // [Accrual] 1. Revenue Recognition (Debit AR)
                const invoiceId = `REV-AR-${year}-${month}`;
                ledger.push({
                    id: invoiceId,
                    date: dateStr,
                    description: `[SaaS] 구독매출 채권 인식 (유저: ${currentUsers}명)`,
                    vendor: 'Global Customers',
                    debitAccount: '외상매출금',
                    debitAccountId: 'acc_108',
                    creditAccount: '상품매출',
                    creditAccountId: 'acc_401',
                    amount: monthlyRev,
                    vat: Math.floor(monthlyRev * 0.1),
                    type: 'Revenue',
                    status: 'Approved',
                    accountType: 'AR',
                    referenceId: invoiceId
                });

                // [Accrual] 2. Collection (85% Collection Rate)
                const collectedAmt = Math.floor(totalRevWithVat * 0.85);
                if (collectedAmt > 0) {
                    ledger.push({
                        id: `REV-COL-${year}-${month}`,
                        date: dateStr,
                        description: `[SETTLE] 매출 대금 회수 (회수율 85% 완료)`,
                        vendor: 'Payment Gateway',
                        debitAccount: '보통예금',
                        debitAccountId: 'acc_103',
                        creditAccount: '외상매출금',
                        creditAccountId: 'acc_108',
                        amount: collectedAmt,
                        vat: 0,
                        type: 'Revenue',
                        status: 'Approved',
                        accountType: 'AR',
                        referenceId: invoiceId // Match with Revenue ID
                    });
                    currentCash += collectedAmt;
                }

                const vCost = currentUsers * VARIABLE_COST_PER_USER;
                const totalCostWithVat = vCost + Math.floor(vCost * 0.1);

                // [Accrual] 3. Expense Recognition (Credit AP)
                const cogsId = `COGS-AP-${year}-${month}`;
                ledger.push({
                    id: cogsId,
                    date: dateStr,
                    description: '[COGS] AI API 비용 청구 (미지급)',
                    vendor: 'AWS/OpenAI',
                    debitAccount: '상품매출원가',
                    debitAccountId: 'acc_501',
                    creditAccount: '미지급금',
                    creditAccountId: 'acc_253',
                    amount: vCost,
                    vat: Math.floor(vCost * 0.1),
                    type: 'Expense',
                    status: 'Approved',
                    accountType: 'AP',
                    referenceId: cogsId
                });

                // [Accrual] 4. COGS Payment (Immediate for Cloud)
                ledger.push({
                    id: `COGS-PAY-${year}-${month}`,
                    date: dateStr,
                    description: '[SETTLE] AI API 비용 결제 완료',
                    vendor: 'AWS/OpenAI',
                    debitAccount: '미지급금',
                    debitAccountId: 'acc_253',
                    creditAccount: '보통예금',
                    creditAccountId: 'acc_103',
                    amount: totalCostWithVat,
                    vat: 0,
                    type: 'Expense',
                    status: 'Approved',
                    accountType: 'AP',
                    referenceId: cogsId
                });
                currentCash -= totalCostWithVat;
            }

            if (isOperating) {
                const elapsedYears = year - 2026;
                const activePayroll = Math.floor(cfg.fixedCosts.payroll * Math.pow(1 + cfg.annualWageGrowth, elapsedYears));
                const activeRent = cfg.fixedCosts.rent;

                // [Accrual] Payroll is immediate for sim
                ledger.push({ id: `PAY-${year}-${month}`, date: dateStr, description: `[PAY] 정기 인건비`, vendor: 'Staff', debitAccount: '급여', debitAccountId: 'acc_801', creditAccount: '보통예금', creditAccountId: 'acc_103', amount: activePayroll, vat: 0, type: 'Payroll', status: 'Approved' });
                currentCash -= activePayroll;

                const overheadAmt = Math.floor(activePayroll * 0.183);
                ledger.push({ id: `OH-${year}-${month}`, date: dateStr, description: `[EXP] 인건비 부대비용`, vendor: 'Staff Overhead', debitAccount: '세금과공과', debitAccountId: 'acc_817', creditAccount: '보통예금', creditAccountId: 'acc_103', amount: overheadAmt, vat: 0, type: 'Expense', status: 'Approved' });
                currentCash -= overheadAmt;
                
                if (activeRent > 0) {
                    const totalRent = activeRent + Math.floor(activeRent * 0.1);
                    const rentId = `RENT-AP-${year}-${month}`;
                    // [Accrual] Rent via AP (90% payment simulation)
                    ledger.push({ id: rentId, date: dateStr, description: `[RENT] 공간 임차료 청구`, vendor: 'Bldg', debitAccount: '임차료', debitAccountId: 'acc_816', creditAccount: '미지급금', creditAccountId: 'acc_253', amount: activeRent, vat: Math.floor(activeRent * 0.1), type: 'Expense', status: 'Approved', accountType: 'AP', referenceId: rentId });
                    
                    const payRent = Math.floor(totalRent * 0.9);
                    ledger.push({ id: `RENT-PAY-${year}-${month}`, date: dateStr, description: `[SETTLE] 임차료 결제 (90%)`, vendor: 'Bldg', debitAccount: '미지급금', debitAccountId: 'acc_253', creditAccount: '보통예금', creditAccountId: 'acc_103', amount: payRent, vat: 0, type: 'Expense', status: 'Approved', accountType: 'AP', referenceId: rentId });
                    currentCash -= payRent;
                }
                
                if (effectiveMkt > 0) {
                    const totalMkt = effectiveMkt + Math.floor(effectiveMkt * 0.1);
                    const mktId = `MKT-AP-${year}-${month}`;
                    // [Accrual] Marketing via AP (Legacy "Risk Exposure" simulation)
                    ledger.push({ id: mktId, date: dateStr, description: `[MKT] 마케팅비 청구`, vendor: 'Google/FB', debitAccount: '광고선전비', debitAccountId: 'acc_826', creditAccount: '미지급금', creditAccountId: 'acc_253', amount: effectiveMkt, vat: Math.floor(effectiveMkt * 0.1), type: 'Expense', status: 'Approved', accountType: 'AP', referenceId: mktId });
                    
                    const payMkt = Math.floor(totalMkt * 0.8); // 80% payment only to leave debt
                    ledger.push({ id: `MKT-PAY-${year}-${month}`, date: dateStr, description: `[SETTLE] 마케팅비 결제 (80% 우선집행)`, vendor: 'Google/FB', debitAccount: '미지급금', debitAccountId: 'acc_253', creditAccount: '보통예금', creditAccountId: 'acc_103', amount: payMkt, vat: 0, type: 'Expense', status: 'Approved', accountType: 'AP', referenceId: mktId });
                    currentCash -= payMkt;
                }
            }

            prevMonthRev = monthlyRev;
        }
    });

    return { ...base, ledger: [...base.ledger, ...ledger], partners, assets, fundingEvents };
};

export const simulateAIParsing = (entry: any): JournalEntry => ({
    id: crypto.randomUUID(),
    date: entry.date || new Date().toISOString().split('T')[0],
    description: entry.description || '',
    vendor: entry.vendor || 'Unknown',
    debitAccount: entry.debitAccount || '소모품비',
    creditAccount: entry.creditAccount || '보통예금',
    amount: entry.amount || 0,
    vat: entry.vat || 0,
    type: entry.type || 'Expense',
    status: 'Unconfirmed',
    version: 1
});
