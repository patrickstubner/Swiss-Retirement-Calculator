/**
 * Krisenmodus «Automatisch»: Platzierung, Rotation, Ersetzen statt Addieren (keine Doppelzählung).
 * Erfundene Beispielhaushalte.
 */
import { describe, expect, it } from 'vitest';
import { neueKrisenEinstellungen, neuePerson, standardHaushalt } from '../data/defaults';
import {
  AUTO_KRISEN,
  AUTO_KRISEN_IDS,
  autoKrisenWahl,
  autoNormal,
  autoZyklus,
  KRISEN_DATEN,
  krisenOptionen,
  mcKrisenPool,
  STANDARD_KRISEN_PRO_DEKADE,
  standardErsteKrise,
} from '../data/krisen';
import { ladeRegeln } from '../rules';
import {
  ausgleichErwartet,
  ausgleichErwartetHorizont,
  jahresRenditen,
  krisenModell,
  krisenPlan,
  wertschriftenHist,
} from './krisen';
import { wiederkehrendeKrisenPfad, zufall } from './montecarlo';
import { simuliere } from './simulation';
import type { Haushalt, KrisenEinstellungen } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

function haushalt(krisen: Partial<KrisenEinstellungen> = {}): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Beispiel',
    geburtsjahr: 1966,
    geburtsmonat: 3,
    lohn: 90_000,
    stoppAlter: 64,
    wertschriften: 800_000,
  });
  return {
    ...h,
    personen: [p],
    ausgaben: { ...h.ausgaben, lebenshaltung: 60_000 },
    planungsalter: 100,
    annahmen: { ...h.annahmen, renditeNominal: 0.04, inflation: 0.01, aktienanteil: 0.5 },
    krisen: { ...neueKrisenEinstellungen(), modus: 'automatisch', ...krisen },
  };
}

const startJahre = (h: Haushalt) =>
  autoKrisenWahl(h.krisen).map((w) => (w.start.art === 'jahr' ? w.start.jahr : Number.NaN));

describe('Automatische Krisenplatzierung', () => {
  it('Liste: nur «normale» Krisen, ohne Depression, Stagflation, Japan', () => {
    expect(AUTO_KRISEN_IDS).toEqual([
      'oelkrise1973',
      'schwarzerMontag1987',
      'immobilienCh1990',
      'dotcom2000',
      'finanzkrise2007',
      'eurokrise2011',
      'covid2020',
      'zinsschock2022',
    ]);
    expect(AUTO_KRISEN.every((k) => k !== undefined)).toBe(true);
    expect(mcKrisenPool().map((p) => p.krise.id)).toEqual([...AUTO_KRISEN_IDS]);
  });

  it('Standard: 0.74 pro Dekade, erste Krise 2036 (2022 + 14), dann alle 13.5 Jahre ohne Drift', () => {
    expect(STANDARD_KRISEN_PRO_DEKADE).toBe(0.74);
    expect(standardErsteKrise(0.74)).toBe(2036);
    const j = startJahre(haushalt());
    expect(j.slice(0, 9)).toEqual([2036, 2050, 2063, 2077, 2090, 2104, 2117, 2131, 2144]);
    // mittlerer Abstand über 8 Krisen = 108 / 8 = 13.5 Jahre
    expect(((j[8] as number) - (j[0] as number)) / 8).toBeCloseTo(10 / 0.74, 0);
  });

  it('Reihenfolge rotiert über die Liste (nach dem Zinsschock wieder die Ölkrise)', () => {
    const ids = autoKrisenWahl(haushalt().krisen).map((w) => w.krise.id);
    expect(ids.slice(0, 10)).toEqual([...AUTO_KRISEN_IDS, 'oelkrise1973', 'schwarzerMontag1987']);
  });

  it('Häufigkeit und erste Krise einstellbar (Kalenderjahr bzw. nach dem Rücktritt)', () => {
    expect(startJahre(haushalt({ autoProDekade: 1, autoStartJahr: 2030 })).slice(0, 3)).toEqual([2030, 2040, 2050]);
    const w = autoKrisenWahl(haushalt({ autoStartArt: 'nachRuecktritt', autoJahreNach: 2 }).krisen);
    expect(w.slice(0, 2).map((x) => x.start)).toEqual([
      { art: 'nachRuecktritt', jahre: 2 },
      { art: 'nachRuecktritt', jahre: 16 },
    ]);
    // im Rücktrittsjahr + 2 (Jg. 1966, Rücktritt mit 64 → 2030) beginnt die Ölkrise
    const e = simuliere(haushalt({ autoStartArt: 'nachRuecktritt', autoJahreNach: 2 }), regeln, {
      start,
      krisen: krisenOptionen(haushalt({ autoStartArt: 'nachRuecktritt', autoJahreNach: 2 })),
    });
    expect(e.krisenJahre.slice(0, 2).map((x) => [x.jahr, x.histJahr])).toEqual([
      [2032, 1973],
      [2033, 1974],
    ]);
  });

  it('in der Simulation: Krisenjahre im Planungszeitraum wie geplant', () => {
    const h = haushalt();
    const e = simuliere(h, regeln, { start, krisen: krisenOptionen(h) });
    const beginne = e.krisenJahre.filter((x, i, a) => i === 0 || a[i - 1]?.krise !== x.krise).map((x) => x.jahr);
    // Planungsalter 100 (Jg. 1966) → bis 2066
    expect(beginne).toEqual([2036, 2050, 2063]);
    expect(e.krisenJahre.filter((x) => x.krise === 'immobilienCh1990').length).toBe(4); // 2063–2066, abgeschnitten
  });
});

describe('Krisenrenditen ersetzen die Annahme (keine Doppelzählung)', () => {
  it('in Krisenjahren gelten genau die historischen Werte, nicht Annahme + Krise', () => {
    const h = haushalt();
    const opt = krisenOptionen(h);
    if (!opt) throw new Error('Optionen fehlen');
    const normal = autoNormal(h);
    const m = krisenModell(
      { renditeNominal: normal.wertschriften, renditeBargeld: 0.005, inflation: 0.01 },
      0.5,
      krisenPlan(opt.wahl, 2030),
      KRISEN_DATEN,
      2026,
    );
    const hist = KRISEN_DATEN.CHE.get(1974);
    if (!hist) throw new Error('Daten fehlen');
    // 2037 = zweites Jahr der Ölkrise (1974)
    expect(m.renditeNominal(2037 - 2026)).toBeCloseTo(wertschriftenHist(hist, 0.5) as number, 12);
    expect(m.inflation(2037 - 2026)).toBe(hist.teuerung);
  });

  it('über einen ganzen Umlauf entspricht die reale Durchschnittsrendite genau der Annahme', () => {
    for (const rate of [0.74, 0.5, 1.5]) {
      const h = haushalt({ autoProDekade: rate });
      const normal = autoNormal(h);
      const z = autoZyklus(rate);
      const m = krisenModell(
        {
          renditeNominal: normal.wertschriften,
          renditeBargeld: 0.005,
          inflation: 0.01,
          wohneigentumNominal: normal.wohneigentum,
        },
        0.5,
        // zwei Umläufe, gemessen wird der zweite (Krisen, die über das Ende reichen, zählen mit)
        [...z.plan, ...z.plan.map((p) => ({ ...p, startJahr: p.startJahr + z.jahre }))],
        KRISEN_DATEN,
        0,
      );
      let ws = 0;
      let wohn = 0;
      let krisenJahre = 0;
      for (let t = z.jahre; t < 2 * z.jahre; t++) {
        ws += Math.log((1 + m.renditeNominal(t)) / (1 + m.inflation(t)));
        wohn += Math.log((1 + (m.wohneigentum?.(t) ?? 0)) / (1 + m.inflation(t)));
        if (m.historisch?.(t)) krisenJahre++;
      }
      const g = Math.log(1.04 / 1.01);
      expect(ws / z.jahre).toBeCloseTo(g, 10);
      expect(wohn / z.jahre).toBeCloseTo(g, 10);
      expect(krisenJahre).toBeGreaterThan(0);
      // normale Jahre liegen über der Annahme (Krisen drücken den Durchschnitt)
      expect(normal.wertschriften).toBeGreaterThan(0.04);
    }
  });

  it('Standard-Ausgleich (0.74, 50 % Aktien) bleibt moderat', () => {
    const n = autoNormal(haushalt());
    expect(n.wertschriften).toBeGreaterThan(0.04);
    expect(n.wertschriften).toBeLessThan(0.06);
  });

  it('«Individuell» (Stresstest) gleicht nicht aus: normale Jahre = Annahme', () => {
    const h = haushalt({ modus: 'individuell' });
    h.krisen.auswahl = [
      {
        uid: 'x',
        id: 'finanzkrise2007',
        land: 'CHE',
        startArt: 'alter',
        jahr: 2030,
        alter: 66,
        person: 0,
        jahreNach: 0,
      },
    ];
    const opt = krisenOptionen(h);
    expect(opt?.normal).toBeUndefined();
    const e = simuliere(h, regeln, { start, krisen: opt });
    // Alter 66 (Jg. 1966) → 2032–2034
    expect(e.krisenJahre.map((x) => x.jahr)).toEqual([2032, 2033, 2034]);
  });

  it('Monte Carlo: im Erwartungswert entspricht die reale Rendite der Annahme', () => {
    const basis = { renditeNominal: 0.04, renditeBargeld: 0.005, inflation: 0.01 };
    const pool = mcKrisenPool();
    const n = ausgleichErwartet(basis, 0.5, pool, 0.74, KRISEN_DATEN);
    const rng = zufall(42);
    const { werte } = wiederkehrendeKrisenPfad(
      rng,
      { ...basis, renditeNominal: n.wertschriften, wohneigentumNominal: n.wohneigentum },
      0.5,
      pool,
      0.74,
      200_000,
      KRISEN_DATEN,
    );
    const g = werte.reduce((s, w) => s + Math.log((1 + w.wertschriften) / (1 + w.inflation)), 0) / werte.length;
    expect(g).toBeCloseTo(Math.log(1.04 / 1.01), 3);
    // ohne Ausgleich läge der Durchschnitt deutlich tiefer (Doppelzählung)
    const ohne = wiederkehrendeKrisenPfad(zufall(42), basis, 0.5, pool, 0.74, 200_000, KRISEN_DATEN).werte;
    const g0 = ohne.reduce((s, w) => s + Math.log((1 + w.wertschriften) / (1 + w.inflation)), 0) / ohne.length;
    expect(g0).toBeLessThan(Math.log(1.04 / 1.01) - 0.002);
    // jahresRenditen ohne Daten = Basis
    expect(jahresRenditen(basis, 0.5, null).wertschriften).toBe(0.04);
  });
});

describe('Ausgleich über den eigenen Planungshorizont (Schema 7)', () => {
  const g = Math.log(1.04 / 1.01);
  it('«Automatisch»: realer Durchschnitt von heute bis zum Planungsalter = Annahme (Wertschriften und Haus)', () => {
    for (const [startJahr, monat, rate] of [
      [2026, 1, 0.74],
      [2026, 10, 0.74],
      [2026, 1, 1.5],
    ] as const) {
      const h = haushalt({ autoProDekade: rate });
      const st = { jahr: startJahr, monat };
      const opt = krisenOptionen(h);
      expect(opt?.ausgleichHorizont).toBe(true);
      const e = simuliere(h, regeln, { start: st, krisen: opt });
      const n = e.krisenNormal;
      if (!n || !opt) throw new Error('kein Ausgleich');
      const m = krisenModell(
        {
          renditeNominal: n.wertschriften,
          renditeBargeld: 0.005,
          inflation: 0.01,
          wohneigentumNominal: n.wohneigentum,
        },
        0.5,
        krisenPlan(opt.wahl, 2030),
        KRISEN_DATEN,
        startJahr,
      );
      let ws = 0;
      let wohn = 0;
      let total = 0;
      e.zeilen.forEach((_z, t) => {
        const w = t === 0 ? (13 - monat) / 12 : 1;
        ws += w * Math.log((1 + m.renditeNominal(t)) / (1 + m.inflation(t)));
        wohn += w * Math.log((1 + (m.wohneigentum?.(t) ?? 0)) / (1 + m.inflation(t)));
        total += w;
      });
      expect(ws / total).toBeCloseTo(g, 10);
      expect(wohn / total).toBeCloseTo(g, 10);
      expect(e.krisenJahre.length).toBeGreaterThan(0);
      // weicht vom Ausgleich über einen ganzen Umlauf ab (Horizont ≠ 108 Jahre)
      expect(Math.abs(n.wertschriften - autoNormal(h).wertschriften)).toBeGreaterThan(1e-4);
    }
  });

  it('ohne Krise im Horizont bleibt die Annahme unverändert', () => {
    const h = { ...haushalt({ autoStartJahr: 2150 }), planungsalter: 90 };
    const e = simuliere(h, regeln, { start, krisen: krisenOptionen(h) });
    expect(e.krisenJahre).toEqual([]);
    expect(e.krisenNormal?.wertschriften).toBeCloseTo(0.04, 12);
  });

  it('Monte Carlo: erwartete reale Rendite über einen endlichen Horizont = Annahme (Krisen abgeschnitten)', () => {
    const basis = { renditeNominal: 0.04, renditeBargeld: 0.005, inflation: 0.01 };
    const pool = mcKrisenPool();
    const jahre = 40;
    const n = ausgleichErwartetHorizont(basis, 0.5, pool, 0.74, new Array(jahre).fill(1), KRISEN_DATEN);
    const rng = zufall(7);
    let summe = 0;
    let summeUnendlich = 0;
    const unendlich = ausgleichErwartet(basis, 0.5, pool, 0.74, KRISEN_DATEN);
    const laeufe = 20_000;
    for (let i = 0; i < laeufe; i++) {
      const { werte } = wiederkehrendeKrisenPfad(
        rng,
        { ...basis, renditeNominal: n.wertschriften, wohneigentumNominal: n.wohneigentum },
        0.5,
        pool,
        0.74,
        jahre,
        KRISEN_DATEN,
      );
      summe += werte.reduce((s, w) => s + Math.log((1 + w.wertschriften) / (1 + w.inflation)), 0);
      const w2 = wiederkehrendeKrisenPfad(
        rng,
        { ...basis, renditeNominal: unendlich.wertschriften, wohneigentumNominal: unendlich.wohneigentum },
        0.5,
        pool,
        0.74,
        jahre,
        KRISEN_DATEN,
      ).werte;
      summeUnendlich += w2.reduce((s, w) => s + Math.log((1 + w.wertschriften) / (1 + w.inflation)), 0);
    }
    expect(summe / laeufe / jahre).toBeCloseTo(g, 3);
    // der Ausgleich für einen unendlichen Horizont liegt bei 40 Jahren messbar daneben
    expect(Math.abs(summeUnendlich / laeufe / jahre - g)).toBeGreaterThan(Math.abs(summe / laeufe / jahre - g));
  });
});
