/**
 * Wegzug ins Ausland – Architektur (noch nicht gerechnet).
 * Vorgesehen: Quellensteuer auf PK-/3a-Leistungen (Bund + Sitzkanton der Vorsorge-
 * einrichtung), DBA-Rückforderbarkeit (ESTV RS 2-217), Art. 25f FZG, Wegfall der
 * CH-Einkommens-/Vermögenssteuer, Länderdaten aus data/laender-<jahr>.json.
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
