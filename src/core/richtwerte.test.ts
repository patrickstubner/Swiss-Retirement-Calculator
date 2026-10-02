import { describe, expect, it } from 'vitest';
import { KRISEN_DATEN } from '../data/krisen';
import { richtwerte } from './richtwerte';

const pct = (x: number) => Math.round(x * 1000) / 10;

describe('Richtwerte Aktienanteil → historische nominale Rendite (JST R6, 1900–2020)', () => {
  it('Schweiz: Werte stimmen mit der unabhängigen Python-Rechnung überein', () => {
    const r = richtwerte(KRISEN_DATEN, 'CHE');
    expect(r.map((x) => pct(x.nominal))).toEqual([7.2, 6.7, 6.1, 5.2, 4.1]);
    expect(r[0]?.jahre).toBe(120);
  });

  it('USA: Werte stimmen mit der unabhängigen Python-Rechnung überein', () => {
    const r = richtwerte(KRISEN_DATEN, 'USA');
    expect(r.map((x) => pct(x.nominal))).toEqual([9.7, 8.8, 7.6, 6.3, 4.6]);
  });

  it('sinkt mit weniger Aktien (Schweiz und USA)', () => {
    for (const land of ['CHE', 'USA'] as const) {
      const r = richtwerte(KRISEN_DATEN, land).map((x) => x.nominal);
      for (let i = 1; i < r.length; i++) expect(r[i] as number).toBeLessThan(r[i - 1] as number);
    }
  });

  it('leere Daten: NaN statt Absturz', () => {
    const leer = { CHE: new Map(), USA: new Map(), JPN: new Map() };
    expect(richtwerte(leer, 'CHE')[0]?.nominal).toBeNaN();
  });
});
