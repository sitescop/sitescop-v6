/** Australian GST rate used for agreements and invoices. */
export const GST_RATE_PERCENT = 10;

export function calculatePricingFromExCents(priceCents: number): {
  priceCents: number;
  gstCents: number;
  totalCents: number;
} {
  const gstCents = Math.round(priceCents * (GST_RATE_PERCENT / 100));
  return { priceCents, gstCents, totalCents: priceCents + gstCents };
}

export function exCentsFromIncCents(incCents: number): number {
  return Math.round(incCents / (1 + GST_RATE_PERCENT / 100));
}

export function incCentsFromExCents(exCents: number): number {
  return calculatePricingFromExCents(exCents).totalCents;
}

export function formatAudAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function audStringToExCents(value: string): number | null {
  const parsed = Math.round(Number.parseFloat(value) * 100);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function exAudStringToIncAudString(exAud: string): string {
  const parsed = Number.parseFloat(exAud);
  if (!Number.isFinite(parsed) || parsed < 0) return '';
  return formatAudAmount(parsed * (1 + GST_RATE_PERCENT / 100));
}

export function incAudStringToExAudString(incAud: string): string {
  const parsed = Number.parseFloat(incAud);
  if (!Number.isFinite(parsed) || parsed < 0) return '';
  return formatAudAmount(parsed / (1 + GST_RATE_PERCENT / 100));
}

export function gstPricePairFromExCents(cents: number): { ex: string; inc: string } {
  const ex = formatAudAmount(cents / 100);
  return { ex, inc: exAudStringToIncAudString(ex) };
}
