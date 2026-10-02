/**
 * Orientierung «Aktienanteil → historische Rendite» (Hilfetext zu den Annahmen).
 *
 * Gerechnet aus den Jahresreihen der Jordà-Schularick-Taylor Macrohistory Database R6 (Aktien- und Obligationen-
 * Gesamtrenditen, nominal in Landeswährung, siehe data/krisen-historisch.json): geometrisches Mittel eines jährlich auf
 * den Zielanteil zurückgestellten Portfolios (Anteil × Aktien + Rest × Obligationen), vor Kosten und Steuern.
 * Das ist eine Rückschau und keine Prognose; die Zahlen werden nicht von Hand gepflegt, sondern aus den Daten berechnet.
 */
import type { HistJahr, KrisenDaten, KrisenLand } from './krisen';

export const RICHTWERT_VON = 1900;
export const RICHTWERT_BIS = 2020;
export const RICHTWERT_ANTEILE = [1, 0.75, 0.5, 0.25, 0] as const;

export interface Richtwert {
  aktienanteil: number;
  /** Geometrische nominale Jahresrendite (0.072 = 7.2 %) */
  nominal: number;
  /** Anzahl Jahre, die in die Rechnung eingingen */
  jahre: number;
}

export function richtwerte(
  daten: KrisenDaten,
  land: KrisenLand,
  anteile: readonly number[] = RICHTWERT_ANTEILE,
): Richtwert[] {
  const zeilen: HistJahr[] = [...daten[land].values()].filter(
    (h) =>
      h.jahr >= RICHTWERT_VON &&
      h.jahr <= RICHTWERT_BIS &&
      h.aktien !== null &&
      h.obligationen !== null &&
      h.teuerung !== null,
  );
  return anteile.map((w) => {
    let summe = 0;
    for (const h of zeilen) summe += Math.log(1 + w * (h.aktien as number) + (1 - w) * (h.obligationen as number));
    return {
      aktienanteil: w,
      nominal: zeilen.length ? Math.exp(summe / zeilen.length) - 1 : Number.NaN,
      jahre: zeilen.length,
    };
  });
}
