/**
 * Quellensteuer auf Kapitalleistungen aus Vorsorge (PK, Freizügigkeit, Säule 3a) an Personen mit
 * Wohnsitz im Ausland: Bund nach Art. 95/96 DBG mit dem Teilbetragstarif von Art. 19 und Anhang
 * Ziff. 3 QStV (rules: steuern.quellensteuer.kapitalBund*) plus
 * kantonale Quellensteuer des Sitzkantons der Vorsorgeeinrichtung (ESTV-Übersicht, gültig ab
 * 1.1.2026 – rules: steuern.quellensteuerVorsorgeKapitalKantone).
 *
 * Kantone mit nur publizierter Bandbreite («progressiv»): Näherung über den Durchschnittssatz der
 * ordentlichen Kapitalleistungssteuer des Kantons (Hauptort), begrenzt auf die Bandbreite.
 */
import type { Regeln } from '../rules';
import type { KantonsSteuerModell } from './kantone';
import type { Zivilstand } from './typen';

export type QstKantonTarif =
  | { art: 'flach'; satz: number; inklBund?: boolean }
  | { art: 'stufen'; stufen: [number | null, number][]; abzugVerheiratet?: number }
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
