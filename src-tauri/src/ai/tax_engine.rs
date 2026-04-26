use crate::core::models::ParsedTransaction;

/**
 * Tax Engine
 * 자동 세금 감지 및 분개 생성기
 * 한글 키워드 무결성 보장 (UTF-8)
 */
pub fn detect_and_apply_tax_logic(tx: &mut ParsedTransaction) {
    let desc = tx.description.clone().unwrap_or_default();
    
    // 1. 원천세 감지 (용역, 강사, 컨설팅 등)
    if desc.contains("용역") || desc.contains("강사") || desc.contains("컨설팅") || desc.contains("프리랜서") {
        tx.reasoning.push_str(" [원천세 3.3% 감지]");
        // AI가 추가 분석하도록 유도
    }
    
    // 2. 임대료 감지
    if desc.contains("임대료") || desc.contains("월세") {
        tx.reasoning.push_str(" [임대료 원천징수 대상 여부 확인 필요]");
    }

    // 3. 정부지원금 특별 처리
    if desc.contains("정부지원금") || desc.contains("국고보조금") || desc.contains("창업지원") {
        tx.needs_clarification = true;
        tx.clarification_prompt = Some("정부지원금이 감지되었습니다. 상환 의무가 있나요?".to_string());
        tx.clarification_options = Some(vec!["상환 의무 있음".to_string(), "상환 의무 없음(수익)".to_string()]);
    }
}

pub fn apply_vat_logic_v2(tx: &mut ParsedTransaction) {
    let vendor = tx.vendor.clone().unwrap_or_default().to_lowercase();
    let desc = tx.description.clone().unwrap_or_default().to_lowercase();
    let account = tx.account_name.clone().unwrap_or_default();

    // [Problem 2] 해외 결제 감지 (매입세액 불공제 대상)
    let foreign_vendors = vec!["amazon", "openai", "notion", "google", "slack", "github", "adobe", "apple", "microsoft", "meta", "facebook", "zoom", "linkedin", "digitalocean", "heroku"];
    let is_foreign = foreign_vendors.iter().any(|v| vendor.contains(v)) || desc.contains("usd") || desc.contains("foreign");

    if is_foreign {
        if tx.vat > 0.0 {
            tx.reasoning.push_str(" [해외 결제: 매입세액 불공제 대상으로 VAT 0원 처리]");
            tx.vat = 0.0;
        }
        return;
    }

    // [Problem 1] VAT 처리 리스크 해결
    // 부가세 컬럼이 명시적으로 존재했거나 이미 0원 초과라면 유지 (사용자 데이터 우선)
    if tx.is_vat_explicit || tx.vat > 0.0 {
        return;
    }

    // [Constitution Article 20] 면세 항목 체크 (급여, 보험료, 세금 등)
    let exempt_keywords = vec!["급여", "상여", "퇴직", "보험", "세금", "공과", "이자", "수수료(금융)", "기부"];
    let is_exempt = exempt_keywords.iter().any(|k| account.contains(k) || desc.contains(k));

    if is_exempt {
        tx.vat = 0.0;
        return;
    }

    // [Step 4] 부가세 자동 계산 (10/110) - 국내 과세 대상 확신 시에만
    if tx.vat == 0.0 && tx.amount > 0.0 {
        let taxable_categories = vec!["소모품", "도서", "여비", "식대", "차량", "통신", "수선", "광고", "지급수수료"];
        let is_likely_taxable = taxable_categories.iter().any(|c| account.contains(c) || desc.contains(c));

        if is_likely_taxable {
            tx.vat = (tx.amount / 11.0).round();
            tx.reasoning.push_str(" [국내 과세 거래 추정: VAT 10% 자동 분리]");
        }
    }
}
