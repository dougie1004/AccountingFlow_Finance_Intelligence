// src/core/engine/strategicEngine.ts

import { updateUsers, UserModel } from './userEngine';
import { calculateARPU, calculateRevenue, PricingConfig } from './revenueEngine';
import {
  evaluateFundingImpact,
  FundingPolicy,
  ControlState,
  getControlState
} from './fundingEngine';
import { resolveMarketingSpend, MarketingConfig } from './marketingEngine';

export interface StrategicState {
  date: string;
  users: number;
  revenue: number;
  cash: number;
  runway: number;

  founderEquity: number;
  controlState: ControlState;

  fundingTriggered: boolean;

  // Strategic Details
  valuation?: number;
  dilution?: number;
  message?: string;
}

export function runStrategicSimulation(params: {
  dates: string[];

  initialCash: number;
  monthlyFixedCost: number;

  marketingConfig: MarketingConfig;

  userModel: UserModel;
  pricingConfig: PricingConfig;

  fundingPolicy: FundingPolicy;
  fundingAmount: number;
}) {
  let users = params.userModel.initialUsers;
  let cash = params.initialCash;
  let founderEquity = 1.0;

  const results: StrategicState[] = [];

  for (const date of params.dates) {
    // 0. Resolve Marketing Spend
    const marketingSpend = resolveMarketingSpend(
      date,
      params.marketingConfig
    );

    // 1. Users
    const userState = updateUsers(
      users,
      marketingSpend,
      params.userModel
    );
    users = userState.users;

    // 2. Revenue
    const arpu = calculateARPU(date, params.pricingConfig);
    const revenue = calculateRevenue(users, arpu);

    // 3. Burn & Cash (Include marketing in burn)
    const totalMonthlyCost = params.monthlyFixedCost + marketingSpend;
    const burn = totalMonthlyCost - revenue;
    cash += revenue - totalMonthlyCost;

    // 4. Funding Check & Runway
    const fundingImpact = evaluateFundingImpact({
      date,
      cash,
      monthlyBurn: burn,
      founderEquity,
      policy: params.fundingPolicy,
      fundingAmount: params.fundingAmount
    });

    let fundingTriggered = false;

    if (fundingImpact.triggered) {
      fundingTriggered = true;

      // cash inflow
      cash += params.fundingAmount;

      // equity update
      founderEquity = fundingImpact.founderEquityAfter!;
    }

    const controlState = getControlState(founderEquity);

    results.push({
      date,
      users,
      revenue,
      cash,
      runway: fundingImpact.runway,
      founderEquity,
      controlState,
      fundingTriggered,

      // Strategic Details
      valuation: fundingImpact.valuation,
      dilution: fundingImpact.dilution,
      message: fundingImpact.message
    });
  }

  return results;
}
