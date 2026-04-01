use rusqlite::{params, Connection, Result};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MemoryReport {
    pub account: Option<String>,
    pub credit_account: Option<String>, // Added: Payment side memory
    pub entry_type: Option<String>,     // Added: Business nature memory
    pub usage_count: i32,
    pub is_conflict: bool,
}

// Global Connection Manager (Persistent SQLite Store)
static DB_CONN: Lazy<Mutex<Connection>> = Lazy::new(|| {
    // [V7] Moved DB path OUTSIDE of src-tauri to avoid Tauri dev watcher restarts
    // In dev, it will stay in the project root or a temp folder.
    let db_path = if cfg!(debug_assertions) {
        "../accounting_flow_memory.db" // One level up from src-tauri
    } else {
        "accounting_flow_memory.db" // Static location for production
    };

    let conn = match Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => {
            eprintln!("[LearningEngine] Persistent DB failed, falling back to memory.");
            Connection::open_in_memory().unwrap_or_else(|_| Connection::open_in_memory().unwrap())
        }
    };
    // Add columns if they don't exist (Migration-friendly)
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS vendor_account_map (
            vendor_name TEXT PRIMARY KEY,
            account TEXT NOT NULL,
            credit_account TEXT,
            entry_type TEXT,
            usage_count INTEGER DEFAULT 1,
            last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_conflict BOOLEAN DEFAULT 0
        )",
        [],
    );
    Mutex::new(conn)
});

/// Comprehensive Memory Lookup for Explainable Finance
pub fn get_memory_report(vendor: &str) -> MemoryReport {
    let conn = match DB_CONN.lock() {
        Ok(c) => c,
        Err(_) => return MemoryReport { account: None, credit_account: None, entry_type: None, usage_count: 0, is_conflict: false },
    };
    let mut stmt = match conn.prepare(
        "SELECT account, usage_count, is_conflict, credit_account, entry_type FROM vendor_account_map WHERE vendor_name = ?"
    ) {
        Ok(s) => s,
        Err(_) => return MemoryReport { account: None, credit_account: None, entry_type: None, usage_count: 0, is_conflict: false },
    };
    
    let result = stmt.query_row(params![vendor], |row| {
        Ok(MemoryReport {
            account: Some(row.get(0)?),
            usage_count: row.get(1)?,
            is_conflict: row.get(2)?,
            credit_account: row.get(3).ok(),
            entry_type: row.get(4).ok(),
        })
    });

    match result {
        Ok(report) => report,
        Err(_) => MemoryReport { account: None, credit_account: None, entry_type: None, usage_count: 0, is_conflict: false }
    }
}

/// Learning Trigger: Register or update a vendor-account association
pub fn upsert_learning(vendor: &str, account: &str, credit_account: Option<String>, entry_type: Option<String>) -> Result<()> {
    let conn = match DB_CONN.lock() {
        Ok(c) => c,
        Err(_) => return Ok(()), // Don't crash on lock poison
    };
    
    let mut stmt = conn.prepare("SELECT account FROM vendor_account_map WHERE vendor_name = ?")?;
    let mut rows = stmt.query(params![vendor])?;
    
    if let Some(row) = rows.next()? {
        let existing_account: String = row.get(0)?;
        
        if existing_account == account {
            conn.execute(
                "UPDATE vendor_account_map SET 
                    usage_count = usage_count + 1, 
                    credit_account = ?,
                    entry_type = ?,
                    is_conflict = 0,
                    last_used_at = CURRENT_TIMESTAMP 
                 WHERE vendor_name = ?",
                params![credit_account, entry_type, vendor],
            )?;
        } else {
            // Inconsitency -> Conflict
            conn.execute(
                "UPDATE vendor_account_map SET is_conflict = 1, last_used_at = CURRENT_TIMESTAMP WHERE vendor_name = ?",
                params![vendor],
            )?;
        }
    } else {
        // First time discovery
        conn.execute(
            "INSERT INTO vendor_account_map (vendor_name, account, credit_account, entry_type) VALUES (?, ?, ?, ?)",
            params![vendor, account, credit_account, entry_type],
        )?;
    }
    
    Ok(())
}

/// Admin: Clear memory if needed
pub fn clear_memory() -> Result<()> {
    let conn = match DB_CONN.lock() {
        Ok(c) => c,
        Err(_) => return Err(rusqlite::Error::ExecuteReturnedResults), // Poisoned bridge
    };
    conn.execute("DELETE FROM vendor_account_map", [])?;
    Ok(())
}
