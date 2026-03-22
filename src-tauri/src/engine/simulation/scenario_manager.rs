use crate::core::models::{JournalEntry, LedgerScope, ScenarioDefinition, ScenarioAssumption};
use chrono::Datelike;

pub struct ScenarioManager;

impl ScenarioManager {
    /// Creates a scenario-projected ledger by cloning the actual records and applying strategic mutations.
    /// This is the core 'Strategic Sandbox' where 'What-if' cases are processed without touching real books.
    pub fn project_scenario(
        definition: ScenarioDefinition,
        actual_ledger: Vec<JournalEntry>,
        selected_date: String,
    ) -> Vec<JournalEntry> {
        let mut scenario_ledger = Vec::new();

        // 1. Process Assumptions (Mutation Map)
        let revenue_mult = Self::get_assumption(&definition.assumptions, "revenue_multiplier", 1.0);
        let expense_mult = Self::get_assumption(&definition.assumptions, "expense_multiplier", 1.0);
        let fixed_cost_delta = Self::get_assumption(&definition.assumptions, "fixed_cost_delta", 0.0);

        // 2. Map Actuals and Find Baseline for Projection
        let mut revenue_total = 0.0;
        let mut expense_total = 0.0;
        let mut months_with_data = std::collections::HashSet::new();
        
        // Parse selected_date for cutoff
        let projection_cutoff = chrono::NaiveDate::parse_from_str(&selected_date, "%Y-%m-%d")
            .unwrap_or(chrono::NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());

        let mut last_actual_date: Option<chrono::NaiveDate> = None;

        for entry in actual_ledger {
            if entry.scope != LedgerScope::Actual { continue; }

            // Extract month for average calculation
            let parsed_date = chrono::DateTime::parse_from_rfc3339(&entry.date)
                .map(|dt| dt.naive_local().date())
                .or_else(|_| chrono::NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d"));

            if let Ok(d) = parsed_date {
                // Tracking last actual date as the anchor for simulation
                if last_actual_date.is_none() || d > last_actual_date.unwrap() {
                    last_actual_date = Some(d);
                }

                // [Audit Rule] Only entries BEFORE or ON selected_date are used for run-rate
                if d <= projection_cutoff {
                    months_with_data.insert(format!("{}-{}", d.year(), d.month()));
                    if entry.entry_type == "Revenue" { revenue_total += entry.amount; }
                    else if entry.entry_type == "Expense" || entry.entry_type == "Payroll" { expense_total += entry.amount; }
                }
            }
            
            // Historical Actuals remain UNTOUCHED (Strict SSOT Principle)
            // But we include them in the scenario ledger for a unified view
            scenario_ledger.push(entry);
        }

        // 3. Project Future (The 'Compass' logic)
        // Baseline: Average per month
        let month_count = months_with_data.len().max(1) as f64;
        let avg_revenue = (revenue_total / month_count) * revenue_mult;
        let avg_expense = (expense_total / month_count) * expense_mult;

        // [BUG FIX] Project 36 months starting from month after last_actual_date (NOT selected_date)
        let anchor = last_actual_date.unwrap_or(projection_cutoff);
        let mut current_year = anchor.year();
        let mut current_month = anchor.month();

        for i in 1..=36 {
            let mut next_m = current_month + i;
            let mut next_y = current_year;
            while next_m > 12 {
                next_y += 1;
                next_m -= 12;
            }
            
            let future_date = chrono::NaiveDate::from_ymd_opt(next_y, next_m as u32, 28).unwrap();
            
            // [Safety Guard] NEVER generate entries before the anchor
            if future_date <= anchor { continue; }

            let date_str = future_date.format("%Y-%m-%d").to_string();
            scenario_ledger.push(Self::inject_strategic_event(
                definition.id.clone(),
                format!("[시나리오] 예상 매출 목표 (Proj)"),
                avg_revenue, 
                "보통예금", "상품매출", 
                "Revenue", 
                date_str.clone(),
                Some("acc_103".to_string()),
                Some("acc_401".to_string())
            ));

            // Projected Expense (Baseline + New Fixed Investment)
            scenario_ledger.push(Self::inject_strategic_event(
                definition.id.clone(),
                format!("[시나리오] 예상 운영 비용 (Proj)"),
                avg_expense + fixed_cost_delta,
                "상품매출원가", "보통예금", 
                "Expense", 
                date_str.clone(),
                Some("acc_501".to_string()),
                Some("acc_103".to_string())
            ));
        }

        scenario_ledger
    }

    /// Helper to safely retrieve assumptions
    fn get_assumption(assumptions: &[ScenarioAssumption], key: &str, default: f64) -> f64 {
        assumptions.iter()
            .find(|a| a.key == key)
            .map(|a| a.value)
            .unwrap_or(default)
    }

    /// Generates Additional Strategic Entries (e.g., simulated New Investment)
    pub fn inject_strategic_event(
        scenario_id: String,
        description: String,
        amount: f64,
        debit_account: &str,
        credit_account: &str,
        entry_type: &str,
        date: String,
        debit_account_id: Option<String>,
        credit_account_id: Option<String>,
    ) -> JournalEntry {
        JournalEntry {
            id: format!("EVENT-{}-{}", scenario_id, uuid::Uuid::new_v4()),
            date,
            description,
            vendor: None,
            debit_account: debit_account.to_string(),
            credit_account: credit_account.to_string(),
            position: None,
            amount,
            vat: 0.0,
            entry_type: entry_type.to_string(),
            status: "Simulation".to_string(),
            tax_code: None,
            version: 1,
            last_modified_by: Some("ScenarioManager".to_string()),
            attachment_url: None,
            ocr_data: None,
            compliance_context: Some("Automated Strategic Event".to_string()),
            tax_base_amount: None,
            audit_trail: vec!["Generated by ScenarioManager".to_string()],
            parse_status: None,
            raw_data_snapshot: None,
            transaction_group_id: None,
            employee_tags: vec![],
            is_insurance_part: false,
            debit_account_id,
            credit_account_id,
            scope: LedgerScope::Scenario,
            scenario_id: Some(scenario_id),
            ..Default::default()
        }
    }
}
