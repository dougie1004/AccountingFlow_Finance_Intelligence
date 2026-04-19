use std::collections::HashMap;
use std::sync::RwLock;
use lazy_static::lazy_static;
use serde::{Serialize, Deserialize};
use serde_json;
use std::fs;
use std::path::PathBuf;

lazy_static! {
    static ref USER_PREFERENCES: RwLock<HashMap<String, String>> = RwLock::new(HashMap::new());
}

pub fn init(app_dir: &PathBuf) {
    let pref_path = app_dir.join("user_account_prefs.json");
    if pref_path.exists() {
        if let Ok(content) = fs::read_to_string(pref_path) {
            if let Ok(prefs) = serde_json::from_str::<HashMap<String, String>>(&content) {
                let mut cache = USER_PREFERENCES.write().unwrap();
                *cache = prefs;
                println!("[Self-Learning] Loaded {} user preferences.", cache.len());
            }
        }
    }
}

pub fn save_preference(app_dir: &PathBuf, vendor: String, account: String) -> Result<(), String> {
    let mut cache = USER_PREFERENCES.write().unwrap();
    cache.insert(vendor.to_lowercase(), account);
    
    let pref_path = app_dir.join("user_account_prefs.json");
    let content = serde_json::to_string_pretty(&*cache).map_err(|e| e.to_string())?;
    fs::write(pref_path, content).map_err(|e| e.to_string())?;
    
    Ok(())
}

pub fn get_preference(vendor: &str) -> Option<String> {
    let cache = USER_PREFERENCES.read().unwrap();
    cache.get(&vendor.to_lowercase()).cloned()
}
