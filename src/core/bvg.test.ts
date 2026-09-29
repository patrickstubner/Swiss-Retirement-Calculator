/** Referenzwerte: BSV Beträge 2026, Mitteilungen BV Nr. 167, Art. 16 BVG. */
import { describe, expect, it } from 'vitest';
import { ladeRegeln } from '../rules';
import { bvgAltersgutschrift, bvgAltersgutschriftSatz, bvgKoordinierterLohn, pkLeistung, pkProjektion } from './bvg';

const r = ladeRegeln(2026).bvg;

describe('bvgKoordinierterLohn', () => {
  it.each([
    [20000, 0],
    [22679, 0],
    [22680, 3780],
    [30000, 3780],
    [60000, 33540],
    [90720, 64260],
    [150000, 64260],
  ])('Lohn %i → %i', (lohn, koord) => {
    expect(bvgKoordinierterLohn(lohn, r)).toBe(koord);
  });
});

describe('bvgAltersgutschriftSatz (Art. 16 BVG)', () => {
  it.each([
    [24, 0],
    [25, 0.07],
    [34, 0.07],
    [35, 0.1],
    [45, 0.15],
    [55, 0.18],
    [65, 0.18],
    [66, 0],
  ])('Alter %i → %f', (alter, satz) => {
    expect(bvgAltersgutschriftSatz(alter, 65, r)).toBe(satz);
  });
  it('Gutschrift = koordinierter Lohn × Satz', () => {
    expect(bvgAltersgutschrift(100000, 50, 65, r)).toBeCloseTo(64260 * 0.15, 8);
  });
});

describe('pkProjektion und pkLeistung', () => {
  it('Verzinsung ohne Beiträge', () => {
    expect(pkProjektion(100000, new Array(10).fill(0), 0.0125)).toBeCloseTo(100000 * 1.0125 ** 10, 6);
  });
  it('Beiträge am Jahresende', () => {
    expect(pkProjektion(0, [1000, 1000], 0.1)).toBeCloseTo(2100, 8);
  });
  it('Rente mit Mindestumwandlungssatz 6,8%', () => {
    expect(pkLeistung(500000, 0.068, 0)).toEqual({ kapital: 0, renteJahr: 34000 });
  });
  it('Mix 25% Kapital', () => {
    const l = pkLeistung(400000, 0.06, 0.25);
    expect(l.kapital).toBe(100000);
    expect(l.renteJahr).toBeCloseTo(18000, 8);
  });
});
