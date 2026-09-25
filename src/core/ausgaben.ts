/**
 * Lebenshaltungskosten pro Kalenderjahr (Detailmodus: Phasen und Einzeljahr-Abweichungen).
 *
 * Alle Beträge sind in heutigen Franken (Kaufkraft heute). Die Simulation rechnet real
 * (core/simulation.ts): ein Betrag in heutigen Franken entspricht im Jahr t nominal
 * Betrag × Π(1 + Teuerung). `nominalImJahr()` liefert diese Hochrechnung für die Anzeige.
 *
 * Vorrang pro Jahr: Einzeljahr-Abweichung → erste passende Phase → Grundbetrag × Altersfaktor (ab 75/85).
 */
import type { Ausgaben, AusgabenPhase, BetragEinheit, Person } from './typen';

export type AusgabenQuelle = 'grund' | 'phase' | 'einzeljahr';

export interface AusgabenImJahr {
  /** Betrag pro ganzes Jahr in heutigen Franken */
  betrag: number;
  quelle: AusgabenQuelle;
  /** Index der Phase bzw. Einzeljahr-Abweichung (sonst -1) */
  index: number;
}

export const proJahr = (betrag: number, einheit: BetragEinheit): number =>
  Math.max(0, betrag) * (einheit === 'monat' ? 12 : 1);

/** Wert, auf den sich die Phasen beziehen: Kalenderjahr oder im Jahr erreichtes Alter der gewählten Person. */
export function phasenWert(a: Ausgaben, jahr: number, personen: readonly Person[]): number {
  if (a.phasenBezug === 'jahr') return jahr;
  const p = personen[a.phasenPerson] ?? personen[0];
  return p ? jahr - p.geburtsjahr : jahr;
}

export const phasePasst = (ph: AusgabenPhase, wert: number): boolean =>
  wert >= ph.von && (ph.bis === null || wert <= ph.bis);

/**
 * Lebenshaltung eines Kalenderjahres in heutigen Franken.
 * @param refAlter Alter der Referenzperson (jüngere Person) im Jahr, für die Faktoren ab 75/85
 */
export function lebenshaltungImJahr(
  a: Ausgaben,
  jahr: number,
  personen: readonly Person[],
  refAlter: number,
): AusgabenImJahr {
  const ej = a.einzeljahre.findIndex((e) => e.jahr === jahr);
  const e = a.einzeljahre[ej];
  if (e) return { betrag: proJahr(e.betrag, e.einheit), quelle: 'einzeljahr', index: ej };
  const wert = phasenWert(a, jahr, personen);
  const pi = a.phasen.findIndex((ph) => phasePasst(ph, wert));
  const ph = a.phasen[pi];
  if (ph) return { betrag: proJahr(ph.betrag, ph.einheit), quelle: 'phase', index: pi };
  const faktor = refAlter >= 85 ? a.faktorAb85 : refAlter >= 75 ? a.faktorAb75 : 1;
  return { betrag: Math.max(0, a.lebenshaltung) * faktor, quelle: 'grund', index: -1 };
}

/** Betrag in heutigen Franken auf das Jahr hochgerechnet (nominal) mit konstanter erwarteter Teuerung. */
export function nominalImJahr(betragHeute: number, jahr: number, startJahr: number, inflation: number): number {
  return betragHeute * (1 + inflation) ** Math.max(0, jahr - startJahr);
}

/** Alle Ausgabenbeträge mit einem Faktor skalieren (Sensitivität). */
export function ausgabenSkaliert(a: Ausgaben, f: number): Ausgaben {
  return {
    ...a,
    lebenshaltung: a.lebenshaltung * f,
    phasen: a.phasen.map((ph) => ({ ...ph, betrag: ph.betrag * f })),
    einzeljahre: a.einzeljahre.map((e) => ({ ...e, betrag: e.betrag * f })),
  };
}
