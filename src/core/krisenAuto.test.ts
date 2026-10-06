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
  automatischeKrisenAlsAuswahl,
  autoNormal,
  autoZyklus,
  KRISEN_DATEN,
  krisenListeZusammenfuehren,
  krisenOptionen,
  mcKrisenPool,
  STANDARD_KRISEN_PRO_DEKADE,
  standardErsteKrise,
} from '../data/krisen';
import { ladeRegeln } from '../rules';
import { dekodiere, kodiere } from '../ui/state';
import {
  ausgleichErwartet,
  ausgleichErwartetHorizont,
  JAHRE_NACH_MAX,
  JAHRE_NACH_MIN,
  jahresRenditen,
  krisenModell,
  krisenPlan,
  wertschriftenHist,
} from './krisen';
import { wiederkehrendeKrisenPfad, zufall } from './montecarlo';
import { referenzPerson, simuliere } from './simulation';
import { fruehestesRuecktrittsalter } from './solver';
import type { Haushalt, KrisenEinstellungen } from './typen';
import { geburtIndex, stoppAlterMonate } from './zeitpunkt';

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

function ruecktrittVon(h: Haushalt): number {
  const i = Math.max(
    0,
    h.personen.findIndex((p) => p.erwerbsstatus !== 'nichtErwerbstaetig'),
  );
  const p = h.personen[i] ?? h.personen[0];
  if (!p) return start.jahr;
  return Math.floor((geburtIndex(p) + Math.max(0, stoppAlterMonate(p))) / 12);
}

function horizontVon(h: Haushalt): { von: number; bis: number } {
  const p = h.personen[referenzPerson(h.personen)];
  const bis = (p?.geburtsjahr ?? start.jahr) + Math.floor(h.planungsalter);
  return { von: start.jahr, bis: Math.max(start.jahr, bis) };
}

function nachUebernahme(h: Haushalt): Haushalt {
  const liste = automatischeKrisenAlsAuswahl(h.krisen, ruecktrittVon(h), horizontVon(h));
  return { ...h, krisen: { ...h.krisen, modus: 'individuell', auswahl: liste, ausgleich: true } };
}

function erwarteGleich(auto: Haushalt, individuell: Haushalt, st = start) {
  const a = simuliere(auto, regeln, { start: st, krisen: krisenOptionen(auto) });
  const b = simuliere(individuell, regeln, { start: st, krisen: krisenOptionen(individuell) });
  expect(b.endVermoegen).toBe(a.endVermoegen);
  expect(b.krisenJahre).toEqual(a.krisenJahre);
  expect(b.krisenNormal).toEqual(a.krisenNormal);
  expect(b.ruinJahr).toBe(a.ruinJahr);
  return a;
}

describe('Automatische Krisen übernehmen', () => {
  it('Standard: dieselben Krisen und dasselbe Ergebnis wie «Automatisch»', () => {
    const h = haushalt();
    const ind = nachUebernahme(h);
    expect(ind.krisen.auswahl.map((a) => [a.id, a.jahr, a.startArt])).toEqual([
      ['oelkrise1973', 2036, 'jahr'],
      ['schwarzerMontag1987', 2050, 'jahr'],
      ['immobilienCh1990', 2063, 'jahr'],
    ]);
    expect(ind.krisen.ausgleich).toBe(true);
    const e = erwarteGleich(h, ind);
    expect(e.krisenJahre.filter((x, i, a) => i === 0 || a[i - 1]?.krise !== x.krise).map((x) => x.jahr)).toEqual([
      2036, 2050, 2063,
    ]);
  });

  it('«nach dem Rücktritt» bleibt ein Abstand und wandert mit', () => {
    const h = haushalt({ autoStartArt: 'nachRuecktritt', autoJahreNach: 2 });
    const ind = nachUebernahme(h);
    expect(ind.krisen.auswahl[0]).toMatchObject({
      id: 'oelkrise1973',
      jahr: 2032,
      startArt: 'nachRuecktritt',
      jahreNach: 2,
    });
    expect(ind.krisen.auswahl[1]).toMatchObject({ startArt: 'nachRuecktritt', jahreNach: 16 });
    for (const a of ind.krisen.auswahl) {
      expect(a.jahreNach).toBeGreaterThanOrEqual(JAHRE_NACH_MIN);
      expect(a.jahreNach).toBeLessThanOrEqual(JAHRE_NACH_MAX);
    }
    erwarteGleich(h, ind);
    const geladen = dekodiere(kodiere(ind), regeln);
    if (!geladen) throw new Error('Dekodieren fehlgeschlagen');
    expect(geladen.krisen.auswahl.map((a) => [a.id, a.jahreNach, a.startArt])).toEqual(
      ind.krisen.auswahl.map((a) => [a.id, a.jahreNach, a.startArt]),
    );
    erwarteGleich(h, geladen);
  });

  it('angebrochenes erstes Jahr bleibt gleich', () => {
    const h = haushalt();
    erwarteGleich(h, nachUebernahme(h), { jahr: 2026, monat: 10 });
  });

  it('mehr als 8 Krisen im Horizont: die angehobene Grenze hält das Ergebnis gleich', () => {
    const h = haushalt({ autoProDekade: 5 });
    const ind = nachUebernahme(h);
    expect(ind.krisen.auswahl.length).toBeGreaterThan(8);
    expect(ind.krisen.auswahl.length).toBeLessThanOrEqual(120);
    erwarteGleich(h, ind);
  });

  it('ohne Ausgleich bleiben die Krisenjahre, das Vermögen weicht ab', () => {
    const h = haushalt();
    const ind = nachUebernahme(h);
    const stress = { ...ind, krisen: { ...ind.krisen, ausgleich: false } };
    const a = simuliere(h, regeln, { start, krisen: krisenOptionen(h) });
    const b = simuliere(stress, regeln, { start, krisen: krisenOptionen(stress) });
    expect(krisenOptionen(stress)?.ausgleichHorizont).toBeUndefined();
    expect(b.krisenJahre).toEqual(a.krisenJahre);
    expect(b.krisenNormal).toBeNull();
    expect(b.endVermoegen).not.toBe(a.endVermoegen);
  });

  it('Speicher und Link behalten die übernommene Liste und das gleiche Ergebnis', () => {
    const h = haushalt();
    const ind = nachUebernahme(h);
    const geladen = dekodiere(kodiere(ind), regeln);
    if (!geladen) throw new Error('Dekodieren fehlgeschlagen');
    expect(geladen.krisen.ausgleich).toBe(true);
    expect(geladen.krisen.auswahl.map((a) => [a.id, a.jahr, a.startArt])).toEqual(
      ind.krisen.auswahl.map((a) => [a.id, a.jahr, a.startArt]),
    );
    erwarteGleich(h, geladen);
  });

  it('Anhängen setzt dieselbe Krise im selben Jahr nicht doppelt und achtet auf die Grenze', () => {
    const h = haushalt();
    const neu = automatischeKrisenAlsAuswahl(h.krisen, ruecktrittVon(h), horizontVon(h));
    const erst = krisenListeZusammenfuehren([], neu);
    expect(erst.ausgelassen).toBe(0);
    const nochmal = krisenListeZusammenfuehren(erst.auswahl, neu);
    expect(nochmal.auswahl).toHaveLength(erst.auswahl.length);
    expect(nochmal.ausgelassen).toBe(0);
    const voll = krisenListeZusammenfuehren(erst.auswahl, neu, erst.auswahl.length);
    expect(voll.auswahl).toHaveLength(erst.auswahl.length);
    expect(voll.ausgelassen).toBe(0);
    const eng = krisenListeZusammenfuehren(erst.auswahl.slice(0, 1), neu, 2);
    expect(eng.auswahl).toHaveLength(2);
    expect(eng.ausgelassen).toBe(neu.length - 2);
    const relativ = automatischeKrisenAlsAuswahl(
      haushalt({ autoStartArt: 'nachRuecktritt', autoJahreNach: 2 }).krisen,
      ruecktrittVon(h),
      horizontVon(h),
    );
    const dazu = krisenListeZusammenfuehren(erst.auswahl, relativ);
    expect(dazu.auswahl.length).toBe(erst.auswahl.length + relativ.length);
    const nochmalRelativ = krisenListeZusammenfuehren(relativ, relativ);
    expect(nochmalRelativ.auswahl).toHaveLength(relativ.length);
    expect(nochmalRelativ.ausgelassen).toBe(0);
  });

  it('grosse Abstände nach dem Rücktritt überstehen das Speichern', () => {
    const h = haushalt({ autoStartArt: 'nachRuecktritt', autoJahreNach: 60, autoProDekade: 5 });
    const ind = nachUebernahme(h);
    expect(ind.krisen.auswahl.some((a) => a.jahreNach > 60)).toBe(true);
    expect(Math.max(...ind.krisen.auswahl.map((a) => a.jahreNach))).toBeLessThanOrEqual(JAHRE_NACH_MAX);
    const geladen = dekodiere(kodiere(ind), regeln);
    if (!geladen) throw new Error('Dekodieren fehlgeschlagen');
    erwarteGleich(h, geladen);
  });
});

describe('Frühestes Rücktrittsalter nach der Übernahme', () => {
  const suchOpt = {
    start,
    modus: 'person' as const,
    person: 0,
    maxAlter: 70,
  };

  function suchHaushalt(teil: {
    geburtsjahr: number;
    geburtsmonat?: number;
    stoppAlter?: number;
    planungsalter?: number;
    autoStartArt?: 'jahr' | 'nachRuecktritt';
    autoJahreNach?: number;
    autoProDekade?: number;
    wertschriften?: number;
    lebenshaltung?: number;
  }): Haushalt {
    const h = haushalt({
      autoStartArt: teil.autoStartArt ?? 'nachRuecktritt',
      autoJahreNach: teil.autoJahreNach ?? 0,
      autoProDekade: teil.autoProDekade ?? 0.74,
    });
    const person = h.personen[0];
    if (!person) throw new Error('Person fehlt');
    person.name = 'Beispiel';
    person.geburtsjahr = teil.geburtsjahr;
    person.geburtsmonat = teil.geburtsmonat ?? 3;
    person.stoppAlter = teil.stoppAlter ?? 65;
    person.lohn = 110_000;
    person.wertschriften = teil.wertschriften ?? 280_000;
    person.pk.guthaben = 160_000;
    h.ausgaben = { ...h.ausgaben, lebenshaltung: teil.lebenshaltung ?? 78_000 };
    h.planungsalter = teil.planungsalter ?? 100;
    h.entnahme = { art: 'statisch', quelle: 'ausgaben', satz: 0.04 };
    return h;
  }

  function gleicheSuche(auto: Haushalt) {
    const ind = nachUebernahme(auto);
    const a = fruehestesRuecktrittsalter(auto, regeln, { ...suchOpt, krisen: krisenOptionen(auto) });
    const b = fruehestesRuecktrittsalter(ind, regeln, { ...suchOpt, krisen: krisenOptionen(ind) });
    expect(b.gefunden).toBe(a.gefunden);
    expect(b.alterMonate).toBe(a.alterMonate);
    return a;
  }

  it('Automatisch und Individuell nach Übernahme finden dasselbe Alter', () => {
    const jahre = [1958, 1962, 1964, 1966, 1980, 1985, 1990];
    const monate = [1, 7];
    const stopps = [60, 65, 70];
    const abstaende = [-5, 0, 2, 15];
    let faelle = 0;
    let gesucht = 0;
    let ohneTreffer = 0;
    for (const geburtsjahr of jahre) {
      for (const geburtsmonat of monate) {
        for (const stoppAlter of stopps) {
          for (const autoJahreNach of abstaende) {
            faelle++;
            const a = gleicheSuche(suchHaushalt({ geburtsjahr, geburtsmonat, stoppAlter, autoJahreNach }));
            if (!a.sofort) gesucht++;
            if (!a.gefunden) ohneTreffer++;
          }
        }
      }
    }
    // 7 Jahrgänge × 2 Monate × 3 Stopp-Alter × 4 Abstände
    expect(faelle).toBe(168);
    expect(gesucht).toBeGreaterThan(20);
    // dichte und weite Folge, kurzer und langer Horizont: derselbe Treffer
    for (const autoProDekade of [0.74, 2, 5]) {
      for (const planungsalter of [90, 105]) {
        gleicheSuche(suchHaushalt({ geburtsjahr: 1964, autoJahreNach: 2, autoProDekade, planungsalter }));
        gleicheSuche(suchHaushalt({ geburtsjahr: 1985, autoJahreNach: 0, autoProDekade, planungsalter }));
      }
    }
    // Beginn im Kalenderjahr bleibt fest und trifft denselben Treffer
    for (const geburtsjahr of [1958, 1966, 1985]) {
      gleicheSuche(suchHaushalt({ geburtsjahr, autoStartArt: 'jahr', stoppAlter: 64 }));
    }
    expect(ohneTreffer + gesucht).toBeGreaterThan(0);
  }, 120_000);

  it('eigene Krise: Ausgleich rechnet die synthetische Rendite ein', () => {
    const g = Math.log(1.04 / 1.01);
    const h = haushalt();
    h.krisen = {
      ...h.krisen,
      modus: 'individuell',
      ausgleich: true,
      auswahl: [
        {
          uid: 'ek',
          id: 'eigen',
          land: 'CHE',
          startArt: 'jahr',
          jahr: 2032,
          alter: 70,
          person: 0,
          jahreNach: 0,
          eigen: { name: 'Testkrise', rueckgang: -0.5, dauer: 2, erholung: 4 },
        },
      ],
    };
    for (const monat of [1, 10] as const) {
      const st = { jahr: 2026, monat };
      const opt = krisenOptionen(h);
      expect(opt?.ausgleichHorizont).toBe(true);
      const e = simuliere(h, regeln, { start: st, krisen: opt });
      const n = e.krisenNormal;
      if (!n || !opt) throw new Error('kein Ausgleich');
      expect(n.wertschriften).toBeGreaterThan(0.04);
      expect(n.wohneigentum).toBeCloseTo(0.04, 12);
      const m = krisenModell(
        {
          renditeNominal: n.wertschriften,
          renditeBargeld: 0.005,
          inflation: 0.01,
          wohneigentumNominal: n.wohneigentum,
        },
        0.5,
        krisenPlan(
          opt.wahl,
          ruecktrittVon(h),
          h.personen.map((p) => p.geburtsjahr),
        ),
        KRISEN_DATEN,
        st.jahr,
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
      const stress = { ...h, krisen: { ...h.krisen, ausgleich: false } };
      const b = simuliere(stress, regeln, { start: st, krisen: krisenOptionen(stress) });
      expect(b.krisenNormal).toBeNull();
      expect(b.endVermoegen).not.toBe(e.endVermoegen);
    }
  });
});
