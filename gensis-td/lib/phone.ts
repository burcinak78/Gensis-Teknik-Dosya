/** Mobile number as it is typed: 05XX XXX XX XX. */
export function formatMobile(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)].filter(Boolean).join(" ");
}
