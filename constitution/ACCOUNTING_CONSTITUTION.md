# 📜 ACCOUNTINGFLOW CONSTITUTION v2.0
> "Financial Integrity is the supreme law of AccountingFlow."

---

## 🏛️ PART I. THE PRIME DIRECTIVE

### Article 0. [The Prime Directive]
**Financial Integrity is the supreme law of AccountingFlow.** No feature, AI output, UI enhancement, or automation may override or bypass the deterministic accounting engine. In any conflict between "Intelligence" (AI) and "Integrity" (Engine), the Engine’s deterministic truth must prevail unconditionally.

---

## ⚖️ PART II. CORE ACCOUNTING PRINCIPLES

### Article 1. [Atomic Nature]
Every account must have exactly one Nature.

### Article 2. [Section Exclusivity]
An account cannot belong to more than one financial statement section.

### Article 3. [Nature-Based Reporting]
Financial statements must ignore account names and rely only on Nature for aggregation and classification.

### Article 4. [Strict Persistence]
Accounts without a defined Nature must not be persisted, calculated, or displayed in any formal report.

### Article 5. [Zero Tolerance on Violation]
Any violation of core accounting logic must stop the calculation engine immediately to prevent the propagation of financial errors.

---

# 🛡️ AI Governance Policy v1.0
*(For AccountingFlow & AuditFlow – Production Grade Only)*

## Ⅰ. 목적 (Purpose)
본 정책은 회계·감사 시스템 내 AI 사용에 있어 다음을 보장하기 위함이다:
- 예측 가능성 (Predictability)
- 재현 가능성 (Reproducibility)
- 책임 분리 가능성 (Accountability Separation)
- 제품 안정성 (Production Stability)

> **AI는 “판단 보조 계층”이며, 결코 “재무 의사결정의 주체”가 아니다.**

## Ⅱ. 모델 등급 체계 (Model Tiering Framework)
AI 모델은 아래 3개 등급으로 분리한다.

### 🔴 Tier 1 – Production Core (Critical Engine)
- **적용 범위**: Ledger 분석, 리스크 점수 산정, 이상 거래 판정, DD/Compliance 판단 보조, 시스템 경보 생성
- **허용 조건**:
  - Stable 정식 릴리즈 모델만 사용
  - Deprecated/Experimental/Preview 금지
  - 모델 버전 명시적 고정 (Version Lock)
  - 자동 업그레이드 금지
- **금지**: exp / experimental 모델, Preview API, Behavior drift 가능 모델, Unstable temperature 기반 생성 판단

### 🟡 Tier 2 – Analytical Support Layer
- **적용 범위**: 리포트 요약, 설명 문구 생성, 내부 리뷰 초안, 사용자 친화적 표현 변환
- **허용 조건**:
  - Stable 모델 우선
  - 필요 시 제한적 Preview 허용
  - 단, 결과는 항상 Deterministic Core에 의해 검증됨

### 🟢 Tier 3 – Sandbox / R&D Layer
- **적용 범위**: 내부 테스트, 기능 실험, UX 실험, 모델 성능 비교
- **허용 조건**: exp 모델 사용 가능, 외부 고객 데이터 사용 금지, Production 환경 완전 격리

## Ⅲ. 모델 사용 원칙 (Core Principles)
1. **Deterministic Supremacy**: AI 판단은 항상 Rust/Local Deterministic 엔진보다 하위 계층이다. AI는 제안하고, Core Engine이 승인한다.
2. **Local-First Enforcement**: 원장 데이터 원본은 외부 전송 금지. 벡터화 또는 구조적 신호만 전송 가능. 개인식별정보(PII) 외부 전송 금지.
3. **Version Lock & Audit Log**: 사용 모델명, 버전, 파라미터 고정. 판단 결과와 함께 모델 버전 로그 저장. 사후 재현 테스트 가능해야 함.
4. **No Silent Drift Rule**: 모델 변경 시 사전 테스트 필수. 결과 차이 분석 보고서 작성. Production 반영 전 승인 절차 필요.

## Ⅳ. 책임 분리 구조 (Liability Separation)
| 영역 | 책임 주체 |
| :--- | :--- |
| 데이터 정확성 | 사용자 |
| Deterministic 계산 | 시스템 |
| AI 제안 해석 | 사용자 승인 후 반영 |
| 최종 회계 반영 | 사용자 Confirm 필수 |

> **AI는 법적 판단 주체가 아니다.**

## Ⅴ. 금지 규정 (Explicit Prohibitions)
- Experimental 모델의 Production Core 사용 금지
- 모델 자동 교체 허용 금지
- 비가시적 AI 판단 반영 금지
- Explainability 없는 점수 산정 금지

---

# 📊 Annex A. 전략적 시나리오별 재무 전망 요약 (2026-2028)

본 시뮬레이션은 KOSA(한국소프트웨어산업협회) 2024-25 임금 실태조사 데이터와 4대보험/퇴직충당금(1.183배)을 반영한 실질 인건비를 기반으로 산출되었습니다.

### 1. 🛡️ 생존 모드 (Survival: 초정예 자력 생존)
*목표: 외부 지원 없이 순수 자본금 5천만 원으로 유저 800명 도달 및 BEP 검증*

| 구분 | 2026년 (설립/Lean) | 2027년 (성장/고통) | 2028년 (안정/결실) |
| :--- | :--- | :--- | :--- |
| **인력 구성** | CEO(무급), 주니어1 (9월 채용) | CEO(5M), 주니어1 | CEO(5M), 주니어1 |
| **유저 로드맵** | 연말 60명 | 연말 300명 | 연말 800명 |
| **연 매출** | 약 150만 원 | 약 7,700만 원 | 약 2억 3,600만 원 |
| **연 순이익** | 약 -4,600만 원 | 약 -1억 2,000만 원 | 약 +6,000만 원 |
| **기말 잔액** | 약 350만 원 (데드라인) | 약 3,300만 원 (자본 확충) | 약 +9,300만 원 (회수 시작) |

> **CFO 평**: 생존 모드는 2027년에 약 1.5~2억 원 내외의 추가 자입(유상증자)이 필연적으로 발생합니다. 대표님이 개인 자금을 '가수금'이 아닌 '자본금'으로 납입함으로써 재무 구조를 건실하게 유지하고, 향후 기관 투자를 받기에 유리한 기초 체력을 확보하는 시나리오입니다.

---

### 2. 🟢 표준 성장 (Standard: 지원금 레버리지)
*목표: 경영권을 지키며 정부지원금 5천만 원을 레버리지로 성장을 가속화*

| 구분 | 2026년 (지원금 수령) | 2027년 | 2028년 |
| :--- | :--- | :--- | :--- |
| **인력 구성** | CEO(무급), 주니어1 (9월 채용) | 대표+초급1+중급1 (점진 충원) | 대표+초급1+중급1+마1 |
| **자본 조달** | 자본금 50M + **지원금 50M** | 추가 외부 투자 없음 (경영권 방어) | 영업이익으로만 운영 |
| **연 매출** | 약 150만 원 | 약 8,200만 원 | 약 2억 5,000만 원 |
| **연 순이익** | 약 +400만 원 | 약 -1억 2,000만 원 | 약 +6,500만 원 |
| **기말 잔액** | 약 5,400만 원 (여유) | 약 8,000만 원 (자본 확충) | 약 1억 4,000만 원 |

> **CFO 평**: 표준 모드 역시 투자가 없는 시나리오에서는 2027년에 자금 압박이 오지만, 이를 대표님의 추가 증자로 해결합니다. 정부지원금 5천만 원이 이미 '순자산'을 불려두었기에, Survival 모드보다 증자 부담이 적으며 훨씬 탄탄한 재무 상태로 2028년 흑자 전환을 맞이합니다.

---

### 3. 🚀 공격 확장 (Growth: 팀 6인 + 투자 10억)
*목표: 압도적 자본력으로 시장을 선점하여 2028년 유저 2,000명 이상 달성*

| 구분 | 2026년 | 2027년 | 2028년 |
| :--- | :--- | :--- | :--- |
| **연 매출** | 약 250만 원 | 약 2억 원 | 약 8억 원 |
| **연 순이익** | 약 -1억 5,000만 원 | 약 -4억 원 | 약 +2억 5,000만 원 |
| **기말 잔액** | 약 1억 원 | 약 7억 원 (Series A 유치) | 약 9억 5,000만 원 |

---
*본 요약 자료는 회계 헌법 제17조 및 제18조의 실행 지침으로 활용되며, 시뮬레이션 엔진의 결과값 검증 기준(Baseline)이 된다.*

---
*본 요약 자료는 회계 헌법 제17조 및 제18조의 실행 지침으로 활용되며, 시뮬레이션 엔진의 결과값 검증 기준(Baseline)이 된다.*

Article 19. [Historical Integrity and Metadata Accountability] Every imported record must preserve its original metadata, specifically Supplemental Notes (Remarks/비고). Ignoring supplemental context during ingestion is a violation of financial traceability. AI engines must synthesize both the primary description and supplemental notes to ensure account classification accuracy.

Article 20. [Intelligent VAT Fairness] The system must uphold the principle of Net Value. For single-entry imports lacking VAT columns, the engine must automatically separate VAT (10/110) for taxable transactions while strictly exempting non-taxable categories (Salaries, Insurance, Equity, Taxes). Silent omission of VAT for taxable items in the ledger is a violation of tax compliance integrity.

Article 21. [Legacy Logic Integrity] Before modifying or deleting existing code, a mandatory evaluation of the original rationale must be performed. Code must not be removed silently; any deletion must be accompanied by a verification that the logic no longer serves its intended strategic or technical purpose. Respecting the "Why" behind past implementation is a requirement for system stability.

Article 22. [Cross-Component Numerical Consistency] All summary metrics, dashboard cards, and their respective drill-down detail views must share the exact same calculation logic and data sources. Contradictory signals between a high-level summary and its evidence modal (e.g., 15% vs 100% AR ratio) are a violation of Strategic Integrity. Consistency is the foundation of institutional trust.

Article 23. [Dual-View Runway Reporting] The system must report Runway from two distinct perspectives to provide a complete decision matrix:
1. **Survival Runway (Defensive Floor):** Calculated under the assumption of Zero-Revenue (Gross Burn). This is the hard survival baseline for risk management.
2. **Strategic Runway (Offensive Ceiling):** Calculated using AI-forecasting (Net Burn). This is the projection for business-as-usual growth.
Contradictions between these two are expected and must be explicitly labeled to avoid executive confusion. **Strategic trend lines must also use context-aware windows (e.g., 30-day MA for monthly business) to maintain a consistent signal through idle transaction periods.**
 
Article 25. [Reject-if-Uncertain Principle] The accounting engine must prioritize "Deterministic Integrity" over "Convenience of Automation". If the nature of a transaction (Why) cannot be determined with 100% certainty from descriptors and historical patterns, the system must set a `needs_clarification` flag and halt automatic classification. Defaulting to generic categories (e.g., 'Revenue' or 'Miscellaneous') without evidence is a violation of the system's foundational trust.

Article 26. [Nature-First Hierarchical Double-Entry] All journaling must follow a strict three-layer hierarchy: 1. Structure Phase (Inflow/Outflow) determined by physical data signals; 2. Nature Phase (Accounting Intent) determined by the transaction's purpose; 3. Source Phase (Settlement Channel) determined by the payment method. Journaling without identifying the "Why" (Nature) first is strictly prohibited to prevent structural logic errors and "guessing" regressions.

Article 27. [Collaborative Integrity & Reporting Protocol] The AI Assistant must present a detailed implementation plan and obtain explicit user approval before modifying core logic, architectural structures, or Constitutional articles. Autonomous code changes without prior verification are a violation of 'Collaborative Integrity'. All technical decisions must be communicated in a human-readable format, ensuring the user remains the ultimate decision-maker in the system's evolution.

Article 28. [Baseline Heritage: Phase 1-6 Continuity] The system must maintain and respect the core principles established during the foundational development phases (Phase 1-6):
1. **(Atomic Balance)**: Every transaction must be recorded as an indivisible unit, maintaining absolute parity between Debit and Credit.
2. **(Strategic Variance)**: All financial reporting must provide a clear distinction between 'Budgeted Plan' and 'Actual Reality' (BvA) to facilitate immediate strategic intervention.
3. **(Context Preservation)**: Data ingestion must preserve 100% of the original metadata, including supplemental notes and remarks, to ensure the historical "Why" is never lost.
Article 29. [Temporal and Status Integrity] All summary metrics, dashboard cards, and analytical reports must adhere to a "Global Sync" principle regarding time and transaction status:
1. **Source of Truth (systemNow)**: Every component must utilize the `systemNow` (Dimension Time) provided by the context for all age/overdue/period calculations. Using the local browser's `new Date()` for core financial logic is a violation of Temporal Integrity.
2. **Status Inclusivity**: Risk dashboards and AR/AP management views must maintain a consistent filtering strategy. Excluding 'Unconfirmed' entries from risk metrics while displaying them in management lists is a violation of Operational Awareness. All potential obligations (Approved + Unconfirmed) must be reflected in risk totalizers.
3. **Logical Symmetry**: Account detection (AR, AP, Suspense) must use the exact same helper functions across all pages to ensure that a transaction flagged as a 'Risk' in the dashboard is the exact same transaction appearing in the settlement list.

Article 30. [AI-Human Interface & Classification Integrity]
The interface for processing unverified transactions must ensure data transparency and cognitive ease:
1. **Ambiguity Visibility**: Transactions without confirmed account codes must never be labeled as "Unspecified" (미지정) or displayed as raw uncontextualized numbers. They must be clearly marked as **"Pending Classification" (분류 대기 중)** with distinct visual warnings (Amber status) to distinguish them from verified truth.
2. **Contextual Decomposition**: When transactions are split into multiple legs (e.g., Supply Amount and VAT), each component must be explicitly labeled (e.g., **NET/VAT**) within the editor to clarify the mathematical derivation of partitioned amounts.
3. **Seamless Discovery**: AI suggestions must be synchronized with the user's focus. Focusing on an unclassified field must automatically expose related AI suggestions (Auto-Scroll/Focus) to facilitate rapid, informed decision-making.
168: 
169: Article 31. [Immutable Period Rule] Once an accounting period is formally marked as 'CLOSED', all posting, modification, or deletion of transactions within that period is strictly prohibited by the engine. This ensures the permanency of historical financial truth and guarantees that financial statements, once finalized, remain unchanged for audit and strategic continuity. Any attempt to override a locked period without a formal board-level 'Unlock' protocol is a violation of Systemic Integrity.

Article 32. [Cash Flow Distribution & Probabilistic Runway Reporting — Phase 11]
The system must report Runway not as a single deterministic value, but as a distribution with minimum three percentile brackets to reflect real-world uncertainty:
1. **p10 (Worst Case):** The runway estimate that 90% of simulations exceed. Represents the defensible floor for board-level planning.
2. **p50 (Median/Baseline):** The central tendency of the simulation distribution. This is the primary operational reference point.
3. **p90 (Best Case):** The runway estimate that only 10% of simulations exceed. Represents the upside scenario for fundraising timelines.
Simulation must be conducted via the Box-Muller transform to sample burn rates from a Normal distribution N(avgBurn, burnRateStdDev) with a minimum of 1,000 runs. Reporting a single runway figure without a distribution range when sufficient historical data exists (≥3 months) is a violation of Financial Intelligence Completeness. The Survival Score (0-100) derived from Runway + Volatility + Revenue Momentum is a composite index and must never be labeled as a statistical "probability" to prevent legal or stakeholder misrepresentation.
Article 33. [API Security & Secrets Management — Zero Hardcoding Policy]
All API keys, secrets, tokens, credentials, and sensitive configuration values are classified as **Protected Information** and are subject to the following absolute rules:

1. **Zero Hardcoding**: Under no circumstances may any API key, secret token, password, or credential be hardcoded as a string literal in source code. Violating this rule is an **unconditional breach** of system security.

2. **Server-Side Secret Mandate (No Client Exposure)**: High-security secrets, specifically AI API keys (Gemini, etc.), must **never** be prefixed with `VITE_`. They must reside exclusively in the backend environment (Rust `.env` or Serverless Secrets) to prevent build-time leakage into client-side JavaScript bundles. Frontend hooks must access AI features only through secure backend bridges (Tauri Commands or Serverless Proxies).

3. **Environment Variable Loading**:
   - Backend (Rust/Tauri): Sourced dynamically from the project root `.env` via an explicit secure loader.
   - Serverless (Vercel): Sourced from encrypted environment variables.
   The absence of a key must result in a clear error message. **Silent fallback to any default or hardcoded value is strictly forbidden.**

3. **`.gitignore` Enforcement**: The following must always be excluded from version control:
   - `.env`, `.env.local`, `.env.production`, `src-tauri/.env`
   - Any file matching `*.key`, `*.secret`, `*.pem`, `*.p12`

4. **Pre-commit Audit Obligation**: Before every `git push`, a secrets scan must be performed across all staged files. Any file containing patterns matching known API key formats must be rejected and the key immediately rotated.

5. **Key Rotation on Exposure**: If a key is ever committed to a repository (even briefly), it must be treated as **compromised and immediately rotated**. Deletion from git history alone is insufficient.

> **Rationale**: A financial intelligence system that cannot protect its own secrets cannot be trusted to protect its clients' financial data. Security is not a feature — it is the foundation.

Article 34. [UUID Supremacy - Identity over Naming]
The system must decouple an account's identity from its human-readable name. All transaction posting, ledger aggregation, and financial reporting must rely exclusively on **Unique Account IDs (UUIDs)**. Account names are treated as transient metadata. Using names as primary keys in the accounting engine is a violation of Identity Integrity and leads to irreversible data fragmentation during rebrands or account splits.

Article 35. [The Deterministic Chain of Truth]
Financial data must flow through a strictly linear and deterministic pipeline: **Journal (Atomic Entry) ➔ Ledger (Chronological Aggregation) ➔ Trial Balance (Categorical Classification) ➔ Financial Statements (Strategic Summary)**. Any calculation that bypasses this chain (e.g., calculating FS directly from Journals) is a violation of the Audit Trail Mandate. The Ledger must be rebuildable at any time from Journals, producing the exact same financial state.

Article 36. [Strategic Compass & Scenario Isolation]
The accounting engine must maintain a physical or logical **Isolation Guard** between Actual Financials and Simulation Scenarios. Actual Ledger data is the sacred 'Source of Truth'. Simulations (Strategic Compass) must operate on non-persistent snapshots or distinct ledger scopes. Any scenario logic that mutates the primary ledger state without a user-authorized 'Actualize' command is a violation of Reality Integrity.

Article 37. [Virtual Closing & Automatic Equity Roll-up]
The system adopts a **Virtual Closing** architecture for monthly and annual finalization. Instead of manual closing journal entries that clutter the ledger, the engine must automatically calculate the period's Net Income and roll it into the 'Retained Earnings' (`acc_351`) account during TB/FS generation. This ensures that Equity always balances with Assets and Liabilities in real-time without requiring destructive manual adjustments.

Article 38. [Strict Gate & Automated Integrity Rejection]
Every entry attempting to transition to an 'Approved' status must pass through a **Strict Integrity Gate**. Any entry with missing UUIDs, unbalanced debits/credits, or invalid account mapping must be rejected by the engine automatically (Hard Reject). Silently allowing "soft" errors or "orphaned" entries into the Approved Ledger is a violation of Systemic Trust and is strictly prohibited.

Article 39. [Git Prohibition for Recovery & Final Implementation Supremacy]
**Git use for system recovery is strictly forbidden (git금지).** When a "Restore" or "Rollback" command is issued, the system must not rely on Git commits, which may contain outdated or unrefined iterations. Instead, recovery must be performed based on the **final version successfully implemented and verified within the current system context**. This ensures that the most advanced UI refinements, logic corrections, and "Golden State" configurations—which may not yet be committed—are preserved. Bypassing the system's internal "latest truth" in favor of potentially regressive Git snapshots is a violation of Evolutionary Integrity.

Article 40. [UI/UX Integrity & Non-Degradation / UI/UX 훼손금지]
**Degrading the existing UI/UX during technical optimization or feature updates is strictly prohibited.** The system's premium aesthetic, established navigation paths, and functional control elements (buttons, filters, dashboards) are part of the "Product Integrity". Any modification that results in the arbitrary removal of user-facing components, loss of visual polish, or reduced interaction clarity without explicit strategic justification is a violation of this Constitution. Professional-grade software must evolve without regressing in its promise of high-fidelity user experience.
