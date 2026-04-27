// Modular Architecture
use tauri::Manager;
pub mod core;
pub mod engine;
pub mod scm;
pub mod tax;
pub mod ai;
pub mod governance;
pub mod inventory;
pub mod utils;

mod commands;
mod scenario_manager;

fn load_env_from_parent() {
    let is_debug = cfg!(debug_assertions);
    let env_file = if is_debug { ".env.development" } else { ".env.production" };
    
    println!("[Antigravity] Build Mode: {}, Target Env: {}", if is_debug { "Debug" } else { "Release" }, env_file);

    // Try multiple search paths for the env file
    let search_paths = vec![
        format!("./{}", env_file),
        format!("../{}", env_file),
        "./.env".to_string(),
        "../.env".to_string(),
    ];

    let mut found = false;
    for path in search_paths {
        if dotenvy::from_filename(&path).is_ok() {
            println!("[Antigravity] Successfully loaded environment from: {}", path);
            found = true;
            break;
        }
    }

    if !found {
        println!("[Warning] No environment file (.env, .env.development, .env.production) found in search paths.");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // [Antigravity] Securely link project .env to Rust runtime
    load_env_from_parent();

    if std::env::var("GEMINI_API_KEY").is_err() {
        println!("[Warning] GEMINI_API_KEY is not set. AI features will be unavailable. Please check project root .env");
    }

    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir().unwrap_or(std::path::PathBuf::from("."));
            if !app_dir.exists() {
                let _ = std::fs::create_dir_all(&app_dir);
            }
            crate::ai::user_learning::init(&app_dir);
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::parse_transaction,
            commands::process_batch,
            commands::process_mass_ai_batch,
            commands::process_universal_file,
            commands::run_closing,
            commands::run_tax_bridge,
            commands::create_snapshot,
            commands::verify_proof,
            commands::generate_tax_forms,
            commands::check_modification_allowed,
            commands::generate_filing,
            commands::run_depreciation,
            commands::process_scm_order,
            commands::run_validation_checks,
            commands::run_simulation_data,
            commands::approve_partner,
            commands::save_tenant_config,
            commands::load_tenant_config,
            commands::batch_export_with_validation,
            commands::detect_batch_anomalies,
            commands::generate_cash_flow_forecast,
            commands::generate_management_report,
            commands::run_erp_migration,
            commands::verify_receipt_compliance,
            commands::evaluate_inventory_assets,
            commands::estimate_corporate_tax,
            commands::get_tax_adjustments,
            commands::chat_with_compliance,
            commands::get_bank_presets,
            commands::get_file_headers,
            commands::suggest_file_mapping,
            commands::process_file_with_mapping,
            commands::load_demo_scenario,
            commands::generate_journal_id,
            commands::get_startup_insights,
            commands::process_advanced_ledger,
            commands::generate_bridge_package,
            commands::get_compliance_mappings,
            commands::get_ir_financial_summary,
            commands::generate_tax_pro_pack,
            commands::parse_universal_file,
            commands::run_strategic_scenario,
            commands::get_audit_issues,
            commands::get_audit_universe,
            commands::ai_suggest_risk_score,
            commands::generate_audit_priorities,
            commands::get_all_scenarios,
            commands::ask_ai_assistant,
            commands::train_knowledge_from_file,
            commands::generate_close_readiness_report,
            commands::get_quota_status,
            commands::sync_quota_status,
            commands::save_account_preference,
            scenario_manager::debug_echo_journals,


            crate::core::strategic::cap_table_service::simulate_cap_table_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
