import { describe, expect, it } from 'vitest';
import type { MonteCarloErgebnis } from '../core/montecarlo';
import { simuliere } from '../core/simulation';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { faecherSerien, reichtSatz } from './components/Faecher';
import { chfKurz, darstellungVon, endBetrag, inFranken, mcBaender, vermoegenReihe } from './darstellung';

const regeln = ladeRegeln(2026);

function ergebnis() {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, { name: 'Muster', geburtsjahr: 1960, lohn: 0, wertschriften: 600_000 });
  return simuliere(
    { ...h, personen: [p], ausgaben: { ...h.ausgaben, lebenshaltung: 30_000 }, planungsalter: 90 },
    regeln,
    { start: { jahr: 2026, monat: 1 } },
  );
}

const mc = (reichtAb: number[]): MonteCarloErgebnis => ({
  laeufe: reichtAb.length,
  erfolgsquote: 0.5,
  reichtQuote: 0.5,
  jahre: [2026, 2027],
  p10: [1, 2],
  p25: [2, 3],
  p50: [3, 4],
  p75: [4, 5],
  p90: [5, 6],
  nominal: { p10: [10, 20], p25: [20, 30], p50: [30, 40], p75: [40, 50], p90: [50, 60] },
  ruinAlterSortiert: [...reichtAb].sort((a, b) => a - b),
  reichtBisAlterP10: null,
  reichtBisAlterP50: null,
  krisenMittel: 0,
});

describe('Darstellung real/nominal (Anzeige)', () => {
  it('Texte und Standard', () => {
    expect(darstellungVon({})).toBe('real');
    expect(darstellungVon({ darstellung: 'nominal' })).toBe('nominal');
    expect(inFranken('real')).toBe('in heutigen Franken');
    expect(inFranken('nominal')).toBe('in Franken des jeweiligen Jahres');
    expect(chfKurz('real')).toBe('heutige CHF');
  });

  it('rechnet Endvermögen und Reihe mit dem Index des Pfads um', () => {
    const e = ergebnis();
    expect(endBetrag(e, 'real')).toBe(e.endVermoegen);
    expect(endBetrag(e, 'nominal')).toBeCloseTo(e.endVermoegen * (e.zeilen.at(-1)?.indexEnde ?? 0), 6);
    const r = vermoegenReihe(e, 'nominal');
    e.zeilen.forEach((z, i) => {
      expect(r[i]).toBeCloseTo(z.vermoegen * z.indexEnde, 6);
    });
  });

  it('Fächer: zwei Bänder, nominale Perzentile bei «nominal»', () => {
    const m = mc([80, 85, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]);
    expect(mcBaender(m, 'nominal').p50).toEqual([30, 40]);
    const { serien, baender } = faecherSerien(m, 'real');
    expect(serien.map((s) => s.werte[0])).toEqual([5, 4, 3, 2, 1]);
    expect(baender).toHaveLength(2);
    expect(reichtSatz(m, 0.5, 100)).toContain('bis zum Planungsalter 100');
    expect(reichtSatz(m, 0.9, 100)).toContain('mindestens bis Alter 80');
  });
});
