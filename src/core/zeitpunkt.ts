/**
 * Zeitpunkte pro Person: Alter (Jahre + Monate) ↔ Kalendermonat.
 * Monatsindex = Jahr × 12 + (Monat − 1); Alter in Monaten = Index − Geburtsindex.
 */
import type { Monat, Person, ZeitpunktModus } from './typen';

export const geburtIndex = (p: Pick<Person, 'geburtsjahr' | 'geburtsmonat'>): number =>
  p.geburtsjahr * 12 + (p.geburtsmonat - 1);

const idx = (m: Monat): number => m.jahr * 12 + (m.monat - 1);
const ausIdx = (i: number): Monat => ({ jahr: Math.floor(i / 12), monat: (((i % 12) + 12) % 12) + 1 });

/**
 * Alter bei Erwerbsaufgabe in Monaten = Alter im ersten Monat ohne Erwerbseinkommen.
 * Modus 'alter': Eingabe in Jahren (+ Monate/12). Modus 'datum': letzter Arbeitsmonat,
 * die Erwerbsaufgabe gilt ab dem Folgemonat (Beispiel: «per Ende November 2027» →
 * erster Monat ohne Lohn Dezember 2027).
 */
export function stoppAlterMonate(p: Person): number {
  if (p.stoppModus === 'datum') return Math.max(0, idx(p.stoppDatum) + 1 - geburtIndex(p));
  return Math.max(0, Math.round(p.stoppAlter * 12));
}

/** Letzter Arbeitsmonat zu einem Stopp-Alter in Monaten. */
export function letzterArbeitsmonat(p: Pick<Person, 'geburtsjahr' | 'geburtsmonat'>, stoppMonate: number): Monat {
  return ausIdx(geburtIndex(p) + stoppMonate - 1);
}

/** Alter (Monate) in einem Kalendermonat. */
export function alterImMonat(p: Pick<Person, 'geburtsjahr' | 'geburtsmonat'>, m: Monat): number {
  return idx(m) - geburtIndex(p);
}

/** Kalendermonat, in dem ein Alter (Monate) erreicht ist. */
export function monatBeiAlterMonate(p: Pick<Person, 'geburtsjahr' | 'geburtsmonat'>, alterMonate: number): Monat {
  return ausIdx(geburtIndex(p) + alterMonate);
}

/** Zeitpunkt (Alter oder Datum) als Monatsindex. */
export function zeitpunktIndex(
  p: Pick<Person, 'geburtsjahr' | 'geburtsmonat'>,
  modus: ZeitpunktModus,
  alterJahre: number,
  datum: Monat,
): number {
  return modus === 'datum' ? idx(datum) : geburtIndex(p) + Math.round(alterJahre * 12);
}

/** Erster Monat mit Wohnsitz im Ausland als Monatsindex; null ohne Wegzug. */
export function wegzugIndex(p: Person): number | null {
  const w = p.wohnsitzAusland;
  if (!w.aktiv) return null;
  return zeitpunktIndex(p, w.modus, w.alter, w.datum);
}
