use crate::core::models::TenantConfig;
use chrono::prelude::*;

/// 회계 기간 마감 상태 제어 엔진
/// Core Financial Pipeline Lock의 핵심 로직을 담당합니다.

pub fn is_period_locked(date_str: &str, config: &TenantConfig) -> bool {
    // 1. Tenant 전체가 읽기 전용인지 확인
    if config.is_read_only {
        return true;
    }

    // 2. 설정된 마감일(Closing Date)과 비교
    if let Some(closing_date) = &config.closing_date {
        if date_str <= closing_date.as_str() {
            return true;
        }
    }

    false
}

pub fn validate_period_for_posting(date_str: &str, config: &TenantConfig) -> Result<(), String> {
    if is_period_locked(date_str, config) {
        let closing_date = config.closing_date.as_deref().unwrap_or("N/A");
        return Err(format!(
            "해당 날짜({})는 이미 회계적으로 마감(Lock)되었습니다. (마감 기준일: {})", 
            date_str, closing_date
        ));
    }
    Ok(())
}

/// 현재 날짜 기반으로 회계 연월 탐색 (YYYY-MM)
pub fn get_current_fiscal_month() -> String {
    Local::now().format("%Y-%m").to_string()
}
