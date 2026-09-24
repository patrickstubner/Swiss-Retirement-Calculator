/** Ausländische Renten – reine Funktionen. */
import type { AuslandRente } from './typen';

/**
 * Realer Jahresbetrag in CHF (heutige Kaufkraft) im Jahresindex t, wenn die Rente läuft.
 * Annahmen: Wechselkurs real konstant (Kaufkraftparität), Betrag heute nominal.
 * @param deflator kumulierte CH-Teuerung seit Start (Π(1+i))
 */
export function auslandRenteRealJahr(rente: AuslandRente, t: number, deflator: number): number {
  const nominalHeute = rente.betrag * rente.zahlungenProJahr * rente.wechselkursChf;
  switch (rente.indexierung.art) {
    case 'teuerung':
      return nominalHeute;
    case 'keine':
      return nominalHeute / deflator;
    case 'satz':
      return (nominalHeute * (1 + rente.indexierung.satz) ** t) / deflator;
  }
}

export function pruefeAuslandRente(r: AuslandRente): string[] {
  const h: string[] = [];
  if (r.betrag < 0) h.push('Betrag darf nicht negativ sein.');
  if (r.wechselkursChf <= 0) h.push('Wechselkurs muss grösser als 0 sein.');
  if (r.zahlungenProJahr < 1 || r.zahlungenProJahr > 14) h.push('Zahlungen pro Jahr: 1–14.');
  if (r.startAlter < 0 || r.startAlter > 120) h.push('Startalter unplausibel.');
  return h;
}
