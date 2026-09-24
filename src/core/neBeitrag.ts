/** AHV/IV/EO-Beiträge für Nichterwerbstätige (MB 2.03) – reine Funktionen. */
import type { Regeln } from '../rules';

type NeRegeln = Regeln['beitraege']['nichterwerbstaetige'];
/** Beitragstabelle (gleicher Aufbau für obligatorische und freiwillige Versicherung). */
export type BeitragsTabelle = NeRegeln['tabelle'];

/** Bemessungsgrundlage: Vermögen + 20 × Renteneinkommen; Verheiratete je die Hälfte. */
export function neBemessung(vermoegen: number, renteneinkommenJahr: number, verheiratet: boolean, r: NeRegeln): number {
  const basis = Math.max(0, vermoegen) + r.bemessung.rentenFaktor * Math.max(0, renteneinkommenJahr);
  return verheiratet && r.bemessung.verheirateteHaelftig ? basis / 2 : basis;
}

/** Jahresbeitrag gemäss Tabelle 2026 (ohne Verwaltungskosten). */
export function neBeitragTabelle(bemessung: number, r: NeRegeln): number {
  return beitragAusTabelle(bemessung, r.tabelle);
}

/**
 * Jahresbeitrag aus einer Beitragstabelle: Bemessung auf die nächsttiefere Stufe
 * abgerundet (Art. 28 Abs. 3 AHVV), ohne Verwaltungskosten.
 */
export function beitragAusTabelle(bemessung: number, t: BeitragsTabelle): number {
  if (bemessung < t.untergrenze) return t.minimalbeitrag;
  if (bemessung < t.grenzeStufe2) {
    const n = Math.floor((bemessung - t.untergrenze) / t.schritt);
    return t.beitragAbUntergrenze + n * t.zuschlagStufe1;
  }
  const beiGrenze = t.beitragAbUntergrenze + ((t.grenzeStufe2 - t.untergrenze) / t.schritt) * t.zuschlagStufe1;
  const n = Math.floor((bemessung - t.grenzeStufe2) / t.schritt);
  return Math.min(t.maximalbeitrag, beiGrenze + n * t.zuschlagStufe2);
}

/**
 * NE-Beitrag pro Jahr inkl. Verwaltungskosten.
 * @param vermoegen Vermögen ohne 2. Säule/3a (bei Ehepaaren: eheliches Gesamtvermögen)
 * @param renteneinkommenJahr Renteneinkommen (bei Ehepaaren: beider Ehegatten)
 * @param verwaltungskosten Zuschlag (max. 5%)
 */
export function neBeitrag(
  vermoegen: number,
  renteneinkommenJahr: number,
  verheiratet: boolean,
  verwaltungskosten: number,
  r: NeRegeln,
): number {
  const vk = Math.min(Math.max(verwaltungskosten, 0), r.verwaltungskostenMax);
  return neBeitragTabelle(neBemessung(vermoegen, renteneinkommenJahr, verheiratet, r), r) * (1 + vk);
}

/**
 * Befreiung: Beiträge gelten als bezahlt, wenn der erwerbstätige Ehegatte mind. den
 * doppelten Mindestbeitrag entrichtet (AN- + AG-Beiträge, Annahme).
 */
export function neBefreitDurchEhegatte(lohnEhegatteJahr: number, beitragssatzTotal: number, r: NeRegeln): boolean {
  return lohnEhegatteJahr * beitragssatzTotal >= r.befreiungEhegatteMindestbeitrag;
}
