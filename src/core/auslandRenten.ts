/** Ausländische Renten – reine Funktionen. */
import { realerBetrag } from './indexierung';
import type { AuslandRente } from './typen';

/**
 * Realer Jahresbetrag in CHF (heutige Kaufkraft) im Jahresindex t, wenn die Rente läuft.
 * Annahmen: Wechselkurs real konstant (Kaufkraftparität), Betrag heute nominal.
 * @param deflator kumulierte CH-Teuerung seit Start (Π(1+i))
 */
export function auslandRenteRealJahr(rente: AuslandRente, t: number, deflator: number): number {
  const kurs = rente.wechselkursChf * (1 + (rente.wechselkursAenderung ?? 0)) ** t;
  return realerBetrag(rente.betrag * rente.zahlungenProJahr * kurs, rente.indexierung, t, deflator);
}

/** Nettozufluss nach Steuer im Quellenstaat (Anrechnung in der Schweiz nicht modelliert). */
export function auslandRenteNetto(brutto: number, rente: AuslandRente): number {
  return brutto * (1 - Math.min(1, Math.max(0, rente.quellensteuerSatz ?? 0)));
}

export function pruefeAuslandRente(r: AuslandRente): string[] {
  const h: string[] = [];
  if (r.betrag < 0) h.push('Betrag darf nicht negativ sein.');
  if (r.wechselkursChf <= 0) h.push('Wechselkurs muss grösser als 0 sein.');
  if (r.zahlungenProJahr < 1 || r.zahlungenProJahr > 14) h.push('Zahlungen pro Jahr: 1–14.');
  if (r.startAlter < 0 || r.startAlter > 120) h.push('Startalter unplausibel.');
  if (r.quellensteuerSatz < 0 || r.quellensteuerSatz > 1) h.push('Quellensteuer: 0–100%.');
  return h;
}
