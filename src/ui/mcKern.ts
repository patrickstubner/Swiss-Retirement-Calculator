/**
 * Monte-Carlo-Kurzfassung für den Szenario-Vergleich. Eigene Datei ohne React und ohne Zustand, damit sie im
 * Web-Worker (`mc.worker.ts`) und in Tests gleich läuft.
 */
import { type MonteCarloEinstellung, type MonteCarloErgebnis, monteCarlo } from '../core/montecarlo';
import type { Haushalt, Monat } from '../core/typen';
import { KRISEN_DATEN, mcKrisenPool, STANDARD_KRISEN_PRO_DEKADE } from '../data/krisen';
import { ladeRegeln, type Regeln } from '../rules';

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

/** Einstellung der vollen Monte-Carlo-Rechnung ohne Krisenpool (der Pool ist fest und wird im Worker gebildet) */
export type McEinstellung = MonteCarloEinstellung;

/** Anfrage an den Worker (Strukturkopie, nur Daten) */
export type McNachricht =
  | { art: 'vergleich'; id: number; jahr: number; monat: number; haushalte: Haushalt[]; laeufe: number }
  | { art: 'voll'; id: number; jahr: number; monat: number; haushalt: Haushalt; einstellung: McEinstellung };

export type McRueckmeldung =
  | { art: 'vergleich'; id: number; ergebnisse: McKurz[] }
  | { art: 'fortschritt'; id: number; fertig: number; von: number }
  | { art: 'voll'; id: number; ergebnis: MonteCarloErgebnis }
  | { art: 'fehler'; id: number; fehler: string };

/** Volle Monte-Carlo-Rechnung mit festem Krisenpool und Schweizer/US-Daten (gleich im Worker und im Hauptthread) */
export function vollMonteCarlo(
  h: Haushalt,
  regeln: Regeln,
  heute: Monat,
  e: McEinstellung,
  fortschritt?: (fertig: number, von: number) => void,
): MonteCarloErgebnis {
  return monteCarlo(h, regeln, heute, e, KRISEN_DATEN, mcKrisenPool(), fortschritt);
}

/**
 * Bearbeitet eine Anfrage und meldet über `senden` zurück (Fortschritt, Ergebnis, Fehler). Eine einzige Stelle für
 * den Worker und den Ersatz im Hauptthread, damit beide dasselbe rechnen.
 */
export function bearbeiteMcNachricht(n: McNachricht, senden: (m: McRueckmeldung) => void): void {
  try {
    const regeln = ladeRegeln(n.jahr);
    const heute: Monat = { jahr: n.jahr, monat: n.monat };
    if (n.art === 'vergleich') {
      const ergebnisse = n.haushalte.map((h) => vergleichsMonteCarlo(h, regeln, heute, n.laeufe));
      senden({ art: 'vergleich', id: n.id, ergebnisse });
    } else {
      const ergebnis = vollMonteCarlo(n.haushalt, regeln, heute, n.einstellung, (fertig, von) =>
        senden({ art: 'fortschritt', id: n.id, fertig, von }),
      );
      senden({ art: 'voll', id: n.id, ergebnis });
    }
  } catch (x) {
    senden({ art: 'fehler', id: n.id, fehler: x instanceof Error ? x.message : String(x) });
  }
}
