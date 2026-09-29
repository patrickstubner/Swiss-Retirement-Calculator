/**
 * Grundstückgewinnsteuer beim Verkauf einer Liegenschaft (Privatvermögen, monistisch).
 * - ZH: § 225 StG ZH, Tarif mit Zuschlag bei kurzer und Ermässigung bei langer Besitzdauer
 *   (Zürcher Steuerbuch Nr. 225.1, Fassung 09/2025); Gewinne unter CHF 5 000 steuerfrei.
 * - AG: § 109 StG AG, proportionaler Satz nach vollendeten Besitzjahren (40 % … 5 %).
 * - Übrige Kantone: nicht hinterlegt (OFFEN) → eigener effektiver Satz oder Näherung mit dem
 *   Tarif ZH (klar gekennzeichnet).
 * Die Steuer schuldet der Kanton, in dem das Grundstück liegt – auch nach einem Wegzug ins Ausland.
 * Alle Beträge nominal (Gesetzestarif, nicht an die Teuerung angepasst).
 */
import type { Regeln } from '../rules';

export type GgstArt = 'ZH' | 'AG' | 'eigenerSatz' | 'naeherungZH';

/** Volle Besitzjahre zwischen Kauf- und Verkaufsmonat (Monatsindex jahr × 12 + monat − 1) */
export function volleBesitzjahre(kaufIdx: number, verkaufIdx: number): number {
  return Math.max(0, Math.floor((verkaufIdx - kaufIdx) / 12));
}

/** Grundstückgewinnsteuer ZH (§ 225 StG) auf dem Gewinn `gewinn` bei `jahre` vollen Besitzjahren */
export function ggstZH(gewinn: number, jahre: number, monate: number, regeln: Regeln): number {
  const t = regeln.wohneigentum.grundstueckgewinnsteuerZH;
  if (!(gewinn >= t.freigrenze)) return 0;
  let rest = gewinn;
  let steuer = 0;
  for (const stufe of t.stufen) {
    const teil = stufe[0] ?? null;
    const satz = stufe[1] ?? 0;
    const x = teil === null ? rest : Math.min(rest, teil);
    steuer += x * satz;
    rest -= x;
    if (rest <= 0) break;
  }
  // Zuschlag bei weniger als 1 bzw. 2 Jahren (anrechenbare Besitzdauer in Monaten)
  if (monate < 12) return steuer * (1 + t.zuschlagUnter1Jahr);
  if (monate < 24) return steuer * (1 + t.zuschlagUnter2Jahren);
  if (jahre >= 5)
    return (
      steuer * (1 - Math.min(t.ermaessigungMax, t.ermaessigungAb5Jahren + (jahre - 5) * t.ermaessigungProWeiteresJahr))
    );
  return steuer;
}

/** Grundstückgewinnsteuer AG (§ 109 StG AG): proportionaler Satz nach vollendeten Besitzjahren */
export function ggstSatzAG(jahre: number, regeln: Regeln): number {
  const s = regeln.wohneigentum.grundstueckgewinnsteuerAG.saetzeNachVollenJahren as readonly number[];
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(jahre)))] as number;
}

export interface GgstErgebnis {
  steuer: number;
  art: GgstArt;
}

/**
 * Steuer auf dem Grundstückgewinn (nominal). `kanton` = Lage des Grundstücks (im Rechner: Wohnkanton).
 * `eigenerSatz` (effektiver Satz auf dem Gewinn) hat Vorrang vor dem Tarif.
 */
export function grundstueckgewinnsteuer(
  gewinn: number,
  kaufIdx: number,
  verkaufIdx: number,
  kanton: string,
  eigenerSatz: number | null,
  regeln: Regeln,
): GgstErgebnis {
  const monate = Math.max(0, verkaufIdx - kaufIdx);
  const jahre = volleBesitzjahre(kaufIdx, verkaufIdx);
  const g = Math.max(0, gewinn);
  if (eigenerSatz !== null) return { steuer: g * Math.max(0, eigenerSatz), art: 'eigenerSatz' };
  if (kanton === 'AG') return { steuer: g * ggstSatzAG(jahre, regeln), art: 'AG' };
  return { steuer: ggstZH(g, jahre, monate, regeln), art: kanton === 'ZH' ? 'ZH' : 'naeherungZH' };
}
