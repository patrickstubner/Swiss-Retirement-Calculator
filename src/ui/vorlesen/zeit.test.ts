import { describe, expect, it } from 'vitest';
import { kalibriere, START_ZEICHEN_PRO_SEKUNDE, schaetzeDauer, sprungZiel } from './zeit';

describe('Zeitschätzung', () => {
  it('Dauer wächst mit Länge und sinkt mit Tempo', () => {
    const a = schaetzeDauer(140, 1);
    expect(a).toBeGreaterThan(9);
    expect(a).toBeLessThan(11);
    expect(schaetzeDauer(140, 2)).toBeLessThan(a);
    expect(schaetzeDauer(280, 1)).toBeGreaterThan(a);
  });

  it('Randwerte: 0, negativ, NaN, Unendlich', () => {
    expect(schaetzeDauer(0, 1)).toBeGreaterThan(0);
    expect(schaetzeDauer(-5, 1)).toBe(schaetzeDauer(0, 1));
    expect(Number.isFinite(schaetzeDauer(Number.NaN, Number.NaN, Number.NaN))).toBe(true);
    expect(Number.isFinite(schaetzeDauer(Number.POSITIVE_INFINITY, 1))).toBe(true);
    expect(schaetzeDauer(100, 0)).toBeGreaterThan(0);
  });

  it('Kalibrierung nähert sich der Messung, ignoriert Ausreisser und zu kurze Sätze', () => {
    let cps = START_ZEICHEN_PRO_SEKUNDE;
    for (let i = 0; i < 30; i++) cps = kalibriere(cps, 100, 5, 1); // 20 Zeichen/s
    expect(cps).toBeGreaterThan(19);
    expect(cps).toBeLessThan(20.5);
    expect(kalibriere(14, 10, 5, 1)).toBe(14); // zu kurz
    expect(kalibriere(14, 100, 0.1, 1)).toBe(14); // zu schnell gemessen
    expect(kalibriere(14, 100, 5, 0)).toBe(14);
    expect(kalibriere(14, Number.NaN, 5, 1)).toBe(14);
    const hoch = kalibriere(14, 100_000, 1, 1);
    expect(hoch).toBeLessThanOrEqual(30);
  });

  it('Tempo wird beim Kalibrieren herausgerechnet', () => {
    const bei1 = kalibriere(14, 100, 5, 1);
    const bei2 = kalibriere(14, 100, 2.5, 2);
    expect(bei2).toBeCloseTo(bei1, 5);
  });
});

describe('Sprungberechnung (±10 s auf Satzgrenzen)', () => {
  const d = [4, 4, 4, 4, 4, 4]; // 6 Sätze à 4 s

  it('vor: mindestens ein Satz, ca. 10 s später', () => {
    expect(sprungZiel(d, 0, 0, 10)).toBe(2); // 10 s liegt im dritten Satz
    expect(sprungZiel(d, 0, 2, 10)).toBe(3); // 12 s
    expect(sprungZiel(d, 1, 0, 1)).toBe(2); // mindestens einen weiter
  });

  it('zurück: zum Satzanfang, ca. 10 s früher', () => {
    expect(sprungZiel(d, 5, 0, -10)).toBe(2); // 20 - 10 = 10 s → Satz 2
    expect(sprungZiel(d, 3, 1, -10)).toBe(0); // 13 - 10 = 3 s → Satz 0
    expect(sprungZiel(d, 3, 3, -1)).toBe(3); // im Satz weit: zurück an dessen Anfang
    expect(sprungZiel(d, 0, 3, -10)).toBe(0);
  });

  it('über das Ende: dauern.length (fertig)', () => {
    expect(sprungZiel(d, 5, 0, 10)).toBe(6);
    expect(sprungZiel(d, 4, 3, 100)).toBe(6);
  });

  it('Randfälle', () => {
    expect(sprungZiel([], 0, 0, 10)).toBe(0);
    expect(sprungZiel([5], 0, 0, -10)).toBe(0);
    expect(sprungZiel([5], 0, 0, 10)).toBe(1);
    expect(sprungZiel(d, 99, 0, -10)).toBeLessThanOrEqual(5);
    expect(sprungZiel(d, -3, 0, 10)).toBeGreaterThanOrEqual(1);
    expect(sprungZiel(d, 0, Number.NaN, Number.NaN)).toBe(0);
    expect(sprungZiel([0, 0, 0], 0, 0, 10)).toBe(3);
  });

  it('Fuzz: Ergebnis liegt immer in [0, n], vorwärts nie zurück, rückwärts nie vorwärts', () => {
    let seed = 99;
    const r = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let k = 0; k < 500; k++) {
      const n = 1 + Math.floor(r() * 30);
      const dd = Array.from({ length: n }, () => r() * 12);
      const i = Math.floor(r() * n);
      const f = r() * 12;
      const delta = (r() - 0.5) * 40;
      const z = sprungZiel(dd, i, f, delta);
      expect(z).toBeGreaterThanOrEqual(0);
      expect(z).toBeLessThanOrEqual(n);
      if (delta > 0) expect(z).toBeGreaterThan(i);
      if (delta < 0) expect(z).toBeLessThanOrEqual(i);
    }
  });
});
