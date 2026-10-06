/**
 * Historische Reihen und Krisenkatalog. Daten: data/krisen-historisch.json und
 * data/krisen-haeufigkeit.json (erzeugt mit scripts/krisen-daten.py; Quellen, Lizenzen, Stand in
 * docs/krisen.md). JST-Daten: CC BY-NC-SA 4.0, Jordà-Schularick-Taylor Macrohistory Database R6.
 */
import haeufigkeitJson from '../../data/krisen-haeufigkeit.json';
import historischJson from '../../data/krisen-historisch.json';
import {
  ausgleichZyklus,
  bereinigeEigeneKrise,
  EIGENE_KRISE_ID,
  eigeneAlsKrise,
  type HistJahr,
  type Krise,
  type KrisenDaten,
  type KrisenLand,
  type KrisenOptionen,
  type KrisenPlanEintrag,
  type KrisenWahl,
  kriseImHorizont,
  krisenPfad,
  krisenPlan,
  MAX_GEPLANTE_KRISEN,
  maxRealerRueckgang,
} from '../core/krisen';
import type { Haushalt, KrisenAuswahl, KrisenEinstellungen } from '../core/typen';

type Zeile = [number, number | null, number | null, number | null, number | null, number | null];

function karte(zeilen: readonly Zeile[]): Map<number, HistJahr> {
  const m = new Map<number, HistJahr>();
  for (const [jahr, aktien, obligationen, geldmarkt, teuerung, immobilien] of zeilen) {
    m.set(jahr, { jahr, aktien, obligationen, geldmarkt, teuerung, immobilien });
  }
  return m;
}

const reihen = historischJson.reihen as unknown as Record<KrisenLand, Zeile[]>;

export const KRISEN_DATEN: KrisenDaten = {
  CHE: karte(reihen.CHE),
  USA: karte(reihen.USA),
  JPN: karte(reihen.JPN),
};

export const KRISEN_DATEN_STAND = historischJson.stand;

export const LAND_NAMEN: Record<KrisenLand, string> = { CHE: 'Schweiz', USA: 'USA', JPN: 'Japan' };

/** Jahresbereich mit Daten pro Land */
export function datenBereich(land: KrisenLand): { von: number; bis: number } {
  const jahre = [...KRISEN_DATEN[land].values()].filter((h) => h.aktien !== null).map((h) => h.jahr);
  return { von: Math.min(...jahre), bis: Math.max(...jahre) };
}

/**
 * Krisenkatalog. Jahre = Kalenderjahre der Jahresdaten (JST R6; Schweiz 2021–2024 SNB/BFS).
 * Die Datenreihe ist wählbar; Standard ist das Land, in dem die Krise am stärksten sichtbar war.
 */
export const KRISEN: readonly Krise[] = [
  {
    id: 'depression1929',
    kurz: 'Grosse Depression',
    name: 'Grosse Depression 1929–1932',
    von: 1929,
    bis: 1932,
    land: 'USA',
    beschreibung: 'Börsenkrach 1929, Bankenkrisen und Deflation. Aktien USA real etwa −50 %.',
  },
  {
    id: 'oelkrise1973',
    kurz: 'Ölkrise',
    name: 'Ölkrise 1973–1974',
    von: 1973,
    bis: 1974,
    land: 'CHE',
    beschreibung: 'Ölpreisschock, hohe Teuerung, Aktien Schweiz 1973/74 nominal −20 % und −33 %.',
  },
  {
    id: 'stagflation1973',
    kurz: 'Stagflation',
    name: 'Stagflation 1973–1981',
    von: 1973,
    bis: 1981,
    land: 'USA',
    beschreibung: 'Neun Jahre mit hoher Teuerung (USA bis über 11 %) und schwachen realen Renditen.',
  },
  {
    id: 'schwarzerMontag1987',
    kurz: 'Schwarzer Montag',
    name: 'Schwarzer Montag 1987',
    von: 1987,
    bis: 1987,
    land: 'CHE',
    beschreibung: 'Börsenkrach im Oktober 1987. Aktien Schweiz im Kalenderjahr etwa −28 %.',
  },
  {
    id: 'japan1990',
    kurz: 'Japan-Krise',
    name: 'Japan ab 1990 (14 Jahre)',
    von: 1990,
    bis: 2003,
    land: 'JPN',
    beschreibung: 'Platzen der Aktien- und Immobilienblase, lange Stagnation mit Deflation.',
  },
  {
    id: 'immobilienCh1990',
    kurz: 'Immobilienkrise CH',
    name: 'Schweizer Immobilienkrise 1990–1997',
    von: 1990,
    bis: 1997,
    land: 'CHE',
    beschreibung: 'Hohe Zinsen, sinkende Hauspreise über mehrere Jahre, Bankenkrise ab 1991.',
  },
  {
    id: 'dotcom2000',
    kurz: 'Dotcom',
    name: 'Dotcom-Krise 2000–2002',
    von: 2000,
    bis: 2002,
    land: 'CHE',
    beschreibung: 'Platzen der Technologieblase. Aktien Schweiz 2001/02 nominal −22 % und −26 %.',
  },
  {
    id: 'finanzkrise2007',
    kurz: 'Finanzkrise',
    name: 'Finanz- und Immobilienkrise 2007–2009',
    von: 2007,
    bis: 2009,
    land: 'CHE',
    beschreibung: 'US-Hypothekenkrise, Bankenkrise 2008. Aktien Schweiz 2008 etwa −34 %.',
  },
  {
    id: 'eurokrise2011',
    kurz: 'Eurokrise',
    name: 'Eurokrise 2011',
    von: 2011,
    bis: 2011,
    land: 'CHE',
    beschreibung: 'Schuldenkrise im Euroraum, starker Franken. Aktien Schweiz 2011 etwa −8 %.',
  },
  {
    id: 'covid2020',
    kurz: 'Covid',
    name: 'Covid 2020',
    von: 2020,
    bis: 2020,
    land: 'CHE',
    beschreibung:
      'Einbruch im Februar/März 2020, bis Jahresende erholt. In Jahresdaten kaum sichtbar (Aktien Schweiz 2020 +4 %).',
  },
  {
    id: 'zinsschock2022',
    kurz: 'Zinsschock',
    name: 'Inflations- und Zinsschock 2022',
    von: 2022,
    bis: 2022,
    land: 'CHE',
    beschreibung: 'Teuerung und Zinsanstieg: Aktien und Obligationen fallen gleichzeitig (Schweiz −16 % und −14 %).',
  },
];

export function kriseNach(id: string): Krise | undefined {
  return KRISEN.find((k) => k.id === id);
}

export interface Haeufigkeit {
  jahreMitDaten: number;
  real20: { anzahl: number; proDekade: number };
  real30: { anzahl: number; proDekade: number };
  nominal20: { anzahl: number; proDekade: number };
  banken: { anzahl: number; proDekade: number; jahre: number[]; jahreMitDaten: number };
}

interface HaeufigkeitJson {
  stand: string;
  definitionen: Record<string, string>;
  laender: Record<string, Record<string, Haeufigkeit>>;
  welt: Record<
    string,
    {
      mittelLaender: { real20: number; real30: number; nominal20: number; banken: number };
      weltIndexGleichgewichtet: {
        jahreMitDaten: number;
        real20: { anzahl: number; proDekade: number };
        real30: { anzahl: number; proDekade: number };
      };
      bankenWellen: { jahre: number[]; proDekade: number };
    }
  >;
}

export const HAEUFIGKEIT = haeufigkeitJson as unknown as HaeufigkeitJson;

/**
 * Standard für «wiederkehrende Krisen»: Schweiz, realer Aktienrückgang ≥ 20 %, ganze verfügbare
 * Periode (Aktien Schweiz ab 1900). Siehe docs/krisen.md.
 */
export const STANDARD_KRISEN_PRO_DEKADE: number = HAEUFIGKEIT.laender.CHE?.['1871-2020']?.real20.proDekade ?? 0;

/**
 * Modus «Automatisch»: die «normalen» historischen Krisen in historischer Reihenfolge. Nicht dabei
 * (gelten als extrem, nur im Modus «Individuell»): Grosse Depression, Stagflation 1973–81, Japan ab 1990.
 */
export const AUTO_KRISEN_IDS = [
  'oelkrise1973',
  'schwarzerMontag1987',
  'immobilienCh1990',
  'dotcom2000',
  'finanzkrise2007',
  'eurokrise2011',
  'covid2020',
  'zinsschock2022',
] as const;

export const AUTO_KRISEN: readonly Krise[] = AUTO_KRISEN_IDS.map((id) => kriseNach(id) as Krise);

/** Letztes Krisenjahr der Liste (Zinsschock 2022): Ausgangspunkt für den Standard der ersten Krise */
export const LETZTES_KRISENJAHR = Math.max(...AUTO_KRISEN.map((k) => k.von));

/** Mittlerer Abstand zwischen zwei Krisenbeginnen in Jahren (z.B. 10 / 0.74 = 13.5) */
export function krisenAbstand(proDekade: number): number {
  return proDekade > 0 ? 10 / proDekade : Number.POSITIVE_INFINITY;
}

/**
 * Standard für die erste automatische Krise: letzte Krise der Liste (2022) plus ein mittlerer Abstand,
 * gerundet (bei 0.74 pro Dekade: 2022 + 14 = 2036). Die Abfolge setzt damit den historischen Rhythmus
 * fort, statt eine Krise gezielt auf den Rücktritt zu legen (das wäre ein Stresstest → «Individuell»).
 */
export function standardErsteKrise(proDekade: number): number {
  const a = krisenAbstand(proDekade);
  return LETZTES_KRISENJAHR + (Number.isFinite(a) ? Math.round(a) : 0);
}

/** Wirksame Häufigkeit im Modus «Automatisch» (0.1 bis 5 pro Dekade) */
export function autoHaeufigkeit(k: Pick<KrisenEinstellungen, 'autoProDekade'>): number {
  return Math.min(5, Math.max(0.1, k.autoProDekade ?? STANDARD_KRISEN_PRO_DEKADE));
}

/** Beginn der k-ten automatischen Krise relativ zur ersten (in Jahren, ohne Drift gerundet) */
export function autoVersatz(k: number, proDekade: number): number {
  return Math.round(k * krisenAbstand(proDekade));
}

/** Anzahl automatischer Krisen, die in 200 Jahren beginnen (reicht für jeden Planungshorizont) */
const AUTO_HORIZONT = 200;

/**
 * Automatische Krisenfolge: Beginn gemäss Einstellung, danach alle 10/Häufigkeit Jahre die nächste
 * Krise der Liste (rotierend, beginnend mit der Ölkrise – nach dem Zinsschock 2022 beginnt die
 * Liste von vorne). Daten jeweils aus der Standard-Reihe der Krise.
 */
export function autoKrisenWahl(k: KrisenEinstellungen): KrisenWahl[] {
  const rate = autoHaeufigkeit(k);
  const wahl: KrisenWahl[] = [];
  for (let i = 0; ; i++) {
    const v = autoVersatz(i, rate);
    if (v > AUTO_HORIZONT) break;
    const krise = AUTO_KRISEN[i % AUTO_KRISEN.length] as Krise;
    wahl.push({
      krise,
      land: krise.land,
      start:
        k.autoStartArt === 'nachRuecktritt'
          ? { art: 'nachRuecktritt', jahre: k.autoJahreNach + v }
          : { art: 'jahr', jahr: (k.autoStartJahr ?? standardErsteKrise(rate)) + v },
    });
  }
  return wahl;
}

/** Ein ganzer Umlauf der Liste (Beginne relativ zu 0) und seine Länge in Jahren */
export function autoZyklus(proDekade: number): { plan: KrisenPlanEintrag[]; jahre: number } {
  const plan = AUTO_KRISEN.map((krise, i) => ({ krise, land: krise.land, startJahr: autoVersatz(i, proDekade) }));
  return { plan, jahre: autoVersatz(AUTO_KRISEN.length, proDekade) };
}

/**
 * Nominale Renditen der normalen Jahre bei Ausgleich über einen ganzen Umlauf der Liste (bis Schema 6
 * die Rechnung im Modus «Automatisch»; heute nur noch zum Vergleich – die Simulation gleicht über den
 * eigenen Planungshorizont aus, siehe `ausgleichHorizont`).
 */
export function autoNormal(h: Haushalt): { wertschriften: number; wohneigentum: number } {
  const z = autoZyklus(autoHaeufigkeit(h.krisen));
  const a = h.annahmen;
  return ausgleichZyklus(
    { renditeNominal: a.renditeNominal, renditeBargeld: a.renditeBargeld, inflation: a.inflation },
    a.aktienanteil,
    z.plan,
    z.jahre,
    KRISEN_DATEN,
  );
}

/** Krisen des Haushalts als Simulationsoption (undefined = keine Krise) */
export function krisenOptionen(h: Haushalt): KrisenOptionen | undefined {
  const k = h.krisen;
  if (k.modus === 'automatisch') {
    // Ausgleich über den eigenen Planungshorizont (in simuliere, Schema 7)
    return {
      wahl: autoKrisenWahl(k),
      daten: KRISEN_DATEN,
      aktienanteil: h.annahmen.aktienanteil,
      ausgleichHorizont: true,
    };
  }
  if (k.modus !== 'individuell') return undefined;
  const wahl: KrisenWahl[] = [];
  for (const a of k.auswahl) {
    const start =
      a.startArt === 'jahr'
        ? { art: 'jahr' as const, jahr: a.jahr }
        : a.startArt === 'alter'
          ? { art: 'alter' as const, alter: a.alter, person: a.person }
          : { art: 'nachRuecktritt' as const, jahre: a.jahreNach };
    if (a.id === EIGENE_KRISE_ID) {
      const eigen = bereinigeEigeneKrise(a.eigen);
      wahl.push({ krise: eigeneAlsKrise(a.uid || 'kr', eigen), land: 'CHE', start, eigen });
      continue;
    }
    const krise = kriseNach(a.id);
    if (!krise) continue;
    wahl.push({ krise, land: a.land, start });
  }
  if (wahl.length === 0) return undefined;
  return {
    wahl,
    daten: KRISEN_DATEN,
    aktienanteil: h.annahmen.aktienanteil,
    // Schema 14: nach «Automatische Krisen übernehmen» wie «Automatisch» ausgleichen
    ...(k.ausgleich === true ? { ausgleichHorizont: true } : {}),
  };
}

/**
 * Krisen, die der Modus «Automatisch» abspielen würde, als editierbare Liste.
 * Beginn im Kalenderjahr: nur Krisen, deren Jahre den Horizont schneiden, als festes Jahr
 * (dasselbe Jahr wie die Wunsch-Rechnung). Einträge ausserhalb ändern dort nichts.
 * Beginn nach dem Rücktritt: die ganze Folge als Abstand (`Startjahr − Rücktrittsjahr`).
 * Ein fester Jahr würde beim früheren oder späteren Rücktritt stehen bleiben. Die Folge
 * ausserhalb des aktuellen Horizonts bleibt in der Liste, weil sie bei einem anderen
 * Rücktrittsalter in den Horizont rutschen kann – gleich wie im Modus «Automatisch».
 */
export function automatischeKrisenAlsAuswahl(
  k: KrisenEinstellungen,
  ruecktrittJahr: number,
  horizont: { von: number; bis: number },
): KrisenAuswahl[] {
  const relativ = k.autoStartArt === 'nachRuecktritt';
  const plan = krisenPlan(autoKrisenWahl(k), ruecktrittJahr);
  const auswahl: KrisenAuswahl[] = [];
  for (const e of plan) {
    if (!relativ && !kriseImHorizont(e.startJahr, e.krise, horizont.von, horizont.bis)) continue;
    const jahreNach = Math.round(e.startJahr - ruecktrittJahr);
    auswahl.push({
      uid: `auto-${auswahl.length}-${e.krise.id}-${relativ ? `n${jahreNach}` : e.startJahr}`,
      id: e.krise.id,
      land: e.land,
      startArt: relativ ? 'nachRuecktritt' : 'jahr',
      jahr: e.startJahr,
      alter: 70,
      person: 0,
      jahreNach: relativ ? jahreNach : 0,
      eigen: null,
    });
    if (auswahl.length >= MAX_GEPLANTE_KRISEN) break;
  }
  return auswahl;
}

/** Dieselbe Krise mit demselben Beginn (Jahr, Alter oder Abstand zum Rücktritt). */
function auswahlSchluessel(a: KrisenAuswahl): string {
  if (a.startArt === 'nachRuecktritt') return `${a.id}@nach@${a.jahreNach}`;
  if (a.startArt === 'alter') return `${a.id}@alter@${a.person}@${a.alter}`;
  return `${a.id}@jahr@${a.jahr}`;
}

/**
 * Hängt übernommene Krisen an eine bestehende Liste. Dieselbe Krise mit demselben Beginn
 * wird nicht doppelt gesetzt. Was über die Grenze hinausgeht, wird gezählt und weggelassen.
 */
export function krisenListeZusammenfuehren(
  bestehend: readonly KrisenAuswahl[],
  neu: readonly KrisenAuswahl[],
  max = MAX_GEPLANTE_KRISEN,
): { auswahl: KrisenAuswahl[]; ausgelassen: number } {
  const hat = new Set(bestehend.map(auswahlSchluessel));
  const extra = neu.filter((a) => !hat.has(auswahlSchluessel(a)));
  const platz = Math.max(0, max - bestehend.length);
  return {
    auswahl: [...bestehend, ...extra.slice(0, platz)],
    ausgelassen: Math.max(0, extra.length - platz),
  };
}

/**
 * Aktien real (100 %) einer Katalogkrise, aus der gewählten Datenreihe.
 * Stand = 1 am Jahresende vor `krise.von`. Der Tiefpunkt wird nur in den Katalogjahren
 * `von`…`bis` gesucht (eine spätere, andere Krise zählt nicht mit). Dauer = Jahre bis
 * zu diesem Tiefpunkt. Erholung = Jahre vom Tiefpunkt, bis der Index wieder mindestens 1
 * ist; dafür darf die Reihe über `bis` hinausgehen (höchstens 80 Jahre ab `von`).
 * null, wenn die Reihe das nicht zeigt. Teuerung = Produkt der Katalogjahre `von`…`bis`.
 * Quelle: dieselben Reihen wie der Katalog (JST R6, Schweiz 2021–2024 SNB/BFS),
 * siehe docs/krisen.md. Keine gerundete Ersatztabelle.
 */
export function aktienKennzahl(
  krise: Krise,
  land: KrisenLand,
): { rueckgang: number; dauer: number; erholung: number | null; tiefpunkt: number; teuerung: number } | null {
  const erstes = KRISEN_DATEN[land].get(krise.von);
  if (!erstes || erstes.aktien === null || erstes.teuerung === null) return null;
  let index = 1;
  let tief = 1;
  let tiefJahr = krise.von - 1;
  const imFenster: { jahr: number; index: number }[] = [];
  for (let j = krise.von; j <= krise.bis; j++) {
    const h = KRISEN_DATEN[land].get(j);
    if (!h || h.aktien === null || h.teuerung === null) break;
    index *= (1 + h.aktien) / (1 + h.teuerung);
    imFenster.push({ jahr: j, index });
    if (index < tief - 1e-12) {
      tief = index;
      tiefJahr = j;
    }
  }
  let erholt: number | null = null;
  if (tief < 1 - 1e-9) {
    for (const p of imFenster) {
      if (p.jahr > tiefJahr && p.index >= 1 - 1e-9) {
        erholt = p.jahr;
        break;
      }
    }
    for (let j = krise.bis + 1; erholt === null && j <= krise.von + 80; j++) {
      const h = KRISEN_DATEN[land].get(j);
      if (!h || h.aktien === null || h.teuerung === null) break;
      index *= (1 + h.aktien) / (1 + h.teuerung);
      if (index >= 1 - 1e-9) erholt = j;
    }
  }
  let teuerung = 1;
  let hat = false;
  for (let j = krise.von; j <= krise.bis; j++) {
    const h = KRISEN_DATEN[land].get(j);
    if (!h || h.teuerung === null) continue;
    teuerung *= 1 + h.teuerung;
    hat = true;
  }
  return {
    rueckgang: tief - 1,
    dauer: Math.max(0, tiefJahr - (krise.von - 1)),
    erholung: erholt === null ? null : erholt - tiefJahr,
    tiefpunkt: tiefJahr,
    teuerung: hat ? teuerung - 1 : 0,
  };
}

/** Pool für «wiederkehrende Krisen» (Monte Carlo): dieselben «normalen» Krisen wie im Modus «Automatisch» */
export function mcKrisenPool(): { krise: Krise; land: KrisenLand }[] {
  return AUTO_KRISEN.map((k) => ({ krise: k, land: k.land }));
}

/** Pool für «wiederkehrende Krisen»: Katalogkrisen mit realem Rückgang ≥ 20 % bei 100 % Aktien */
export function krisenPool(): { krise: Krise; land: KrisenLand }[] {
  const basis = { renditeNominal: 0, renditeBargeld: 0, inflation: 0 };
  return KRISEN.filter((k) => maxRealerRueckgang(krisenPfad(k, k.land, 1, KRISEN_DATEN, basis)) <= -0.2).map((k) => ({
    krise: k,
    land: k.land,
  }));
}
