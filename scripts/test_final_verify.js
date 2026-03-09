
import https from 'https';
import fs from 'fs';

async function testCfoAi() {
    const apiKey = process.env.VITE_GEMINI_API_KEY; // Removed leaked key
    const model = 'gemini-2.0-flash';

    const systemPrompt = `당신은 대한민국 기업의 [상임 CFO]입니다. 대한민국 원화(KRW)만 사용하며, 실시간 전사 재무 수치와 상세 재무 데이터를 기반으로 질문에 답하세요. 한국말로 전문적으로 답변하세요.`;
    const userQuestion = "2026년 5월 설립 당시 자본금 유입과 장비 구입, 급여 지출 상황을 요약해줘.";

    const postData = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userQuestion }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            const response = JSON.parse(body);
            const text = response.candidates[0].content.parts[0].text;
            fs.writeFileSync('scripts/ai_response_final.txt', text, 'utf-8');
            console.log("Response saved to scripts/ai_response_final.txt");
        });
    });
    req.write(postData);
    req.end();
}
testCfoAi();
