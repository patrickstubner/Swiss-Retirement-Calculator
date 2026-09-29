/**
 * Wegzug-Vergleich PK/3a: Bezug bei Wohnsitz in der Schweiz gegen Bezug nach dem Wegzug in ein oder zwei
 * Zielländer (z.B. Nicht-EU/EFTA und Portugal). Gerechnet wird mit der normalen Simulation (`simuliere`), pro Fall
 * mit angepasster Wegzugs-Einstellung der gewählten Person; alle anderen Eingaben bleiben gleich.
 *
 * Regeln (Quellen: docs/quellen.md Abschnitt 11 und 17):
 * - Barauszahlung der Austrittsleistung bei endgültigem Verlassen der Schweiz (Art. 5 Abs. 1 lit. a FZG), nur wenn die
 *   Vorsorgeeinrichtung vor dem Bezugsalter verlassen wird (Art. 2 Abs. 1 und 1bis FZG).
 * - EU/EFTA: das BVG-Altersguthaben (Obligatorium) bleibt gesperrt, wenn man dort weiter obligatorisch versichert
 *   ist (Art. 25f FZG); Liechtenstein: bei Wohnsitz dort immer. Nicht-EU/EFTA: alles frei.
 * - 3a: bei Wegzug immer ganz frei (Art. 3 Abs. 2 lit. d BVV 3).
 * - Quellensteuer: Bund plus Kanton des Sitzes der auszahlenden Einrichtung (Art. 96 DBG, ESTV-Übersicht 2026);
 *   Rückerstattung nur, wo ESTV 2-217 «ja» sagt und die Steuer im Zielland bekannt ist (sonst OFFEN).
 */

import { krisenOptionen } from '../data/krisen';
import { wegzugsLand } from '../data/laender';
import type { Regeln } from '../rules';
import { pkBezugMonate, pkWegzugStatus, simuliere } from './simulation';
import type { Haushalt, Monat, PersonInfo, PkWegzugStatus, SimulationsErgebnis } from './typen';
import { geburtIndex, stoppAlterMonate, wegzugIndex } from './zeitpunkt';

export interface WegzugEinstellung {
  /** Index der Person im Haushalt */
  person: number;
  /** Alter beim Wegzug in Monaten */
  wegzugAlterMonate: number;
  /** Zielländer (Codes aus data/laender-2026.json), höchstens zwei */
  ziele: string[];
  /** Sitzkantone der Einrichtungen ('' = Wohnkanton) */
  sitzPk: string;
  sitzFz: string;
  sitz3a: string;
  /** Rückerstattung der Quellensteuer gemäss DBA annehmen (nur wo ESTV 2-217 «ja») */
  rueckforderung: boolean;
  /** Steuersatz im Zielland auf zurückgefordertes Vorsorgekapital (null = Satz des Landes, falls bekannt) */
  satzKapitalZielland: number | null;
  /** EU/EFTA: im neuen Land nicht obligatorisch versichert (Art. 25f FZG greift nicht) */
  nichtObligatorischVersichert: boolean;
}

export interface WegzugFallErgebnis {
  id: string;
  titel: string;
  /** Zielland-Code; '' = Wohnsitz bleibt in der Schweiz */
  land: string;
  landName: string;
  euEfta: boolean;
  sim: SimulationsErgebnis;
  info: PersonInfo;
  status: PkWegzugStatus | null;
  /** Kapital (heutige CHF) */
  kapital: {
    pkFrei: number;
    /** Obligatorischer PK-Teil, der gesperrt bleibt (Art. 25f FZG) und erst später als Freizügigkeit fliesst */
    pkGesperrt: number;
    freizuegigkeit: number;
    saeule3a: number;
    brutto: number;
  };
  steuern: {
    /** Quellensteuer, die endgültig in der Schweiz bleibt (Wegzug-Fälle) */
    quellensteuer: number;
    quellensteuerZurueck: number;
    ziellandKapital: number;
    /** Kapitalleistungssteuern des Haushalts im ganzen Zeitraum (heutige CHF; ordentlich bzw. Quellensteuer) */
    kapitalHaushalt: number;
    /** Alle Steuern des Haushalts im ganzen Zeitraum */
    totalHaushalt: number;
  };
  /** Kapital minus Kapitalleistungssteuern der Person (bei Wegzug: Quellensteuer + Steuer im Zielland) */
  nettoKapital: number | null;
  pkRenteJahr: number;
  endVermoegen: number;
  reichtBis: number | null;
  hinweise: string[];
}

const summe = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

/**
 * Standard-Wegzugsalter: der erfasste Wegzug; sonst die Erwerbsaufgabe, höchstens einen Monat vor dem PK-Bezugsalter
 * (erst dann wird bar ausbezahlt, Art. 2 Abs. 1bis FZG).
 */
export function standardWegzugAlterMonate(h: Haushalt, regeln: Regeln, person: number): number {
  const p = h.personen[person];
  if (!p) return 0;
  const w = wegzugIndex(p);
  if (w !== null) return Math.max(0, w - geburtIndex(p));
  const stopp = stoppAlterMonate(p);
  return Math.max(0, Math.min(stopp, pkBezugMonate(p, stopp, regeln) - 1));
}

export function standardEinstellung(h: Haushalt, regeln: Regeln, person = 0): WegzugEinstellung {
  const p = h.personen[person];
  const w = p?.wohnsitzAusland;
  return {
    person,
    wegzugAlterMonate: standardWegzugAlterMonate(h, regeln, person),
    ziele: ['TH', 'ES'],
    sitzPk: w?.sitzkantonVorsorge ?? '',
    sitzFz: w?.sitzkantonFz ?? '',
    sitz3a: w?.sitzkanton3a ?? '',
    rueckforderung: false,
    satzKapitalZielland: null,
    nichtObligatorischVersichert: false,
  };
}

function fall(
  h: Haushalt,
  regeln: Regeln,
  heute: Monat,
  e: WegzugEinstellung,
  id: string,
  titel: string,
  land: string,
): WegzugFallErgebnis {
  const p0 = h.personen[e.person];
  if (!p0) throw new Error('Person fehlt');
  const l = land ? wegzugsLand(land) : undefined;
  const hh: Haushalt = {
    ...h,
    // Der Vergleich rechnet Bezug in einem Schritt (Staffelung gilt nicht bei Wegzug), damit die Fälle vergleichbar sind
    staffelung: undefined,
    personen: h.personen.map((p, i) =>
      i !== e.person
        ? p
        : land
          ? {
              ...p,
              wohnsitzAusland: {
                ...p.wohnsitzAusland,
                aktiv: true,
                modus: 'alter',
                alter: e.wegzugAlterMonate / 12,
                land,
                barauszahlung: true,
                nichtObligatorischVersichert: e.nichtObligatorischVersichert,
                sitzkantonVorsorge: e.sitzPk,
                sitzkantonFz: e.sitzFz,
                sitzkanton3a: e.sitz3a,
                qstKapitalRueckforderung: e.rueckforderung,
                steuerSatzKapitalZielland: e.satzKapitalZielland,
              },
            }
          : { ...p, wohnsitzAusland: { ...p.wohnsitzAusland, aktiv: false } },
    ),
  };
  const sim = simuliere(hh, regeln, { start: heute, krisen: krisenOptionen(hh) });
  const info = sim.personen[e.person] as PersonInfo;
  const bar = info.barauszahlung;
  const startIdx = heute.jahr * 12 + (heute.monat - 1);
  const pkFrei = bar ? bar.pk : info.pkKapital;
  const kapital = {
    pkFrei,
    pkGesperrt: bar?.pkGesperrt ?? 0,
    freizuegigkeit: bar ? bar.freizuegigkeit : info.freizuegigkeitKapital,
    saeule3a: bar ? bar.saeule3a : info.saeule3aKapital,
    brutto: 0,
  };
  kapital.brutto = kapital.pkFrei + kapital.freizuegigkeit + kapital.saeule3a;
  const kapitalHaushalt = summe(sim.zeilen.map((z) => z.steuernKapital));
  const steuern = {
    quellensteuer: info.quellensteuerKapital,
    quellensteuerZurueck: info.quellensteuerKapitalRueckforderung,
    ziellandKapital: info.kapitalSteuerZielland,
    kapitalHaushalt,
    totalHaushalt: summe(sim.zeilen.map((z) => z.steuernKapital + z.steuernEinkommen + z.steuernVermoegen)),
  };
  // Netto: bei Wegzug Quellensteuer + Zielland; in der Schweiz die Kapitalsteuern des Haushalts (bei Paaren nur Näherung)
  const nettoKapital = land
    ? kapital.brutto - steuern.quellensteuer - steuern.ziellandKapital
    : h.personen.length === 1
      ? kapital.brutto - kapitalHaushalt
      : null;
  return {
    id,
    titel,
    land,
    landName: land ? (l?.name ?? land) : 'Schweiz',
    euEfta: l?.euEfta ?? false,
    sim,
    info,
    status: land
      ? pkWegzugStatus(hh.personen[e.person] as (typeof hh.personen)[number], stoppAlterMonate(p0), regeln, startIdx)
      : null,
    kapital,
    steuern,
    nettoKapital,
    pkRenteJahr: info.pkRenteJahr,
    endVermoegen: sim.endVermoegen,
    reichtBis: sim.ruinAlter,
    hinweise: info.hinweise,
  };
}

/** Fall A (Wohnsitz bleibt in der Schweiz) und je Zielland ein Fall. */
export function wegzugVergleich(h: Haushalt, regeln: Regeln, heute: Monat, e: WegzugEinstellung): WegzugFallErgebnis[] {
  const out: WegzugFallErgebnis[] = [fall(h, regeln, heute, e, 'ch', 'A: Wohnsitz bleibt in der Schweiz', '')];
  e.ziele.slice(0, 2).forEach((land, i) => {
    if (!land) return;
    const l = wegzugsLand(land);
    out.push(fall(h, regeln, heute, e, `ziel${i + 1}`, `${'BC'[i]}: Wegzug nach ${l?.name ?? land}`, land));
  });
  return out;
}
