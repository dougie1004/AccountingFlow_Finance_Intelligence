/**
 * Scenario Simulation Engine (Monte Carlo 기반)
 * 헌법 제32조 준수: p10/p50/p90 확률적 런웨이 산출
 */
import { JournalEntry } from '../types';

export interface MonteCarloResult {
    p10: number; // Worst Case (90% 이상 확률로 생존)
    p50: number; // Median
    p90: number; // Best Case
    distribution: number[];
}

export class ScenarioSimulationEngine {
    constructor(private ledger: JournalEntry[], private currentCash: number) { }

    /**
     * Box-Muller 변환을 이용한 정규분포 샘플링
     */
    private sampleNormal(mean: number, stdDev: number): number {
        const u = 1 - Math.random();
        const v = 1 - Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return mean + z * stdDev;
    }

    /**
     * 1,000회 시뮬레이션을 통한 확률적 런웨이 산출
     */
    runRunwaySimulation(iterations: number = 1000): MonteCarloResult {
        // 1. 과거 Burn Rate 통계 산출
        const expenses = this.ledger.filter(e => e.type === 'Expense' || e.type === 'Payroll');

        // 월별 소비액 그룹화
        const monthlyBurn: Record<string, number> = {};
        expenses.forEach(e => {
            const month = e.date.substring(0, 7);
            monthlyBurn[month] = (monthlyBurn[month] || 0) + e.amount;
        });

        const burnValues = Object.values(monthlyBurn);
        const avgBurn = burnValues.length > 0
            ? burnValues.reduce((a, b) => a + b, 0) / burnValues.length
            : 0;

        // 표준편차 (변동성) 산출
        const variance = burnValues.length > 1
            ? burnValues.reduce((a, b) => a + Math.pow(b - avgBurn, 2), 0) / (burnValues.length - 1)
            : Math.pow(avgBurn * 0.2, 2); // 데이터 부족시 20% 변동성 가정
        const stdDev = Math.sqrt(variance);

        const results: number[] = [];

        for (let i = 0; i < iterations; i++) {
            let simCash = this.currentCash;
            let months = 0;

            // 최대 60개월까지 시뮬레이션
            while (simCash > 0 && months < 60) {
                const monthlySample = this.sampleNormal(avgBurn, stdDev);
                // 매출이 없다고 가정하는 'Survival Runway' 기준 (헌법 제23조)
                simCash -= Math.max(0, monthlySample);
                if (simCash > 0) months++;
            }
            results.push(months);
        }

        results.sort((a, b) => a - b);

        return {
            p10: results[Math.floor(iterations * 0.1)],
            p50: results[Math.floor(iterations * 0.5)],
            p90: results[Math.floor(iterations * 0.9)],
            distribution: results
        };
    }
}
