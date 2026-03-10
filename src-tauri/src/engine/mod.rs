// Core Financial Engine Constitution
// Rule 1: Core is the Single Source of Truth (SSOT).
// Rule 2: Analysis and Simulation must only access Core in a read-only or clone fashion.
// Rule 3: Core must NEVER depend on Analysis or Simulation (Structural Integrity).

pub mod core;
pub mod analysis;
pub mod simulation;
