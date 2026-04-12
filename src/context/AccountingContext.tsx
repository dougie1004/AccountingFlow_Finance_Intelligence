import React, { createContext, useState, useMemo, ReactNode, useEffect, useCallback } from 'react';
import { JournalEntry, Partner, SimulationResult, Asset, TenantConfig, InventoryItem, Order, FinancialSummary, ParsedTransaction, LedgerLine, TrialBalance, AccountDefinition, MacroAssumptions, AiChatMessage } from '../types';
import { calculateTrialBalance, calculateFinancialsFromTB, unrollJournalToLedger, generateMultiYearSimulation } from '../core/engine';
import { sumCashAccounts } from '../core/ssot/cashTruth';
import { CHART_OF_ACCOUNTS } from '../core/coa';
import { ALL_ACCOUNTS, MASTER_ACCOUNTS } from '../constants/accounts';
import { supabase } from '../lib/supabaseClient';

export interface AccountingContextType {
    ledger: JournalEntry[];
    partners: Partner[];
    addEntry: (entry: JournalEntry) => void;
    addPartner: (partner: Partner) => void;
    updatePartner: (id: string, updates: Partial<Partner>) => void;
    financials: FinancialSummary;
    loadSimulation: (result: Partial<SimulationResult>) => void;
    approvePartner: (partner: Partner) => Promise<void>;
    approveEntry: (id: string) => void;
    bulkApprove: (ids: string[]) => void;
    holdEntry: (id: string) => void;
    addEntries: (entries: JournalEntry[]) => void;
    updateEntry: (id: string, updates: Partial<JournalEntry>) => void;
    attachEvidence: (id: string, url: string) => void;
    processBulkTax: () => void;
    acceptVatSuggestion: (id: string) => void;
    deleteEntry: (id: string) => void;
    assets: Asset[];
    addAsset: (asset: Asset) => void;
    deleteAsset: (id: string) => void;
    updateInventory: (id: string, updates: Partial<InventoryItem>) => void;
    scmOrders: Order[];
    addScmOrder: (order: Order) => void;
    updateScmOrder: (id: string, updates: Partial<Order>) => void;
    resetData: () => void;
    stagingTransactions: ParsedTransaction[];
    setStagingTransactions: (txs: ParsedTransaction[]) => void;
    config: TenantConfig;
    updateConfig: (updates: Partial<TenantConfig>) => void;
    subLedger: LedgerLine[]; 
    inventory: InventoryItem[];
    transactions: JournalEntry[];
    finalizedMonths: Record<string, 'soft' | 'hard'>;
    performClosing: (month: string, type: 'soft' | 'hard') => void;
    reopenMonth: (month: string) => void;
    activeTab: string;
    selectedDate: string;
    setSelectedDate: (date: string) => void;
    setTab: (tab: string) => void;
    trialBalance: TrialBalance;
    accounts: Record<string, AccountDefinition>;
    addAccount: (acc: AccountDefinition) => void;
    updateAccount: (name: string, updates: Partial<AccountDefinition>) => void;
    accountingLedger: LedgerLine[]; 
    calculateTBForRange: (start: string, end: string, scope?: 'actual' | 'scenario') => TrialBalance;
    isPeriodLocked: (date: string) => boolean;
    isDev: boolean;
    allLinesLedger: LedgerLine[];
    companyKnowledge: string;
    updateCompanyKnowledge: (knowledge: string) => void;
    // [V2.6] Session Persistence for Metrics & Scenarios
    baselineSnapshot: { date: string; hash: string; ledger: JournalEntry[]; macro?: MacroAssumptions } | null;
    setBaselineSnapshot: (snapshot: any) => void;
    scenarioResults: JournalEntry[];
    setScenarioResults: (results: JournalEntry[]) => void;
    baselineEntries: JournalEntry[];
    setBaselineEntries: (entries: JournalEntry[]) => void;
    baselineTimestamp: number | null;
    setBaselineTimestamp: (time: number | null) => void;

    // [V2.6] Strategic Compass Persistence
    revenueMult: number;
    setRevenueMult: (val: number) => void;
    expenseMult: number;
    setExpenseMult: (val: number) => void;
    fixedCostDelta: number;
    setFixedCostDelta: (val: number) => void;
    preMoneyValuation: number;
    setPreMoneyValuation: (val: number) => void;
    projectionMonths: number;
    setProjectionMonths: (val: number) => void;
    macro: MacroAssumptions;
    setMacro: (val: MacroAssumptions) => void;
    founderInitialOwnership: number;
    setFounderInitialOwnership: (val: number) => void;
    investmentAmount: number;
    setInvestmentAmount: (val: number) => void;
    aiMessages: AiChatMessage[];
    setAiMessages: (msgs: AiChatMessage[] | ((prev: AiChatMessage[]) => AiChatMessage[])) => void;
    clearAiMessages: () => void;
}

export const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

const INITIAL_DATA: JournalEntry[] = [];

export const AccountingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const isDev = !(import.meta as any).env.PROD;
    const isInitialLoad = React.useRef(true);
    const [ledger, setLedger] = useState<JournalEntry[]>(() => {
        const saved = localStorage.getItem('accounting_ledger_v3');
        return saved ? JSON.parse(saved) : INITIAL_DATA;
    });
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState<Partner[]>(() => {
        const saved = localStorage.getItem('accounting_partners');
        return saved ? JSON.parse(saved) : [];
    });
    const [assets, setAssets] = useState<Asset[]>(() => {
        const saved = localStorage.getItem('accounting_assets');
        return saved ? JSON.parse(saved) : [];
    });
    const [inventory, setInventory] = useState<InventoryItem[]>(() => {
        const saved = localStorage.getItem('accounting_inventory');
        return saved ? JSON.parse(saved) : [];
    });
    const [scmOrders, setScmOrders] = useState<Order[]>(() => {
        const saved = localStorage.getItem('accounting_scm_orders');
        return saved ? JSON.parse(saved) : [];
    });
    const [stagingTransactions, setStagingTransactions] = useState<ParsedTransaction[]>(() => {
        const saved = localStorage.getItem('accounting_staging_txs');
        return saved ? JSON.parse(saved) : [];
    });
    const [finalizedMonths, setFinalizedMonths] = useState<Record<string, 'soft' | 'hard'>>(() => {
        const saved = localStorage.getItem('accounting_finalized_months');
        return saved ? JSON.parse(saved) : {};
    });
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [accounts, setAccounts] = useState<Record<string, AccountDefinition>>(() => {
        // [Integrity Sync] Merge core COA with all master accounts for maximum coverage
        const initial = { ...CHART_OF_ACCOUNTS };
        ALL_ACCOUNTS.forEach(acc => {
            if (!initial[acc.name]) {
                const nature = (Object.keys(MASTER_ACCOUNTS).find(k => (MASTER_ACCOUNTS as any)[k].some((a: any) => a.code === acc.code)) || 'EXPENSE') as any;
                initial[acc.name] = {
                    id: `acc_${acc.code}`,
                    code: acc.code,
                    name: acc.name,
                    nature,
                    statement: ['ASSET', 'LIABILITY', 'EQUITY'].includes(nature) ? 'BS' : 'PL',
                    section: '기본 계정',
                    group: '표준 계정과목'
                };
            }
        });
        return initial;
    });
    const [activeTab, setTab] = useState<string>('dashboard');
    const [companyKnowledge, setCompanyKnowledge] = useState<string>(() => {
        return localStorage.getItem('accounting_company_knowledge') || 
               "표준 회계 정책: 모든 지출은 적격증빙을 지향하며, 접대비는 한도를 준수함. 계약서에 명시되지 않은 비용은 집행 전 CFO 승인을 득해야 함.";
    });

    // [V2.6] Session Persistence (SURVIVES TAB NAVIGATION & REFRESH)
    const [baselineSnapshot, setBaselineSnapshotState] = useState<{ date: string; hash: string; ledger: JournalEntry[]; macro?: MacroAssumptions } | null>(() => {
        const saved = localStorage.getItem('accounting_baseline_snapshot');
        return saved ? JSON.parse(saved) : null;
    });
    const setBaselineSnapshot = (val: any) => {
        setBaselineSnapshotState(val);
        localStorage.setItem('accounting_baseline_snapshot', JSON.stringify(val));
    };

    const [scenarioResults, setScenarioResultsState] = useState<JournalEntry[]>(() => {
        const saved = localStorage.getItem('accounting_scenario_results');
        return saved ? JSON.parse(saved) : [];
    });
    const setScenarioResults = (val: JournalEntry[]) => {
        setScenarioResultsState(val);
        localStorage.setItem('accounting_scenario_results', JSON.stringify(val));
    };

    const [baselineEntries, setBaselineEntriesState] = useState<JournalEntry[]>(() => {
        const saved = localStorage.getItem('accounting_baseline_entries');
        return saved ? JSON.parse(saved) : [];
    });
    const setBaselineEntries = (val: JournalEntry[]) => {
        setBaselineEntriesState(val);
        localStorage.setItem('accounting_baseline_entries', JSON.stringify(val));
    };

    const [baselineTimestamp, setBaselineTimestampState] = useState<number | null>(() => {
        const saved = localStorage.getItem('accounting_baseline_timestamp');
        return saved ? parseInt(saved) : null;
    });
    const setBaselineTimestamp = (val: number | null) => {
        setBaselineTimestampState(val);
        if (val) localStorage.setItem('accounting_baseline_timestamp', val.toString());
        else localStorage.removeItem('accounting_baseline_timestamp');
    };

    // [V2.6] Strategic Compass Persistence States
    const [revenueMult, setRevenueMultState] = useState(() => Number(localStorage.getItem('accounting_revenue_mult')) || 1.0);
    const setRevenueMult = (v: number) => { setRevenueMultState(v); localStorage.setItem('accounting_revenue_mult', v.toString()); };

    const [expenseMult, setExpenseMultState] = useState(() => Number(localStorage.getItem('accounting_expense_mult')) || 1.0);
    const setExpenseMult = (v: number) => { setExpenseMultState(v); localStorage.setItem('accounting_expense_mult', v.toString()); };

    const [fixedCostDelta, setFixedCostDeltaState] = useState(() => Number(localStorage.getItem('accounting_fixed_delta')) || 0);
    const setFixedCostDelta = (v: number) => { setFixedCostDeltaState(v); localStorage.setItem('accounting_fixed_delta', v.toString()); };

    const [preMoneyValuation, setPreMoneyValuationState] = useState(() => Number(localStorage.getItem('accounting_pre_money')) || 500000000);
    const setPreMoneyValuation = (v: number) => { setPreMoneyValuationState(v); localStorage.setItem('accounting_pre_money', v.toString()); };

    const [projectionMonths, setProjectionMonthsState] = useState(() => Number(localStorage.getItem('accounting_projection_months')) || 36);
    const setProjectionMonths = (v: number) => { setProjectionMonthsState(v); localStorage.setItem('accounting_projection_months', v.toString()); };

    const [macro, setMacroState] = useState<MacroAssumptions>(() => {
        const saved = localStorage.getItem('accounting_macro');
        return saved ? JSON.parse(saved) : {
            inflationRate: 0.03,
            wageGrowthRate: 0.05,
            otherExpenseGrowth: 0.02,
            revenueNaturalGrowth: 0.01
        };
    });
    const setMacro = (v: MacroAssumptions) => { setMacroState(v); localStorage.setItem('accounting_macro', JSON.stringify(v)); };

    const [founderInitialOwnership, setFounderInitialOwnershipState] = useState(() => Number(localStorage.getItem('accounting_founder_owner')) || 1.0);
    const setFounderInitialOwnership = (v: number) => { setFounderInitialOwnershipState(v); localStorage.setItem('accounting_founder_owner', v.toString()); };

    const [investmentAmount, setInvestmentAmountState] = useState(() => Number(localStorage.getItem('accounting_invest_amount')) || 0);
    const setInvestmentAmount = (v: number) => { setInvestmentAmountState(v); localStorage.setItem('accounting_invest_amount', v.toString()); };

    // [V2.7] AI Chat Persistence
    const DEFAULT_AI_MSG: AiChatMessage = {
        role: "bot",
        content: "반갑습니다. AccountingFlow의 AI CFO 보좌관입니다. 실시간 장부 데이터를 분석하여 경영 의사결정에 필요한 핵심 요약과 리스크 진단을 제공합니다. 궁금하신 경영 지표가 있으신가요?"
    };

    const [aiMessages, setAiMessagesState] = useState<AiChatMessage[]>(() => {
        const saved = localStorage.getItem('accounting_ai_messages');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved AI messages:", e);
                return [DEFAULT_AI_MSG];
            }
        }
        return [DEFAULT_AI_MSG];
    });

    const setAiMessages = (msgsOrFn: AiChatMessage[] | ((prev: AiChatMessage[]) => AiChatMessage[])) => {
        setAiMessagesState(prev => {
            const next = typeof msgsOrFn === 'function' ? msgsOrFn(prev) : msgsOrFn;
            localStorage.setItem('accounting_ai_messages', JSON.stringify(next));
            return next;
        });
    };

    const clearAiMessages = () => {
        setAiMessages([DEFAULT_AI_MSG]);
    };

    const [config, setConfig] = useState<TenantConfig>({
        tenantId: 'default-tenant',
        isReadOnly: false,
        taxPolicy: {
            depreciationMethod: 'StraightLine',
            entertainmentLimitBase: 12000000,
            vatFilingCycle: 'Quarterly',
            aiGovernanceThreshold: 1000000, // 1M KRW Asset Threshold
            insuranceRates: {
                nationalPension: 0.045,
                healthInsurance: 0.03545,
                longTermCare: 0.1295, // Within health
                employmentInsuranceEmployee: 0.009,
                employmentInsuranceEmployer: 0.0115,
            },
            defaultLeaseRate: 0.072
        }
    });

    const isPeriodLocked = useCallback((date: string) => {
        const monthKey = date.slice(0, 7);
        return !!finalizedMonths[monthKey];
    }, [finalizedMonths]);

    const addEntry = (entry: JournalEntry) => {
        if (isPeriodLocked(entry.date)) {
            alert(`[PERIOD LOCKED] ${entry.date.slice(0, 7)} 기간은 이미 결산되었습니다. 새로운 전표를 입력할 수 없습니다.`);
            return;
        }
        // Enforce ID preservation or mapping on creation
        const debitId = entry.debitAccountId || Object.values(accounts).find(a => a.name === entry.debitAccount)?.id;
        const creditId = entry.creditAccountId || Object.values(accounts).find(a => a.name === entry.creditAccount)?.id;
        
        const enriched = { 
            ...entry, 
            status: entry.status || 'Unconfirmed',
            debitAccountId: debitId,
            creditAccountId: creditId,
            complexLines: entry.complexLines?.map(cl => ({
                ...cl,
                accountId: cl.accountId || Object.values(accounts).find(a => a.name === cl.account)?.id
            }))
        };
        setLedger((prev) => [...prev, enriched]);
    };

    const addEntries = (entries: JournalEntry[]) => {
        // Filter out entries in locked periods
        const validEntries = entries.filter(e => {
            if (isPeriodLocked(e.date)) {
                console.warn(`[PERIOD LOCKED] Skipping entry ${e.id} due to closed period ${e.date.slice(0, 7)}`);
                return false;
            }
            return true;
        });
        
        if (validEntries.length === 0 && entries.length > 0) {
            alert("입력한 모든 전표의 기간이 마감되어 있어 처리가 중단되었습니다.");
            return;
        }

        const enriched = validEntries.map(e => {
            const debitId = e.debitAccountId || Object.values(accounts).find(a => a.name === e.debitAccount)?.id;
            const creditId = e.creditAccountId || Object.values(accounts).find(a => a.name === e.creditAccount)?.id;
            
            return {
                ...e,
                status: e.status || 'Unconfirmed',
                ledgerType: e.ledgerType || 'Candidate',
                auditTrail: e.auditTrail || [],
                debitAccountId: debitId,
                creditAccountId: creditId,
                complexLines: e.complexLines?.map(cl => ({
                    ...cl,
                    accountId: cl.accountId || Object.values(accounts).find(a => a.name === cl.account)?.id
                }))
            };
        });
        setLedger((prev) => [...prev, ...enriched]);
    };

    const addPartner = (partner: Partner) => {
        setPartners(prev => [...prev, partner]);
    };

    const updatePartner = (id: string, updates: Partial<Partner>) => {
        setPartners(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    };

    const migrateLedgerToIds = useCallback(() => {
        setLedger(prev => {
            let changed = false;
            const migrated = prev.map(entry => {
                const needsMigration = !entry.debitAccountId || !entry.creditAccountId || 
                    (entry.complexLines?.some(cl => !cl.accountId));
                
                if (!needsMigration) return entry;
                
                const newEntry = { ...entry };
                const findAcc = (name: string | undefined) => {
                    if (!name) return undefined;
                    const cleanName = name.trim();
                    // Direct match
                    if (accounts[cleanName]) return accounts[cleanName].id;
                    // Fuzzy match (normalize whitespace)
                    return Object.values(accounts).find(a => a.name.trim() === cleanName)?.id;
                };

                if (!entry.debitAccountId) {
                    const id = findAcc(entry.debitAccount);
                    if (id) {
                        newEntry.debitAccountId = id;
                        changed = true;
                    }
                }
                if (!entry.creditAccountId) {
                    const id = findAcc(entry.creditAccount);
                    if (id) {
                        newEntry.creditAccountId = id;
                        changed = true;
                    }
                }
                if (entry.complexLines) {
                    newEntry.complexLines = entry.complexLines.map(cl => {
                        const id = cl.accountId || findAcc(cl.account);
                        if (id && !cl.accountId) {
                            changed = true;
                            return { ...cl, accountId: id };
                        }
                        return cl;
                    });
                }
                return newEntry;
            });
            return changed ? migrated : prev;
        });
    }, [accounts]);

    useEffect(() => {
        if (Object.keys(accounts).length > 0 && ledger.length > 0) {
            migrateLedgerToIds();
        }
    }, [ledger.length, migrateLedgerToIds]);

    // [DEMO MODE] Load 3-year Strategic Scenario by default if empty on first load
    // 대표님 요청: 전표를 올리지 않았는데 자동 생성되는 현상 방지. 임시로 주석 처리합니다.
    useEffect(() => {
        if (ledger.length === 0 && isInitialLoad.current) {
            isInitialLoad.current = false;
            // console.log("[AccountingFlow] Initializing Demo Mode: 3-Year Strategic Baseline");
            // const demo = generateMultiYearSimulation([2026, 2027, 2028], 'STANDARD');
            // loadSimulation(demo);
        }
    }, [ledger.length]);

    const approveEntry = (id: string) => {
        const entry = ledger.find(e => e.id === id);
        if (entry) {
            // [POSTING GUARD] Hard-Gate for finalized periods
            const monthKey = entry.date.slice(0, 7); // YYYY-MM
            if (finalizedMonths[monthKey]) {
                const msg = `[POSTING BLOCKED] ${monthKey} 기간은 이미 결산(${finalizedMonths[monthKey]})되었습니다. 전표를 승인하려면 먼저 해당 월의 마감을 해제하십시오.`;
                console.warn(msg);
                alert(msg);
                return; 
            }

            // [STRICT GATE - Phase 3] Account Identity verification
            const isComplex = entry.complexLines && entry.complexLines.length > 0;
            const missingId = isComplex 
                ? entry.complexLines?.some(cl => !cl.accountId)
                : (!entry.debitAccountId || !entry.creditAccountId);

            if (missingId) {
                const missingDetail = isComplex 
                    ? entry.complexLines?.filter(cl => !cl.accountId).map(cl => cl.account).join(', ')
                    : `${!entry.debitAccountId ? `차변(${entry.debitAccount})` : ''} ${!entry.creditAccountId ? `대변(${entry.creditAccount})` : ''}`.trim();
                
                const msg = `[FATAL INTEGRITY ERROR] 승인 불가: [${missingDetail}] 계정이 Chart of Accounts(COA)에 등록되어 있지 않거나 ID가 누락되었습니다. 계정을 먼저 등록하십시오.`;
                console.error(msg);
                alert(msg);
                return; 
            }

            // [STRUCTURAL CASH POLICY] Improved Gate: Use balance as of entry date to support future-dated and sequential testing
            const drMeta = Object.values(accounts).find(a => a.name === entry.debitAccount);
            const crMeta = Object.values(accounts).find(a => a.name === entry.creditAccount);
            
            const total = entry.amount + (entry.vat || 0);
            const isCashOut = (entry.type === 'Expense' || entry.type === 'Asset' || entry.type === 'Payroll' || entry.type === 'Funding') && 
                              (entry.creditAccount.includes('현금') || entry.creditAccount.includes('보통') || entry.creditAccount.includes('예금'));
            
            if (isCashOut) {
                // Calculate real-time TB up to this entry's date
                const currentYear = entry.date.split('-')[0];
                const periodStart = `${currentYear}-01-01`;
                const tbAtEntryDate = calculateTrialBalance(accountingLedger, periodStart, entry.date, entry.scope || 'actual', accounts);
                const financialsAtEntryDate = calculateFinancialsFromTB(tbAtEntryDate);
                const availableCash = financialsAtEntryDate.cash;

                if (availableCash < total) {
                    const errorMsg = `[POLCY BREACH] 잔액 부족 (Structural Cash Policy): 전표 승인이 거부되었습니다.\n\n요청 금액: ₩${total.toLocaleString()}\n장부 잔액(전표 일자 ${entry.date} 기준): ₩${availableCash.toLocaleString()}\n\n자본금 납입 등 입금 전표가 먼저 승인되었는지, 혹은 날짜가 올바른지 확인하십시오.`;
                    console.error(errorMsg);
                    alert(errorMsg); 
                    return; 
                }
            }
        }
        setLedger(prev => prev.map(e => {
            if (e.id === id && e.status !== 'Approved') {
                // [AUTO-REGISTRATION] Detect New Partners
                if (e.vendor && e.vendor !== '-' && !partners.some(p => p.name === e.vendor)) {
                    addPartner({
                        id: `partner_${Date.now()}`,
                        name: e.vendor,
                        partnerType: e.type === 'Revenue' ? 'Customer' : 'Vendor',
                        status: 'Pending',
                        tags: ['Auto-Registered']
                    });
                }

                // [AUTO-REGISTRATION] Detect New Assets (ONLY for verified Fixed Asset accounts)
                const fixedAssetAccounts = ['비품', '기계장치', '차량운반구', '소프트웨어', '건물', '토지', '시설장치'];
                const isFixedAsset = fixedAssetAccounts.some(acc => e.debitAccount === acc);
                
                if (isFixedAsset) {
                    addAsset({
                        id: `asset_${Date.now()}`,
                        name: e.description,
                        category: e.debitAccount,
                        acquisitionDate: e.date,
                        cost: e.amount,
                        depreciationMethod: 'STRAIGHT_LINE',
                        usefulLife: 5,
                        residualValue: 0,
                        accumulatedDepreciation: 0,
                        currentValue: e.amount,
                        status: 'Active',
                        location: 'Headquarters'
                    } as any);
                }

                return { ...e, status: 'Approved' };
            }
            return e;
        }));
    };

    const bulkApprove = (ids: string[]) => {
        const idSet = new Set(ids);

        setLedger(prev => prev.map(e => {
            if (idSet.has(e.id) && e.status !== 'Approved') {
                // [STRICT GATE] Skip if IDs are missing
                const isComplex = e.complexLines && e.complexLines.length > 0;
                const missingId = isComplex 
                    ? e.complexLines?.some(cl => !cl.accountId)
                    : (!e.debitAccountId || !e.creditAccountId);
                
                if (missingId) return e; 

                // [AUTO-REGISTRATION] Detect New Partners on Bulk
                if (e.vendor && e.vendor !== '-' && !partners.some(p => p.name === e.vendor)) {
                    addPartner({
                        id: `partner_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        name: e.vendor,
                        partnerType: e.type === 'Revenue' ? 'Customer' : 'Vendor',
                        status: 'Pending',
                        tags: ['Auto-Registered', 'Bulk']
                    });
                }

                return {
                    ...e,
                    status: 'Approved',
                    ledgerType: 'Official',
                    postedBy: 'CHIEF_FINANCIAL_OFFICER',
                    postedAt: new Date().toISOString(),
                    auditTrail: [...(e.auditTrail || []), `POSTed: Balanced Integrity Verified.`]
                };
            }
            return e;
        }));
    };


    const holdEntry = (id: string) => {
        const entry = ledger.find(e => e.id === id);
        if (!entry) return;
        if (isPeriodLocked(entry.date)) {
            alert("마감된 기간의 전표는 수정할 수 없습니다.");
            return;
        }
        if (entry.status === 'Approved') {
            console.error("[MUTATION BLOCKED] Approved entries cannot be placed on hold.");
            return;
        }
        setLedger(prev => prev.map(e => e.id === id ? { ...e, status: 'Hold' } : e));
    };

    const deleteEntry = (id: string) => {
        const entry = ledger.find(e => e.id === id);
        if (!entry) return;
        if (isPeriodLocked(entry.date)) {
            alert("마감된 기간의 전표는 삭제할 수 없습니다.");
            return;
        }
        if (entry.status === 'Approved') {
            console.error("[MUTATION BLOCKED] Approved entries cannot be deleted. Use Reversal Entry instead.");
            return;
        }
        setLedger(prev => prev.filter(e => e.id !== id));
    };

    const updateEntry = (id: string, updates: Partial<JournalEntry>) => {
        const entry = ledger.find(e => e.id === id);
        if (!entry) return;
        if (isPeriodLocked(entry.date)) {
            alert("마감된 기간의 전표는 수정할 수 없습니다.");
            return;
        }
        if (entry.status === 'Approved' && !updates.status) { // Only allow status changes (like cancellation) if needed, but block direct field updates
            console.error("[MUTATION BLOCKED] Approved entries fields cannot be updated directly.");
            return;
        }
        setLedger(prev => prev.map(e => e.id === id ? { ...e, ...updates, version: (e.version || 1) + 1 } : e));
    };

    const addAsset = (asset: Asset) => {
        setAssets(prev => [...prev, asset]);
    };

    const deleteAsset = (id: string) => {
        setAssets(prev => prev.filter(a => a.id !== id));
    };

    const updateConfig = (updates: Partial<TenantConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    };

    const updateInventory = (id: string, updates: Partial<InventoryItem>) => {
        setInventory(prev => {
            const index = prev.findIndex(item => item.id === id);
            if (index >= 0) {
                // Update existing
                const newInventory = [...prev];
                newInventory[index] = { ...newInventory[index], ...updates };
                // Special handling to merge batches if provided, instead of overwriting? 
                // For now, let's assume overwriting or smart merging isn't strictly requested, 
                // but for safety with multiple generations, let's append batches if both exist.
                if (updates.batches && prev[index].batches) {
                    newInventory[index].batches = [...prev[index].batches, ...updates.batches];
                }
                return newInventory;
            } else {
                // Insert new (Upsert)
                // Ensure the updates constitute a valid item (Settings.tsx provides enough data)
                return [...prev, updates as InventoryItem];
            }
        });
    };

    const addScmOrder = (order: Order) => {
        setScmOrders(prev => [...prev, order]);
    };

    const updateScmOrder = (id: string, updates: Partial<Order>) => {
        setScmOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    };

    const resetData = useCallback(() => {
        if (!window.confirm("모든 장부 데이터와 설정을 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다)")) return;

        isInitialLoad.current = false; 
        setLedger(INITIAL_DATA);
        setPartners([]);
        setAssets([]);
        setInventory([]);
        setScmOrders([]);
        setStagingTransactions([]);
        setFinalizedMonths({});
        setScenarioResultsState([]);
        setBaselineSnapshotState(null);
        setBaselineEntriesState([]);
        setBaselineTimestampState(null);
        setSelectedDate(new Date().toISOString().split('T')[0]);

        // Clear Persistence
        const keysToRemove = [
            'accounting_ledger_v3', 'accounting_partners', 'accounting_assets', 
            'accounting_inventory', 'accounting_scm_orders', 'accounting_staging_txs', 
            'accounting_finalized_months', 'accounting_accounts', 'accounting_scenario_results',
            'accounting_baseline_snapshot', 'accounting_baseline_entries', 'accounting_baseline_timestamp'
        ];
        keysToRemove.forEach(k => localStorage.removeItem(k));

        console.log("[AccountingFlow] Manual data reset performed. Storage cleared.");
        alert("데이터가 초기화되었습니다.");
    }, []);

    // [V2.8] MASTER PERSISTENCE EFFECT (LocalStorage + Tauri FS Bridge)
    useEffect(() => {
        if (isInitialLoad.current && ledger.length === INITIAL_DATA.length) return;

        const syncToStorage = async () => {
            // 1. LocalStorage Sync
            localStorage.setItem('accounting_ledger_v3', JSON.stringify(ledger));
            localStorage.setItem('accounting_partners', JSON.stringify(partners));
            localStorage.setItem('accounting_assets', JSON.stringify(assets));
            localStorage.setItem('accounting_inventory', JSON.stringify(inventory));
            localStorage.setItem('accounting_scm_orders', JSON.stringify(scmOrders));
            localStorage.setItem('accounting_staging_txs', JSON.stringify(stagingTransactions));
            localStorage.setItem('accounting_finalized_months', JSON.stringify(finalizedMonths));
            localStorage.setItem('accounting_accounts', JSON.stringify(accounts));

            // 2. Tauri FS Sync (Hard Persistence for Desktop App)
            if ((window as any).__TAURI__) {
                try {
                    const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
                    await writeTextFile('auditflow_v1_ledger.json', JSON.stringify({
                        ledger, partners, assets, inventory, scmOrders, finalizedMonths,
                        timestamp: Date.now()
                    }), { dir: BaseDirectory.AppData });
                    console.log("[Tauri FS] Ledger state persisted to local disk.");
                } catch (err) {
                    console.error("[Tauri FS] Persistence failed:", err);
                }
            }
        };

        syncToStorage();
    }, [ledger, partners, assets, inventory, scmOrders, stagingTransactions, finalizedMonths, accounts]);

    // [V2.8] Initial Tauri Load Bridge
    useEffect(() => {
        const loadFromTauri = async () => {
            if ((window as any).__TAURI__ && ledger.length === 0) {
                try {
                    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
                    const filePath = 'auditflow_v1_ledger.json';
                    if (await exists(filePath, { dir: BaseDirectory.AppData })) {
                        const content = await readTextFile(filePath, { dir: BaseDirectory.AppData });
                        const parsed = JSON.parse(content);
                        if (parsed.ledger) {
                            setLedger(parsed.ledger);
                            if (parsed.partners) setPartners(parsed.partners);
                            if (parsed.assets) setAssets(parsed.assets);
                            if (parsed.inventory) setInventory(parsed.inventory);
                            if (parsed.scmOrders) setScmOrders(parsed.scmOrders);
                            if (parsed.finalizedMonths) setFinalizedMonths(parsed.finalizedMonths);
                            console.log("[Tauri FS] State restored from local disk.");
                        }
                    }
                } catch (err) {
                    console.warn("[Tauri FS] Restore failed:", err);
                }
            }
        };
        loadFromTauri();
    }, []);

    const performClosing = (month: string, type: 'soft' | 'hard') => {
        // [AUTO-DEPRECIATION] Generate entries for all registered assets for this period
        const [year, monthNum] = month.split('-').map(Number);
        const lastDay = new Date(year, monthNum, 0).getDate();
        const closingDate = `${month}-${String(lastDay).padStart(2, '0')}`;

        const depreciationEntries: JournalEntry[] = [];
        
        assets.forEach(asset => {
            const acqDateStr = asset.acquisitionDate;
            const acqDate = new Date(acqDateStr);
            const periodDate = new Date(year, monthNum - 1, 15); // Middle of closing month

            if (acqDate <= periodDate) {
                // Calculate if already depreciated for this month
                const existing = ledger.find(e => 
                    e.date.startsWith(month) && 
                    e.description.includes(`[결산] ${asset.name} 감가상각`)
                );

                if (!existing) {
                    const monthlyDep = Math.floor(asset.cost / (asset.usefulLife * 12));
                    const isIntangible = asset.name.includes('특허') || asset.name.includes('지식재산');
                    
                    depreciationEntries.push({
                        id: `AUTO-DEP-${asset.id}-${month}`,
                        date: closingDate,
                        description: `[결산] ${asset.name} 감가상각비 반영 (자동 생성)`,
                        vendor: 'N/A',
                        debitAccount: isIntangible ? '무형자산상각비' : '감가상각비',
                        debitAccountId: isIntangible ? 'acc_845' : 'acc_831',
                        creditAccount: '감가상각누계액',
                        creditAccountId: 'acc_213',
                        amount: monthlyDep,
                        vat: 0,
                        type: 'Expense',
                        status: 'Approved',
                        auditTrail: ['AI Automated Period End Adjustment: Depreciation calculated.']
                    });
                }
            }
        });

        if (depreciationEntries.length > 0) {
            setLedger(prev => [...prev, ...depreciationEntries]);
        }

        setFinalizedMonths(prev => ({ ...prev, [month]: type }));
    };

    const reopenMonth = (month: string) => {
        setFinalizedMonths(prev => {
            const next = { ...prev };
            delete next[month];
            return next;
        });
    };

    useEffect(() => {
        (window as any).resetData = resetData;
        (window as any).useAccounting = () => ({ resetData }); // Expose for Dashboard
    }, [resetData]);

    const attachEvidence = (id: string, url: string) => {
        setLedger(prev => prev.map(e => e.id === id ? { ...e, attachmentUrl: url, version: (e.version || 1) + 1 } : e));
    };

    const processBulkTax = () => {
        // AI Suggestion Mode: Intelligent analysis of VAT deduction eligibility
        setLedger(prev => prev.map(e => {
            // Case 1: Maximization - Found deductible item with 0 VAT
            if ((e.vendor?.includes('갈비') || e.vendor?.includes('AWS')) && (e.vat === 0)) {
                return {
                    ...e,
                    suggestedVat: Math.floor(e.amount * 0.1),
                    suggestedDescription: `[AI 절세 제안] 분석 결과 본 거래는 매입세액 공제 대상이나 부가세가 누락되었습니다. ₩${Math.floor(e.amount * 0.1).toLocaleString()}원 추가 환급 추천.`
                };
            }

            // Case 2: Risk Mitigation - Non-deductible vehicle (Sedan)
            if (e.description.includes('제네시스') || e.description.includes('승용차')) {
                if (e.vat > 0) {
                    return {
                        ...e,
                        suggestedVat: 0,
                        suggestedDescription: `[AI 리스크 알림] 비영업용 소형승용차(제네시스 등) 관련 비용은 매입세액 불공제 대상입니다. 가산세 방지를 위해 부가세를 0으로 변경 제안.`
                    };
                }
            }

            // Case 3: Risk Mitigation - Tax-exempt business
            if (e.vendor?.includes('플라워') || e.description.includes('면세')) {
                if (e.vat > 0) {
                    return {
                        ...e,
                        suggestedVat: 0,
                        suggestedDescription: `[AI 리스크 알림] 화환/꽃 배달 등 면세 사업자와의 거래입니다. 부가세를 잘못 기입하여 신고할 경우 불공제 가산세 대상이 되므로 수정을 권장.`
                    };
                }
            }

            // Case 4: Tax-Exempt Integrity Gate (Hard-Gate)
            const taxExemptAccounts = ['급여', '보험료', '이자비용', '세금과공과', '기부금'];
            const isTaxExempt = taxExemptAccounts.some(acc => e.debitAccount?.includes(acc) || e.creditAccount?.includes(acc));

            if (isTaxExempt) {
                if (e.vat > 0) {
                    return {
                        ...e,
                        suggestedVat: 0,
                        suggestedDescription: `[AI 면세 보호] ${e.debitAccount} 계정은 법적 면세 항목입니다. 부가세를 입력할 경우 불합리한 공제로 분류되어 가산세 리스크가 있습니다. 0원으로 수정을 권장합니다.`
                    };
                }
                // If it's 0 VAT and a tax-exempt account, don't suggest 10%
                return e;
            }

            // Standard case: If missing VAT but looks like a normal taxable expense
            if ((e.type === 'Expense' || e.type === 'Asset' || e.type === 'Revenue') && (!e.vat || e.vat === 0) && !e.suggestedVat) {
                return {
                    ...e,
                    suggestedVat: Math.floor(e.amount * 0.1),
                    suggestedDescription: `[AI Tax Audit] AI가 증빙 데이터를 분석하여 부가세 공제(10%) 가능 항목으로 분류했습니다. 승인 시 장부에 반영됩니다.`
                };
            }
            return e;
        }));
    };

    const acceptVatSuggestion = (id: string) => {
        setLedger(prev => prev.map(e => {
            if (e.id === id && e.suggestedVat !== undefined) {
                return {
                    ...e,
                    vat: e.suggestedVat,
                    suggestedVat: undefined,
                    suggestedDescription: undefined
                };
            }
            return e;
        }));
    };

    const loadSimulation = (result: Partial<SimulationResult>) => {
        isInitialLoad.current = false; // Any simulation load should disable auto-init
        console.log("[AccountingContext] loadSimulation called with:", result);
        if (result.ledger) {
            console.log("[AccountingContext] Ledger found in result, count:", result.ledger.length);
            setLedger(result.ledger.map(e => ({ ...e, status: e.status || 'Approved' })));
        } else {
            console.warn("[AccountingContext] No ledger found in simulation result! Check field naming.");
        }
        if (result.assets) setAssets(result.assets);
        if (result.orders) setScmOrders(result.orders);
        if (result.inventory) setInventory(result.inventory);
        if (result.partners) setPartners(result.partners);
        if (result.companyConfig) setConfig(result.companyConfig);
    };

    const approvePartner = async (partner: Partner) => {
        if (!(window as any).__TAURI_INTERNALS__) {
            setPartners(prev => prev.map(p => p.id === partner.id ? { ...p, status: 'Approved' } : p));
            return;
        }
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const approved: Partner = await invoke('approve_partner', { partner, partners });
            setPartners(prev => prev.map(p => p.id === partner.id ? approved : p));
        } catch (e) {
            console.error("Failed to approve partner:", e);
        }
    };

    // [STRICT] Physical Ledger Pipeline (Journal -> Physical Ledger)
    // Uses Immutable Core unroll logic
    const accountingLedger = useMemo(() => {
        return unrollJournalToLedger(ledger);
    }, [ledger]);

    const allLinesLedger = useMemo(() => {
        return unrollJournalToLedger(ledger, true);
    }, [ledger]);

    // Backward compatibility for components expecting JournalEntry[]
    // subLedger now represents the 'physical' ledger lines that are approved and within the selected date
    const subLedger = useMemo(() => {
        return accountingLedger.filter(line => line.date <= selectedDate);
    }, [accountingLedger, selectedDate]);

    // [STRICT] Ledger -> Trial Balance Pipeline
    const trialBalance = useMemo(() => {
        const currentYear = selectedDate.split('-')[0];
        const periodStart = `${currentYear}-01-01`;
        return calculateTrialBalance(accountingLedger, periodStart, selectedDate, 'actual', accounts);
    }, [accountingLedger, selectedDate, accounts]);

    const calculateTBForRange = (start: string, end: string, scope: 'actual' | 'scenario' = 'actual') => {
        return calculateTrialBalance(accountingLedger, start, end, scope, accounts);
    };

    const addAccount = (acc: AccountDefinition) => {
        setAccounts(prev => ({ ...prev, [acc.name]: acc }));
    };

    const updateAccount = (name: string, updates: Partial<AccountDefinition>) => {
        setAccounts(prev => {
            if (!prev[name]) return prev;
            return { ...prev, [name]: { ...prev[name], ...updates } };
        });
    };

    const updateCompanyKnowledge = (knowledge: string) => {
        setCompanyKnowledge(knowledge);
        localStorage.setItem('accounting_company_knowledge', knowledge);
    };

    // [STRICT] TB -> FS Pipeline
    const financials = useMemo(() => {
        const f = calculateFinancialsFromTB(trialBalance);
        // [SSOT v12] Force Cash Truth from Ledger (Replaces TB-only aggregation)
        // This ensures Dashboard, Compass, and Cash Report see the EXACT same number.
        f.cash = sumCashAccounts(ledger, selectedDate);
        return f;
    }, [trialBalance, ledger, selectedDate]);

    return (
        <AccountingContext.Provider value={{
            ledger,
            partners,
            assets,
            addAsset,
            deleteAsset,
            config,
            updateConfig,
            addEntry,
            addPartner,
            updatePartner,
            financials,
            accounts,
            addAccount,
            updateAccount,
            loadSimulation,
            approvePartner,
            approveEntry,
            bulkApprove,
            holdEntry,
            addEntries,
            updateEntry,
            deleteEntry,
            attachEvidence,
            processBulkTax,
            acceptVatSuggestion,
            updateInventory,
            scmOrders,
            addScmOrder,
            updateScmOrder,
            resetData,
            stagingTransactions,
            setStagingTransactions,
            subLedger,
            inventory,
            transactions: ledger,
            finalizedMonths,
            performClosing,
            reopenMonth,
            activeTab,
            selectedDate,
            setSelectedDate,
            setTab,
            trialBalance,
            accountingLedger,
            calculateTBForRange,
            isPeriodLocked,
            isDev,
            allLinesLedger,
            companyKnowledge,
            updateCompanyKnowledge,
            baselineSnapshot,
            setBaselineSnapshot,
            scenarioResults,
            setScenarioResults,
            baselineEntries,
            setBaselineEntries,
            baselineTimestamp,
            setBaselineTimestamp,
            revenueMult,
            setRevenueMult,
            expenseMult,
            setExpenseMult,
            fixedCostDelta,
            setFixedCostDelta,
            preMoneyValuation,
            setPreMoneyValuation,
            projectionMonths,
            setProjectionMonths,
            macro,
            setMacro,
            founderInitialOwnership,
            setFounderInitialOwnership,
            investmentAmount,
            setInvestmentAmount,
            aiMessages,
            setAiMessages,
            clearAiMessages
        }}>
            {children}
</AccountingContext.Provider>
    );
};
