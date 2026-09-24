/**
 * Kantons- und Gemeindesteuern – Architektur.
 * MVP: effektive Sätze als Nutzereingabe. Später: tarifbasierte Modelle pro Kanton aus
 * versionierten Daten (data/kantone-<jahr>.json), die dasselbe Interface implementieren.
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

/**
 * Register für tarifbasierte Kantonsmodelle (folgt im nächsten Schritt).
 * Gibt undefined zurück, solange für den Kanton keine verifizierten Daten vorliegen.
 * TODO(kantone): ZH und AG exakt aus data/kantone-2026.json (siehe src/data/kantone.ts).
 */
export function kantonsModell(_kanton: string, _jahr: number): KantonsSteuerModell | undefined {
  return undefined;
}

/** Modellwahl: tarifbasiert, falls vorhanden, sonst effektive Sätze. */
export function waehleKantonsModell(e: KantonSteuerEingabe, jahr: number): KantonsSteuerModell {
  return kantonsModell(e.kanton, jahr) ?? effektiveSaetze(e);
}
