import { useState, useContext, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import BrandHeader from './components/layout/BrandHeader';
import { AIAssistantWidget } from './components/common/AIAssistantWidget';
import Journal from './pages/Journal';
import LedgerView from './pages/LedgerView';
import PartnersLedger from './pages/PartnersLedger';
import Partners from './pages/Partners';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { TaxAdjustments } from './pages/TaxAdjustments';
import ApprovalDesk from './pages/ApprovalDesk';
import { DataMigration } from './pages/DataMigration';
import { SCM } from './pages/SCM';
import { Assets } from './pages/Assets';
import { Inventory } from './pages/Inventory';
import { Closing } from './pages/Closing';
import { AdvancedLedger } from './pages/AdvancedLedger';
import FinancialStatements from './pages/FinancialStatements';
import TrialBalance from './pages/TrialBalance';
import { LeaseLedger } from './pages/LeaseLedger';
import StrategicCompass from './pages/StrategicCompass';
import RiskHeatmap from './pages/RiskHeatmap';
import AIAssistant from './pages/AIAssistant';
import ScenarioManager from './pages/ScenarioManager';
import AnalysisResult from './pages/AnalysisResult';
import MonthlyPnL from './pages/MonthlyPnL';
import DailyCashReport from './pages/DailyCashReport';
import { Settlement } from './pages/Settlement';
import { RiskControl } from './pages/RiskControl';
import CloseReadiness from './pages/CloseReadiness';
import { AdminPage } from './pages/AdminPage';

import { AccountingProvider, AccountingContext } from './context/AccountingContext';
import { ConfigProvider } from './context/ConfigContext';
import { ThemeProvider } from './context/ThemeContext';
import { testConnection } from './lib/supabaseClient';

const AppContent = () => {
    const { activeTab, setTab } = useContext(AccountingContext)!;

    useEffect(() => {
        // [Supabase] Test Real-time Connectivity
        testConnection();
    }, []);

    return (
        <div className="flex h-screen font-sans antialiased overflow-hidden" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-high)' }}>
            <Sidebar activeTab={activeTab} setTab={setTab} />

            <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative lg:pl-[260px]">
                <BrandHeader />

                <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar pt-16 lg:pt-0">
                    <div className="w-full max-w-full p-4 md:p-6 lg:p-8">
                        {activeTab === 'dashboard' && <Dashboard />}
                        {activeTab === 'strategic-compass' && <StrategicCompass />}
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
                        
                        {activeTab === 'admin-console' && <AdminPage />}

                        {activeTab === 'migration' && <DataMigration setTab={setTab} />}
                        {activeTab === 'settings' && <Settings />}
                    </div>
                </div>
                {activeTab !== 'ai-assistant' && <AIAssistantWidget />}
            </main>
        </div>
    );
};

import { LoginPage } from './pages/LoginPage';
import { supabase } from './lib/supabaseClient';

function App() {
    const [session, setSession] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (!session) {
        return <LoginPage />;
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
