/** Texte und Helfer zur Darstellung «Heutige Kaufkraft» / «Nominal (mit Teuerung)». */
import type { MonteCarloErgebnis } from '../core/montecarlo';
import type { Darstellung } from '../core/nominal';
import type { Haushalt, SimulationsErgebnis } from '../core/typen';

export const darstellungVon = (h: Pick<Haushalt, 'darstellung'>): Darstellung =>
  h.darstellung === 'nominal' ? 'nominal' : 'real';

/** «in heutigen Franken» bzw. «in Franken des jeweiligen Jahres» */
export const inFranken = (d: Darstellung): string =>
  d === 'nominal' ? 'in Franken des jeweiligen Jahres' : 'in heutigen Franken';

/** Kurzform für Kennzahlen: «heutige CHF» bzw. «CHF des jeweiligen Jahres» */
export const chfKurz = (d: Darstellung): string => (d === 'nominal' ? 'CHF des jeweiligen Jahres' : 'heutige CHF');

export const DARSTELLUNG_OPTIONEN: { value: Darstellung; label: string }[] = [
  { value: 'real', label: 'Heutige Kaufkraft' },
  { value: 'nominal', label: 'Nominal (mit Teuerung)' },
];

/** Perzentile des Monte Carlo in der gewählten Darstellung */
export function mcBaender(m: MonteCarloErgebnis, d: Darstellung) {
  return d === 'nominal' ? m.nominal : { p10: m.p10, p25: m.p25, p50: m.p50, p75: m.p75, p90: m.p90 };
}

/** Endvermögen in der gewählten Darstellung (nominal: mit der Teuerung des gerechneten Pfads). */
export function endBetrag(e: SimulationsErgebnis, d: Darstellung): number {
  return d === 'nominal' ? e.endVermoegen * (e.zeilen.at(-1)?.indexEnde ?? 1) : e.endVermoegen;
}

/** Verfügbares Vermögen pro Jahr in der gewählten Darstellung. */
export function vermoegenReihe(e: SimulationsErgebnis, d: Darstellung): number[] {
  return e.zeilen.map((z) => (d === 'nominal' ? z.vermoegen * z.indexEnde : z.vermoegen));
}
