/**
 * Todesfall-Szenario (Schema 9): Zeitpunkt und Anspruchsprüfungen. Die Rechnung selbst läuft in
 * `simuliere` (Option `todesfall`); hier stehen die reinen Regeln mit Quellen (Werte in src/rules/2026.json,
 * Abschnitt `todesfall`, Herleitung in docs/quellen.md Abschnitt 15).
 *
 * Modell (Vereinfachungen bewusst, siehe docs/konzept.md):
 * - Nur bei Ehepaaren. Die verstorbene Person fällt ab dem Folgemonat des Todes weg (Lohn, AHV, PK-Rente,
 *   ausländische Renten, wiederkehrende Einnahmen ausser Mieten). Vermögen bleibt im gemeinsamen Topf
 *   (Erbschaftssteuer unter Ehegatten ZH/AG: keine; Pflichtteile/Güterrecht nicht gerechnet).
 * - AHV der überlebenden Person: Witwen-/Witwerrente (80 % der Rente der verstorbenen Person, MB 3.03) oder
 *   die eigene Altersrente ohne Plafonierung plus 20 % Verwitwetenzuschlag (MB 3.01 Ziff. 25) – es zählt die
 *   höhere Jahressumme (Altersrente inkl. 13. Rente gegen 12 Hinterlassenenrenten, Art. 24b AHVG).
 * - PK: Ehegattenrente 60 % (Art. 19, 21 BVG) oder Abfindung von drei Jahresrenten; Freizügigkeit und 3a
 *   fliessen der überlebenden Person als Kapital zu (Art. 15 FZV, Art. 2 BVV 3).
 * - Steuern: Todesjahr gemeinsam (Verheiratetentarif), ab dem Folgejahr Alleinstehendentarif.
 */
import type { Regeln } from '../rules';
import type { Haushalt, Person, Todesfall } from './typen';
import { geburtIndex } from './zeitpunkt';

/** Standard: Einpersonen- statt Zweipersonenhaushalt (modifizierte OECD-Skala 1,0 / 1,5; OFFEN, editierbar). */
export const AUSGABEN_FAKTOR_STANDARD = 0.67;

export interface Todeszeitpunkt {
  /** Verstorbene und überlebende Person (Index) */
  tot: number;
  lebt: number;
  /** Erster Monat ohne die verstorbene Person (Monatsindex, frühestens der Startmonat) */
  idx: number;
}

/**
 * Zeitpunkt des Todes. Alter: Tod in dem Monat, in dem die Person das Alter erreicht (Folgemonat = erster Monat
 * ohne sie, weil Hinterlassenenrenten am 1. des Folgemonats beginnen, MB 3.03 Ziff. 6); Jahr: Tod im Juni.
 * `null`, wenn das Szenario nicht gilt (nicht aktiv, keine zwei Personen, nicht verheiratet).
 */
export function todeszeitpunkt(
  h: Pick<Haushalt, 'zivilstand' | 'personen'>,
  tf: Todesfall,
  startIdx: number,
): Todeszeitpunkt | null {
  if (!tf.aktiv || h.zivilstand !== 'verheiratet' || h.personen.length < 2) return null;
  const tot = tf.person === 1 ? 1 : 0;
  const p = h.personen[tot] as Person;
  const monatsIdx = tf.modus === 'jahr' ? Math.round(tf.jahr) * 12 + 5 : geburtIndex(p) + Math.round(tf.alter * 12);
  return { tot, lebt: 1 - tot, idx: Math.max(startIdx, monatsIdx + 1) };
}

/**
 * Anspruch auf AHV-Witwen-/Witwerrente (MB 3.03 Ziff. 1 und 3, Stand 1.1.2026): Witwe mit Kind(ern) oder mit
 * 45 Jahren und mindestens 5 Ehejahren; Witwer nur mit Kind(ern).
 */
export function ahvHinterlassenenAnspruch(
  ueberlebende: Pick<Person, 'geschlecht'>,
  alterJahre: number,
  ehejahre: number,
  kinder: boolean,
  regeln: Regeln,
): boolean {
  const a = regeln.todesfall.ahvWitwenrenteAnspruch;
  if (kinder) return true;
  return ueberlebende.geschlecht === 'w' && alterJahre >= a.mindestAlter && ehejahre >= a.mindestEhejahre;
}

/** Anspruch auf BVG-Ehegattenrente (Art. 19 BVG): Kinder oder 45 Jahre und 5 Ehejahre (Frau und Mann gleich). */
export function bvgEhegattenAnspruch(alterJahre: number, ehejahre: number, kinder: boolean, regeln: Regeln): boolean {
  const b = regeln.todesfall.bvgEhegattenrente;
  return kinder || (alterJahre >= b.mindestAlter && ehejahre >= b.mindestEhejahre);
}

/** AHV-Witwen-/Witwerrente pro Monat: 80 % der (Voll-)Rente der verstorbenen Person, ohne Plafonierung. */
export const witwenrenteMonat = (renteVerstorbenMonat: number, regeln: Regeln): number =>
  Math.max(0, renteVerstorbenMonat) * regeln.todesfall.ahvWitwenrenteAnteil;

/**
 * Altersrente der überlebenden Person mit Verwitwetenzuschlag: 20 % der eigenen Rente, zusammen höchstens die
 * Maximalrente (MB 3.01 Ziff. 25). `maxRente` und `eigeneRente` in derselben Einheit (Monat).
 */
export function mitVerwitwetenzuschlag(eigeneRente: number, maxRente: number, regeln: Regeln): number {
  const zuschlag = Math.min(regeln.ahv.verwitwetenzuschlag * eigeneRente, Math.max(0, maxRente - eigeneRente));
  return eigeneRente + Math.max(0, zuschlag);
}

/**
 * Vergleich nach Art. 24b AHVG (MB 3.01 Ziff. 26, BSV 13. AHV-Rente): Jahressumme Altersrente inkl. 13. Rente
 * (und Rentenzuschlag AHV 21) gegen 12 Hinterlassenenrenten. true = die Hinterlassenenrente wird ausgerichtet.
 */
export function hinterlassenenrenteHoeher(
  altersrenteMonat: number,
  rentenzuschlagMonat: number,
  witwenrenteMonat_: number,
  regeln: Regeln,
): boolean {
  const alt13 = regeln.ahv.dreizehnteRente.divisor;
  const jahrAlt = altersrenteMonat * (12 + 12 / alt13) + rentenzuschlagMonat * 12;
  return witwenrenteMonat_ * 12 > jahrAlt;
}

/**
 * Jahresrente der PK-Ehegattenrente aus einer Alters- bzw. Invalidenrente: 60 % (Art. 21 BVG).
 * Vor dem Rentenalter: Invalidenrente = (Altersguthaben + Altersgutschriften bis zum Rentenalter ohne Zinsen) ×
 * Umwandlungssatz (Art. 24 BVG).
 */
export function pkEhegattenrenteJahr(basisRenteJahr: number, regeln: Regeln): number {
  return Math.max(0, basisRenteJahr) * regeln.todesfall.bvgEhegattenrente.anteil;
}

/** Projektion der Invalidenrente (Jahr) für den Todesfall einer aktiven versicherten Person. */
export function pkInvalidenrenteJahr(
  guthaben: number,
  sparbeitragJahr: number,
  jahreBisRentenalter: number,
  umwandlungssatz: number,
): number {
  return Math.max(0, guthaben + Math.max(0, sparbeitragJahr) * Math.max(0, jahreBisRentenalter)) * umwandlungssatz;
}
