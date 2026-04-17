use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use chrono::{DateTime, Utc, Duration};

pub struct QuotaManager {
    usage: Arc<Mutex<HashMap<String, UserQuota>>>,
}

#[derive(Clone, Debug)]
struct UserQuota {
    tenant_id: String,
    daily_units: u32,
    monthly_units: u32,
    last_reset: DateTime<Utc>,
    total_cost_usd: f64,
}

impl QuotaManager {
    pub fn new() -> Self {
        QuotaManager {
            usage: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn can_use_ai(&self, tenant_id: &str, tier: &str, weight: u32) -> Result<(), String> {
        let mut usage = self.usage.lock().unwrap();
        let quota = usage.entry(tenant_id.to_string()).or_insert(UserQuota {
            tenant_id: tenant_id.to_string(),
            daily_units: 0,
            monthly_units: 0,
            last_reset: Utc::now(),
            total_cost_usd: 0.0,
        });

        // Reset daily units if 24h passed
        if Utc::now() - quota.last_reset > Duration::hours(24) {
            quota.daily_units = 0;
            quota.last_reset = Utc::now();
        }

        let (daily_limit, monthly_limit) = match tier {
            "Free" => (10, 100),      // Strategically limited to drive conversion (approx 5 OCRs/day)
            "Pro" => (500, 5000),     // Professional tier
            "Enterprise" => (5000, 50000), 
            _ => (10, 100),           // Default minimal
        };



        if quota.daily_units + weight > daily_limit {
            return Err(format!("Daily AI Quota exceeded. (Used: {}, Limit: {}). Please upgrade to Pro or wait until tomorrow.", quota.daily_units, daily_limit));
        }

        if quota.monthly_units + weight > monthly_limit {
            return Err(format!("Monthly AI Quota exceeded. (Used: {}, Limit: {}).", quota.monthly_units, monthly_limit));
        }

        Ok(())
    }

    pub fn record_usage(&self, tenant_id: &str, units: u32) {
        let mut usage = self.usage.lock().unwrap();
        let quota = usage.entry(tenant_id.to_string()).or_insert(UserQuota {
            tenant_id: tenant_id.to_string(),
            daily_units: 0,
            monthly_units: 0,
            last_reset: Utc::now(),
            total_cost_usd: 0.0,
        });
        
        quota.daily_units += units;
        quota.monthly_units += units;
        
        // Estimate cost based on units (1 unit ~ 0.0001 USD for internal tracking)
        quota.total_cost_usd += (units as f64) * 0.0001;
    }

    pub fn sync_from_cloud(&self, tenant_id: &str, cloud_units: u32) {
        let mut usage = self.usage.lock().unwrap();
        let quota = usage.entry(tenant_id.to_string()).or_insert(UserQuota {
            tenant_id: tenant_id.to_string(),
            daily_units: cloud_units,
            monthly_units: cloud_units,
            last_reset: Utc::now(),
            total_cost_usd: 0.0,
        });
        
        // If cloud says 0 (reset), force reset local regardless of current state
        if cloud_units == 0 {
            quota.daily_units = 0;
            quota.monthly_units = 0;
            quota.last_reset = Utc::now();
        } else {
            // Otherwise, only jump forward to cloud count to ensure local doesn't miss remote consumption
            if cloud_units > quota.daily_units {
                quota.daily_units = cloud_units;
            }
        }
    }

    pub fn refund_usage(&self, tenant_id: &str, units: u32) {
        let mut usage = self.usage.lock().unwrap();
        if let Some(quota) = usage.get_mut(tenant_id) {
            if quota.daily_units >= units {
                quota.daily_units -= units;
            } else {
                quota.daily_units = 0;
            }
            
            if quota.monthly_units >= units {
                quota.monthly_units -= units;
            } else {
                quota.monthly_units = 0;
            }
            
            // Refund estimated cost
            quota.total_cost_usd -= (units as f64) * 0.0001;
            if quota.total_cost_usd < 0.0 { quota.total_cost_usd = 0.0; }
        }
    }


    pub fn get_usage(&self, tenant_id: &str) -> Option<(u32, u32, f64)> {
        let usage = self.usage.lock().unwrap();
        usage.get(tenant_id).map(|q| (q.daily_units, q.monthly_units, q.total_cost_usd))
    }
}


lazy_static::lazy_static! {
    pub static ref QUOTA_MANAGER: QuotaManager = QuotaManager::new();
}
