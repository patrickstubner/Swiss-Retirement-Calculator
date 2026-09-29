/** Grundstückgewinnsteuer ZH (§ 225 StG, ZStB 225.1) und AG (§ 109 StG AG). Erfundene Beispiele. */
import { describe, expect, it } from 'vitest';
import { ladeRegeln } from '../rules';
import { ggstSatzAG, ggstZH, grundstueckgewinnsteuer, volleBesitzjahre } from './grundstueckgewinn';

const regeln = ladeRegeln(2026);
const idx = (jahr: number, monat: number) => jahr * 12 + monat - 1;

describe('Grundstückgewinnsteuer ZH', () => {
  it('Grundtarif stimmt mit der Tabelle ZStB 225.1 überein (Besitzdauer 2–4 Jahre, ohne Zu-/Abschlag)', () => {
    const tabelle: [number, number][] = [
      [5000, 550],
      [6000, 700],
      [9900, 1285],
      [10000, 1300],
      [15000, 2300],
      [20000, 3400],
      [24900, 4625],
      [25000, 4650],
      [30000, 5900],
      [35000, 7400],
      [42400, 9620],
    ];
    for (const [g, s] of tabelle) expect(ggstZH(g, 3, 36, regeln)).toBeCloseTo(s, 6);
  });

  it('über 100 000: 40 % auf dem Rest (Tabelle: 145 000 → 47 400, 149 000 → 49 000)', () => {
    expect(ggstZH(100_000, 3, 36, regeln)).toBeCloseTo(29_400, 6);
    expect(ggstZH(145_000, 3, 36, regeln)).toBeCloseTo(47_400, 6);
    expect(ggstZH(149_000, 3, 36, regeln)).toBeCloseTo(49_000, 6);
  });

  it('Gewinne unter 5 000 steuerfrei', () => {
    expect(ggstZH(4999, 3, 36, regeln)).toBe(0);
    expect(ggstZH(5000, 3, 36, regeln)).toBeGreaterThan(0);
  });

  it('Zuschlag unter 1 bzw. 2 Jahren, Ermässigung ab 5 vollen Jahren (+3 % pro Jahr, max. 50 %)', () => {
    const basis = ggstZH(50_000, 3, 36, regeln);
    expect(ggstZH(50_000, 0, 11, regeln)).toBeCloseTo(basis * 1.5, 6);
    expect(ggstZH(50_000, 1, 23, regeln)).toBeCloseTo(basis * 1.25, 6);
    expect(ggstZH(50_000, 4, 59, regeln)).toBeCloseTo(basis, 6);
    expect(ggstZH(50_000, 5, 60, regeln)).toBeCloseTo(basis * 0.95, 6);
    expect(ggstZH(50_000, 10, 120, regeln)).toBeCloseTo(basis * 0.8, 6);
    expect(ggstZH(50_000, 19, 228, regeln)).toBeCloseTo(basis * 0.53, 6);
    expect(ggstZH(50_000, 20, 240, regeln)).toBeCloseTo(basis * 0.5, 6);
    expect(ggstZH(50_000, 35, 420, regeln)).toBeCloseTo(basis * 0.5, 6);
  });
});

describe('Grundstückgewinnsteuer AG', () => {
  it('40 % im ersten Jahr, 2 Prozentpunkte weniger pro Jahr bis 20 %, dann 1 Punkt, ab 25 Jahren 5 %', () => {
    expect(ggstSatzAG(0, regeln)).toBe(0.4);
    expect(ggstSatzAG(1, regeln)).toBe(0.38);
    expect(ggstSatzAG(10, regeln)).toBe(0.2);
    expect(ggstSatzAG(11, regeln)).toBe(0.19);
    expect(ggstSatzAG(18, regeln)).toBe(0.12);
    expect(ggstSatzAG(24, regeln)).toBe(0.06);
    expect(ggstSatzAG(25, regeln)).toBe(0.05);
    expect(ggstSatzAG(40, regeln)).toBe(0.05);
  });
});

describe('Auswahl nach Kanton', () => {
  it('Besitzdauer in vollen Jahren ab dem Kaufmonat', () => {
    expect(volleBesitzjahre(idx(2010, 7), idx(2030, 6))).toBe(19);
    expect(volleBesitzjahre(idx(2010, 7), idx(2030, 7))).toBe(20);
  });

  it('ZH exakt, AG exakt, übrige Kantone Näherung mit Tarif ZH, eigener Satz hat Vorrang', () => {
    const k = idx(2012, 1);
    const v = idx(2030, 1);
    expect(grundstueckgewinnsteuer(200_000, k, v, 'ZH', null, regeln).art).toBe('ZH');
    expect(grundstueckgewinnsteuer(200_000, k, v, 'AG', null, regeln)).toEqual({ steuer: 200_000 * 0.12, art: 'AG' });
    const be = grundstueckgewinnsteuer(200_000, k, v, 'BE', null, regeln);
    expect(be.art).toBe('naeherungZH');
    expect(be.steuer).toBeCloseTo(grundstueckgewinnsteuer(200_000, k, v, 'ZH', null, regeln).steuer, 6);
    expect(grundstueckgewinnsteuer(200_000, k, v, 'ZH', 0.1, regeln)).toEqual({ steuer: 20_000, art: 'eigenerSatz' });
    expect(grundstueckgewinnsteuer(-50_000, k, v, 'ZH', null, regeln).steuer).toBe(0);
  });
});
