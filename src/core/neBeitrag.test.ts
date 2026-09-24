/** Referenzwerte: MB 2.03 Beitragstabelle Nichterwerbstätige 2026. */
import { describe, expect, it } from 'vitest';
import { ladeRegeln } from '../rules';
import { neBefreitDurchEhegatte, neBeitrag, neBeitragTabelle, neBemessung } from './neBeitrag';

const regeln = ladeRegeln(2026);
const r = regeln.beitraege.nichterwerbstaetige;

describe('neBeitragTabelle', () => {
  it.each([
    [0, 530],
    [349999, 530],
    [350000, 636],
    [399999, 636],
    [400000, 742],
    [1000000, 636 + 13 * 106],
    [1749999, 3498],
    [1750000, 3604],
    [1800000, 3763],
    [8900000, 26341],
    [8950000, 26500],
    [20000000, 26500],
  ])('Bemessung %i → %i', (b, beitrag) => {
    expect(neBeitragTabelle(b, r)).toBe(beitrag);
  });
});

describe('neBemessung', () => {
  it('Vermögen + 20 × Renteneinkommen', () => {
    expect(neBemessung(500000, 20000, false, r)).toBe(900000);
  });
  it('Verheiratete: je die Hälfte', () => {
    expect(neBemessung(1000000, 30000, true, r)).toBe(800000);
  });
});

describe('neBeitrag inkl. Verwaltungskosten', () => {
  it('900 000 alleinstehend, 5% VK', () => {
    expect(neBeitrag(500000, 20000, false, 0.05, r)).toBeCloseTo((636 + 11 * 106) * 1.05, 8);
  });
  it('VK wird auf 5% begrenzt', () => {
    expect(neBeitrag(0, 0, false, 0.2, r)).toBeCloseTo(530 * 1.05, 8);
  });
  it('Befreiung durch erwerbstätigen Ehegatten (≥ 1 060)', () => {
    expect(neBefreitDurchEhegatte(10000, regeln.beitraege.ahvIvEoSatzTotal, r)).toBe(true);
    expect(neBefreitDurchEhegatte(9000, regeln.beitraege.ahvIvEoSatzTotal, r)).toBe(false);
  });
});
