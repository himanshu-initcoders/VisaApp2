/**
 * Listing fees are rupee decimals. Razorpay charges integer paise.
 * "199.50" -> 19950, without binary floating point.
 */
export function rupeesDecimalToPaise(
  value: string | null | undefined
): number | null {
  const raw = (value ?? '0').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;

  const [whole, frac = ''] = raw.split('.');
  const rupees = Number(whole);
  const paisePart = Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(rupees) || !Number.isSafeInteger(paisePart)) {
    return null;
  }

  const paise = rupees * 100 + paisePart;
  return Number.isSafeInteger(paise) ? paise : null;
}

export function formatInrFromPaise(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}₹${rupees.toLocaleString('en-IN')}.${frac}`;
}
