/** Reine Darstellungslogik zum Wegzug-Vergleich PK/3a: Hinweise, Quellen. */
import type { WegzugFallErgebnis } from '../core/wegzugVergleich';

export const HINWEIS_OBLIGATORIUM =
  'Wenn Sie den obligatorischen Teil als Kapital wollen, müssen Sie vor dem Bezug in ein Nicht-EU/EFTA-Land ziehen.';

export const WEGZUG_QUELLEN: readonly { text: string; url: string; stand: string }[] = [
  {
    text: 'Art. 2 Abs. 1 und 1bis, Art. 5 Abs. 1 lit. a und Abs. 2, Art. 25f FZG (Barauszahlung, Einschränkung EU/EFTA)',
    url: 'https://www.fedlex.admin.ch/eli/cc/1994/2386_2386_2386/de',
    stand: '1.1.2024',
  },
  {
    text: 'Art. 3 Abs. 2 lit. d BVV 3 (3a: vorzeitige Auszahlung); BSV Mitteilungen über die berufliche Vorsorge Nr. 96, Rz 567',
    url: 'https://www.fedlex.admin.ch/eli/cc/1985/1778_1778_1778/de',
    stand: 'BVV 3 Stand 1.1.2025',
  },
  {
    text: 'ESTV Rundschreiben und Merkblatt 2-217: Quellenbesteuerung privatrechtlicher Vorsorgeleistungen, DBA-Übersicht (Kapitalleistungen: Rückforderungsmöglichkeit)',
    url: 'https://www.estv.admin.ch/dam/de/sd-web/rvrM54pOsUZ5/2-217-D-2026-d.pdf',
    stand: '1.1.2026',
  },
  {
    text: 'Sicherheitsfonds BVG: Barauszahlung nach Ausreise',
    url: 'https://sfbvg.ch/aufgaben/barauszahlung-nach-ausreise',
    stand: 'abgerufen 25.9.2026',
  },
];

/** Gibt es im Vergleich einen EU/EFTA-Fall, in dem ein Teil des Obligatoriums gesperrt bleibt, und einen Nicht-EU/EFTA-Fall? */
export function zeigeObligatoriumHinweis(faelle: readonly WegzugFallErgebnis[]): boolean {
  return faelle.some((f) => f.kapital.pkGesperrt > 0);
}

/** Erster Fall ausserhalb EU/EFTA mit Wegzug (Referenz für «alles bar»). */
export const nichtEuFall = (faelle: readonly WegzugFallErgebnis[]) => faelle.find((f) => f.land !== '' && !f.euEfta);
