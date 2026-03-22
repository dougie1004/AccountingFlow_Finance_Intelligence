import { UserModel } from '../engine/userEngine';
import { DEFAULT_FRICTION } from './frictionConfigs';

export interface PricingPlan {
  name: string;
  price: number;
}

export interface PricingMixPoint {
  date: string;        // YYYY-MM-DD
  mix: number[];       // 합 = 1
}

export interface PricingConfig {
  plans: PricingPlan[];
  mixTimeline: PricingMixPoint[];
}

export interface RevenuePolicy {
  startDate: string;
}

export interface MarketingPoint {
  date: string;
  amount: number;
}

export interface MarketingPolicy {
  timeline: MarketingPoint[];
}

export interface FixedCosts {
  payroll: number;
  rent: number;
  marketing?: number; 
}

export interface ScenarioConfig {
    title: string;
    desc: string;
    initialCapital: number;
    hasGrant: boolean;
    annualWageGrowth: number;
    targetUsers2028: number;
    bridgeCapital: number;
    bridgeDate: string;
    growthGoal: string;
    burnTolerance: string;

    fixedCosts: FixedCosts;
    unitEconomics: {
        variableCostPerUser: number;
    };
    userModel: UserModel;
    marketingPolicy: MarketingPolicy;
    pricing: PricingConfig;
    revenuePolicy: RevenuePolicy;
    growthStrategy: {
       reinvestRatio: number;
    };
    fundingPolicy: {
        enabled: boolean;
        injectionAmount: number;
        trigger: {
            type: 'runway' | 'cash';
            thresholdMonths?: number;
            thresholdCash?: number;
        };
    };
}

export const SCENARIO_CONFIGS: Record<string, ScenarioConfig> = {
    'SURVIVAL': {
        title: '생존 우선 (Survival)',
        desc: '보수적 지출 및 마진 최적화 중심',
        initialCapital: 40000000,
        hasGrant: false,
        annualWageGrowth: 0.02,
        targetUsers2028: 250,
        bridgeCapital: 0,
        bridgeDate: '',
        growthGoal: '0.6x',
        burnTolerance: '8M',
        fixedCosts: {
            payroll: 5500000,
            rent: 3000000
        },
        unitEconomics: {
            variableCostPerUser: 3000
        },
        userModel: {
            initialUsers: 0,
            baseCAC: 80000,
            baseChurn: 0.05,
            friction: DEFAULT_FRICTION
        },
        marketingPolicy: {
            timeline: [
                { date: "2026-05-01", amount: 300000 },
                { date: "2028-01-01", amount: 1500000 }
            ]
        },
        pricing: {
            plans: [
                { name: "Basic", price: 19900 },
                { name: "Standard", price: 39900 },
                { name: "Pro", price: 79000 }
            ],
            mixTimeline: [
                { date: "2026-10-01", mix: [0.6, 0.4, 0.0] },
                { date: "2027-06-01", mix: [0.7, 0.3, 0.0] },
                { date: "2028-01-01", mix: [0.8, 0.2, 0.0] }
            ]
        },
        revenuePolicy: {
            startDate: "2026-10-01"
        },
        growthStrategy: {
            reinvestRatio: 0
        },
        fundingPolicy: {
            enabled: true,
            injectionAmount: 100000000,
            trigger: { type: 'runway', thresholdMonths: 1 }
        }
    },
    'STANDARD': {
        title: '사업계획서 (Business Plan)',
        desc: '사업계획서 상의 현실적 마일스톤',
        initialCapital: 40000000,
        hasGrant: true,
        annualWageGrowth: 0.05,
        targetUsers2028: 800,
        bridgeCapital: 0,
        bridgeDate: '',
        growthGoal: '1.0x',
        burnTolerance: '15M',
        fixedCosts: {
            payroll: 7800000,
            rent: 1560000
        },
        unitEconomics: {
            variableCostPerUser: 2060
        },
        userModel: {
            initialUsers: 0,
            baseCAC: 50000,
            baseChurn: 0.03,
            friction: DEFAULT_FRICTION
        },
        marketingPolicy: {
            timeline: [
                { date: "2026-05-01", amount: 500000 },
                { date: "2026-10-01", amount: 4160000 },
                { date: "2028-01-01", amount: 8000000 }
            ]
        },
        pricing: {
            plans: [
                { name: "Basic", price: 19900 },
                { name: "Standard", price: 39900 },
                { name: "Pro", price: 79000 }
            ],
            mixTimeline: [
                { date: "2026-10-01", mix: [0.0, 1.0, 0.0] },
                { date: "2027-06-01", mix: [0.2, 0.7, 0.1] },
                { date: "2028-01-01", mix: [0.3, 0.5, 0.2] }
            ]
        },
        revenuePolicy: {
            startDate: "2026-10-01"
        },
        growthStrategy: {
            reinvestRatio: 0
        },
        fundingPolicy: {
            enabled: true,
            injectionAmount: 100000000,
            trigger: { type: 'runway', thresholdMonths: 1 }
        }
    },
    'GROWTH': {
        title: '공격 전개 (Growth)',
        desc: '점유율 확보를 위한 공격적 마케팅',
        initialCapital: 40000000,
        hasGrant: true,
        annualWageGrowth: 0.12,
        targetUsers2028: 1200,
        bridgeCapital: 500000000,
        bridgeDate: '2027-01-10',
        growthGoal: '2.2x',
        burnTolerance: '25M',
        fixedCosts: {
            payroll: 35000000,
            rent: 8000000
        },
        unitEconomics: {
            variableCostPerUser: 3000
        },
        userModel: {
            initialUsers: 0,
            baseCAC: 80000,
            baseChurn: 0.05,
            friction: DEFAULT_FRICTION
        },
        marketingPolicy: {
            timeline: [
                { date: "2026-05-01", amount: 5000000 },
                { date: "2026-10-01", amount: 15000000 },
                { date: "2027-04-01", amount: 30000000 }
            ]
        },
        pricing: {
            plans: [
                { name: "Basic", price: 19900 },
                { name: "Standard", price: 39900 },
                { name: "Pro", price: 79000 }
            ],
            mixTimeline: [
                { date: "2026-10-01", mix: [0.1, 0.7, 0.2] },
                { date: "2027-06-01", mix: [0.2, 0.5, 0.3] },
                { date: "2028-01-01", mix: [0.2, 0.4, 0.4] }
            ]
        },
        revenuePolicy: {
            startDate: "2026-10-01"
        },
        growthStrategy: {
            reinvestRatio: 0.4
        },
        fundingPolicy: {
            enabled: true,
            injectionAmount: 200000000,
            trigger: { type: 'runway', thresholdMonths: 1 }
        }
    },
    'DEATH_VALLEY': {
        title: '데스 밸리 (Death Valley)',
        desc: '유동성 위기 시나리오 분석',
        initialCapital: 30000000,
        hasGrant: false,
        annualWageGrowth: 0.03,
        targetUsers2028: 400,
        bridgeCapital: 0,
        bridgeDate: '',
        growthGoal: '0.4x',
        burnTolerance: '5M',
        fixedCosts: {
            payroll: 15000000,
            rent: 5000000
        },
        unitEconomics: {
            variableCostPerUser: 3000
        },
        userModel: {
            initialUsers: 0,
            baseCAC: 120000,
            baseChurn: 0.15,
            friction: DEFAULT_FRICTION
        },
        marketingPolicy: {
            timeline: [
                { date: "2026-05-01", amount: 4000000 },
                { date: "2027-01-01", amount: 10000000 }
            ]
        },
        pricing: {
            plans: [
                { name: "Basic", price: 19900 },
                { name: "Standard", price: 39900 },
                { name: "Pro", price: 79000 }
            ],
            mixTimeline: [
                { date: "2026-10-01", mix: [0.7, 0.3, 0.0] },
                { date: "2027-01-01", mix: [0.8, 0.2, 0.0] },
                { date: "2028-01-01", mix: [0.9, 0.1, 0.0] }
            ]
        },
        revenuePolicy: {
            startDate: "2026-10-01"
        },
        growthStrategy: {
            reinvestRatio: 0
        },
        fundingPolicy: {
            enabled: false,
            injectionAmount: 0,
            trigger: { type: 'runway', thresholdMonths: 1 }
        }
    }
};
