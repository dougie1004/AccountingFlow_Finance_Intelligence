use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FounderOwnership {
    pub founder_shares: f64,
    pub total_shares: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FundingRound {
    pub round_name: String,
    pub pre_money_valuation: f64,
    pub investment_amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapTableState {
    pub round_name: String,
    pub founder_ownership: f64,
    pub investor_ownership: f64,
    pub post_money_valuation: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ControlRiskLevel {
    Safe,
    Warning,
    Critical,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ControlAlert {
    pub level: ControlRiskLevel,
    pub message: String,
}
