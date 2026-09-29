/**
 * Reine Darstellungslogik der Karte «Kapitalbezug in den Kantonen»: Betragsvorgabe, Texte, Quellen.
 */
import type { Haushalt } from '../core/typen';

export const VERGLEICH_BETRAG_STANDARD = 1_000_000;
export const VERGLEICH_BETRAG_MAX = 20_000_000;

export const KANTONS_QUELLEN: readonly { text: string; url: string; stand: string }[] = [
  {
    text: 'Art. 4b Abs. 1 und Art. 11 Abs. 3 StHG (Wohnsitz bei Fälligkeit, separate Jahressteuer)',
    url: 'https://www.fedlex.admin.ch/eli/cc/1991/1256_1256_1256/de',
    stand: '1.1.2024',
  },
  {
    text: 'Art. 4 Abs. 2 lit. e und Art. 35 Abs. 1 lit. g StHG; Art. 96 DBG (Quellensteuer, Wohnsitz im Ausland)',
    url: 'https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de',
    stand: '1.1.2024',
  },
  {
    text: 'ESTV-Steuerrechner, Kapitalleistungen aus Vorsorge, Kantonshauptorte, ohne Kirchensteuer',
    url: 'https://swisstaxcalculator.estv.admin.ch/',
    stand: 'Steuerjahr 2026, abgerufen 29.9.2026',
  },
  {
    text: 'ESTV: Quellensteuersätze für Vorsorgeleistungen (Renten, Kapitalleistungen)',
    url: 'https://www.estv.admin.ch/dam/de/sd-web/wOVGrjPStMQ4/qst-tarife-renten-kapitalleistungen-2026.pdf',
    stand: 'gültig ab 1.1.2026',
  },
  {
    text: 'Kanton Zug, Merkblatt Quellensteuer auf privatrechtlichen Vorsorgeleistungen (Ziff. 1.2, 4.1, 5.1: Abzug immer, Rückerstattung nur nach DBA)',
    url: 'https://cdn.zg.ch/dam/jcr:f1c1ed60-31cc-40f1-bd08-88913e15ad0b/2025_merk_126_Vorsorge%20privat-rechtlich-def.%2025.2.25.pdf',
    stand: '25.2.2025',
  },
];

/** Summe der heutigen Vorsorge-Kapitalien (PK, Freizügigkeit, 3a) aller Personen als Vorschlag, sonst 1 Mio. */
export function vorschlagBetrag(h: Haushalt): number {
  const s = h.personen.reduce((a, p) => a + p.pk.guthaben + p.freizuegigkeit.guthaben + p.saeule3a.guthaben, 0);
  return s > 0 ? Math.round(s / 1000) * 1000 : VERGLEICH_BETRAG_STANDARD;
}
