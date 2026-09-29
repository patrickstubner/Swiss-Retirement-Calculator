/**
 * Umkehrrechnung: Wie viel kann der Haushalt höchstens ausgeben, damit das Geld bis zum Planungsalter reicht
 * und am Ende ein Zielvermögen übrig bleibt?
 *
 * - Ausgabenmuster: konstant (real) oder empirische Kurve Go-go / Slow-go / No-go (Anteile der Ausgaben der
 *   aktiven Jahre, Alter der Referenzperson) mit optionaler Pflegeheim-Reserve.
 * - Ziel am Planungsalter: Restvermögen als Betrag in heutigen Franken oder «Vermögen real konstant bzw. um
 *   ±g pro Jahr wachsen/schrumpfen» (Basis: verfügbares Startvermögen, `startvermoegen()`).
 * - Methode: deterministisch (ohne Krise oder mit dem gewählten Krisenszenario, Optionen von aussen) oder
 *   Monte Carlo mit Mindest-Erfolgsquote (z.B. 90 %), gleiche Zufallszahlen für alle Beträge (fester Seed).
 * - Suche: Bisektion auf den Grundbetrag B (Ausgaben pro Jahr der Go-go-Phase bzw. konstant), auf CHF 100 genau.
 *   Übrige Posten, Einmalereignisse, Einzeljahr-Abweichungen und Wohnkosten bleiben wie eingegeben.
 *
 * Alle Beträge in heutigen Franken (real). Der Kern kennt keine Datendateien: Kurve, Krisen-Optionen und
 * Monte-Carlo-Daten werden übergeben.
 */

import type { Regeln } from '../rules';
import type { KrisenDaten, KrisenOptionen } from './krisen';
import { type MonteCarloEinstellung, monteCarlo, type PoolKrise } from './montecarlo';
import { referenzPerson, simuliere, startvermoegen } from './simulation';
import type { Ausgaben, AusgabenPhase, Haushalt, Monat, SimulationsErgebnis } from './typen';

export interface KurvenPhase {
  id: string;
  label: string;
  /** Letztes Alter der Phase (einschliesslich); null = bis zum Planungsalter */
  bisAlter: number | null;
  /** Anteil der Ausgaben der aktiven Jahre (1 = 100 %) */
  anteil: number;
}

export interface Ausgabenkurve {
  phasen: KurvenPhase[];
  /** Pflegeheim: zusätzliche Kosten pro Jahr (heutige CHF, eine Person) und Dauer in Jahren */
  pflegeBetragJahr: number;
  pflegeJahre: number;
}

export type UmkehrZiel = { art: 'betrag'; betrag: number } | { art: 'wachstum'; rate: number };

export type UmkehrMethode =
  | { art: 'deterministisch'; krisen?: KrisenOptionen }
  | {
      art: 'montecarlo';
      quote: number;
      einstellung: MonteCarloEinstellung;
      daten: KrisenDaten;
      pool: readonly PoolKrise[];
    };

export interface UmkehrEinstellung {
  variante: 'konstant' | 'kurve';
  kurve: Ausgabenkurve;
  /** Nur Variante «kurve»: Pflegeheim-Reserve einrechnen */
  pflege: boolean;
  /** Alter der Referenzperson beim Eintritt ins Pflegeheim (Annahme); Standard: Planungsalter − Dauer */
  pflegeAb?: number;
  ziel: UmkehrZiel;
  methode: UmkehrMethode;
}

export interface UmkehrPhase {
  label: string;
  vonAlter: number;
  bisAlter: number;
  vonJahr: number;
  bisJahr: number;
  anteil: number;
  /** Ausgaben pro Jahr bzw. Monat in heutigen Franken (inkl. Pflege in der Pflegephase) */
  jahr: number;
  monat: number;
  pflege: boolean;
}

export interface UmkehrErgebnis {
  /** false: Selbst ohne Lebenshaltung wird das Ziel nicht erreicht */
  erreichbar: boolean;
  /** Grundbetrag pro Jahr (Go-go bzw. konstant), heutige CHF, auf 100 abgerundet */
  basis: number;
  /** Suche an der Obergrenze abgebrochen (Ausgaben ≥ Obergrenze möglich) */
  obergrenze: boolean;
  phasen: UmkehrPhase[];
  /** Zielvermögen am Planungsalter (heutige CHF) */
  zielReal: number;
  /** Verfügbares Startvermögen (Basis für das Wachstumsziel) */
  start: number;
  /** Deterministische Rechnung mit dem gefundenen Betrag (bei Monte Carlo: ohne Krise) */
  ergebnis: SimulationsErgebnis;
  /** Nur Monte Carlo: Erfolgsquote beim gefundenen Betrag */
  quote: number | null;
  simulationen: number;
}

const OBERGRENZE = 5_000_000;
const GENAUIGKEIT = 100;

/** Anteil der Kurve für ein Alter */
export function kurvenAnteil(k: Ausgabenkurve, alter: number): number {
  const ph = k.phasen.find((p) => p.bisAlter === null || alter <= p.bisAlter) ?? k.phasen.at(-1);
  return ph?.anteil ?? 1;
}

/** Pflegeheim-Eintrittsalter (Standard: die letzten `pflegeJahre` Jahre vor dem Planungsalter). */
export function pflegeBeginn(h: Haushalt, e: Pick<UmkehrEinstellung, 'kurve' | 'pflegeAb'>): number {
  return Math.round(e.pflegeAb ?? h.planungsalter - Math.max(1, e.kurve.pflegeJahre));
}

/**
 * Ausgabenphasen (Alter der Referenzperson) für einen Grundbetrag: konstant = eine Phase; Kurve = Go-go,
 * Slow-go, No-go (+ Pflegephase zuerst, damit sie Vorrang hat).
 */
export function ausgabenPhasen(
  h: Haushalt,
  basis: number,
  e: Omit<UmkehrEinstellung, 'ziel' | 'methode'>,
): AusgabenPhase[] {
  const b = Math.max(0, basis);
  if (e.variante === 'konstant') return [{ id: 'umkehr-konstant', von: 0, bis: null, betrag: b, einheit: 'jahr' }];
  const phasen: AusgabenPhase[] = [];
  if (e.pflege && e.kurve.pflegeBetragJahr > 0 && e.kurve.pflegeJahre > 0) {
    const ab = pflegeBeginn(h, e);
    for (let a = ab; a < ab + e.kurve.pflegeJahre; a++) {
      phasen.push({
        id: `umkehr-pflege-${a}`,
        von: a,
        bis: a,
        betrag: b * kurvenAnteil(e.kurve, a) + e.kurve.pflegeBetragJahr,
        einheit: 'jahr',
      });
    }
  }
  let von = 0;
  for (const p of e.kurve.phasen) {
    phasen.push({ id: `umkehr-${p.id}`, von, bis: p.bisAlter, betrag: b * p.anteil, einheit: 'jahr' });
    if (p.bisAlter === null) break;
    von = p.bisAlter + 1;
  }
  return phasen;
}

/**
 * Phasen zum Übernehmen in die Eingaben (bzw. als Vorlage): erste Phase ab dem heutigen Alter der
 * Referenzperson statt ab 0, Beträge auf CHF 100 gerundet.
 */
export function phasenAbHeute(
  h: Haushalt,
  basis: number,
  e: Omit<UmkehrEinstellung, 'ziel' | 'methode'>,
  jahr: number,
): AusgabenPhase[] {
  const ref = h.personen[referenzPerson(h.personen)];
  const heuteAlter = ref ? jahr - ref.geburtsjahr : 0;
  return ausgabenPhasen(h, basis, e).map((p) => ({
    ...p,
    von: p.von === 0 ? heuteAlter : p.von,
    betrag: Math.round(p.betrag / 100) * 100,
  }));
}

/** Haushalt mit den Ausgaben der Umkehrrechnung (Phasen nach Alter der Referenzperson, ohne Altersfaktoren). */
export function mitUmkehrAusgaben(
  h: Haushalt,
  basis: number,
  e: Omit<UmkehrEinstellung, 'ziel' | 'methode'>,
): Haushalt {
  const ausgaben: Ausgaben = {
    ...h.ausgaben,
    lebenshaltung: Math.max(0, basis),
    faktorAb75: 1,
    faktorAb85: 1,
    phasenBezug: 'alter',
    phasenPerson: referenzPerson(h.personen),
    phasen: ausgabenPhasen(h, basis, e),
  };
  return { ...h, ausgaben };
}

/** Zielvermögen (heutige CHF) für `jahre` simulierte Jahre. */
export function zielVermoegen(z: UmkehrZiel, start: number, jahre: number): number {
  if (z.art === 'betrag') return Math.max(0, z.betrag);
  return Math.max(0, start * (1 + z.rate) ** jahre);
}

/** Zusammenfassung pro Phase für die Anzeige (nur Phasen innerhalb des Horizonts). */
export function phasenUebersicht(
  h: Haushalt,
  basis: number,
  e: Omit<UmkehrEinstellung, 'ziel' | 'methode'>,
  ergebnis: SimulationsErgebnis,
): UmkehrPhase[] {
  const ref = referenzPerson(h.personen);
  const geb = h.personen[ref]?.geburtsjahr ?? 0;
  const erstesAlter = ergebnis.zeilen[0]?.alter[ref] ?? 0;
  const letztesAlter = ergebnis.zeilen.at(-1)?.alter[ref] ?? h.planungsalter;
  const phasen = ausgabenPhasen(h, basis, e);
  const aus: UmkehrPhase[] = [];
  const pflegeListe = phasen.filter((p) => p.id.startsWith('umkehr-pflege-'));
  const normal = phasen.filter((p) => !p.id.startsWith('umkehr-pflege-'));
  const pflegeVon = pflegeListe[0]?.von ?? Number.POSITIVE_INFINITY;
  const pflegeBis = pflegeListe.at(-1)?.bis ?? Number.NEGATIVE_INFINITY;
  const kurvenPh =
    e.variante === 'kurve' ? e.kurve.phasen : [{ id: 'konstant', label: 'Ganze Zeit', bisAlter: null, anteil: 1 }];
  normal.forEach((p, i) => {
    let von = Math.max(p.von, erstesAlter);
    let bis = Math.min(p.bis ?? letztesAlter, letztesAlter);
    // Pflegejahre am Rand herausnehmen (Pflege liegt am Ende bzw. innerhalb der letzten Phase)
    if (pflegeListe.length > 0) {
      if (von >= pflegeVon && von <= pflegeBis) von = pflegeBis + 1;
      if (bis >= pflegeVon && bis <= pflegeBis) bis = pflegeVon - 1;
    }
    if (bis < von) return;
    const kp = kurvenPh[i];
    const zeile = (a: number, b: number) =>
      aus.push({
        label: kp?.label ?? p.id,
        vonAlter: a,
        bisAlter: b,
        vonJahr: geb + a,
        bisJahr: geb + b,
        anteil: kp?.anteil ?? 1,
        jahr: p.betrag,
        monat: p.betrag / 12,
        pflege: false,
      });
    // Pflegejahre mitten in der Phase: Phase in zwei Zeilen teilen
    if (pflegeListe.length > 0 && von < pflegeVon && bis > pflegeBis) {
      zeile(von, pflegeVon - 1);
      zeile(pflegeBis + 1, bis);
    } else zeile(von, bis);
  });
  const pv = Math.max(pflegeVon, erstesAlter);
  const pb = Math.min(pflegeBis, letztesAlter);
  if (pflegeListe.length > 0 && pb >= pv) {
    const betrag = pflegeListe.find((p) => p.von === pv)?.betrag ?? 0;
    aus.push({
      label: 'Pflegeheim (Reserve, eine Person)',
      vonAlter: pv,
      bisAlter: pb,
      vonJahr: geb + pv,
      bisJahr: geb + pb,
      anteil: kurvenAnteil(e.kurve, pv),
      jahr: betrag,
      monat: betrag / 12,
      pflege: true,
    });
  }
  return aus.sort((a, b) => a.vonAlter - b.vonAlter);
}

/** Höchster nachhaltiger Grundbetrag (Bisektion). */
export function umkehrrechnung(h: Haushalt, regeln: Regeln, start: Monat, e: UmkehrEinstellung): UmkehrErgebnis {
  const m = e.methode;
  const s0 = startvermoegen(h);
  let simulationen = 0;
  const det = (b: number): SimulationsErgebnis => {
    simulationen++;
    return simuliere(mitUmkehrAusgaben(h, b, e), regeln, {
      start,
      krisen: m.art === 'deterministisch' ? m.krisen : undefined,
    });
  };
  const jahre = det(0).zeilen.length;
  const zielReal = zielVermoegen(e.ziel, s0, jahre);
  const letzteQuote = new Map<number, number>();
  const ok = (b: number): boolean => {
    if (m.art === 'deterministisch') {
      const r = det(b);
      return r.erfolg && r.endVermoegen >= zielReal - 0.5;
    }
    const r = monteCarlo(
      mitUmkehrAusgaben(h, b, e),
      regeln,
      start,
      { ...m.einstellung, zielEndVermoegen: zielReal },
      m.daten,
      m.pool,
    );
    simulationen += r.laeufe;
    letzteQuote.set(b, r.erfolgsquote);
    return r.erfolgsquote >= m.quote - 1e-9;
  };
  const fertig = (basis: number, erreichbar: boolean, obergrenze: boolean): UmkehrErgebnis => {
    const ergebnis = det(basis);
    return {
      erreichbar,
      basis,
      obergrenze,
      phasen: phasenUebersicht(h, basis, e, ergebnis),
      zielReal,
      start: s0,
      ergebnis,
      quote: m.art === 'montecarlo' ? (letzteQuote.get(basis) ?? null) : null,
      simulationen,
    };
  };
  if (!ok(0)) return fertig(0, false, false);
  let lo = 0;
  let hi = Math.max(20_000, Math.round(h.ausgaben.lebenshaltung) || 60_000);
  while (ok(hi)) {
    lo = hi;
    if (hi >= OBERGRENZE) return fertig(Math.floor(lo / GENAUIGKEIT) * GENAUIGKEIT, true, true);
    hi = Math.min(OBERGRENZE, hi * 2);
  }
  while (hi - lo > GENAUIGKEIT) {
    const mitte = (lo + hi) / 2;
    if (ok(mitte)) lo = mitte;
    else hi = mitte;
  }
  let basis = Math.floor(lo / GENAUIGKEIT) * GENAUIGKEIT;
  // Quote für den gerundeten Betrag (Monte Carlo) sicherstellen
  if (m.art === 'montecarlo' && !letzteQuote.has(basis) && !ok(basis)) basis = Math.max(0, basis - GENAUIGKEIT);
  return fertig(basis, true, false);
}
