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
    
    // [V2.9] Accrual Settlement Tracking
    let pendingCollectionAR = 0;
    let pendingRentAP = 0;
    let pendingMarketingAP = 0;
    let pendingCogsAP = 0;

    years.forEach(year => {
        for (let month = 1; month <= 12; month++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-28`;
            const settlementDate = `${year}-${String(month).padStart(2, '0')}-05`; // Settle early in the month
            const currentDate = new Date(dateStr);

            // --- PHASE 1: SETTLEMENT OF PREVIOUS MONTH ---
            
            // 1. Collect AR (Revenue from last month)
            if (pendingCollectionAR > 0) {
                ledger.push({
                    id: `AR-COLLECT-${year}-${month}`,
                    date: settlementDate,
                    description: `[SETTLE] 전월 매출 대금 회수 완료 (카드/PG 정산)`,
                    vendor: 'Payment Gateway',
                    debitAccount: '보통예금',
                    debitAccountId: 'acc_103',
                    creditAccount: '외상매출금',
                    creditAccountId: 'acc_108',
                    amount: pendingCollectionAR,
                    vat: 0,
                    type: 'Revenue',
                    status: 'Approved'
                });
                currentCash += pendingCollectionAR;
                pendingCollectionAR = 0;
            }

            // 2. Pay Rent (from last month)
            if (pendingRentAP > 0) {
                ledger.push({
                    id: `RENT-PAID-${year}-${month}`,
                    date: settlementDate,
                    description: `[SETTLE] 전월 임차료 및 부가세 지급 완료`,
                    vendor: 'Bldg Management',
                    debitAccount: '미지급금',
                    debitAccountId: 'acc_253',
                    creditAccount: '보통예금',
                    creditAccountId: 'acc_103',
                    amount: pendingRentAP,
                    vat: 0,
                    type: 'Expense',
                    status: 'Approved'
                });
                currentCash -= pendingRentAP;
                pendingRentAP = 0;
            }

            // 3. Pay Marketing (from last month)
            if (pendingMarketingAP > 0) {
                ledger.push({
                    id: `MKT-PAID-${year}-${month}`,
                    date: settlementDate,
                    description: `[SETTLE] 전월 마케팅 집행 대금 결제 (Google/Meta)`,
                    vendor: 'Ad Agency',
                    debitAccount: '미지급금',
                    debitAccountId: 'acc_253',
                    creditAccount: '보통예금',
                    creditAccountId: 'acc_103',
                    amount: pendingMarketingAP,
                    vat: 0,
                    type: 'Expense',
                    status: 'Approved'
                });
                currentCash -= pendingMarketingAP;
                pendingMarketingAP = 0;
            }

            // 4. Pay COGS (from last month)
            if (pendingCogsAP > 0) {
                ledger.push({
                    id: `COGS-PAID-${year}-${month}`,
                    date: settlementDate,
                    description: `[SETTLE] 전월 인프라/API 사용료 결제 (AWS/OpenAI)`,
                    vendor: 'Infra Provider',
                    debitAccount: '미지급금',
                    debitAccountId: 'acc_253',
                    creditAccount: '보통예금',
                    creditAccountId: 'acc_103',
                    amount: pendingCogsAP,
                    vat: 0,
                    type: 'Expense',
                    status: 'Approved'
                });
                currentCash -= pendingCogsAP;
                pendingCogsAP = 0;
            }

            // --- PHASE 2: CURRENT MONTH RECOGNITION ---

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

                // [ASSET] Initial Equipment Acquisition (to trigger depreciation logic)
                const workstationCost = 5000000;
                const workstationVat = 500000;
                addAsset('워크스테이션', workstationCost, `${year}-05-02`, '비품');
                ledger.push({
                    id: `INIT-ASSET-${year}-${month}`,
                    date: `${year}-05-02`,
                    description: '[ASSET] 초기 서버급 워크스테이션 도입',
                    vendor: '델 테크놀로지스',
                    debitAccount: '비품',
                    debitAccountId: 'acc_212',
                    creditAccount: '보통예금',
                    creditAccountId: 'acc_103',
                    amount: workstationCost,
                    vat: workstationVat,
                    type: 'Asset',
                    status: 'Approved'
                });
                currentCash -= (workstationCost + workstationVat);
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
                // 1. Unified Voucher Entry (DR Expense + DR VAT / CR Grant + CR Bank)
                const grantTranche = 20000000; // 20M per phase
                const vatAmt = Math.floor(grantTranche * 0.1);

                ledger.push({
                    id: `GRANT-VOUCHER-${year}-${month}`,
                    date: dateStr,
                    description: `[VOUCHER] 정부보조금 바우처 집행 및 부가세 자부담`,
                    vendor: '서비스 파트너사',
                    amount: grantTranche,
                    vat: 0, // Manual complex lines
                    type: 'Revenue',
                    status: 'Approved',
                    debitAccount: '',
                    creditAccount: '',
                    complexLines: [
                        { account: '지급수수료', accountId: 'acc_825', debit: grantTranche, credit: 0 }, // Expense
                        { account: '부가세대급금', accountId: 'acc_135', debit: vatAmt, credit: 0 }, // Input VAT
                        { account: '정부보조금수익', accountId: 'acc_403', debit: 0, credit: grantTranche }, // Revenue
                        { account: '보통예금', accountId: 'acc_103', debit: 0, credit: vatAmt } // Cash Outflow for VAT
                    ]
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
               
               const userState = updateUsers(currentUsers, effectiveMkt, cfg.userModel);
               currentUsers = userState.users;
            }

            let monthlyRev = 0;
            let currentARPU = 0;

            if (revenueActive) {
                currentARPU = resolveARPU(currentDate, cfg);
                monthlyRev = currentUsers * currentARPU;
                const vatAmount = Math.floor(monthlyRev * 0.1);
                const totalRevWithVat = monthlyRev + vatAmount;
                
                // [Accrual] 1. Revenue Recognition (Debit AR)
                const invoiceId = `REV-AR-${year}-${month}`;
                ledger.push({
                    id: invoiceId,
                    date: dateStr,
                    description: `[SaaS] 구독매출 인식 (유저: ${currentUsers}명)`,
                    vendor: 'Global Customers',
                    debitAccount: '외상매출금',
                    debitAccountId: 'acc_108',
                    creditAccount: '상품매출',
                    creditAccountId: 'acc_401',
                    amount: monthlyRev,
                    vat: vatAmount,
                    type: 'Revenue',
                    status: 'Approved',
                    accountType: 'AR',
                    referenceId: invoiceId
                });

                // Store for settlement in M+1
                pendingCollectionAR = totalRevWithVat;

                const vCost = currentUsers * VARIABLE_COST_PER_USER;
                const vVat = Math.floor(vCost * 0.1);
                const totalCostWithVat = vCost + vVat;

                // [Accrual] 2. Expense Recognition (Credit AP)
                const cogsId = `COGS-AP-${year}-${month}`;
                ledger.push({
                    id: cogsId,
                    date: dateStr,
                    description: '[COGS] AI 인프라 사용료 (미지급)',
                    vendor: 'AWS/OpenAI',
                    debitAccount: '상품매출원가',
                    debitAccountId: 'acc_501',
                    creditAccount: '미지급금',
                    creditAccountId: 'acc_253',
                    amount: vCost,
                    vat: vVat,
                    type: 'Expense',
                    status: 'Approved',
                    accountType: 'AP',
                    referenceId: cogsId
                });

                // Store for settlement in M+1
                pendingCogsAP = totalCostWithVat;
            }

            if (isOperating) {
                const elapsedYears = year - 2026;
                const activePayroll = Math.floor(cfg.fixedCosts.payroll * Math.pow(1 + cfg.annualWageGrowth, elapsedYears));
                const activeRent = cfg.fixedCosts.rent;

                // Payroll remains immediate as per business standard
                ledger.push({ id: `PAY-${year}-${month}`, date: dateStr, description: `[PAY] 당월 급여 지급`, vendor: 'Staff', debitAccount: '급여', debitAccountId: 'acc_801', creditAccount: '보통예금', creditAccountId: 'acc_103', amount: activePayroll, vat: 0, type: 'Payroll', status: 'Approved' });
                currentCash -= activePayroll;

                const overheadAmt = Math.floor(activePayroll * 0.183);
                ledger.push({ id: `OH-${year}-${month}`, date: dateStr, description: `[EXP] 4대보험 및 제세공과금`, vendor: 'Staff Overhead', debitAccount: '세금과공과', debitAccountId: 'acc_815', creditAccount: '보통예금', creditAccountId: 'acc_103', amount: overheadAmt, vat: 0, type: 'Expense', status: 'Approved' });
                currentCash -= overheadAmt;
                
                // [DEPRECIATION] Monthly entry for assets
                if (assets.length > 0) {
                    let totalDep = 0;
                    assets.forEach(a => {
                        const monthlyDep = Math.floor(a.cost / (a.usefulLife * 12));
                        totalDep += monthlyDep;
                    });
                    
                    if (totalDep > 0) {
                        ledger.push({
                            id: `DEP-${year}-${month}`,
                            date: dateStr,
                            description: '[EXP] 당월 비유동자산 감가상각 인식',
                            vendor: 'Internal',
                            debitAccount: '감가상각비',
                            debitAccountId: 'acc_831',
                            creditAccount: '감가상각누계액',
                            creditAccountId: 'acc_213',
                            amount: totalDep,
                            vat: 0,
                            type: 'Expense',
                            status: 'Approved'
                        });
                    }
                }

                if (activeRent > 0) {
                    const rVat = Math.floor(activeRent * 0.1);
                    const totalRentWithVat = activeRent + rVat;
                    const rentId = `RENT-AP-${year}-${month}`;
                    
                    // Recognition
                    ledger.push({ id: rentId, date: dateStr, description: `[RENT] 사무실 임차료 청구`, vendor: 'Bldg', debitAccount: '임차료', debitAccountId: 'acc_816', creditAccount: '미지급금', creditAccountId: 'acc_253', amount: activeRent, vat: rVat, type: 'Expense', status: 'Approved', accountType: 'AP', referenceId: rentId });
                    
                    // Store for M+1
                    pendingRentAP = totalRentWithVat;
                }
                
                if (effectiveMkt > 0) {
                    const mVat = Math.floor(effectiveMkt * 0.1);
                    const totalMktWithVat = effectiveMkt + mVat;
                    const mktId = `MKT-AP-${year}-${month}`;
                    
                    // Recognition
                    ledger.push({ id: mktId, date: dateStr, description: `[MKT] 마케팅 광고 집행비 인식`, vendor: 'Ad Partners', debitAccount: '광고선전비', debitAccountId: 'acc_826', creditAccount: '미지급금', creditAccountId: 'acc_253', amount: effectiveMkt, vat: mVat, type: 'Expense', status: 'Approved', accountType: 'AP', referenceId: mktId });
                    
                    // Store for M+1
                    pendingMarketingAP = totalMktWithVat;
                }

                // [VAT SETTLEMENT] Quarterly (Jan, Apr, Jul, Oct 25th)
                const isVatMonth = [1, 4, 7, 10].includes(month);
                if (isVatMonth) {
                    // Simplifying for simulation: Move Net VAT to Cash
                    // In real scenario, it should analyze previous quarter's VAT accounts
                    // Here we just simulate a chunk based on revenue
                    const vatSettlementDate = `${year}-${String(month).padStart(2, '0')}-25`;
                    const estimatedVatPayment = Math.floor((monthlyRev - (effectiveMkt + (currentUsers * VARIABLE_COST_PER_USER))) * 0.1);
                    
                    if (estimatedVatPayment > 0) {
                        ledger.push({
                            id: `VAT-FILING-${year}-${month}`,
                            date: vatSettlementDate,
                            description: `[TAX] 분기 부가세 정산 납부`,
                            vendor: 'National Tax Service',
                            debitAccount: '부가세예수금',
                            debitAccountId: 'acc_257',
                            creditAccount: '보통예금',
                            creditAccountId: 'acc_103',
                            amount: estimatedVatPayment,
                            vat: 0,
                            type: 'Expense',
                            status: 'Approved'
                        });
                        currentCash -= estimatedVatPayment;
                    }
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
