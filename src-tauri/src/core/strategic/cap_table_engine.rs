use super::cap_table_models::*;

pub fn evaluate_control_risk(founder_ownership: f64) -> ControlRiskLevel {
    if founder_ownership >= 0.667 {
        ControlRiskLevel::Safe
    } else if founder_ownership >= 0.334 {
        ControlRiskLevel::Warning
    } else {
        ControlRiskLevel::Critical
    }
}

pub fn get_control_alert(founder_ownership: f64) -> ControlAlert {
    let level = evaluate_control_risk(founder_ownership);
    let message = match level {
        ControlRiskLevel::Safe => "창업자가 특별결의 요건(66.7%) 이상의 지분을 보유하여 절대적인 경영권을 유지하고 있습니다.".to_string(),
        ControlRiskLevel::Warning => "특별결의 요건이 붕괴되었으나, 거부권 행사(33.4% 이상)를 통해 여전히 의사결정에 영향을 줄 수 있습니다.".to_string(),
        ControlRiskLevel::Critical => "거부권 행사 요건이 붕괴되었습니다. 경영권 방어 리스크가 매우 높으며, 적대적 M&A나 주요 의사결정에서의 배제 가능성이 있습니다.".to_string(),
    };
    
    ControlAlert { level, message }
}

pub fn simulate_cap_table(
    founder_initial_ownership: f64,
    rounds: Vec<FundingRound>,
) -> Vec<CapTableState> {
    let mut states = Vec::new();
    let mut current_founder_ownership = founder_initial_ownership;

    for round in rounds {
        let post_money = round.pre_money_valuation + round.investment_amount;
        let investor_ownership = if post_money > 0.0 {
            round.investment_amount / post_money
        } else {
            0.0
        };

        // Dilute founder
        current_founder_ownership = current_founder_ownership * (1.0 - investor_ownership);

        states.push(CapTableState {
            round_name: round.round_name,
            founder_ownership: current_founder_ownership,
            investor_ownership,
            post_money_valuation: post_money,
        });
    }

    states
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_round_dilution() {
        let rounds = vec![FundingRound {
            round_name: "Seed".to_string(),
            pre_money_valuation: 40_000_000_000.0,
            investment_amount: 10_000_000_000.0,
        }];
        let states = simulate_cap_table(1.0, rounds);
        assert_eq!(states.len(), 1);
        assert!((states[0].founder_ownership - 0.80).abs() < 0.001);
    }

    #[test]
    fn test_multiple_rounds() {
        let rounds = vec![
            FundingRound {
                round_name: "Seed".to_string(),
                pre_money_valuation: 40.0,
                investment_amount: 10.0,
            },
            FundingRound {
                round_name: "Series A".to_string(),
                pre_money_valuation: 120.0,
                investment_amount: 30.0,
            },
            FundingRound {
                round_name: "Series B".to_string(),
                pre_money_valuation: 300.0,
                investment_amount: 80.0,
            },
        ];
        let states = simulate_cap_table(1.0, rounds);
        assert_eq!(states.len(), 3);
        
        // Seed post = 50. Inv = 10/50 = 20%. Founder = 80%
        assert!((states[0].founder_ownership - 0.80).abs() < 0.001);
        
        // Series A post = 150. Inv = 30/150 = 20%. Founder = 80% * 80% = 64%
        assert!((states[1].founder_ownership - 0.64).abs() < 0.001);
        
        // Series B post = 380. Inv = 80/380 = ~21.05%. Founder = 64% * (1 - 0.2105) = 50.53%
        assert!((states[2].founder_ownership - 0.50526).abs() < 0.001);
    }

    #[test]
    fn test_control_risk() {
        assert_eq!(evaluate_control_risk(0.67), ControlRiskLevel::Safe);
        assert_eq!(evaluate_control_risk(0.667), ControlRiskLevel::Safe);
        assert_eq!(evaluate_control_risk(0.50), ControlRiskLevel::Warning);
        assert_eq!(evaluate_control_risk(0.334), ControlRiskLevel::Warning);
        assert_eq!(evaluate_control_risk(0.33), ControlRiskLevel::Critical);
    }
}
