/**
 * Bereiche der Was-wäre-wenn-Regler (reine Funktionen, getestet in regler.test.ts).
 *
 * Rücktritt: Mitte = eingegebenes Rücktrittsalter bzw. -datum, ±10 Jahre in Monatsschritten, begrenzt auf
 * - frühestens heute (ein Rücktritt in der Vergangenheit ist nicht möglich; ein früherer Rücktritt ist
 *   rechtlich jederzeit möglich, die PK-Leistung fliesst dann bis zum frühesten Bezugsalter auf ein
 *   Freizügigkeitskonto) und
 * - spätestens 70 (AHV-Aufschub höchstens 5 Jahre über das Referenzalter 65, Art. 39 AHVG; PK-Aufschub
 *   bei Weiterarbeit höchstens bis 70, Art. 13 BVG; Regelwert `bvg.bezugsalter.aufschubBis`).
 * Gemeinsamer Regler: verschiebt alle Rücktritte um gleich viele Monate. Sein Bereich ist die
 * Vereinigung der Einzelbereiche; wer an seine Grenze stösst, bleibt dort (wird angezeigt).
 */
import type { Haushalt, Monat, Person } from '../core/typen';
import { alterImMonat, stoppAlterMonate } from '../core/zeitpunkt';
import { MAX_PLANUNGSALTER } from '../data/defaults';
import type { Regeln } from '../rules';

/** ±10 Jahre in Monaten */
export const SPANNE_RUECKTRITT = 120;
/** ±20 Jahre */
export const SPANNE_PLANUNG = 20;

export type Grenze = 'heute' | 'hoechstalter' | 'heutigesAlter' | 'maximum';

export interface Bereich {
  mitte: number;
  min: number;
  max: number;
  /** Grund, falls der Bereich unten bzw. oben enger als die Spanne ist */
  grenzeUnten: Grenze | null;
  grenzeOben: Grenze | null;
}

/** Rücktrittsbereich einer Person in Monaten (Alter); null = bereits im Ruhestand */
export function ruecktrittBereich(p: Person, heute: Monat, regeln: Regeln): Bereich | null {
  const mitte = stoppAlterMonate(p);
  const frueh = alterImMonat(p, heute);
  if (mitte < frueh) return null;
  const spaet = Math.max(mitte, regeln.bvg.bezugsalter.aufschubBis * 12);
  const min = Math.max(mitte - SPANNE_RUECKTRITT, frueh);
  const max = Math.min(mitte + SPANNE_RUECKTRITT, spaet);
  return {
    mitte,
    min,
    max,
    grenzeUnten: min > mitte - SPANNE_RUECKTRITT ? 'heute' : null,
    grenzeOben: max < mitte + SPANNE_RUECKTRITT ? 'hoechstalter' : null,
  };
}

/** Bereich des gemeinsamen Reglers als Verschiebung in Monaten (Mitte 0) */
export function gemeinsamerBereich(bereiche: readonly Bereich[]): Bereich | null {
  if (bereiche.length === 0) return null;
  const min = Math.min(...bereiche.map((b) => b.min - b.mitte));
  const max = Math.max(...bereiche.map((b) => b.max - b.mitte));
  return {
    mitte: 0,
    min,
    max,
    grenzeUnten: min > -SPANNE_RUECKTRITT ? 'heute' : null,
    grenzeOben: max < SPANNE_RUECKTRITT ? 'hoechstalter' : null,
  };
}

/** Rücktrittsalter (Monate) einer Person bei Verschiebung `delta`, auf ihren Bereich begrenzt */
export function verschoben(b: Bereich, delta: number): { alter: number; begrenzt: boolean } {
  const ziel = b.mitte + delta;
  const alter = Math.min(b.max, Math.max(b.min, ziel));
  return { alter, begrenzt: alter !== ziel };
}

/** Planungsalter: Mitte = Eingabe, ±20 Jahre, mindestens heutiges Alter + 1 der jüngsten Person */
export function planungsBereich(h: Haushalt, heute: Monat): Bereich {
  const mitte = h.planungsalter;
  const juengste = Math.min(...h.personen.map((p) => Math.floor(alterImMonat(p, heute) / 12)));
  const unten = Math.min(mitte, juengste + 1);
  const min = Math.max(mitte - SPANNE_PLANUNG, unten);
  const max = Math.min(mitte + SPANNE_PLANUNG, MAX_PLANUNGSALTER);
  return {
    mitte,
    min,
    max,
    grenzeUnten: min > mitte - SPANNE_PLANUNG ? 'heutigesAlter' : null,
    grenzeOben: max < mitte + SPANNE_PLANUNG ? 'maximum' : null,
  };
}
