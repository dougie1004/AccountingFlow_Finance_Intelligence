import { useState, useContext, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import BrandHeader from '@/components/layout/BrandHeader';
import { AIAssistantWidget } from '@/components/common/AIAssistantWidget';
import Journal from '@/pages/Journal';
import LedgerView from '@/pages/LedgerView';
import PartnersLedger from '@/pages/PartnersLedger';
import Partners from '@/pages/Partners';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import { TaxAdjustments } from '@/pages/TaxAdjustments';
import ApprovalDesk from '@/pages/ApprovalDesk';
import { DataMigration } from '@/pages/DataMigration';
import { SCM } from '@/pages/SCM';
import { Assets } from '@/pages/Assets';
import { Inventory } from '@/pages/Inventory';
import { Closing } from '@/pages/Closing';
import { AdvancedLedger } from '@/pages/AdvancedLedger';
import FinancialStatements from '@/pages/FinancialStatements';
import TrialBalance from '@/pages/TrialBalance';
import { LeaseLedger } from '@/pages/LeaseLedger';
import StrategicCompass from '@/pages/StrategicCompass';
import RiskHeatmap from '@/pages/RiskHeatmap';
import AIAssistant from '@/pages/AIAssistant';
import ScenarioManager from '@/pages/ScenarioManager';
import AnalysisResult from '@/pages/AnalysisResult';
import MonthlyPnL from '@/pages/MonthlyPnL';
import DailyCashReport from '@/pages/DailyCashReport';
import { Settlement } from '@/pages/Settlement';
import { RiskControl } from '@/pages/RiskControl';
import CloseReadiness from '@/pages/CloseReadiness';

import { AccountingProvider, AccountingContext } from '@/context/AccountingContext';
import { ConfigProvider } from '@/context/ConfigContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabaseClient';
import AuthPage from "@/pages/AuthPage";
import { TrialBanner } from "@/components/TrialBanner";
import { FeatureGate } from "@/components/FeatureGate";
import { PlanSelector } from "@/components/PlanSelector";

import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useBillingStatus } from "@/hooks/useBillingStatus";
import EquityIntelligence from "@/components/EquityIntelligence";
import AdminPage from "@/pages/AdminPage";

const AppContent = () => {
    const context = useContext(AccountingContext);
    
    // context 가 로딩 중이거나 아직 준비되지 않았을 경우를 위한 안전 장치
    if (!context) return null;
    
    const { activeTab, setTab, isPlanSelectorOpen, setIsPlanSelectorOpen } = context;

    // 🚀 실시간 구독/만료 상태 데이터 확보
    const access = useAccessStatus();
    const billing = useBillingStatus();

    return (
        <div className="flex h-screen font-sans antialiased overflow-hidden" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-high)' }}>
            <Sidebar activeTab={activeTab} setTab={setTab} />

            <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative lg:pl-[260px]">
                {/* 🚀 Trial Notification Banner */}
                <TrialBanner />
                
                <BrandHeader />

                <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar pt-16 lg:pt-0">
                    <div className="w-full max-w-full p-4 md:p-6 lg:p-8">
                        {activeTab === 'dashboard' && <Dashboard />}

                        {/* 🔒 Locked Premium Feature: Strategic Compass */}
                        {activeTab === 'strategic-compass' && (
                            <FeatureGate>
                                <StrategicCompass />
                            </FeatureGate>
                        )}
                        
                        {activeTab === 'risk-heatmap' && <RiskHeatmap />}
                        {activeTab === 'ai-assistant' && <AIAssistant />}
                        {activeTab === 'scenario-manager' && <ScenarioManager />}
                        {activeTab === 'analysis-result' && <AnalysisResult onBack={() => setTab('dashboard')} />}
                        {activeTab === 'monthly-pnl' && <MonthlyPnL />}
                        {activeTab === 'cashflow' && <DailyCashReport />}
                        {activeTab === 'settlement' && <Settlement />}
                        {activeTab === 'risk-dashboard' && <RiskControl />}
                        { activeTab === 'closing' && <Closing setTab={setTab} />}
                        { activeTab === 'close-readiness' && <CloseReadiness />}
                        
                        {activeTab === 'ledger' && <Journal />}
                        {activeTab === 'ledger-view' && <LedgerView />}
                        {activeTab === 'trial-balance' && <TrialBalance />}
                        {activeTab === 'financial-statements' && <FinancialStatements />}
                        
                        {activeTab === 'scm' && <SCM setTab={setTab} />}
                        {activeTab === 'inventory' && <Inventory />}
                        {activeTab === 'assets' && <Assets />}
                        {activeTab === 'partners-ledger' && <PartnersLedger />}
                        {activeTab === 'partners' && <Partners />}
                        {activeTab === 'reports' && <Reports setTab={setTab} />}
                        {activeTab === 'tax-adjustments' && <TaxAdjustments />}
                        {activeTab === 'lease-ledger' && <LeaseLedger />}
                        {activeTab === 'advanced-ledger' && <AdvancedLedger />}
                        {activeTab === 'approval-desk' && <ApprovalDesk />}
                        
                        {activeTab === 'migration' && <DataMigration setTab={setTab} />}
                        {activeTab === 'settings' && <Settings />}
                        {activeTab === 'admin' && <AdminPage />}
                    </div>
                </div>
                {activeTab !== 'ai-assistant' && <AIAssistantWidget />}
            </main>

            {/* 💎 Global Plan Selector Modal */}
            <AnimatePresence>
                {isPlanSelectorOpen && (
                    <PlanSelector 
                        onClose={() => setIsPlanSelectorOpen(false)} 
                        user={access.userProfile}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

function App() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 현재 세션 확인
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // 인증 상태 변경 리스너
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <div className="h-screen w-screen bg-[#0B1221] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>;
    }

    if (!session) {
        return <AuthPage />;
    }

    return (
        <ThemeProvider>
            <ConfigProvider>
                <AccountingProvider>
                    <AppContent />
                </AccountingProvider>
            </ConfigProvider>
        </ThemeProvider>
    );
}

export default App;
