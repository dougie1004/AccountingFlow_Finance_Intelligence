/**
 * [DEPRECATED] JS Simulation Engine
 * Core Logic moved to Rust (Backend) for Single Source of Truth (SSOT).
 * Use Tauri invoke('run_strategic_scenario') instead.
 */

export interface BaselineFinancials {
    avgMonthlyRevenue: number;
    avgMonthlyExpense: number;
    avgMonthlyGrant: number;
}

// These functions are no longer with authority.
// They are kept here as empty placeholders if needed for types, 
// but all real work must happen in src-tauri/src/engine/simulation/scenario_manager.rs
