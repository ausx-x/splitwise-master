export interface ImportedExpenseRow {
  date: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  groupName: string;
}

export function parseSplitwiseCsvExport(rawCsv: string): ImportedExpenseRow[] {
  const lines = (rawCsv || "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    return {
      date: cols[0] || "2026-10-15",
      description: cols[1] || "Imported Expense",
      category: cols[2] || "Food & Drink",
      amount: parseFloat(cols[3] || "0") || 0,
      currency: cols[4] || "INR",
      groupName: cols[5] || "Hauz Khas Flat 402",
    };
  }).filter((r) => r.amount > 0);
}
