
import https from 'https';
import crypto from 'crypto';

// 1. Mock Data Generator (Simplified)
function generateMockLedger() {
    const entries = [];
    entries.push({
        id: crypto.randomUUID(),
        date: '2026-05-02',
        description: '자본금 납입',
        debitAccount: '보통예금',
        creditAccount: '자본금',
        amount: 50000000,
        type: 'Equity',
        status: 'Approved'
    });
    entries.push({
        id: crypto.randomUUID(),
        date: '2026-05-10',
        description: '워크스테이션 구입',
        debitAccount: '비품',
        creditAccount: '보통예금',
        amount: 5000000,
        vat: 500000,
        type: 'Asset',
        status: 'Approved'
    });
    entries.push({
        id: crypto.randomUUID(),
        date: '2026-05-15',
        description: '5월 급여',
        debitAccount: '급여',
        creditAccount: '보통예금',
        amount: 12000000,
        type: 'Expense',
        status: 'Approved'
    });
    return entries;
}

async function testCfoAi() {
    const ledger = generateMockLedger();
    const apiKey = process.env.VITE_GEMINI_API_KEY; // Removed leaked key
    const model = 'gemini-2.0-flash';

    const financials = {
        cash: 32500000,
        displayCash: '₩32,500,000',
        displayNetIncome: '-₩12,000,000'
    };

    const avgMonthlyBurn = 12000000;
    const runway = financials.cash / avgMonthlyBurn;

    const periodContext = `
[2026-05 기간 재무 데이터 분석]
- 조회 범위: 2026-05 (해당 월)
- 현금 흐름: 유입 50,000,000원 / 유출 17,500,000원
- 경영 실적(장부): 매출 0원 / 비용 12,000,000원 / 순이익 -12,000,000원

[상세 거래 샘플]
- [2026-05-02] 자본금 납입: 50,000,000원 (보통예금/자본금)
- [2026-05-10] 워크스테이션 구입: 5,000,000원 (비품/보통예금)
- [2026-05-15] 5월 급여: 12,000,000원 (급여/보통예금)
    `;

    const systemPrompt = `
        당신은 대한민국 기업의 [상임 CFO]입니다. 모든 회계 기준은 K-IFRS와 대한민국 세법을 따릅니다.
        
        [🚫 절대 금지 사항]
        1. 당신은 오직 '대한민국 원화(KRW, ₩, 원)'만 사용합니다. 달러($) 등 외화 언급 시 즉시 해고됩니다.
        2. 질문에 답할 때 [X,XXX] 같은 플레이스홀더를 절대 사용하지 마십시오.

        [📢 실시간 전사 재무 수치]
        - 현재 총 현금 잔액: ${financials.displayCash}
        - 누적 당기순이익: ${financials.displayNetIncome}
        - 월 평균 고정 지출(Burn Rate): 약 ${avgMonthlyBurn.toLocaleString()}원
        - 예상 현금 소진 기간(Runway): 약 ${runway.toFixed(1)}개월
        
        [ 상세 재무 데이터 (조회된 기간: 2026-05) ]
        ${periodContext}

        모든 숫자는 제공된 데이터만 읽으십시오. 짐작은 금물입니다. 한국말로 답변하세요. 답변은 마크다운 형식을 사용하세요.
    `;

    const userQuestion = "현재 우리 회사 자금 상태가 어때? 2026년 5월 상황을 분석해서 보고해줘.";

    const postData = JSON.stringify({
        contents: [
            { role: 'user', parts: [{ text: userQuestion }] }
        ],
        system_instruction: {
            parts: [{ text: systemPrompt }]
        }
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    console.log("--- AI CFO 분석 요청 중... ---");

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            try {
                const response = JSON.parse(body);
                if (response.candidates && response.candidates[0].content.parts[0].text) {
                    console.log("\n--- [AI CFO 리포트] ---");
                    console.log(response.candidates[0].content.parts[0].text);
                    console.log("\n--- 테스트 완료 ---");
                } else {
                    console.log("AI 응답 형식이 올바르지 않습니다:", body);
                }
            } catch (e) {
                console.error("응답 파싱 오류:", e.message, body);
            }
        });
    });

    req.on('error', (e) => console.error("요청 오류:", e.message));
    req.write(postData);
    req.end();
}

testCfoAi();
