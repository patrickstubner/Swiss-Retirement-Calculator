/**
 * Quellensteuer auf Kapitalleistungen aus Vorsorge (PK, Freizügigkeit, Säule 3a) an Personen mit
 * Wohnsitz im Ausland: Bund nach Art. 95/96 DBG mit dem Teilbetragstarif von Art. 19 und Anhang
 * Ziff. 3 QStV (rules: steuern.quellensteuer.kapitalBund*) plus
 * kantonale Quellensteuer des Sitzkantons der Vorsorgeeinrichtung (ESTV-Übersicht, gültig ab
 * 1.1.2026 – rules: steuern.quellensteuerVorsorgeKapitalKantone).
 *
 * Progressive Kantonstarife (AG, BL, GE, JU, NE, SO, VS, VD) exakt aus den ESTV-Tarifdateien 2026
 * («tabelle», data/qst-kapital-kantone-2026.json): Satz der Stufe auf dem ganzen Bruttobetrag,
 * inklusive Bundesteil. Die Näherung «progressiv» (Durchschnittssatz des ordentlichen Kantonsmodells,
 * begrenzt auf die Bandbreite) bleibt nur als Rückfall für künftige Kantone ohne Tarifdatei.
 *
 * Renten aus Vorsorge an Personen im Ausland: Satz des Sitzkantons inkl. 1 % DBSt
 * (rules: steuern.quellensteuerVorsorgeRentenKantone), nur wo kein DBA das Besteuerungsrecht dem
 * Wohnsitzstaat zuweist.
 */
import tarifDatei from '../../data/qst-kapital-kantone-2026.json';
import type { Regeln } from '../rules';
import type { KantonsSteuerModell } from './kantone';
import type { Zivilstand } from './typen';

export type QstKantonTarif =
  | { art: 'flach'; satz: number; inklBund?: boolean }
  | { art: 'stufen'; stufen: [number | null, number][]; abzugVerheiratet?: number }
  | { art: 'tabelle'; inklBund: boolean; freigrenze?: number }
  | {
      art: 'progressiv';
      min: number;
      max: number | null;
      minVerheiratet?: number;
      maxVerheiratet?: number;
    };

export interface QuellensteuerKapital {
  bund: number;
  kanton: number;
  total: number;
  /** Kantonsteil nur als Näherung (progressiver Tarif ohne publizierte Einzelwerte, oder Kanton unbekannt) */
  naeherung: boolean;
  /** Verwendeter Sitzkanton ('' = unbekannt) */
  kantonCode: string;
}

export function qstKantonTarif(regeln: Regeln, kanton: string): QstKantonTarif | undefined {
  const tarife = regeln.steuern.quellensteuerVorsorgeKapitalKantone as unknown as Record<string, QstKantonTarif>;
  return tarife[kanton];
}

type Tabelle = readonly (readonly [number, number])[];
const TABELLEN = tarifDatei.kantone as unknown as Record<string, { alleinstehend: Tabelle; verheiratet: Tabelle }>;

/** Satz aus einer ESTV-Tariftabelle ([ab Fr., Basispunkte]); undefined = Kanton ohne Tabelle. */
export function tabellenSatz(kanton: string, betrag: number, zivilstand: Zivilstand): number | undefined {
  const t = TABELLEN[kanton];
  if (!t) return undefined;
  const zeilen = zivilstand === 'verheiratet' ? t.verheiratet : t.alleinstehend;
  let bp = 0;
  for (const [ab, satz] of zeilen) {
    if (betrag >= ab) bp = satz;
    else break;
  }
  return bp / 10_000;
}

/** Teilbetragstarif (Grenzsätze je Stufe). */
export function stufenSteuer(betrag: number, stufen: readonly [number | null, number][]): number {
  let steuer = 0;
  let unten = 0;
  for (const [bis, satz] of stufen) {
    const oben = bis ?? Number.POSITIVE_INFINITY;
    if (betrag <= unten) break;
    steuer += (Math.min(betrag, oben) - unten) * satz;
    unten = oben;
  }
  return steuer;
}

/** Bundesteil (QStV Anhang Ziff. 3): Grenzsätze je Teilbetrag. */
export function quellensteuerBundKapital(betrag: number, zivilstand: Zivilstand, regeln: Regeln): number {
  const q = regeln.steuern.quellensteuer;
  const tarif = zivilstand === 'verheiratet' ? q.kapitalBundVerheiratet : q.kapitalBundAlleinstehend;
  return stufenSteuer(
    Math.max(0, betrag),
    tarif.map((s) => [s.bis, s.satz] as [number | null, number]),
  );
}

/**
 * Quellensteuer auf eine Kapitalleistung.
 * @param ordentlich Kantonsmodell des Sitzkantons (für die Näherung bei progressiven Tarifen)
 */
export function quellensteuerKapital(
  betrag: number,
  zivilstand: Zivilstand,
  kanton: string,
  regeln: Regeln,
  ordentlich: KantonsSteuerModell | undefined,
): QuellensteuerKapital {
  if (!(betrag > 0)) return { bund: 0, kanton: 0, total: 0, naeherung: false, kantonCode: kanton };
  const t = qstKantonTarif(regeln, kanton);
  const verh = zivilstand === 'verheiratet';
  const bundOrdentlich = quellensteuerBundKapital(betrag, zivilstand, regeln);
  let kSteuer = 0;
  let bund = bundOrdentlich;
  let naeherung = false;
  if (!t) {
    // Kanton unbekannt: ordentliche Kapitalleistungssteuer des Modells (Näherung)
    kSteuer = ordentlich ? ordentlich.kapitalleistungssteuer(betrag, zivilstand) : 0;
    naeherung = true;
  } else if (t.art === 'flach') {
    kSteuer = betrag * t.satz;
    if (t.inklBund) bund = 0;
  } else if (t.art === 'tabelle') {
    const satz = betrag < (t.freigrenze ?? 0) ? 0 : tabellenSatz(kanton, betrag, zivilstand);
    if (satz === undefined) {
      kSteuer = ordentlich ? ordentlich.kapitalleistungssteuer(betrag, zivilstand) : 0;
      naeherung = true;
    } else {
      // Gesamtsatz inkl. Bundesteil: Kantonsteil = Gesamt − Bundestarif (nie negativ)
      const gesamt = betrag * satz;
      if (t.inklBund) {
        bund = Math.min(bundOrdentlich, gesamt);
        kSteuer = gesamt - bund;
      } else kSteuer = gesamt;
    }
  } else if (t.art === 'stufen') {
    kSteuer = stufenSteuer(Math.max(0, betrag - (verh ? (t.abzugVerheiratet ?? 0) : 0)), t.stufen);
  } else {
    const min = verh ? (t.minVerheiratet ?? t.min) : t.min;
    const max = verh ? (t.maxVerheiratet ?? t.max) : t.max;
    const satzOrdentlich = ordentlich ? ordentlich.kapitalleistungssteuer(betrag, zivilstand) / betrag : min;
    const satz = Math.min(Math.max(satzOrdentlich, min), max ?? Number.POSITIVE_INFINITY);
    kSteuer = betrag * satz;
    naeherung = true;
  }
  return { bund, kanton: kSteuer, total: bund + kSteuer, naeherung, kantonCode: kanton };
}

/** Quellensteuersatz auf Vorsorgerenten (inkl. 1 % DBSt) des Sitzkantons; undefined = unbekannt. */
export function quellensteuerRenteSatz(regeln: Regeln, kanton: string, renteJahr: number): number | undefined {
  const map = regeln.steuern.quellensteuerVorsorgeRentenKantone as unknown as Record<
    string,
    number | [number | null, number][]
  >;
  const s = map[kanton];
  if (s === undefined) return undefined;
  if (typeof s === 'number') return s;
  for (const [bis, satz] of s) if (bis === null || renteJahr <= bis) return satz;
  return 0;
}
