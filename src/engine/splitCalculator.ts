import { SplitStrategy } from '../types/ledger';

/**
 * Deterministic Penny Allocation for Equal Splits:
 * Base = floor((Total / N) * 100) / 100
 * Remainder cents are distributed 1 cent each to the first indexed members
 * so that sum(Share_i) === Total exactly.
 */
export function allocateEqualWithPennies(
  totalAmount: number,
  memberIds: string[]
): Record<string, number> {
  const n = memberIds.length;
  if (n === 0) return {};
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / n);
  const remainderCents = totalCents - baseCents * n;

  const result: Record<string, number> = {};
  memberIds.forEach((uid, idx) => {
    const extraPenny = idx < remainderCents ? 1 : 0;
    result[uid] = (baseCents + extraPenny) / 100;
  });
  return result;
}

/**
 * Proportional Split with Largest-Remainder Penny Allocation
 * Used by PERCENT, SHARES, and Itemized Receipt Tax/Tip distribution.
 */
export function allocateProportionalWithPennies(
  totalAmount: number,
  weightsMap: Record<string, number>,
  memberIds: string[]
): Record<string, number> {
  const totalWeight = memberIds.reduce(
    (acc, uid) => acc + Math.max(0, Number(weightsMap[uid]) || 0),
    0
  );
  if (totalWeight <= 0) {
    return allocateEqualWithPennies(totalAmount, memberIds);
  }

  const totalCents = Math.round(totalAmount * 100);
  let allocatedCents = 0;
  const rawCents: Record<string, { floored: number; frac: number }> = {};

  memberIds.forEach((uid) => {
    const w = Math.max(0, Number(weightsMap[uid]) || 0);
    const exact = (totalCents * w) / totalWeight;
    const floored = Math.floor(exact);
    rawCents[uid] = { floored, frac: exact - floored };
    allocatedCents += floored;
  });

  const remainder = totalCents - allocatedCents;
  const sortedByFrac = [...memberIds].sort(
    (a, b) => rawCents[b].frac - rawCents[a].frac
  );
  for (let i = 0; i < remainder; i++) {
    const target = sortedByFrac[i % sortedByFrac.length];
    rawCents[target].floored += 1;
  }

  const result: Record<string, number> = {};
  memberIds.forEach((uid) => {
    result[uid] = rawCents[uid].floored / 100;
  });
  return result;
}

export interface SplitComputationInput {
  strategy: SplitStrategy;
  totalAmount: number;
  memberIds: string[];
  exactAmounts?: Record<string, number>;
  percentages?: Record<string, number>;
  shares?: Record<string, number>;
  adjustments?: Record<string, number>;
}

export interface SplitComputationResult {
  valid: boolean;
  errorMessage?: string;
  owedByMember: Record<string, number>;
}

export function computeSplitShares(
  input: SplitComputationInput
): SplitComputationResult {
  const { strategy, totalAmount, memberIds } = input;
  if (memberIds.length === 0) {
    return { valid: false, errorMessage: 'At least one member required', owedByMember: {} };
  }

  if (strategy === 'EQUAL') {
    return {
      valid: true,
      owedByMember: allocateEqualWithPennies(totalAmount, memberIds),
    };
  }

  if (strategy === 'EXACT') {
    const map = input.exactAmounts || {};
    const owed: Record<string, number> = {};
    let sum = 0;
    memberIds.forEach((uid) => {
      const v = Math.round((Number(map[uid]) || 0) * 100) / 100;
      owed[uid] = v;
      sum += v;
    });
    const diff = Math.round((totalAmount - sum) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      return {
        valid: false,
        errorMessage: diff > 0 ? `${diff.toFixed(2)} remaining` : `${Math.abs(diff).toFixed(2)} over total`,
        owedByMember: owed,
      };
    }
    return { valid: true, owedByMember: owed };
  }

  if (strategy === 'PERCENT') {
    const pctMap = input.percentages || {};
    const sumPct = memberIds.reduce((acc, uid) => acc + (Number(pctMap[uid]) || 0), 0);
    const diffPct = Math.round((100 - sumPct) * 100) / 100;
    if (Math.abs(diffPct) > 0.05) {
      return {
        valid: false,
        errorMessage: `Percentages sum to ${sumPct.toFixed(2)}% (must be 100%)`,
        owedByMember: {},
      };
    }
    return {
      valid: true,
      owedByMember: allocateProportionalWithPennies(totalAmount, pctMap, memberIds),
    };
  }

  if (strategy === 'SHARES') {
    const shMap = input.shares || {};
    const sumShares = memberIds.reduce((acc, uid) => acc + Math.max(0, Number(shMap[uid]) || 0), 0);
    if (sumShares <= 0) {
      return { valid: false, errorMessage: 'Total shares must be > 0', owedByMember: {} };
    }
    return {
      valid: true,
      owedByMember: allocateProportionalWithPennies(totalAmount, shMap, memberIds),
    };
  }

  if (strategy === 'ADJUSTMENT') {
    const adjMap = input.adjustments || {};
    const sumAdj = memberIds.reduce((acc, uid) => acc + (Number(adjMap[uid]) || 0), 0);
    const basePool = Math.round((totalAmount - sumAdj) * 100) / 100;
    if (basePool < -0.01) {
      return { valid: false, errorMessage: 'Adjustments exceed total amount', owedByMember: {} };
    }
    const equalBase = allocateEqualWithPennies(Math.max(0, basePool), memberIds);
    const owed: Record<string, number> = {};
    memberIds.forEach((uid) => {
      owed[uid] = Math.round(((equalBase[uid] || 0) + (Number(adjMap[uid]) || 0)) * 100) / 100;
    });
    return { valid: true, owedByMember: owed };
  }

  return { valid: false, errorMessage: 'Unsupported split strategy', owedByMember: {} };
}
