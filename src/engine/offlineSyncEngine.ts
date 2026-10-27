export type VersionVector = Record<string, number>;

export interface ConcurrentEditConflict {
  id: string;
  expenseId: string;
  expenseTitle: string;
  baseAmount: number;
  localActor: string;
  localAmount: number;
  localVector: VersionVector;
  remoteActor: string;
  remoteAmount: number;
  remoteVector: VersionVector;
}

export type ConflictResolutionStrategy = "LWW" | "LOCAL" | "MERGE";

export function resolveExpenseConflict(
  conflict: ConcurrentEditConflict,
  strategy: ConflictResolutionStrategy
): { resolvedAmount: number; mergedVector: VersionVector; auditSummary: string } {
  const mergedVector: VersionVector = { ...conflict.remoteVector };
  Object.entries(conflict.localVector).forEach(([actor, ver]) => {
    mergedVector[actor] = Math.max(mergedVector[actor] || 0, ver) + 1;
  });
  if (strategy === "LOCAL") {
    return { resolvedAmount: conflict.localAmount, mergedVector, auditSummary: "Local Override" };
  }
  if (strategy === "MERGE") {
    const resolvedAmount = conflict.baseAmount + (conflict.localAmount - conflict.baseAmount) + (conflict.remoteAmount - conflict.baseAmount);
    return { resolvedAmount, mergedVector, auditSummary: "CRDT Delta Merge" };
  }
  return { resolvedAmount: conflict.remoteAmount, mergedVector, auditSummary: "Last-Write-Wins (LWW)" };
}
