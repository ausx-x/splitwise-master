export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export type SplitStrategy = 'EQUAL' | 'EXACT' | 'PERCENT' | 'SHARES' | 'ADJUSTMENT';

export type GroupCategory = 'Apartment' | 'Trip' | 'Couple' | 'Other';

export interface User {
  id: string;
  name: string;
  email: string;
  upi: string;
  defaultCurrency?: CurrencyCode;
  avatar: string;
}

export interface Group {
  id: string;
  name: string;
  category: GroupCategory;
  avatar: string;
  members: string[];
  simplifyByDefault: boolean;
  defaultSplitStrategy: SplitStrategy;
  monthlyBudget: number;
  archived: boolean;
  inviteToken: string;
}

export interface ExpenseShare {
  userId: string;
  paidShare: number;
  owedShare: number;
}

export interface ExpenseComment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface ExpenseRevision {
  rev: number;
  actorId: string;
  summary: string;
  timestamp: string;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  category: string;
  totalAmount: number;
  currency: CurrencyCode;
  date: string;
  createdBy: string;
  splitType: SplitStrategy;
  isPayment: boolean;
  recurring: 'none' | 'weekly' | 'monthly' | 'yearly';
  notes?: string;
  deleted: boolean;
  shares: ExpenseShare[];
  comments: ExpenseComment[];
  revisions: ExpenseRevision[];
}

export interface DirectedDebtEdge {
  from: string; // Debtor userId
  to: string;   // Creditor userId
  amount: number;
}
