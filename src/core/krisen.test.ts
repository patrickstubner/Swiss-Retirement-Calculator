import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import {
  aktienKennzahl,
  HAEUFIGKEIT,
  KRISEN,
  KRISEN_DATEN,
  kriseNach,
  krisenOptionen,
  STANDARD_KRISEN_PRO_DEKADE,
} from '../data/krisen';
import { ladeRegeln } from '../rules';
import {
  bereinigeEigeneKrise,
  bereinigeKrisenName,
  datenVollstaendig,
  eigeneAlsKrise,
  eigenReal,
  jahresRenditen,
  type KrisenWahl,
  krisenAusserhalb,
  krisenKalender,
  krisenModell,
  krisenPfad,
  krisenStartVorschlag,
  krisenUeberlappungen,
  MAX_GEPLANTE_KRISEN,
  maxRealerRueckgang,
  standardEigeneKrise,
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

describe('Geplante Krisen (Modus Individuell)', () => {
  it('Kennzahlen folgen der Datenreihe der Katalogjahre, nicht einer Ersatztabelle', () => {
    for (const kr of KRISEN) {
      const kennzahl = aktienKennzahl(kr, kr.land);
      expect(kennzahl, kr.id).not.toBeNull();
      if (!kennzahl) continue;
      let index = 1;
      let tief = 1;
      let tiefJahr = kr.von - 1;
      let teuerung = 1;
      const imFenster: { jahr: number; index: number }[] = [];
      for (let j = kr.von; j <= kr.bis; j++) {
        const h = KRISEN_DATEN[kr.land].get(j);
        expect(h?.aktien, `${kr.id} ${j}`).not.toBeNull();
        expect(h?.teuerung, `${kr.id} ${j}`).not.toBeNull();
        if (!h || h.aktien === null || h.teuerung === null) continue;
        index *= (1 + h.aktien) / (1 + h.teuerung);
        teuerung *= 1 + h.teuerung;
        imFenster.push({ jahr: j, index });
        if (index < tief) {
          tief = index;
          tiefJahr = j;
        }
      }
      expect(kennzahl.rueckgang, kr.id).toBeCloseTo(tief - 1, 12);
      expect(kennzahl.tiefpunkt, kr.id).toBe(tiefJahr);
      expect(kennzahl.dauer, kr.id).toBe(Math.max(0, tiefJahr - (kr.von - 1)));
      expect(kennzahl.teuerung, kr.id).toBeCloseTo(teuerung - 1, 12);
      let erholt: number | null = null;
      if (tief < 1 - 1e-9) {
        for (const p of imFenster) {
          if (p.jahr > tiefJahr && p.index >= 1 - 1e-9) {
            erholt = p.jahr;
            break;
          }
        }
        for (let j = kr.bis + 1; erholt === null && j <= kr.von + 80; j++) {
          const h = KRISEN_DATEN[kr.land].get(j);
          if (!h || h.aktien === null || h.teuerung === null) break;
          index *= (1 + h.aktien) / (1 + h.teuerung);
          if (index >= 1 - 1e-9) erholt = j;
        }
      }
      expect(kennzahl.erholung, kr.id).toBe(erholt === null ? null : erholt - tiefJahr);
    }
  });

  it('eigene Krise: Rückgang und Erholung treffen den realen Stand, ohne Doppelzählung', () => {
    const eigen = standardEigeneKrise();
    expect(eigen).toEqual({ name: 'Eigene Krise', rueckgang: -0.3, dauer: 2, erholung: 4 });
    let stand = 1;
    for (let i = 0; i < eigen.dauer; i++) stand *= 1 + eigenReal(eigen, i);
    expect(stand).toBeCloseTo(1 + eigen.rueckgang, 12);
    for (let i = 0; i < eigen.erholung; i++) stand *= 1 + eigenReal(eigen, eigen.dauer + i);
    expect(stand).toBeCloseTo(1, 12);
    expect(eigenReal(eigen, 99)).toBe(0);

    const krise = eigeneAlsKrise('abc', eigen);
    const plan = [{ krise, land: 'CHE' as const, startJahr: 2040, eigen }];
    const kal = krisenKalender(plan);
    expect(kal.size).toBe(eigen.dauer + eigen.erholung);
    expect([...kal.keys()]).toEqual([2040, 2041, 2042, 2043, 2044, 2045]);
    const m = krisenModell(basis, 0.2, plan, KRISEN_DATEN, 2040);
    const mAktien = krisenModell(basis, 1, plan, KRISEN_DATEN, 2040);
    for (let t = 0; t < 6; t++) {
      const real = eigenReal(eigen, t);
      const nominal = (1 + real) * (1 + basis.inflation) - 1;
      expect(m.renditeNominal(t)).toBeCloseTo(nominal, 12);
      expect(mAktien.renditeNominal(t)).toBeCloseTo(nominal, 12);
      expect(m.inflation(t)).toBe(basis.inflation);
      expect(m.bargeld?.(t)).toBe(basis.renditeBargeld);
      expect(m.historisch?.(t)?.krise).toBe('eigen:abc');
      expect(m.historisch?.(t)?.name).toBe('Eigene Krise');
    }
    expect(m.renditeNominal(6)).toBe(basis.renditeNominal);
    expect(m.historisch?.(6)).toBeNull();
  });

  it('Überschneidung: späterer Beginn gewinnt, jedes Jahr genau eine Rendite', () => {
    const dotcom = k('dotcom2000');
    const finanz = k('finanzkrise2007');
    const plan = [
      { krise: dotcom, land: 'CHE' as const, startJahr: 2040 },
      { krise: finanz, land: 'CHE' as const, startJahr: 2041 },
    ];
    const kal = krisenKalender(plan);
    expect(kal.get(2040)?.krise).toBe('dotcom2000');
    expect(kal.get(2041)?.jahr).toBe(2007);
    expect(kal.get(2042)?.jahr).toBe(2008);
    expect(kal.get(2043)?.jahr).toBe(2009);
    expect(kal.has(2044)).toBe(false);
    const ueber = krisenUeberlappungen(plan);
    expect(ueber).toEqual([{ jahrVon: 2041, jahrBis: 2042, gilt: 'Finanzkrise', verdraengt: 'Dotcom' }]);
    const m = krisenModell(basis, 1, plan, KRISEN_DATEN, 2040);
    expect(m.renditeNominal(1)).toBeCloseTo(KRISEN_DATEN.CHE.get(2007)?.aktien ?? 0, 6);
    expect(m.renditeNominal(1)).not.toBeCloseTo(
      (KRISEN_DATEN.CHE.get(2001)?.aktien ?? 0) + (KRISEN_DATEN.CHE.get(2007)?.aktien ?? 0),
      2,
    );
    const gleich = krisenKalender([
      { krise: dotcom, land: 'CHE', startJahr: 2050 },
      { krise: finanz, land: 'CHE', startJahr: 2050 },
    ]);
    expect(gleich.get(2050)?.krise).toBe('finanzkrise2007');
  });

  it('Startjahr: Vorschlag im Horizont, ausserhalb wird gemeldet', () => {
    expect(krisenStartVorschlag(2026, 2080)).toBe(2036);
    expect(krisenStartVorschlag(2040, 2050)).toBe(2040);
    expect(krisenStartVorschlag(2026, 2030)).toBe(2030);
    expect(krisenStartVorschlag(2026, 2080, 14)).toBe(2050);
    expect(krisenStartVorschlag(2026, 2040, 50)).toBe(2040);
    const plan = [{ krise: k('covid2020'), land: 'CHE' as const, startJahr: 2099 }];
    expect(krisenAusserhalb(plan, 2026, 2080).map((e) => e.startJahr)).toEqual([2099]);
    expect(krisenAusserhalb([{ krise: k('covid2020'), land: 'CHE', startJahr: 2040 }], 2026, 2080)).toEqual([]);
    // Beginn vor dem Horizont, aber die Krise reicht hinein (Immobilienkrise: 8 Jahre)
    const hinein = [{ krise: k('immobilienCh1990'), land: 'CHE' as const, startJahr: 2020 }];
    expect(krisenAusserhalb(hinein, 2026, 2080)).toEqual([]);
    expect(krisenAusserhalb([{ krise: k('covid2020'), land: 'CHE', startJahr: 2020 }], 2026, 2080)).toHaveLength(1);
  });

  it('Namen und Zahlen einer manipulierten eigenen Krise werden bereinigt', () => {
    expect(bereinigeKrisenName('  Meine <Krise>\u0000 ')).toBe('Meine Krise');
    expect(bereinigeKrisenName('')).toBe('Eigene Krise');
    expect(bereinigeKrisenName('x'.repeat(80)).length).toBe(40);
    expect(bereinigeKrisenName('Öl\u202Ekrise\u200B\uFEFF')).toBe('Ölkrise');
    expect(bereinigeKrisenName('A\u2028B\u2029C')).toBe('ABC');
    expect(bereinigeKrisenName('X\uE000Y\uFFFFZ')).toBe('XYZ');
    const e = bereinigeEigeneKrise({
      name: '<script>alert(1)</script>',
      rueckgang: -5,
      dauer: 99,
      erholung: -3,
    });
    expect(e.name).toBe('scriptalert(1)/script');
    expect(e.name).not.toMatch(/[<>]/);
    expect(e.rueckgang).toBe(-0.8);
    expect(e.dauer).toBe(8);
    expect(e.erholung).toBe(0);
    expect(MAX_GEPLANTE_KRISEN).toBe(120);
  });

  it('zwei geplante Krisen erscheinen in den gewählten Jahren, ohne Ausgleich', () => {
    const h = haushalt();
    h.personen[0] = { ...(h.personen[0] as (typeof h.personen)[number]), geburtsjahr: 1980, stoppAlter: 65 };
    h.planungsalter = 90;
    h.krisen = {
      ...h.krisen,
      modus: 'individuell',
      auswahl: [
        {
          uid: 'a',
          id: 'finanzkrise2007',
          land: 'CHE',
          startArt: 'jahr',
          jahr: 2046,
          alter: 70,
          person: 0,
          jahreNach: 0,
          eigen: null,
        },
        {
          uid: 'b',
          id: 'dotcom2000',
          land: 'CHE',
          startArt: 'jahr',
          jahr: 2055,
          alter: 70,
          person: 0,
          jahreNach: 0,
          eigen: null,
        },
      ],
    };
    const opt = krisenOptionen(h);
    expect(opt?.ausgleichHorizont).toBeUndefined();
    const mit = simuliere(h, regeln, { start, krisen: opt });
    expect(mit.krisenNormal).toBeNull();
    expect(mit.krisenJahre.map((x) => x.jahr)).toEqual([2046, 2047, 2048, 2055, 2056, 2057]);
    expect(mit.krisenJahre[0]).toMatchObject({ krise: 'finanzkrise2007', histJahr: 2007 });
    expect(mit.krisenJahre[3]).toMatchObject({ krise: 'dotcom2000', histJahr: 2000 });
    const ohne = simuliere({ ...h, krisen: { ...h.krisen, modus: 'keine' } }, regeln, { start });
    expect(mit.endVermoegen).not.toBe(ohne.endVermoegen);
  });
});
