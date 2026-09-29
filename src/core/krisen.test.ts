import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { HAEUFIGKEIT, KRISEN, KRISEN_DATEN, kriseNach, STANDARD_KRISEN_PRO_DEKADE } from '../data/krisen';
import { ladeRegeln } from '../rules';
import {
  datenVollstaendig,
  jahresRenditen,
  type KrisenWahl,
  krisenKalender,
  krisenModell,
  krisenPfad,
  maxRealerRueckgang,
} from './krisen';
import { monteCarlo, perzentil, vollstaendigeJahre, wiederkehrendeKrisenPfad, zufall } from './montecarlo';
import { simuliere } from './simulation';
import type { Haushalt } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };
const basis = { renditeNominal: 0.04, renditeBargeld: 0.005, inflation: 0.01 };

/** Erfundenes Beispiel: Person Jg. 1964, Rücktritt mit 64, 900'000 Wertschriften */
function haushalt(): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Muster',
    geburtsjahr: 1964,
    geburtsmonat: 6,
    lohn: 100_000,
    stoppAlter: 64,
    wertschriften: 900_000,
  });
  return { ...h, personen: [p], ausgaben: { ...h.ausgaben, lebenshaltung: 70_000 }, planungsalter: 95 };
}

const k = (id: string) => {
  const x = kriseNach(id);
  if (!x) throw new Error(id);
  return x;
};

describe('Historische Daten', () => {
  it('enthalten bekannte Werte aus JST R6 bzw. SNB/BFS', () => {
    expect(KRISEN_DATEN.CHE.get(2008)?.aktien).toBeCloseTo(-0.3405, 3);
    expect(KRISEN_DATEN.USA.get(1931)?.aktien).toBeCloseTo(-0.403, 3);
    // BFS: durchschnittliche Jahresteuerung 2022 +2,8 %
    expect(KRISEN_DATEN.CHE.get(2022)?.teuerung).toBe(0.028);
    // SPI 2022 (SNB capchstocki): 13734.86 / 16444.52 − 1
    expect(KRISEN_DATEN.CHE.get(2022)?.aktien).toBeCloseTo(13734.86 / 16444.52 - 1, 4);
  });

  it('decken alle Krisen des Katalogs mit der Standardreihe vollständig ab', () => {
    for (const kr of KRISEN) expect(datenVollstaendig(kr, kr.land, KRISEN_DATEN), kr.id).toBe(true);
  });
});

describe('Krisen-Replay', () => {
  it('mischt Aktien und Obligationen gemäss Aktienanteil', () => {
    const h = KRISEN_DATEN.CHE.get(2008);
    const r = jahresRenditen(basis, 0.6, h ?? null);
    expect(r.wertschriften).toBeCloseTo(0.6 * -0.340465 + 0.4 * 0.109489, 4);
    expect(r.inflation).toBeCloseTo(h?.teuerung ?? 0, 6);
    expect(r.bargeld).toBeCloseTo(h?.geldmarkt ?? 0, 6);
  });

  it('fällt ohne Daten auf die normalen Annahmen zurück', () => {
    const r = jahresRenditen(basis, 0.5, null);
    expect(r).toMatchObject({ wertschriften: 0.04, bargeld: 0.005, inflation: 0.01, hist: null });
  });

  it('bildet Kalenderjahre ab; bei Überschneidung gilt die später beginnende Krise', () => {
    const kal = krisenKalender([
      { krise: k('dotcom2000'), land: 'CHE', startJahr: 2030 },
      { krise: k('finanzkrise2007'), land: 'CHE', startJahr: 2031 },
    ]);
    expect(kal.get(2030)?.jahr).toBe(2000);
    expect(kal.get(2031)?.jahr).toBe(2007);
    expect(kal.get(2033)?.jahr).toBe(2009);
    expect(kal.has(2034)).toBe(false);
  });

  it('Modell liefert historische Werte nur in den Krisenjahren', () => {
    const m = krisenModell(
      basis,
      1,
      [{ krise: k('finanzkrise2007'), land: 'CHE', startJahr: 2028 }],
      KRISEN_DATEN,
      2026,
    );
    expect(m.renditeNominal(0)).toBe(0.04);
    expect(m.renditeNominal(3)).toBeCloseTo(-0.340465, 4); // 2029 ↔ 2008
    expect(m.historisch?.(3)?.jahr).toBe(2008);
    expect(m.renditeNominal(5)).toBe(0.04);
  });

  it('realer Rückgang Grosse Depression (USA, 100 % Aktien) über 40 %', () => {
    const pfad = krisenPfad(k('depression1929'), 'USA', 1, KRISEN_DATEN, basis);
    expect(maxRealerRueckgang(pfad)).toBeLessThan(-0.4);
  });

  it('eine Krise kurz nach dem Rücktritt senkt das Endvermögen', () => {
    const h = haushalt();
    const ohne = simuliere(h, regeln, { start });
    const wahl: KrisenWahl[] = [
      { krise: k('finanzkrise2007'), land: 'CHE', start: { art: 'nachRuecktritt', jahre: 0 } },
    ];
    const mit = simuliere(h, regeln, { start, krisen: { wahl, daten: KRISEN_DATEN, aktienanteil: 0.6 } });
    expect(mit.endVermoegen).toBeLessThan(ohne.endVermoegen);
    // Rücktritt 2028 (Jg. 1964, Alter 64) → Krisenjahre 2028–2030
    expect(mit.krisenJahre.map((x) => x.jahr)).toEqual([2028, 2029, 2030]);
    expect(mit.krisenJahre[1]?.histJahr).toBe(2008);
  });

  it('ohne Krisen bleibt das Ergebnis unverändert', () => {
    const h = haushalt();
    const a = simuliere(h, regeln, { start });
    const b = simuliere(h, regeln, { start, krisen: { wahl: [], daten: KRISEN_DATEN, aktienanteil: 0.6 } });
    expect(b.endVermoegen).toBe(a.endVermoegen);
    expect(b.krisenJahre).toEqual([]);
  });
});

describe('Krisenhäufigkeit (JST R6)', () => {
  it('Schweiz: reale Aktienrückgänge ≥ 20 % und ≥ 30 % sowie Bankenkrisen', () => {
    const ch = HAEUFIGKEIT.laender.CHE?.['1871-2020'];
    expect(ch?.real20.anzahl).toBe(9);
    expect(ch?.real30.anzahl).toBe(6);
    expect(ch?.banken.jahre).toEqual([1910, 1931, 1991, 2008]);
    expect(STANDARD_KRISEN_PRO_DEKADE).toBeCloseTo(0.74, 2);
  });
});

describe('Monte Carlo', () => {
  it('Zufallsgenerator ist reproduzierbar', () => {
    const a = zufall(42);
    const b = zufall(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('Perzentil', () => {
    expect(perzentil([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(perzentil([1, 2, 3, 4, 5], 0)).toBe(1);
  });

  it('Häufigkeit der Krisen entspricht ungefähr der Vorgabe', () => {
    const rng = zufall(1);
    const pool = [{ krise: k('schwarzerMontag1987'), land: 'CHE' as const }];
    let summe = 0;
    for (let i = 0; i < 400; i++) summe += wiederkehrendeKrisenPfad(rng, basis, 0.5, pool, 1, 30, KRISEN_DATEN).krisen;
    expect(summe / 400).toBeGreaterThan(2.4);
    expect(summe / 400).toBeLessThan(3.6);
  });

  it('Bootstrap nutzt nur vollständige Schweizer Jahre ab 1900', () => {
    const j = vollstaendigeJahre(KRISEN_DATEN, 'CHE');
    expect(j[0]?.jahr).toBeGreaterThanOrEqual(1900);
    expect(j.at(-1)?.jahr).toBe(2024);
  });

  it('liefert Erfolgsquote und Bandbreite (reproduzierbar)', () => {
    const h = haushalt();
    const pool = KRISEN.map((kr) => ({ krise: kr, land: kr.land }));
    const e = {
      art: 'wiederkehrend' as const,
      laeufe: 40,
      seed: 7,
      krisenProDekade: 0.74,
      blockLaenge: 5,
      bootstrapLand: 'CHE' as const,
    };
    const r1 = monteCarlo(h, regeln, start, e, KRISEN_DATEN, pool);
    const r2 = monteCarlo(h, regeln, start, e, KRISEN_DATEN, pool);
    expect(r1.erfolgsquote).toBe(r2.erfolgsquote);
    expect(r1.erfolgsquote).toBeGreaterThanOrEqual(0);
    expect(r1.erfolgsquote).toBeLessThanOrEqual(1);
    r1.p10.forEach((v, i) => {
      expect(v).toBeLessThanOrEqual(r1.p50[i] ?? 0);
      expect(r1.p50[i] ?? 0).toBeLessThanOrEqual(r1.p90[i] ?? 0);
    });
    const b = monteCarlo(h, regeln, start, { ...e, art: 'bootstrap' }, KRISEN_DATEN, pool);
    expect(b.laeufe).toBe(40);
  });
});
