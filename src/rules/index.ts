import regeln2026Json from './2026.json';
import regeln2027Json from './2027.json';
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
  2027: regeln2027Json,
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

/**
 * Regeljahr-Status (K-11): Gibt es für das angefragte Jahr keine Regeldatei, rechnet `ladeRegeln` mit der jüngsten
 * früheren (Werte gelten bis zur nächsten Anpassung). Die Oberfläche zeigt dann ein sichtbares Banner.
 */
export interface RegelJahrStatus {
  angefragt: number;
  verwendet: number;
  /** true, wenn für das angefragte Jahr keine eigene Regeldatei existiert */
  fehlt: boolean;
}

export function regelJahrStatus(jahr: number, verfuegbar: readonly number[] = VERFUEGBARE_JAHRE): RegelJahrStatus {
  const verwendet = [...verfuegbar].reverse().find((j) => j <= jahr) ?? verfuegbar[0] ?? jahr;
  return { angefragt: jahr, verwendet, fehlt: verwendet !== jahr };
}

/** Marker im Hinweis eines Regelwerts, der für das Jahr noch nicht amtlich bestätigt ist und den Vorjahreswert fortführt. */
export const FORTGESCHRIEBEN = 'Fortgeschrieben';

/**
 * Anzahl Regelwerte der verwendeten Regeldatei, die noch den Wert des Vorjahres fortführen (status offen, Hinweis
 * «Fortgeschrieben»). > 0 heisst: Regeldatei ist eine Vorbereitung, die Oberfläche zeigt einen Hinweis.
 */
export function anzahlFortgeschrieben(jahr: number): number {
  return regelEintraege(jahr).filter((e) => e.status === 'offen' && (e.hinweis ?? '').includes(FORTGESCHRIEBEN)).length;
}

/** Sichtbarer Hinweis im Kopf der App, wenn die Regeldatei fehlt oder noch Vorjahreswerte fortführt. */
export interface RegeljahrBanner {
  rolle: 'alert' | 'status';
  stark: string;
  rest: string;
}

/**
 * Text des Regeljahr-Banners. «teilweise» nennt, was für 2027 beschlossen ist und was offen bleibt
 * (Stand Bundesratsentscheid 2.10.2026). Die Skala-44-Tabelle wird nur erwähnt, solange sie «offen» ist.
 */
export function regeljahrBanner(jahr: number): RegeljahrBanner | null {
  const status = regelJahrStatus(jahr);
  if (status.fehlt) {
    return {
      rolle: 'alert',
      stark: `Regeln für ${status.angefragt} noch nicht erfasst.`,
      rest: `Der Rechner rechnet mit den Werten von ${status.verwendet} (Beiträge, Renten, Steuertarife und Grenzen können sich geändert haben). Die Ergebnisse sind deshalb möglicherweise ungenau.`,
    };
  }
  const n = anzahlFortgeschrieben(jahr);
  if (n === 0) return null;
  const rententabelleOffen = regelEintraege(jahr).some(
    (e) => e.pfad === 'ahv.rententabelleSkala44' && e.status === 'offen',
  );
  const rentenSatz = rententabelleOffen
    ? ` Die Skala-44-Rententabelle ist aus der Rentenformel gerechnet und noch nicht mit einer publizierten Rententabelle ${status.angefragt} abgeglichen.`
    : '';
  return {
    rolle: 'status',
    stark: `Regeln für ${status.angefragt} teilweise erfasst.`,
    rest:
      `Berücksichtigt sind AHV-Renten (Minimum und Maximum) und Beiträge, BVG-Grenzbeträge, Säule 3a sowie die Tarife der direkten Bundessteuer. Für ${n} Werte gibt es noch keinen amtlichen Beschluss (unter anderem BVG-Mindestzins, Quellensteuer auf Kapitalleistungen bis zur Amtlichen Sammlung, kantonale Tarife); dort gelten vorläufig die Werte von ${status.angefragt - 1}.` +
      `${rentenSatz} Die Ergebnisse können deshalb abweichen.`,
  };
}

/** Alle Regelwerte eines Jahres flach mit Quelle/Stand/Status. */
export function regelEintraege(jahr: number): RegelEintrag[] {
  const verfuegbar = [...VERFUEGBARE_JAHRE].reverse().find((j) => j <= jahr) ?? VERFUEGBARE_JAHRE[0];
  const json = verfuegbar === undefined ? undefined : REGELDATEIEN[verfuegbar];
  return json ? flacheRegeln(json) : [];
}

export { pruefeRegeln } from './schema';
