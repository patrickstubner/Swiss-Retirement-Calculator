/**
 * Die 26 Kantone mit Steuerdaten 2026 aus data/kantone-2026.json (Recherche siehe docs/kantone.md).
 * ZH und AG: exakt (inkl. aller Gemeinde- und Kirchensteuerfüsse). Übrige: Näherung über
 * effektive Referenzsätze des Hauptorts (ESTV-Steuerrechner 2026).
 */
import kantoneJson from '../../data/kantone-2026.json';
import { effektiveSaetze, type KantonsSteuerModell } from '../core/kantone';
import { agModell, type KantonsDaten, naeherungsModell, zhModell } from '../core/kantonsTarife';
import type { KantonSteuerEingabe } from '../core/typen';

export const KANTONS_DATEN = kantoneJson as unknown as KantonsDaten;

export type KantonDatenStatus = 'exakt' | 'naeherung';

export interface Kanton {
  code: string;
  name: string;
  status: KantonDatenStatus;
  hauptort: string;
  /** Beschreibung der Kapitalleistungsregel (Kantonsblatt ESTV) */
  kapitalMethode: string;
}

export const KANTONE: readonly Kanton[] = KANTONS_DATEN.kantone
  .map((k) => ({
    code: k.code,
    name: k.name,
    status: (k.status === 'exakt' ? 'exakt' : 'naeherung') as KantonDatenStatus,
    hauptort: k.hauptort.name,
    kapitalMethode: k.kapitalleistung.methode,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));

export const kantonNach = (code: string): Kanton | undefined => KANTONE.find((k) => k.code === code);

/** Gemeinden mit exakten Steuerfüssen (nur ZH und AG). */
export function gemeindenVon(code: string): string[] {
  const liste =
    code === 'ZH'
      ? KANTONS_DATEN.zh.gemeindesteuerfuesse.gemeinden.map((g) => g.name)
      : code === 'AG'
        ? KANTONS_DATEN.ag.gemeindesteuerfuesse.gemeinden.map((g) => g.name)
        : [];
  return [...liste].sort((a, b) => a.localeCompare(b, 'de-CH'));
}

export const KANTON_STATUS_TEXT: Record<KantonDatenStatus, string> = {
  exakt: 'Exakt: kantonaler Tarif 2026 mit Gemeinde- und Kirchensteuerfuss (validiert mit dem ESTV-Steuerrechner)',
  naeherung: 'Näherung: effektive Sätze des Kantonshauptorts (ESTV-Steuerrechner 2026)',
};

/** Steuermodell für die Eingabe: eigene Sätze, exakter Tarif (ZH/AG) oder Näherung. */
export function kantonsModellFuer(e: KantonSteuerEingabe): KantonsSteuerModell {
  if (e.eigeneSaetze || !e.kanton) return effektiveSaetze(e);
  if (e.kanton === 'ZH') return zhModell(KANTONS_DATEN.zh, e.gemeinde || 'Zürich', e.kirche);
  if (e.kanton === 'AG') return agModell(KANTONS_DATEN.ag, e.gemeinde || 'Aarau', e.kirche);
  const k = KANTONS_DATEN.kantone.find((x) => x.code === e.kanton);
  return k ? naeherungsModell(k) : effektiveSaetze(e);
}
