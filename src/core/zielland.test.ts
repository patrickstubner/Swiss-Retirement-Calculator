/** Steuern im Wohnsitzstaat nach dem Wegzug (core/zielland.ts). Fantasiezahlen. */
import { describe, expect, it } from 'vitest';
import { wegzugsLand } from '../data/laender';
import { stufenSteuer } from './quellensteuer';
import { type ZiellandEinkommen, ziellandSteuer } from './zielland';

const leer: ZiellandEinkommen = {
  ahv: 0,
  pkRente: 0,
  auslandRenten: 0,
  lohn: 0,
  uebrige: 0,
  kapitalertrag: 0,
  vermoegen: 0,
  personen: 1,
};
const modell = (code: string) => {
  const m = wegzugsLand(code)?.steuern;
  if (!m) throw new Error(`kein Modell für ${code}`);
  return m;
};
const std = { gemeinsam: false, option: '', eigenerSatz: null };

describe('Steuermodelle der Zielländer', () => {
  it('alle zehn Zielländer und Liechtenstein haben ein Modell mit Quellen', () => {
    for (const c of ['PA', 'PY', 'PH', 'TH', 'AE', 'CY', 'MT', 'PT', 'ES', 'IT', 'LI']) {
      const m = modell(c);
      expect(m.quellen.length).toBeGreaterThan(0);
      expect(m.hinweise.length).toBeGreaterThan(0);
    }
    expect(wegzugsLand('BR')?.steuern).toBeUndefined();
  });

  it('keine Steuer (VAE) bzw. territorial (Panama, Paraguay, Philippinen)', () => {
    const e = { ...leer, ahv: 30_000, pkRente: 20_000, kapitalertrag: 10_000, vermoegen: 800_000 };
    for (const c of ['AE', 'PA', 'PY', 'PH']) expect(ziellandSteuer(modell(c), e, std).total).toBe(0);
  });

  it('Italien: 5 % auf AHV und PK-Rente, 26 % auf Kapitalerträge, IVAFE 0,2 %', () => {
    const s = ziellandSteuer(
      modell('IT'),
      { ...leer, ahv: 30_000, pkRente: 20_000, kapitalertrag: 10_000, vermoegen: 500_000 },
      std,
    );
    expect(s.einkommen).toBeCloseTo(2500, 6);
    expect(s.kapitalertrag).toBeCloseTo(2600, 6);
    expect(s.vermoegen).toBeCloseTo(1000, 6);
  });

  it('Italien Regime 7 %: alle ausländischen Einkünfte 7 %, keine IVAFE', () => {
    const s = ziellandSteuer(
      modell('IT'),
      { ...leer, ahv: 30_000, pkRente: 20_000, auslandRenten: 10_000, kapitalertrag: 10_000, vermoegen: 500_000 },
      { ...std, option: 'it7' },
    );
    expect(s.total).toBeCloseTo(0.07 * 70_000, 6);
    expect(s.vermoegen).toBe(0);
  });

  it('Portugal: IRS-Tarif 2026 nach Abzug von 8,54 × IAS; Azoren −30 %; Kapitalerträge 28 %', () => {
    const m = modell('PT');
    const k = m.kursProChf ?? 1;
    const rente = 40_000; // CHF
    const basisEur = rente * k - 4587.09;
    const erwartet = stufenSteuer(basisEur, (m.tarif ?? []) as [number | null, number][]) / k;
    const s = ziellandSteuer(m, { ...leer, ahv: 25_000, pkRente: 15_000, kapitalertrag: 5000 }, std);
    expect(s.einkommen).toBeCloseTo(erwartet, 6);
    expect(s.kapitalertrag).toBeCloseTo(1400, 6);
    const az = ziellandSteuer(m, { ...leer, ahv: 25_000, pkRente: 15_000 }, { ...std, option: 'azoren' });
    expect(az.einkommen).toBeCloseTo(erwartet * 0.7, 6);
  });

  it('Zypern: jeweils die günstigere Variante (5 % über 5 000 EUR oder ordentlicher Tarif)', () => {
    const m = modell('CY');
    const k = m.kursProChf ?? 1;
    // tiefe Rente: ordentlicher Tarif (0 % bis 22 000 EUR) ist günstiger
    expect(ziellandSteuer(m, { ...leer, ahv: 18_000 }, std).total).toBe(0);
    // hohe Rente: 5 % über 5 000 EUR
    const hoch = ziellandSteuer(m, { ...leer, ahv: 30_000, pkRente: 50_000 }, std);
    expect(hoch.einkommen).toBeCloseTo(((80_000 * k - 5000) * 0.05) / k, 6);
  });

  it('Spanien: Staatstarif × 2 abzüglich Steuer auf dem persönlichen Minimum; Spartarif', () => {
    const m = modell('ES');
    const k = m.kursProChf ?? 1;
    const t = (m.tarif ?? []) as [number | null, number][];
    const erwartet = ((stufenSteuer(30_000 * k, t) - stufenSteuer(6700, t)) * 2) / k;
    const s = ziellandSteuer(m, { ...leer, pkRente: 30_000, kapitalertrag: 10_000 }, std);
    expect(s.einkommen).toBeCloseTo(erwartet, 6);
    const ertragEur = 10_000 * k;
    expect(s.kapitalertrag).toBeCloseTo((6000 * 0.19 + (ertragEur - 6000) * 0.21) / k, 6);
  });

  it('Liechtenstein: Tarif Art. 19 SteG × 2,5 mit Sollertrag 4 % des Vermögens; Ehepaare gemeinsam', () => {
    const m = modell('LI');
    const t = (m.tarif ?? []) as [number | null, number][];
    // Kontrolle der Grenzsätze gegen die Formel 0,03 · x − 581 (Stufe 21 141–42 280)
    expect(stufenSteuer(30_000, t)).toBeCloseTo(0.03 * 30_000 - 581, 0);
    const s = ziellandSteuer(m, { ...leer, ahv: 30_000, vermoegen: 250_000, kapitalertrag: 8000 }, std);
    expect(s.einkommen).toBeCloseTo(stufenSteuer(40_000, t) * 2.5, 6);
    expect(s.kapitalertrag).toBe(0);
    const tv = (m.tarifVerheiratet ?? []) as [number | null, number][];
    const paar = ziellandSteuer(m, { ...leer, ahv: 60_000, personen: 2 }, { ...std, gemeinsam: true });
    expect(paar.einkommen).toBeCloseTo(stufenSteuer(60_000, tv) * 2.5, 6);
  });

  it('Thailand: Rentenabzug 50 % (max. 100 000 THB) und persönlicher Abzug 60 000 THB', () => {
    const m = modell('TH');
    const k = m.kursProChf ?? 1;
    const r = 30_000 * k;
    const basis = r - Math.min(r * 0.5, 100_000) - 60_000;
    const erwartet = stufenSteuer(basis, (m.tarif ?? []) as [number | null, number][]) / k;
    expect(ziellandSteuer(m, { ...leer, ahv: 30_000 }, std).total).toBeCloseTo(erwartet, 6);
  });

  it('eigener effektiver Satz ersetzt das Modell (auch ohne Modell)', () => {
    const e = { ...leer, ahv: 30_000, pkRente: 10_000, kapitalertrag: 10_000, vermoegen: 1_000_000 };
    const s = ziellandSteuer(modell('PT'), e, { ...std, eigenerSatz: 0.1 });
    expect(s.total).toBeCloseTo(5000, 6);
    expect(s.eigenerSatz).toBe(true);
    expect(ziellandSteuer(undefined, e, { ...std, eigenerSatz: 0.2 }).total).toBeCloseTo(10_000, 6);
    expect(ziellandSteuer(undefined, e, std).total).toBe(0);
  });
});
