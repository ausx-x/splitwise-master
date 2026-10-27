import { DirectedDebtEdge, Expense } from '../types/ledger';

/**
 * Computes net balance B_u = sum(Credits_u) - sum(Debits_u) for each user.
 */
export function computeNetBalances(expenses: Expense[]): Record<string, number> {
  const net: Record<string, number> = {};
  expenses.forEach((exp) => {
    if (exp.deleted) return;
    exp.shares.forEach((s) => {
      net[s.userId] = (net[s.userId] || 0) + (s.paidShare - s.owedShare);
    });
  });
  return net;
}

/**
 * Greedy Min-Cash-Flow Algorithm (Section 1.4 of Specification)
 * 1. Compute net balance B_u for every user u in U.
 * 2. Partition users into Debtors (B_u < 0) and Creditors (B_u > 0).
 * 3. Extract maximum debtor and maximum creditor.
 * 4. Settle an edge of weight min(|B_debtor|, B_creditor).
 * 5. Terminates in at most N - 1 transactions.
 */
export function simplifyDebtsGreedyMinCashFlow(
  netBalancesMap: Record<string, number>
): DirectedDebtEdge[] {
  const debtors: { uid: string; amount: number }[] = [];
  const creditors: { uid: string; amount: number }[] = [];

  Object.entries(netBalancesMap).forEach(([uid, bal]) => {
    const rounded = Math.round(bal * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({ uid, amount: Math.abs(rounded) });
    } else if (rounded > 0.01) {
      creditors.push({ uid, amount: rounded });
    }
  });

  const edges: DirectedDebtEdge[] = [];
  let iterations = 0;

  while (debtors.length > 0 && creditors.length > 0 && iterations < 500) {
    iterations++;
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const maxDebtor = debtors[0];
    const maxCreditor = creditors[0];
    const settledAmount = Math.min(maxDebtor.amount, maxCreditor.amount);

    if (settledAmount > 0.01) {
      edges.push({
        from: maxDebtor.uid,
        to: maxCreditor.uid,
        amount: Math.round(settledAmount * 100) / 100,
      });
    }

    maxDebtor.amount = Math.round((maxDebtor.amount - settledAmount) * 100) / 100;
    maxCreditor.amount = Math.round((maxCreditor.amount - settledAmount) * 100) / 100;

    if (maxDebtor.amount <= 0.01) debtors.shift();
    if (maxCreditor.amount <= 0.01) creditors.shift();
  }

  return edges;
}
