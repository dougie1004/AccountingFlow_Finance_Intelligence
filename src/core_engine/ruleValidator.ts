/**
 * AccountingFlow – Deterministic Rule Validator
 *
 * Architecture:
 *   - NO UI alerts. Returns a structured ValidationResult.
 *   - NO async calls, NO AI calls.
 *   - Every check is a pure deterministic comparison.
 *
 * Usage:
 *   const result = validateEntryAgainstRules(entry, rulePack);
 *   if (result.blocked) { // prevent posting }
 *   result.violations.forEach(v => console.warn(v.message));
 */

import { JournalEntry } from '../types';
import { CorporateRulePack, ValidationResult, RuleViolation } from '../types/ruleEngine';

// ─────────────────────────────────────────────
// Main Validator
// ─────────────────────────────────────────────

export function validateEntryAgainstRules(
    entry: JournalEntry,
    rules: CorporateRulePack
): ValidationResult {
    const violations: RuleViolation[] = [];
    const amount = Math.abs(entry.amount || 0);
    const debit = entry.debitAccount || '';

    // ── Hard Rule 1: Meal Allowance Limit ──────────────────────────
    if (debit === '복리후생비' && amount > rules.limits.mealAllowance) {
        violations.push({
            code: 'HR_MEAL_LIMIT',
            severity: 'WARNING',
            message: `식대 한도 초과 (사규: ₩${rules.limits.mealAllowance.toLocaleString()}, 청구: ₩${amount.toLocaleString()})`,
            ruleId: 'HR_LIMIT_MEAL',
        });
    }

    // ── Hard Rule 2: Entertainment Limit ──────────────────────────
    if (debit === '접대비' && amount > rules.limits.entertainmentMax) {
        violations.push({
            code: 'HR_ENT_LIMIT',
            severity: 'ERROR',
            message: `접대비 한도 초과 → 장부 기록 차단 (사규: ₩${rules.limits.entertainmentMax.toLocaleString()}, 청구: ₩${amount.toLocaleString()})`,
            ruleId: 'HR_LIMIT_ENT',
        });
    }

    // ── Hard Rule 3: CAPEX Threshold ──────────────────────────────
    const ASSET_ACCOUNTS = ['비품', '기계장치', '차량운반구', '소프트웨어', '공구와기구'];
    if (ASSET_ACCOUNTS.includes(debit) && amount > 0 && amount < rules.limits.capexThreshold) {
        violations.push({
            code: 'HR_CAPEX_THRESHOLD',
            severity: 'WARNING',
            message: `자산화 기준금액(₩${rules.limits.capexThreshold.toLocaleString()}) 미만 – 당기비용 처리 권장`,
            ruleId: 'HR_LIMIT_CAPEX',
        });
    }

    // ── Hard Rule 4: Receipt Required Policy ─────────────────────
    const isExpense = entry.type === 'Expense' || ASSET_ACCOUNTS.includes(debit);
    if (isExpense && amount >= rules.policies.receiptRequiredOver) {
        if (!entry.attachments || entry.attachments.length === 0) {
            violations.push({
                code: 'HR_RECEIPT_MISSING',
                severity: 'ERROR',
                message: `적격증빙 필수 (₩${rules.policies.receiptRequiredOver.toLocaleString()} 이상) – 증빙 없이 장부 기록 불가`,
                ruleId: 'HR_POL_RECEIPT',
            });
        }
    }

    // ── Hard Rule 5: Weekend Expense Policy ──────────────────────
    if (entry.date) {
        const dayOfWeek = new Date(entry.date).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (isWeekend && !rules.policies.allowWeekendExpense && isExpense) {
            violations.push({
                code: 'HR_WEEKEND_EXPENSE',
                severity: 'WARNING',
                message: '휴일(주말) 지출 – 사전 승인 또는 사유서 필요',
                ruleId: 'HR_POL_WEEKEND',
            });
        }
    }

    // ── Hard Rule 6: Corporate Card Policy ────────────────────────
    const description = (entry.description || '').toLowerCase();
    if (
        rules.policies.useCorporateCardOnly &&
        (debit === '가지급금' || description.includes('개인카드') || description.includes('personal card'))
    ) {
        violations.push({
            code: 'HR_PERSONAL_CARD',
            severity: 'WARNING',
            message: '개인카드 사용 감지 – 법인카드 외 사용 금지 규정 확인 필요',
            ruleId: 'HR_POL_CORP_CARD',
        });
    }

    // ── Hard Rule 7: Manager Approval Threshold ───────────────────
    if (amount >= rules.approval.requireManagerAbove) {
        violations.push({
            code: 'HR_APPROVAL_REQUIRED',
            severity: 'INFO',
            message: `상위 관리자 전결 필요 (₩${rules.approval.requireManagerAbove.toLocaleString()} 이상)`,
            ruleId: 'HR_APP_MANAGER',
        });
    }

    return {
        blocked: violations.some(v => v.severity === 'ERROR'),
        violations,
    };
}

// ─────────────────────────────────────────────
// Posting Guard (Pipeline Interceptor)
// Applies validation to a batch of entries.
// Returns entries separated into allowed/blocked.
// ─────────────────────────────────────────────

export interface PostingGuardResult {
    allowed: JournalEntry[];
    blocked: Array<{ entry: JournalEntry; violations: RuleViolation[] }>;
    warnings: Array<{ entry: JournalEntry; violations: RuleViolation[] }>;
}

export function applyPostingGuard(
    entries: JournalEntry[],
    rules: CorporateRulePack
): PostingGuardResult {
    const allowed: JournalEntry[] = [];
    const blocked: PostingGuardResult['blocked'] = [];
    const warnings: PostingGuardResult['warnings'] = [];

    for (const entry of entries) {
        const result = validateEntryAgainstRules(entry, rules);

        if (result.blocked) {
            blocked.push({ entry, violations: result.violations.filter(v => v.severity === 'ERROR') });
        } else {
            // Stamp appliedRulePackId for audit trail
            const stamped: JournalEntry = {
                ...entry,
                appliedRulePackId: rules.id,
                appliedRuleVersion: rules.version,
            };
            allowed.push(stamped);

            const warnViolations = result.violations.filter(v => v.severity === 'WARNING' || v.severity === 'INFO');
            if (warnViolations.length > 0) {
                warnings.push({ entry: stamped, violations: warnViolations });
            }
        }
    }

    return { allowed, blocked, warnings };
}
