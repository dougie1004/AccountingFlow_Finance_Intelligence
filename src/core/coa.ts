import { AccountDefinition } from '../types';

/**
 * [IMMUTABLE ENGINE CORE] Chart of Accounts (COA)
 * The Single Source of Truth for Account Natures and Statements.
 * Decoupled from logic to ensure stability.
 */
export const CHART_OF_ACCOUNTS: Record<string, AccountDefinition> = {
    // Current Assets
    '현금': { id: 'acc_101', code: '101', name: '현금', nature: 'ASSET', statement: 'BS', section: '유동자산', group: '현금 및 현금성자산' },
    '보통예금': { id: 'acc_103', code: '103', name: '보통예금', nature: 'ASSET', statement: 'BS', section: '유동자산', group: '현금 및 현금성자산' },
    '외상매출금': { id: 'acc_108', code: '108', name: '외상매출금', nature: 'ASSET', statement: 'BS', section: '유동자산', group: '매출채권' },
    '미수금': { id: 'acc_120', code: '120', name: '미수금', nature: 'ASSET', statement: 'BS', section: '유동자산', group: '매출채권 및 미수금' },
    '상품': { id: 'acc_146', code: '146', name: '상품', nature: 'ASSET', statement: 'BS', section: '유동자산', group: '재고자산' },
    '부가세대급금': { id: 'acc_135', code: '135', name: '부가세대급금', nature: 'ASSET', statement: 'BS', section: '유동자산', group: '기타유동자산' },
    '선급금': { id: 'acc_131', code: '131', name: '선급금', nature: 'ASSET', statement: 'BS', section: '유동자산', group: '기타유동자산' },
    '정부보조금(바우처)': { id: 'acc_199', code: '199', name: '정부보조금(바우처)', nature: 'ASSET', statement: 'BS', section: '비유동자산', group: '투자자산' },

    // Non-Current Assets
    '비품': { id: 'acc_212', code: '212', name: '비품', nature: 'ASSET', statement: 'BS', section: '비유동자산', group: '유형자산' },
    '차량운반구': { id: 'acc_211', code: '211', name: '차량운반구', nature: 'ASSET', statement: 'BS', section: '비유동자산', group: '유형자산' },
    '감가상각누계액': { id: 'acc_213', code: '213', name: '감가상각누계액', nature: 'ASSET', statement: 'BS', section: '비유동자산', group: '유형자산감액' },
    '무형자산': { id: 'acc_230', code: '230', name: '무형자산', nature: 'ASSET', statement: 'BS', section: '비유동자산', group: '무형자산' },
    '임차보증금': { id: 'acc_231', code: '231', name: '임차보증금', nature: 'ASSET', statement: 'BS', section: '비유동자산', group: '기타비유동자산' },

    // Liabilities
    '외상매입금': { id: 'acc_251', code: '251', name: '외상매입금', nature: 'LIABILITY', statement: 'BS', section: '유동부채', group: '매입채무' },
    '미지급금': { id: 'acc_253', code: '253', name: '미지급금', nature: 'LIABILITY', statement: 'BS', section: '유동부채', group: '매입채무 및 미지급금' },
    '미지급비용': { id: 'acc_255', code: '255', name: '미지급비용', nature: 'LIABILITY', statement: 'BS', section: '유동부채', group: '기타유동부채' },
    '예수금': { id: 'acc_254', code: '254', name: '예수금', nature: 'LIABILITY', statement: 'BS', section: '유동부채', group: '기타유동부채' },
    '부가세예수금': { id: 'acc_257', code: '257', name: '부가세예수금', nature: 'LIABILITY', statement: 'BS', section: '유동부채', group: '기타유동부채' },
    '선수금': { id: 'acc_259', code: '259', name: '선수금', nature: 'LIABILITY', statement: 'BS', section: '유동부채', group: '기타유동부채' },
    '정부보조금(미집행)': { id: 'acc_299', code: '299', name: '정부보조금(미집행)', nature: 'LIABILITY', statement: 'BS', section: '유동부채', group: '기타유동부채' },
    '정부보조금(대집행)': { id: 'acc_298', code: '298', name: '정부보조금(대집행)', nature: 'LIABILITY', statement: 'BS', section: '유동부채', group: '기타유동부채' },

    // Equity
    '자본금': { id: 'acc_301', code: '301', name: '자본금', nature: 'EQUITY', statement: 'BS', section: '자본', group: '자본금' },
    '이익잉여금': { id: 'acc_351', code: '351', name: '이익잉여금', nature: 'EQUITY', statement: 'BS', section: '자본', group: '이익잉여금' },

    // Revenue
    '상품매출': { id: 'acc_401', code: '401', name: '상품매출', nature: 'REVENUE', statement: 'PL', section: '영업수익', group: '매출액' },
    '서비스매출': { id: 'acc_402', code: '402', name: '서비스매출', nature: 'REVENUE', statement: 'PL', section: '영업수익', group: '매출액' },
    '정부보조금수익': { id: 'acc_403', code: '403', name: '정부보조금수익', nature: 'REVENUE', statement: 'PL', section: '영업수익', group: '기타수익' },

    // Expense
    '상품매출원가': { id: 'acc_501', code: '501', name: '상품매출원가', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '매출원가' },
    '급여': { id: 'acc_801', code: '801', name: '급여', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '복리후생비': { id: 'acc_811', code: '811', name: '복리후생비', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '임차료': { id: 'acc_816', code: '816', name: '임차료', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '지급수수료': { id: 'acc_825', code: '825', name: '지급수수료', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '세금과공과': { id: 'acc_815', code: '815', name: '세금과공과', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '감가상각비': { id: 'acc_831', code: '831', name: '감가상각비', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '무형자산상각비': { id: 'acc_845', code: '845', name: '무형자산상각비', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '여비교통비': { id: 'acc_812', code: '812', name: '여비교통비', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '통신비': { id: 'acc_813', code: '813', name: '통신비', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '수도광열비': { id: 'acc_814', code: '814', name: '수도광열비', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '광고선전비': { id: 'acc_826', code: '826', name: '광고선전비', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '소모품비': { id: 'acc_824', code: '824', name: '소모품비', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
    '기타비용': { id: 'acc_899', code: '899', name: '기타비용', nature: 'EXPENSE', statement: 'PL', section: '영업비용', group: '판매비와관리비' },
};

export const getAccountMetadata = (name: string): AccountDefinition => {
    const account = CHART_OF_ACCOUNTS[name];
    if (account) return account;
    return {
        id: 'acc_unknown',
        code: '999',
        name,
        nature: 'ASSET',
        statement: 'BS',
        section: '미분류자산',
        group: '미분류'
    };
};
