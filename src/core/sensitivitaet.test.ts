import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { effektiverHaushalt } from './schaetzwerte';
import { sensitivitaet } from './sensitivitaet';
import type { Haushalt } from './typen';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };

function haushalt(): Haushalt {
  const s = standardHaushalt(regeln);
  const p = neuePerson(regeln, { geburtsjahr: 1975, geburtsmonat: 4, lohn: 95000, wertschriften: 200000 });
  p.pk = { ...p.pk, guthaben: 300000 };
  p.manuell = { pkGuthaben: true };
  return { ...s, personen: [p], planungsalter: 95, ausgaben: { ...s.ausgaben, lebenshaltung: 65000 } };
}

describe('Sensitivität «Wo sich Genauigkeit lohnt»', () => {
  const eff = effektiverHaushalt(haushalt(), regeln, heute);
  const r = sensitivitaet(eff.haushalt, eff.schaetzungen, regeln, { start: heute, modus: 'gemeinsam', person: 0 });

  it('liefert alle Eingaben, nach Wirkung sortiert', () => {
    expect(r.vergleichsAlter).toBe(85);
    expect(r.zeilen.map((z) => z.id).sort()).toEqual(['ahv', 'ausgaben', 'pkGuthaben', 'rendite', 'umwandlungssatz']);
    const w = r.zeilen.map((z) => (z.deltaAlterMonate === null ? 1e6 : Math.abs(z.deltaAlterMonate)));
    for (let i = 1; i < w.length; i++) expect(w[i - 1] ?? 0).toBeGreaterThanOrEqual(w[i] ?? 0);
  });

  it('alle Varianten sind ungünstig: Alter steigt (oder bleibt), Vermögen sinkt', () => {
    for (const z of r.zeilen) {
      if (z.deltaAlterMonate !== null) expect(z.deltaAlterMonate).toBeGreaterThanOrEqual(0);
      expect(z.deltaVermoegen).toBeLessThanOrEqual(0);
    }
    expect(r.zeilen.find((z) => z.id === 'ausgaben')?.deltaVermoegen).toBeLessThan(0);
    expect(r.zeilen.find((z) => z.id === 'umwandlungssatz')?.deltaVermoegen).toBeLessThan(0);
  });

  it('Kennzeichnung geschätzt vs. eigene Eingabe', () => {
    const g = Object.fromEntries(r.zeilen.map((z) => [z.id, z.geschaetzt]));
    expect(g).toEqual({ ahv: true, pkGuthaben: false, umwandlungssatz: true, rendite: true, ausgaben: false });
  });
});
