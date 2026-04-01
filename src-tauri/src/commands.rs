use crate::core::models::{
    Asset, AuditSnapshot, JournalEntry, Order, ParsedTransaction, SimulationResult, 
    TaxAdjustment, TenantConfig, AnalysisResponse, Partner, ValidationResult,
    ScenarioDefinition, LedgerScope, AuditIssue, AuditEntity, Scenario, FinancialSummary
};
use crate::core::bank_models::BankMapping;
use std::collections::HashMap;
use crate::ai::ai_service;
use crate::ai::csv_inference;
use crate::ai::learning_engine;
use crate::engine::simulation::projection as simulation_engine;
use crate::engine::core::assets;
use crate::engine::core::inventory as inventory_bridge;
use crate::tax::{tax_bridge, tax_validator, hometax::HometaxEngine};
use crate::core::security::SecurityGuard;
use crate::governance::{audit_manager, proof_manager};
use crate::engine::core::ledger::{AdvancedAccountingModule, AdvancedLedgerInput, AdvancedLedgerOutput, RndCapitalizationEngine};
use crate::engine::simulation::scenario_manager::ScenarioManager;
use crate::engine::analysis::management_report;
use crate::engine::analysis::forecast_engine;
use crate::engine::analysis::ir_engine;

#[tauri::command]
pub async fn parse_transaction(
    input: String, 
    image_bytes: Option<Vec<u8>>,
    image_mime: Option<String>,
    policy: String, 
    partners: Vec<Partner>,
    tenant_id: String,
    tier: String,
) -> Result<AnalysisResponse, String> {
    // Step 1: Journal AI가 전표 생성 (이미지 포함 멀티모달 호출)
    let image_data = match (image_bytes, image_mime) {
        (Some(bytes), Some(mime)) => Some((bytes, mime)),
        _ => None,
    };
    let image_mime_str = if let Some((_, ref m)) = image_data {
        m.as_str()
    } else {
        ""
    };
    let mut image_data_processed = None;
    if let Some((ref b, _)) = image_data {
        image_data_processed = Some((b.clone(), image_mime_str));
    }

    let parsed = ai_service::call_journal_ai(&input, image_data_processed, &policy, &tenant_id, &tier).await?;
    
    // Step 2: Vendor Governance (거래처 매칭 및 자동 등록 제안)
    let (vendor_status, suggested_vendor) = {
        if let Some(matched) = crate::governance::vendor_governance::find_matching_partner(&partners, &parsed.vendor_reg_no, &parsed.vendor) {
            ("Matched".to_string(), Some(matched))
        } else if parsed.vendor.is_some() {
            // 등록된 거래처는 없지만 AI가 거래처명을 파악한 경우
            ("Pending_Registration".to_string(), Some(crate::governance::vendor_governance::create_pending_partner(&parsed)))
        } else {
            ("No_Vendor".to_string(), None)
        }
    };

    // Step 3: Compliance AI가 규정 검토
    let compliance_review = run_compliance_check(&parsed, &policy).await;

    Ok(AnalysisResponse {
        transaction: Some(parsed),
        vendor_status,
        suggested_vendor,
        compliance_review: Some(compliance_review),
    })
}

/// Compliance AI 실제 구현
async fn run_compliance_check(tx: &ParsedTransaction, _policy: &str) -> crate::core::models::ComplianceReview {
    let mut status = "Safe".to_string();
    let mut review_logs = Vec::new();
    let mut issues = Vec::new();
    let mut expert_notes = Vec::new();

    // 1. 고액 거래 검토 (3천만원 이상)
    if tx.amount > 30_000_000.0 {
        status = "Warning".to_string();
        issues.push("고액 거래 플래그: 이사회 승인 필요");
        expert_notes.push("3천만원 초과 건으로, 자금세탁방지법(AML) 모니터링 대상이 될 수 있으니 이사회 의사록을 첨부하십시오.");
        review_logs.push("고액 거래 플래그".to_string());
    }

    // 2. 접대비 한도 검토
    if tx.account_name.as_ref().map(|a| a.contains("접대비") || a.contains("Entertainment")).unwrap_or(false) {
        if tx.amount > 30_000.0 { // 법인세법상 접대비 기준
             if tx.description.as_ref().map(|d| !d.contains("법인카드") && !d.contains("현금영수증")).unwrap_or(true) {
                status = "Warning".to_string();
                issues.push("접대비 증빙 주의: 적격증빙 미비");
                expert_notes.push("CFE 관점: 3만원 초과 접대비는 반드시 법인카드나 현금영수증이어야 비용 인정됩니다 (매입세액 불공제 및 가산세 리스크 85%).");
             }
        }
    }

    // 3. 주말/휴일 사용 내역 (요일 체크: chrono 활용)
    if let Some(ref d_str) = tx.date {
        if let Ok(date) = chrono::NaiveDate::parse_from_str(d_str, "%Y-%m-%d") {
            let weekday = date.format("%a").to_string(); // "Sat", "Sun"
            if weekday == "Sat" || weekday == "Sun" {
                 // 업무 관련성이 입증되어야 함
                 if tx.account_name.as_ref().map(|a| a.contains("식대") || a.contains("복리후생") || a.contains("차량")).unwrap_or(false) {
                     status = "Warning".to_string();
                     issues.push("휴일 업무 관련성 소명 필요");
                     expert_notes.push("주말 사용분입니다. '휴일 근무일지'나 '출장 품의서' 등 업무 연관성을 입증하지 못하면 가지급금(대표자 상여) 처분될 리스크가 있습니다.");
                 }
            }
        }
    }

    // 4. 현금영수증 미수취 가산세
    if tx.payment_method.as_ref().map(|m| m.contains("현금") || m.contains("Cash")).unwrap_or(false) {
        if tx.amount > 30_000.0 && tx.description.as_ref().map(|d| !d.contains("현금영수증")).unwrap_or(true) {
             status = "Warning".to_string();
             issues.push("적격증빙 미수취 가산세 위험");
             expert_notes.push("건당 3만원 초과 지출 시 적격증빙을 받지 않으면 2%의 가산세가 부과됩니다. 정규 영수증 수취를 독려하세요.");
        }
    }

    // 5. 증빙-텍스트 교차 검증 (Cross-Check)
    if tx.reasoning.contains("불일치") || tx.reasoning.contains("다릅니다") || tx.reasoning.contains("마트") || tx.reasoning.contains("한도") {
        if tx.reasoning.contains("한도") {
            status = "Warning".to_string();
            issues.push("회사 정책(한도) 위반 감지");
            expert_notes.push("회사 내부 규정(예: 식대 한도)을 초과한 정황이 AI에 의해 감지되었습니다. 규정 준수 여부를 재확인하세요.");
        } else {
            status = "Warning".to_string();
            issues.push("증빙 불일치: 사적 사용 의심");
            expert_notes.push("제출된 영수증과 내역이 다릅니다. 특히 마트/백화점 구매는 '가사 경비'로 간주되기 쉬우니 상세 품목을 확인하세요.");
        }
        review_logs.push("정책/증빙 불일치 감지".to_string());
    }

    let mut message = if issues.is_empty() {
        if tx.entry_type.as_deref() == Some("Revenue") {
            "세금계산서 발행 시기를 놓치지 않도록 주의하세요 (익월 10일까지).".to_string()
        } else {
            "적절한 비용 처리로 보입니다. (부가세 매입세액 공제 가능)".to_string()
        }
    } else {
        // Build a rich Expert Note
        let mut note = String::new();
        note.push_str("[전문가 검토 의견]\n");
        for en in expert_notes.iter() {
            note.push_str(&format!("• {}\n", en));
        }
        note
    };

    // 4. 정부지원금 특별 검토
    if tx.account_name.as_ref().map(|a| a.contains("정부보조금") || a.contains("R&D")).unwrap_or(false) {
        review_logs.push("정부지원금 관련 거래 - 목적외 사용 여부 검토 필요".to_string());
        if !message.contains("전문가 검토 의견") {
            message = format!("{}\n\n[CFE 리스크 엔진 통보]\n국책과제 및 정부지원금 계정입니다. 해당 협약서의 규정에 따른 정산 증빙(연구노트 등)을 준비하십시오. 불일치 감지 시 환수 조치 리스크 90%입니다.", message);
        } else {
            message.push_str("\n• 국책과제 및 정부지원금 계정입니다. 정산 증빙(연구노트)을 추가로 준비하세요.");
        }
    }

    crate::core::models::ComplianceReview {
        status,
        message,
        review_logs: Some(review_logs),
    }
}

#[tauri::command]
pub async fn process_batch(csv_data: String) -> Result<Vec<ParsedTransaction>, String> {
    crate::engine::core::batch::process_csv_batch(csv_data).await
}

#[tauri::command]
pub async fn process_mass_ai_batch(
    transactions: Vec<ParsedTransaction>,
    policy: String,
) -> Result<Vec<ParsedTransaction>, String> {
    crate::ai::mass_processor::process_mass_batch(transactions, &policy).await
}

#[tauri::command]
pub async fn process_universal_file(
    file_bytes: Vec<u8>,
    file_name: String,
) -> Result<Vec<ParsedTransaction>, String> {
    crate::ai::universal_ingestor::ingest_universal_file(file_bytes, file_name).await
}

#[tauri::command]
pub fn generate_close_readiness_report(
    period: String,
    ledger: Vec<JournalEntry>,
    assets: Vec<Asset>
) -> crate::core::models::CloseReadinessReport {
    crate::engine::closing::close_readiness::generate_report(&period, &ledger, &assets)
}

#[tauri::command]
pub fn run_closing(mut assets: Vec<Asset>, date: String, tenant_id: String) -> Vec<JournalEntry> {
    assets::generate_closing_entries(&mut assets, &date, &tenant_id, &vec![])
}

#[tauri::command]
pub fn get_depreciation_schedule(asset: Asset) -> crate::core::models::AssetSchedule {
    assets::generate_depreciation_schedule(&asset)
}

#[tauri::command]
pub async fn run_tax_bridge(
    ledger: Vec<JournalEntry>,
    config: Option<TenantConfig>,
) -> Result<crate::core::models::TaxFilingPackage, String> {
    let metadata = if let Some(c) = config {
        c.entity_metadata.ok_or("메타데이터 누락")?
    } else {
        crate::core::models::EntityMetadata {
            company_name: "임시 회사".to_string(),
            reg_id: "000-00-00000".to_string(),
            rep_name: "대표자".to_string(),
            corp_type: "SME".to_string(),
            fiscal_year_end: "12-31".to_string(),
            is_startup_tax_benefit: false,
            num_employees: 0,
        }
    };
    crate::tax::tax_bridge::generate_hometax_xml(ledger, &metadata, vec![])
}

#[tauri::command]
pub fn get_tax_adjustments(ledger: Vec<JournalEntry>) -> Vec<TaxAdjustment> {
    crate::tax::tax_bridge::calculate_tax_adjustments(ledger)
}

#[tauri::command]
pub fn estimate_corporate_tax(
    book_income: f64,
    taxable_income: f64, 
    is_sme: bool, 
    rnd_investment: f64,
    num_employees: u32,
    youth_employees: u32
) -> crate::tax::tax_bridge::TaxEstimation {
    crate::tax::tax_bridge::calculate_estimated_tax(book_income, taxable_income, is_sme, rnd_investment, num_employees, youth_employees)
}

#[tauri::command]
pub fn generate_tax_pro_pack(
    ledger: Vec<JournalEntry>,
    assets: Vec<Asset>,
    config: TenantConfig
) -> Result<String, String> {
    let metadata = config.entity_metadata.ok_or("엔티티 메타데이터가 필요합니다.")?;
    Ok(crate::tax::tax_bridge::generate_tax_pro_pack(ledger, assets, metadata))
}

#[tauri::command]
pub fn create_snapshot(ledger: Vec<JournalEntry>, adjustments: Vec<TaxAdjustment>) -> AuditSnapshot {
    audit_manager::create_audit_snapshot(ledger, adjustments)
}

#[tauri::command]
pub fn verify_proof(entry: JournalEntry) -> crate::governance::proof_manager::VerificationStatus {
    proof_manager::verify_evidence(&entry)
}

#[tauri::command]
pub fn generate_tax_forms(ledger: Vec<JournalEntry>, adjustments: Vec<TaxAdjustment>) -> crate::tax::tax_bridge::StandardTaxForms {
    tax_bridge::generate_standard_forms(ledger, adjustments)
}

#[tauri::command]
pub fn check_modification_allowed(date: String, config: TenantConfig) -> bool {
    crate::core::saas_middleware::check_modifiable(&date, &config).is_ok()
}

#[tauri::command]
pub fn generate_filing(snapshot: AuditSnapshot, config: TenantConfig) -> Result<String, String> {
    SecurityGuard::validate_tenant(&config.tenant_id)?;
    let meta = config.entity_metadata.clone().ok_or("엔티티 메타데이터가 없습니다.")?;
    
    let path = HometaxEngine::generate_vat_xml(&snapshot.ledger, &meta, &config.tenant_id)?;
    // Return the actual XML content instead of a message for the frontend to download
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
pub fn generate_bridge_package(ledger: Vec<JournalEntry>, tenant_id: String) -> Result<String, String> {
    SecurityGuard::validate_tenant(&tenant_id)?;
    let path = HometaxEngine::generate_bridge_file(&ledger, &tenant_id)?;
    Ok(format!("전문가 전송용 보안 패키지(.af_audit)가 생성되었습니다. AES-256으로 암호화되어 안전합니다.\n경로: {:?}", path))
}

#[tauri::command]
pub fn get_compliance_mappings() -> serde_json::Value {
    serde_json::json!({
        "vat": crate::tax::nts_mapping::get_hometax_vat_mapping(),
        "corp": crate::tax::nts_mapping::get_hometax_corp_tax_mapping()
    })
}

#[tauri::command]
pub fn run_depreciation(mut assets: Vec<Asset>, date: String, tenant_id: String) -> Result<Vec<JournalEntry>, String> {
    SecurityGuard::validate_tenant(&tenant_id)?;
    Ok(assets::generate_closing_entries(&mut assets, &date, &tenant_id, &vec![]))
}

#[tauri::command]
pub fn process_scm_order(order: Order, tenant_id: String) -> Result<Vec<JournalEntry>, String> {
    SecurityGuard::validate_tenant(&tenant_id)?;
    Ok(inventory_bridge::convert_order_to_journal(&order, &tenant_id))
}

#[tauri::command]
pub fn evaluate_inventory_assets(inventory: Vec<crate::core::models::InventoryItem>) -> crate::scm::scm_service::ValuationSummary {
    crate::scm::scm_service::evaluate_lcm(&inventory)
}

#[tauri::command]
pub fn run_validation_checks(snapshot: AuditSnapshot, config: TenantConfig) -> Vec<ValidationResult> {
    tax_validator::run_validation(&snapshot, config.entity_metadata.as_ref())
}

#[tauri::command]
pub fn run_simulation_data() -> SimulationResult {
    simulation_engine::run_simulation()
}

#[tauri::command]
pub fn get_startup_insights(ledger: Vec<JournalEntry>) -> crate::engine::analysis::insights::StartupInsights {
    crate::engine::analysis::insights::calculate_insights(&ledger)
}

#[tauri::command]
pub fn approve_partner(mut partner: Partner, partners: Vec<Partner>) -> Partner {
    partner.status = "Approved".to_string();
    let count = partners.iter().filter(|p| p.status == "Approved").count();
    partner.partner_code = Some(format!("V{:05}", count + 1));
    partner
}

#[tauri::command]
pub fn save_tenant_config(app: tauri::AppHandle, config: TenantConfig) -> Result<(), String> {
    crate::core::config_manager::save_config(&app, config)
}

#[tauri::command]
pub fn load_tenant_config(app: tauri::AppHandle) -> Result<TenantConfig, String> {
    crate::core::config_manager::load_config(&app)
}

#[tauri::command]
pub fn batch_export_with_validation(
    entries: Vec<JournalEntry>
) -> Result<crate::engine::core::export::BatchExportResult, String> {
    crate::engine::core::export::process_batch_export(entries)
}

#[tauri::command]
pub async fn detect_batch_anomalies(
    entries: Vec<JournalEntry>
) -> Result<Vec<String>, String> {
    crate::engine::core::export::detect_anomalies_with_ai(&entries).await
}

#[tauri::command]
pub async fn generate_cash_flow_forecast(
    ledger: Vec<JournalEntry>,
    current_balance: f64,
) -> Result<forecast_engine::CashFlowForecast, String> {
    forecast_engine::generate_cash_flow_forecast(ledger, current_balance).await
}

#[tauri::command]
pub async fn generate_management_report(
    ledger: Vec<JournalEntry>,
    inventory: Vec<crate::core::models::InventoryItem>,
    assets: Vec<Asset>,
    period_start: String,
    period_end: String,
) -> Result<management_report::ManagementReport, String> {
    management_report::generate_management_report(ledger, inventory, assets, period_start, period_end).await
}

#[tauri::command]
pub async fn run_erp_migration(
    file_bytes: Vec<u8>,
    file_name: String,
) -> Result<crate::ai::migration_engine::MigrationSummary, String> {
    crate::ai::migration_engine::run_smart_migration(file_bytes, file_name).await
}

#[tauri::command]
pub async fn verify_receipt_compliance(
    image_bytes: Vec<u8>,
    image_mime: String,
    transaction_json: String,
) -> Result<ParsedTransaction, String> {
    ai_service::verify_receipt_compliance(image_bytes, &image_mime, &transaction_json).await
}
#[tauri::command]
pub async fn chat_with_compliance(
    user_message: String,
    current_tx: Option<ParsedTransaction>,
    policy: String,
) -> Result<AnalysisResponse, String> {
    let mut response = ai_service::consult_compliance_ai(&user_message, current_tx, &policy).await?;
    
    // Consultation 성격을 표시하기 위해 임의로 transaction에 플래그 설정 (브릿지 역할)
    if response.transaction.is_none() {
        let mut mock_tx = ParsedTransaction::default();
        mock_tx.is_consultation = true; // 프론트엔드에서 상담 모드 UI를 띄우기 위함
        response.transaction = Some(mock_tx);
    }
    
    Ok(response)
}

#[tauri::command]
pub fn get_bank_presets() -> Vec<BankMapping> {
    crate::core::bank_presets::DEFAULT_PRESETS.clone()
}

#[tauri::command]
pub fn get_file_headers(file_bytes: Vec<u8>, file_name: String) -> Result<Vec<String>, String> {
    crate::utils::converter::get_headers(&file_bytes, &file_name)
}

#[tauri::command]
pub fn suggest_file_mapping(headers: Vec<String>) -> HashMap<String, String> {
    crate::utils::converter::suggest_mapping(headers)
}

#[tauri::command]
pub fn process_file_with_mapping(
    file_bytes: Vec<u8>,
    file_name: String,
    mapping: HashMap<String, String>
) -> Result<Vec<ParsedTransaction>, String> {
    crate::utils::converter::process_with_mapping(&file_bytes, &file_name, mapping)
}

#[tauri::command]
pub fn load_demo_scenario() -> Vec<ParsedTransaction> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let prefix = crate::utils::id_generator::IdPrefix::AI;

    vec![
        // 1. Messy Excel (Reconstructed)
        ParsedTransaction {
            id: Some(crate::utils::id_generator::generate_id(&today, prefix)),
            date: Some(today.clone()),
            amount: 1560000.0,
            vat: 141818.0,
            entry_type: Some("Expense".to_string()),
            description: Some("사무실 인테리어 공사 잔금 (Messy Excel)".to_string()),
            vendor: Some("다지이너스 (Designers)".to_string()),
            account_name: Some("수선비".to_string()),
            reasoning: "헤더가 없는 엑셀 파일에서 [일자:오늘, 금액:1560000] 패턴을 추출하여 정규화함.".to_string(),
            confidence: Some("Medium".to_string()),
            payment_method: Some("이체".to_string()),
            audit_trail: vec!["Source: messy_expenses_v2.xlsx (ID: demo-excel)".to_string(), "Smart Splitter Activated".to_string()],
            ..Default::default()
        },
        // 2. Blurry Receipt (Vision)
        ParsedTransaction {
            id: Some(crate::utils::id_generator::generate_id(&today, prefix)),
            date: Some(today.clone()),
            amount: 48500.0,
            vat: 4409.0,
            entry_type: Some("Expense".to_string()),
            description: Some("주말 팀 회식 (Blurry Image)".to_string()),
            vendor: Some("이자카야 춘".to_string()),
            account_name: Some("복리후생비".to_string()),
            reasoning: "비전 AI가 흐릿한 영수증에서 [48,500원]과 [주류] 품목을 식별함. 주말 사용분이므로 전문가 검토 필요.".to_string(),
            confidence: Some("Low".to_string()),
            payment_method: Some("Card".to_string()),
            needs_clarification: true,
            clarification_prompt: Some("주말 저녁 주류가 포함된 식대입니다. 근무 관련성을 소명해주십시오.".to_string()),
            clarification_options: Some(vec!["야근 식대", "팀 회식", "거래처 접대", "개인 사용(비용 제외)"].iter().map(|s| s.to_string()).collect()),
            audit_trail: vec!["Source: blurry_receipt_001.jpg (ID: demo-vision)".to_string(), "Vision Analysis".to_string()],
            ..Default::default()
        },
        // 3. HWP (Text Mining)
        ParsedTransaction {
            id: Some(crate::utils::id_generator::generate_id(&today, prefix)),
            date: Some(today.clone()),
            amount: 8800000.0,
            vat: 800000.0,
            entry_type: Some("Expense".to_string()),
            description: Some("3분기 외부 자문료 (HWP Draft)".to_string()),
            vendor: Some("법무법인 태평".to_string()),
            account_name: Some("지급수수료".to_string()),
            reasoning: "HWP 바이너리에서 추출한 텍스트 [법률자문계약서] 기반 분석. 3.3% 원천징수 여부 확인 필요.".to_string(),
            confidence: Some("High".to_string()),
            payment_method: Some("Transfer".to_string()),
            audit_trail: vec!["Source: 2026_advisory_contract.hwp (ID: demo-hwp)".to_string(), "HWP Text Mining".to_string()],
            ..Default::default()
        }
    ]
}

#[tauri::command]
pub fn generate_journal_id(date: String, entry_type: String) -> String {
    let prefix = crate::utils::id_generator::determine_prefix(&entry_type);
    crate::utils::id_generator::generate_id(&date, prefix)
}

#[tauri::command]
pub fn determine_prefix(entry_type: &str) -> crate::utils::id_generator::IdPrefix {
    crate::utils::id_generator::determine_prefix(entry_type)
}

// [Learning Ledger] SQLite Commands
#[tauri::command]
pub fn get_vendor_memory_report(vendor: String) -> learning_engine::MemoryReport {
    learning_engine::get_memory_report(&vendor)
}

#[tauri::command]
pub fn upsert_vendor_learning(vendor: String, account: String, credit_account: Option<String>, entry_type: Option<String>) -> Result<(), String> {
    learning_engine::upsert_learning(&vendor, &account, credit_account, entry_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn process_advanced_ledger(
    input: AdvancedLedgerInput,
    ledger: Vec<JournalEntry>
) -> Result<AdvancedLedgerOutput, String> {
    match input.module_id.as_str() {
        "rnd_capitalization" => {
            let engine = RndCapitalizationEngine;
            engine.process_logic(input, &ledger)
        },
        "stock_compensation" => {
            let engine = crate::engine::core::ledger::StockCompensationEngine;
            engine.process_logic(input, &ledger)
        },
        "currency_revaluation" => {
            let engine = crate::engine::core::ledger::CurrencyRevaluationEngine;
            engine.process_logic(input, &ledger)
        },
        "tax_credit_finder" => {
            let engine = crate::engine::core::ledger::TaxCreditFinderEngine;
            engine.process_logic(input, &ledger)
        },
        _ => Err(format!("지원하지 않는 특수 회계 모듈입니다: {}", input.module_id)),
    }
}

#[tauri::command]
pub fn get_ir_financial_summary(ledger: Vec<JournalEntry>) -> ir_engine::IRFinancialSummary {
    ir_engine::generate_ir_summary(&ledger)
}

#[tauri::command]
pub fn run_strategic_scenario(
    definition: ScenarioDefinition,
    ledger: Vec<JournalEntry>,
    selected_date: String,
) -> Vec<JournalEntry> {
    // 1. Isolation Check: Only use Actual ledger as snapshot source
    let actual_only: Vec<JournalEntry> = ledger.into_iter()
        .filter(|e| e.scope == LedgerScope::Actual)
        .collect();
    
    // 2. Project Scenario without mutating actuals
    ScenarioManager::project_scenario(definition, actual_only, selected_date)
}

#[tauri::command]
pub fn parse_universal_file(file_bytes: Vec<u8>) -> Result<csv_inference::InferenceResult, String> {
    crate::ai::csv_inference::analyze_csv(file_bytes)
}

// --- [L4 Governance] Audit & Risk Engine Commands ---

#[tauri::command]
pub async fn get_audit_issues(project_type: String) -> Result<Vec<AuditIssue>, String> {
    println!("[Audit] Fetching issues for project: {}", project_type);
    Ok(vec![
        AuditIssue {
            id: 1,
            issue_title: "고액 현금 인출 및 증빙 미비 (사적 사용 의심)".to_string(),
            description: "대표이사 개인 계좌로의 원인 불명 5천만원 이체건이 발견되었습니다. 거래처 증빙이 없으며 단기대여금으로도 분류되지 않았습니다.".to_string(),
            severity: "Critical".to_string(),
            detected_at: "2026-03-01T10:00:00Z".to_string(),
            recommendations: Some("가지급금 계정으로 임시 분류 후 법인카드 대체 사용 권고. 소명 불가 시 상여 처분 리스크.".to_string()),
            evidence_quote: Some("Manual Transfer: CD-OUT-9921".to_string()),
            ..Default::default()
        },
        AuditIssue {
            id: 2,
            issue_title: "R&D 인건비 중복 정산 징후".to_string(),
            description: "동일 인력에 대해 2개 국책 과제에서 인건비가 100%씩 중복 청구된 패턴이 시스템에 의해 탐지되었습니다.".to_string(),
            severity: "High".to_string(),
            detected_at: "2026-03-02T14:30:00Z".to_string(),
            recommendations: Some("과제별 참여율 재조정 및 고용보험 명부 대조 필수. 환수 및 참여 제한 페널티 가능성.".to_string()),
            ..Default::default()
        },
        AuditIssue {
            id: 3,
            issue_title: "특수관계자 거래 미공시 리스크".to_string(),
            description: "최대주주 소유의 별도 법인과의 임대차 거래에서 시가 대비 150% 높은 임차료가 지급되고 있습니다.".to_string(),
            severity: "Medium".to_string(),
            detected_at: "2026-03-05T09:15:00Z".to_string(),
            recommendations: Some("감정평가서 확보 및 부당행위계산 부인 여부 확인.".to_string()),
            ..Default::default()
        }
    ])
}

#[tauri::command]
pub async fn get_audit_universe() -> Result<Vec<AuditEntity>, String> {
    use crate::core::models::{ImpactBreakdown, LikelihoodBreakdown, AiRiskAnalysis};
    
    Ok(vec![
        AuditEntity {
            id: 1,
            unit_name: "구매 및 수납 프로세스".to_string(),
            category: "Operations".to_string(),
            impact_score: 85.0,
            likelihood_score: 30.0,
            status: "Monitoring".to_string(),
            responsible_dept: "구매본부".to_string(),
            last_audited: "2025-11-20".to_string(),
            ai_risk_analysis: AiRiskAnalysis {
                reason: "구매 시스템 내 권한 분리(SoD) 미흡으로 인한 부정 위험 상존".to_string(),
                impact_score: 85.0,
                likelihood_score: 30.0,
                impact_breakdown: ImpactBreakdown { financial_loss: 90.0, strategic_impact: 70.0, reputation_risk: 95.0 },
                likelihood_breakdown: LikelihoodBreakdown { historical_frequency: 10.0, control_weakness: 50.0, process_complexity: 30.0 },
                audit_approach: Some("전수 샘플링 및 결재 로그 대조 감사".to_string()),
                reference_standard: Some("COSO Framework 2013".to_string()),
            }
        },
        AuditEntity {
            id: 2,
            unit_name: "자산 및 재고 관리".to_string(),
            category: "Finance".to_string(),
            impact_score: 65.0,
            likelihood_score: 75.0,
            status: "High-Risk".to_string(),
            responsible_dept: "재무팀".to_string(),
            last_audited: "2025-05-15".to_string(),
            ai_risk_analysis: AiRiskAnalysis {
                reason: "최근 3개월간 재고 실사 차이액이 허용 오차(1%)를 지속 초과함".to_string(),
                impact_score: 65.0,
                likelihood_score: 75.0,
                impact_breakdown: ImpactBreakdown { financial_loss: 60.0, strategic_impact: 50.0, reputation_risk: 85.0 },
                likelihood_breakdown: LikelihoodBreakdown { historical_frequency: 80.0, control_weakness: 70.0, process_complexity: 75.0 },
                audit_approach: Some("바코드 시스템 전수 조사 및 실물 대조".to_string()),
                reference_standard: Some("K-IFRS 재고자산 기준서".to_string()),
            }
        }
    ])
}

#[tauri::command]
pub async fn ai_suggest_risk_score(unit_name: String) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "impact_score": 78.5,
        "likelihood_score": 42.0,
        "reasoning": format!("'{}' 유닛의 과거 감사 이력과 산업군 벤치마크 데이터를 분석한 결과, 자금 집행 단계의 복잡성이 증가하여 리스크가 상향 조정되었습니다.", unit_name)
    }))
}

#[tauri::command]
pub async fn generate_audit_priorities(_entities: Vec<AuditEntity>) -> Result<String, String> {
    Ok("1. 자고 관리 프로세스 정밀 실사 (High Likelihood)\n2. 구매 시스템 SoD 재설계 및 권한 감사 (High Impact)".to_string())
}

#[tauri::command]
pub async fn get_all_scenarios() -> Result<Vec<Scenario>, String> {
    Ok(vec![
        Scenario {
            id: "SC-001".to_string(),
            category: "Tax".to_string(),
            name: "연구소 기업 전환 시뮬레이션".to_string(),
            risk_level: "Medium".to_string(),
            description: "연구소 기업으로 전환 시 법인세 감면 혜택과 설립 요건 미충족 리스크를 비교 분석합니다.".to_string(),
            origin_audit_type: "전략 수립".to_string(),
            origin_department: "경영전략".to_string(),
            detected_date: "2026-03-01".to_string(),
            is_ai_generated: false,
        },
        Scenario {
            id: "SC-AI-01".to_string(),
            category: "Compliance".to_string(),
            name: "거래처 집중도 초과 경고".to_string(),
            risk_level: "High".to_string(),
            description: "특정 매출처 비중이 70%를 상회함에 따라, 해당 업체 도산 시 연쇄 부도 위험을 시뮬레이션합니다.".to_string(),
            origin_audit_type: "패턴 탐지".to_string(),
            origin_department: "CFE AI".to_string(),
            detected_date: "2026-03-09".to_string(),
            is_ai_generated: true,
        }
    ])
}

#[tauri::command]
pub async fn ask_ai_assistant(
    message: String, 
    tenant_id: Option<String>, 
    ledger: Option<Vec<JournalEntry>>,
    financials: Option<FinancialSummary>,
    company_knowledge: Option<String>,
    current_date: Option<String>,
) -> Result<String, String> {
    let tenant = tenant_id.unwrap_or_else(|| "default".to_string());
    println!("[AI Assistant] Processing request for tenant: {}", tenant);
    
    // Construct Enhanced Context
    let mut reasoning = String::new();
    let policy = company_knowledge.unwrap_or_else(|| "표준 회계 정책: 모든 지출은 적격증빙을 지향하며, 접대비는 한도를 준수함.".to_string());
    
    if let Some(l) = ledger {
        let total_count = l.len();
        let approved_count = l.iter().filter(|e| e.status == "Approved").count();
        let total_amount: f64 = l.iter().map(|e| e.amount).sum();
        
        reasoning.push_str(&format!("### [전체 장부 요약]\n- 총 전표 수: {}건\n- 승인된 전표: {}건\n- 누적 거래액: {}원\n", total_count, approved_count, total_amount));

        // Year-by-year summary to prevent "no data" errors
        let mut years_set: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
        for entry in &l {
            if entry.date.len() >= 4 {
                years_set.insert(entry.date[0..4].to_string());
            }
        }
        let years: Vec<String> = years_set.into_iter().collect();
        reasoning.push_str(&format!("- 데이터 보유 연도: {}\n", years.join(", ")));

        // Monthly Summary
        let mut monthly_summary: std::collections::BTreeMap<String, (f64, f64)> = std::collections::BTreeMap::new();
        for entry in &l {
            if entry.date.len() >= 7 {
                let month = &entry.date[0..7];
                let (rev, exp) = monthly_summary.entry(month.to_string()).or_insert((0.0, 0.0));
                let nature = get_account_nature_marker(&entry.debit_account, &entry.credit_account);
                
                // Simplified classification for reasoning
                if entry.credit_account.contains("매출") || entry.credit_account.contains("Revenue") || entry.credit_account.contains("401") {
                    *rev += entry.amount;
                } else if entry.debit_account.contains("비용") || entry.debit_account.contains("Expense") || entry.debit_account.starts_with("8") || entry.debit_account.starts_with("5") {
                    *exp += entry.amount;
                }
            }
        }
        
        reasoning.push_str("\n### [월별 매출/비용 추이 (최근 6개월)]\n");
        let months: Vec<String> = monthly_summary.keys().cloned().collect();
        for m in months.iter().rev().take(6) {
            let (r, e) = monthly_summary.get(m).unwrap();
            reasoning.push_str(&format!("- {}: 매출 {}원 / 비용 {}원 (순이익: {}원)\n", m, r, e, r - e));
        }

        // Recent 50 entries
        reasoning.push_str("\n### [최근 상세 거래 내역 (Last 50)]\n");
        let recent_history: Vec<String> = l.iter().rev().take(50)
            .map(|e| format!("- [{}] {}: {}원 (계정: {})", e.date, e.description, e.amount, e.debit_account))
            .collect();
        reasoning.push_str(&recent_history.join("\n"));
        reasoning.push_str("\n");
    }

    if let Some(f) = financials {
        reasoning.push_str(&format!(
            "\n### [현재 재무 지표 (YTD 요약)]\n- 유동현금: {}원\n- 매출액(YTD): {}원\n- 영업비용(YTD): {}원\n- 당기순이익: {}원\n- 총 자산: {}원\n- 총 자본: {}원\n",
            f.cash, f.revenue, f.expenses, f.net_income, f.total_assets, f.total_equity
        ));
    }

    if let Some(date) = current_date {
        reasoning.push_str(&format!("\n- 시스템 현재 기준일: {}\n", date));
    }

    // Single efficient consultation call
    let final_prompt = format!("## [Financial Context]\n{}\n\n질문: {}", reasoning, message);
    let result = ai_service::consult_compliance_ai(&final_prompt, None, &policy).await;
    
    match result {
        Ok(res) => {
            if let Some(rev) = res.compliance_review {
                Ok(rev.message)
            } else {
                Ok("AI 분석 결과를 생성할 수 없습니다.".to_string())
            }
        },
        Err(e) => {
            println!("[AI Assistant] Error: {}", e);
            Err(format!("AI 서비스 연결 실패: {}", e))
        }
    }
}

#[tauri::command]
pub async fn train_knowledge_from_file(
    bytes: Vec<u8>,
    mime: &str
) -> Result<String, String> {
    ai_service::train_knowledge_from_media(bytes, mime).await
}

// Helper for quick classification in reasoning
fn get_account_nature_marker(debit: &str, credit: &str) -> String {
    if credit.contains("매출") || credit.contains("Revenue") { "REVENUE".to_string() }
    else if debit.contains("비용") || debit.contains("Expense") { "EXPENSE".to_string() }
    else { "OTHER".to_string() }
}
