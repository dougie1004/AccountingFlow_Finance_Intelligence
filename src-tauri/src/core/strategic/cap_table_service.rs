use tauri::command;
use super::cap_table_models::{FundingRound, CapTableState, ControlAlert};
use super::cap_table_engine::{simulate_cap_table, get_control_alert};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CapTableSimulationResponse {
    pub states: Vec<CapTableState>,
    pub alert: ControlAlert,
}

#[command]
pub fn simulate_cap_table_command(
    initial_ownership: f64,
    rounds: Vec<FundingRound>
) -> Result<CapTableSimulationResponse, String> {
    let states = simulate_cap_table(initial_ownership, rounds);
    
    let final_ownership = if let Some(last_state) = states.last() {
        last_state.founder_ownership
    } else {
        initial_ownership
    };

    let alert = get_control_alert(final_ownership);

    Ok(CapTableSimulationResponse {
        states,
        alert,
    })
}
