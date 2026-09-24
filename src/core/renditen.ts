/**
 * Rendite- und Inflationsmodelle. Die Simulation fragt pro Jahresindex t (0 = Startjahr)
 * nominale Rendite und Inflation ab. Deterministisch ist implementiert; historischer
 * Replay und Monte Carlo folgen (gleiches Interface).
 */
export interface RenditeModell {
  readonly art: 'deterministisch' | 'historisch' | 'montecarlo';
  renditeNominal(t: number): number;
  inflation(t: number): number;
}

export function deterministisch(renditeNominal: number, inflation: number): RenditeModell {
  return { art: 'deterministisch', renditeNominal: () => renditeNominal, inflation: () => inflation };
}

/** Reale Nettorendite: (1 + r − Kosten) / (1 + i) − 1 */
export function realeNettorendite(renditeNominal: number, kosten: number, inflation: number): number {
  return (1 + renditeNominal - kosten) / (1 + inflation) - 1;
}

export interface HistorischeReihe {
  land: string;
  quelle: string;
  lizenz: string;
  /** [Jahr, Aktien TR, Obligationen TR, Geldmarkt, Inflation] */
  zeilen: [number, number, number, number, number][];
}

/** Historischer Replay ab Startjahr – Stub, folgt im nächsten Schritt. */
export function historischerReplay(_reihe: HistorischeReihe, _startjahr: number): RenditeModell {
  throw new Error('Historischer Replay ist noch nicht implementiert.');
}
