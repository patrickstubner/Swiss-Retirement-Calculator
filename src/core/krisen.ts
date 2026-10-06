/**
 * Krisenszenarien: reale historische Jahresrenditen und Teuerung auf das Portfolio abspielen.
 * Daten: data/krisen-historisch.json (JST R6 1871–2020, Schweiz 2021–2024 aus SNB/BFS; Quellen und
 * Lizenzen in docs/krisen.md). Ausserhalb der Krisenjahre gelten die normalen Annahmen.
 * Eine eigene Krise (`EigeneKrise`) ist ein Stresstest ohne historische Reihe.
 */
import type { RenditeModell } from './renditen';
import { filterAnzeigename } from './text';
import type { EigeneKrise } from './typen';

/** Id einer eigenen Krise in `KrisenAuswahl` */
export const EIGENE_KRISE_ID = 'eigen';
/**
 * Höchstens so viele geplante Krisen im Modus «Individuell» (Oberfläche und Speicher).
 * «Automatische Krisen übernehmen» muss die ganze Folge fassen: bei 5 Krisen pro Dekade
 * über 200 Jahre entstehen höchstens 101 Beginne (Abstand 2 Jahre, Versatz 0 bis 200).
 * 120 deckt diese Folge und lässt danach noch einige Einträge von Hand zu.
 */
export const MAX_GEPLANTE_KRISEN = 120;
/** Rohdaten aus Link oder Speicher, bevor unbekannte Ids verworfen werden. */
export const MAX_KRISEN_ROHDATEN = MAX_GEPLANTE_KRISEN * 2;
/**
 * Jahre vor dem Planungshorizont, die ein Startjahr noch haben darf.
 * Die längste Katalogkrise dauert 14 Jahre, eine eigene Krise höchstens 23.
 * Ein früherer Beginn zählt mit, sobald ein Krisenjahr im Horizont liegt.
 */
export const KRISEN_START_VORLAUF = 30;
/**
 * Abstand «Jahre nach dem Rücktritt» eines Listeneintrags.
 * Die erste automatische Krise liegt zwischen −30 und 60 Jahren, die Folge reicht
 * danach 200 Jahre (Versatz 0…200). Die Übernahme speichert diesen Abstand. Eine
 * engere Grenze würde ihn beim Speichern klemmen, die Krisen würden nicht mehr mitwandern.
 */
export const JAHRE_NACH_MIN = -30;
export const JAHRE_NACH_MAX = 260;
export const EIGENE_NAME_MAX = 40;

const EIGEN_RUECKGANG: readonly [number, number] = [-0.8, -0.05];
const EIGEN_DAUER: readonly [number, number] = [1, 8];
const EIGEN_ERHOLUNG: readonly [number, number] = [0, 15];

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

/**
 * Eintrag im Krisenplan: Krise `krise` beginnt im Kalenderjahr `startJahr`.
 * `startMonat` 1 = Januar = das ganze Jahr (bisheriges Verhalten). Ein späterer Monat
 * ist eine Annäherung: die Jahresrendite wird geometrisch auf die Monate verteilt.
 */
export interface KrisenPlanEintrag {
  krise: Krise;
  land: KrisenLand;
  startJahr: number;
  /** 1–12. Fehlt = Januar. */
  startMonat?: number;
  /** Gesetzte eigene Krise: die Jahresrendite kommt nicht aus der Historie */
  eigen?: EigeneKrise;
}

/** Anteil eines Kalenderjahres mit einer Rendite (Summe der Scheiben eines Jahres = 1). */
export interface KrisenScheibe {
  gewicht: number;
  land: KrisenLand;
  /** Historisches Jahr. Fehlt zusammen mit `normal`: wird nicht gesetzt. */
  jahr?: number;
  krise?: string;
  name?: string;
  kurz?: string;
  eigenReal?: number;
  /** Monate mit der normalen Annahme, nicht mit einer Krisenrendite */
  normal?: boolean;
}

/** Was in einem Kalenderjahr abgespielt wird. Bei Überschneidung bleibt die später beginnende Krise. */
export interface KrisenKalenderZelle {
  land: KrisenLand;
  /** Historisches Jahr bzw. bei einer eigenen Krise der Index innerhalb der Krise (ab `von`) */
  jahr: number;
  krise: string;
  name?: string;
  kurz?: string;
  /** Reale Wertschriftenrendite einer eigenen Krise in diesem Jahr */
  eigenReal?: number;
  /** Erster und letzter Monat (1–12), in dem in diesem Kalenderjahr eine Krise liegt */
  monatVon: number;
  monatBis: number;
  /**
   * Gemisch aus Krisen- und normalen Monaten. Fehlt = das ganze Jahr ist genau eine
   * historische oder eigene Jahresrendite (Januar-Beginn, bisheriges Verhalten).
   */
  scheiben?: KrisenScheibe[];
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
  hist: {
    land: KrisenLand;
    jahr: number;
    krise: string;
    name?: string;
    kurz?: string;
    monatVon?: number;
    monatBis?: number;
  } | null;
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

interface MonatSlot {
  land: KrisenLand;
  jahr: number;
  krise: string;
  name?: string;
  kurz?: string;
  eigenReal?: number;
  key: string;
}

/** Späterer Beginn gewinnt. Bei gleichem Beginn bleibt die Listenreihenfolge (stabil sortiert). */
function planNachBeginn(plan: readonly KrisenPlanEintrag[]): KrisenPlanEintrag[] {
  return [...plan].sort((a, b) => a.startJahr - b.startJahr || krisenMonat(a.startMonat) - krisenMonat(b.startMonat));
}

/**
 * Monat für Monat, welche Krise gilt. `null` = normale Annahme.
 * Ein Beginn im Januar füllt zwölf gleiche Monate und rechnet damit wie bisher jahrweise.
 */
function monatsPlan(plan: readonly KrisenPlanEintrag[]): Map<number, (MonatSlot | null)[]> {
  const belegt = new Map<number, (MonatSlot | null)[]>();
  for (const e of planNachBeginn(plan)) {
    const m0 = krisenMonat(e.startMonat) - 1;
    const laenge = e.krise.bis - e.krise.von + 1;
    if (laenge <= 0) continue;
    const startAbs = e.startJahr * 12 + m0;
    for (let i = 0; i < laenge * 12; i++) {
      const abs = startAbs + i;
      const jahr = Math.floor(abs / 12);
      const monat = abs - jahr * 12;
      let slots = belegt.get(jahr);
      if (!slots) {
        slots = Array.from({ length: 12 }, () => null);
        belegt.set(jahr, slots);
      }
      const offset = Math.floor(i / 12);
      const histJahr = e.krise.von + offset;
      const real = e.eigen ? eigenReal(e.eigen, offset) : undefined;
      slots[monat] = {
        land: e.land,
        jahr: histJahr,
        krise: e.krise.id,
        ...(e.eigen ? { name: e.krise.name, kurz: e.krise.kurz, eigenReal: real } : {}),
        key: e.eigen ? `e:${e.krise.id}:${offset}` : `${e.land}:${histJahr}:${e.krise.id}`,
      };
    }
  }
  return belegt;
}

function zelleAusMonaten(slots: readonly (MonatSlot | null)[]): KrisenKalenderZelle | null {
  let erste = -1;
  let letzte = -1;
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) continue;
    if (erste < 0) erste = i;
    letzte = i;
  }
  if (erste < 0 || letzte < 0) return null;
  const ersteSlot = slots[erste];
  if (!ersteSlot) return null;
  const rein = slots.every((s) => s?.key === ersteSlot.key);
  if (rein) {
    return {
      land: ersteSlot.land,
      jahr: ersteSlot.jahr,
      krise: ersteSlot.krise,
      ...(ersteSlot.name ? { name: ersteSlot.name, kurz: ersteSlot.kurz } : {}),
      ...(ersteSlot.eigenReal !== undefined ? { eigenReal: ersteSlot.eigenReal } : {}),
      monatVon: 1,
      monatBis: 12,
    };
  }
  const scheiben: KrisenScheibe[] = [];
  for (let i = 0; i < slots.length; ) {
    const key = slots[i]?.key ?? '';
    let j = i + 1;
    while (j < slots.length && (slots[j]?.key ?? '') === key) j++;
    const gewicht = (j - i) / 12;
    const s = slots[i];
    if (!s) scheiben.push({ gewicht, land: 'CHE', normal: true });
    else
      scheiben.push({
        gewicht,
        land: s.land,
        jahr: s.jahr,
        krise: s.krise,
        ...(s.name ? { name: s.name, kurz: s.kurz } : {}),
        ...(s.eigenReal !== undefined ? { eigenReal: s.eigenReal } : {}),
      });
    i = j;
  }
  const dominierend = scheiben
    .filter((s) => !s.normal && s.jahr !== undefined && s.krise)
    .sort((a, b) => b.gewicht - a.gewicht)[0];
  if (!dominierend || dominierend.jahr === undefined || !dominierend.krise) return null;
  return {
    land: dominierend.land,
    jahr: dominierend.jahr,
    krise: dominierend.krise,
    ...(dominierend.name ? { name: dominierend.name, kurz: dominierend.kurz } : {}),
    monatVon: erste + 1,
    monatBis: letzte + 1,
    scheiben,
  };
}

/**
 * Kalenderjahr → abgespieltes Jahr. Bei Überschneidung gilt die später beginnende Krise
 * (bei gleichem Beginn der spätere Eintrag der Liste). Jedes Kalenderjahr hat genau einen
 * Wert: Krisen werden nicht addiert. Ein Beginn nach Januar mischt die Monate geometrisch.
 */
export function krisenKalender(plan: readonly KrisenPlanEintrag[]): Map<number, KrisenKalenderZelle> {
  const m = new Map<number, KrisenKalenderZelle>();
  for (const [jahr, slots] of monatsPlan(plan)) {
    const zelle = zelleAusMonaten(slots);
    if (zelle) m.set(jahr, zelle);
  }
  return m;
}

function faktor(x: number, gewicht: number): number {
  const basis = 1 + x;
  if (!(basis > 0)) return 1e-12 ** gewicht;
  return basis ** gewicht;
}

/** Geometrisches Mittel der Monatsscheiben über ein Kalenderjahr. */
function gemischteRendite(
  zelle: KrisenKalenderZelle,
  basis: BasisAnnahmen,
  aktienanteil: number,
  daten: KrisenDaten,
): JahresRenditen {
  let ws = 1;
  let wohn = 1;
  let bar = 1;
  let inf = 1;
  for (const s of zelle.scheiben ?? []) {
    const h =
      s.normal || s.jahr === undefined
        ? null
        : s.eigenReal !== undefined
          ? synthetischesJahr({ ...zelle, jahr: s.jahr, eigenReal: s.eigenReal }, basis.inflation)
          : historischesJahr(daten, s.land, s.jahr);
    const r = jahresRenditen(basis, aktienanteil, h, null);
    ws *= faktor(r.wertschriften, s.gewicht);
    wohn *= faktor(r.wohneigentum, s.gewicht);
    bar *= faktor(r.bargeld, s.gewicht);
    inf *= faktor(r.inflation, s.gewicht);
  }
  return {
    wertschriften: ws - 1,
    wohneigentum: wohn - 1,
    bargeld: bar - 1,
    inflation: inf - 1,
    hist: {
      land: zelle.land,
      jahr: zelle.jahr,
      krise: zelle.krise,
      ...(zelle.name ? { name: zelle.name, kurz: zelle.kurz } : {}),
      monatVon: zelle.monatVon,
      monatBis: zelle.monatBis,
    },
  };
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
      if (k?.scheiben) {
        r = gemischteRendite(k, basis, aktienanteil, daten);
        cache.set(t, r);
        return r;
      }
      const info = k
        ? {
            land: k.land,
            jahr: k.jahr,
            krise: k.krise,
            ...(k.name ? { name: k.name, kurz: k.kurz } : {}),
            monatVon: k.monatVon,
            monatBis: k.monatBis,
          }
        : null;
      const h = !k
        ? null
        : k.eigenReal !== undefined
          ? synthetischesJahr(k, basis.inflation)
          : historischesJahr(daten, k.land, k.jahr);
      r = jahresRenditen(basis, aktienanteil, h, info);
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

/**
 * Start einer gewählten Krise: festes Kalenderjahr, X Jahre nach dem Rücktritt oder Alter einer Person.
 * `monat` ist der Monat im aufgelösten Kalenderjahr (1 = Januar = ganzes Jahr).
 */
export type KrisenStart =
  | { art: 'jahr'; jahr: number; monat?: number }
  | { art: 'nachRuecktritt'; jahre: number; monat?: number }
  | { art: 'alter'; alter: number; person: number; monat?: number };

/** Monat 1–12. Fehlende oder ungültige Werte werden Januar. */
export function krisenMonat(monat: number | undefined): number {
  if (monat === undefined || !Number.isFinite(monat)) return 1;
  return Math.min(12, Math.max(1, Math.round(monat)));
}

export interface KrisenWahl {
  krise: Krise;
  land: KrisenLand;
  start: KrisenStart;
  eigen?: EigeneKrise;
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
    ...(w.eigen ? { eigen: w.eigen } : {}),
    startMonat: krisenMonat(w.start.monat),
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
 * Unter so vielen normalen Jahren ist der Ausgleich instabil: schon zwei Krisenjahre mit −50 %
 * und ein Viertel normales Jahr verlangen eine absurde Normalrendite. Dieselbe Untergrenze
 * gilt für «Automatisch» und «Individuell».
 */
export const AUSGLEICH_MIN_NORMALE_JAHRE = 3;
/**
 * Ober- und Untergrenze der ausgeglichenen Nominalrendite. Dieselbe Spanne wie die
 * Renditeannahme in der Eingabe (`annahmen.renditeNominal`). Darüber wäre der Satz
 * keine Annahme mehr, die die App sonst zulässt.
 */
export const AUSGLEICH_RENDITE_MIN = -0.2;
export const AUSGLEICH_RENDITE_MAX = 0.3;

export type AusgleichHinweis = 'zuWenig' | 'gedeckelt';

/**
 * Nominale Rendite für normale Jahre, damit der reale geometrische Durchschnitt über `jahre` Jahre
 * (davon `krisenJahre` mit der realen Log-Summe `krisenSumme`) der Annahme entspricht.
 * `inflKorrektur`: Summe log(1 + Teuerung) − log(1 + Annahme) der Jahre mit normaler Rendite, aber
 * historischer Teuerung (Krisenjahre ohne Daten für diesen Kanal).
 * Unter drei normalen Jahren entfällt der Ausgleich. Ausserhalb −20 %…30 % wird gedeckelt.
 */
function normalRendite(
  annahme: number,
  inflation: number,
  jahre: number,
  krisenJahre: number,
  krisenSumme: number,
  inflKorrektur = 0,
): { wert: number; hinweis?: AusgleichHinweis } {
  const normaleJahre = jahre - krisenJahre;
  if (krisenJahre <= 0 || normaleJahre <= 0) return { wert: annahme };
  if (normaleJahre < AUSGLEICH_MIN_NORMALE_JAHRE) return { wert: annahme, hinweis: 'zuWenig' };
  const g = Math.log((1 + annahme) / (1 + inflation));
  const logNominal = (jahre * g - krisenSumme + inflKorrektur) / normaleJahre + Math.log(1 + inflation);
  const roh = Math.exp(logNominal) - 1;
  if (!Number.isFinite(roh)) return { wert: annahme, hinweis: 'zuWenig' };
  if (roh > AUSGLEICH_RENDITE_MAX || roh < AUSGLEICH_RENDITE_MIN)
    return {
      wert: Math.min(AUSGLEICH_RENDITE_MAX, Math.max(AUSGLEICH_RENDITE_MIN, roh)),
      hinweis: 'gedeckelt',
    };
  return { wert: roh };
}

function hinweisZusammen(
  a: AusgleichHinweis | undefined,
  b: AusgleichHinweis | undefined,
): AusgleichHinweis | undefined {
  if (a === 'zuWenig' || b === 'zuWenig') return 'zuWenig';
  if (a === 'gedeckelt' || b === 'gedeckelt') return 'gedeckelt';
  return undefined;
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
    wertschriften: normalRendite(basis.renditeNominal, basis.inflation, L, s.wsJahre, s.wsSumme, s.wsInflKorrektur)
      .wert,
    wohneigentum: normalRendite(basis.renditeNominal, basis.inflation, L, s.wohnJahre, s.wohnSumme, s.wohnInflKorrektur)
      .wert,
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
    ).wert,
    wohneigentum: normalRendite(
      basis.renditeNominal,
      basis.inflation,
      zyklus,
      summe.wohnJahre / n,
      summe.wohnSumme / n,
      summe.wohnInflKorrektur / n,
    ).wert,
  };
}

/**
 * Ausgleich über den eigenen Planungshorizont (Modus «Automatisch», Schema 7): Die normalen Jahre
 * werden so erhöht, dass der reale geometrische Durchschnitt von heute bis zum Planungsalter
 * (inklusive der Krisenjahre, die in diesen Zeitraum fallen, abgeschnitten am Horizontende) genau
 * der Annahme entspricht – für Wertschriften und Wohneigentum getrennt. `jahre` = Kalenderjahre mit
 * Gewicht (erstes Jahr: Anteil der simulierten Monate).
 * Eine eigene Krise hat kein historisches Jahr. Ihre synthetische reale Wertschriftenrendite
 * (`eigenReal`) zählt mit; Hauspreise, Teuerung und Bargeld bleiben die Annahme.
 */
function addiereLog(ziel: LogSummen, e: LogSummen, gewicht: number) {
  ziel.wsSumme += e.wsSumme * gewicht;
  ziel.wsJahre += e.wsJahre * gewicht;
  ziel.wohnSumme += e.wohnSumme * gewicht;
  ziel.wohnJahre += e.wohnJahre * gewicht;
  ziel.wsInflKorrektur += e.wsInflKorrektur * gewicht;
  ziel.wohnInflKorrektur += e.wohnInflKorrektur * gewicht;
}

/** Log-Summe einer gemischten Jahreszelle. Normale Monate zählen nicht als Krisenjahre. */
function scheibenLog(
  scheiben: readonly KrisenScheibe[],
  aktienanteil: number,
  daten: KrisenDaten,
  inflation: number,
): LogSummen {
  const s = leer();
  for (const sch of scheiben) {
    if (sch.normal || sch.jahr === undefined) continue;
    if (sch.eigenReal !== undefined) {
      if (1 + sch.eigenReal > 0) {
        s.wsSumme += Math.log(1 + sch.eigenReal) * sch.gewicht;
        s.wsJahre += sch.gewicht;
      }
      continue;
    }
    addiereLog(s, krisenLog([{ land: sch.land, jahr: sch.jahr }], aktienanteil, daten, inflation), sch.gewicht);
  }
  return s;
}

export function ausgleichHorizont(
  basis: BasisAnnahmen,
  aktienanteil: number,
  plan: readonly KrisenPlanEintrag[],
  jahre: readonly { jahr: number; gewicht: number }[],
  daten: KrisenDaten,
): { wertschriften: number; wohneigentum: number; hinweis?: AusgleichHinweis } {
  const kal = krisenKalender(plan);
  const total = jahre.reduce((s, j) => s + j.gewicht, 0);
  const s = leer();
  for (const j of jahre) {
    const k = kal.get(j.jahr);
    if (!k) continue;
    if (k.scheiben) {
      addiereLog(s, scheibenLog(k.scheiben, aktienanteil, daten, basis.inflation), j.gewicht);
      continue;
    }
    if (k.eigenReal !== undefined) {
      if (1 + k.eigenReal > 0) {
        s.wsSumme += Math.log(1 + k.eigenReal) * j.gewicht;
        s.wsJahre += j.gewicht;
      }
      continue;
    }
    addiereLog(s, krisenLog([k], aktienanteil, daten, basis.inflation), j.gewicht);
  }
  const ws = normalRendite(basis.renditeNominal, basis.inflation, total, s.wsJahre, s.wsSumme, s.wsInflKorrektur);
  const wohn = normalRendite(
    basis.renditeNominal,
    basis.inflation,
    total,
    s.wohnJahre,
    s.wohnSumme,
    s.wohnInflKorrektur,
  );
  const hinweis = hinweisZusammen(ws.hinweis, wohn.hinweis);
  return {
    wertschriften: ws.wert,
    wohneigentum: wohn.wert,
    ...(hinweis ? { hinweis } : {}),
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
    wertschriften: normalRendite(basis.renditeNominal, basis.inflation, total, s.wsJahre, s.wsSumme, s.wsInflKorrektur)
      .wert,
    wohneigentum: normalRendite(
      basis.renditeNominal,
      basis.inflation,
      total,
      s.wohnJahre,
      s.wohnSumme,
      s.wohnInflKorrektur,
    ).wert,
  };
}

/** Standard einer neuen eigenen Krise (Modellannahme, keine historische Zahl). */
export function standardEigeneKrise(): EigeneKrise {
  return { name: 'Eigene Krise', rueckgang: -0.3, dauer: 2, erholung: 4 };
}

/** Steuerzeichen, unsichtbare Unicode-Zeichen, DEL und spitze Klammern entfernen. Leerzeichen bleiben (Eingabe). */
export function filterKrisenName(roh: string): string {
  return filterAnzeigename(roh, EIGENE_NAME_MAX, true);
}

/** Anzeigename: Steuerzeichen und spitze Klammern weg, höchstens 40 Zeichen. */
export function bereinigeKrisenName(roh: unknown): string {
  const s = typeof roh === 'string' ? roh : '';
  const sauber = filterKrisenName(s).replace(/\s+/g, ' ').trim();
  return sauber || 'Eigene Krise';
}

/** Kennung eines Listeneintrags: nur harmlose Zeichen, sonst ein Ersatz. */
export function bereinigeKrisenUid(roh: unknown, index: number): string {
  const s = typeof roh === 'string' ? roh.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
  return s || `kr-${index}`;
}

function klemmeZahl(x: unknown, sonst: number, min: number, max: number): number {
  const n = typeof x === 'number' && Number.isFinite(x) ? x : sonst;
  return Math.min(max, Math.max(min, n));
}

/** Macht eine eigene Krise gültig. Fehlende oder ungültige Felder werden ersetzt, nicht verworfen. */
export function bereinigeEigeneKrise(roh: unknown): EigeneKrise {
  const o = roh !== null && typeof roh === 'object' ? (roh as Record<string, unknown>) : {};
  const std = standardEigeneKrise();
  return {
    name: bereinigeKrisenName(o.name),
    rueckgang: klemmeZahl(o.rueckgang, std.rueckgang, EIGEN_RUECKGANG[0], EIGEN_RUECKGANG[1]),
    dauer: Math.round(klemmeZahl(o.dauer, std.dauer, EIGEN_DAUER[0], EIGEN_DAUER[1])),
    erholung: Math.round(klemmeZahl(o.erholung, std.erholung, EIGEN_ERHOLUNG[0], EIGEN_ERHOLUNG[1])),
  };
}

/**
 * Reale Jahresrendite der Wertschriften in einer eigenen Krise.
 * Rückgang: jedes Jahr derselbe Satz, sodass nach `dauer` Jahren genau `rueckgang` erreicht ist.
 * Erholung: jedes Jahr derselbe Satz, sodass der reale Stand danach wieder 1 ist.
 */
export function eigenReal(e: EigeneKrise, offset: number): number {
  const dauer = Math.max(1, Math.round(e.dauer));
  const erholung = Math.max(0, Math.round(e.erholung));
  const rueckgang = Math.min(EIGEN_RUECKGANG[1], Math.max(EIGEN_RUECKGANG[0], e.rueckgang));
  if (offset < 0 || offset >= dauer + erholung) return 0;
  if (offset < dauer) return (1 + rueckgang) ** (1 / dauer) - 1;
  if (erholung === 0) return 0;
  return (1 / (1 + rueckgang)) ** (1 / erholung) - 1;
}

/** Krise für den Plan: die Jahre 1…Dauer+Erholung stehen für die synthetischen Jahre. */
export function eigeneAlsKrise(uid: string, e: EigeneKrise): Krise {
  const name = bereinigeKrisenName(e.name);
  const jahre = Math.max(1, Math.round(e.dauer) + Math.round(e.erholung));
  const kurz = name.length > 22 ? `${name.slice(0, 21)}…` : name;
  return {
    id: `${EIGENE_KRISE_ID}:${uid}`,
    kurz,
    name,
    von: 1,
    bis: jahre,
    land: 'CHE',
    beschreibung: 'Eigene Annahme, keine historische Krise.',
  };
}

function synthetischesJahr(k: KrisenKalenderZelle, inflation: number): HistJahr {
  const real = k.eigenReal ?? 0;
  const nominal = (1 + real) * (1 + inflation) - 1;
  return {
    jahr: k.jahr,
    aktien: nominal,
    obligationen: nominal,
    geldmarkt: null,
    teuerung: inflation,
    immobilien: null,
  };
}

export interface KrisenUeberlappung {
  jahrVon: number;
  jahrBis: number;
  /** Name der Krise, die in diesen Jahren gilt */
  gilt: string;
  /** Namen der verdrängten Krisen */
  verdraengt: string;
}

/**
 * Jahre, in denen sich mindestens zwei Krisen überschneiden. Es gilt die später beginnende
 * (bei gleichem Beginn der spätere Listeneintrag). Dieselben Jahre wie `krisenKalender`.
 */
export function krisenUeberlappungen(plan: readonly KrisenPlanEintrag[]): KrisenUeberlappung[] {
  const monate = new Map<number, { name: string; verdraengt: string[] }[]>();
  for (const e of planNachBeginn(plan)) {
    const name = e.krise.kurz || e.krise.name;
    const m0 = krisenMonat(e.startMonat) - 1;
    const laenge = e.krise.bis - e.krise.von + 1;
    const startAbs = e.startJahr * 12 + m0;
    for (let i = 0; i < laenge * 12; i++) {
      const abs = startAbs + i;
      const jahr = Math.floor(abs / 12);
      const monat = abs - jahr * 12;
      let slots = monate.get(jahr);
      if (!slots) {
        slots = Array.from({ length: 12 }, () => ({ name: '', verdraengt: [] as string[] }));
        monate.set(jahr, slots);
      }
      const alt = slots[monat];
      if (!alt || alt.name === '') slots[monat] = { name, verdraengt: [] };
      else if (alt.name !== name) slots[monat] = { name, verdraengt: [...alt.verdraengt, alt.name] };
    }
  }
  const belegt = new Map<number, { gilt: string; verdraengt: string[] }>();
  for (const [jahr, slots] of monate) {
    const mitKrise = slots.filter((s) => s.name !== '');
    if (mitKrise.length === 0) continue;
    const namen = new Set(mitKrise.map((s) => s.name));
    const verdraengt = [...new Set(mitKrise.flatMap((s) => s.verdraengt))];
    if (namen.size < 2 && verdraengt.length === 0) continue;
    const gilt = mitKrise[mitKrise.length - 1]?.name ?? '';
    belegt.set(jahr, { gilt, verdraengt });
  }
  const out: KrisenUeberlappung[] = [];
  for (const jahr of [...belegt.keys()].sort((a, b) => a - b)) {
    const z = belegt.get(jahr);
    if (!z || z.verdraengt.length === 0) continue;
    const verdraengt = [...new Set(z.verdraengt)].join(', ');
    const letzte = out[out.length - 1];
    if (letzte && letzte.jahrBis === jahr - 1 && letzte.gilt === z.gilt && letzte.verdraengt === verdraengt) {
      letzte.jahrBis = jahr;
    } else out.push({ jahrVon: jahr, jahrBis: jahr, gilt: z.gilt, verdraengt });
  }
  return out;
}

/** true, wenn mindestens ein Jahr der Krise im Planungshorizont liegt. */
export function kriseImHorizont(
  startJahr: number,
  krise: Pick<Krise, 'von' | 'bis'>,
  von: number,
  bis: number,
  startMonat = 1,
): boolean {
  const ende = startJahr + (krise.bis - krise.von) + (krisenMonat(startMonat) > 1 ? 1 : 0);
  return ende >= von && startJahr <= bis;
}

/** Einträge, von denen kein Jahr im Planungshorizont liegt. */
export function krisenAusserhalb(plan: readonly KrisenPlanEintrag[], von: number, bis: number): KrisenPlanEintrag[] {
  return plan.filter((e) => !kriseImHorizont(e.startJahr, e.krise, von, bis, e.startMonat ?? 1));
}

/**
 * Vorschlag für ein Startjahr im Planungshorizont. Liegt 2036 darin, ist das der Vorschlag
 * (dieselbe erste Krise wie im Modus «Automatisch»); sonst das nächstliegende Jahr im Fenster.
 */
export function krisenStartVorschlag(von: number, bis: number, versatz = 0): number {
  const fensterBis = Math.max(von, bis);
  const ziel = Math.max(von, 2036 + versatz);
  return Math.min(fensterBis, Math.max(von, ziel));
}
