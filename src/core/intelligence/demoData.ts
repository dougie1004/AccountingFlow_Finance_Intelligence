import { JournalEntry } from '../../types';

/**
 * [V15] Story-telling Demo Data
 * Designed to trigger Subscription and Spending Spike insights immediately.
 */
export const DEMO_DATA_V1: JournalEntry[] = [
    // 0. Starting Capital (To fix Negative Cash Discrepancy)
    {
        id: 'demo_capital',
        date: '2026-01-01',
        description: '초기 자본금 납입 (설립)',
        vendor: '창업자',
        amount: 50000000,
        vat: 0,
        type: 'Funding',
        status: 'Approved',
        debitAccount: '보통예금',
        creditAccount: '자본금',
        scope: 'actual'
    },
    // 1. Subscription Patterns (OpenAI)
    {
        id: 'demo_sub_1',
        date: '2026-02-15',
        description: 'OpenAI Monthly Subscription',
        vendor: 'OpenAI',
        amount: 28000,
        vat: 0,
        type: 'Expense',
        status: 'Approved',
        debitAccount: '지급수수료',
        creditAccount: '미지급금(현대카드)',
        scope: 'actual'
    },
    {
        id: 'demo_sub_2',
        date: '2026-03-15',
        description: 'OpenAI Monthly Subscription',
        vendor: 'OpenAI',
        amount: 28000,
        vat: 0,
        type: 'Expense',
        status: 'Approved',
        debitAccount: '지급수수료',
        creditAccount: '미지급금(현대카드)',
        scope: 'actual'
    },
    {
        id: 'demo_sub_3',
        date: '2026-04-15',
        description: 'OpenAI Monthly Subscription',
        vendor: 'OpenAI',
        amount: 28000,
        vat: 0,
        type: 'Expense',
        status: 'Approved',
        debitAccount: '지급수수료',
        creditAccount: '미지급금(현대카드)',
        scope: 'actual'
    },
    
    // 2. Spending Spike (Marketing - Facebook Ads)
    {
        id: 'demo_spike_1',
        date: '2026-03-20',
        description: 'Facebook Ads - Q1 Campaign',
        vendor: 'Meta/Facebook',
        amount: 1000000,
        vat: 0,
        type: 'Expense',
        status: 'Approved',
        debitAccount: '광고선전비',
        creditAccount: '미지급금(삼성카드)',
        scope: 'actual'
    },
    {
        id: 'demo_spike_2',
        date: '2026-04-20',
        description: 'Facebook Ads - Scaling Campaign',
        vendor: 'Meta/Facebook',
        amount: 2500000, // 150% Increase!
        vat: 0,
        type: 'Expense',
        status: 'Approved',
        debitAccount: '광고선전비',
        creditAccount: '미지급금(삼성카드)',
        scope: 'actual'
    },

    // 3. Regular Operating Expenses
    {
        id: 'demo_op_1',
        date: '2026-04-05',
        description: '사무실 임차료 (4월분)',
        vendor: '랜드마크타워',
        amount: 3000000,
        vat: 300000,
        type: 'Expense',
        status: 'Approved',
        debitAccount: '임차료',
        creditAccount: '보통예금',
        scope: 'actual'
    },
    {
        id: 'demo_op_2',
        date: '2026-04-10',
        description: '팀 런치 - 파이브가이즈',
        vendor: '파이브가이즈 강남',
        amount: 154000,
        vat: 15400,
        type: 'Expense',
        status: 'Approved',
        debitAccount: '복리후생비',
        creditAccount: '미지급금(신한카드)',
        scope: 'actual'
    }
];
