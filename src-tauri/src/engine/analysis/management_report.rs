use crate::core::models::*;
use crate::engine::core::financial_statements as fs_core;
use serde::{Serialize, Deserialize};
use serde_json::json;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ManagementReport {
    pub report_title: String,
    pub report_date: String,
    pub executive_summary: String,
    pub financial_overview: fs_core::FinancialOverview,
    pub scm_insights: ScmInsights,
    pub tax_compliance: TaxCompliance,
    pub trend_analysis: Vec<fs_core::TrendInsight>,
    pub risk_assessment: fs_core::RiskAssessment,
    pub recommendations: Vec<String>,
    pub detailed_analysis: String,
    pub disclaimer: Option<String>,
    pub checklist: Vec<String>,
    pub bps_insight: Option<String>,
    pub asset_insights: fs_core::AssetInsights,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScmInsights {
    pub inventory_cost: f64,
    pub inventory_nrv: f64,
    pub valuation_loss: f64,
    pub alert: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaxCompliance {
    pub book_income: f64,
    pub taxable_income: f64,
    pub estimated_tax: f64,
    pub effective_rate: f64,
    pub rnd_credit: f64,
    pub employment_credit: f64,
    pub major_adjustment: String,
}

pub async fn generate_management_report(
    ledger: Vec<JournalEntry>,
    inventory: Vec<crate::core::models::InventoryItem>,
    assets: Vec<Asset>,
    period_start: String,
    period_end: String,
) -> Result<ManagementReport, String> {
    // 1. Core Engine 호출 (Immutable data retrieval)
    let financial_overview = fs_core::calculate_financial_overview(&ledger);
    let trend_analysis = fs_core::analyze_trends(&ledger);
    let risk_assessment = fs_core::assess_risks(&ledger, &financial_overview);
    let asset_insights = fs_core::calculate_asset_insights(&assets);

    // 2. Integration logic (Tax, SCM)
    let scm_val = crate::scm::scm_service::evaluate_lcm(&inventory);
    let scm_insights = ScmInsights {
        inventory_cost: scm_val.total_cost,
        inventory_nrv: scm_val.total_nrv,
        valuation_loss: scm_val.adjustment_needed,
        alert: if scm_val.adjustment_needed > 0.0 { "재고 감액 손실이 발생했습니다.".to_string() } else { "적정 재고 가치 유지 중".to_string() },
    };

    let adjustments = crate::tax::tax_bridge::calculate_tax_adjustments(ledger.clone());
    let total_adj: f64 = adjustments.iter().map(|a| a.difference).sum();
    let taxable_income = financial_overview.net_income + total_adj;
    let rnd_expense: f64 = ledger.iter().filter(|e| e.description.contains("R&D")).map(|e| e.amount).sum();
    
    let est_tax = crate::tax::tax_bridge::calculate_estimated_tax(financial_overview.total_revenue, taxable_income, true, rnd_expense, 0, 0);

    let tax_compliance = TaxCompliance {
        book_income: financial_overview.total_revenue,
        taxable_income: est_tax.taxable_income,
        estimated_tax: est_tax.final_tax,
        effective_rate: est_tax.effective_rate,
        rnd_credit: est_tax.rnd_credit,
        employment_credit: est_tax.employment_credit,
        major_adjustment: "Core Tax Bridge 연동됨".to_string(),
    };

    // 3. AI Insights (Gemini 2.0)
    let (executive_summary, detailed_analysis, recommendations) = 
        generate_ai_analysis(&financial_overview, &trend_analysis, &risk_assessment, &scm_insights, &tax_compliance, &asset_insights).await?;

    Ok(ManagementReport {
        report_title: format!("{} ~ {} 경영 분석 리포트", period_start, period_end),
        report_date: chrono::Local::now().format("%Y년 %m월 %d일").to_string(),
        executive_summary,
        financial_overview,
        scm_insights,
        tax_compliance,
        trend_analysis,
        risk_assessment,
        recommendations,
        detailed_analysis,
        disclaimer: Some("본 리포트는 AI 분석 결과이며 법적 효력이 없습니다.".to_string()),
        checklist: vec!["R&D 증빙 점검".to_string()],
        bps_insight: None,
        asset_insights,
    })
}

async fn generate_ai_analysis(
    overview: &fs_core::FinancialOverview,
    _trends: &[fs_core::TrendInsight],
    risks: &fs_core::RiskAssessment,
    _scm: &ScmInsights,
    _tax: &TaxCompliance,
    _assets: &fs_core::AssetInsights,
) -> Result<(String, String, Vec<String>), String> {
    let api_key = std::env::var("GEMINI_API_KEY").map_err(|_| "환경 변수 'GEMINI_API_KEY'가 설정되지 않았습니다.".to_string())?;

    let prompt = format!("Context: Revenue ₩{:.0}, Net Income ₩{:.0}, Risks: {}", overview.total_revenue, overview.net_income, risks.overall_risk);

    let client = reqwest::Client::new();
    let response = client
        .post(format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={}", api_key))
        .json(&json!({ "contents": [{ "parts": [{ "text": prompt }] }] }))
        .send()
        .await
        .map_err(|e| format!("AI 호출 실패: {}", e))?;

    let json_res: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    
    // Simplified parsing for brevity of migration
    let text = json_res["candidates"][0]["content"]["parts"][0]["text"].as_str().unwrap_or("No Response");

    Ok((
        "AI 요약 정보입니다.".to_string(),
        text.to_string(),
        vec!["비용 최적화".to_string(), "자금 조달 계획 수립".to_string()]
    ))
}
