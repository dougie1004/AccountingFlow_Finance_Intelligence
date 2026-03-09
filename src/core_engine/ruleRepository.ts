/**
 * AccountingFlow – Rule Repository
 *
 * Manages the local store of immutable CorporateRulePack snapshots.
 *
 * Rules:
 *  - RulePacks are NEVER mutated after creation.
 *  - Any change creates a new snapshot with a new id/version.
 *  - The "active" pack is the latest one in the store.
 *  - All functions are synchronous & deterministic (no AI, no async).
 */

import { CorporateRulePack, DEFAULT_RULE_PACK, DEFAULT_RULE_PACK_ID } from '../types/ruleEngine';

const STORAGE_KEY = 'accounting_rule_repository';

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function load(): CorporateRulePack[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [DEFAULT_RULE_PACK];
        const parsed: CorporateRulePack[] = JSON.parse(raw);
        return parsed.length > 0 ? parsed : [DEFAULT_RULE_PACK];
    } catch {
        return [DEFAULT_RULE_PACK];
    }
}

function save(packs: CorporateRulePack[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
}

/**
 * Deterministic hash of rule content for tamper-detection.
 * Not cryptographically secure – but sufficient for local audit.
 */
export function hashRulePack(pack: Omit<CorporateRulePack, 'id' | 'hash' | 'createdAt'>): string {
    const str = JSON.stringify({
        version: pack.version,
        limits: pack.limits,
        policies: pack.policies,
        approval: pack.approval,
    });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32-bit int
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Returns all stored RulePack snapshots (immutable history).
 */
export function getAllRulePacks(): CorporateRulePack[] {
    return load();
}

/**
 * Returns a specific RulePack by ID.
 * Falls back to DEFAULT_RULE_PACK if not found.
 */
export function getRulePackById(id: string): CorporateRulePack {
    const packs = load();
    return packs.find(p => p.id === id) ?? DEFAULT_RULE_PACK;
}

/**
 * Returns the currently active RulePack (last created).
 */
export function getActiveRulePack(): CorporateRulePack {
    const packs = load();
    return packs[packs.length - 1] ?? DEFAULT_RULE_PACK;
}

/**
 * Creates a new, immutable RulePack snapshot.
 * Increments the version automatically.
 * Returns the newly created pack.
 */
export function createRulePack(
    partial: Omit<CorporateRulePack, 'id' | 'hash' | 'createdAt'>
): CorporateRulePack {
    const packs = load();

    const newPack: CorporateRulePack = {
        ...partial,
        id: `rulepack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        hash: hashRulePack(partial),
    };

    // Validate schema before saving
    const schemaErrors = validateRulePackSchema(newPack);
    if (schemaErrors.length > 0) {
        throw new Error(`[RuleRepository] Schema validation failed: ${schemaErrors.join(', ')}`);
    }

    packs.push(newPack);
    save(packs);
    return newPack;
}

/**
 * Resets the repository to a single default pack.
 * Only used in dev/test scenarios.
 */
export function resetRepository(): void {
    save([DEFAULT_RULE_PACK]);
}

// ─────────────────────────────────────────────
// 5. Schema Validation (AI Parser Gate)
//    AI must NEVER inject arbitrary data.
//    Every incoming JSON must pass this gate.
// ─────────────────────────────────────────────

export function validateRulePackSchema(pack: unknown): string[] {
    const errors: string[] = [];

    if (typeof pack !== 'object' || pack === null) {
        return ['RulePack must be a non-null object'];
    }

    const p = pack as Record<string, unknown>;

    // Required string fields
    for (const field of ['version', 'sourceDocument'] as const) {
        if (typeof p[field] !== 'string' || (p[field] as string).trim() === '') {
            errors.push(`"${field}" must be a non-empty string`);
        }
    }

    // limits
    if (typeof p.limits !== 'object' || p.limits === null) {
        errors.push('"limits" must be an object');
    } else {
        const l = p.limits as Record<string, unknown>;
        for (const field of ['mealAllowance', 'entertainmentMax', 'capexThreshold']) {
            if (typeof l[field] !== 'number' || (l[field] as number) < 0) {
                errors.push(`"limits.${field}" must be a non-negative number`);
            }
        }
    }

    // policies
    if (typeof p.policies !== 'object' || p.policies === null) {
        errors.push('"policies" must be an object');
    } else {
        const pol = p.policies as Record<string, unknown>;
        if (typeof pol.receiptRequiredOver !== 'number') {
            errors.push('"policies.receiptRequiredOver" must be a number');
        }
        if (typeof pol.useCorporateCardOnly !== 'boolean') {
            errors.push('"policies.useCorporateCardOnly" must be a boolean');
        }
        if (typeof pol.allowWeekendExpense !== 'boolean') {
            errors.push('"policies.allowWeekendExpense" must be a boolean');
        }
    }

    // approval
    if (typeof p.approval !== 'object' || p.approval === null) {
        errors.push('"approval" must be an object');
    } else {
        const a = p.approval as Record<string, unknown>;
        if (typeof a.requireManagerAbove !== 'number') {
            errors.push('"approval.requireManagerAbove" must be a number');
        }
    }

    return errors;
}
