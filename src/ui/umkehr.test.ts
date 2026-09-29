import { describe, expect, it } from 'vitest';
import { AUSGABENKURVE } from '../data/ausgabenkurve';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { phasenZumUebernehmen, UMKEHR_MC_LAEUFE, umkehrMethode } from './components/Umkehr';

const regeln = ladeRegeln(2026);
const h = () => {
  const x = standardHaushalt(regeln);
  return { ...x, personen: [neuePerson(regeln, { name: 'Muster', geburtsjahr: 1962, lohn: 90_000 })] };
};

describe('Umkehrrechnung (Oberfläche)', () => {
  it('wählt die Methode: ohne Krise, automatisch, individuell (leere Liste → Finanzkrise), Monte Carlo', () => {
    expect(umkehrMethode(h(), 'keine', 0.9, 2026)).toEqual({ art: 'deterministisch', krisen: undefined });
    const auto = umkehrMethode(h(), 'automatisch', 0.9, 2026);
    expect(auto.art === 'deterministisch' && auto.krisen !== undefined).toBe(true);
    const ind = umkehrMethode(h(), 'individuell', 0.9, 2026);
    expect(ind.art === 'deterministisch' && ind.krisen !== undefined).toBe(true);
    const mc = umkehrMethode(h(), 'montecarlo', 0.85, 2026);
    expect(mc.art).toBe('montecarlo');
    if (mc.art === 'montecarlo') {
      expect(mc.quote).toBe(0.85);
      expect(mc.einstellung.laeufe).toBeLessThanOrEqual(UMKEHR_MC_LAEUFE);
    }
  });

  it('übernimmt Phasen mit neuen, eindeutigen Ids', () => {
    const ph = phasenZumUebernehmen(h(), 70_000, { variante: 'kurve', kurve: AUSGABENKURVE, pflege: true }, 2026);
    expect(new Set(ph.map((p) => p.id)).size).toBe(ph.length);
    expect(ph.some((p) => p.betrag === 70_000)).toBe(true);
  });
});
