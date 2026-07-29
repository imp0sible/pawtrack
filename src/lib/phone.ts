// Phone-number helpers. We store a normalized form (leading "+" optional,
// digits only otherwise) and validate loosely as E.164-ish.

export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function isValidPhone(input: string): boolean {
  return /^\+?\d{8,15}$/.test(normalizePhone(input));
}

// Light formatting for display: group the national part in triples.
export function formatPhone(input: string | null | undefined): string {
  if (!input) return "";
  const n = normalizePhone(input);
  const plus = n.startsWith("+");
  const digits = plus ? n.slice(1) : n;
  // Keep a country prefix (1–3 leading digits) then group the rest by 3.
  const rest = digits.length > 9 ? digits.slice(0, digits.length - 9) : "";
  const local = rest ? digits.slice(rest.length) : digits;
  const grouped = local.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  return `${plus ? "+" : ""}${rest}${rest ? " " : ""}${grouped}`.trim();
}
