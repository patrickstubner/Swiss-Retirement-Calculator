/**
 * Wegzug ins Ausland – Architektur.
 * Bereits gerechnet (core/simulation.ts, core/quellensteuer.ts): Barauszahlung von PK/FZ/3a
 * beim Wegzug (Art. 5 FZG, Art. 25f FZG, Art. 3 Abs. 2 lit. d BVV 3) und Schweizer Quellensteuer
 * auf Kapitalleistungen nach dem Wegzug (Bund + Sitzkanton der Vorsorgeeinrichtung).
 * Noch offen: DBA-Rückforderung (ESTV RS 2-217, nur als Hinweis aus data/laender-<jahr>.json),
 * Quellensteuer auf Vorsorgerenten, Wegfall der CH-Einkommens-/Vermögenssteuer, Steuern im
 * Wohnsitzstaat.
 */
import type { Wohnsitz, Zivilstand } from './typen';

export interface WegzugsModell {
  readonly land: string;
  /** Schweizer Quellensteuer auf eine Kapitalleistung aus Vorsorge */
  quellensteuerKapital(betrag: number, zivilstand: Zivilstand): number;
  /** Davon gemäss DBA rückforderbar */
  rueckforderbarKapital(betrag: number, zivilstand: Zivilstand): number;
  /** Quellensteuer auf Vorsorgerenten */
  quellensteuerRente(renteJahr: number): number;
  /** Steuern im Wohnsitzstaat (Näherung) */
  steuerWohnsitzstaat(einkommen: number, vermoegen: number): number;
}

/** Liefert das Modell für den Wohnsitz in einem Jahr; undefined = Wohnsitz Schweiz. */
export function wegzugsModell(wohnsitz: Wohnsitz, jahr: number): WegzugsModell | undefined {
  if (!wohnsitz.wegzug || jahr < wohnsitz.wegzug.abJahr) return undefined;
  // Noch nicht implementiert: Länderdaten folgen im nächsten Schritt.
  return undefined;
}

export const WEGZUG_IMPLEMENTIERT = false;
