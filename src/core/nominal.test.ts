import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { KRISEN_DATEN, krisenOptionen, mcKrisenPool } from '../data/krisen';
import { ladeRegeln } from '../rules';
import { monteCarlo, reichtBisAlter } from './montecarlo';
import { inDarstellung, nominalErgebnis, teuerungsIndex } from './nominal';
import { simuliere } from './simulation';
import type { Haushalt } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/** Erfundenes Beispiel: Person Jg. 1962, Rücktritt mit 65, 800'000 Wertschriften */
function haushalt(inflation = 0.02): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Muster',
    geburtsjahr: 1962,
    geburtsmonat: 3,
    lohn: 110_000,
    stoppAlter: 65,
    wertschriften: 800_000,
  });
  return {
    ...h,
    personen: [p],
    ausgaben: { ...h.ausgaben, lebenshaltung: 70_000 },
    annahmen: { ...h.annahmen, inflation },
    planungsalter: 95,
  };
}

describe('Nominale Darstellung', () => {
  it('multipliziert mit der kumulierten Teuerung des Pfads (Fluss: Jahresbeginn, Bestand: Jahresende)', () => {
    const e = simuliere(haushalt(0.02), regeln, { start });
    const n = nominalErgebnis(e);
    e.zeilen.forEach((z, i) => {
      const m = n.zeilen[i];
      if (!m) throw new Error('Zeile fehlt');
      // Erstes Jahr zählt als ganzes Teuerungsjahr: Index Ende = 1,02^(i+1), Beginn = 1,02^i
      expect(z.indexEnde).toBeCloseTo(1.02 ** (i + 1), 10);
      expect(z.indexBeginn).toBeCloseTo(1.02 ** i, 10);
      expect(m.ausgaben).toBeCloseTo(z.ausgaben * z.indexBeginn, 6);
      expect(m.ahv).toBeCloseTo(z.ahv * z.indexBeginn, 6);
      expect(m.vermoegen).toBeCloseTo(z.vermoegen * z.indexEnde, 6);
      expect(m.toepfe.wertschriften).toBeCloseTo(z.toepfe.wertschriften * z.indexEnde, 6);
      expect(m.alter).toEqual(z.alter);
    });
    expect(n.endVermoegen).toBeCloseTo(e.endVermoegen * (e.zeilen.at(-1)?.indexEnde ?? 0), 4);
    // Punktwerte der Personen mit dem Index ihres Jahres
    const p = e.personen[0];
    const pn = n.personen[0];
    if (!p || !pn) throw new Error('Person fehlt');
    expect(pn.ahvRenteMonatStart).toBeCloseTo(p.ahvRenteMonatStart * teuerungsIndex(e, p.ahvStart.jahr), 6);
    expect(pn.pkKapital + pn.pkRenteJahr).toBeGreaterThanOrEqual(p.pkKapital + p.pkRenteJahr);
    // Rechnung selbst unverändert
    expect(n.erfolg).toBe(e.erfolg);
    expect(n.ruinAlter).toBe(e.ruinAlter);
  });

  it('ist bei 0 % Teuerung identisch mit real, und «real» gibt das Original zurück', () => {
    const e = simuliere(haushalt(0), regeln, { start });
    const n = nominalErgebnis(e);
    expect(n.endVermoegen).toBeCloseTo(e.endVermoegen, 6);
    expect(inDarstellung(e, 'real')).toBe(e);
  });

  it('verwendet in Krisenjahren die historische Teuerung', () => {
    const h: Haushalt = {
      ...haushalt(0.01),
      krisen: {
        ...haushalt().krisen,
        modus: 'individuell',
        auswahl: [
          {
            uid: 'k1',
            id: 'oelkrise1973',
            startArt: 'jahr',
            jahr: 2030,
            land: 'CHE',
            alter: 70,
            person: 0,
            jahreNach: 0,
          },
        ],
      },
    };
    const opt = krisenOptionen(h);
    const e = simuliere(h, regeln, { start, krisen: opt });
    const faktoren = e.zeilen.map((z, i) => z.indexEnde / (i === 0 ? 1 : (e.zeilen[i - 1]?.indexEnde ?? 1)));
    // Normale Jahre: Annahme 1 %
    expect(faktoren[0]).toBeCloseTo(1.01, 10);
    // Mindestens ein Krisenjahr mit deutlich höherer Teuerung (Schweiz 1973/74: über 8 %)
    expect(Math.max(...faktoren)).toBeGreaterThan(1.05);
    const n = nominalErgebnis(e);
    const z = e.zeilen.at(-1);
    expect(n.zeilen.at(-1)?.vermoegen).toBeCloseTo((z?.vermoegen ?? 0) * (z?.indexEnde ?? 0), 4);
  });
});

describe('Monte Carlo: Fächer, nominal und Zielvermögen', () => {
  const e = {
    art: 'wiederkehrend' as const,
    laeufe: 60,
    seed: 11,
    krisenProDekade: 1,
    blockLaenge: 5,
    bootstrapLand: 'CHE' as const,
  };
  const pool = mcKrisenPool();

  it('liefert geordnete Perzentile p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90, real und nominal', () => {
    const m = monteCarlo(haushalt(), regeln, start, e, KRISEN_DATEN, pool);
    for (const b of [m, m.nominal]) {
      b.p10.forEach((v, i) => {
        expect(v).toBeLessThanOrEqual(b.p25[i] ?? 0);
        expect(b.p25[i] ?? 0).toBeLessThanOrEqual(b.p50[i] ?? 0);
        expect(b.p50[i] ?? 0).toBeLessThanOrEqual(b.p75[i] ?? 0);
        expect(b.p75[i] ?? 0).toBeLessThanOrEqual(b.p90[i] ?? 0);
      });
    }
    // Teuerung positiv: nominaler Median am Ende über dem realen (sofern positiv)
    const t = m.p50.length - 1;
    if ((m.p50[t] ?? 0) > 0) expect(m.nominal.p50[t] ?? 0).toBeGreaterThan(m.p50[t] ?? 0);
    expect(m.ruinAlterSortiert).toHaveLength(60);
  });

  it('«reicht bis Alter» je Wahrscheinlichkeit ist monoton', () => {
    const m = monteCarlo(
      { ...haushalt(), ausgaben: { ...haushalt().ausgaben, lebenshaltung: 95_000 } },
      regeln,
      start,
      e,
      KRISEN_DATEN,
      pool,
    );
    const a = (w: number) => reichtBisAlter(m, w) ?? Number.POSITIVE_INFINITY;
    expect(a(0.9)).toBeLessThanOrEqual(a(0.75));
    expect(a(0.75)).toBeLessThanOrEqual(a(0.5));
    expect(reichtBisAlter(m, 0.9)).toBe(m.reichtBisAlterP10);
  });

  it('zählt mit Zielvermögen nur Läufe mit genügend Restvermögen', () => {
    const ohne = monteCarlo(haushalt(), regeln, start, e, KRISEN_DATEN, pool);
    const mit = monteCarlo(haushalt(), regeln, start, { ...e, zielEndVermoegen: 500_000 }, KRISEN_DATEN, pool);
    expect(ohne.erfolgsquote).toBe(ohne.reichtQuote);
    expect(mit.reichtQuote).toBe(ohne.reichtQuote);
    expect(mit.erfolgsquote).toBeLessThanOrEqual(ohne.erfolgsquote);
    const riesig = monteCarlo(haushalt(), regeln, start, { ...e, zielEndVermoegen: 1e12 }, KRISEN_DATEN, pool);
    expect(riesig.erfolgsquote).toBe(0);
  });
});
