export interface ParsedDigitalBill {
  merchant: string;
  amount: number;
  currency: "INR";
  category: string;
  refId: string;
  date: string;
  items: { name: string; amount: number }[];
}

export function parseDigitalBillText(rawText: string): ParsedDigitalBill {
  const text = (rawText || "").trim();
  let merchant = "Digital Bill Merchant";
  let category = "Food & Drink";
  const merchMatch = text.match(/(?:Merchant|Restaurant|Pickup)\s*:\s*([^\r\n]+)/i);
  if (/blinkit|zepto|instamart/i.test(text)) {
    category = "Groceries";
    merchant = merchMatch ? merchMatch[1].trim() : "Blinkit Instant Grocery";
  } else if (/uber|ola|rapido|airport/i.test(text)) {
    category = "Transport";
    merchant = merchMatch ? "Uber: " + merchMatch[1].trim() : "Uber Trip";
  } else if (/zomato/i.test(text)) {
    category = "Food & Drink";
    merchant = merchMatch ? "Zomato — " + merchMatch[1].trim() : "Zomato Food Order";
  } else if (/swiggy/i.test(text)) {
    category = "Food & Drink";
    merchant = merchMatch ? "Swiggy — " + merchMatch[1].trim() : "Swiggy Food Order";
  } else if (merchMatch) {
    merchant = merchMatch[1].trim();
  }
  const refMatch = text.match(/#[A-Z0-9-]+/i);
  const refId = refMatch ? refMatch[0] : "#AUTO-1001";
  const dateMatch = text.match(/\b(202\d-\d{2}-\d{2})\b/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
  let amount = 0;
  const totalLineMatch = text.match(/(?:Grand Total|Total Paid|Total Bill Paid|Total Charged)[^0-9]*([0-9,]+(?:\.\d{1,2})?)/i);
  if (totalLineMatch) amount = parseFloat(totalLineMatch[1].replace(/,/g, "")) || 0;
  return { merchant, amount, currency: "INR", category, refId, date, items: [] };
}
