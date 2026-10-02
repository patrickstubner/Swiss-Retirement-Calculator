/**
 * Monte Carlo mit wiederkehrenden Krisen bzw. historischem Block-Bootstrap.
 *
 * - «wiederkehrend»: In jedem normalen Jahr beginnt mit Wahrscheinlichkeit (Krisen pro Dekade)/10
 *   eine zufällig gewählte historische Krise aus dem Pool (während einer Krise beginnt keine neue).
 *   Die Krisenjahre ersetzen die Annahme; die normalen Jahre werden im Erwartungswert so erhöht,
 *   dass die durchschnittliche reale Rendite über den Planungshorizont (Krisen am Ende abgeschnitten)
 *   der Annahme entspricht (`ausgleichErwartetHorizont`, keine Doppelzählung). Standardhäufigkeit aus data/krisen-haeufigkeit.json.
 * - «bootstrap»: Alle Jahre aus zusammenhängenden Blöcken historischer Jahre (Schweiz), Renditen
 *   und Teuerung gemeinsam gezogen (Zusammenhänge innerhalb eines Jahres bleiben erhalten).
 *
 * Deterministisch dank festem Startwert (seed). Gerechnet wird der Wunsch-Rücktritt.
 */
import type { Regeln } from '../rules';
import {
  ausgleichErwartetHorizont,
  type BasisAnnahmen,
  type HistJahr,
  type JahresRenditen,
  jahresRenditen,
  type Krise,
  type KrisenDaten,
  type KrisenLand,
} from './krisen';
import type { RenditeModell } from './renditen';
import { simuliere } from './simulation';
import type { Haushalt, Monat, Todesfall } from './typen';

/** Kleiner, schneller Pseudozufallsgenerator (mulberry32) */
export function zufall(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function modellAus(werte: JahresRenditen[], basis: BasisAnnahmen): RenditeModell {
  const w = (t: number) =>
    werte[t] ?? {
      wertschriften: basis.renditeNominal,
      wohneigentum: basis.wohneigentumNominal ?? basis.renditeNominal,
      bargeld: basis.renditeBargeld,
      inflation: basis.inflation,
      hist: null,
    };
  return {
    art: 'montecarlo',
    renditeNominal: (t) => w(t).wertschriften,
    inflation: (t) => w(t).inflation,
    wohneigentum: (t) => w(t).wohneigentum,
    bargeld: (t) => w(t).bargeld,
    historisch: (t) => w(t).hist,
  };
}

export interface PoolKrise {
  krise: Krise;
  land: KrisenLand;
}

/** Jahreswerte für einen Lauf mit wiederkehrenden Krisen; zählt die begonnenen Krisen */
export function wiederkehrendeKrisenPfad(
  rng: () => number,
  basis: BasisAnnahmen,
  aktienanteil: number,
  pool: readonly PoolKrise[],
  krisenProDekade: number,
  jahre: number,
  daten: KrisenDaten,
): { werte: JahresRenditen[]; krisen: number } {
  const p = Math.min(1, Math.max(0, krisenProDekade / 10));
  const werte: JahresRenditen[] = [];
  let krisen = 0;
  let t = 0;
  while (t < jahre) {
    if (pool.length > 0 && rng() < p) {
      const k = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] as PoolKrise;
      krisen++;
      for (let j = k.krise.von; j <= k.krise.bis && t < jahre; j++, t++) {
        werte.push(
          jahresRenditen(basis, aktienanteil, daten[k.land].get(j) ?? null, {
            land: k.land,
            jahr: j,
            krise: k.krise.id,
          }),
        );
      }
    } else {
      werte.push(jahresRenditen(basis, aktienanteil, null));
      t++;
    }
  }
  return { werte, krisen };
}

/** Vollständige historische Jahre (Aktien, Obligationen, Geldmarkt, Teuerung) */
export function vollstaendigeJahre(daten: KrisenDaten, land: KrisenLand): HistJahr[] {
  return [...daten[land].values()]
    .filter((h) => h.aktien !== null && h.obligationen !== null && h.geldmarkt !== null && h.teuerung !== null)
    .sort((a, b) => a.jahr - b.jahr);
}

/** Block-Bootstrap: zusammenhängende Blöcke der Länge `block` aus lückenlosen Jahresfolgen */
export function bootstrapPfad(
  rng: () => number,
  basis: BasisAnnahmen,
  aktienanteil: number,
  jahreHist: readonly HistJahr[],
  block: number,
  jahre: number,
  land: KrisenLand,
): JahresRenditen[] {
  // mögliche Blockanfänge: Blöcke ohne Lücke in der Jahresfolge
  const starts: number[] = [];
  for (let i = 0; i + block <= jahreHist.length; i++) {
    const a = jahreHist[i] as HistJahr;
    const b = jahreHist[i + block - 1] as HistJahr;
    if (b.jahr - a.jahr === block - 1) starts.push(i);
  }
  const werte: JahresRenditen[] = [];
  while (werte.length < jahre && starts.length > 0) {
    const s = starts[Math.min(starts.length - 1, Math.floor(rng() * starts.length))] as number;
    for (let k = 0; k < block && werte.length < jahre; k++) {
      const h = jahreHist[s + k] as HistJahr;
      werte.push(jahresRenditen(basis, aktienanteil, h, { land, jahr: h.jahr, krise: 'bootstrap' }));
    }
  }
  return werte;
}

export interface MonteCarloEinstellung {
  art: 'wiederkehrend' | 'bootstrap';
  laeufe: number;
  seed: number;
  krisenProDekade: number;
  blockLaenge: number;
  bootstrapLand: KrisenLand;
  /** Normale Jahre ausgleichen (nur «wiederkehrend», Standard true) */
  ausgleich?: boolean;
  /**
   * Zielvermögen am Planungsende (heutige CHF): Ein Lauf gilt nur als Erfolg, wenn das Geld reicht und
   * am Ende mindestens so viel übrig ist (Umkehrrechnung). Standard 0 = nur «Geld reicht».
   */
  zielEndVermoegen?: number;
  /** Todesfall-Szenario (Schema 9): wird in jedem Lauf gerechnet, gleiche Krisenpfade wie ohne Todesfall (gleicher seed) */
  todesfall?: Todesfall;
}

export interface MonteCarloErgebnis {
  laeufe: number;
  /** Anteil der Läufe, in denen das Vermögen bis zum Planungsalter reicht */
  erfolgsquote: number;
  jahre: number[];
  /** Vermögen (heutige CHF) pro Jahr: 10., 25., 50., 75. und 90. Perzentil */
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  /**
   * Dieselben Perzentile in Franken des jeweiligen Jahres. Pro Lauf mit dessen eigener Teuerung
   * umgerechnet, dann sortiert (nicht einfach real × Index, weil die Teuerung je Lauf verschieden ist).
   */
  nominal: { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] };
  /** Ruin-Alter aller Läufe aufsteigend (Infinity = Geld reicht bis zum Planungsalter) */
  ruinAlterSortiert: number[];
  /** Anteil der Läufe, in denen das Geld reicht (ohne Zielvermögen) */
  reichtQuote: number;
  /** Alter der Referenzperson, bis zu dem das Vermögen in 90 % bzw. 50 % der Läufe reicht (null = immer) */
  reichtBisAlterP10: number | null;
  reichtBisAlterP50: number | null;
  /** Durchschnittliche Anzahl Krisen pro Lauf (nur «wiederkehrend») */
  krisenMittel: number;
}

export function perzentil(sortiert: readonly number[], q: number): number {
  if (sortiert.length === 0) return 0;
  const i = Math.min(sortiert.length - 1, Math.max(0, Math.floor(q * (sortiert.length - 1) + 0.5)));
  return sortiert[i] as number;
}

export function monteCarlo(
  h: Haushalt,
  regeln: Regeln,
  start: Monat,
  e: MonteCarloEinstellung,
  daten: KrisenDaten,
  pool: readonly PoolKrise[],
  /** Optional: wird nach einzelnen Läufen mit (fertig, von) aufgerufen; ändert das Ergebnis nicht */
  fortschritt?: (fertig: number, von: number) => void,
): MonteCarloErgebnis {
  const a = h.annahmen;
  const annahme: BasisAnnahmen = {
    renditeNominal: a.renditeNominal,
    renditeBargeld: a.renditeBargeld,
    inflation: a.inflation,
  };
  const rng = zufall(e.seed);
  const hist = e.art === 'bootstrap' ? vollstaendigeJahre(daten, e.bootstrapLand) : [];
  const laeufe = Math.max(1, Math.round(e.laeufe));
  let jahre: number[] = [];
  const vermoegen: number[][] = [];
  const ruinAlter: (number | null)[] = [];
  let erfolge = 0;
  let reicht = 0;
  let krisenSumme = 0;
  const nominal: number[][] = [];
  const ziel = Math.max(0, e.zielEndVermoegen ?? 0);
  // Länge des Horizonts aus einem Referenzlauf
  const ref = simuliere(h, regeln, { start, ...(e.todesfall ? { todesfall: e.todesfall } : {}) });
  const n = ref.zeilen.length;
  jahre = ref.zeilen.map((z) => z.jahr);
  // Ausgleich im Erwartungswert über genau diesen Horizont (Krisen am Ende abgeschnitten, Schema 7)
  let basis = annahme;
  if (e.art === 'wiederkehrend' && e.ausgleich !== false) {
    const gewichte = jahre.map((j) => (j === start.jahr ? (13 - start.monat) / 12 : 1));
    const aus = ausgleichErwartetHorizont(annahme, a.aktienanteil, pool, e.krisenProDekade, gewichte, daten);
    basis = { ...annahme, renditeNominal: aus.wertschriften, wohneigentumNominal: aus.wohneigentum };
  }
  const schritt = Math.max(1, Math.floor(laeufe / 50));
  for (let i = 0; i < laeufe; i++) {
    let werte: JahresRenditen[];
    if (e.art === 'bootstrap') {
      werte = bootstrapPfad(rng, basis, a.aktienanteil, hist, Math.max(1, e.blockLaenge), n, e.bootstrapLand);
    } else {
      const r = wiederkehrendeKrisenPfad(rng, basis, a.aktienanteil, pool, e.krisenProDekade, n, daten);
      werte = r.werte;
      krisenSumme += r.krisen;
    }
    const erg = simuliere(h, regeln, {
      start,
      renditeModell: modellAus(werte, basis),
      ...(e.todesfall ? { todesfall: e.todesfall } : {}),
    });
    if (erg.erfolg) reicht++;
    if (erg.erfolg && erg.endVermoegen >= ziel - 0.5) erfolge++;
    ruinAlter.push(erg.ruinAlter);
    vermoegen.push(erg.zeilen.map((z) => z.vermoegen));
    nominal.push(erg.zeilen.map((z) => z.vermoegen * z.indexEnde));
    if (fortschritt && (i + 1 === laeufe || (i + 1) % schritt === 0)) fortschritt(i + 1, laeufe);
  }
  const baender = (reihen: number[][]) => {
    const b = {
      p10: [] as number[],
      p25: [] as number[],
      p50: [] as number[],
      p75: [] as number[],
      p90: [] as number[],
    };
    for (let t = 0; t < n; t++) {
      const xs = reihen.map((v) => v[t] ?? 0).sort((x, y) => x - y);
      b.p10.push(perzentil(xs, 0.1));
      b.p25.push(perzentil(xs, 0.25));
      b.p50.push(perzentil(xs, 0.5));
      b.p75.push(perzentil(xs, 0.75));
      b.p90.push(perzentil(xs, 0.9));
    }
    return b;
  };
  const real = baender(vermoegen);
  // «reicht bis»: Ruin-Alter sortiert, null (= reicht immer) als +∞
  const ra = ruinAlter.map((x) => (x === null ? Number.POSITIVE_INFINITY : x)).sort((x, y) => x - y);
  const q = (p: number) => {
    const v = perzentil(ra, p);
    return Number.isFinite(v) ? v : null;
  };
  return {
    laeufe,
    erfolgsquote: erfolge / laeufe,
    reichtQuote: reicht / laeufe,
    jahre,
    ...real,
    nominal: baender(nominal),
    ruinAlterSortiert: ra,
    reichtBisAlterP10: q(0.1),
    reichtBisAlterP50: q(0.5),
    krisenMittel: e.art === 'wiederkehrend' ? krisenSumme / laeufe : 0,
  };
}

/**
 * «Mit Wahrscheinlichkeit w reicht das Geld mindestens bis Alter Y»: das (1 − w)-Quantil der Ruin-Alter.
 * null = in mindestens diesem Anteil der Läufe reicht das Geld bis zum Planungsalter.
 */
export function reichtBisAlter(m: Pick<MonteCarloErgebnis, 'ruinAlterSortiert'>, w: number): number | null {
  const v = perzentil(m.ruinAlterSortiert, Math.min(1, Math.max(0, 1 - w)));
  return Number.isFinite(v) ? v : null;
}
