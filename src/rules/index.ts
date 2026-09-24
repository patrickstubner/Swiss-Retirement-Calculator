import regeln2026Json from './2026.json';
import { extrahiereWerte, flacheRegeln, pruefeRegeln, type RegelEintrag, type Werte } from './schema';

export type { RegelEintrag, RegelStatus, Regelwert } from './schema';

/** Die Struktur von 2026.json ist das kanonische Schema für alle Jahre. */
export type RegelnJson = typeof regeln2026Json;
/** Reine Werte (ohne Quelle/Stand) – das bekommen die Rechenfunktionen in src/core. */
export type Regeln = Werte<Omit<RegelnJson, 'meta'>> & { meta: RegelnJson['meta'] };

/**
 * Versionierte Regeldateien. Neue Jahre hier eintragen (z.B. `2027: regeln2027Json`),
 * die Datei muss dieselbe Struktur wie 2026.json haben (wird vom Typsystem geprüft).
 */
const REGELDATEIEN: Record<number, RegelnJson> = {
  2026: regeln2026Json,
};

export const VERFUEGBARE_JAHRE: readonly number[] = Object.keys(REGELDATEIEN)
  .map(Number)
  .sort((a, b) => a - b);

const cache = new Map<number, Regeln>();

/**
 * Lädt die Regeln für ein Jahr. Gibt es für das Jahr keine Datei, wird die jüngste
 * frühere Datei verwendet (Werte gelten bis zur nächsten Anpassung).
 */
export function ladeRegeln(jahr: number): Regeln {
  const verfuegbar = [...VERFUEGBARE_JAHRE].reverse().find((j) => j <= jahr) ?? VERFUEGBARE_JAHRE[0];
  if (verfuegbar === undefined) throw new Error('Keine Regeldatei vorhanden');
  const gecacht = cache.get(verfuegbar);
  if (gecacht) return gecacht;
  const json = REGELDATEIEN[verfuegbar];
  if (!json) throw new Error(`Regeldatei ${verfuegbar} fehlt`);
  const fehler = pruefeRegeln(json);
  if (fehler.length > 0) throw new Error(`Regeldatei ${verfuegbar} ungültig:\n${fehler.join('\n')}`);
  const { meta, ...rest } = json;
  const werte = { ...extrahiereWerte(rest), meta } as Regeln;
  cache.set(verfuegbar, werte);
  return werte;
}

/** Alle Regelwerte eines Jahres flach mit Quelle/Stand/Status. */
export function regelEintraege(jahr: number): RegelEintrag[] {
  const verfuegbar = [...VERFUEGBARE_JAHRE].reverse().find((j) => j <= jahr) ?? VERFUEGBARE_JAHRE[0];
  const json = verfuegbar === undefined ? undefined : REGELDATEIEN[verfuegbar];
  return json ? flacheRegeln(json) : [];
}

export { pruefeRegeln } from './schema';
