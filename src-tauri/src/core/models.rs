use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ParseStatus {
    Ok,
    Warning,
    NeedConfirm,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RowType {
    Transaction,
    Summary,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum LedgerScope {
    #[default]
    Actual,   // Real, verified accounting data
    Forecast, // AI-projected future data
    Scenario, // What-if strategic simulation data
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioAssumption {
    pub key: String,         // e.g., "revenue_multiplier", "fixed_cost_delta"
    pub value: f64,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioDefinition {
    pub id: String,
    pub name: String,
    pub base_snapshot_id: String,
    pub assumptions: Vec<ScenarioAssumption>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum ConfidenceLevel {
    #[default]
    Low,
    Medium,
    High,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationSuggestion {
    pub suggested_account: Option<String>,
    pub suggested_payment_method: Option<String>,
    pub confidence: ConfidenceLevel,
    pub reasoning: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ParsedTransaction {
    pub date: Option<String>,
    pub id: Option<String>,
    #[serde(default)]
    pub amount: f64,
    #[serde(default)]
    pub vat: f64,
    #[serde(default)]
    pub tax_base_amount: Option<f64>, // For Tax Credit Base (e.g. Salary amount)
    #[serde(default)]
    pub quantity: Option<f64>,
    pub entry_type: Option<String>,
    pub description: Option<String>,
    pub vendor: Option<String>,
    pub vendor_reg_no: Option<String>,
    pub vendor_representative: Option<String>,
    pub vendor_address: Option<String>,
    pub reasoning: String,
    pub account_name: Option<String>,
    pub suggestion: Option<ClassificationSuggestion>,
    #[serde(default)]
    pub needs_clarification: bool,
    pub clarification_prompt: Option<String>,
    pub clarification_options: Option<Vec<String>>,
    #[serde(default)]
    pub is_consultation: bool,
    pub confidence: Option<String>,
    pub payment_method: Option<String>,
    pub bank_name: Option<String>,
    pub bank_account: Option<String>,
    pub debit_account: Option<String>,
    pub credit_account: Option<String>,
    #[serde(default)]
    pub audit_trail: Vec<String>,

    // [Antigravity] Safe-Parser Fields
    pub parse_status: Option<ParseStatus>,
    pub raw_data_snapshot: Option<String>,
    pub parse_error_msg: Option<String>,

    // [Step 1] Payroll/Insurance Splitting
    pub transaction_group_id: Option<String>,
    #[serde(default)]
    pub employee_tags: Vec<String>,
    #[serde(default)]
    pub is_insurance_part: bool,
    #[serde(default)]
    pub is_journal_mode: bool,
    pub position: Option<String>,
    pub inference: Option<AccountInference>,

    // [CFO Architecture] Ledger Isolation
    #[serde(default = "default_ledger_scope")]
    pub scope: LedgerScope,
    pub scenario_id: Option<String>,

    // [CFO Strategy] Card Deep-Dive (Installments & Benefits)
    pub installment_period: Option<u32>,
    pub installment_seq: Option<u32>,
    pub benefit_amount: Option<f64>,
    pub billable_amount: Option<f64>,
    pub principal_amount: Option<f64>,
    pub fee_amount: Option<f64>,
    pub tax_amount: Option<f64>,
    pub total_amount: Option<f64>,
    pub row_type: Option<RowType>,
    pub reconciliation_status: Option<String>,
    #[serde(default)]
    pub is_vat_explicit: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum ExpenseCategory {
    Infra,
    Software,
    Marketing,
    Logistics,
    Welfare,
    Office,
    TaxAndPublic,
    Travel,
    Other,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AccountInference {
    pub category: ExpenseCategory,
    pub account_name: String,
    pub reasoning: String,
    pub confidence: String,
}

fn default_ledger_scope() -> LedgerScope {
    LedgerScope::Actual
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub id: String,
    pub date: String,
    pub description: String,
    pub vendor: Option<String>,
    pub debit_account: String,
    pub credit_account: String,
    pub position: Option<String>,
    pub amount: f64,
    pub vat: f64,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub status: String,
    pub tax_code: Option<String>,
    #[serde(default)]
    pub version: u32,
    pub last_modified_by: Option<String>,
    pub attachment_url: Option<String>,
    pub ocr_data: Option<String>,
    pub compliance_context: Option<String>,
    pub matching_status: Option<String>,
    #[serde(default)]
    pub tax_base_amount: Option<f64>,
    #[serde(default)]
    pub audit_trail: Vec<String>,
    pub parse_status: Option<ParseStatus>,
    pub raw_data_snapshot: Option<String>,

    // [Step 1] Payroll/Insurance Splitting
    pub transaction_group_id: Option<String>,
    #[serde(default)]
    pub employee_tags: Vec<String>,
    #[serde(default)]
    pub is_insurance_part: bool,

    // [CFO Architecture] Ledger Isolation
    pub debit_account_id: Option<String>,
    pub credit_account_id: Option<String>,
    #[serde(default = "default_ledger_scope")]
    pub scope: LedgerScope,
    pub scenario_id: Option<String>,

    pub installment_period: Option<u32>,
    pub installment_seq: Option<u32>,
    pub benefit_amount: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FinancialSummary {
    pub cash: f64,
    pub revenue: f64,
    pub expenses: f64,
    pub ar: f64,
    pub ap: f64,
    pub net_income: f64,
    pub capital: f64,
    pub retained_earnings: f64,
    pub fixed_assets: f64,
    pub vat_net: f64,
    pub total_equity: f64,
    pub inventory_value: f64,
    pub total_assets: f64,
    pub total_liabilities: f64,
}


#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EntityMetadata {
    pub company_name: String,
    pub reg_id: String,
    pub rep_name: String,
    pub corp_type: String,
    pub fiscal_year_end: String,
    #[serde(default)]
    pub is_startup_tax_benefit: bool,
    #[serde(default)]
    pub num_employees: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TaxPolicy {
    pub depreciation_method: String,
    pub entertainment_limit_base: f64,
    pub vat_filing_cycle: String,
    pub ai_governance_threshold: f64,
    pub insurance_rates: Option<InsuranceRates>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct InsuranceRates {
    pub national_pension: f64, // e.g. 0.045
    pub health_insurance: f64, 
    pub long_term_care: f64,  // Rate within health insurance
    pub employment_insurance_employee: f64,
    pub employment_insurance_employer: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct InitialBalance {
    pub account: String,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TenantConfig {
    pub tenant_id: String,
    pub closing_date: Option<String>,
    #[serde(default)]
    pub is_initialized: bool,
    #[serde(default)]
    pub is_read_only: bool,
    pub entity_metadata: Option<EntityMetadata>,
    pub tax_policy: Option<TaxPolicy>,
    #[serde(default)]
    pub initial_balances: Vec<InitialBalance>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SimulationResult {
    pub ledger: Vec<JournalEntry>,
    pub assets: Vec<Asset>,
    pub orders: Vec<Order>,
    pub adjustments: Vec<TaxAdjustment>,
    pub validation_results: Vec<ValidationResult>,
    pub company_config: TenantConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TaxAdjustment {
    pub category: String,
    pub book_amount: f64,
    pub tax_amount: f64,
    pub difference: f64,
    pub adjustment_type: String,
    pub disposal: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResponse {
    pub transaction: Option<ParsedTransaction>,
    pub vendor_status: String,
    pub suggested_vendor: Option<Partner>,
    pub compliance_review: Option<ComplianceReview>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Partner {
    pub id: String,
    pub name: String,
    pub status: String,
    pub partner_type: String,
    pub partner_code: Option<String>,
    pub reg_no: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OrderItem {
    pub sku: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Order {
    pub id: String,
    pub date: String,
    pub partner_id: String,
    pub type_field: String,
    pub status: String,
    pub items: Vec<OrderItem>,
    pub total_amount: f64,
    pub vat: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub name: String,
    pub acquisition_date: String,
    pub cost: f64,
    pub depreciation_method: String,
    pub useful_life: u32,
    pub residual_value: f64,
    pub accumulated_depreciation: f64,
    #[serde(default)]
    pub base_useful_life: Option<u32>,
    #[serde(default)]
    pub is_sme_special_life: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DepreciationScheduleItem {
    pub period: String,
    pub beginning_value: f64,
    pub depreciation_expense: f64,
    pub accumulated_depreciation: f64,
    pub ending_value: f64,
    pub tax_limit: Option<f64>,
    pub disallowed_amount: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetSchedule {
    pub asset_id: String,
    pub items: Vec<DepreciationScheduleItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryBatch {
    pub id: String,
    pub acquisition_date: String,
    pub quantity: f64,
    pub unit_cost: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItem {
    pub id: String,
    pub name: String,
    pub sku: String,
    pub category: String,
    pub batches: Vec<InventoryBatch>,
    pub valuation_method: String,
    pub last_nrv: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ComplianceReview {
    pub status: String,
    pub message: String,
    pub review_logs: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AuditSnapshot {
    pub total_amount: f64,
    pub record_count: usize,
    pub timestamp: String,
    pub integrity_hash: String,
    pub ledger: Vec<JournalEntry>,
    pub adjustments: Vec<TaxAdjustment>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub status: String,
    pub message: String,
    pub field: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct TaxFilingPackage {
    pub xml_content: String,
    pub pii_density: f32,
    pub risk_summary: String,
    pub requires_audit: bool,
}

// --- [L4 Advanced] Governance & Audit Heatmap Models ---

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AuditIssue {
    pub id: u32,
    pub issue_title: String,
    pub description: String,
    pub severity: String,
    pub detected_at: String,
    pub row_index: Option<u32>,
    pub raw_row_data: Option<String>,
    pub recommendations: Option<String>,
    pub evidence_quote: Option<String>,
    pub audit_id: Option<String>,
    pub evidence_image: Option<String>,
    pub manager_comment: Option<String>,
    pub remediation_plan: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct AuditEntity {
    pub id: u32,
    pub unit_name: String,
    pub category: String,
    pub impact_score: f32,
    pub likelihood_score: f32,
    pub status: String,
    pub responsible_dept: String,
    pub last_audited: String,
    pub ai_risk_analysis: AiRiskAnalysis,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct AiRiskAnalysis {
    pub reason: String,
    pub impact_score: f32,
    pub likelihood_score: f32,
    pub impact_breakdown: ImpactBreakdown,
    pub likelihood_breakdown: LikelihoodBreakdown,
    pub audit_approach: Option<String>,
    pub reference_standard: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct ImpactBreakdown {
    pub financial_loss: f32,
    pub strategic_impact: f32,
    pub reputation_risk: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct LikelihoodBreakdown {
    pub historical_frequency: f32,
    pub control_weakness: f32,
    pub process_complexity: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
// Note: Frontend ScenarioManager.tsx uses snake_case for these fields!
pub struct Scenario {
    pub id: String,
    pub category: String,
    pub name: String,
    pub risk_level: String,
    pub description: String,
    pub origin_audit_type: String,
    pub origin_department: String,
    pub detected_date: String,
    pub is_ai_generated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CloseCheck {
    pub name: String,
    pub status: String, // "PASSED", "WARNING", "BLOCKER"
    pub message: String,
    pub value: Option<String>,
    pub affected_ids: Vec<String>, // [PROD READY] For UI navigation
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CloseReadinessReport {
    pub status: String, // "OPEN", "READY", "BLOCKED"
    pub score: i32,
    pub checks: Vec<CloseCheck>,
    pub warnings: Vec<String>,
    pub blockers: Vec<String>,
    pub period: String,
}
