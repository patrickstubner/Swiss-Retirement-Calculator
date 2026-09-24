import type { Monat } from '../core/typen';
import { formatBetrag } from './betrag';

/**
 * Ganze Zahl mit Schweizer Tausendertrennzeichen (’, app-weit einheitlich; eigene Umsetzung,
 * weil Intl je nach Browser/ICU ' oder ’ liefert).
 */
export const fmtZahl = (x: number): string => formatBetrag(Math.round(x));
export const fmtChf = (x: number): string => `CHF ${fmtZahl(x)}`;
/** Kurzform für Achsen: 1.2 Mio. / 350 Tsd. / 900 */
export function fmtKompakt(x: number): string {
  const a = Math.abs(x);
  if (a >= 1e6) return `${formatBetrag(x / 1e6, 1)} Mio.`;
  if (a >= 1e3) return `${fmtZahl(x / 1e3)} Tsd.`;
  return String(Math.round(x));
}
export const fmtProzent = (x: number, stellen = 1): string =>
  `${(x * 100).toLocaleString('de-CH', { maximumFractionDigits: stellen })}%`;

export function fmtAlter(monate: number): string {
  const j = Math.floor(monate / 12);
  const m = Math.round(monate - j * 12);
  return m === 0 ? `${j} J.` : `${j} J. ${m} Mt.`;
}

export const MONATSNAMEN = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

export const fmtMonat = (m: Monat): string => `${MONATSNAMEN[m.monat - 1] ?? m.monat} ${m.jahr}`;

/** Parst Eingaben wie «1'234.50», «1 234,5», «12%». Gibt null bei ungültiger Eingabe. */
export function parseZahl(text: string): number | null {
  const s = text.replace(/[\s'’%]/g, '').replace(',', '.');
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
