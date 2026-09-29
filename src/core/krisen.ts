/**
 * Krisenszenarien: reale historische Jahresrenditen und Teuerung auf das Portfolio abspielen.
 * Daten: data/krisen-historisch.json (JST R6 1871–2020, Schweiz 2021–2024 aus SNB/BFS; Quellen und
 * Lizenzen in docs/krisen.md). Ausserhalb der Krisenjahre gelten die normalen Annahmen.
 */
import type { RenditeModell } from './renditen';

export type KrisenLand = 'CHE' | 'USA' | 'JPN';

/** Ein Jahr einer historischen Reihe (Anteile, nominal, Landeswährung); null = keine Daten */
export interface HistJahr {
  jahr: number;
  aktien: number | null;
  obligationen: number | null;
  geldmarkt: number | null;
  teuerung: number | null;
  immobilien: number | null;
}

export type KrisenDaten = Record<KrisenLand, ReadonlyMap<number, HistJahr>>;

export interface Krise {
  id: string;
  name: string;
  /** Kurzname für die Beschriftung im Diagramm */
  kurz: string;
  /** Historische Kalenderjahre (von–bis, inklusive) */
  von: number;
  bis: number;
  /** Datenreihe, die standardmässig abgespielt wird */
  land: KrisenLand;
  beschreibung: string;
}

/** Eintrag im Krisenplan: Krise `krise` beginnt im Kalenderjahr `startJahr` (Simulation). */
export interface KrisenPlanEintrag {
  krise: Krise;
  land: KrisenLand;
  startJahr: number;
}

/** Normale Annahmen (nominal) ausserhalb der Krisenjahre */
export interface BasisAnnahmen {
  renditeNominal: number;
  renditeBargeld: number;
  inflation: number;
  /** Wertänderung Wohneigentum in normalen Jahren (sonst `renditeNominal`) */
  wohneigentumNominal?: number;
}

/** Jahreswerte für die Simulation (alle nominal) */
export interface JahresRenditen {
  wertschriften: number;
  wohneigentum: number;
  bargeld: number;
  inflation: number;
  /** Historisches Jahr (null = normale Annahmen) */
  hist: { land: KrisenLand; jahr: number; krise: string } | null;
}

export function historischesJahr(daten: KrisenDaten, land: KrisenLand, jahr: number): HistJahr | null {
  return daten[land].get(jahr) ?? null;
}

/** Historische Portfoliorendite Wertschriften (Aktienanteil × Aktien + Rest × Obligationen); null = Daten fehlen */
export function wertschriftenHist(h: HistJahr, aktienanteil: number): number | null {
  const w = Math.min(1, Math.max(0, aktienanteil));
  if (h.aktien !== null && h.obligationen !== null) return w * h.aktien + (1 - w) * h.obligationen;
  if (h.aktien !== null && w === 1) return h.aktien;
  if (h.obligationen !== null && w === 0) return h.obligationen;
  return null;
}

/** Portfoliorendite Wertschriften aus Aktien/Obligationen (fehlt ein Wert: normale Annahme) */
export function jahresRenditen(
  basis: BasisAnnahmen,
  aktienanteil: number,
  h: HistJahr | null,
  info: JahresRenditen['hist'] = null,
): JahresRenditen {
  const wohnNormal = basis.wohneigentumNominal ?? basis.renditeNominal;
  if (!h) {
    return {
      wertschriften: basis.renditeNominal,
      wohneigentum: wohnNormal,
      bargeld: basis.renditeBargeld,
      inflation: basis.inflation,
      hist: null,
    };
  }
  return {
    wertschriften: wertschriftenHist(h, aktienanteil) ?? basis.renditeNominal,
    wohneigentum: h.immobilien ?? wohnNormal,
    bargeld: h.geldmarkt ?? basis.renditeBargeld,
    inflation: h.teuerung ?? basis.inflation,
    hist: info,
  };
}

/** Kalenderjahr → abgespieltes historisches Jahr. Bei Überschneidung gilt die später beginnende Krise. */
export function krisenKalender(
  plan: readonly KrisenPlanEintrag[],
): Map<number, { land: KrisenLand; jahr: number; krise: string }> {
  const m = new Map<number, { land: KrisenLand; jahr: number; krise: string }>();
  const sortiert = [...plan].sort((a, b) => a.startJahr - b.startJahr);
  for (const e of sortiert) {
    for (let j = e.krise.von; j <= e.krise.bis; j++) {
      m.set(e.startJahr + (j - e.krise.von), { land: e.land, jahr: j, krise: e.krise.id });
    }
  }
  return m;
}

export interface KrisenModell extends RenditeModell {
  jahresRenditen(t: number): JahresRenditen;
}

/**
 * Rendite-Modell mit Krisenjahren. `startKalenderjahr` ist das Kalenderjahr zu t = 0.
 */
export function krisenModell(
  basis: BasisAnnahmen,
  aktienanteil: number,
  plan: readonly KrisenPlanEintrag[],
  daten: KrisenDaten,
  startKalenderjahr: number,
): KrisenModell {
  const kal = krisenKalender(plan);
  const cache = new Map<number, JahresRenditen>();
  const jr = (t: number): JahresRenditen => {
    let r = cache.get(t);
    if (!r) {
      const k = kal.get(startKalenderjahr + t) ?? null;
      r = jahresRenditen(basis, aktienanteil, k ? historischesJahr(daten, k.land, k.jahr) : null, k);
      cache.set(t, r);
    }
    return r;
  };
  return {
    art: 'historisch',
    renditeNominal: (t) => jr(t).wertschriften,
    inflation: (t) => jr(t).inflation,
    wohneigentum: (t) => jr(t).wohneigentum,
    bargeld: (t) => jr(t).bargeld,
    historisch: (t) => jr(t).hist,
    jahresRenditen: jr,
  };
}

/** Realer Wertverlauf des Portfolios während einer Krise (Start = 1) */
export function krisenPfad(
  krise: Krise,
  land: KrisenLand,
  aktienanteil: number,
  daten: KrisenDaten,
  basis: BasisAnnahmen,
): { jahr: number; wertReal: number; rendite: number; teuerung: number }[] {
  let wert = 1;
  const out: { jahr: number; wertReal: number; rendite: number; teuerung: number }[] = [];
  for (let j = krise.von; j <= krise.bis; j++) {
    const r = jahresRenditen(basis, aktienanteil, historischesJahr(daten, land, j));
    wert *= (1 + r.wertschriften) / (1 + r.inflation);
    out.push({ jahr: j, wertReal: wert, rendite: r.wertschriften, teuerung: r.inflation });
  }
  return out;
}

/** Grösster realer Rückgang (Peak-to-Trough) auf dem Krisenpfad, z.B. −0.35 */
export function maxRealerRueckgang(pfad: readonly { wertReal: number }[]): number {
  let peak = 1;
  let dd = 0;
  for (const p of pfad) {
    peak = Math.max(peak, p.wertReal);
    dd = Math.min(dd, p.wertReal / peak - 1);
  }
  return dd;
}

/** Sind für alle Krisenjahre Aktien- und Obligationendaten vorhanden? */
export function datenVollstaendig(krise: Krise, land: KrisenLand, daten: KrisenDaten): boolean {
  for (let j = krise.von; j <= krise.bis; j++) {
    const h = historischesJahr(daten, land, j);
    if (!h || h.aktien === null || h.obligationen === null || h.teuerung === null) return false;
  }
  return true;
}

/** Start einer gewählten Krise: festes Kalenderjahr, X Jahre nach dem Rücktritt oder Alter einer Person */
export type KrisenStart =
  | { art: 'jahr'; jahr: number }
  | { art: 'nachRuecktritt'; jahre: number }
  | { art: 'alter'; alter: number; person: number };

export interface KrisenWahl {
  krise: Krise;
  land: KrisenLand;
  start: KrisenStart;
}

export interface KrisenOptionen {
  wahl: readonly KrisenWahl[];
  daten: KrisenDaten;
  aktienanteil: number;
  /**
   * Nominale Renditen in normalen Jahren (Modus «Automatisch»): so erhöht, dass der Durchschnitt
   * inklusive Krisenjahren der Annahme entspricht (keine Doppelzählung). Fehlt = Annahme unverändert.
   */
  normal?: { wertschriften: number; wohneigentum: number };
  /**
   * Modus «Automatisch» (Schema 7): normale Jahre in der Simulation so ausgleichen, dass der reale
   * Durchschnitt über den eigenen Planungshorizont der Annahme entspricht (`ausgleichHorizont`).
   * Hat Vorrang vor `normal`.
   */
  ausgleichHorizont?: boolean;
}

/** Löst «X Jahre nach dem Rücktritt» bzw. «im Alter X» in Kalenderjahre auf. */
export function krisenPlan(
  wahl: readonly KrisenWahl[],
  ruecktrittJahr: number,
  geburtsjahre: readonly number[] = [],
): KrisenPlanEintrag[] {
  return wahl.map((w) => ({
    krise: w.krise,
    land: w.land,
    startJahr:
      w.start.art === 'jahr'
        ? w.start.jahr
        : w.start.art === 'alter'
          ? (geburtsjahre[w.start.person] ?? geburtsjahre[0] ?? ruecktrittJahr) + w.start.alter
          : ruecktrittJahr + w.start.jahre,
  }));
}

/** Reale Log-Summen der Krisenjahre mit Daten (Wertschriften bzw. Wohneigentum) */
interface LogSummen {
  wsSumme: number;
  wsJahre: number;
  wohnSumme: number;
  wohnJahre: number;
  /** Krisenjahre ohne Daten des Kanals: dort gilt die normale Rendite, aber die historische Teuerung */
  wsInflKorrektur: number;
  wohnInflKorrektur: number;
}

const leer = (): LogSummen => ({
  wsSumme: 0,
  wsJahre: 0,
  wohnSumme: 0,
  wohnJahre: 0,
  wsInflKorrektur: 0,
  wohnInflKorrektur: 0,
});

function krisenLog(
  jahre: Iterable<{ land: KrisenLand; jahr: number }>,
  aktienanteil: number,
  daten: KrisenDaten,
  inflation: number,
): LogSummen {
  const s = leer();
  for (const k of jahre) {
    const h = historischesJahr(daten, k.land, k.jahr);
    if (!h) continue;
    const i = h.teuerung ?? inflation;
    const korr = Math.log(1 + i) - Math.log(1 + inflation);
    const ws = wertschriftenHist(h, aktienanteil);
    if (ws !== null) {
      s.wsSumme += Math.log((1 + ws) / (1 + i));
      s.wsJahre++;
    } else s.wsInflKorrektur += korr;
    if (h.immobilien !== null) {
      s.wohnSumme += Math.log((1 + h.immobilien) / (1 + i));
      s.wohnJahre++;
    } else s.wohnInflKorrektur += korr;
  }
  return s;
}

/**
 * Nominale Rendite für normale Jahre, damit der reale geometrische Durchschnitt über `jahre` Jahre
 * (davon `krisenJahre` mit der realen Log-Summe `krisenSumme`) der Annahme entspricht.
 * `inflKorrektur`: Summe log(1 + Teuerung) − log(1 + Annahme) der Jahre mit normaler Rendite, aber
 * historischer Teuerung (Krisenjahre ohne Daten für diesen Kanal).
 */
function normalRendite(
  annahme: number,
  inflation: number,
  jahre: number,
  krisenJahre: number,
  krisenSumme: number,
  inflKorrektur = 0,
) {
  const normaleJahre = jahre - krisenJahre;
  if (krisenJahre <= 0 || normaleJahre <= 0) return annahme;
  const g = Math.log((1 + annahme) / (1 + inflation));
  const logNominal = (jahre * g - krisenSumme + inflKorrektur) / normaleJahre + Math.log(1 + inflation);
  return Math.exp(logNominal) - 1;
}

/**
 * Ausgleich für eine sich wiederholende, feste Krisenfolge (Modus «Automatisch»): Über einen ganzen
 * Umlauf (`zyklusJahre`, Krisenbeginne `plan` relativ zu Jahr 0) entspricht die reale Durchschnitts-
 * rendite genau der Annahme. Gezählt wird das Fenster [zyklusJahre, 2 × zyklusJahre) eines doppelten
 * Umlaufs, damit Krisen, die über das Ende hinausreichen, korrekt mitzählen.
 */
export function ausgleichZyklus(
  basis: BasisAnnahmen,
  aktienanteil: number,
  plan: readonly KrisenPlanEintrag[],
  zyklusJahre: number,
  daten: KrisenDaten,
): { wertschriften: number; wohneigentum: number } {
  const L = Math.max(1, Math.round(zyklusJahre));
  const doppelt = [...plan, ...plan.map((p) => ({ ...p, startJahr: p.startJahr + L }))];
  const kal = krisenKalender(doppelt);
  const fenster: { land: KrisenLand; jahr: number }[] = [];
  for (let j = L; j < 2 * L; j++) {
    const k = kal.get(j);
    if (k) fenster.push(k);
  }
  const s = krisenLog(fenster, aktienanteil, daten, basis.inflation);
  return {
    wertschriften: normalRendite(basis.renditeNominal, basis.inflation, L, s.wsJahre, s.wsSumme, s.wsInflKorrektur),
    wohneigentum: normalRendite(
      basis.renditeNominal,
      basis.inflation,
      L,
      s.wohnJahre,
      s.wohnSumme,
      s.wohnInflKorrektur,
    ),
  };
}

/**
 * Ausgleich im Erwartungswert für zufällig wiederkehrende Krisen (Monte Carlo): Jedes normale Jahr
 * startet mit Wahrscheinlichkeit p = proDekade/10 eine zufällige Krise aus dem Pool. Ein Zyklus hat im
 * Mittel (1 − p)/p normale Jahre plus eine Krise; die normale Rendite wird so gewählt, dass die
 * erwartete reale Rendite pro Jahr der Annahme entspricht.
 */
export function ausgleichErwartet(
  basis: BasisAnnahmen,
  aktienanteil: number,
  pool: readonly { krise: Krise; land: KrisenLand }[],
  proDekade: number,
  daten: KrisenDaten,
): { wertschriften: number; wohneigentum: number } {
  const p = Math.min(1, Math.max(0, proDekade / 10));
  if (p <= 0 || pool.length === 0) return { wertschriften: basis.renditeNominal, wohneigentum: basis.renditeNominal };
  let laenge = 0;
  const summe = leer();
  for (const k of pool) {
    const jahre: { land: KrisenLand; jahr: number }[] = [];
    for (let j = k.krise.von; j <= k.krise.bis; j++) jahre.push({ land: k.land, jahr: j });
    laenge += jahre.length;
    const s = krisenLog(jahre, aktienanteil, daten, basis.inflation);
    summe.wsSumme += s.wsSumme;
    summe.wsJahre += s.wsJahre;
    summe.wohnSumme += s.wohnSumme;
    summe.wohnJahre += s.wohnJahre;
    summe.wsInflKorrektur += s.wsInflKorrektur;
    summe.wohnInflKorrektur += s.wohnInflKorrektur;
  }
  const n = pool.length;
  // erwartete Jahre pro Zyklus (normale Jahre + mittlere Krisenlänge)
  const zyklus = (1 - p) / p + laenge / n;
  return {
    wertschriften: normalRendite(
      basis.renditeNominal,
      basis.inflation,
      zyklus,
      summe.wsJahre / n,
      summe.wsSumme / n,
      summe.wsInflKorrektur / n,
    ),
    wohneigentum: normalRendite(
      basis.renditeNominal,
      basis.inflation,
      zyklus,
      summe.wohnJahre / n,
      summe.wohnSumme / n,
      summe.wohnInflKorrektur / n,
    ),
  };
}

/**
 * Ausgleich über den eigenen Planungshorizont (Modus «Automatisch», Schema 7): Die normalen Jahre
 * werden so erhöht, dass der reale geometrische Durchschnitt von heute bis zum Planungsalter
 * (inklusive der Krisenjahre, die in diesen Zeitraum fallen, abgeschnitten am Horizontende) genau
 * der Annahme entspricht – für Wertschriften und Wohneigentum getrennt. `jahre` = Kalenderjahre mit
 * Gewicht (erstes Jahr: Anteil der simulierten Monate).
 */
export function ausgleichHorizont(
  basis: BasisAnnahmen,
  aktienanteil: number,
  plan: readonly KrisenPlanEintrag[],
  jahre: readonly { jahr: number; gewicht: number }[],
  daten: KrisenDaten,
): { wertschriften: number; wohneigentum: number } {
  const kal = krisenKalender(plan);
  const total = jahre.reduce((s, j) => s + j.gewicht, 0);
  const s = leer();
  for (const j of jahre) {
    const k = kal.get(j.jahr);
    if (!k) continue;
    const e = krisenLog([k], aktienanteil, daten, basis.inflation);
    s.wsSumme += e.wsSumme * j.gewicht;
    s.wsJahre += e.wsJahre * j.gewicht;
    s.wohnSumme += e.wohnSumme * j.gewicht;
    s.wohnJahre += e.wohnJahre * j.gewicht;
    s.wsInflKorrektur += e.wsInflKorrektur * j.gewicht;
    s.wohnInflKorrektur += e.wohnInflKorrektur * j.gewicht;
  }
  return {
    wertschriften: normalRendite(basis.renditeNominal, basis.inflation, total, s.wsJahre, s.wsSumme, s.wsInflKorrektur),
    wohneigentum: normalRendite(
      basis.renditeNominal,
      basis.inflation,
      total,
      s.wohnJahre,
      s.wohnSumme,
      s.wohnInflKorrektur,
    ),
  };
}

/**
 * Ausgleich im Erwartungswert über einen endlichen Horizont (Monte Carlo «wiederkehrend», Schema 7):
 * wie `ausgleichErwartet`, aber exakt für `gewichte.length` Jahre ab einem normalen Startjahr, mit
 * am Horizontende abgeschnittenen Krisen (Rekursion über die Wahrscheinlichkeit, dass im Jahr t eine
 * neue Krise beginnen kann). Damit entspricht die erwartete reale Log-Rendite über den Planungs-
 * zeitraum genau der Annahme.
 */
export function ausgleichErwartetHorizont(
  basis: BasisAnnahmen,
  aktienanteil: number,
  pool: readonly { krise: Krise; land: KrisenLand }[],
  proDekade: number,
  gewichte: readonly number[],
  daten: KrisenDaten,
): { wertschriften: number; wohneigentum: number } {
  const p = Math.min(1, Math.max(0, proDekade / 10));
  const n = gewichte.length;
  if (p <= 0 || pool.length === 0 || n === 0)
    return { wertschriften: basis.renditeNominal, wohneigentum: basis.renditeNominal };
  const logs = pool.map((k) => {
    const out: LogSummen[] = [];
    for (let j = k.krise.von; j <= k.krise.bis; j++)
      out.push(krisenLog([{ land: k.land, jahr: j }], aktienanteil, daten, basis.inflation));
    return out;
  });
  const frei = new Array<number>(n + 1).fill(0);
  frei[0] = 1;
  const s = leer();
  const total = gewichte.reduce((a, b) => a + b, 0);
  const q = p / pool.length;
  for (let t = 0; t < n; t++) {
    const f = frei[t] ?? 0;
    if (!(f > 0)) continue;
    frei[t + 1] = (frei[t + 1] ?? 0) + f * (1 - p);
    for (const jahre of logs) {
      const w = f * q;
      jahre.forEach((e, j) => {
        const g = gewichte[t + j];
        if (g === undefined) return;
        s.wsSumme += w * g * e.wsSumme;
        s.wsJahre += w * g * e.wsJahre;
        s.wohnSumme += w * g * e.wohnSumme;
        s.wohnJahre += w * g * e.wohnJahre;
        s.wsInflKorrektur += w * g * e.wsInflKorrektur;
        s.wohnInflKorrektur += w * g * e.wohnInflKorrektur;
      });
      if (t + jahre.length <= n) frei[t + jahre.length] = (frei[t + jahre.length] ?? 0) + w;
    }
  }
  return {
    wertschriften: normalRendite(basis.renditeNominal, basis.inflation, total, s.wsJahre, s.wsSumme, s.wsInflKorrektur),
    wohneigentum: normalRendite(
      basis.renditeNominal,
      basis.inflation,
      total,
      s.wohnJahre,
      s.wohnSumme,
      s.wohnInflKorrektur,
    ),
  };
}
