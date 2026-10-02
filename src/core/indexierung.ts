import type { Indexierung } from './typen';
import { endlich } from './zahlen';

/**
 * Realer Betrag (heutige Kaufkraft) im Jahresindex t für einen heute gültigen Betrag.
 * @param deflator kumulierte CH-Teuerung seit Start (Π(1+i))
 */
export function realerBetrag(betragRoh: number, ix: Indexierung, tRoh: number, deflatorRoh: number): number {
  const betragHeute = endlich(betragRoh);
  const t = endlich(tRoh);
  const deflator = endlich(deflatorRoh, 1) || 1;
  switch (ix.art) {
    case 'teuerung':
      return betragHeute;
    case 'keine':
      return betragHeute / deflator;
    case 'satz':
      return (betragHeute * (1 + endlich(ix.satz)) ** t) / deflator;
  }
}
