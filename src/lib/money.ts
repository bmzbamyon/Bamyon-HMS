/**
 * All money in this codebase is an integer in the currency's minor unit
 * (e.g. kobo for NGN, cents for USD). Never do money arithmetic with
 * floating point numbers — that is how carts, wallets and ledgers end up
 * off by fractions of a currency unit at scale.
 */

const MINOR_UNITS_PER_MAJOR: Record<string, number> = {
  NGN: 100,
  USD: 100,
  GBP: 100,
  GHS: 100,
  KES: 100,
};

export function toMinorUnits(majorAmount: number, currency: string): number {
  const factor = MINOR_UNITS_PER_MAJOR[currency] ?? 100;
  return Math.round(majorAmount * factor);
}

export function toMajorUnits(minorAmount: number, currency: string): number {
  const factor = MINOR_UNITS_PER_MAJOR[currency] ?? 100;
  return minorAmount / factor;
}

const CURRENCY_LOCALE: Record<string, string> = {
  NGN: "en-NG",
  USD: "en-US",
  GBP: "en-GB",
  GHS: "en-GH",
  KES: "en-KE",
};

/** Locale-aware display formatting. Never hardcode a currency symbol in a component. */
export function formatMoney(minorAmount: number, currency: string): string {
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(toMajorUnits(minorAmount, currency));
}

export function addMinor(...amounts: number[]): number {
  return amounts.reduce((sum, a) => sum + Math.round(a), 0);
}

export function subtractMinor(a: number, b: number): number {
  return Math.round(a) - Math.round(b);
}

export function percentOfMinor(amountMinor: number, percent: number): number {
  return Math.round((amountMinor * percent) / 100);
}
