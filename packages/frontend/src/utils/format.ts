// Map an ISO-4217 currency code to a symbol (fallback to the code itself).
const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  SGD: "S$",
  INR: "₹",
};

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return "$";
  return SYMBOLS[code.toUpperCase()] ?? `${code} `;
}

export function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return "n/a";
  const sym = currencySymbol(currency);
  return sym.length === 1 ? `${sym}${amount.toLocaleString()}` : `${sym}${amount.toLocaleString()}`;
}
