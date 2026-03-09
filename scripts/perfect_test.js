
import https from 'https';
import fs from 'fs';

async function perfectTest() {
    const apiKey = process.env.VITE_GEMINI_API_KEY; // Removed leaked key
    const model = 'gemini-2.0-flash';

    // Exact Financial Data as a CFO would see
    const systemPrompt = `
        당신은 대한민국 기업의 [상임 CFO]입니다.
        [📢 실시간 재무 수치]
        - 현금 잔액: ₩32,500,000
        - 누적 순이익: -₩12,000,000
        - 런웨이: 2.7개월
        
        [🔍 조회된 기간(2026-05) 데이터]
        - 매출: 0원 / 비용: 12,020,000원
        - 상세: 
          * [JE-202605-0001] 5월 2일 자본금 5천만원 유입
          * [JE-202605-0002] 5월 10일 워크스테이션 550만원 지출
          * [JE-202605-0003] 5월 15일 급여 1200만원 지출.
        
        규칙: 원화(KRW)만 사용하며 제공된 데이터 기반으로 전문적인 분석을 제공하세요.
    `;
    const userQuestion = "현재 우리 회사 자금 상태와 5월 설립 초기 지출에 대해 평가해줘.";

    const postData = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userQuestion }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            const response = JSON.parse(body);
            const text = response.candidates[0].content.parts[0].text;
            fs.writeFileSync('scripts/ai_real_test_result.txt', text, 'utf-8');
            console.log("Success: result saved to scripts/ai_real_test_result.txt");
        });
    });
    req.write(postData);
    req.end();
}
perfectTest();
