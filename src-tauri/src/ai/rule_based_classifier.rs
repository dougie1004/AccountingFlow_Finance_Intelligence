use crate::core::models::{ParsedTransaction, ClassificationSuggestion, ConfidenceLevel};

/**
 * Rule-Based Suggestion Engine V4 (Non-Mutating AI Advisor)
 * AI가 전표를 직접 수정하지 않고, 헌법에 따라 '추천(Suggestion)'만 제공하는 엔진.
 * 모든 결정론적 분개 처리는 Accounting Engine의 몫으로 남겨둡니다.
 */
pub fn classify_by_rules(tx: &ParsedTransaction) -> Option<ClassificationSuggestion> {
    let description = tx.description.as_deref().unwrap_or("").to_lowercase();
    let vendor = tx.vendor.as_deref().unwrap_or("").to_lowercase();
    let combined = format!("{} {}", description, vendor);
    
    // 1. Payment Method Detection (Suggestion Only)
    // 계정을 직접 수정하지 않고, 결제 수단에 대한 힌트만 제공합니다.
    let suggested_pm = if combined.contains("삼성페이") || combined.contains("samsung") || combined.contains("애플페이") || combined.contains("apple pay") || combined.contains("카카오페이") {
        Some("Card".to_string())
    } else if combined.contains("이체") || combined.contains("송금") || combined.contains("transfer") || combined.contains("계좌") || combined.contains("제로페이") || combined.contains("체크") {
        Some("Transfer".to_string())
    } else if combined.contains("현금") || combined.contains("cash") {
        Some("Cash".to_string())
    } else {
        None
    };

    // 2. 전처리: 불용어(Stopwords) 제거 및 토큰화
    let tokens: Vec<&str> = combined.split_whitespace()
        .filter(|t| !["payment", "for", "the", "inc", "corp", "ltd", "co", "주식회사", "유한회사"].contains(t))
        .collect();

    // 3. Super Rules (Higher Priority) - 실무 정책 기반 강제 추천
    
    // [Super Rule A: 관리비 통합]
    if combined.contains("관리비") || combined.contains("아파트") || combined.contains("사무소") || combined.contains("관리사무") {
        return Some(ClassificationSuggestion {
            suggested_account: Some("임차료".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "슈퍼규칙: 모든 관리비/아파트 비용은 실무 정책에 따라 '임차료'로 통합 추천합니다.".to_string(),
        });
    }

    // [Super Rule B: 대형 마트 및 유통]
    let mart_specifics = ["하나로마트", "이마트", "홈플러스", "롯데마트", "코스트코", "노브랜드", "식자재마트", "distribution", "유통"];
    if matches_any(&tokens, &mart_specifics) || combined.contains("마트") || combined.contains("슈퍼") {
        return Some(ClassificationSuggestion {
            suggested_account: Some("소모품비".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "슈퍼규칙: 마트/유통사 결제건은 범용 소모품비로 우선 추천합니다.".to_string(),
        });
    }

    // 4. Semantic Category Matching (Generalized Industry Patterns)
    
    // IT / Software / Cloud
    let tech_keywords = ["tech", "soft", "cloud", "data", "lab", "system", "network", "hosting", "server", "domain", "api", "platform", "saas", "app", "solution", "공학", "시스템", "소프트", "클라우드", "정보", "통신", "아이티", "테크", "솔루션"];
    if matches_any(&tokens, &tech_keywords) || vendor.ends_with(".io") || vendor.ends_with(".ai") || vendor.contains("aws") || vendor.contains("azure") {
        return Some(ClassificationSuggestion {
            suggested_account: Some("지급수수료".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "패턴: IT/SW/클라우드 기업 업종 감지".to_string(),
        });
    }

    // F&B / Welfare
    let food_keywords = ["cafe", "coffee", "brew", "kitchen", "food", "burger", "pizza", "sushi", "mart", "store", "restaurant", "pub", "bar", "bakery", "steak", "diner", "식당", "카페", "커피", "푸드", "키친", "갈비", "횟집", "국밥", "버거", "피자", "베이커리"];
    if matches_any(&tokens, &food_keywords) {
        return Some(ClassificationSuggestion {
            suggested_account: Some("복리후생비".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::Medium,
            reasoning: "패턴: 식음료/외식 업종 감지".to_string(),
        });
    }

    // Marketing / Ads
    let ad_keywords = ["ad", "ads", "media", "studio", "creative", "promo", "marketing", "design", "print", "banner", "광고", "기획", "디자인", "미디어", "스튜디오", "인쇄", "홍보", "마케팅"];
    if matches_any(&tokens, &ad_keywords) {
        return Some(ClassificationSuggestion {
            suggested_account: Some("광고선전비".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "패턴: 광고/미디어/디자인 업종 감지".to_string(),
        });
    }

    // Logistics / Transport
    let logis_keywords = ["logistics", "express", "delivery", "shipping", "post", "parcel", "freight", "cargo", "택배", "운송", "물류", "해운", "항공", "통운", "퀵", "용달", "우편"];
    if matches_any(&tokens, &logis_keywords) {
        return Some(ClassificationSuggestion {
            suggested_account: Some("운반비".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "패턴: 물류/운송 업종 감지".to_string(),
        });
    }

    // Insurance / Pension
    let ins_keywords = ["insurance", "pension", "health", "life", "social", "security", "보험", "연금", "공단", "고용", "산재", "4대"];
    if matches_any(&tokens, &ins_keywords) {
        return Some(ClassificationSuggestion {
            suggested_account: Some("보험료".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "패턴: 4대보험/보장성 보험 감지".to_string(),
        });
    }

    // General Tax / Gov
    let tax_keywords = ["tax", "gov", "city", "council", "fine", "세무", "국세", "지방세", "구청", "시청", "법원", "과태료", "범칙금"];
    if matches_any(&tokens, &tax_keywords) {
        return Some(ClassificationSuggestion {
            suggested_account: Some("세금과공과".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "패턴: 관공서/세금 관련".to_string(),
        });
    }

    // 5. Legacy Keyword Match (Suggestion Mode)
    if combined.contains("정부") || combined.contains("r&d") || combined.contains("지원금") {
        return Some(ClassificationSuggestion {
            suggested_account: Some("국고보조금수익".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "규칙: 정부지원금 패턴 감지".to_string(),
        });
    } else if combined.contains("급여") || combined.contains("salary") {
        return Some(ClassificationSuggestion {
            suggested_account: Some("급여".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "규칙: 급여/인건비 패턴 감지".to_string(),
        });
    } else if combined.contains("자본금") || combined.contains("investment") {
        return Some(ClassificationSuggestion {
            suggested_account: Some("자본금".to_string()),
            suggested_payment_method: suggested_pm,
            confidence: ConfidenceLevel::High,
            reasoning: "규칙: 투자금/자본금 패턴 감지".to_string(),
        });
    }

    None
}

fn matches_any(tokens: &[&str], keywords: &[&str]) -> bool {
    for token in tokens {
        for keyword in keywords {
            if token.contains(keyword) {
                return true;
            }
        }
    }
    false
}
