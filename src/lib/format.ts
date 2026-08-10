/**
 * Rupiah formatting.
 *
 * The mockup stores prices as display strings ("Rp 2.850.000"); we store
 * integers and format here so sorting and revenue maths work. Grouping is done
 * by hand rather than via Intl — Hermes ships a trimmed ICU and locale support
 * varies by platform, and the id-ID rule is just "dot every three digits".
 */

export function groupDigits(n: number): string {
  const negative = n < 0;
  const digits = Math.abs(Math.trunc(n)).toString();
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return negative ? `-${out}` : out;
}

/** 2850000 -> "Rp 2.850.000" */
export function rupiah(n: number): string {
  return `Rp ${groupDigits(n)}`;
}

/** Accepts "Rp 2.850.000", "2850000", "2.850.000" -> 2850000. NaN-safe. */
export function parseRupiah(input: string): number {
  const digits = input.replace(/\D/g, '');
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

/** Live-formats what the user types into the HARGA field: "2850000" -> "Rp 2.850.000". */
export function formatRupiahInput(input: string): string {
  const value = parseRupiah(input);
  return value === 0 ? '' : rupiah(value);
}

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Date -> "1 Agustus", as used by the Ringkasan revenue caption. */
export function dayAndMonthId(date: Date): string {
  return `${date.getDate()} ${MONTHS_ID[date.getMonth()]}`;
}

/** First instant of the current month — the boundary for "Bulan ini" revenue. */
export function startOfMonth(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Initials for the image placeholder, e.g. "Elara Tote" -> "ET". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
