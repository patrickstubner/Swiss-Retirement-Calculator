/**
 * Vergleich der Steuer auf Kapitalleistungen aus Vorsorge (PK, Freizügigkeit, 3a) über alle 26 Kantone.
 *
 * Zwei getrennte Fälle (Quellen: docs/quellen.md Abschnitt 16):
 * (a) Wohnsitz in der Schweiz bei Fälligkeit: ordentliche, separate Jahressteuer des WOHNkantons (Art. 4b Abs. 1 und
 *     Art. 11 Abs. 3 StHG) plus direkte Bundessteuer (Art. 38 DBG). Der Sitz der Vorsorgeeinrichtung ist ohne Belang.
 * (b) Wohnsitz im Ausland bei Fälligkeit: Quellensteuer des SITZkantons der Einrichtung (Art. 4 Abs. 2 lit. e, Art. 35
 *     Abs. 1 lit. g StHG; Art. 96 DBG): Bund nach QStV plus kantonaler Tarif (ESTV-Übersicht 2026).
 *
 * Kantonswerte (a): ESTV-Steuerrechner 2026, Hauptort, ohne Kirchensteuer (ZH/AG: exakte Tarife, Hauptort).
 */
import { kantonsModellFuer } from '../data/kantone';
import type { Regeln } from '../rules';
import { quellensteuerKapital } from './quellensteuer';
import { dbgKapital } from './steuern';
import type { KantonSteuerEingabe, Zivilstand } from './typen';

export const KANTONS_CODES = [
  'AG',
  'AI',
  'AR',
  'BE',
  'BL',
  'BS',
  'FR',
  'GE',
  'GL',
  'GR',
  'JU',
  'LU',
  'NE',
  'NW',
  'OW',
  'SG',
  'SH',
  'SO',
  'SZ',
  'TG',
  'TI',
  'UR',
  'VD',
  'VS',
  'ZG',
  'ZH',
] as const;

const eingabeFuer = (kanton: string, basis: KantonSteuerEingabe): KantonSteuerEingabe => ({
  ...basis,
  kanton,
  gemeinde: '',
  kirche: 'keine',
  eigeneSaetze: false,
});

export interface KapitalSteuer {
  kanton: number;
  bund: number;
  total: number;
  /** total / Betrag */
  satz: number;
}

/** (a) Wohnsitz Schweiz: ordentliche Steuer im Wohnkanton (Hauptort, ohne Kirche) + Bund. */
export function kapitalSteuerWohnsitz(
  kanton: string,
  betrag: number,
  zivilstand: Zivilstand,
  regeln: Regeln,
  basis: KantonSteuerEingabe,
): KapitalSteuer {
  if (!(betrag > 0)) return { kanton: 0, bund: 0, total: 0, satz: 0 };
  const k = kantonsModellFuer(eingabeFuer(kanton, basis)).kapitalleistungssteuer(betrag, zivilstand);
  const bund = dbgKapital(betrag, zivilstand, regeln.steuern);
  return { kanton: k, bund, total: k + bund, satz: (k + bund) / betrag };
}

export interface QuellenSteuer extends KapitalSteuer {
  /** Kantonsteil nur als Näherung (Kanton ohne publizierten Tarif) */
  naeherung: boolean;
}

/** (b) Wohnsitz Ausland: Quellensteuer (Bund + Tarif des Sitzkantons der Einrichtung), vor einer allfälligen DBA-Rückerstattung. */
export function kapitalSteuerQuelle(
  sitz: string,
  betrag: number,
  zivilstand: Zivilstand,
  regeln: Regeln,
  basis: KantonSteuerEingabe,
): QuellenSteuer {
  if (!(betrag > 0)) return { kanton: 0, bund: 0, total: 0, satz: 0, naeherung: false };
  const q = quellensteuerKapital(betrag, zivilstand, sitz, regeln, kantonsModellFuer(eingabeFuer(sitz, basis)));
  return { kanton: q.kanton, bund: q.bund, total: q.total, satz: q.total / betrag, naeherung: q.naeherung };
}

export interface KantonsZeile {
  code: string;
  wohnsitz: KapitalSteuer;
  quelle: QuellenSteuer;
}

export function kantonsVergleich(
  betrag: number,
  zivilstand: Zivilstand,
  regeln: Regeln,
  basis: KantonSteuerEingabe,
): KantonsZeile[] {
  return KANTONS_CODES.map((code) => ({
    code,
    wohnsitz: kapitalSteuerWohnsitz(code, betrag, zivilstand, regeln, basis),
    quelle: kapitalSteuerQuelle(code, betrag, zivilstand, regeln, basis),
  }));
}

export type VergleichFall = 'wohnsitz' | 'quelle';

/** Zeilen nach Steuer aufsteigend (Rang 1 = günstigster Kanton). */
export function sortiert(zeilen: readonly KantonsZeile[], fall: VergleichFall): KantonsZeile[] {
  const wert = (z: KantonsZeile) => (fall === 'wohnsitz' ? z.wohnsitz.total : z.quelle.total);
  return [...zeilen].sort((a, b) => wert(a) - wert(b) || a.code.localeCompare(b.code));
}

/** Kandidaten der Strategiekarte «Freizügigkeit in einen Tiefsteuerkanton». */
export const TIEFSTEUER_KANTONE = ['ZG', 'SZ', 'NW'] as const;

export interface StrategieZeile {
  sitz: string;
  /** Fall 1: bleibt in der Schweiz wohnen, nur der Sitz der Einrichtung wechselt → Steuer wie mit dem bisherigen Sitz */
  bleibtInCh: { steuer: number; ersparnis: number };
  /** Fall 2: Bezug nach dem Wegzug – Quellensteuer nach dem Sitz-Tarif; Ersparnis gegenüber dem bisherigen Sitz */
  nachWegzug: { steuer: number; ersparnis: number };
  /** Wohnsitz tatsächlich in diesen Kanton verlegen (ordentliche Steuer dort) – Ersparnis gegenüber dem Wohnkanton */
  wohnsitzVerlegen: { steuer: number; ersparnis: number };
}

/**
 * Strategiekarte: Wirkung eines Sitzes der Freizügigkeitseinrichtung im Tiefsteuerkanton.
 * @param wohnkanton heutiger Wohnkanton (bei Wohnsitz in der Schweiz massgebend)
 * @param bisherigerSitz bisheriger Sitz der Einrichtung ('' = wie Wohnkanton)
 */
export function freizuegigkeitStrategie(
  betrag: number,
  zivilstand: Zivilstand,
  regeln: Regeln,
  basis: KantonSteuerEingabe,
  wohnkanton: string,
  bisherigerSitz: string,
  kandidaten: readonly string[] = TIEFSTEUER_KANTONE,
): StrategieZeile[] {
  const heuteCh = kapitalSteuerWohnsitz(wohnkanton, betrag, zivilstand, regeln, basis).total;
  const heuteQst = kapitalSteuerQuelle(bisherigerSitz || wohnkanton, betrag, zivilstand, regeln, basis).total;
  return kandidaten.map((sitz) => {
    const qst = kapitalSteuerQuelle(sitz, betrag, zivilstand, regeln, basis).total;
    const wohn = kapitalSteuerWohnsitz(sitz, betrag, zivilstand, regeln, basis).total;
    return {
      sitz,
      // Art. 4b Abs. 1 StHG: der Sitz zählt bei Wohnsitz in der Schweiz nicht
      bleibtInCh: { steuer: heuteCh, ersparnis: 0 },
      nachWegzug: { steuer: qst, ersparnis: heuteQst - qst },
      wohnsitzVerlegen: { steuer: wohn, ersparnis: heuteCh - wohn },
    };
  });
}
