/** Direkte Bundessteuer (DBG) – reine Funktionen. */
import type { Regeln } from '../rules';
import type { Zivilstand } from './typen';

type SteuerRegeln = Regeln['steuern'];
type Tarif = SteuerRegeln['dbgTarifAlleinstehend'];

/** Steuerbares Einkommen auf volle 100 Fr. abrunden (ESTV RS 2-216). */
export function rundeEinkommen(betrag: number, r: SteuerRegeln): number {
  return Math.floor(Math.max(0, betrag) / r.rundungEinkommen) * r.rundungEinkommen;
}

/** Wendet einen Tarif nach Art. 36 DBG auf ein bereits gerundetes Einkommen an. */
export function wendeTarifAn(einkommen: number, t: Tarif): number {
  if (einkommen >= t.proportionalAb) return einkommen * t.proportionalSatz;
  if (einkommen < t.steuerfreiBis) return 0;
  let stufe = t.stufen[0];
  for (const s of t.stufen) if (einkommen >= s.ab) stufe = s;
  if (!stufe) return 0;
  return stufe.basis + (einkommen - stufe.ab) * stufe.satz;
}

const tarifFuer = (z: Zivilstand, r: SteuerRegeln): Tarif =>
  z === 'verheiratet' ? r.dbgTarifVerheiratet : r.dbgTarifAlleinstehend;

/** Rundet einen Steuerbetrag auf 5 Rappen (Darstellung). */
export const runde5Rp = (x: number): number => Math.round(x * 20) / 20;

/**
 * Bundessteuer auf dem Einkommen (Tarif 2026). Kinderabzug vom Steuerbetrag
 * (nur Verheirateten-/Elterntarif, vereinfacht).
 */
export function dbgEinkommen(steuerbar: number, zivilstand: Zivilstand, r: SteuerRegeln, kinder = 0): number {
  const e = rundeEinkommen(steuerbar, r);
  const steuer = wendeTarifAn(e, tarifFuer(zivilstand, r)) - kinder * r.dbgAbzugProKind;
  return runde5Rp(Math.max(0, steuer));
}

/**
 * Bundessteuer auf Kapitalleistungen aus Vorsorge (Art. 38 DBG): 1/5 des Tarifs.
 * `betrag` = Summe aller Kapitalleistungen des Kalenderjahres (bei Ehepaaren beider).
 */
export function dbgKapital(betrag: number, zivilstand: Zivilstand, r: SteuerRegeln): number {
  const e = rundeEinkommen(betrag, r);
  return runde5Rp(wendeTarifAn(e, tarifFuer(zivilstand, r)) / r.dbgKapitalleistungDivisor);
}
