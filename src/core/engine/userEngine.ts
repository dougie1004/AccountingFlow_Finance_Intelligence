// src/core/engine/userEngine.ts (v2)

export interface FrictionConfig {
  cacCurve: (baseCAC: number, users: number) => number;
  churnCurve: (baseChurn: number, users: number) => number;
  growthDampening?: (users: number, newUsers: number) => number;
}

export interface UserModel {
  initialUsers: number;

  baseCAC: number;
  baseChurn: number;

  friction: FrictionConfig;
}

export interface UserState {
  users: number;
  newUsers: number;
  churnedUsers: number;

  cac: number;
  churnRate: number;
}

/**
 * [IMMUTABLE STRATEGY ENGINE] User Growth Dynamics
 * Calculates user base changes with dynamic friction based on scale.
 */
export function updateUsers(
  prevUsers: number,
  marketingSpend: number,
  model: UserModel
): UserState {

  // 1. Dynamic CAC based on scale
  const cac = model.friction.cacCurve(
    model.baseCAC,
    prevUsers
  );

  // 2. Dynamic churn based on scale
  const churnRate = model.friction.churnCurve(
    model.baseChurn,
    prevUsers
  );

  // 3. Inflow calculation (Marketing / Dynamic CAC)
  let newUsers = cac > 0
    ? Math.floor(marketingSpend / cac)
    : 0;

  // 4. Growth dampening (optional friction)
  if (model.friction.growthDampening) {
    newUsers = model.friction.growthDampening(
      prevUsers,
      newUsers
    );
  }

  // 5. Churn calculation
  const churnedUsers = Math.floor(prevUsers * churnRate);

  // 6. Final user count (non-negative)
  const users = Math.max(
    prevUsers + newUsers - churnedUsers,
    0
  );

  return {
    users,
    newUsers,
    churnedUsers,
    cac,
    churnRate
  };
}
