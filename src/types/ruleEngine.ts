/**
 * AccountingFlow – Corporate Rule Engine Types
 *
 * Architecture Principle:
 *   AI  = Parser  (converts documents → RulePack JSON)
 *   Engine = Judge (executes rules deterministically, never probabilistically)
 *
 * RulePacks are IMMUTABLE once created.
 * Any change produces a new snapshot with a new id/version.
 * Journal entries reference the rulePackId active at posting time.
 */

export type RuleSeverity = 'ERROR' | 'WARNING' | 'INFO';

// ─────────────────────────────────────────────
// 1. Core RulePack Snapshot (Immutable)
// ─────────────────────────────────────────────

export interface CorporateRulePack {
    /** Unique, immutable identifier for this snapshot */
    id: string;
    /** Semantic version string, e.g. "1.0", "1.1" */
    version: string;
    /** ISO-8601 creation timestamp */
    createdAt: string;
    /** Optional: source document filename or description */
    sourceDocument?: string;
    /** SHA-256 or simple deterministic hash of the rule content */
    hash: string;

    /** Quantitative, strict limits (Hard Rules) */
    limits: {
        mealAllowance: number;
        entertainmentMax: number;
        capexThreshold: number;
        [key: string]: number;
    };

    /** Boolean / threshold-based operational policies (Hard Rules) */
    policies: {
        receiptRequiredOver: number;
        useCorporateCardOnly: boolean;
        allowWeekendExpense: boolean;
        [key: string]: boolean | number;
    };

    /** Approval workflow thresholds */
    approval: {
        requireManagerAbove: number;
    };

    /** Source evidence for audit (page refs from original document) */
    evidence: {
        mealAllowanceContext?: string;
        mealAllowancePage?: number;
        entertainmentContext?: string;
        entertainmentPage?: number;
        [key: string]: string | number | undefined;
    };

    /** Soft/Interpretive rules (flagged for AI review, not blocking) */
    softRules: SoftRule[];
}

// ─────────────────────────────────────────────
// 2. Soft Rules (Interpretive – AI assists)
// ─────────────────────────────────────────────

export interface SoftRule {
    id: string;
    condition: string;
    description: string;
    severity: RuleSeverity;
}

// ─────────────────────────────────────────────
// 3. Validation Result (Engine output, no UI/alerts)
// ─────────────────────────────────────────────

export interface RuleViolation {
    code: string;
    severity: RuleSeverity;
    message: string;
    ruleId?: string;
}

export interface ValidationResult {
    /** True if any ERROR-severity violation was found → posting blocked */
    blocked: boolean;
    violations: RuleViolation[];
}

// ─────────────────────────────────────────────
// 4. Default RulePack (used until first real pack is created)
// ─────────────────────────────────────────────

export const DEFAULT_RULE_PACK_ID = 'default-v1.0';

export const DEFAULT_RULE_PACK: CorporateRulePack = {
    id: DEFAULT_RULE_PACK_ID,
    version: '1.0',
    createdAt: '2026-03-09T00:00:00.000Z',
    sourceDocument: 'Default Accounting Policy (System)',
    hash: 'default',
    limits: {
        mealAllowance: 30000,
        entertainmentMax: 500000,
        capexThreshold: 1000000,
    },
    policies: {
        receiptRequiredOver: 30000,
        useCorporateCardOnly: true,
        allowWeekendExpense: false,
    },
    approval: {
        requireManagerAbove: 500000,
    },
    evidence: {
        mealAllowanceContext: '복리후생비 식대는 인당 3만원 이하 (내부 회계처리 기준)',
    },
    softRules: [
        {
            id: 'SR_001',
            condition: 'entertainment',
            description: '사회 통념상 적절한 수준의 접대비인지 확인 (과도한 유흥성 지출 금지)',
            severity: 'WARNING',
        },
    ],
};
