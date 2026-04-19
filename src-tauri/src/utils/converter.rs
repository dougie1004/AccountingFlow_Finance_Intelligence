use std::collections::HashMap;
use crate::core::models::ParsedTransaction;
use csv::ReaderBuilder;
use std::io::Cursor;
use calamine::{Reader, Xlsx};
use chrono;

fn normalize_key(s: &str) -> String {
    s.to_lowercase()
     .chars()
     .filter(|c| !c.is_whitespace() && *c != '\"' && *c != '\'' && *c != '\r' && *c != '\n' && *c != '\u{feff}' && *c != '(' && *c != ')')
     .collect()
}

pub fn suggest_mapping(headers: Vec<String>) -> HashMap<String, String> {
    // Flatten and split if headers are clumped (Frontend/Backend consistency)
    let mut actual_headers = Vec::new();
    for h in headers {
        let h_clean = deep_clean_value(&h);
        if h_clean.contains(',') && !h_clean.contains('\"') {
            for sub in h_clean.split(',') { actual_headers.push(sub.trim().to_string()); }
        } else {
            actual_headers.push(h_clean);
        }
    }
    suggest_mapping_robust(&actual_headers, &[])
}

pub fn suggest_mapping_slice(actual_headers: &[String]) -> HashMap<String, String> {
    suggest_mapping_robust(actual_headers, &[])
}

/// [Antigravity] Robust Data-Driven Member Profiling
/// Incorporates Header-Matching + Value-Pattern Recognition + Score-based Ranking
pub fn suggest_mapping_robust(actual_headers: &[String], samples: &[Vec<String>]) -> HashMap<String, String> {
    let mut mapping = HashMap::new();
    
    // Prohibited keywords that absolutely disqualify a column from being a primary Amount
    let amount_prohibited = ["회차", "개월", "잔액", "기간", "seq", "period", "balance", "count", "건수", "단가"];
    let payment_prohibited = ["원금", "금액", "수량", "세액", "fee", "tax"];

    for (col_idx, header) in actual_headers.iter().enumerate() {
        let h_norm = normalize_key(header);
        let mut scores: HashMap<String, i32> = HashMap::new();

        // [Value-Profiling] Deep-Dive into sample data if available
        let col_samples: Vec<String> = samples.iter()
            .filter_map(|row| row.get(col_idx).cloned())
            .filter(|s| !s.trim().is_empty())
            .collect();

        // 1. Transaction Date Profiling
        let mut date_score = 0;
        if h_norm.contains("일자") || h_norm.contains("날짜") || h_norm.contains("date") || h_norm.contains("일시") || h_norm.contains("사용일") { date_score += 50; }
        if !col_samples.is_empty() {
             let date_matches = col_samples.iter().filter(|s| !sanitize_date(s).is_empty()).count();
             if date_matches as f32 / col_samples.len() as f32 > 0.7 { date_score += 60; }
        }
        scores.insert("tx_date".to_string(), date_score);

        // 2. Amount Profiling (High priority fix for User)
        let mut amount_score = 0;
        let is_prohibited = amount_prohibited.iter().any(|&p| h_norm.contains(p));
        
        if !is_prohibited {
            if h_norm.contains("금액") || h_norm.contains("amount") || h_norm.contains("price") || h_norm.contains("총액") { amount_score += 40; }
            if h_norm.contains("원금") || h_norm.contains("결제원금") || h_norm.contains("이용금액") { amount_score += 60; }
            if h_norm.contains("청구") && !h_norm.contains("회차") { amount_score += 30; }

            if !col_samples.is_empty() {
                let numeric_values: Vec<f64> = col_samples.iter().map(|s| sanitize_amount(s)).filter(|&v| v != 0.0).collect();
                if !numeric_values.is_empty() {
                    let avg = numeric_values.iter().sum::<f64>() / numeric_values.len() as f64;
                    // Pro-logic: Real transaction amounts are usually large (>1000)
                    if avg.abs() > 1000.0 { amount_score += 40; }
                    // If all values are very small integers, it's likely a sequence, not an amount
                    else if avg.abs() < 100.0 && numeric_values.iter().all(|&v| v == v.floor()) { amount_score -= 50; }
                }
            }
        } else {
            amount_score = -100; // Hard Rule Exclusion
        }
        scores.insert("amount".to_string(), amount_score);

        // 3. Vendor Profiling
        let mut vendor_score = 0;
        if h_norm.contains("상호") || h_norm.contains("vendor") || h_norm.contains("가맹점") || h_norm.contains("설명") || h_norm.contains("내용") { vendor_score += 40; }
        if !col_samples.is_empty() {
            let string_ratio = col_samples.iter().filter(|s| sanitize_amount(s) == 0.0 && s.len() > 3).count();
            if string_ratio as f32 / col_samples.len() as f32 > 0.8 { vendor_score += 30; }
        }
        scores.insert("vendor".to_string(), vendor_score);

        // 4. Payment Method Profiling
        let mut payment_score = 0;
        let p_prohibited = payment_prohibited.iter().any(|&p| h_norm.contains(p));
        if !p_prohibited {
            if h_norm.contains("결제") || h_norm.contains("수단") || h_norm.contains("payment") || h_norm.contains("카드") { payment_score += 50; }
            if h_norm.contains("잔액") || h_norm.contains("balance") { payment_score -= 40; } // Sequence/Balance columns often contain "결제후 잔액"
        } else {
             payment_score = -100;
        }
        scores.insert("payment_type".to_string(), payment_score);
        
        // 5. Detailed Component Profiling (Child scores dependent on Amount scoring)
        if h_norm.contains("원금") || h_norm.contains("principal") { scores.insert("principal_amount".to_string(), 90); }
        if h_norm.contains("수수료") || h_norm.contains("fee") { scores.insert("fee_amount".to_string(), 90); }
        if h_norm.contains("세액") || h_norm.contains("tax") { scores.insert("tax_amount".to_string(), 90); }
        if h_norm.contains("혜택") || h_norm.contains("할인") || h_norm.contains("benefit") { scores.insert("benefit_amount".to_string(), 90); }
        if h_norm.contains("회차") || h_norm.contains("seq") { scores.insert("installment_seq".to_string(), 90); }
        if h_norm.contains("할부") || h_norm.contains("개월") || h_norm.contains("period") { scores.insert("installment_period".to_string(), 90); }

        // Find best match for this header
        if let Some((best_field, score)) = scores.into_iter().max_by_key(|&(_, s)| s) {
            if score > 20 {
                mapping.insert(header.clone(), best_field);
            }
        }
    }
    mapping
}

/// Smartly detect delimiter with fallback logic
fn detect_delimiter(content: &str) -> u8 {
    let lines: Vec<&str> = content.lines().filter(|l| !l.trim().is_empty()).take(10).collect();
    if lines.is_empty() { return b','; }

    let mut comma_scores = 0;
    let mut semi_scores = 0;
    let mut tab_scores = 0;

    for line in &lines {
        let line = line.replace("\u{feff}", "");
        comma_scores += line.matches(',').count();
        semi_scores += line.matches(';').count();
        tab_scores += line.matches('\t').count();
    }

    if tab_scores >= 2 && tab_scores > comma_scores {
        b'\t'
    } else if semi_scores >= 2 && semi_scores > comma_scores {
        b';'
    } else if comma_scores > 0 {
        b','
    } else {
        // Absolute fallback: try to find any delimiter
        if content.contains('\t') { b'\t' }
        else if content.contains(';') { b';' }
        else { b',' }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileUploadInfo {
    pub headers: Vec<String>,
    pub samples: Vec<Vec<String>>,
}

pub fn get_file_structure(bytes: &[u8], file_name: &str) -> Result<FileUploadInfo, String> {
    let ext = std::path::Path::new(file_name).extension().and_then(|s| s.to_str()).unwrap_or_default().to_lowercase();
    if ext == "xlsx" || ext == "xls" || ext == "xlsm" {
        let mut excel: Xlsx<_> = calamine::open_workbook_from_rs(Cursor::new(bytes)).map_err(|e: calamine::XlsxError| e.to_string())?;
        let sheet = excel.sheet_names().get(0).ok_or("No sheets")?.clone();
        let range = excel.worksheet_range(&sheet).map_err(|e: calamine::XlsxError| e.to_string())?;
        
        // [Antigravity] Smart Header Search for Excel
        let rows: Vec<Vec<String>> = range.rows()
            .take(100) // [FIX] Scan top 100 rows (Corporate card statements often have deep summaries)
            .map(|row| row.iter().map(|c| deep_clean_value(&c.to_string())).collect())
            .collect();

        if let Some((best_idx, best_headers)) = find_best_header_row(&rows) {
             let samples = rows.iter().skip(best_idx + 1).take(20).cloned().collect();
             return Ok(FileUploadInfo { headers: best_headers, samples });
        }
        
        // Fallback to first row
        if let Some(row) = range.rows().next() {
            let headers = row.iter().map(|c| deep_clean_value(&c.to_string())).collect();
            let samples = range.rows().skip(1).take(20)
                .map(|r| r.iter().map(|c| deep_clean_value(&c.to_string())).collect())
                .collect();
            return Ok(FileUploadInfo { headers, samples });
        }
    } else {
        let decoded = crate::ai::robust_parser::detect_and_decode(bytes)?;
        let delimiter = detect_delimiter(&decoded);
        
        let mut rdr = ReaderBuilder::new()
            .has_headers(false)
            .flexible(true) // [Antigravity] CRITICAL: Handle inconsistent column counts in messy CSVs
            .delimiter(delimiter)
            .from_reader(decoded.as_bytes());
            
        let records: Vec<Vec<String>> = rdr.records()
            .take(100) // [FIX] Scan more rows to find buried headers
            .filter_map(|r| r.ok())
            .map(|r| r.iter().map(|s| deep_clean_value(s)).collect())
            .collect();

        if let Some((best_idx, best_headers)) = find_best_header_row(&records) {
             let samples = records.iter().skip(best_idx + 1).take(20).cloned().collect();
             return Ok(FileUploadInfo { headers: best_headers, samples });
        }
        
        // Fallback: If heuristic failed, return first non-empty
        if let Some(first) = records.first() {
            let samples = records.iter().skip(1).take(20).cloned().collect();
            return Ok(FileUploadInfo { headers: first.clone(), samples });
        }
    }
    Err("데이터 헤더를 찾을 수 없거나 파일이 비어있습니다.".into())
}

// [Antigravity] Smart Header Detection Helper
fn find_best_header_row(rows: &[Vec<String>]) -> Option<(usize, Vec<String>)> {
    let mut best_score = 0;
    let mut best_idx = 0;
    let mut best_row = Vec::new();

    for (i, row) in rows.iter().enumerate() {
        let mut score = 0;
        let joined = row.join(" ").to_lowercase();
        let non_empty_count = row.iter().filter(|s| !s.trim().is_empty()).count();
        
        // 1. Column Search Logic (Cumulative Scoring)
        if joined.contains("일자") || joined.contains("날짜") || joined.contains("date") || joined.contains("일시") || joined.contains("사용일") || joined.contains("거래일") { score += 4; }
        if joined.contains("취득") { score += 3; }
        if joined.contains("금액") || joined.contains("합계") || joined.contains("amount") || joined.contains("원") || joined.contains("공급") || joined.contains("가액") || joined.contains("공급가") { score += 4; }
        if joined.contains("산출") || joined.contains("보수") || joined.contains("보험료") || joined.contains("납부") || joined.contains("수당") || joined.contains("보수월액") { score += 3; }
        if joined.contains("거래처") || joined.contains("상호") || joined.contains("vendor") || joined.contains("성명") || joined.contains("가입자") || joined.contains("순번") || joined.contains("가맹점") || joined.contains("사용처") || joined.contains("이용처") { score += 4; }
        if joined.contains("내용") || joined.contains("적요") || joined.contains("description") || joined.contains("비고") || joined.contains("항목") || joined.contains("승인번호") { score += 2; }
        if joined.contains("잔액") || joined.contains("balance") || joined.contains("결제원금") || joined.contains("수수료") { score += 1; }
        
        // 2. Structural Preference
        if non_empty_count >= 8 { score += 10; } // Highly likely a transaction table
        else if non_empty_count >= 5 { score += 5; }
        else if non_empty_count >= 3 { score += 2; }
        
        // Penalize metadata rows (Title or Metadata like "Date: 123")
        let empty_count = row.iter().filter(|s| s.trim().is_empty()).count();
        if row.len() > 1 && empty_count > row.len() / 2 { score -= 6; }
        if joined.contains(":") || joined.contains("：") { score -= 4; }

        if score > best_score {
            best_score = score;
            best_idx = i;
            best_row = row.clone();
        }
    }

    if best_score > 0 {
        Some((best_idx, best_row))
    } else {
        None
    }
}

// [Antigravity] Extract Global Metadata (Title/Context) from top lines
fn extract_global_metadata(rows: &[Vec<String>]) -> String {
    for row in rows.iter().take(5) {
        let joined = row.join(" ").trim().to_string();
        if joined.is_empty() { continue; }
        
        // [Antigravity] Avoid picking up data rows as titles
        // If it contains a date-like pattern or too many columns with data, it's not a title.
        if joined.chars().filter(|c| *c == '-').count() >= 2 || (row.len() > 3 && row.iter().any(|s| s.chars().any(|c| c.is_numeric()))) {
            continue;
        }

        // Keywords that signal a document title/context
        if joined.contains("내역서") || joined.contains("고지서") || joined.contains("계산서") || joined.contains("청구서") || joined.contains("Statement") || joined.contains("Invoice") || joined.contains("명세") {
             return joined.replace("[", "").replace("]", "").trim().to_string();
        }
    }
    String::new()
}

// [Antigravity] Deep Clean: Trim spaces and remove wrapping quotes
fn deep_clean_value(s: &str) -> String {
    let trimmed = s.trim();
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        trimmed[1..trimmed.len()-1].trim().to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn process_with_mapping(
    bytes: &[u8],
    file_name: &str,
    mapping: HashMap<String, String>
) -> Result<Vec<ParsedTransaction>, String> {
    let ext = std::path::Path::new(file_name).extension().and_then(|s| s.to_str()).unwrap_or_default().to_lowercase();
    let mut results = Vec::new();
    println!("[Mapping Engine] Processing file: {} with {} mapping rules", file_name, mapping.len());

    let mapped_fields: Vec<&String> = mapping.values().collect();
    if !mapped_fields.contains(&&"tx_date".to_string()) || !mapped_fields.contains(&&"amount".to_string()) {
         return Err("필수 매핑 항목(날짜, 금액)이 지정되지 않았습니다.".to_string());
    }

    if ext == "xlsx" || ext == "xls" || ext == "xlsm" {
        let mut excel: Xlsx<_> = calamine::open_workbook_from_rs(Cursor::new(bytes)).map_err(|e: calamine::XlsxError| e.to_string())?;
        let sheet = excel.sheet_names().get(0).ok_or("No sheets")?.clone();
        let range = excel.worksheet_range(&sheet).map_err(|e: calamine::XlsxError| e.to_string())?;
        
        let rows: Vec<Vec<String>> = range.rows()
             .map(|row| row.iter().map(|c| c.to_string()).map(|s| deep_clean_value(&s)).collect())
             .collect();
        
        let mut start_idx = 0;
        let mut col_map = HashMap::new();

        for (i, row) in rows.iter().enumerate().take(100) {
             let current_col_map = build_index_map(row, &mapping);
             if current_col_map.contains_key("tx_date") && current_col_map.contains_key("amount") {
                 start_idx = i + 1; 
                 col_map = current_col_map;
                 println!("[Mapping Engine] Found Header at Excel Row {}: {:?}", i+1, row);
                 break;
             }
        }
        
        let global_desc = if start_idx > 0 { extract_global_metadata(&rows[..start_idx-1]) } else { String::new() };
        
        if col_map.is_empty() { return Err("매핑된 헤더를 찾을 수 없습니다.".to_string()); }

        for (i, row) in rows.into_iter().skip(start_idx).enumerate() {
            if let Some(tx) = row_to_tx(&row, &col_map, &global_desc, file_name, i + start_idx + 1) {
                results.push(tx);
            }
        }
    } else {
        let decoded = crate::ai::robust_parser::detect_and_decode(bytes)?;
        let delimiter = detect_delimiter(&decoded);
        
        let mut rdr = ReaderBuilder::new()
            .has_headers(false)
            .flexible(true)
            .delimiter(delimiter)
            .trim(csv::Trim::All)
            .from_reader(decoded.as_bytes());

        let all_records: Vec<Vec<String>> = rdr.records()
            .filter_map(|r| r.ok())
            .map(|r| r.iter().map(|s| deep_clean_value(s)).collect())
            .collect();
        
        let mut start_idx = 0;
        let mut col_map = HashMap::new();

        for (i, row) in all_records.iter().enumerate().take(100) {
             let mut check_row = row.clone();
             if check_row.len() == 1 {
                 if check_row[0].contains('\t') { check_row = smart_split(&check_row[0], b'\t'); }
                 else if check_row[0].contains(',') { check_row = smart_split(&check_row[0], b','); }
                 else if check_row[0].contains(';') { check_row = smart_split(&check_row[0], b';'); }
             }
             let current_col_map = build_index_map(&check_row, &mapping);
             if current_col_map.contains_key("tx_date") && current_col_map.contains_key("amount") {
                 start_idx = i + 1;
                 col_map = current_col_map;
                 println!("[Mapping Engine] Found Header at CSV Row {}: {:?}", i+1, check_row);
                 break;
             }
        }

        let global_desc = if start_idx > 0 { extract_global_metadata(&all_records[..start_idx-1]) } else { String::new() };

        if col_map.is_empty() { return Err("매핑된 헤더를 CSV 파일에서 찾을 수 없습니다.".to_string()); }

        for (idx, row) in all_records.into_iter().skip(start_idx).enumerate() {
             let mut process_row = row.clone();
             if process_row.len() == 1 && col_map.values().max().unwrap_or(&0) > &0 {
                 if process_row[0].contains('\t') { process_row = smart_split(&process_row[0], b'\t'); }
                 else if process_row[0].contains(',') { process_row = smart_split(&process_row[0], b','); }
                 else if process_row[0].contains(';') { process_row = smart_split(&process_row[0], b';'); }
             }

             if let Some(tx) = row_to_tx(&process_row, &col_map, &global_desc, file_name, idx + start_idx + 1) {
                 results.push(tx);
             }
        }
    }
    
    if results.is_empty() { println!("[Mapping Engine] WARNING: No valid transactions extracted."); }
    Ok(results)
}

// [Antigravity] Smart Splitter for Single-Column Dirty Rows
fn smart_split(s: &str, delimiter: u8) -> Vec<String> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .delimiter(delimiter)
        .trim(csv::Trim::All)
        .from_reader(s.as_bytes());
    
    if let Some(result) = rdr.records().next() {
        if let Ok(record) = result {
            return record.iter().map(|field| deep_clean_value(field)).collect();
        }
    }
    vec![deep_clean_value(s)]
}

fn build_index_map(headers: &[String], mapping: &HashMap<String, String>) -> HashMap<String, usize> {
    let mut index_map = HashMap::new();
    
    for (header, standard_field) in mapping {
        let m_norm = normalize_key(&header);
        for (i, h) in headers.iter().enumerate() {
            let h_norm = normalize_key(h);
            if h_norm == m_norm {
                index_map.insert(standard_field.clone(), i);
                break;
            }
        }
    }
    
    index_map
}

/// [Antigravity] Smart Merchant-to-Account Engine (V5 Bridge)
fn suggest_account_from_merchant(vendor: &str, desc: &str) -> crate::core::models::AccountInference {
    let mut tx = crate::core::models::ParsedTransaction::default();
    tx.vendor = Some(vendor.to_string());
    tx.description = Some(desc.to_string());
    
    // Enhanced pattern matching
    let v_norm = vendor.to_lowercase();
    if v_norm.contains("쿠팡") || v_norm.contains("네이버") || v_norm.contains("배달") {
        return crate::ai::rule_based_classifier::infer_account_v2(&tx);
    }
    
    crate::ai::rule_based_classifier::infer_account_v2(&tx)
}

fn row_to_tx(row: &[String], col_map: &HashMap<String, usize>, global_desc: &str, file_name: &str, row_idx: usize) -> Option<ParsedTransaction> {
    let date_raw = col_map.get("tx_date").and_then(|&i| row.get(i)).cloned().unwrap_or_default();
    let amount_raw = col_map.get("amount").and_then(|&i| row.get(i)).cloned().unwrap_or_default();
    let vendor = col_map.get("vendor").and_then(|&i| row.get(i)).cloned().unwrap_or_else(|| "기타".to_string());
    let mut desc = col_map.get("description").and_then(|&i| row.get(i)).cloned().unwrap_or_default();
    
    if desc.trim().is_empty() && !global_desc.is_empty() {
        desc = global_desc.to_string();
    }

    let payment = col_map.get("payment_type").and_then(|&i| row.get(i)).cloned();
    let bank_name = col_map.get("bank_name").and_then(|&i| row.get(i)).cloned();
    let bank_account = col_map.get("bank_account").and_then(|&i| row.get(i)).cloned();
    let category = col_map.get("category").and_then(|&i| row.get(i)).cloned();
    let mut account_subject = col_map.get("account_name").and_then(|&i| row.get(i)).cloned();

    let mut inference = None;
    if account_subject.is_none() || account_subject.as_ref().map(|s| s.is_empty() || s == "기타").unwrap_or(false) {
        let inf = suggest_account_from_merchant(&vendor, &desc);
        account_subject = Some(inf.account_name.clone());
        inference = Some(inf.clone());
    }

    // [Step 3] Card Deep-Dive Extraction
    let principal_amount = col_map.get("principal_amount").and_then(|&i| row.get(i)).map(|s| sanitize_amount(s));
    let benefit_amount = col_map.get("benefit_amount").and_then(|&i| row.get(i)).map(|s| sanitize_amount(s));
    let fee_amount = col_map.get("fee_amount").and_then(|&i| row.get(i)).map(|s| sanitize_amount(s));
    let tax_amount = col_map.get("tax_amount").and_then(|&i| row.get(i)).map(|s| sanitize_amount(s));
    let total_amount = col_map.get("total_amount").and_then(|&i| row.get(i)).map(|s| sanitize_amount(s));

    // Journal Entry Specifics
    let debit_account_mapped = col_map.get("debit_account").and_then(|&i| row.get(i)).cloned();
    let credit_account_mapped = col_map.get("credit_account").and_then(|&i| row.get(i)).cloned();
    let vat_raw = col_map.get("vat_amount").and_then(|&i| row.get(i)).cloned();
    let entry_type_mapped = col_map.get("entry_type").and_then(|&i| row.get(i)).cloned();

    let clean_date = sanitize_date(&date_raw);
    let mut clean_amount = sanitize_amount(&amount_raw);

    // [CFO Architecture] Principle: Prioritize Principal + Components for the ledger
    if let Some(pa) = principal_amount {
        if pa != 0.0 && clean_amount == 0.0 {
            clean_amount = pa;
        }
    }

    if let Some(ba) = billable_amount {
        if ba != 0.0 && clean_amount == 0.0 {
            clean_amount = ba;
        }
    }

    // [Step 4] Row Classification (Transaction vs Summary vs Metadata)
    let joined_row = row.join(" ");
    let is_summary = joined_row.contains("합계") || joined_row.contains("청구금액") || joined_row.contains("소계") || joined_row.contains("Total");
    
    let row_type = if is_summary {
        Some(crate::core::models::RowType::Summary)
    } else if !clean_date.is_empty() && clean_amount != 0.0 {
        Some(crate::core::models::RowType::Transaction)
    } else {
        None // Junk or Header
    };

    // [Antigravity] Survival-mode Validation
    // 1. Skip rows that look like junk
    if row_type.is_none() && !is_summary {
        return None;
    }

    // 2. Strong skip for document titles
    let lower_desc = desc.to_lowercase();
    if lower_desc.contains("[") && lower_desc.contains("]") && lower_desc.contains("내역서") { return None; }
    
    // 3. Skip header-like rows that were accidentally picked up
    if clean_date.is_empty() && clean_amount == 0.0 && desc.is_empty() { return None; }

    // [CFO Strategy] Extract Card Identity for specific AP mapping
    let card_brand = if file_name.to_lowercase().contains("hana") || file_name.contains("하나") { Some("하나카드") }
                    else if file_name.to_lowercase().contains("shinhan") || file_name.contains("신한") || file_name.to_lowercase().contains("sh") { Some("신한카드") }
                    else if file_name.to_lowercase().contains("samsung") || file_name.contains("삼성") { Some("삼성카드") }
                    else if file_name.to_lowercase().contains("hyundai") || file_name.contains("현대") { Some("현대카드") }
                    else if file_name.to_lowercase().contains("kookmin") || file_name.contains("국민") || file_name.to_lowercase().contains("kb") { Some("국민카드") }
                    else if file_name.to_lowercase().contains("woori") || file_name.contains("우리") { Some("우리카드") }
                    else { None };
    let clean_vat = vat_raw.as_ref().map(|v| sanitize_amount(v)).unwrap_or((clean_amount.abs() / 11.0).round());

    let is_journal_mode = debit_account_mapped.is_some() || credit_account_mapped.is_some();
    let mut debit_account = debit_account_mapped.clone();
    let mut credit_account = credit_account_mapped.clone();

    // In journal mode, be sparse. In smart mode, apply defaults.
    if !is_journal_mode {
        if debit_account.is_none() { 
            debit_account = account_subject.clone().or(Some("미분류".to_string()));
        }
        if credit_account.is_none() { credit_account = Some("미지급금".to_string()); }
    }

    // 1. Determine Payment Status (Only if not in explicit journal mode)
    if !is_journal_mode {
        if let Some(ref method) = payment {
            let m = method.to_lowercase();
            if m.contains("현금") || m.contains("cash") {
                credit_account = Some("현금".to_string());
            } else if m.contains("이체") || m.contains("transfer") || m.contains("통장") {
                credit_account = Some("보통예금".to_string());
            } else if m.contains("카드") || m.contains("card") || m.contains("신용") || m.contains("승인") {
                if let Some(brand) = card_brand {
                    credit_account = Some(format!("미지급금({})", brand));
                } else {
                    credit_account = Some("미지급금".to_string());
                }
            }
        } else if let Some(brand) = card_brand {
             // If no payment method found but file name suggests a specific card, use it
             credit_account = Some(format!("미지급금({})", brand));
        }
    }

    let mut tx = ParsedTransaction {
        date: Some(clean_date.clone()),
        amount: clean_amount.abs(),
        vat: clean_vat,
        entry_type: if let Some(et) = entry_type_mapped {
            Some(et)
        } else if let Some(cat) = &category {
            // [Antigravity] Context Injection: Use mapped category as authoritative reference
            Some(cat.clone())
        } else if !is_journal_mode && (clean_amount < 0.0 || desc.contains("매출") || desc.contains("수익")) { 
            credit_account = Some("매출".to_string()); // Revenue logic override
            Some("Revenue".to_string())
        } else if !is_journal_mode && (desc.contains("자본금") || desc.contains("납입") || desc.contains("투자")) {
            credit_account = Some("자본금".to_string());
            Some("Equity".to_string())
        } else if is_journal_mode {
            Some("Manual".to_string()) // In journal mode, we trust the accounts
        } else { 
            Some("Expense".to_string())
        },
        description: Some(desc.clone()),
        vendor: Some(vendor),
        account_name: if let Some(subj) = account_subject { 
            Some(subj) 
        } else if !is_journal_mode && (desc.contains("자본금") || desc.contains("납입") || desc.contains("투자")) {
            Some("보통예금".to_string())
        } else { 
            debit_account.clone()
        }, 
        reasoning: if is_journal_mode {
            "Journal Import Mode: Direct mapping from Debit/Credit columns.".to_string()
        } else if let Some(cat) = &category {
            format!("Cognitive Ledger Engine: Mapped from Category '{}'. (Offset: {})", cat, credit_account.as_deref().unwrap_or("미지급금"))
        } else {
            format!("Cognitive Ledger Engine (Pro) 스마트 변환 적용됨 (Offset: {})", credit_account.as_deref().unwrap_or("미지급금"))
        },
        confidence: Some(if is_journal_mode { "High".to_string() } else { "Medium".to_string() }),
        payment_method: payment,
        bank_name,
        bank_account,
        is_journal_mode,
        position: if is_journal_mode {
            if debit_account_mapped.is_some() && credit_account_mapped.is_none() { Some("Debit".to_string()) }
            else if debit_account_mapped.is_none() && credit_account_mapped.is_some() { Some("Credit".to_string()) }
            else { None }
        } else { None },
        debit_account: debit_account.clone(),
        credit_account: credit_account.clone(),
        audit_trail: vec![
            format!("Source: {} (Row {})", file_name, row_idx),
            format!("[{}] Ingestion: {}", chrono::Local::now().format("%H:%M:%S"), if is_journal_mode { "Journal Import" } else { "Smart Mapping" })
        ],
        id: Some(crate::utils::id_generator::generate_id(&clean_date, crate::utils::id_generator::IdPrefix::AI)),
        principal_amount: principal_amount.or(Some(total_amount)),
        benefit_amount,
        fee_amount,
        tax_amount,
        total_amount,
        row_type,
        inference,
        ..Default::default()
    };
    
    // [Antigravity] Auto-Pairing Logic: Enforce Double-Entry Integrity
    if !is_journal_mode {
        if let Some(cat) = &category {
            let cat_lower = cat.to_lowercase();
            if cat_lower == "equity" || cat_lower == "revenue" || cat_lower.contains("매출") || cat_lower.contains("자본") {
                // Inflow -> Debit: Bank, Credit: Subject
                tx.entry_type = Some(if cat_lower.contains("자본") { "Equity".to_string() } else { "Revenue".to_string() });
                tx.debit_account = Some("보통예금".to_string());
                tx.credit_account = tx.account_name.clone().or(Some(if cat_lower.contains("자본") { "자본금".to_string() } else { "매출".to_string() })); // Fallback
            } else {
                // Outflow -> Debit: Subject, Credit: Bank (or AP)
                tx.entry_type = Some("Expense".to_string());
                tx.debit_account = tx.account_name.clone().or(Some("미분류".to_string()));
                // If payment method allows, use Bank, otherwise AP
                if credit_account.as_ref().map(|s| s == "미지급금").unwrap_or(false) && (desc.contains("이체") || desc.contains("출금") || desc.contains("체크") || desc.contains("계좌")) {
                    tx.credit_account = Some("보통예금".to_string());
                } else {
                    tx.credit_account = credit_account.clone();
                }
            }
        } else {
            // Fallback if no category - apply smart offset based on description
            if desc.contains("자본금") || desc.contains("납입") || desc.contains("투자") {
                tx.debit_account = Some("보통예금".to_string());
                tx.credit_account = Some("자본금".to_string());
            } else if desc.contains("이체") || desc.contains("출금") || desc.contains("체크") || desc.contains("계좌") {
                tx.debit_account = debit_account.clone();
                tx.credit_account = Some("보통예금".to_string());
            } else {
                tx.debit_account = debit_account.clone();
                tx.credit_account = credit_account.clone();
            }
        }
    }
    
    // Attempt rule based (Suggestion Only)
    tx.suggestion = crate::ai::rule_based_classifier::classify_by_rules(&tx);
    
    Some(tx)
}

pub fn sanitize_amount(s: &str) -> f64 {
    let raw = s.trim();
    if raw.is_empty() { return 0.0; }

    // [Antigravity] Survival-mode Aggressive Extraction
    // Handle: "₩ 1,200,000원", "1.5E+08", "(1,000)"
    let clean: String = raw.chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-' || *c == 'E' || *c == 'e' || *c == '+')
        .collect();
    
    if clean.is_empty() || clean == "." || clean == "-" || clean == "+" {
        return 0.0;
    }

    let mut val = clean.parse::<f64>().unwrap_or(0.0);
    
    // Check for negative accounting format "(123)"
    if raw.contains('(') && raw.contains(')') && val > 0.0 {
        val = -val;
    }

    val
}

pub fn sanitize_date(s: &str) -> String {
    // 1. Pre-process: Replace common separators and remove spaces for easier splitting
    let clean = s.replace("년", "-").replace("월", "-").replace("일", "")
                 .replace("\"", "").replace(".", "-").replace("/", "-");
    
    // 2. Extract parts by splitting on '-' and filtering for numeric content
    let parts: Vec<String> = clean.split('-')
        .map(|p| p.chars().filter(|c| c.is_ascii_digit()).collect::<String>())
        .filter(|p| !p.is_empty())
        .collect();
    
    if parts.len() >= 3 {
        let year = &parts[0];
        let month = &parts[1];
        let day = &parts[2];
        let final_year = if year.len() == 2 { format!("20{}", year) } else { year.to_string() };
        let final_month = if month.len() == 1 { format!("0{}", month) } else { month.to_string() };
        let final_day = if day.len() == 1 { format!("0{}", day) } else { day.to_string() };
        return format!("{}-{}-{}", final_year, final_month, final_day);
    }
    
    // 3. Handle YYYYMMDD format
    if s.len() == 8 && s.chars().all(|c| c.is_numeric()) {
        let year = &s[0..4];
        let month = &s[4..6];
        let day = &s[6..8];
        return format!("{}-{}-{}", year, month, day);
    }

    // 4. Return empty if not a valid date
    String::new()
}
