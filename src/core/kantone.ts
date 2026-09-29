/**
 * Kantons- und Gemeindesteuern – Architektur.
 * Tarifbasierte Modelle pro Kanton aus versionierten Daten (data/kantone-<jahr>.json, siehe
 * kantonsTarife.ts) oder effektive Sätze als Nutzereingabe; alle mit demselben Interface.
 */
import type { KantonSteuerEingabe, Zivilstand } from './typen';

export interface KantonsSteuerModell {
  readonly id: string;
  readonly beschreibung: string;
  /** Einkommenssteuer Kanton + Gemeinde (+ ggf. Kirche) */
  einkommenssteuer(steuerbar: number, zivilstand: Zivilstand): number;
  /** Vermögenssteuer auf dem Reinvermögen */
  vermoegenssteuer(vermoegen: number, zivilstand: Zivilstand): number;
  /** Steuer auf Kapitalleistungen aus Vorsorge (Summe des Jahres) */
  kapitalleistungssteuer(betrag: number, zivilstand: Zivilstand): number;
}

/** Vereinfachtes Modell mit effektiven Sätzen (Eingabe, z.B. aus dem ESTV-Steuerrechner). */
export function effektiveSaetze(e: KantonSteuerEingabe): KantonsSteuerModell {
  return {
    id: 'effektiv',
    beschreibung: 'Effektive Sätze (Nutzereingabe)',
    einkommenssteuer: (steuerbar) => Math.max(0, steuerbar) * e.einkommenSatz,
    vermoegenssteuer: (vermoegen) => (Math.max(0, vermoegen) * e.vermoegenPromille) / 1000,
    kapitalleistungssteuer: (betrag) => Math.max(0, betrag) * e.kapitalSatz,
  };
}
