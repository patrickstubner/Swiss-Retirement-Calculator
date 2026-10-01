/**
 * Szenario-Vergleich (Auftrag V): zwei gespeicherte Versionen A und B des Haushalts nebeneinander.
 * Reine Funktionen (ohne React) für Kennzahlen, «Was ist besser?», Monte-Carlo-Kurzfassung sowie Export/Import.
 *
 * Es gibt keine neuen Regelwerte: beide Versionen rechnen mit derselben Simulation wie die einzelne Version.
 * Die Kennzahlen werden aus dem Ergebnis der Simulation abgeleitet (heutige Franken oder Franken des jeweiligen
 * Jahres je nach Darstellung).
 */
import { type Darstellung, inDarstellung } from '../core/nominal';
import type { Haushalt, JahresZeile, SimulationsErgebnis } from '../core/typen';
import type { Regeln } from '../rules';
import { endBetrag } from './darstellung';
import type { McKurz } from './mcKern';
import { bereinigeName, normalisiere, SCHEMA_VERSION, STANDARD_NAMEN, type VersionsNamen } from './state';
import { MAX_JSON_LAENGE } from './validierung';

export { bereinigeName, STANDARD_NAMEN, type VersionsNamen };

export type VersionId = 'A' | 'B';

/** Tiefe Kopie eines Haushalts (Version B startet als Kopie von A). */
export const kopiere = (h: Haushalt): Haushalt => JSON.parse(JSON.stringify(h)) as Haushalt;

/** Beide Versionen mit Namen. */
export interface Paar {
  a: Haushalt;
  b: Haushalt;
  namen: VersionsNamen;
}

/** Version B als Kopie von A anlegen (Namen: «Version A» / «Version B», sofern nicht schon umbenannt). */
export const legeBAn = (a: Haushalt, namen: VersionsNamen = STANDARD_NAMEN): Paar => ({ a, b: kopiere(a), namen });

/** A und B vertauschen (Inhalt und Name). */
export const tausche = (p: Paar): Paar => ({ a: p.b, b: p.a, namen: { a: p.namen.b, b: p.namen.a } });

/** Eine Version über die andere kopieren (`von` bleibt unverändert, der Name der Zielversion bleibt). */
export function ueberschreibe(p: Paar, von: VersionId): Paar {
  return von === 'A' ? { ...p, b: kopiere(p.a) } : { ...p, a: kopiere(p.b) };
}

/** Eine Version löschen: die andere bleibt als einzige Version (mit ihrem Namen) übrig. */
export function loescheVersion(p: Paar, welche: VersionId): { haushalt: Haushalt; name: string } {
  return welche === 'A' ? { haushalt: p.b, name: p.namen.b } : { haushalt: p.a, name: p.namen.a };
}

const summe = (z: JahresZeile) => z.steuernEinkommen + z.steuernKapital + z.steuernVermoegen;

/** Nettoeinkommen des Jahres: Einnahmen ohne Kapitalbezüge und Einmalereignisse, nach Steuern und Abgaben. */
const nettoEinkommen = (z: JahresZeile) =>
  z.lohn +
  z.ahv +
  z.pkRente +
  z.auslandRenten +
  z.weitereEinnahmen +
  z.mieteinnahmen -
  z.steuernEinkommen -
  z.steuernVermoegen -
  z.sozialabgaben -
  z.neBeitraege -
  z.freiwilligeAhv;

/** Jahre nach dem letzten Erwerbsjahr (ohne Erwerbseinkommen); ohne Erwerb im ganzen Verlauf: alle Jahre. */
export function ruhestandsZeilen(zeilen: readonly JahresZeile[]): JahresZeile[] {
  let letzte = -1;
  zeilen.forEach((z, i) => {
    if (z.lohn > 0.5) letzte = i;
  });
  return zeilen.slice(letzte + 1);
}

export interface Kennzahlen {
  /** Vermögen am Ende des Planungshorizonts */
  endVermoegen: number;
  /** Einkommens-, Kapital- und Vermögenssteuern über den ganzen Horizont */
  steuern: number;
  /** Ø Nettoeinkommen pro Jahr im Ruhestand (ohne Kapitalbezüge und Vermögensverzehr); null ohne Ruhestandsjahre */
  verfuegbarProJahr: number | null;
  /** Alter der Referenzperson, bis zu dem das Geld reicht (Planungsalter, wenn es bis zum Ende reicht) */
  reichtBisAlter: number;
  /** Erfolgsquote Monte Carlo (0–1), null solange nicht gerechnet */
  erfolgsquote: number | null;
  /** Alter, bis zu dem das Geld in 90 % der Monte-Carlo-Läufe reicht (Planungsalter = immer), null solange nicht gerechnet */
  reichtBisAlterMc: number | null;
}

export function kennzahlen(
  e: SimulationsErgebnis,
  planungsalter: number,
  d: Darstellung,
  mc: McKurz | null,
): Kennzahlen {
  const z = inDarstellung(e, d).zeilen;
  const ruhe = ruhestandsZeilen(z);
  return {
    endVermoegen: endBetrag(e, d),
    steuern: z.reduce((s, x) => s + summe(x), 0),
    verfuegbarProJahr: ruhe.length === 0 ? null : ruhe.reduce((s, x) => s + nettoEinkommen(x), 0) / ruhe.length,
    reichtBisAlter: e.ruinAlter ?? planungsalter,
    erfolgsquote: mc ? mc.erfolgsquote : null,
    reichtBisAlterMc: mc ? (mc.reichtBisAlterP10 ?? planungsalter) : null,
  };
}

export type Urteil = VersionId | 'gleich';
export type Einheit = 'chf' | 'prozent' | 'alter';

export interface VergleichsZeile {
  id: keyof Kennzahlen;
  label: string;
  einheit: Einheit;
  /** hoch: höherer Wert ist besser; tief: tieferer Wert ist besser */
  besser: 'hoch' | 'tief';
  a: number | null;
  b: number | null;
  /** B − A */
  diff: number | null;
  urteil: Urteil | null;
}

/** Unterschiede unterhalb dieser Schwelle gelten als gleichwertig (Rundung, Rechenrauschen). */
export const TOLERANZ: Record<Einheit, number> = { chf: 100, prozent: 0.005, alter: 0.1 };

const ZEILEN: Pick<VergleichsZeile, 'id' | 'label' | 'einheit' | 'besser'>[] = [
  { id: 'endVermoegen', label: 'Endvermögen', einheit: 'chf', besser: 'hoch' },
  { id: 'steuern', label: 'Steuern total', einheit: 'chf', besser: 'tief' },
  { id: 'verfuegbarProJahr', label: 'Verfügbar pro Jahr im Ruhestand (Ø netto)', einheit: 'chf', besser: 'hoch' },
  { id: 'erfolgsquote', label: 'Erfolgsquote (Monte Carlo)', einheit: 'prozent', besser: 'hoch' },
  { id: 'reichtBisAlter', label: 'Geld reicht bis Alter (ohne Zufall)', einheit: 'alter', besser: 'hoch' },
  { id: 'reichtBisAlterMc', label: 'Geld reicht bis Alter (in 9 von 10 Läufen)', einheit: 'alter', besser: 'hoch' },
];

/** Urteil für einen Kennwert: welche Version ist besser (oder gleichwertig)? null, wenn ein Wert fehlt. */
export function urteil(a: number | null, b: number | null, einheit: Einheit, besser: 'hoch' | 'tief'): Urteil | null {
  if (a === null || b === null) return null;
  const d = b - a;
  if (Math.abs(d) < TOLERANZ[einheit]) return 'gleich';
  const bGewinnt = besser === 'hoch' ? d > 0 : d < 0;
  return bGewinnt ? 'B' : 'A';
}

/** Vergleichstabelle der Kennzahlen von A und B. */
export function vergleiche(a: Kennzahlen, b: Kennzahlen): VergleichsZeile[] {
  return ZEILEN.map((z) => {
    const wa = a[z.id];
    const wb = b[z.id];
    return {
      ...z,
      a: wa,
      b: wb,
      diff: wa === null || wb === null ? null : wb - wa,
      urteil: urteil(wa, wb, z.einheit, z.besser),
    };
  });
}

/** Zusammenfassung: wie oft ist A bzw. B besser (nur bewertete Zeilen). */
export function zaehleUrteile(z: readonly VergleichsZeile[]): { a: number; b: number; gleich: number } {
  const r = { a: 0, b: 0, gleich: 0 };
  for (const x of z) {
    if (x.urteil === 'A') r.a++;
    else if (x.urteil === 'B') r.b++;
    else if (x.urteil === 'gleich') r.gleich++;
  }
  return r;
}

// ---------------------------------------------------------------------------------------
// Verlauf für das gemeinsame Diagramm

export interface GemeinsamerVerlauf {
  jahre: number[];
  a: (number | null)[];
  b: (number | null)[];
}

/** Verfügbares Vermögen beider Versionen je Kalenderjahr (null ausserhalb des Horizonts der Version). */
export function gemeinsamerVerlauf(
  ea: SimulationsErgebnis,
  eb: SimulationsErgebnis,
  d: Darstellung,
): GemeinsamerVerlauf {
  const za = inDarstellung(ea, d).zeilen;
  const zb = inDarstellung(eb, d).zeilen;
  const jahre = [...new Set([...za, ...zb].map((z) => z.jahr))].sort((x, y) => x - y);
  const ma = new Map(za.map((z) => [z.jahr, z.vermoegen]));
  const mb = new Map(zb.map((z) => [z.jahr, z.vermoegen]));
  return { jahre, a: jahre.map((j) => ma.get(j) ?? null), b: jahre.map((j) => mb.get(j) ?? null) };
}

// ---------------------------------------------------------------------------------------
// Export / Import (JSON-Datei, nur lokal)

export interface ExportDatei {
  app: 'ruhestandsrechner';
  typ: 'szenarien';
  schema: number;
  exportiertAm: string;
  namen: VersionsNamen;
  a: Haushalt;
  b: Haushalt;
}

export const exportDateiname = () => 'ruhestandsrechner-versionen-a-b.json';

export function exportiere(a: Haushalt, b: Haushalt, namen: VersionsNamen, jetzt = new Date()): string {
  const d: ExportDatei = {
    app: 'ruhestandsrechner',
    typ: 'szenarien',
    schema: SCHEMA_VERSION,
    exportiertAm: jetzt.toISOString(),
    namen,
    a,
    b,
  };
  return JSON.stringify(d, null, 2);
}

/** Liest eine Exportdatei; null bei fremden oder defekten Dateien. Beide Haushalte werden wie beim Laden normalisiert. */
export function importiere(text: string, regeln: Regeln): { a: Haushalt; b: Haushalt; namen: VersionsNamen } | null {
  try {
    if (text.length > MAX_JSON_LAENGE) return null;
    const d: unknown = JSON.parse(text);
    if (typeof d !== 'object' || d === null) return null;
    const o = d as Record<string, unknown>;
    if (o.app !== 'ruhestandsrechner' || o.typ !== 'szenarien') return null;
    if (typeof o.a !== 'object' || o.a === null || typeof o.b !== 'object' || o.b === null) return null;
    const n = (typeof o.namen === 'object' && o.namen !== null ? o.namen : {}) as Record<string, unknown>;
    return {
      a: normalisiere(o.a, regeln),
      b: normalisiere(o.b, regeln),
      namen: { a: bereinigeName(n.a, STANDARD_NAMEN.a), b: bereinigeName(n.b, STANDARD_NAMEN.b) },
    };
  } catch {
    return null;
  }
}
