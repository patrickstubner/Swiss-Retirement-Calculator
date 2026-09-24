/**
 * Referenzwerte: MB 3.04 (Referenzalter, Kürzungs-/Zuschlagstabellen), Rententabellen 2025
 * (gültig 2026, Skala 44), BSV «Beträge gültig ab 1.1.2026», KS-R AHV 21.
 */
import { describe, expect, it } from 'vitest';
import { ladeRegeln } from '../rules';
import {
  ahv13,
  ahvAufschubZuschlag,
  ahvBezugFaktor,
  ahvMaxVorbezugMonate,
  ahvMdjeAusRente,
  ahvPlafonierung,
  ahvReferenzalter,
  ahvRentenbeginn,
  ahvRentenzuschlag,
  ahvRenteSkala44,
  ahvTeilrente,
  ahvVorbezugKuerzung,
  pruefeAhvVerschiebung,
} from './ahv';

const r = ladeRegeln(2026).ahv;

describe('ahvReferenzalter (MB 3.04, AHV 21)', () => {
  it.each([
    [1955, 'm', 65, 0],
    [1970, 'm', 65, 0],
    [1960, 'w', 64, 0],
    [1961, 'w', 64, 3],
    [1962, 'w', 64, 6],
    [1963, 'w', 64, 9],
    [1964, 'w', 65, 0],
    [1990, 'w', 65, 0],
  ] as const)('Jg. %i %s → %i J. %i Mt.', (jg, g, j, m) => {
    expect(ahvReferenzalter(jg, g, r)).toEqual({ jahre: j, monate: m });
  });
});

describe('ahvRentenbeginn', () => {
  it('Mann geb. März 1961: RA im März 2026 → Rente ab April 2026', () => {
    expect(ahvRentenbeginn(1961, 3, 65 * 12)).toEqual({ jahr: 2026, monat: 4 });
  });
  it('Frau geb. Dezember 1962 (RA 64/6): RA im Juni 2027 → Rente ab Juli 2027', () => {
    expect(ahvRentenbeginn(1962, 12, 64 * 12 + 6)).toEqual({ jahr: 2027, monat: 7 });
  });
  it('Vorbezug 24 Monate verschiebt den Beginn um 2 Jahre nach vorne', () => {
    expect(ahvRentenbeginn(1961, 3, 65 * 12, -24)).toEqual({ jahr: 2024, monat: 4 });
  });
});

describe('ahvRenteSkala44 (Rententabellen, Skala 44)', () => {
  it.each(r.rententabelleReferenz.map(([m, rente]) => [m, rente] as const))('mdJE %i → %i CHF/Mt', (mdje, rente) => {
    expect(ahvRenteSkala44(mdje ?? 0, r)).toBe(rente);
  });
  it('unter Minimum → Minimalrente, über Maximum → Maximalrente', () => {
    expect(ahvRenteSkala44(0, r)).toBe(1260);
    expect(ahvRenteSkala44(200000, r)).toBe(2520);
  });
  it('mdJE zwischen Stufen wird auf die nächsthöhere Stufe gerundet', () => {
    expect(ahvRenteSkala44(45000, r)).toBe(1915);
  });
  it('monoton steigend', () => {
    let vorher = 0;
    for (let m = 0; m <= 100000; m += 500) {
      const x = ahvRenteSkala44(m, r);
      expect(x).toBeGreaterThanOrEqual(vorher);
      vorher = x;
    }
  });
  it('Umkehrfunktion mdJE aus Rente', () => {
    expect(ahvMdjeAusRente(1915.2, r)).toBeCloseTo(45360, 0);
    expect(ahvMdjeAusRente(2318.4, r)).toBeCloseTo(75600, 0);
    expect(ahvMdjeAusRente(3000, r)).toBe(90720);
  });
});

describe('ahvTeilrente', () => {
  it('40 von 44 Beitragsjahren', () => {
    expect(ahvTeilrente(2520, 40, r)).toBeCloseTo((2520 * 40) / 44, 6);
  });
  it('mehr als 44 Jahre wird auf 44 begrenzt', () => {
    expect(ahvTeilrente(2520, 50, r)).toBe(2520);
  });
});

describe('Vorbezug (MB 3.04, ordentliche Kürzung)', () => {
  it.each([
    [1, 0.006],
    [6, 0.034],
    [11, 0.062],
    [12, 0.068],
    [13, 0.074],
    [18, 0.102],
    [23, 0.13],
    [24, 0.136],
  ])('%i Monate → %f', (m, satz) => {
    expect(ahvVorbezugKuerzung(m, 1970, 'm', 80000, r)).toBeCloseTo(satz, 10);
  });
  it('mehr als 24 Monate ist für Männer nicht zulässig', () => {
    expect(() => ahvVorbezugKuerzung(25, 1970, 'm', 80000, r)).toThrow(RangeError);
    expect(ahvMaxVorbezugMonate(1970, 'm', r)).toBe(24);
  });
  it('Übergangsfrauen: Vorbezug ab 62', () => {
    expect(ahvMaxVorbezugMonate(1961, 'w', r)).toBe(27);
    expect(ahvMaxVorbezugMonate(1964, 'w', r)).toBe(36);
    expect(ahvMaxVorbezugMonate(1970, 'w', r)).toBe(24);
    expect(ahvMaxVorbezugMonate(1960, 'w', r)).toBe(12);
  });
});

describe('Vorbezug Übergangsgeneration (KS-R AHV 21, reduzierte Sätze)', () => {
  it.each([
    [50000, 12, 0],
    [50000, 24, 0.02],
    [50000, 36, 0.03],
    [60480, 36, 0.03],
    [70000, 12, 0.025],
    [70000, 24, 0.045],
    [70000, 36, 0.065],
    [90000, 12, 0.035],
    [90000, 24, 0.065],
    [90000, 36, 0.105],
  ])('mdJE %i, %i Monate → %f', (mdje, m, satz) => {
    expect(ahvVorbezugKuerzung(m, 1965, 'w', mdje, r)).toBeCloseTo(satz, 10);
  });
  it('Monatswerte linear interpoliert (Näherung)', () => {
    expect(ahvVorbezugKuerzung(18, 1965, 'w', 70000, r)).toBeCloseTo(0.035, 10);
  });
});

describe('Aufschub (MB 3.04)', () => {
  it.each([
    [12, 0.052],
    [14, 0.052],
    [15, 0.066],
    [18, 0.08],
    [23, 0.094],
    [24, 0.108],
    [36, 0.171],
    [47, 0.222],
    [48, 0.24],
    [59, 0.296],
    [60, 0.315],
  ])('%i Monate → %f', (m, satz) => {
    expect(ahvAufschubZuschlag(m, r)).toBeCloseTo(satz, 10);
  });
  it('unter 12 oder über 60 Monate ungültig', () => {
    expect(() => ahvAufschubZuschlag(11, r)).toThrow(RangeError);
    expect(() => ahvAufschubZuschlag(61, r)).toThrow(RangeError);
    expect(pruefeAhvVerschiebung(6, 1970, 'm', r)).not.toBeNull();
    expect(pruefeAhvVerschiebung(-24, 1970, 'm', r)).toBeNull();
  });
  it('Bezugsfaktor', () => {
    expect(ahvBezugFaktor(-12, 1970, 'm', 80000, r)).toBeCloseTo(0.932, 10);
    expect(ahvBezugFaktor(60, 1970, 'm', 80000, r)).toBeCloseTo(1.315, 10);
    expect(ahvBezugFaktor(0, 1970, 'm', 80000, r)).toBe(1);
  });
});

describe('Rentenzuschlag Übergangsgeneration', () => {
  it('Jg. 1962, mdJE ≤ 60 480 → 160 × 50% = 80', () => {
    expect(ahvRentenzuschlag(1962, 'w', 50000, 0, 44, r)).toBe(80);
  });
  it('Jg. 1965, mdJE > 75 600 → 50', () => {
    expect(ahvRentenzuschlag(1965, 'w', 90000, 0, 44, r)).toBe(50);
  });
  it('Jg. 1966, mdJE 70 000 → 100 × 81%', () => {
    expect(ahvRentenzuschlag(1966, 'w', 70000, 0, 44, r)).toBeCloseTo(81, 10);
  });
  it('kein Zuschlag bei Vorbezug, bei Männern oder ausserhalb der Jahrgänge', () => {
    expect(ahvRentenzuschlag(1962, 'w', 50000, -12, 44, r)).toBe(0);
    expect(ahvRentenzuschlag(1962, 'm', 50000, 0, 44, r)).toBe(0);
    expect(ahvRentenzuschlag(1970, 'w', 50000, 0, 44, r)).toBe(0);
  });
  it('bei Teilrente anteilig', () => {
    expect(ahvRentenzuschlag(1964, 'w', 50000, 0, 22, r)).toBe(80);
  });
});

describe('Plafonierung Ehepaar (150% = 3 780)', () => {
  it('zwei Maximalrenten → je 1 890', () => {
    expect(ahvPlafonierung(2520, 2520, r)).toEqual([1890, 1890]);
  });
  it('unter dem Plafond keine Kürzung', () => {
    expect(ahvPlafonierung(2000, 1000, r)).toEqual([2000, 1000]);
  });
  it('proportionale Kürzung', () => {
    const [a, b] = ahvPlafonierung(2520, 2000, r);
    expect(a + b).toBeCloseTo(3780, 8);
    expect(a / b).toBeCloseTo(2520 / 2000, 8);
  });
});

describe('13. AHV-Rente', () => {
  it('1/12 der Jahresrente ab 2026', () => {
    expect(ahv13(30240, 2026, r)).toBe(2520);
    expect(ahv13(30240, 2025, r)).toBe(0);
  });
});
