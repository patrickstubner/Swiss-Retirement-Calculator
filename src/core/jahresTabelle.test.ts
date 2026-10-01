import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { jahresCsv, jahresSpalten, sichtbareSpalten } from './jahresTabelle';
import { nominalErgebnis } from './nominal';
import { simuliere } from './simulation';
import type { Haushalt } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/** Erfundenes Paar: Jg. 1964 (Lohn 100'000, Rücktritt 64) und Jg. 1965, 700'000 Wertschriften */
function haushalt(): Haushalt {
  const h = standardHaushalt(regeln);
  const a = neuePerson(regeln, {
    name: 'Anna',
    geburtsjahr: 1964,
    lohn: 100_000,
    stoppAlter: 64,
    wertschriften: 700_000,
  });
  const b = neuePerson(regeln, { name: 'Beat', geburtsjahr: 1965, lohn: 0 });
  return {
    ...h,
    zivilstand: 'verheiratet',
    personen: [a, { ...b, erwerbsstatus: 'nichtErwerbstaetig' }],
    ausgaben: { ...h.ausgaben, lebenshaltung: 65_000 },
    annahmen: { ...h.annahmen, renditeNominal: 0.04, inflation: 0.015 },
    planungsalter: 92,
  };
}

describe('Jahrestabelle', () => {
  it('liefert Lebenshaltung und Vermögenserträge pro Jahr', () => {
    const e = simuliere(haushalt(), regeln, { start });
    const z = e.zeilen[1];
    if (!z) throw new Error('Zeile fehlt');
    expect(z.lebenshaltung).toBeCloseTo(65_000, 6);
    expect(z.ausgaben).toBeGreaterThanOrEqual(z.lebenshaltung);
    // Ertrag ≈ Anfangsbestand × reale Rendite (4 % − 0,5 % Kosten − 1,5 % Teuerung, Bargeld tiefer)
    expect(z.ertraege).toBeGreaterThan(0);
    expect(z.ertraege / z.ertragsBasis).toBeLessThan(0.025);
    expect(z.ertraege / z.ertragsBasis).toBeGreaterThan(0.005);
  });

  it('rechnet Erträge nominal als Wachstum inkl. Teuerung um', () => {
    const e = simuliere(haushalt(), regeln, { start });
    const n = nominalErgebnis(e);
    e.zeilen.forEach((z, i) => {
      const m = n.zeilen[i];
      if (!m) throw new Error('Zeile fehlt');
      expect(m.ertraege).toBeCloseTo((z.ertragsBasis + z.ertraege) * z.indexEnde - z.ertragsBasis * z.indexBeginn, 4);
      expect(m.lebenshaltung).toBeCloseTo(z.lebenshaltung * z.indexBeginn, 6);
      expect(m.ertraege).toBeGreaterThan(z.ertraege * z.indexBeginn - 1e-6);
    });
  });

  it('Spalten: Alter je Person, leere Spalten ausgeblendet, CSV mit allen Spalten', () => {
    const e = simuliere(haushalt(), regeln, { start });
    const alle = jahresSpalten(['Anna', 'Beat']);
    expect(alle.slice(0, 3).map((s) => s.label)).toEqual(['Jahr', 'Alter Anna', 'Alter Beat']);
    const sichtbar = sichtbareSpalten(alle, e);
    const ids = sichtbar.map((s) => s.id);
    expect(ids).toContain('vermoegen');
    expect(ids).toContain('lebenshaltung');
    expect(ids).toContain('lohn');
    expect(ids).not.toContain('miete');
    expect(ids).not.toContain('stGrundstueck');
    const csv = jahresCsv(alle, e, 'CHF heute');
    const zeilen = csv
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(zeilen).toHaveLength(e.zeilen.length + 1);
    expect(zeilen[0]?.split(';')).toHaveLength(alle.length);
    expect(zeilen[0]).toContain('Vermögen Ende Jahr (CHF heute)');
    const erste = zeilen[1]?.split(';') ?? [];
    expect(erste[0]).toBe(String(e.zeilen[0]?.jahr));
    expect(Number(erste[alle.findIndex((s) => s.id === 'vermoegen')])).toBe(Math.round(e.zeilen[0]?.vermoegen ?? 0));
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
});
