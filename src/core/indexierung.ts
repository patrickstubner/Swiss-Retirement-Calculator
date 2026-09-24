import type { Indexierung } from './typen';

/**
 * Realer Betrag (heutige Kaufkraft) im Jahresindex t für einen heute gültigen Betrag.
 * @param deflator kumulierte CH-Teuerung seit Start (Π(1+i))
 */
export function realerBetrag(betragHeute: number, ix: Indexierung, t: number, deflator: number): number {
  switch (ix.art) {
    case 'teuerung':
      return betragHeute;
    case 'keine':
      return betragHeute / deflator;
    case 'satz':
      return (betragHeute * (1 + ix.satz) ** t) / deflator;
  }
}
