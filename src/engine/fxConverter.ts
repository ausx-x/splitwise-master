import { CurrencyCode } from '../types/ledger';

export const FX_RATES_FROM_INR: Record<CurrencyCode, number> = {
  INR: 1.0,
  USD: 0.0119,
  EUR: 0.0109,
  GBP: 0.0092,
};

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  if (from === to) return amount;
  const inInr = amount / (FX_RATES_FROM_INR[from] || 1);
  return Math.round(inInr * (FX_RATES_FROM_INR[to] || 1) * 100) / 100;
}

export function buildUpiDeepLink(params: {
  payeeVpa: string;
  payeeName: string;
  amountInr: number;
  note?: string;
}): string {
  const { payeeVpa, payeeName, amountInr, note = 'Splitwise Settlement' } = params;
  return `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(payeeName)}&am=${amountInr.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
}
