use crate::core::models::{AccountingPeriod, PeriodStatus, SystemError};
use rusqlite::{params, Connection};
use chrono::prelude::*;

pub fn get_period_by_date(conn: &Connection, date_str: &str) -> Result<Option<AccountingPeriod>, SystemError> {
    // date format assumes YYYY-MM-DD
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() < 2 {
        return Ok(None);
    }

    let year: i32 = parts[0].parse().unwrap_or(0);
    let month: u8 = parts[1].parse().unwrap_or(0);

    let mut stmt = conn.prepare("SELECT id, year, month, status, closed_at, closed_by, ledger_hash, last_journal_sequence FROM accounting_periods WHERE year = ?1 AND month = ?2")
        .map_err(|_| SystemError::DatabaseError)?;
    
    let mut period_iter = stmt.query_map(params![year, month], |row| {
        let status_str: String = row.get(3)?;
        let status = match status_str.as_str() {
            "CLOSED" => PeriodStatus::Closed,
            "TRIAL" => PeriodStatus::Trial,
            "SOFT_LOCKED" => PeriodStatus::SoftLocked,
            _ => PeriodStatus::Open,
        };

        Ok(AccountingPeriod {
            id: row.get(0)?,
            year: row.get(1)?,
            month: row.get(2)?,
            status,
            closed_at: row.get(4)?,
            closed_by: row.get(5)?,
            ledger_hash: row.get(6)?,
            last_journal_sequence: row.get(7)?,
        })
    }).map_err(|_| SystemError::DatabaseError)?;

    if let Some(res) = period_iter.next() {
        Ok(Some(res.map_err(|_| SystemError::DatabaseError)?))
    } else {
        Ok(None)
    }
}

pub fn validate_posting(conn: &Connection, date_str: &str) -> Result<(), SystemError> {
    if let Some(period) = get_period_by_date(conn, date_str)? {
        if period.status == PeriodStatus::Closed {
            return Err(SystemError::InvalidFormat(format!("해당 날짜({})의 회계 기간이 [HARD LOCK] 마감되었습니다. 절대 수정이 불가능합니다.", date_str)));
        }
        if period.status == PeriodStatus::SoftLocked {
            // Future: check if user is admin. For now, warning or block.
            return Err(SystemError::InvalidFormat(format!("해당 날짜({})의 회계 기간이 [SOFT LOCK] 마감되었습니다. 결정권자 승인 후 수정 가능합니다.", date_str)));
        }
    }
    // If period doesn't exist, we assume it's open (or we could auto-create it)
    Ok(())
}

pub fn initialize_current_period(conn: &Connection) -> Result<(), SystemError> {
    let now = Local::now();
    let year = now.year();
    let month = now.month() as u8;

    conn.execute(
        "INSERT OR IGNORE INTO accounting_periods (id, year, month, status) VALUES (?1, ?2, ?3, 'OPEN')",
        params![uuid::Uuid::new_v4().to_string(), year, month]
    ).map_err(|_| SystemError::DatabaseError)?;

    Ok(())
}

pub fn soft_lock_period(conn: &Connection, period_id: &str, user: &str) -> Result<(), SystemError> {
    let now = Local::now().to_rfc3339();
    conn.execute(
        "UPDATE accounting_periods SET status = 'SOFT_LOCKED', closed_at = ?2, closed_by = ?3 WHERE id = ?1",
        params![period_id, now, user]
    ).map_err(|_| SystemError::DatabaseError)?;
    Ok(())
}

pub fn close_period(conn: &Connection, period_id: &str, user: &str, ledger_hash: Option<String>) -> Result<(), SystemError> {
    let now = Local::now().to_rfc3339();
    conn.execute(
        "UPDATE accounting_periods SET status = 'CLOSED', closed_at = ?2, closed_by = ?3, ledger_hash = ?4 WHERE id = ?1",
        params![period_id, now, user, ledger_hash]
    ).map_err(|_| SystemError::DatabaseError)?;
    Ok(())
}
