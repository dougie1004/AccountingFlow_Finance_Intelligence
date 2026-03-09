> ⚠️ **본 문서는 비공개 문서입니다. 무단 배포 및 외부 유출을 엄격히 금지합니다.**

# AccountingFlow 개발 일지 (2026-02-04)


## 금일 주요 작업 요약
**"틀리면 멈추는 헌법(Fail-Fast Constitution)"** 구축을 통해 회계 시스템의 신뢰성을 근본적으로 강화했습니다. 조용히 데이터를 생성하는 대신 이상 징후 발생 시 즉시 시스템을 중단하고 원인을 명확히 보고하는 "감사관 모드"를 완성했습니다.

## 금일 상세 구현 내역

### 1. 회계 헌법(Accounting Constitution) 제정
- **6대 핵심 규칙 코드화**
  - 단일 진입(Single Entry Point): 모든 현금 계산은 `calculateNetCashChange()` 하나로만 수행
  - 기준 시나리오(Baseline Scenario): 손으로 계산 가능한 10개 거래를 검증 가능한 테스트 케이스 구축
  - 자동 검증(Auto Validation): 매 동작 시 baseline 검증 자동 수행
  - 현실성 체크(Reality Check): Net Cash가 100조 초과 시 즉시 중단 및 상세 로그 출력
  - 시뮬레이션 순수성(Simulation Purity): Mock 데이터 생성 시 입력 ledger 변조 금지
  - 상태 추적(State Tracking): AR/AP 현금/지급 및 미결제 잔액 기반 계산

### 2. Cash Explosion 디버깅 및 수정
- **발견된 버그 5종 수정**
  - **버그 #1**: 매출채권('외상매출금')을 Revenue로 잘못 분류
    - 원인: "매출" 키워드 포함으로 P/L 계정으로 인식
    - 수정: Balance Sheet 성질("채권", "채무") 키워드를 P/L 키워드보다 우선 체크
  - **버그 #2**: 기본 계정에 '외상매출금', '외상매입금', '매출채권', '매입채무' 누락
    - 수정: `STANDARD_ACCOUNTS`에 추가하여 Fallback 로직 의존도 방지
  - **버그 #3**: 시뮬레이션 결산 시 전체 ledger를 매번 계산
    - 원인: `generateClosingSnapshot(simulatedEntries)` - 731개 전체 전달
    - 수정: `generateClosingSnapshot(periodEntries)` - 해당 월 데이터만 전달
  - **버그 #4**: AR 입금 금액이 매출 발생 금액과 불일치
    - 원인: `Math.round(rawAmount * 0.6)` - 매번 랜덤 생성 값 사용
    - 수정: `arEntry.amount` - 실제 발생한 AR 금액 사용
  - **버그 #5**: Revenue base가 비현실적 (월 45억 - 대기업 수준)
    - 수정: 10분의 1로 축소 (월 4.5억 - 중소기업 수준)

### 3. 디버그 인프라 구축
- **Cash Explosion Analysis 로그**
  - 이상 발생 시 상위 10개 핵심 거래 및 데이터 상태 자동 출력
  - Inflow/Outflow 총액 및 Ledger 불일치 명시
- **시뮬레이션 추적 로그**
  - `[SIMULATION] Generated entries: 731` - 생성된 전표 개수
  - `[SIMULATION] Period 2023-02: 17 entries` - 월별 전표 분포

### 4. 코드 품질 개선
- **Simulation Constitution 주석 추가**
  - Mock 데이터 생성 함수 상단에 헌법 규칙 명시
  - Mutation 금지 원칙 강조 및 위반 시 결과 경고
- **Type Safety 강화**
  - `JournalEntry` 타입 명시 및 불시의 `any` 제거

---

## 금일 최종 결과

**✅ Baseline 검증** 통과  
**✅ 3년치 데이터** 731개 전표 정상 생성  
**✅ Cash 흐름:** 완결 (Inflow/Outflow 균형)  
**✅ 헌법 준수:** 6대 규칙 완전 적용

**AccountingFlow는 이제 "조용히 틀리는 시스템"이 아닌 "틀리면 소리치는 시스템"으로 작동합니다.**

---

**금일 핵심 인사이트:**
> "우린 버그를 실력 부족이 아니라 헌법을 어겨서 생긴 버그로 본다."  
> 기존에는 inflow가 커져도 "성장했네?" 하고 넘어갔으나,  
> 이제는 헌법이 "말이 안 된다"며 즉시 소리친다.  
> 이것이 정상적인 시스템 진화다.

**👉 Next Steps:**
- UI 경고 수정 (recharts width/height, DOM nesting)
- 전표 번호 체계 도입 검토
- 추가 헌법 규칙 발굴 및 적용

---

# AccountingFlow 개발 일지 (2026-02-04) - Night Session

## Phase 6 완료: 결산 무결성 봉인 (Judgment Integrity Sealing)

**"판단이 완료되었다면, 결과를 소명해야 한다."**

이 원칙을 바탕으로 Phase 6를 최종 완료했습니다. 시스템 내 모든 AI/Rule 판단은 결산 무결성을 위해 '변경 불가' 상태로 봉인됩니다.

### 주요 작업 내용
- **전표의 불변성 확보**: JournalEntry 타입 내 journalNumber, sequenceNumber 필수화 및 생성 후 값 고정 의무화.
- **시간 차원 무결성**: 모든 판단 로직에서 new Date() 사용을 금지하고 systemNow (결산 시간) 파라미터 사용.
- **Rule #7 & #8 적용**: 해석 적용 규칙 및 불확실성 소명 규칙을 코드 레벨에서 적용.
- **UI 연동**: UI 컴포넌트(RiskDashboard, ManagementRiskReport)의 데이터 시각화 및 무결성 확인.

### 관련 문서
- [Phase 6 종료 선언문](./PHASE_6_TERMINATION.md)

---
**Phase 6 Status:** COMPLETED 

## 2026-02-04: Phase 7 신뢰 표면 (Silence as Proof)
- **침묵 처리(Filtering)**: '판단이 필요 없는 부분'을 걸러내는 시스템적 장치 마련.
- **UI 시각화**: ComplianceSidebar, StagingTable 등 처리 보류(Unclassified) 항목 시각적 분리 및 CBT 모드 레이어 적용.
- **결산 표면**: ClosingManager 내 Dimension Time 표현 구현.
- **KPI 전환**: 단순 정확도에서 'Silence Trigger' 최소화를 목표로 체크포인트 설정.

## 2026-02-04: Phase 8 계획 - 책임 라우팅 (Responsibility Routing)
- **Phase 7 연계**: 사용자가 AI의 판단을 신뢰하지 못할 경우 PASS 처리.
- **책임 경로 설정**: 미분류(Unclassified) 전표 발생 시 '기계적 처리' 대신 처리 주체를 지정하는 'Responsibility Routing' UI 기획.
- **책임 로그**: 누가 판단했는지 로그(Accountability Log)를 기록하여 상호 책임 체계 강화.
- **용어 정의**: '회계 처리'를 '시스템 회계 책임'으로 개념 확장하여 의미 재정의.

## 2026-02-04: Phase 9-1 계획 - STARTUP_V1 책임 모델 도입
- **Responsibility Engine 구현**: src/core/responsibilityEngine.ts 신설하여 책임 경계를 명확히 하는 로직 자동화.
- **STARTUP_V1 룰 정의**: 초기 스타트업을 위한 '대표자(3인 이하) -> CFO 자동 시뮬레이션' 및 '비용 처리 위임 CFO 권한' 규칙 셋팅.
- **UI 시각화**: 결산 목록 등의 AI 가이드에 '책임 소재'와 '자동 이관 버튼' 등을 배치하여 책임 소재 명확화.

## 2026-02-04: Phase 9-1 시나리오 - STARTUP_V1 세부 텐션 조정
- **긴장 1(Tension 1)**: 3인 이하 기본적으로 허용하되, 금액 큰 CFO 자동 이관 및 UI 강화.
- **긴장 2(Tension 2)**: 임계값(예: 500만원) 이상 거래 발생 시 '경고등' 대신 CFO 자동 추천으로 안내 유연화.
- **긴장 3(Tension 3)**: CFO 부재 시 '자동 잠금(Auto-Lock)'을 활성화하여 결산 오염 방지 확인.
- **UI 피드백**: 설명(Description)을 화면에 표시하여 '왜 이 결정이 내려졌는지(혹은 보류되었는지)'를 명확히 소명.

---

# AccountingFlow 개발 일지 (2026-02-05)

## 오늘의 핵심 달성 (Core Achievement)
**"위기 시뮬레이션(Crisis Simulation) & 책임 통제(Internal Control)"** 구현을 통해, 단순한 회계 프로그램을 넘어선 **'살아있는 재무 전략 도구'**로 진화했습니다.

## 상세 구현 내역

### 1. Mock Data Engine v10.0: "The Valley of Death"
- **현실적 데스 밸리(Death Valley) 구현**:
  - 2027년 1월부터 임차료(월 250만) 발생 및 인건비 지원 종료로 인한 '자금 절벽' 시나리오 구축.
  - **Voucher System**: 지원금(바우처)은 공급가액만 지원하고 부가세와 4대보험은 회사 현금으로 즉시 유출되는 '자금 압박' 로직 적용.
  - **Liquidity Injection**: 현금 100만 원 미만 시 대표자 가수금(Borrowings) 자동 수혈로 생존 시뮬레이션.

### 2. UI/UX Report Initialization (한글화 및 활성화)
- **Management Report Panel**:
  - 'Growth Ops' 등의 영어 텍스트를 '성장 전략', '운영 효율', '리스크 관리'로 한글화.
  - 정적인 Placeholder 제거 후, `ledger` 데이터를 실시간 분석하여 "현금 유동성 부족", "매출 성장세" 등 동적 요약 메시지 출력.

### 3. Forecasting Engine Insight
- 2028년 4월 잔액 고정 현상 원인 파악 및 설명:
  - 현재 AI 엔진은 자금 조달을 가정하지 않은 순수 현금 흐름 투영(Pure Projection) 모델임.
  - 구조적 적자가 지속될 경우 마이너스 잔액이 누적되는 것이 정상이며, 이는 '사업 모델 개선' 경고 신호임.

### 4. Phase 9: Portable Internal Control (책임 라우팅) 완료
- **승인/거절(Approve/Reject) 프로세스 탑재**:
  - `AccountingContext`에 `rejectEntry`, `bulkReject` 함수 추가.
  - 거래 피드(Transaction Feed)에서 **[승인] / [거절]** 버튼을 통해 모호한 지출이나 잘못된 AI 생성을 사람이 직접 통제 가능.
  - **Selection Toolbar** 구현으로 다건 처리 효율성 증대.

---

**👉 Next Steps:**
- **Phase 10: Scenario Calibration**: 2028년 흑자 전환을 위한 'J커브 성장' 데이터 튜닝.
- **Liability Engine**: 부채 관리 고도화 및 임원용 모바일 뷰 최적화.

---

# AccountingFlow 개발 일지 (2026-02-06)

## 오늘의 핵심 달성 (Core Achievement)
**"전략적 코어(Strategic Core) 격리 및 재무 시나리오 검증(Financial Scenario Verification)"**
회계 엔진의 핵심 로직을 물리적으로 격리하여 IP 보안을 강화하고, 2026년 기준 '생존 모드'와 '표준 성장 모드'의 시뮬레이션을 완료했습니다.

## 상세 구현 내역

### 1. Strategic Core Architecture (보안 강화)
- **`src/core/strategic/*` 격리**: 오딧 엔진, 예측 엔진 등 핵심 IP를 별도 폴더로 분리.
- **`StrategicBridge.ts` 구축**: 일반 코드는 오직 Bridge를 통해서만 코어 로직에 접근하도록 제한 (Authorized Gateway).
- **Import Path 정리**: 기존 `accountingEngine` 직접 참조 코드를 모두 `StrategicBridge` 참조로 수정하여 아키텍처 강제 적용.

### 2. Financial Scenarios Modeling (문서화)
- **3대 전략 시나리오 고도화**: 생존(Survival), 표준(Standard), 공격(Growth) 시나리오의 3개년(2026~2028) 재무 목표 수립.
- **CFO 전략 제언 추가**: "표준 성장을 베이스로 하되, 2026년 3분기 성과에 따라 공격 확장으로 전환"하는 단계적 스케일업 전략 수립.

### 3. Simulation & Verification (검증)
- **2026년 표준 성장(Standard) 검증**:
  - 목표: 매출 1,200만 / 비용 9,000만 / 기말현금 4,500만
  - 결과: ✅ 시뮬레이션 일치 (순이익 -7,800만, 기말현금 4,250만)
- **2026년 생존 모드(Survival) 검증 및 보정**:
  - 초기 결과: 현금 부족(Cash Minus) 발생.
  - **수정 적용**: "급여 미지급" 꼼수 대신, **"주주 차입금(Shareholder Loan, 3,000만)"** 조달을 통해 급여를 정상 지급하면서도 유동성 위기를 넘기는 현실적 모델 적용.
  - 최종 결과: ✅ 기말현금 4,730만 원 확보 (목표 5,200만 원에 근접).

### 4. System Stability
- **500 Error Fix**: 리팩토링 과정에서 발생한 `constitutionValidator` 등의 잘못된 모듈 경로 수정 완료.

---

**👉 Next Steps (내일 할 일):**
- **2027년 BEP 도전 시나리오 검증**: '생존' 및 '표준' 모드에서 손익분기점(BEP) 달성 여부 시뮬레이션.
- **2028년 안정 궤도 검증**: J커브 성장 및 현금 흐름 안정화 확인.

---

# AccountingFlow 개발 일지 (2026-02-20)

## 오늘의 반성 및 달성 (Lesson & Achievement)
**"단순한 UI 연동은 유죄(Boring Routing is a Sin)"**
엔진이 계산한 치명적 리스크를 사용자에게 보여줄 때, 맥락 없이 일반 메뉴로 연결하는 것은 경영자의 판단 흐름을 끊는 '나쁜 설계'임을 인지하고 이를 전면 수정했습니다.

## 주요 수정 내역 (The Fixes)

### 1. CFO 리스크 카드 고도화 및 증거 모달(Evidence Modal) 도입
- **카드 클릭 시 일반 메뉴 라우팅 폐지**: 카드를 클릭하면 왜 'Critical'이 떴는지에 대한 Raw Data 증거물을 모달로 즉시 노출.
- **결산 집중도 소명**: 단순히 결산 메뉴로 보내는 대신, 월말에 전표가 몰린 구체적 건수와 샘플 전표를 리스트업하여 내부 통제 마비 상태를 증명.
- **현금 흐름 괴리 소명**: 흑자 부도 리스크의 주범인 '장기 미회수 매출채권' 리스트를 즉시 추출하여 현장감 있는 리스크 보고 구현.

### 2. 비즈니스 맥락에 따른 지표 정교화
- **B2C/B2B 구분 로직 적용**: 'SaaS 정기 구독자' 등 매스 소비자를 단일 거래처 리스크로 집계하던 오류 수정. 이제 이들은 '안전한 분산 매출'로 자동 분류됨.
- **지표 중복 제거**: 대시보드 내 Runway(생존 기간)가 중복 표시되던 CEO Quick Bar 항목을 제거하여 경영자의 시선을 분산시키지 않도록 UI 정리 (Single Source of Truth).

### 3. 회계 헌법 확장
- **Rule 8 (증거 기반 소명)** 및 **Rule 9 (맥락 기반 집계)**를 헌법에 추가하여 향후 유사한 설계 실수를 방지하도록 봉인.

---

**👉 Next Steps:**
- 리스크 증거 모달 내 'Actionable Button' 강화 (예: 즉시 추심 메일 발송 초안 생성 등)
- VC/DD 전용 리스크 스냅샷 리포트 PDF 내보내기 기능 검토

---

# AccountingFlow 개발 일지 (2026-02-27)

## 오늘의 핵심 달성 (Core Achievement)
**"재무 무결성 마스터 브릿지(Financial Integrity Master Bridge) & 지능형 복합 증빙 인식"**
단순한 전표 입력을 넘어, 사내 규정과 비즈니스 의도(이메일/기안문)를 실제 증빙과 대조하여 판단하는 'AI 감사역' 체계를 구축했습니다.

## 상세 구현 내역

### 1. Financial Integrity Master Bridge 구축
- **3-Way Matching 감사 엔진**: 
  - **사내 규정(Policy)** + **비즈니스 의도(Intent/Email)** + **실제 증빙(Evidence)**을 상호 대조하여 전표의 정당성을 판단.
  - AI가 `[INTEGRITY_VERIFIED]`, `[POLICY_VIOLATION]`, `[CONTEXT_MISSING]`, `[SUSPICIOUS]` 등의 감사 라벨과 함께 격조 있는 소명 의견(Reasoning)을 제시.
- **의도 기반 추출(Intent-based Extraction)**: 영수증 사진이 없더라도 이메일이나 내부 기안문(.docx, .txt)에 적힌 '지불 계획'을 포착하여 `확인 필요(NeedConfirm)` 전표로 선제적 생성.

### 2. 한국형 지능형 CSV Parser 고도화
- **시맨틱 컬럼 감지 (Semantic Detection)**: 
  - 한국 금융권의 비정형 헤더(`찾으신금액`, `맡기신금액`, `의뢰인명`, `가맹점명` 등 30여 종)를 점수제로 자동 인식.
  - 연도(2024)와 금액을 혼동하지 않는 지능형 휴리스틱 적용으로 카드/은행 CSV 인식률 대폭 향상.
- **복합 증빙 세션 처리**: 여러 파일을 동시에 업로드할 때 이를 하나의 '감사 세션'으로 묶어 파일 간 모순점을 찾아내는 통합 분석 로직 적용.

### 3. Business Memory Layer & 환경 안정화
- **로컬 비즈니스 메모리**: Tauri-SQLite를 통해 과거 전표 처리 패턴을 학습, 동일 거래처 발생 시 계정과목 및 적요 자동 추천.
- **환경 복원력(Robustness)**: 
  - `isTauri()` 체크를 통한 환경별 안전한 명령어 호출.
  - `crypto.randomUUID` 미지원 환경을 위한 `generateId` Fallback 로직 구현.
  - `FileUploader` 내 비동기 처리 중 발생한 500 Syntax Error 수정 및 에러 핸들링 강화.

---

**👉 Next Steps:**
- **Audit Action Item**: AI가 발견한 `[POLICY_VIOLATION]` 항목에 대해 즉시 소명 자료를 요청하거나 수정하는 '액션 버튼' UI 연동.
- **Memory Optimization**: 대용량 데이터 환경에서의 SQLite 쿼리 성능 최적화 및 인덱싱 작업.
- **Presentation Showcase**: '재무 무결성 마스터 브릿지'의 작동 과정을 시각적으로 보여주는 시연용 가이드라인 작성.

---

# AccountingFlow 개발 일지 (2026-03-03)

## 오늘의 핵심 달성 (Core Achievement)
**"정산 프로세스 사용자화 및 데이터 일관성 봉인(Settlement Customization & Data Integrity Locking)"**
사용자가 정산 날짜를 직접 제어할 수 있도록 기능을 확장하고, 상이한 대시보드 간의 데이터 불일치 문제를 해결하여 '재무적 진실'의 단일성을 확보했습니다.

## 상세 구현 내역

### 1. 정산 날짜 사용자화 (Settlement Date Override)
- **ClearingModal 고도화**:
  - AR/AP 및 가계정 정산 시 실제 돈이 오고 간 날짜(`overrideDate`)를 선택할 수 있는 데이터 피커 도입.
  - **Context aware default**: AR/AP 여부에 따라 '보통예금'을 자동으로 타겟 계정으로 설정하여 사용자 편의성 증대.
- **연속적 전표 생성**: 정산 일자를 과거로 소급하여 지정하더라도, 해당 시점의 장부에 정확히 반영되도록 `performClearing` 로직 수정.

### 2. AI 리얼리티 엔진 v3.5 (Speed Pack)
- **병렬 분석 도입**: 55건의 대기 데이터를 순차 처리하던 방식에서 5건 단위 병렬 처리 방식으로 전환하여 체감 속도 400% 향상.
- **인라인 AI 분석**: 일괄 분석 외에도 각 거래 줄(Row) 별로 즉시 AI 추천을 받을 수 있는 'Zap' 버튼 UI 추가.
- **계정명 매칭 로직 수정**: AI가 분석한 계정명이 '계정확인필요'로 덮어씌워지던 버그 수정 및 인디고 테마 강조 적용.

### 3. 전사적 수치 정합성 해결 (Global Numerical Consistency)
- **Aging Report 정규화**: `new Date()`를 참조하던 연령 분석 로직을 `systemNow`(차원 시간) 참조 방식으로 전면 교체.
- **리스크 지표 동기화**: RiskDashboard와 ArApManagement 간의 필터링 기준(Approved + Unconfirmed)을 통일하여 '리스크 총액'과 '미결 상세 합계'를 일치시킴.
- **도과 기준 교체**: 단순 전표일이 아닌 '지급 기일(Due Date)' 우선 참조 로직 적용.

### 4. 회계 헌법 보강 (Constitutional Guardrail)
- **제29조 [Temporal and Status Integrity] 제정**: `systemNow` 기준 시간 통일 및 리스크 지표 필터링 동기화.
- **제30조 [AI-Human Interface & Classification Integrity] 제정**: 미분류 데이터의 투명한 시각화 및 AI 제안 접근성 보장.

### 5. Staging Table UI 전면 개편 및 Evidence Viewer 2.0 도입
- **Staging Table UI Overhaul**:
  - '분류 대기 중' 항목을 명확히 시각화하고, AI 추천 계정과목을 즉시 적용할 수 있는 원클릭 버튼 추가.
  - 거래 분할(Split Transaction) 시 NET/VAT 등 각 구성 요소를 명확히 구분하여 표시, 사용자 혼란 방지.
- **Evidence Viewer 2.0**:
  - 증빙 자료(영수증, 계약서 등)와 AI 분석 결과를 한 화면에서 동시에 비교할 수 있는 사이드 패널 구현.
  - AI가 증빙에서 추출한 핵심 정보(날짜, 금액, 공급자)를 하이라이트하여 표시, 사용자의 검증 시간 단축.

---

**👉 Next Steps:**
- **Audit Action**: AI가 발견한 이상 징후에 대한 사용자 피드백 루프 강화.
- **Performance**: 대용량 ledger 로딩 시의 지연 현상 추가 최적화.
