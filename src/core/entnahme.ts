/**
 * Entnahmestrategien für das freie Finanzvermögen (Bargeld + Wertschriften + Sonstiges).
 * Wohneigentum und noch gebundene Vorsorge (PK, Freizügigkeit, 3a) gehören nicht dazu.
 *
 * Die Simulation rechnet in heutigen Franken. «Inflationsangepasst» heisst hier: der reale
 * Betrag bleibt gleich; nominal steigt er mit der Teuerung (`nominal.ts`).
 *
 * Wachstum für die gestaffelte Strategie: reale Rendite des freien Finanzvermögens im
 * Vorjahr, ohne Kapitalbezüge und ohne Einzahlungen (`ertraege / ertragsBasis` in der
 * Simulation, im Teiljahr auf ein volles Jahr hochgerechnet). Im ersten Simulationsjahr
 * gibt es kein Vorjahr; gerechnet wird mit 0 % (unter 2 %, Standard 3,5 %).
 * Der Standard geht nicht unter 3,5 %: auch starke Verluste (unter −4 %) bleiben bei 3,5 %.
 * Eine tiefere Stufe, zum Beispiel 3 % unter −4 %, kann ergänzt werden; sie ist kein Standard.
 *
 * AHV, Pensionskasse und weitere Einnahmen bleiben in der bisherigen Rechnung. Satz-Strategien
 * (gestaffelt, fester Prozentsatz, Anfangssatz, Annuität) legen fest, wie viel zusätzlich aus
 * dem freien Vermögen fliesst; dieses Geld wird ausgegeben. Die Einnahmen senken diesen Satz
 * nicht. «Statisch (Ausgaben)» und «Mehr-Töpfe» entnehmen weiterhin die Lücke
 * (Ausgaben und Steuern abzüglich der Einnahmen).
 *
 * Mehr-Töpfe: Zu Beginn der Entnahmephase (erstes Jahr ohne Erwerbseinkommen) deckt
 * «Cash / Geldmarkt» etwa den Startpuffer des Nettobedarfs (Standard 1 Jahr). Über die
 * Aufbaujahre (Standard 4) wächst das Ziel auf den Zielpuffer (Standard 2 Jahre).
 * Ausgaben kommen zuerst aus dem Cash-Topf, dann aus «ETF und Obligationen», dann aus
 * «Aktien». Einmal pro Jahr wird der Cash-Topf aus den Risikotöpfen aufgefüllt (zuerst
 * der mittlere Topf, dann Aktien), aber nicht aus einem Topf, dessen reale Jahresrendite
 * unter `keinVerkaufUnter` liegt (Standard −10 %). Reicht der Puffer nicht, werden die
 * Risikotöpfe für die Ausgaben trotzdem verkauft. Mittel- bis langfristige Obligationen
 * liegen im mittleren Topf, nicht im Puffer. Der Puffer ist liquide und kurzfristig
 * (Konto, Geldmarkt, sehr kurze Staatsanleihen); reale Rendite standardmässig 0,5 %.
 */

import { filterAnzeigename } from './text';
import type { Entnahme, EntnahmeStufe, EntnahmeTopfRolle, EntnahmeTopfVorlage, Toepfe } from './typen';

/** Studie als Ausgangspunkt der Annuität: reale Aktienrendite. Eine Annahme, kein Versprechen. */
export const ANNUITAET_AKTIEN_REAL = 0.05;
/** Studie als Ausgangspunkt der Annuität: reale Obligationenrendite. */
export const ANNUITAET_OBLIGATIONEN_REAL = 0.01;
/** Reale Rendite «Cash / Geldmarkt» (Mitte der Spanne 0–1 %). */
export const CASH_REAL = 0.005;
/** Reale Rendite des mittleren Topfes (ETF und mittel- bis langfristige Obligationen). */
export const MITTEL_REAL = 0.02;
/** Unter dieser realen Jahresrendite wird ein Risikotopf nicht zur Pufferauffüllung verkauft. */
export const KEIN_VERKAUF_UNTER = -0.1;

export const ENTNAHME_NAME = {
  gestaffelt: 'Dynamisch gestaffelt (nach Depotwachstum)',
  statisch: 'Statisch (inflationsangepasst)',
  dynamisch: 'Dynamisch (fester Prozentsatz)',
  annuitaet: 'Annuität / Vermögensrente',
  toepfe: 'Mehr-Töpfe',
} as const;

/**
 * Standardstufen: Untergrenzen absteigend, die letzte fängt alles darunter.
 * Unter 2 % gilt 3,5 %, auch bei Verlusten. Keine 3-%-Stufe im Standard.
 */
export function standardStufen(): EntnahmeStufe[] {
  return [
    { id: 'stufe-14', abWachstum: 0.14, satz: 0.06 },
    { id: 'stufe-7', abWachstum: 0.07, satz: 0.05 },
    { id: 'stufe-2', abWachstum: 0.02, satz: 0.04 },
    { id: 'stufe-boden', abWachstum: -1, satz: 0.035 },
  ];
}

function indexTiefste(stufen: readonly EntnahmeStufe[]): number {
  let best = 0;
  for (let i = 1; i < stufen.length; i++) {
    const kandidat = stufen[i];
    const bisher = stufen[best];
    if (kandidat && bisher && kandidat.abWachstum < bisher.abWachstum) best = i;
  }
  return best;
}

/**
 * Ergänzt eine optionale tiefere Stufe. Aus dem Standard wird: unter −4 % → 3 %,
 * ab −4 % und unter 2 % bleibt 3,5 %. Genau −4 % bleibt bei 3,5 %.
 */
export function tiefereStufe(stufen: readonly EntnahmeStufe[]): EntnahmeStufe[] {
  if (stufen.length === 0 || stufen.length >= 8) return [...stufen];
  const bodenIndex = indexTiefste(stufen);
  const boden = stufen[bodenIndex];
  if (!boden) return [...stufen];
  const explizit = stufen.filter((_, i) => i !== bodenIndex).map((s) => s.abWachstum);
  const tiefste = explizit.length > 0 ? Math.min(...explizit) : 0.02;
  const schonMinus4 = stufen.some((s) => Math.abs(s.abWachstum + 0.04) < 1e-9);
  const schwelle = !schonMinus4 && tiefste >= 0.02 - 1e-9 ? -0.04 : Math.max(-0.99, tiefste - 0.02);
  const satzNeu = Math.abs(schwelle + 0.04) < 1e-9 ? 0.03 : boden.satz;
  const id = stufen.some((s) => s.id === 'stufe-verlust') ? `stufe-extra-${stufen.length}` : 'stufe-verlust';
  return stufen
    .map((s, i) => (i === bodenIndex ? { ...s, abWachstum: schwelle } : s))
    .concat({ id, abWachstum: -1, satz: satzNeu });
}

/** Entfernt die ergänzte tiefste Stufe und macht die nächste wieder zum offenen Boden. */
export function tiefereStufeEntfernen(stufen: readonly EntnahmeStufe[]): EntnahmeStufe[] {
  if (stufen.length <= standardStufen().length) return [...stufen];
  const ohne = stufen.filter((_, i) => i !== indexTiefste(stufen));
  const idx = indexTiefste(ohne);
  return ohne.map((s, i) => (i === idx ? { ...s, abWachstum: -1 } : s));
}

/** Standard für neue Haushalte und für Stände ohne gespeicherte Strategie. */
export function standardEntnahme(): Entnahme {
  return { art: 'gestaffelt', stufen: standardStufen() };
}

/** Bisheriges Verhalten: die erfassten Ausgaben bestimmen die Lücke. */
export function entnahmeAusgaben(satz = 0.04): Entnahme {
  return { art: 'statisch', quelle: 'ausgaben', satz };
}

export function standardToepfe(anzahl: 2 | 3): EntnahmeTopfVorlage[] {
  if (anzahl === 2) {
    return [
      { rolle: 'aktien', label: 'Aktien und ETF', anteil: 1, renditeReal: ANNUITAET_AKTIEN_REAL },
      { rolle: 'cash', label: 'Cash / Geldmarkt', anteil: 0, renditeReal: CASH_REAL },
    ];
  }
  return [
    { rolle: 'aktien', label: 'Aktien', anteil: 0.7, renditeReal: ANNUITAET_AKTIEN_REAL },
    { rolle: 'mittel', label: 'ETF und Obligationen', anteil: 0.3, renditeReal: MITTEL_REAL },
    { rolle: 'cash', label: 'Cash / Geldmarkt', anteil: 0, renditeReal: CASH_REAL },
  ];
}

/** Vorlage beim Wechsel der Strategie in der Oberfläche. */
export function entnahmeVorlage(art: Entnahme['art']): Entnahme {
  switch (art) {
    case 'gestaffelt':
      return standardEntnahme();
    case 'statisch':
      return entnahmeAusgaben();
    case 'dynamisch':
      return { art: 'dynamisch', satz: 0.04 };
    case 'annuitaet':
      return {
        art: 'annuitaet',
        renditeModus: 'gewichtet',
        aktienReal: ANNUITAET_AKTIEN_REAL,
        obligationenReal: ANNUITAET_OBLIGATIONEN_REAL,
        satz: 0.03,
      };
    case 'toepfe':
      return {
        art: 'toepfe',
        anzahl: 3,
        pufferMonateStart: 12,
        pufferMonateZiel: 24,
        aufbauJahre: 4,
        keinVerkaufUnter: KEIN_VERKAUF_UNTER,
        toepfe: standardToepfe(3),
      };
  }
}

export const freiesFinanzvermoegen = (t: Toepfe): number =>
  Math.max(0, t.bargeld) + Math.max(0, t.wertschriften) + Math.max(0, t.sonstiges);

/**
 * Satz zur Wachstumsrate. Stufen werden nach Untergrenze absteigend geprüft;
 * die erste mit `wachstum >= abWachstum` gilt. Liegt das Wachstum unter allen
 * Stufen, gilt die tiefste Stufe.
 */
export function satzFuerWachstum(stufen: readonly EntnahmeStufe[], wachstum: number): number {
  const sortiert = [...stufen].sort((a, b) => b.abWachstum - a.abWachstum);
  for (const s of sortiert) {
    if (wachstum >= s.abWachstum) return Math.max(0, s.satz);
  }
  return Math.max(0, sortiert.at(-1)?.satz ?? 0);
}

/** Feste reale Entnahme = Anfangssatz × freies Vermögen im ersten Entnahmejahr. */
export function statischeEntnahme(anfangssatz: number, freiesVermoegenStart: number): number {
  return Math.max(0, anfangssatz) * Math.max(0, freiesVermoegenStart);
}

/** Fester Satz vom aktuellen freien Vermögen. */
export function dynamischeEntnahme(satz: number, freiesVermoegenAktuell: number): number {
  return Math.max(0, satz) * Math.max(0, freiesVermoegenAktuell);
}

/**
 * Vermögensrente, jedes Jahr neu, auf dem Kapital nach der Rendite dieses Jahres.
 * `jahre` schliesst das laufende Jahr ein. Zahlung am Jahresende (nach der Rendite):
 * bei genau der angenommenen Realrendite ist das Vermögen nach dem letzten Jahr 0.
 * Im letzten Jahr wird das ganze Kapital entnommen.
 */
export function annuitaetEntnahme(kapital: number, jahre: number, realrendite: number): number {
  const K = Math.max(0, kapital);
  const n = Math.max(0, jahre);
  if (K === 0 || n === 0) return 0;
  if (n <= 1) return K;
  const r = realrendite;
  if (!Number.isFinite(r) || r <= -1) return K;
  if (Math.abs(r) < 1e-8) return Math.min(K, K / n);
  const q = 1 + r;
  const nenner = 1 - q ** -n;
  if (!Number.isFinite(nenner) || Math.abs(nenner) < 1e-12) return K;
  const w = (K * r) / nenner;
  if (!Number.isFinite(w)) return K;
  return Math.min(K, Math.max(0, w));
}

/** Gewichtete reale Rendite nach dem Aktienanteil der Annahmen. */
export function gewichteteRealrendite(aktienanteil: number, aktienReal: number, obligationenReal: number): number {
  const a = Math.min(1, Math.max(0, aktienanteil));
  return a * aktienReal + (1 - a) * obligationenReal;
}

/**
 * Puffer in Jahren des Nettobedarfs. `jahrIndex` 0 = erstes Entnahmejahr (Start),
 * `jahrIndex` = `aufbauJahre` = Ziel, danach konstant das Ziel.
 */
export function pufferJahre(jahrIndex: number, startJahre: number, zielJahre: number, aufbauJahre: number): number {
  const start = Math.max(0, startJahre);
  const ziel = Math.max(0, zielJahre);
  if (!(aufbauJahre > 0)) return jahrIndex <= 0 ? start : ziel;
  const t = Math.min(1, Math.max(0, jahrIndex) / aufbauJahre);
  return start + (ziel - start) * t;
}

/**
 * Reale Jahresrendite. `teil` ist der Ertrag des (Teil-)Jahres geteilt durch den Anfangsbestand.
 * Weniger als 12 Monate werden auf ein Jahr hochgerechnet, damit die Stufen Jahreswerte bleiben.
 */
export function jahreswachstum(teilErtrag: number, monate: number): number {
  if (!Number.isFinite(teilErtrag)) return 0;
  const m = Math.max(1, Math.min(12, monate));
  if (m >= 12) return teilErtrag;
  const g = (1 + teilErtrag) ** (12 / m) - 1;
  return Number.isFinite(g) ? g : 0;
}

export interface EntnahmeZiel {
  betrag: number;
  satz: number | null;
  /** Gesetzte Basis der statischen Anfangssatz-Strategie (sonst null). */
  statischBasis: number | null;
}

/**
 * Zielentnahme der Satz-Strategien. Null = die Lücke aus den Ausgaben bleibt massgebend
 * (statisch mit Quelle «Ausgaben», oder Mehr-Töpfe).
 */
export function zielEntnahme(
  e: Entnahme,
  opt: {
    frei: number;
    vorjahresWachstum: number | null;
    restjahre: number;
    aktienanteil: number;
    statischBasis: number | null;
  },
): EntnahmeZiel | null {
  const frei = Math.max(0, opt.frei);
  if (e.art === 'statisch' && e.quelle === 'ausgaben') return null;
  if (e.art === 'toepfe') return null;
  if (e.art === 'gestaffelt') {
    const w = opt.vorjahresWachstum ?? 0;
    const satz = satzFuerWachstum(e.stufen, w);
    return { betrag: dynamischeEntnahme(satz, frei), satz, statischBasis: null };
  }
  if (e.art === 'dynamisch') {
    return { betrag: dynamischeEntnahme(e.satz, frei), satz: e.satz, statischBasis: null };
  }
  if (e.art === 'annuitaet') {
    const r =
      e.renditeModus === 'satz' ? e.satz : gewichteteRealrendite(opt.aktienanteil, e.aktienReal, e.obligationenReal);
    const betrag = annuitaetEntnahme(frei, opt.restjahre, r);
    return { betrag, satz: frei > 0 ? betrag / frei : null, statischBasis: null };
  }
  const basis = opt.statischBasis ?? statischeEntnahme(e.satz, frei);
  return { betrag: basis, satz: e.satz, statischBasis: basis };
}

/**
 * Setzt Lebenshaltung und Saldo so, dass aus dem Vermögen `ziel` entnommen wird
 * (Überschuss wird mitausgegeben, nicht wieder angelegt). Fällt die Lebenshaltung
 * dabei unter 0, bleibt sie 0 und der Saldo wird negativer als `-ziel`
 * (Steuern und Pflichtausgaben, die das Einkommen übersteigen).
 */
export function lebenshaltungFuerEntnahme(
  saldo: number,
  lebenshaltung: number,
  ziel: number,
): { saldo: number; lebenshaltung: number } {
  const zielEntnahme = Math.max(0, ziel);
  const frei = saldo + lebenshaltung;
  const leben = Math.max(0, frei + zielEntnahme);
  return { lebenshaltung: leben, saldo: frei - leben };
}

export interface TopfStand {
  rolle: EntnahmeTopfRolle;
  label: string;
  wert: number;
  renditeReal: number;
}

function gewichte(anlagen: readonly { anteil: number }[]): number[] {
  const roh = anlagen.map((a) => Math.max(0, a.anteil));
  const s = roh.reduce((x, y) => x + y, 0);
  if (s <= 0) return anlagen.map(() => (anlagen.length > 0 ? 1 / anlagen.length : 0));
  return roh.map((x) => x / s);
}

/**
 * Teilt das freie Vermögen auf. Der Cash-Topf erhält `pufferInJahren` × Nettobedarf,
 * höchstens das ganze Vermögen. Der Rest geht nach den Anteilen auf Aktien und den
 * mittleren Topf.
 */
export function toepfeAufteilen(
  frei: number,
  nettoBedarf: number,
  pufferInJahren: number,
  vorlage: readonly EntnahmeTopfVorlage[],
): TopfStand[] {
  const F = Math.max(0, frei);
  const cashZiel = Math.min(F, Math.max(0, pufferInJahren) * Math.max(0, nettoBedarf));
  const liste = vorlage.length > 0 ? vorlage : standardToepfe(3);
  const cashVorlage = liste.find((v) => v.rolle === 'cash');
  const anlagen = liste.filter((v) => v.rolle !== 'cash');
  const rest = Math.max(0, F - cashZiel);
  const g = gewichte(anlagen);
  const staende: TopfStand[] = anlagen.map((v, i) => ({
    rolle: v.rolle,
    label: v.label,
    wert: rest * (g[i] ?? 0),
    renditeReal: v.renditeReal,
  }));
  staende.push({
    rolle: 'cash',
    label: cashVorlage?.label || 'Cash / Geldmarkt',
    wert: cashZiel,
    renditeReal: cashVorlage?.renditeReal ?? CASH_REAL,
  });
  return staende;
}

/** Rendite über `monate` Monate; liefert die Teiljahresrendite je Topf (für die Verkaufssperre). */
export function toepfeVerzinsen(
  staende: readonly TopfStand[],
  monate: number,
): { staende: TopfStand[]; rendite: number[] } {
  const f = Math.max(0, Math.min(12, monate)) / 12;
  const rendite: number[] = [];
  const neu = staende.map((s) => {
    const r = Number.isFinite(s.renditeReal) ? s.renditeReal : 0;
    if (r <= -1) {
      rendite.push(-1);
      return { ...s, wert: 0 };
    }
    const w = (1 + r) ** f - 1;
    const g = Number.isFinite(w) ? w : 0;
    rendite.push(g);
    return { ...s, wert: Math.max(0, s.wert) * (1 + g) };
  });
  return { staende: neu, rendite };
}

/**
 * Füllt den Cash-Topf bis `zielCash` aus dem mittleren Topf, dann aus Aktien.
 * Ein Topf mit Jahresrendite unter `schwelle` wird nicht angetastet.
 */
export function pufferAuffuellen(
  staende: readonly TopfStand[],
  zielCash: number,
  schwelle: number,
  rendite: readonly number[],
): TopfStand[] {
  const out = staende.map((s) => ({ ...s }));
  const cash = out.find((s) => s.rolle === 'cash');
  if (!cash) return out;
  let bedarf = Math.max(0, zielCash - cash.wert);
  for (const rolle of ['mittel', 'aktien'] as const) {
    if (bedarf <= 1e-9) break;
    const i = out.findIndex((s) => s.rolle === rolle);
    const topf = i >= 0 ? out[i] : undefined;
    if (!topf) continue;
    if ((rendite[i] ?? 0) < schwelle) continue;
    const x = Math.min(Math.max(0, topf.wert), bedarf);
    topf.wert -= x;
    cash.wert += x;
    bedarf -= x;
  }
  return out;
}

/**
 * Bezahlt `betrag` aus Cash, dann aus dem mittleren Topf, dann aus Aktien.
 * Die Verkaufssperre gilt hier nicht: Lebenshaltung wird auch in einem schwachen Jahr bezahlt,
 * sofern der Puffer nicht reicht.
 */
export function ausPufferEntnehmen(
  staende: readonly TopfStand[],
  betrag: number,
): { staende: TopfStand[]; entnommen: number } {
  const out = staende.map((s) => ({ ...s }));
  let rest = Math.max(0, betrag);
  for (const rolle of ['cash', 'mittel', 'aktien'] as const) {
    const topf = out.find((s) => s.rolle === rolle);
    if (!topf || rest <= 0) continue;
    const x = Math.min(Math.max(0, topf.wert), rest);
    topf.wert -= x;
    rest -= x;
  }
  return { staende: out, entnommen: Math.max(0, betrag) - rest };
}

/** Bucht einen Zufluss (Kapital, Verkaufserlös, Überschuss) auf einen Topf. */
export function topfZufluss(staende: readonly TopfStand[], betrag: number, rolle: EntnahmeTopfRolle): TopfStand[] {
  if (!Number.isFinite(betrag) || betrag === 0) return staende.map((s) => ({ ...s }));
  const out = staende.map((s) => ({ ...s }));
  const topf = out.find((s) => s.rolle === rolle) ?? out[0];
  if (topf) topf.wert = Math.max(0, topf.wert + betrag);
  return out;
}

export function finanzAnteile(werte: readonly number[]): number[] {
  const xs = werte.map((x) => Math.max(0, x));
  const s = xs.reduce((a, b) => a + b, 0);
  if (s <= 0) return xs.map((_, i) => (i === 0 ? 1 : 0));
  return xs.map((x) => x / s);
}

export function schreibeFinanz(
  anteile: readonly number[],
  staende: readonly TopfStand[],
): { bargeld: number; wertschriften: number; sonstiges: number }[] {
  const cash = staende.filter((s) => s.rolle === 'cash').reduce((a, s) => a + s.wert, 0);
  const risiko = staende.filter((s) => s.rolle !== 'cash').reduce((a, s) => a + s.wert, 0);
  return anteile.map((a) => ({
    bargeld: cash * a,
    wertschriften: risiko * a,
    sonstiges: 0,
  }));
}

const istObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function zahl(x: unknown, sonst: number, min: number, max: number): number {
  const n = typeof x === 'number' && Number.isFinite(x) ? x : sonst;
  return Math.min(max, Math.max(min, n));
}

function label(x: unknown, sonst: string): string {
  const s = typeof x === 'string' ? filterAnzeigename(x, 10_000).replace(/\s+/g, ' ').trim() : '';
  return (s || sonst).slice(0, 40);
}

function normalisiereStufen(roh: unknown): EntnahmeStufe[] {
  const std = standardStufen();
  if (!Array.isArray(roh) || roh.length === 0) return std;
  const stufen = roh.slice(0, 8).map((x, i) => {
    const d = std[Math.min(i, std.length - 1)] ?? { id: `stufe-${i}`, abWachstum: -1, satz: 0.035 };
    const o = istObj(x) ? x : {};
    return {
      id: label(o.id, d.id).replace(/[^\w-]/g, '') || d.id,
      abWachstum: zahl(o.abWachstum, d.abWachstum, -1, 1),
      satz: zahl(o.satz, d.satz, 0, 0.2),
    };
  });
  return stufen.length > 0 ? stufen : std;
}

function normalisiereToepfe(anzahl: 2 | 3, roh: unknown): EntnahmeTopfVorlage[] {
  const std = standardToepfe(anzahl);
  const liste = Array.isArray(roh) ? roh : [];
  return std.map((d, i) => {
    const o = istObj(liste[i]) ? liste[i] : {};
    return {
      rolle: d.rolle,
      label: label(o.label, d.label),
      anteil: d.rolle === 'cash' ? 0 : zahl(o.anteil, d.anteil, 0, 1),
      renditeReal: zahl(o.renditeReal, d.renditeReal, -0.5, 0.2),
    };
  });
}

/** Macht eine gespeicherte oder fehlende Strategie gültig. Unbekanntes wird zum Standard. */
export function normalisiereEntnahme(roh: unknown): Entnahme {
  if (!istObj(roh)) return standardEntnahme();
  switch (roh.art) {
    case 'gestaffelt':
      return { art: 'gestaffelt', stufen: normalisiereStufen(roh.stufen) };
    case 'statisch':
      return {
        art: 'statisch',
        quelle: roh.quelle === 'satz' ? 'satz' : 'ausgaben',
        satz: zahl(roh.satz, 0.04, 0, 0.2),
      };
    case 'dynamisch':
      return { art: 'dynamisch', satz: zahl(roh.satz, 0.04, 0, 0.2) };
    case 'annuitaet':
      return {
        art: 'annuitaet',
        renditeModus: roh.renditeModus === 'satz' ? 'satz' : 'gewichtet',
        aktienReal: zahl(roh.aktienReal, ANNUITAET_AKTIEN_REAL, -0.2, 0.2),
        obligationenReal: zahl(roh.obligationenReal, ANNUITAET_OBLIGATIONEN_REAL, -0.2, 0.2),
        satz: zahl(roh.satz, 0.03, -0.2, 0.2),
      };
    case 'toepfe': {
      const anzahl: 2 | 3 = roh.anzahl === 2 ? 2 : 3;
      return {
        art: 'toepfe',
        anzahl,
        pufferMonateStart: zahl(roh.pufferMonateStart, 12, 0, 240),
        pufferMonateZiel: zahl(roh.pufferMonateZiel, 24, 0, 240),
        aufbauJahre: zahl(roh.aufbauJahre, 4, 0, 40),
        keinVerkaufUnter: zahl(roh.keinVerkaufUnter, KEIN_VERKAUF_UNTER, -0.8, 0.5),
        toepfe: normalisiereToepfe(anzahl, roh.toepfe),
      };
    }
    default:
      return standardEntnahme();
  }
}

/** Kurzer Satz für die Ergebnisanzeige. */
export function entnahmeKurztext(e: Entnahme): string {
  switch (e.art) {
    case 'gestaffelt':
      return 'Der Satz für das nächste Jahr richtet sich nach dem realen Depotwachstum des Vorjahres. Im ersten Jahr wird 0 % angenommen.';
    case 'statisch':
      return e.quelle === 'satz'
        ? 'Die reale Entnahme bleibt gleich: Anfangssatz mal freies Vermögen im ersten Jahr ohne Erwerbseinkommen.'
        : 'Die erfassten Lebenshaltungskosten bleiben real gleich und steigen nominal mit der Teuerung. AHV, Pensionskasse und weitere Einnahmen verkleinern die Lücke.';
    case 'dynamisch':
      return 'Jedes Jahr wird ein fester Prozentsatz des dann aktuellen freien Vermögens entnommen.';
    case 'annuitaet':
      return 'Die Entnahme wird jedes Jahr so neu gerechnet, dass das freie Vermögen bis zum Planungsalter bei der angenommenen Realrendite auf null sinkt.';
    case 'toepfe':
      return 'Ausgaben kommen zuerst aus Cash / Geldmarkt. Der Puffer wächst vom Startziel zum Zielpuffer; Risikotöpfe werden in einem schwachen Jahr nicht zur Auffüllung verkauft.';
  }
}
