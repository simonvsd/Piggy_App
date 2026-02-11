/**
 * Format position quantity for display. Shows integers as "5", fractions as "0.45" (no trailing zeros).
 */
export function formatQuantity(qty: number): string {
  if (typeof qty !== "number" || Number.isNaN(qty)) return "0";
  if (Number.isInteger(qty)) return String(qty);
  const s = qty.toFixed(4);
  return s.replace(/\.?0+$/, "");
}
