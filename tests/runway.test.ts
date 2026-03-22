
import { describe, it, expect } from 'vitest';
import { MetricRegistry } from '../src/core/reporting/metricRegistry';
import { SignalEngine } from '../src/core_engine/SignalEngine';

describe('Runway Formula Logic (Cash - Obligations) / Burn', () => {
  it('should calculate 8.5 months for 100M cash, 15M obligations, 10M burn', () => {
    const mockTB = {
      'acc_101': { closingDebit: 100000000, closingCredit: 0, meta: { id: 'acc_101' } },
      'acc_251': { closingDebit: 0, closingCredit: 10000000, meta: { id: 'acc_251' } },
      'acc_255': { closingDebit: 0, closingCredit: 5000000, meta: { id: 'acc_255' } }
    };

    const mockLedger = [
      { type: 'Expense', amount: 10000000, date: '2026-03-01', status: 'Approved' }
    ];

    const liq = MetricRegistry.calculateLiquidity(mockTB as any);
    expect(liq.value).toBe(85000000); // 100M - 15M

    const runway = MetricRegistry.calculateRunway(liq.value, mockLedger as any, '2026-03-20');
    expect(runway.value).toBe(8.5); // 85M / 10M
  });

  it('should subtract obligations in SignalEngine', () => {
    // 100M cash passed to engine
    // mockLedger has 10M burn + 15M obligations (251+255)
    const mockLedger = [
      { type: 'Expense', amount: 10000000, date: '2026-03-20', status: 'Approved' },
      { debitAccountId: 'acc_251', amount: 10000000, date: '2026-03-20', status: 'Approved' },
      { debitAccountId: 'acc_255', amount: 5000000, date: '2026-03-20', status: 'Approved' }
    ];

    const engine = new SignalEngine(mockLedger as any, 100000000);
    const report = engine.generateReport();
    
    // Result: (100M - 15M) / 10M = 8.5
    expect(report.signals[0].value).toBe('8.5개월');
  });
});
