/**
 * Referenzwerte: Tarif Art. 36 DBG 2026 (VKP AS 2025 579, ESTV). Die Stufenbeträge des
 * Tarifs sind die offiziellen Tabellenwerte; Kapitalleistungen = 1/5 (Art. 38 DBG).
 */
import { describe, expect, it } from 'vitest';
import { ladeRegeln } from '../rules';
import { dbgEinkommen, dbgKapital, rundeEinkommen } from './steuern';

const r = ladeRegeln(2026).steuern;

describe('dbgEinkommen Alleinstehende 2026', () => {
  it.each([
    [15100, 0],
    [15200, 0],
    [33200, 138.6],
    [43500, 229.2],
    [58000, 612],
    [76200, 1152.5],
    [82100, 1502.95],
    [108900, 3271.75],
    [141500, 6140.55],
    [185100, 10936.55],
    [793900, 91298.15],
    [794000, 91310],
    [1000000, 115000],
  ])('%i → %f', (e, s) => {
    expect(dbgEinkommen(e, 'alleinstehend', r)).toBeCloseTo(s, 2);
  });
  it('innerhalb einer Stufe: 50 000 → 229.20 + 65 × 2.64', () => {
    expect(dbgEinkommen(50000, 'alleinstehend', r)).toBeCloseTo(400.8, 2);
  });
  it('Einkommen wird auf 100 Fr. abgerundet', () => {
    expect(rundeEinkommen(50099, r)).toBe(50000);
    expect(dbgEinkommen(50099, 'alleinstehend', r)).toBeCloseTo(400.8, 2);
  });
  it('Tarif stetig an allen Stufengrenzen (Tabelle konsistent)', () => {
    for (const s of r.dbgTarifAlleinstehend.stufen) {
      const unter = dbgEinkommen(s.ab - 100, 'alleinstehend', r);
      const an = dbgEinkommen(s.ab, 'alleinstehend', r);
      expect(an - unter).toBeGreaterThanOrEqual(0);
      expect(an - unter).toBeLessThan(15);
    }
  });
});

describe('dbgEinkommen Verheiratete 2026', () => {
  it.each([
    [29700, 0],
    [53400, 237],
    [61300, 395],
    [79100, 929],
    [94900, 1561],
    [108700, 2251],
    [120600, 2965],
    [130500, 3658],
    [138400, 4290],
    [144300, 4821],
    [148300, 5221],
    [150400, 5452],
    [152400, 5692],
    [941300, 108249],
    [941400, 108261],
    [1000000, 115000],
  ])('%i → %f', (e, s) => {
    expect(dbgEinkommen(e, 'verheiratet', r)).toBeCloseTo(s, 2);
  });
  it('Kinderabzug 263 pro Kind vom Steuerbetrag', () => {
    expect(dbgEinkommen(100000, 'verheiratet', r, 2)).toBeCloseTo(1561 + 5100 * 0.05 - 526, 2);
  });
});

describe('dbgKapital (1/5 des Tarifs, Art. 38 DBG)', () => {
  it('100 000 alleinstehend', () => {
    expect(dbgKapital(100000, 'alleinstehend', r)).toBeCloseTo((1502.95 + 17900 * 0.066) / 5, 1);
  });
  it('100 000 verheiratet', () => {
    expect(dbgKapital(100000, 'verheiratet', r)).toBeCloseTo(363.2, 2);
  });
  it('500 000 alleinstehend', () => {
    expect(dbgKapital(500000, 'alleinstehend', r)).toBeCloseTo((10936.55 + 314900 * 0.132) / 5, 1);
  });
  it('2 Mio. → 11,5% / 5 = 2,3%', () => {
    expect(dbgKapital(2000000, 'alleinstehend', r)).toBeCloseTo(46000, 2);
    expect(dbgKapital(2000000, 'verheiratet', r)).toBeCloseTo(46000, 2);
  });
});
