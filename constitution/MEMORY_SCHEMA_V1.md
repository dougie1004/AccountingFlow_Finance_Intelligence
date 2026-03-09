# [Phase 8] Business Intelligence Memory Layer: V1.0 Schema Specification

## 1. Objective
To evolve the accounting engine from a static rule-based system to an adaptive, pattern-recognizing intelligence. The memory layer must capture the *context* of a transaction, not just keywords, to ensure precise multi-leg journal recommendations.

## 2. High-Precision Memory Key Structure
A "Memory Key" is a unique hash generated from the following environmental signals:

| Signal | Source | Purpose | Example |
| :--- | :--- | :--- | :--- |
| `source` | `Parsing Metadata` | Distinguish between Credit Card, Bank, or Tax Invoice behaviors. | `CARD_SHINHAN` |
| `flow` | `Transaction Direction` | Inflow/Outflow distinction. | `OUT` |
| `normalized_vendor` | `Vendor Cleanup Engine` | Standardize "Coupang Pay" and "Coupang" into a single entity. | `COUPANG` |
| `amount_bucket` | `Value Analysis` | Distinguish small routine costs from large strategic investments. | `< 50,000 KRW` |
| `month_context` | `Temporal Signal` | Capture seasonal patterns (e.g. quarterly taxes, annual bonuses). | `OCTOBER` |

## 3. Storage Schema (Conceptual)
Transactions are stored as "Patterns" mapped to "Entry Templates".

### `business_patterns` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `pattern_id` | `UUID` | Primary Key |
| `context_hash` | `String` | SHA-256 of the combined Memory Key signals. |
| `debit_legs` | `JSON` | Array of `{ account: string, ratio: float }` or fixed amounts. |
| `credit_legs` | `JSON` | Array of `{ account: string, ratio: float }`. |
| `usage_count` | `Integer` | Used for ranking recommendations (highest count wins). |
| `last_used_at` | `DateTime` | Used for decay logic (prioritize recent habits). |
| `reference_je` | `String` | The first `JournalNumber` that taught this pattern (Audit link). |

## 4. Learning Loop (The "Moment of Truth")
1. **The Encounter**: User confirms a journal in the "Active Editor".
2. **The Extraction**: System extracts the context (Key) and the final structure (Value).
3. **The Imprint**:
    - If the Key exists, update `usage_count` and `last_used_at`.
    - If new, create a new record.
4. **The Feedback**: On next ingestion, the System queries Memory first by `context_hash`.

## 5. Integration Guard (Constitutional Art. 25)
"If Memory is uncertain (low usage_count or multiple conflicting patterns), the System MUST reject auto-classification and defer to Human Judgment."

---
**Status**: [Document Drafted]
**Next Step**: Implementation of SQLite `business_patterns` table in Rust backend.
