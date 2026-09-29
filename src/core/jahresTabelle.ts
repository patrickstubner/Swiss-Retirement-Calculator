/**
 * Jahrestabelle für Anzeige und CSV-Export: pro Jahr Alter, Vermögen am Jahresende, geplante Ausgaben,
 * Einnahmen aufgeschlüsselt und Steuern. Die Werte kommen unverändert aus der Simulation; die Darstellung
 * (heutige Kaufkraft oder nominal) wird vorher mit `inDarstellung()` gewählt.
 */
import type { JahresZeile, SimulationsErgebnis } from './typen';

export type SpaltenGruppe = 'basis' | 'vermoegen' | 'ausgaben' | 'einnahmen' | 'steuern';

export interface Spalte {
  id: string;
  label: string;
  gruppe: SpaltenGruppe;
  /** Betrag in CHF (sonst Zahl wie Jahr/Alter) */
  betrag: boolean;
  wert: (z: JahresZeile) => number;
}

const weitereAusgaben = (z: JahresZeile) => Math.max(0, z.ausgaben - z.lebenshaltung - z.wohnkosten);
const steuernTotal = (z: JahresZeile) =>
  z.steuernEinkommen + z.steuernKapital + z.steuernVermoegen + z.grundstueckgewinnsteuer;
const beitraege = (z: JahresZeile) => z.sozialabgaben + z.neBeitraege + z.freiwilligeAhv + z.sparbeitraegeVorsorge;

/** Alle Spalten (Alter je Person mit Namen). */
/** Mit `mitTodesjahr` kommt am Ende eine Markierungsspalte (1 im Todesjahr) für CSV und Tabelle. */
export function jahresSpalten(namen: readonly string[], mitTodesjahr = false): Spalte[] {
  const todes: Spalte[] = mitTodesjahr
    ? [
        {
          id: 'todesjahr',
          label: 'Todesjahr (1 = ja)',
          gruppe: 'basis',
          betrag: false,
          wert: (z) => (z.todesjahr ? 1 : 0),
        },
      ]
    : [];
  return [
    { id: 'jahr', label: 'Jahr', gruppe: 'basis', betrag: false, wert: (z) => z.jahr },
    ...namen.map(
      (n, i): Spalte => ({
        id: `alter${i}`,
        label: namen.length > 1 ? `Alter ${n}` : 'Alter',
        gruppe: 'basis',
        betrag: false,
        wert: (z) => z.alter[i] ?? 0,
      }),
    ),
    { id: 'vermoegen', label: 'Vermögen Ende Jahr', gruppe: 'vermoegen', betrag: true, wert: (z) => z.vermoegen },
    { id: 'gebunden', label: 'Gesperrte Vorsorge', gruppe: 'vermoegen', betrag: true, wert: (z) => z.gebunden },
    { id: 'lebenshaltung', label: 'Geplante Ausgaben', gruppe: 'ausgaben', betrag: true, wert: (z) => z.lebenshaltung },
    { id: 'wohnkosten', label: 'Wohnkosten', gruppe: 'ausgaben', betrag: true, wert: (z) => z.wohnkosten },
    { id: 'weitereAusgaben', label: 'Weitere Ausgaben', gruppe: 'ausgaben', betrag: true, wert: weitereAusgaben },
    { id: 'beitraege', label: 'Beiträge AHV/PK/3a', gruppe: 'ausgaben', betrag: true, wert: beitraege },
    { id: 'lohn', label: 'Erwerb (brutto)', gruppe: 'einnahmen', betrag: true, wert: (z) => z.lohn },
    { id: 'ahv', label: 'AHV', gruppe: 'einnahmen', betrag: true, wert: (z) => z.ahv },
    { id: 'pkRente', label: 'PK-Rente', gruppe: 'einnahmen', betrag: true, wert: (z) => z.pkRente },
    {
      id: 'kapital',
      label: 'Kapital PK/FZ/3a',
      gruppe: 'einnahmen',
      betrag: true,
      wert: (z) => z.kapitalBezuege,
    },
    { id: 'ausland', label: 'Ausländische Renten', gruppe: 'einnahmen', betrag: true, wert: (z) => z.auslandRenten },
    { id: 'weitere', label: 'Weitere Einnahmen', gruppe: 'einnahmen', betrag: true, wert: (z) => z.weitereEinnahmen },
    { id: 'miete', label: 'Mieteinnahmen', gruppe: 'einnahmen', betrag: true, wert: (z) => z.mieteinnahmen },
    { id: 'ertraege', label: 'Vermögenserträge', gruppe: 'einnahmen', betrag: true, wert: (z) => z.ertraege },
    { id: 'verkauf', label: 'Verkaufserlös (netto)', gruppe: 'einnahmen', betrag: true, wert: (z) => z.verkaufserloes },
    { id: 'einmalig', label: 'Einmalig (±)', gruppe: 'einnahmen', betrag: true, wert: (z) => z.einmalig },
    {
      id: 'stEinkommen',
      label: 'Einkommenssteuer',
      gruppe: 'steuern',
      betrag: true,
      wert: (z) => z.steuernEinkommen,
    },
    { id: 'stKapital', label: 'Kapitalsteuer', gruppe: 'steuern', betrag: true, wert: (z) => z.steuernKapital },
    { id: 'stVermoegen', label: 'Vermögenssteuer', gruppe: 'steuern', betrag: true, wert: (z) => z.steuernVermoegen },
    {
      id: 'stGrundstueck',
      label: 'Grundstückgewinnsteuer',
      gruppe: 'steuern',
      betrag: true,
      wert: (z) => z.grundstueckgewinnsteuer,
    },
    { id: 'stTotal', label: 'Steuern total', gruppe: 'steuern', betrag: true, wert: steuernTotal },
    { id: 'fehlbetrag', label: 'Fehlbetrag', gruppe: 'vermoegen', betrag: true, wert: (z) => z.fehlbetrag },
    ...todes,
  ];
}

/** Spalten ohne Werte (überall ≈ 0) weglassen; Jahr, Alter, Vermögen und geplante Ausgaben bleiben immer. */
export function sichtbareSpalten(spalten: readonly Spalte[], e: SimulationsErgebnis): Spalte[] {
  const immer = new Set(['jahr', 'vermoegen', 'lebenshaltung', 'stTotal', 'todesjahr']);
  return spalten.filter(
    (s) => immer.has(s.id) || s.id.startsWith('alter') || e.zeilen.some((z) => Math.abs(s.wert(z)) >= 0.5),
  );
}

/**
 * CSV-Feld: Anführungszeichen bei `; " CR LF`; ein führendes `= + - @ Tab CR` wird mit `'` entschärft, damit
 * Tabellenprogramme den Text nicht als Formel ausführen (Audit S-06).
 */
export const csvFeld = (t: string) => {
  const sicher = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
  return /[;"\r\n]/.test(sicher) ? `"${sicher.replace(/"/g, '""')}"` : sicher;
};

/**
 * CSV (Semikolon, ganze Franken, UTF-8 mit BOM für Excel). Erste Zeile: Kopf; Einheit im Kopf der Beträge.
 */
export function jahresCsv(spalten: readonly Spalte[], e: SimulationsErgebnis, einheit: string): string {
  const kopf = spalten.map((s) => csvFeld(s.betrag ? `${s.label} (${einheit})` : s.label)).join(';');
  const zeilen = e.zeilen.map((z) => spalten.map((s) => String(Math.round(s.wert(z)))).join(';'));
  return `\uFEFF${[kopf, ...zeilen].join('\r\n')}\r\n`;
}
