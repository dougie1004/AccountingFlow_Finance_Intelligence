use serde_json::Value;

#[tauri::command]
pub fn debug_echo_journals(journals: Value) -> Value {
    println!("==============================");
    println!("📥 RAW JSON RECEIVED");

    if let Some(arr) = journals.as_array() {
        println!("Count: {}", arr.len());
        if let Some(first) = arr.first() {
            println!("First item: {}", first);
        }
    }

    println!("==============================");
    
    // ❗ 절대 수정하지 말 것 (raw integrity check)
    journals
}
