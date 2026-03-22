// src/core/simulation/frictionConfigs.ts
import { FrictionConfig } from '../engine/userEngine';

/**
 * [STRATEGY REPOSITORY] Default Market Friction
 * High scale leads to increased CAC and Churn.
 */
export const DEFAULT_FRICTION: FrictionConfig = {

  // [USER REQ] 1. CAC increases as market saturates: effectiveCAC = baseCAC * (1 + users / 500)
  cacCurve: (baseCAC, users) => {
    return baseCAC * (1 + users / 500);
  },

  // [USER REQ] 3. Churn is phased by scale: <300: 0.05, <700: 0.04, >=700: 0.03
  churnCurve: (baseChurn, users) => {
    return users < 300 ? 0.05 : users < 700 ? 0.04 : 0.03;
  },

  // Growth dampening (Soft cap at certain thresholds)
  growthDampening: (users, newUsers) => {
    if (users < 1000) return newUsers;
    if (users < 3000) return Math.floor(newUsers * 0.8);
    return Math.floor(newUsers * 0.6);
  }
};
