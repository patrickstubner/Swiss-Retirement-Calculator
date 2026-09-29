/**
 * Todesfall-Szenario: Vergleich mit dem Plan ohne Todesfall, Kennzahlen und «Wer stirbt zuerst?»-Matrix.
 * Reine Funktionen (ohne React), damit sie testbar sind. Gerechnet wird mit denselben Krisenoptionen wie das
 * übrige Ergebnis (Automatisch als Standard); Monte Carlo läuft mit demselben seed und denselben Krisenpfaden.
 */
import { type MonteCarloErgebnis, monteCarlo } from '../core/montecarlo';
import { simuliere } from '../core/simulation';
import { todeszeitpunkt } from '../core/todesfall';
import type { Haushalt, Monat, SimulationsErgebnis, Todesfall } from '../core/typen';
import { geburtIndex } from '../core/zeitpunkt';
import { KRISEN_DATEN, krisenOptionen, mcKrisenPool, STANDARD_KRISEN_PRO_DEKADE } from '../data/krisen';
import type { Regeln } from '../rules';

/** Alter der verstorbenen Person in der Matrix (Kopfzeile). */
export const MATRIX_ALTER = [70, 80, 90] as const;

/** Todesfall-Einstellung aus dem Haushalt (Standard: inaktiv). */
export const todesfallVon = (h: Pick<Haushalt, 'todesfall'>): Todesfall | undefined => h.todesfall;

export interface TodesfallVergleich {
  ohne: SimulationsErgebnis;
  mit: SimulationsErgebnis;
}

/** Plan ohne und mit Todesfall (gleiche Krisenoptionen, gleiche Eingaben). */
export function todesfallVergleich(h: Haushalt, regeln: Regeln, heute: Monat, tf: Todesfall): TodesfallVergleich {
  const krisen = krisenOptionen(h);
  const ohne = simuliere(h, regeln, { start: heute, krisen });
  const mit = simuliere(h, regeln, { start: heute, krisen, todesfall: { ...tf, aktiv: true } });
  return { ohne, mit };
}

/** Alter der Referenzperson (jüngere), bis zu dem das Geld reicht; null = bis zum Planungsalter. */
export const reichtBis = (e: SimulationsErgebnis): number | null => e.ruinAlter;

export interface EinkommenVorNach {
  /** Jahreseinkommen (AHV, PK-Rente, ausländische Renten, weitere Einnahmen, Erwerb) im Jahr vor bzw. nach dem Tod */
  vorher: number;
  nachher: number;
  jahrVorher: number;
  jahrNachher: number;
  /** Davon AHV und PK */
  ahvVorher: number;
  ahvNachher: number;
  pkVorher: number;
  pkNachher: number;
  /** Lebenshaltung (geplante Ausgaben) vorher/nachher */
  ausgabenVorher: number;
  ausgabenNachher: number;
}

/** Einkommen im letzten vollen Jahr vor dem Todesjahr und im ersten vollen Jahr danach (Werte wie im Ergebnis). */
export function einkommenVorNach(e: SimulationsErgebnis): EinkommenVorNach | null {
  const t = e.todesfall;
  if (!t) return null;
  const vor = e.zeilen.find((z) => z.jahr === t.jahr - 1) ?? e.zeilen.find((z) => z.jahr === t.jahr);
  const nach = e.zeilen.find((z) => z.jahr === t.jahr + 1);
  if (!vor || !nach) return null;
  const ein = (z: typeof vor) => z.lohn + z.ahv + z.pkRente + z.auslandRenten + z.weitereEinnahmen + z.mieteinnahmen;
  return {
    vorher: ein(vor),
    nachher: ein(nach),
    jahrVorher: vor.jahr,
    jahrNachher: nach.jahr,
    ahvVorher: vor.ahv,
    ahvNachher: nach.ahv,
    pkVorher: vor.pkRente,
    pkNachher: nach.pkRente,
    ausgabenVorher: vor.lebenshaltung,
    ausgabenNachher: nach.lebenshaltung,
  };
}

/** Todesjahr als Alter der Referenzperson (für die Markierung im Diagramm), null wenn kein Todesfall im Horizont. */
export function todesAlterRef(e: SimulationsErgebnis, refIdx: number): number | null {
  const z = e.zeilen.find((x) => x.todesjahr);
  return z ? (z.alter[refIdx] ?? null) : null;
}

/** Ist das Szenario im Haushalt anwendbar (Ehepaar)? */
export const todesfallMoeglich = (h: Pick<Haushalt, 'zivilstand' | 'personen'>): boolean =>
  h.zivilstand === 'verheiratet' && h.personen.length >= 2;

/** Monte Carlo mit und ohne Todesfall (gleiche Einstellung wie die Monte-Carlo-Karte, gleicher seed). */
export function todesfallMonteCarlo(
  h: Haushalt,
  regeln: Regeln,
  heute: Monat,
  tf: Todesfall,
): { ohne: MonteCarloErgebnis; mit: MonteCarloErgebnis } {
  const k = h.krisen;
  const pool = mcKrisenPool();
  const einst = {
    art: k.mcArt,
    laeufe: k.mcLaeufe,
    seed: 20260927,
    krisenProDekade: k.mcKrisenProDekade ?? STANDARD_KRISEN_PRO_DEKADE,
    blockLaenge: k.mcBlockLaenge,
    bootstrapLand: 'CHE' as const,
  };
  return {
    ohne: monteCarlo(h, regeln, heute, einst, KRISEN_DATEN, pool),
    mit: monteCarlo(h, regeln, heute, { ...einst, todesfall: { ...tf, aktiv: true } }, KRISEN_DATEN, pool),
  };
}

export interface MatrixZelle {
  /** Alter der Referenzperson, bis zu dem das Geld reicht (null = bis zum Planungsalter) */
  reichtBis: number | null;
  endVermoegen: number;
  /** Die Person ist in diesem Alter schon älter bzw. das Alter liegt hinter dem Planungshorizont */
  moeglich: boolean;
}

/**
 * «Wer stirbt zuerst und wann?»: pro verstorbener Person (Zeile) und Todesalter (Spalte) das Alter, bis zu dem
 * das Geld reicht, und das Endvermögen. Alle übrigen Einstellungen des Szenarios gelten für jede Zelle.
 */
export function todesfallMatrix(
  h: Haushalt,
  regeln: Regeln,
  heute: Monat,
  tf: Todesfall,
  alter: readonly number[] = MATRIX_ALTER,
): MatrixZelle[][] {
  const krisen = krisenOptionen(h);
  const startIdx = heute.jahr * 12 + (heute.monat - 1);
  return h.personen.slice(0, 2).map((p, person) =>
    alter.map((a): MatrixZelle => {
      const z: Todesfall = { ...tf, aktiv: true, person, modus: 'alter', alter: a };
      const t = todeszeitpunkt(h, z, startIdx);
      const moeglich = t !== null && t.idx > geburtIndex(p) + a * 12 && a * 12 + geburtIndex(p) >= startIdx - 1;
      const e = simuliere(h, regeln, { start: heute, krisen, todesfall: z });
      return { reichtBis: e.ruinAlter, endVermoegen: e.endVermoegen, moeglich };
    }),
  );
}
