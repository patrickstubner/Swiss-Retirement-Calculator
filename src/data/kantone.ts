/**
 * Die 26 Kantone mit dem Stand der Steuerdaten im Rechner.
 *
 * TODO(kantone): Sobald data/kantone-2026.json und docs/kantone.md (Recherche mit Status
 * exakt/naeherung/offen pro Kanton) vorliegen, hier laden und tarifbasierte Modelle in
 * src/core/kantone.ts (`kantonsModell`) registrieren. ZH und AG sollen exakte Tarife
 * erhalten. Keine Tarife erfinden – bis dahin rechnen alle Kantone mit effektiven Sätzen
 * (Nutzereingabe).
 */
export type KantonDatenStatus = 'exakt' | 'exakt-ausstehend' | 'naeherung';

export interface Kanton {
  code: string;
  name: string;
  status: KantonDatenStatus;
}

const AUSSTEHEND = new Set(['ZH', 'AG']);

const LISTE: readonly [string, string][] = [
  ['AG', 'Aargau'],
  ['AI', 'Appenzell Innerrhoden'],
  ['AR', 'Appenzell Ausserrhoden'],
  ['BE', 'Bern'],
  ['BL', 'Basel-Landschaft'],
  ['BS', 'Basel-Stadt'],
  ['FR', 'Freiburg'],
  ['GE', 'Genf'],
  ['GL', 'Glarus'],
  ['GR', 'Graubünden'],
  ['JU', 'Jura'],
  ['LU', 'Luzern'],
  ['NE', 'Neuenburg'],
  ['NW', 'Nidwalden'],
  ['OW', 'Obwalden'],
  ['SG', 'St. Gallen'],
  ['SH', 'Schaffhausen'],
  ['SO', 'Solothurn'],
  ['SZ', 'Schwyz'],
  ['TG', 'Thurgau'],
  ['TI', 'Tessin'],
  ['UR', 'Uri'],
  ['VD', 'Waadt'],
  ['VS', 'Wallis'],
  ['ZG', 'Zug'],
  ['ZH', 'Zürich'],
];

export const KANTONE: readonly Kanton[] = LISTE.map(([code, name]) => ({
  code,
  name,
  status: AUSSTEHEND.has(code) ? 'exakt-ausstehend' : 'naeherung',
}));

export const kantonNach = (code: string): Kanton | undefined => KANTONE.find((k) => k.code === code);

export const KANTON_STATUS_TEXT: Record<KantonDatenStatus, string> = {
  exakt: 'Exakt: kantonaler Tarif 2026',
  'exakt-ausstehend': 'Näherung: effektiver Steuersatz als Eingabe – exakter Tarif in Vorbereitung',
  naeherung: 'Näherung: effektiver Steuersatz als Eingabe',
};
