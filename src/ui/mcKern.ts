/**
 * Monte-Carlo-Kurzfassung für den Szenario-Vergleich. Eigene Datei ohne React und ohne Zustand, damit sie im
 * Web-Worker (`mc.worker.ts`) und in Tests gleich läuft.
 */
import { monteCarlo } from '../core/montecarlo';
import type { Haushalt, Monat } from '../core/typen';
import { KRISEN_DATEN, mcKrisenPool, STANDARD_KRISEN_PRO_DEKADE } from '../data/krisen';
import type { Regeln } from '../rules';

/** Läufe des Monte Carlo im Vergleich (Rechenzeit): die Einstellung der Version, höchstens 500. */
export const VERGLEICH_MC_MAX = 500;
export const VERGLEICH_MC_MIN = 50;

/** Anzahl Läufe begrenzen (Rechenzeit). */
export const vergleichsLaeufe = (n: number): number =>
  Math.min(VERGLEICH_MC_MAX, Math.max(VERGLEICH_MC_MIN, Math.round(n)));

export interface McKurz {
  erfolgsquote: number;
  /** Alter der Referenzperson, bis zu dem das Geld in 90 % der Läufe reicht (null = bis zum Planungsalter) */
  reichtBisAlterP10: number | null;
  laeufe: number;
}

/**
 * Monte Carlo einer Version in Kurzfassung. Gleicher Seed und gleiche Einstellungen wie die übrige App (Art, Krisen
 * pro Dekade, Blocklänge aus den Krisen-Einstellungen der Version), damit beide Versionen mit denselben
 * Zufallspfaden verglichen werden. Läuft im Web-Worker (`mc.worker.ts`); ohne Worker im Hauptthread, verzögert.
 */
export function vergleichsMonteCarlo(effH: Haushalt, regeln: Regeln, heute: Monat, laeufeVorgabe?: number): McKurz {
  const k = effH.krisen;
  const laeufe = vergleichsLaeufe(laeufeVorgabe ?? k.mcLaeufe);
  const m = monteCarlo(
    effH,
    regeln,
    heute,
    {
      art: k.mcArt,
      laeufe,
      seed: 20260927,
      krisenProDekade: k.mcKrisenProDekade ?? STANDARD_KRISEN_PRO_DEKADE,
      blockLaenge: k.mcBlockLaenge,
      bootstrapLand: 'CHE',
    },
    KRISEN_DATEN,
    mcKrisenPool(),
  );
  return { erfolgsquote: m.erfolgsquote, reichtBisAlterP10: m.reichtBisAlterP10, laeufe: m.laeufe };
}
