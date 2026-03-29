# 📅 AccountingFlow Daily Worklog - 2026-03-18

## 🧭 Strategic Objective: "Supreme Protocol" Verification & Compass v3 Implementation

### ✅ Key Deliverables & Achievements

#### 1. Strategic Protocol Verification (Phases 1-6)
- **Status**: **100% SUCCESS** (Standard Scenario)
- **Integral Logic Repair**: Fixed critical account ID mismatches between the simulator and the COA (Chart of Accounts).
    - Synchronized `coa.ts` with `MASTER_ACCOUNTS`.
    - Corrected Grant (acc_199/299) and Depreciation (acc_831) IDs in the simulation generator.
- **Verification Results**: 
    - **TB Balance**: Σ Debit == Σ Credit (0 KRW mismatch).
    - **BS/PL Balance**: Assets = Liabilities + Equity confirmed.
    - **Cash Anchor**: GL Cash Balance matches accumulated ledger deltas perfectly.

#### 2. Strategic Compass v3 Development (The "CFO" Standard)
- **Snapshot Stability**: Implemented a "Snapshot" model where simulation results are tied to a fixed ledger and date until manual refresh. 
- **Engine Unification (Rust Supremacy)**:
    - Deprecated JS-side simulation logic (`simulationEngine.ts`).
    - Moved all "Future Ledger" and "Strategic Multiplier" calculations to the Rust **ScenarioManager**.
    - This ensures a single source of truth and 100% consistent calculations across the whole system.
- **Explicit Synchronization UI**:
    - Removed `localStorage` to prevent data pollution.
    - Added "Baseline Outdated / Refresh Required" real-time status alerts when live state drifts from the snapshot.
    - Automated baseline generation on first load for a "WOW" start, but required explicit refresh thereafter to maintain audit integrity.
- **Dynamic Cutoff**: Rust engine now dynamically slices "Past" and "Future" based on the user-selected `selectedDate`.

### 🛡️ Core Principles Maintained
- **Principle 1**: Actual Ledger remains 100% **Immutable**.
- **Principle 2**: Future Ledger is **In-memory Only** (No DB pollution).
- **Principle 3**: Single Authority - **Calculations only happen in one place (Rust)**.

### 🚀 Next Steps
- Verify **Survival** and **Growth** scenarios under the new v3 architecture.
- Finalize the IR/Financial Summary formatting for the Compass dashboard.

---

# 📅 AccountingFlow Daily Worklog - 2026-03-21

## 🧭 Strategic Objective: "Strategic Compass Refinement & Sustainability Analysis"

### ✅ Key Deliverables & Achievements

#### 1. Runway & Burn Logic Refinement
- **Avg. Monthly Burn**: Replaced simple "Negative Delta" with a dedicated burn rate calculation that filters for negative deltas in the scenario and averages their absolute values.
- **Runway Accuracy**: Updated the Strategic Compass to use `Current Cash / Avg. Monthly Burn` for real-world accuracy.
- **Location**: `src/core/metrics/metricRegistry.ts` (`calculateAvgBurn`).

#### 2. Equity & Funding Integration
- **Dynamic Funding Trigger**: Automated funding scenario when projected runway falls below 6 months (Targeting 18 months).
- **Dilution Analysis**: Integrated `equityEngine.ts` to calculate investor/founder share and control status (Absolute, Majority, Weak).
- **Timing Sensitivity (3M Delay)**: Added a "Timing Sensitivity" analysis comparing immediate funding vs. a 3-month delay, highlighting the increased cost of capital and dilution risk.

#### 3. Survival Probability Curve
- **Granular Risk Model**: Overhauled survival probability from a binary 90/50 model to a 5-step dynamic curve (95%, 85%, 50%, 25%, 10%) based on the "months-to-empty" runway.
- **Location**: `src/core/reporting/metricRegistry.ts` (`calculateSurvivalProbability`).

#### 4. State Persistence & Localization (UX)
- **AccountingContext Migration**: Moved all simulation parameters (multipliers, macro assumptions, valuation, etc.) to the global `AccountingContext` to ensure state is preserved across navigation.
- **Korean Localization (100%)**: Fully translated all KPI cards, detail views, formula descriptions, and input keys into Korean.
- **Location**: `src/components/shared/ExplainableKPI.tsx`, `src/pages/StrategicCompass.tsx`.

### 🛡️ Core Principles Maintained
- **Transparency**: Every metric now displays its precise calculation formula and data source in Korean.
- **Auditability**: Maintained the link between simulation results and raw engine data via the `ExplainableKPI` system.

### 🚀 Next Steps
- Finalize the CFO analysis system's automated insight generation for the Executive Report.
- Refine the PnL/Cash Flow chart's interaction based on the new funding events.

---

# 📅 AccountingFlow Daily Worklog - 2026-03-29

## 🧭 Strategic Objective: "Metric Engine Synchronization & Inflection Point Analysis"

### ✅ Key Deliverables & Achievements

#### 1. Metric Engine Synchronization (Strategic Compass & Risk Control)
- **Unified Calculation**: Refactored `riskReporter.ts` and `StrategicCompass.tsx` to share a **6-month rolling window** and **Cash-based Net Burn** logic.
- **Operational Reality**: Excluded non-operational financing inflows (investments/loans) from burn rate calculations to focus on core survival metrics.
- **System Integrity**: Ensured 100% numerical consistency between the Risk Control dashboard and Strategic Compass simulation.

#### 2. Strategic Runway Enhancement (Inflection Point Analysis)
- **Break Point Identification**: Added logic to find the **Inflection Point** (the specific month when net monthly cash flow first turns negative) within the simulation.
- **Visual Alerting**: Implemented a transition alert in the Runway KPI card: `📉 N months until net cash flow 0 (Margin extinction)`.
- **Diagnostic Transparency**: Exposed the "First Negative Month" in the KPI diagnostic inputs, linking the runway number to a concrete future event.

#### 3. Terminal Refinement & UI/UX Optimization
- **Terminology Update**: Replaced alarmist language ("적자 전환") with more precise economic terms like **"순현금흐름 0 도달 (마진 소멸)"** and **"현금 유출 가속"**.
- **Readability Upgrades**: increased font sizes and contrast for breakdown metrics (Operating In, Cash Out, Financing In) within KPI cards.
- **Burn Bridge Explanations**: Implemented conditional logic to explain mismatches between P&L Burn and Actual Cash Out (e.g., detecting prepayments vs. accruals).

### 🛡️ Core Principles Maintained
- **Economic Accuracy**: Focused on "Net Cash Flow" as the true indicator of survival, differentiating it from purely accounting-based P&L losses.
- **Actionability**: Provided "When" and "Why" context to the "How long" question of the runway metric.

### 🚀 Next Steps
- Verify the 6-month window performance as the ledger scales into long-term history.
- Expand the Burn Bridge logic to include automated AR/AP settlement aging impact.

---
**Work Session Concluded.**
Financial metrics are now synchronized, accurate, and strategically actionable across all executive dashboards.
