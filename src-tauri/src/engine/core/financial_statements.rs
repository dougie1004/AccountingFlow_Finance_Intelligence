use crate::core::models::*;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

// --- Data Structures ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FinancialOverview {
    pub total_revenue: f64,
    pub total_expenses: f64,
    pub net_income: f64,
    pub profit_margin: f64,
    pub top_expense_categories: Vec<ExpenseCategory>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseCategory {
    pub category: String,
    pub amount: f64,
    pub percentage: f64,
    pub trend: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrendInsight {
    pub category: String,
    pub insight: String,
    pub severity: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RiskAssessment {
    pub overall_risk: String,
    pub cash_flow_risk: String,
    pub compliance_risk: String,
    pub operational_risk: String,
    pub mitigation_strategies: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AssetInsights {
    pub total_fixed_assets: f64,
    pub annual_depreciation: f64,
    pub next_5_year_forecast: Vec<f64>,
}

// --- Core Calculation Logic (Determinstic) ---

pub fn calculate_financial_overview(ledger: &[JournalEntry]) -> FinancialOverview {
    let total_revenue: f64 = ledger.iter()
        .filter(|e| e.entry_type == "Revenue")
        .map(|e| e.amount)
        .sum();

    let total_expenses: f64 = ledger.iter()
        .filter(|e| e.entry_type == "Expense")
        .map(|e| e.amount)
        .sum();

    let net_income = total_revenue - total_expenses;
    let profit_margin = if total_revenue > 0.0 {
        (net_income / total_revenue) * 100.0
    } else {
        0.0
    };

    let mut expense_map: HashMap<String, f64> = HashMap::new();
    for entry in ledger.iter().filter(|e| e.entry_type == "Expense") {
        let category = entry.debit_account.clone();
        *expense_map.entry(category).or_insert(0.0) += entry.amount;
    }

    let mut top_expense_categories: Vec<ExpenseCategory> = expense_map
        .into_iter()
        .map(|(category, amount)| {
            let percentage = if total_expenses > 0.0 { (amount / total_expenses) * 100.0 } else { 0.0 };
            ExpenseCategory {
                category: category.clone(),
                amount,
                percentage,
                trend: "Stable".to_string(),
            }
        })
        .collect();

    top_expense_categories.sort_by(|a, b| b.amount.partial_cmp(&a.amount).unwrap_or(std::cmp::Ordering::Equal));
    top_expense_categories.truncate(5);

    FinancialOverview {
        total_revenue,
        total_expenses,
        net_income,
        profit_margin,
        top_expense_categories,
    }
}

pub fn analyze_trends(ledger: &[JournalEntry]) -> Vec<TrendInsight> {
    let mut insights = Vec::new();

    let consumables: f64 = ledger.iter()
        .filter(|e| e.debit_account.contains("소모품"))
        .map(|e| e.amount)
        .sum();

    if consumables > 1_000_000.0 {
        insights.push(TrendInsight {
            category: "소모품비".to_string(),
            insight: "소모품비 지출 규모가 임계치를 초과했습니다.".to_string(),
            severity: "Medium".to_string(),
        });
    }

    let entertainment: f64 = ledger.iter()
        .filter(|e| e.debit_account.contains("접대비"))
        .map(|e| e.amount)
        .sum();

    if entertainment > 500_000.0 {
        insights.push(TrendInsight {
            category: "접대비".to_string(),
            insight: "접대비 세법상 한도 관리가 필요합니다.".to_string(),
            severity: "High".to_string(),
        });
    }

    insights
}

pub fn assess_risks(ledger: &[JournalEntry], overview: &FinancialOverview) -> RiskAssessment {
    let mut mitigation_strategies = Vec::new();

    let cash_flow_risk = if overview.net_income < 0.0 {
        mitigation_strategies.push("비용 절감 프로그램 검토".to_string());
        "High".to_string()
    } else {
        "Low".to_string()
    };

    let high_value_txs = ledger.iter().filter(|e| e.amount > 30_000_000.0).count();
    let compliance_risk = if high_value_txs > 5 {
        mitigation_strategies.push("고액 거래 승인 절차 점검".to_string());
        "High".to_string()
    } else {
        "Low".to_string()
    };

    RiskAssessment {
        overall_risk: if cash_flow_risk == "High" || compliance_risk == "High" { "High".to_string() } else { "Medium".to_string() },
        cash_flow_risk,
        compliance_risk,
        operational_risk: "Medium".to_string(),
        mitigation_strategies,
    }
}

pub fn calculate_asset_insights(assets: &[Asset]) -> AssetInsights {
    let total_fixed_assets = assets.iter().map(|a| a.cost - a.accumulated_depreciation).sum();
    
    let annual_depreciation: f64 = assets.iter().map(|a| {
        let schedule = crate::engine::core::assets::generate_depreciation_schedule(a);
        schedule.items.first().map(|i| i.depreciation_expense).unwrap_or(0.0)
    }).sum();

    let mut next_5_year_forecast = vec![0.0; 5];
    for asset in assets {
        let schedule = crate::engine::core::assets::generate_depreciation_schedule(asset);
        for (i, item) in schedule.items.iter().enumerate() {
            if i < 5 {
                next_5_year_forecast[i] += item.depreciation_expense;
            }
        }
    }

    AssetInsights {
        total_fixed_assets,
        annual_depreciation,
        next_5_year_forecast,
    }
}
