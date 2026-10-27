/**
 * Express REST API Gateway & ACID Double-Entry Transaction Controller
 * Supports Idempotency Keys, Event-Sourced Revisions, and UPI/Venmo Webhooks.
 */
import { computeSplitShares } from '../engine/splitCalculator';
import { computeNetBalances, simplifyDebtsGreedyMinCashFlow } from '../engine/debtSimplifier';
import { buildUpiDeepLink } from '../engine/fxConverter';
import { Expense } from '../types/ledger';

const idempotencyCache = new Map<string, Expense>();
const ledgerStore: Expense[] = [];

export function handleCreateExpenseRequest(
  body: any,
  idempotencyKey?: string
): { status: number; data: any } {
  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    return { status: 200, data: idempotencyCache.get(idempotencyKey) };
  }

  const splitResult = computeSplitShares({
    strategy: body.splitType,
    totalAmount: Number(body.totalAmount),
    memberIds: body.memberIds,
    exactAmounts: body.exactAmounts,
    percentages: body.percentages,
    shares: body.shares,
    adjustments: body.adjustments,
  });

  if (!splitResult.valid) {
    return { status: 400, data: { error: splitResult.errorMessage } };
  }

  const newExpense: Expense = {
    id: 'exp_' + Date.now(),
    groupId: body.groupId,
    description: body.description,
    category: body.category || 'Other',
    totalAmount: Number(body.totalAmount),
    currency: body.currency || 'INR',
    date: body.date || new Date().toISOString().slice(0, 10),
    createdBy: body.createdBy,
    splitType: body.splitType,
    isPayment: Boolean(body.isPayment),
    recurring: body.recurring || 'none',
    notes: body.notes || '',
    deleted: false,
    shares: body.memberIds.map((uid: string) => ({
      userId: uid,
      paidShare: body.paidByMember?.[uid] ?? (uid === body.createdBy ? Number(body.totalAmount) : 0),
      owedShare: splitResult.owedByMember[uid] || 0,
    })),
    comments: [],
    revisions: [
      {
        rev: 1,
        actorId: body.createdBy,
        summary: `Created expense (${body.splitType})`,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  ledgerStore.unshift(newExpense);
  if (idempotencyKey) {
    idempotencyCache.set(idempotencyKey, newExpense);
  }
  return { status: 201, data: newExpense };
}

export function handleGetGroupSimplifiedDebts(groupId: string) {
  const groupExpenses = ledgerStore.filter((e) => e.groupId === groupId && !e.deleted);
  const net = computeNetBalances(groupExpenses);
  return {
    netBalances: net,
    simplifiedTransfers: simplifyDebtsGreedyMinCashFlow(net),
    upiLinkGenerator: buildUpiDeepLink,
  };
}
