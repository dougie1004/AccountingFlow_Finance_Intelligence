import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import BrandHeader from './components/layout/BrandHeader';
import Journal from './pages/Journal';
import LedgerView from './pages/LedgerView';
import Partners from './pages/Partners';
import StrategicCompass from './pages/StrategicCompass';
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
import MonthlyPnL from './pages/MonthlyPnL';

import { AccountingProvider } from './context/AccountingContext';
import { ConfigProvider, useConfig } from './context/ConfigContext';
import { ThemeProvider } from './context/ThemeContext';

import { ExecutiveReport } from './components/dashboard/ExecutiveReport';

const AppContent = () => {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <div className="flex h-screen font-sans antialiased overflow-hidden" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-high)' }}>
            <Sidebar activeTab={activeTab} setTab={setActiveTab} />

            <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative">
                <BrandHeader />

                <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar pt-16 lg:pt-0">
                    <div className="w-full max-w-full p-4 md:p-6 lg:p-8">
                        {/* STRATEGY Group */}
                        <div style={{ display: (activeTab === 'dashboard' || activeTab === 'home') ? 'block' : 'none' }}>
                            <Dashboard setTab={setActiveTab} />
                        </div>
                        <div style={{ display: activeTab === 'reports' ? 'block' : 'none' }}>
                            <ExecutiveReport />
                        </div>
                        <div style={{ display: activeTab === 'cashflow' ? 'block' : 'none' }}>
                            <Reports />
                        </div>
                        <div style={{ display: (activeTab === 'closing' || activeTab === 'risk-dashboard') ? 'block' : 'none' }}>
                            <Closing />
                        </div>
                        <div style={{ display: activeTab === 'monthly-pnl' ? 'block' : 'none' }}>
                            <MonthlyPnL />
                        </div>

                        {/* ACCOUNTING Group */}
                        <div style={{ display: (activeTab === 'ledger' || activeTab === 'vendor-ledger') ? 'block' : 'none' }}>
                            <Journal />
                        </div>
                        <div style={{ display: activeTab === 'ledger-view' ? 'block' : 'none' }}>
                            <LedgerView />
                        </div>
                        <div style={{ display: activeTab === 'trial-balance' ? 'block' : 'none' }}>
                            <TrialBalance />
                        </div>
                        <div style={{ display: activeTab === 'financial-statements' ? 'block' : 'none' }}>
                            <FinancialStatements />
                        </div>

                        {/* OPERATIONS Group */}
                        <div style={{ display: (activeTab === 'approval-desk' || activeTab === 'settlement') ? 'block' : 'none' }}>
                            <ApprovalDesk />
                        </div>
                        <div style={{ display: activeTab === 'assets' ? 'block' : 'none' }}>
                            <Assets />
                        </div>
                        <div style={{ display: activeTab === 'lease-ledger' ? 'block' : 'none' }}>
                            <LeaseLedger />
                        </div>
                        <div style={{ display: activeTab === 'partners' ? 'block' : 'none' }}>
                            <Partners />
                        </div>
                        <div style={{ display: (activeTab === 'budget' || activeTab === 'strategic-compass') ? 'block' : 'none' }}>
                            <StrategicCompass />
                        </div>

                        {/* SYSTEM Group */}
                        <div style={{ display: activeTab === 'migration' ? 'block' : 'none' }}>
                            <DataMigration setTab={setActiveTab} />
                        </div>
                        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
                            <Settings />
                        </div>

                        {/* Advanced / Hidden */}
                        <div style={{ display: activeTab === 'inventory' ? 'block' : 'none' }}>
                            <Inventory />
                        </div>
                        <div style={{ display: activeTab === 'scm' ? 'block' : 'none' }}>
                            <SCM setTab={setActiveTab} />
                        </div>
                        <div style={{ display: activeTab === 'tax-adjustments' ? 'block' : 'none' }}>
                            <TaxAdjustments />
                        </div>
                        <div style={{ display: activeTab === 'advanced-ledger' ? 'block' : 'none' }}>
                            <AdvancedLedger />
                        </div>
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
