use crate::core::models::{ParsedTransaction, ClassificationSuggestion, ConfidenceLevel, ExpenseCategory, AccountInference};
use std::collections::HashMap;

/// [Antigravity] Rule-Based Suggestion Engine V5 (2-Step Strategy)
/// Step 1: Broad Categorization (AI Semantic Logic)
/// Step 2: Account Mapping (GAAP/IFRS standard)
pub fn classify_by_rules(tx: &ParsedTransaction) -> Option<ClassificationSuggestion> {
    let inference = infer_account_v2(tx);
    
    Some(ClassificationSuggestion {
        suggested_account: Some(inference.account_name),
        suggested_payment_method: None, // Handle separately
        confidence: match inference.confidence.as_str() {
            "High" => ConfidenceLevel::High,
            "Medium" => ConfidenceLevel::Medium,
            _ => ConfidenceLevel::Low,
        },
        reasoning: inference.reasoning,
    })
}

pub fn infer_account_v2(tx: &ParsedTransaction) -> AccountInference {
    let description = tx.description.as_deref().unwrap_or("").to_lowercase();
    let vendor = tx.vendor.as_deref().unwrap_or("").to_lowercase();
    let combined = format!("{} {}", description, vendor);

    // [Step 0] Self-Learning: Check User Preferences first
    if let Some(user_account) = crate::ai::user_learning::get_preference(&vendor) {
        return AccountInference {
            category: ExpenseCategory::Other, // Specific category could be cached too, but account is primary
            account_name: user_account,
            reasoning: format!("Self-Learning: Matched previously saved preference for vendor '{}'", vendor),
            confidence: "UserVerified".to_string(),
        };
    }

    // [Step 1] Determine Category based on multi-signal patterns
    let category = determine_category(&vendor, &description, &combined);

    // [Step 2] Map Category to likely GAAP Account
    let (account_name, confidence, logic_trail) = map_category_to_account(category, &vendor, &description);

    AccountInference {
        category,
        account_name,
        reasoning: format!("Step 1: Category Identified as {:?} -> Step 2: {}", category, logic_trail),
        confidence,
    }
}

fn determine_category(vendor: &str, desc: &str, combined: &str) -> ExpenseCategory {
    // Infrastructure Patterns (Vendor + Context)
    if (vendor.contains("aws") || vendor.contains("gcp") || vendor.contains("azure") || vendor.contains("gabia") || vendor.contains("가비아") || vendor.contains("cafe24"))
       && (combined.contains("cloud") || combined.contains("hosting") || combined.contains("server") || combined.contains("인프라")) {
        return ExpenseCategory::Infra;
    }

    // Software/SaaS Patterns
    if combined.contains("subscription") || combined.contains("api") || combined.contains("saas") || combined.contains("notion") || combined.contains("slack") || combined.contains("openai") || combined.contains("gamma") || combined.contains("linear") {
        return ExpenseCategory::Software;
    }

    // Marketing/Ads
    if combined.contains("광고") || combined.contains("ads") || combined.contains("marketing") || vendor.contains("youtube") || vendor.contains("facebook") || vendor.contains("meta") || vendor.contains("google ads") {
        return ExpenseCategory::Marketing;
    }

    // Logistics
    if combined.contains("택배") || combined.contains("배송") || combined.contains("운송") || combined.contains("logis") || combined.contains("express") {
        return ExpenseCategory::Logistics;
    }

    // Welfare (Dining/Coffee)
    if combined.contains("식당") || combined.contains("카페") || combined.contains("스타벅스") || combined.contains("식대") || combined.contains("coffee") {
        return ExpenseCategory::Welfare;
    }

    // Travel
    if combined.contains("택시") || combined.contains("tx") || combined.contains("srt") || combined.contains("철도") || combined.contains("고속버스") || combined.contains("여비") {
        return ExpenseCategory::Travel;
    }

    ExpenseCategory::Unknown
}

fn map_category_to_account(category: ExpenseCategory, vendor: &str, desc: &str) -> (String, String, String) {
    match category {
        ExpenseCategory::Infra => (
            "클라우드사용료".to_string(), 
            "High".to_string(), 
            format!("Vendor: {} + Infrastructure Pattern Detected", vendor)
        ),
        ExpenseCategory::Software => (
            "소프트웨어사용료".to_string(), 
            "High".to_string(), 
            format!("Pattern: Subscription/API identified in '{}'", desc)
        ),
        ExpenseCategory::Marketing => (
            "광고선전비".to_string(), 
            "High".to_string(), 
            "Pattern: Marketing/Ad channel detected".to_string()
        ),
        ExpenseCategory::Logistics => (
            "운반비".to_string(), 
            "High".to_string(), 
            "Pattern: Logistics/Delivery detected".to_string()
        ),
        ExpenseCategory::Welfare => (
            "복리후생비".to_string(), 
            "Medium".to_string(), 
            "Pattern: Dining/Entertainment pattern (Defaulting to Welfare)".to_string()
        ),
        ExpenseCategory::Travel => (
            "여비교통비".to_string(), 
            "High".to_string(), 
            "Pattern: Transport service detected".to_string()
        ),
        _ => (
            "미분류".to_string(), 
            "Low".to_string(), 
            "No strong patterns found. Defaulting to 'Unclassified' for manual verification.".to_string()
        )
    }
}

pub fn matches_any(tokens: &[&str], keywords: &[&str]) -> bool {
    for token in tokens {
        for keyword in keywords {
            if token.contains(keyword) {
                return true;
            }
        }
    }
    false
}
