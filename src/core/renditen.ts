/**
 * Rendite- und Inflationsmodelle. Die Simulation fragt pro Jahresindex t (0 = Startjahr)
 * nominale Rendite und Inflation ab. Deterministisch hier; Krisen-Replay in krisen.ts,
 * Monte Carlo (wiederkehrende Krisen, Block-Bootstrap) in montecarlo.ts.
 */
import { endlich } from './zahlen';

export interface RenditeModell {
  readonly art: 'deterministisch' | 'historisch' | 'montecarlo';
  /** Nominale Rendite Wertschriften (und ohne `wohneigentum` auch Wohneigentum) */
  renditeNominal(t: number): number;
  inflation(t: number): number;
  /** Optional: nominale Wertänderung Wohneigentum (sonst `renditeNominal`) */
  wohneigentum?(t: number): number;
  /** Optional: nominaler Zins Bargeld (sonst `annahmen.renditeBargeld`) */
  bargeld?(t: number): number;
  /** Optional: abgespieltes historisches Jahr (Krisenszenario), für die Anzeige */
  historisch?(t: number): {
    land: string;
    jahr: number;
    krise: string;
    name?: string;
    kurz?: string;
    /** Erster und letzter Krisenmonat im Kalenderjahr (1–12). Fehlt = ganzes Jahr. */
    monatVon?: number;
    monatBis?: number;
  } | null;
}

export function deterministisch(renditeNominal: number, inflation: number): RenditeModell {
  return { art: 'deterministisch', renditeNominal: () => renditeNominal, inflation: () => inflation };
}

/** Reale Nettorendite: (1 + r − Kosten) / (1 + i) − 1 */
export function realeNettorendite(renditeNominal: number, kosten: number, inflation: number): number {
  return (1 + endlich(renditeNominal) - endlich(kosten)) / (1 + endlich(inflation)) - 1;
}
