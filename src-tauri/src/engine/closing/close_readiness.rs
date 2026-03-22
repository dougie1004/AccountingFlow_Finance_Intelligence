use crate::core::models::{JournalEntry, Asset, CloseReadinessReport, CloseCheck};

/// [Close Readiness Engine (Option B: Logical Closing)]
/// Analyzes the ledger for a target period to determine if it's safe to close.
/// This engine is non-mutating and provides deterministic accounting control signals.
pub fn generate_report(period: &str, ledger: &[JournalEntry], assets: &[Asset]) -> CloseReadinessReport {
    let mut checks = Vec::new();
    let mut warnings = Vec::new();
    let mut blockers = Vec::new();
    let mut total_score = 100i32;

    // Filter ledger for the target period (YYYY-MM)
    let period_entries: Vec<&JournalEntry> = ledger.iter()
        .filter(|e| e.date.starts_with(period))
        .collect();

    // 1. Depreciation Check (Blocker)
    let mut missing_dep_assets = Vec::new();
    let mut dep_affected_ids = Vec::new();
    let period_key = period.replace("-", "");
    let dep_id_prefix = format!("DEP-{}", period_key);

    for asset in assets {
        if asset.acquisition_date <= format!("{}-31", period) {
            let has_dep = period_entries.iter().any(|e| {
                e.id.starts_with(&dep_id_prefix) && (e.id.contains(&asset.id) || e.description.contains(&asset.name))
            });
            if !has_dep {
                missing_dep_assets.push(asset.name.clone());
                dep_affected_ids.push(asset.id.clone());
            }
        }
    }

    let dep_status = if missing_dep_assets.is_empty() {
        "PASSED".to_string()
    } else {
        let msg = format!("Missing depreciation for: {}.", missing_dep_assets.join(", "));
        blockers.push(msg.clone());
        total_score -= 30;
        "BLOCKER".to_string()
    };
    
    checks.push(CloseCheck {
        name: "Depreciation Posting".to_string(),
        status: dep_status,
        message: if missing_dep_assets.is_empty() { 
            "All assets have been depreciated for this period.".to_string() 
        } else { 
            format!("{} assets are missing monthly depreciation entries.", missing_dep_assets.len()) 
        },
        value: Some(format!("{}/{}", assets.len() - missing_dep_assets.len(), assets.len())),
        affected_ids: dep_affected_ids,
    });

    // 2. Suspense Account Check (Blocker/Warning Softened)
    let suspense_keywords = ["가계정", "미결산", "Suspense", "가지급금", "가수금", "Temporary"];
    let mut current_suspense_ids = Vec::new();
    let mut prev_suspense_exists = false;

    for e in &period_entries {
        if suspense_keywords.iter().any(|&k| e.debit_account.contains(k) || e.credit_account.contains(k)) {
            current_suspense_ids.push(e.id.clone());
        }
    }

    // [STEP 4 Patch] Check if carrid over from previous periods
    if !current_suspense_ids.is_empty() {
        prev_suspense_exists = ledger.iter()
            .any(|e| e.date < period.to_string() && suspense_keywords.iter().any(|&k| e.debit_account.contains(k) || e.credit_account.contains(k)));
    }

    let suspense_status = if current_suspense_ids.is_empty() {
        "PASSED".to_string()
    } else if prev_suspense_exists {
        // [CASE A] Carried over from past -> HARD BLOCKER
        let msg = format!("Target period has unresolved suspense items carried over from previous months.");
        blockers.push(msg.clone());
        total_score -= 30;
        "BLOCKER".to_string()
    } else {
        // [CASE B] Newly created this month -> WARNING ONLY
        let msg = format!("Target period has new suspense items (₩{:.0}). Please resolve before next month.", 
            period_entries.iter().filter(|e| current_suspense_ids.contains(&e.id)).map(|e| e.amount).sum::<f64>());
        warnings.push(msg.clone());
        total_score -= 10;
        "WARNING".to_string()
    };

    checks.push(CloseCheck {
        name: "Suspense Account Clearance".to_string(),
        status: suspense_status,
        message: if current_suspense_ids.is_empty() {
            "All temporary and suspense accounts are cleared.".to_string()
        } else if prev_suspense_exists {
            "Non-zero balances found in temporary accounts carried over from previous months.".to_string()
        } else {
            "New temporary account entries detected this month.".to_string()
        },
        value: Some(format!("{} items", current_suspense_ids.len())),
        affected_ids: current_suspense_ids,
    });

    // 3. Accrual Signal (3-Month Window Box)
    let important_recurring_keywords = ["임차료", "보험료", "급여", "통신비", "Rent", "Insurance", "Salary", "Utility"];
    let mut missing_accruals = Vec::new();
    
    // Simple mock logic for finding previous months strings (YYYY-MM to YYYY-MM)
    // In prod, we'd use a real date library, but here we scan the whole ledger once
    for &k in &important_recurring_keywords {
        let mut prev_months = Vec::new();
        let (year, month) = if let (Ok(y), Ok(m)) = (period[..4].parse::<i32>(), period[5..7].parse::<i32>()) {
            (y, m)
        } else {
            (0, 0)
        };

        if year > 0 {
            for i in 1..=3 {
                let mut m = month - i;
                let mut y = year;
                while m <= 0 {
                    m += 12;
                    y -= 1;
                }
                prev_months.push(format!("{:04}-{:02}", y, m));
            }
        }

        let mut months_detected = 0usize;
        for pm in &prev_months {
            let present_in_pm = ledger.iter()
                .filter(|e| e.date.starts_with(pm))
                .any(|e| e.description.contains(k) || e.debit_account.contains(k));
            if present_in_pm {
                months_detected += 1;
            }
        }

        let is_present_now = period_entries.iter()
            .any(|e| e.description.contains(k) || e.debit_account.contains(k));

        if months_detected >= 2 && !is_present_now {
            missing_accruals.push(k.to_string());
        }
    }

    let accrual_status = if missing_accruals.is_empty() {
        "PASSED".to_string()
    } else {
        let msg = format!("Possible missing accruals: {}.", missing_accruals.join(", "));
        warnings.push(msg.clone());
        total_score -= 10;
        "WARNING".to_string()
    };

    checks.push(CloseCheck {
        name: "Accrual Signal (Recurring)".to_string(),
        status: accrual_status,
        message: if missing_accruals.is_empty() {
            "No significant recurring expense gaps detected.".to_string()
        } else {
            "Detected likely missing recurring expenses typical of this period.".to_string()
        },
        value: Some(format!("{} missing signals", missing_accruals.len())),
        affected_ids: vec![], // No specific IDs to link for missing signals
    });

    // 4. Period Integrity Check (Blocker)
    let mut invalid_ids = Vec::new();
    for e in &period_entries {
        if e.amount <= 0.0 || e.debit_account.is_empty() || e.credit_account.is_empty() || e.debit_account == e.credit_account {
            invalid_ids.push(e.id.clone());
        }
    }

    let integrity_status = if invalid_ids.is_empty() {
        "PASSED".to_string()
    } else {
        let msg = format!("Critical data integrity issues detected in {} entries.", invalid_ids.len());
        blockers.push(msg.clone());
        total_score -= 30;
        "BLOCKER".to_string()
    };

    checks.push(CloseCheck {
        name: "Data Integrity".to_string(),
        status: integrity_status,
        message: if invalid_ids.is_empty() {
            "All entries in the period passed basic accounting validity checks.".to_string()
        } else {
            "Some entries contain invalid amounts or missing account assignments.".to_string()
        },
        value: Some(format!("{} invalid", invalid_ids.len())),
        affected_ids: invalid_ids,
    });

    // 5. Matching Signal Check (Production Logic Relaxation)
    let ar_ap_entries: Vec<&&JournalEntry> = period_entries.iter()
        .filter(|e| e.debit_account.contains("외상매출") || e.credit_account.contains("외상매입") || e.credit_account.contains("미지급"))
        .collect();
    
    let usage_rate = period_entries.iter().filter(|e| e.matching_status.is_some()).count();
    let total_matchable = ar_ap_entries.len();
    let matched_count = ar_ap_entries.iter()
        .filter(|e| e.matching_status.as_deref() == Some("matched")) 
        .count();

    let matching_ratio = if total_matchable > 0 {
        (matched_count as f64 / total_matchable as f64) * 100.0
    } else {
        100.0
    };

    // [Step 1 Patch] Skip if matching is not used at all
    let matching_status_str = if usage_rate == 0 {
        "PASSED".to_string() // Skip if user is not using matching functionality
    } else if matching_ratio >= 90.0 {
        "PASSED".to_string()
    } else if matching_ratio >= 50.0 {
        let msg = format!("Reconciliation suggested: {:.1}% matched.", matching_ratio);
        warnings.push(msg.clone());
        total_score -= 10;
        "WARNING".to_string()
    } else if matching_ratio >= 20.0 {
        // [Step 1 Patch] Warning for low (50%-20%)
        let msg = format!("Low matching ratio for external obligations: {:.1}% matched.", matching_ratio);
        warnings.push(msg.clone());
        total_score -= 10;
        "WARNING".to_string()
    } else {
        // [Step 1 Patch] Blocker for extreme low (<20%)
        let msg = format!("Critical: Extremely low AR/AP matching ratio ({:.1}%). Full verification required.", matching_ratio);
        blockers.push(msg.clone());
        total_score -= 30;
        "BLOCKER".to_string()
    };

    checks.push(CloseCheck {
        name: "Matching & Settlement Signal".to_string(),
        status: matching_status_str,
        message: if usage_rate == 0 {
             "Matching check skipped (Matching engine not in use).".to_string()
        } else if matching_ratio >= 90.0 {
            "Transaction matching is sufficient for accurate reporting.".to_string()
        } else {
            "Reconciliation of AR/AP items suggested before final closing.".to_string()
        },
        value: Some(if usage_rate == 0 { "N/A".to_string() } else { format!("{:.1}% Matched", matching_ratio) }),
        affected_ids: if matching_ratio < 90.0 { ar_ap_entries.iter().filter(|e| e.matching_status.as_deref() != Some("matched")).map(|e| e.id.clone()).collect() } else { vec![] },
    });

    // Final Determination Logic
    let final_status = if !blockers.is_empty() {
        "BLOCKED".to_string()
    } else if total_score >= 80 {
        "READY".to_string()
    } else {
        "OPEN".to_string()
    };

    CloseReadinessReport {
        status: final_status,
        score: total_score.max(0).min(100),
        checks,
        warnings,
        blockers,
        period: period.to_string(),
    }
}
