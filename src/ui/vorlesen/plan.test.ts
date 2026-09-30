import { describe, expect, it } from 'vitest';
import { ersterIndexAb, MAX_SAETZE, planeSaetze } from './plan';

describe('Plan der Sätze', () => {
  it('Blöcke → Sätze mit Bereich im Blocktext und Sprechtext', () => {
    const p = planeSaetze(['Die AHV zahlt 3.5%. Zweiter.', '', 'CHF 800 im Jahr 1969.']);
    expect(p.map((s) => s.sprech)).toEqual([
      'Die A H V zahlt 3,5 Prozent.',
      'Zweiter.',
      '800 Franken im Jahr neunzehnhundertneunundsechzig.',
    ]);
    expect(p.map((s) => s.block)).toEqual([0, 0, 2]);
    expect(p[0]?.anzeige).toBe('Die AHV zahlt 3.5%.');
    expect(p[1]?.von).toBe(20);
  });

  it('Sätze ohne Buchstaben und Ziffern werden übersprungen', () => {
    expect(planeSaetze(['...', '—', '  ', '»«']).length).toBe(0);
  });

  it('begrenzt die Anzahl (Schutz)', () => {
    const p = planeSaetze(['Satz eins. '.repeat(MAX_SAETZE + 500)]);
    expect(p.length).toBe(MAX_SAETZE);
  });

  it('ersterIndexAb: erster Satz ab einem Block', () => {
    const saetze = planeSaetze(['A eins. A zwei.', 'B eins.', 'C eins.']);
    const bloecke = [
      { segmente: [{ knoten: 'k0' }] },
      { segmente: [{ knoten: 'k1' }] },
      { segmente: [{ knoten: 'k2' }] },
    ];
    const ab = (rang: number) => (k: unknown) => Number(String(k).slice(1)) >= rang;
    expect(ersterIndexAb(saetze, bloecke, ab(0))).toBe(0);
    expect(ersterIndexAb(saetze, bloecke, ab(1))).toBe(2);
    expect(ersterIndexAb(saetze, bloecke, ab(2))).toBe(3);
    expect(ersterIndexAb(saetze, bloecke, () => false)).toBe(0);
    expect(ersterIndexAb([], [], () => true)).toBe(0);
  });
});
