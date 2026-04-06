import React, { createContext, useState, useMemo, ReactNode, useEffect, useCallback } from 'react';
import { JournalEntry, Partner, SimulationResult, Asset, TenantConfig, InventoryItem, Order, FinancialSummary, ParsedTransaction, LedgerLine, TrialBalance, AccountDefinition, MacroAssumptions, AiChatMessage } from '../types';
import { calculateTrialBalance, calculateFinancialsFromTB, unrollJournalToLedger, generateMultiYearSimulation } from '../core/engine';
import { generateTacticalActions, TacticalAction } from '../core/metrics/actionGenerator';
import { CHART_OF_ACCOUNTS } from '../core/coa';
import { ALL_ACCOUNTS, MASTER_ACCOUNTS } from '../constants/accounts';
import { normalizeVendor } from '../utils/textUtils';
import { learningQueue } from '../core/learningQueue';
import { supabase } from '../lib/supabaseClient';
import { getSubscriptionState, SubscriptionStatus, Plan } from '../lib/subscription';

export interface SubscriptionState {
    accessType: string;
    status: SubscriptionStatus;
    plan: Plan;
    targetPlan: string;
    isActive: boolean;
    isAdmin: boolean;
    trialExpired: boolean;
    remainingDays: number;
    isExpiringSoon: boolean;
    loading: boolean;
    userProfile: any;
}

export interface AccountingContextType {
    ledger: JournalEntry[];
    partners: Partner[];
    addEntry: (entry: JournalEntry) => void;
    addPartner: (partner: Partner) => void;
    updatePartner: (id: string, updates: Partial<Partner>) => void;
    financials: FinancialSummary;
    actualFinancials: FinancialSummary;
    scenarioFinancials: FinancialSummary;
    loadSimulation: (result: Partial<SimulationResult>) => void;
    approvePartner: (partner: Partner) => Promise<void>;
    approveEntry: (id: string) => void;
    bulkApprove: (ids: string[]) => void;
    holdEntry: (id: string) => void;
    addEntries: (entries: JournalEntry[]) => Promise<void>;
    updateEntry: (id: string, updates: Partial<JournalEntry>) => void;
    attachEvidence: (id: string, url: string) => void;
    processBulkTax: () => void;
    acceptVatSuggestion: (id: string) => void;
    deleteEntry: (id: string) => void;
    assets: Asset[];
    addAsset: (asset: Asset) => void;
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
    baselineSnapshot: { date: string; hash: string; ledger: JournalEntry[]; macro?: MacroAssumptions } | null;
    setBaselineSnapshot: (snapshot: any) => void;
    scenarioResults: JournalEntry[];
    setScenarioResults: (val: JournalEntry[]) => void;
    baselineEntries: JournalEntry[];
    setBaselineEntries: (val: JournalEntry[]) => void;
    baselineTimestamp: number | null;
    setBaselineTimestamp: (time: number | null) => void;
    onUserOverride: (vendor: string | undefined, account: string, creditAccount?: string, entryType?: string) => Promise<void>;
    inferAccount: (entry: Partial<JournalEntry>) => Promise<{ account: string | null, source: 'memory' | 'ai', reason: string }>;
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
    dataReliability: number;
    tacticalActions: TacticalAction[];
    checkDuplicate: (entry: Partial<JournalEntry>) => JournalEntry | null;
    isPlanSelectorOpen: boolean;
    setIsPlanSelectorOpen: (open: boolean) => void;
    exportPlanSummary: () => void;
    access: SubscriptionState;
    refreshSubscription: () => Promise<void>;
}

export const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

export const AccountingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const isDev = true;
    const [ledger, setLedger] = useState<JournalEntry[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [scmOrders, setScmOrders] = useState<Order[]>([]);
    const [stagingTransactions, setStagingTransactions] = useState<ParsedTransaction[]>([]);
    const [finalizedMonths, setFinalizedMonths] = useState<Record<string, 'soft' | 'hard'>>({});
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [accounts, setAccounts] = useState<Record<string, AccountDefinition>>(() => {
        const initial = { ...CHART_OF_ACCOUNTS };
        ALL_ACCOUNTS.forEach(acc => {
            if (!initial[acc.name]) {
                const nature = 'EXPENSE';
                initial[acc.name] = {
                    id: `acc_${acc.code}`, code: acc.code, name: acc.name, nature,
                    statement: 'PL', section: '기본 계정', group: '표준 계정과목'
                };
            }
        });
        return initial;
    });
    const [activeTab, setTab] = useState('dashboard');
    const [companyKnowledge, setCompanyKnowledge] = useState("표준 회계 정책...");
    const [baselineSnapshot, setBaselineSnapshotState] = useState<any>(null);
    const setBaselineSnapshot = (val: any) => setBaselineSnapshotState(val);
    const [scenarioResults, setScenarioResultsState] = useState<JournalEntry[]>([]);
    const setScenarioResults = (val: JournalEntry[]) => setScenarioResultsState(val);
    const [baselineEntries, setBaselineEntriesState] = useState<JournalEntry[]>([]);
    const setBaselineEntries = (val: JournalEntry[]) => setBaselineEntriesState(val);
    const [baselineTimestamp, setBaselineTimestampState] = useState<number | null>(null);
    const setBaselineTimestamp = (val: number | null) => setBaselineTimestampState(val);

    const [revenueMult, setRevenueMult] = useState(1.0);
    const [expenseMult, setExpenseMult] = useState(1.0);
    const [fixedCostDelta, setFixedCostDelta] = useState(0);
    const [preMoneyValuation, setPreMoneyValuation] = useState(500000000);
    const [projectionMonths, setProjectionMonths] = useState(36);
    const [macro, setMacro] = useState({
        inflationRate: 0.03, wageGrowthRate: 0.05, otherExpenseGrowth: 0.02, revenueNaturalGrowth: 0.01
    });
    const [founderInitialOwnership, setFounderInitialOwnership] = useState(1.0);
    const [investmentAmount, setInvestmentAmount] = useState(0);
    const [aiMessages, setAiMessagesState] = useState<AiChatMessage[]>([]);
    const setAiMessages = (val: any) => setAiMessagesState(val);
    const clearAiMessages = () => setAiMessagesState([]);
    const [isPlanSelectorOpen, setIsPlanSelectorOpen] = useState(false);
    const [config, setConfig] = useState<TenantConfig>({ tenantId: 'default', isReadOnly: false, taxPolicy: {} as any });

    // --- Subscription Global State ---
    const [access, setAccess] = useState<SubscriptionState>({
        accessType: "trial",
        status: "trial",
        plan: "basic",
        targetPlan: "none",
        isActive: false,
        isAdmin: false,
        trialExpired: false,
        remainingDays: 0,
        isExpiringSoon: false,
        loading: true,
        userProfile: null,
    });

    const refreshSubscription = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setAccess(prev => ({ ...prev, loading: false }));
            return;
        }

        const { data, error } = await supabase
            .from("user_profile")
            .select("user_id, access_type, access_end, plan, upgrade_status, requested_plan, is_admin")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Context access check error:", error);
            setAccess(prev => ({ ...prev, loading: false }));
            return;
        }

        if (data) {
            const sub = getSubscriptionState(data);
            const diff = data.access_end ? new Date(data.access_end).getTime() - new Date().getTime() : 0;
            const remainingDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

            setAccess({
                accessType: data.access_type || "trial",
                status: sub.status as SubscriptionStatus,
                plan: sub.currentPlan as Plan,
                targetPlan: sub.targetPlan || "none",
                isActive: sub.isAccessAllowed,
                isAdmin: !!data?.is_admin,
                trialExpired: sub.status === "expired",
                remainingDays: Math.max(0, remainingDays),
                isExpiringSoon: sub.status === "trial" && remainingDays <= 3,
                loading: false,
                userProfile: data,
            });
        } else {
            setAccess(prev => ({ ...prev, loading: false }));
        }
    }, []);

    useEffect(() => {
        refreshSubscription();
        const channel = supabase
            .channel('access_global_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profile' }, refreshSubscription)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [refreshSubscription]);

    // --- Existing Handlers ---
    const onUserOverride = useCallback(async (vendor: string | undefined, account: string, creditAccount?: string, entryType?: string) => {
        const normalized = normalizeVendor(vendor || '');
        if (!normalized) return;
        const { invoke } = await import('@tauri-apps/api/core');
        learningQueue.enqueue(() => invoke('upsert_vendor_learning', { vendor: normalized, account, creditAccount: creditAccount || null, entryType: entryType || null }));
    }, []);

    const syncLearningBatch = async (entries: JournalEntry[]) => {
        const uniqueMap = new Map<string, JournalEntry>();
        entries.forEach(e => { if (e.vendor && (e.debitAccount || e.creditAccount)) { uniqueMap.set(normalizeVendor(e.vendor), e); } });
        for (const [vendor, e] of uniqueMap.entries()) { learningQueue.enqueue(() => onUserOverride(vendor, e.debitAccount, e.creditAccount, e.type)); }
    };

    const inferAccount = useCallback(async (entry: Partial<JournalEntry>): Promise<any> => {
        const normalized = normalizeVendor(entry.vendor || '');
        const { invoke } = await import('@tauri-apps/api/core');
        return new Promise<any>((resolve) => {
            learningQueue.enqueue(async () => {
                try {
                    const report: any = await invoke('get_vendor_memory_report', { vendor: normalized });
                    if (report.is_conflict) { resolve({ account: null, source: 'ai', reason: 'Conflict fallback' }); return; }
                    if (report.usage_count >= 1 && report.account) { resolve({ account: report.account, creditAccount: report.credit_account, entryType: report.entry_type, source: 'memory', reason: `Vendor Memory (${report.usage_count}x previous)` }); return; }
                    resolve({ account: null, source: 'ai', reason: 'New vendor' });
                } catch (e) { resolve({ account: null, source: 'ai', reason: 'Error fallback' }); }
            });
        });
    }, []);

    const isPeriodLocked = useCallback((date: string) => !!finalizedMonths[date.slice(0, 7)], [finalizedMonths]);
    const checkDuplicate = useCallback((entry: Partial<JournalEntry>): JournalEntry | null => {
        const amount = entry.amount;
        if (!entry.date || typeof amount !== 'number') return null;
        const normalizedInputVendor = normalizeVendor(entry.vendor || '');
        return ledger.find(existing => (existing.date === entry.date && Math.abs(existing.amount - amount) < 1 && normalizeVendor(existing.vendor || '') === normalizedInputVendor)) || null;
    }, [ledger]);

    const addEntries = async (entries: JournalEntry[]) => {
        const enriched: JournalEntry[] = [];
        for (const e of entries) {
            const inf = await inferAccount(e);
            enriched.push({ ...e, debitAccount: inf.account || e.debitAccount, creditAccount: inf.creditAccount || e.creditAccount, type: inf.entryType || e.type, inferenceSource: inf.source, inferenceReason: inf.reason });
        }
        setLedger(prev => [...prev, ...enriched]);
    };

    const updateEntry = (id: string, updates: Partial<JournalEntry>) => {
        const e = ledger.find(row => row.id === id); if (!e) return;
        setLedger(prev => prev.map(row => row.id === id ? { ...row, ...updates, inferenceSource: updates.debitAccount ? 'manual' : row.inferenceSource } : row));
        if (updates.debitAccount && updates.debitAccount !== e.debitAccount) { learningQueue.enqueue(() => onUserOverride(e.vendor || '', updates.debitAccount!, updates.creditAccount || e.creditAccount, updates.type || e.type)); }
    };

    const approveEntry = (id: string) => { setLedger(prev => prev.map(e => e.id === id ? { ...e, status: 'Approved' } : e)); const entry = ledger.find(e => e.id === id); if (entry) { syncLearningBatch([entry]); } };
    const bulkApprove = (ids: string[]) => { const targets = ledger.filter(e => ids.includes(e.id)); setLedger(prev => prev.map(e => ids.includes(e.id) ? { ...e, status: 'Approved' } : e)); if (targets.length > 0) { syncLearningBatch(targets); } };
    const holdEntry = (id: string) => setLedger(prev => prev.map(e => e.id === id ? { ...e, status: 'Hold' } : e));
    const deleteEntry = (id: string) => setLedger(prev => prev.filter(e => e.id !== id));
    const addEntry = (e: JournalEntry) => setLedger(prev => [...prev, e]);
    const addPartner = (p: Partner) => setPartners(prev => [...prev, p]);
    const updatePartner = (id: string, u: any) => setPartners(prev => prev.map(p => p.id === id ? { ...p, ...u } : p));
    const addAsset = (a: Asset) => setAssets(prev => [...prev, a]);
    const updateInventory = (id: string, u: any) => setInventory(prev => prev.map(i => i.id === id ? { ...i, ...u } : i));
    const addScmOrder = (o: Order) => setScmOrders(prev => [...prev, o]);
    const updateScmOrder = (id: string, u: any) => setScmOrders(prev => prev.map(o => o.id === id ? { ...o, ...u } : o));
    const updateConfig = (u: any) => setConfig(prev => ({ ...prev, ...u }));
    const resetData = () => { setLedger([]); setPartners([]); setAssets([]); setStagingTransactions([]); };
    const attachEvidence = (id: string, url: string) => updateEntry(id, { attachmentUrl: url } as any);
    const processBulkTax = () => { };
    const acceptVatSuggestion = (id: string) => { };
    const performClosing = (m: string, t: any) => setFinalizedMonths(prev => ({ ...prev, [m]: t }));
    const reopenMonth = (m: string) => setFinalizedMonths(prev => { const n = { ...prev }; delete n[m]; return n; });
    const loadSimulation = (res: any) => { if (res.ledger) setLedger(res.ledger); if (res.assets) setAssets(res.assets); };
    const approvePartner = async (p: Partner) => { setPartners(prev => prev.map(x => x.id === p.id ? { ...x, status: 'Approved' } : x)); };
    const updateAccount = (n: string, u: any) => setAccounts(prev => ({ ...prev, [n]: { ...prev[n], ...u } }));
    const addAccount = (a: any) => setAccounts(prev => ({ ...prev, [a.name]: a }));
    const updateCompanyKnowledge = (k: string) => setCompanyKnowledge(k);

    const exportPlanSummary = useCallback(async () => {
        const { exportToExcel, formatLedgerForExport } = await import('../utils/exportUtils');
        exportToExcel(formatLedgerForExport(ledger), 'AccountingFlow_Ledger');
    }, [ledger]);

    const accountingLedger = useMemo(() => unrollJournalToLedger(ledger), [ledger]);
    const allLinesLedger = useMemo(() => unrollJournalToLedger(ledger, true), [ledger]);
    const subLedger = useMemo(() => accountingLedger.filter(l => l.date <= selectedDate), [accountingLedger, selectedDate]);
    const trialBalance = useMemo(() => calculateTrialBalance(accountingLedger, '2026-01-01', selectedDate, 'actual', accounts), [accountingLedger, selectedDate, accounts]);
    const financials = useMemo(() => calculateFinancialsFromTB(trialBalance), [trialBalance]);

    const actualFinancials = useMemo(() => {
        const actualAccountingLedger = unrollJournalToLedger(ledger.filter(e => e.scope !== 'scenario'));
        const tb = calculateTrialBalance(actualAccountingLedger, '2026-01-01', selectedDate, 'actual', accounts);
        return calculateFinancialsFromTB(tb);
    }, [ledger, selectedDate, accounts]);

    const scenarioFinancials = useMemo(() => {
        if (!scenarioResults || scenarioResults.length === 0) return actualFinancials;
        const scenarioAccountingLedger = unrollJournalToLedger([...ledger, ...scenarioResults]);
        const tb = calculateTrialBalance(scenarioAccountingLedger, '2026-01-01', selectedDate, 'actual', accounts);
        return calculateFinancialsFromTB(tb);
    }, [ledger, scenarioResults, selectedDate, accounts, actualFinancials]);

    const dataReliability = useMemo(() => {
        if (ledger.length === 0) return 100;
        const rel = ledger.filter(e => e.inferenceSource === 'memory' || e.inferenceSource === 'manual' || e.status === 'Approved').length;
        return Math.floor((rel / ledger.length) * 100);
    }, [ledger]);

    const calculateTBForRange = (s: string, e: string, sc: any = 'actual') => calculateTrialBalance(accountingLedger, s, e, sc, accounts);

    const tacticalActions = useMemo(() => {
        const netBurn = financials.grossBurn - financials.inflow;
        const rawRunway = netBurn > 0 ? financials.cash / netBurn : Infinity;
        const runway = isFinite(rawRunway) ? Math.max(0, rawRunway) : Infinity;
        return generateTacticalActions(financials, runway, dataReliability);
    }, [financials, dataReliability]);

    return (
        <AccountingContext.Provider value={{
            ledger, partners, assets, addAsset, config, updateConfig, addEntry, addPartner, updatePartner,
            financials, actualFinancials, scenarioFinancials, accounts, addAccount, updateAccount, loadSimulation, approvePartner, approveEntry,
            bulkApprove, holdEntry, addEntries, updateEntry, deleteEntry, attachEvidence, processBulkTax,
            acceptVatSuggestion, updateInventory, scmOrders, addScmOrder, updateScmOrder, resetData,
            stagingTransactions, setStagingTransactions, subLedger, inventory, transactions: ledger,
            finalizedMonths, performClosing, reopenMonth, activeTab, selectedDate, setSelectedDate,
            setTab, trialBalance, accountingLedger, calculateTBForRange, isPeriodLocked, isDev,
            allLinesLedger, companyKnowledge, updateCompanyKnowledge, baselineSnapshot, setBaselineSnapshot,
            scenarioResults, setScenarioResults, baselineEntries, setBaselineEntries, baselineTimestamp, setBaselineTimestamp,
            onUserOverride, inferAccount, revenueMult, setRevenueMult, expenseMult, setExpenseMult,
            fixedCostDelta, setFixedCostDelta, preMoneyValuation, setPreMoneyValuation, projectionMonths, setProjectionMonths,
            macro, setMacro, founderInitialOwnership, setFounderInitialOwnership, investmentAmount, setInvestmentAmount,
            aiMessages, setAiMessages, clearAiMessages, dataReliability, tacticalActions,
            checkDuplicate, isPlanSelectorOpen, setIsPlanSelectorOpen,
            exportPlanSummary,
            access, refreshSubscription
        }}>
            {children}
        </AccountingContext.Provider>
    );
};
