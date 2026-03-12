import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import BrandHeader from './components/layout/BrandHeader';
import Journal from './pages/Journal';
import LedgerView from './pages/LedgerView';
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
import { MonthlyPnL } from './pages/MonthlyPnL';

import { AccountingProvider } from './context/AccountingContext';
import { ConfigProvider } from './context/ConfigContext';
import { ThemeProvider } from './context/ThemeContext';

const AppContent = () => {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <div className="flex h-screen font-sans antialiased overflow-hidden" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-high)' }}>
            <Sidebar activeTab={activeTab} setTab={setActiveTab} />

            <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative">
                <BrandHeader />

                <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar pt-16 lg:pt-0">
                    <div className="w-full max-w-full p-4 md:p-6 lg:p-8">
                        {activeTab === 'dashboard' && <Dashboard setTab={setActiveTab} />}
                        {activeTab === 'strategic-compass' && <StrategicCompass />}
                        {activeTab === 'risk-heatmap' && <RiskHeatmap />}
                        {activeTab === 'ai-assistant' && <AIAssistant />}
                        {activeTab === 'scenario-manager' && <ScenarioManager />}
                        {activeTab === 'analysis-result' && <AnalysisResult onBack={() => setActiveTab('dashboard')} />}
                        {activeTab === 'monthly-pnl' && <MonthlyPnL />}
                        {(activeTab === 'closing' || activeTab === 'settlement' || activeTab === 'risk-dashboard') && <Closing />}
                        
                        {activeTab === 'ledger' && <Journal />}
                        {activeTab === 'ledger-view' && <LedgerView />}
                        {activeTab === 'trial-balance' && <TrialBalance />}
                        {activeTab === 'financial-statements' && <FinancialStatements />}
                        
                        {activeTab === 'scm' && <SCM setTab={setActiveTab} />}
                        {activeTab === 'inventory' && <Inventory />}
                        {activeTab === 'assets' && <Assets />}
                        {activeTab === 'partners' && <Partners />}
                        {activeTab === 'reports' && <Reports />}
                        {activeTab === 'tax-adjustments' && <TaxAdjustments />}
                        {activeTab === 'lease-ledger' && <LeaseLedger />}
                        {activeTab === 'advanced-ledger' && <AdvancedLedger />}
                        {activeTab === 'approval-desk' && <ApprovalDesk />}
                        
                        {activeTab === 'migration' && <DataMigration setTab={setActiveTab} />}
                        {activeTab === 'settings' && <Settings />}
                    </div>
                </div>
            </main>
        </div>
    );
};

function App() {
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
