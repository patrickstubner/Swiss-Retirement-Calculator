import { describe, expect, it } from 'vitest';
import {
  neueAusgaben,
  neueAusgabenPhase,
  neuePerson,
  neuesAusgabenEinzeljahr,
  standardHaushalt,
} from '../data/defaults';
import { ladeRegeln } from '../rules';
import { ausgabenSkaliert, lebenshaltungImJahr, nominalImJahr } from './ausgaben';
import { simuliere } from './simulation';
import type { Ausgaben, Haushalt } from './typen';

const regeln = ladeRegeln(2026);
const person = neuePerson(regeln, { name: 'Beispiel A', geburtsjahr: 1966, geburtsmonat: 1 });

function ausgaben(o: Partial<Ausgaben> = {}): Ausgaben {
  return {
    ...neueAusgaben(),
    lebenshaltung: 50_000,
    phasen: [neueAusgabenPhase(2027, 2031, 80_000), neueAusgabenPhase(2032, 2040, 5_000)],
    ...o,
  };
}

describe('Lebenshaltung pro Jahr: Phasen und Einzeljahre (heutige Franken)', () => {
  it('Phasenwechsel nach Kalenderjahr, Grundbetrag ausserhalb', () => {
    const a = ausgaben();
    a.phasen[1] = { ...(a.phasen[1] as (typeof a.phasen)[number]), einheit: 'monat' };
    expect(lebenshaltungImJahr(a, 2026, [person], 60)).toMatchObject({ betrag: 50_000, quelle: 'grund' });
    expect(lebenshaltungImJahr(a, 2027, [person], 61)).toMatchObject({ betrag: 80_000, quelle: 'phase', index: 0 });
    expect(lebenshaltungImJahr(a, 2031, [person], 65).betrag).toBe(80_000);
    // Betrag pro Monat × 12
    expect(lebenshaltungImJahr(a, 2032, [person], 66)).toMatchObject({ betrag: 60_000, index: 1 });
    expect(lebenshaltungImJahr(a, 2041, [person], 75).quelle).toBe('grund');
  });

  it('offenes Ende (bis = null) gilt bis zum Planungshorizont', () => {
    const a = ausgaben({ phasen: [neueAusgabenPhase(2030, null, 40_000)] });
    expect(lebenshaltungImJahr(a, 2090, [person], 124).betrag).toBe(40_000);
  });

  it('Bezug auf das Alter einer Person (im Jahr erreichtes Alter)', () => {
    const b = neuePerson(regeln, { name: 'Beispiel B', geburtsjahr: 1972 });
    const a = ausgaben({ phasenBezug: 'alter', phasenPerson: 1, phasen: [neueAusgabenPhase(60, 64, 90_000)] });
    expect(lebenshaltungImJahr(a, 2031, [person, b], 59).quelle).toBe('grund'); // B wird 59
    expect(lebenshaltungImJahr(a, 2032, [person, b], 60).betrag).toBe(90_000); // B wird 60
    expect(lebenshaltungImJahr(a, 2036, [person, b], 64).betrag).toBe(90_000);
    expect(lebenshaltungImJahr(a, 2037, [person, b], 65).quelle).toBe('grund');
  });

  it('Einzeljahr ersetzt Phase und Grundbetrag; erste passende Phase hat Vorrang', () => {
    const a = ausgaben({
      phasen: [neueAusgabenPhase(2027, 2031, 80_000), neueAusgabenPhase(2029, 2035, 30_000)],
      einzeljahre: [neuesAusgabenEinzeljahr(2029, 120_000)],
    });
    expect(lebenshaltungImJahr(a, 2029, [person], 63)).toMatchObject({ betrag: 120_000, quelle: 'einzeljahr' });
    expect(lebenshaltungImJahr(a, 2030, [person], 64).betrag).toBe(80_000);
    expect(lebenshaltungImJahr(a, 2033, [person], 67).betrag).toBe(30_000);
  });

  it('Faktoren ab 75/85 wirken nur auf den Grundbetrag', () => {
    const a = ausgaben({ faktorAb75: 0.8, phasen: [neueAusgabenPhase(2045, 2046, 70_000)] });
    expect(lebenshaltungImJahr(a, 2044, [person], 78).betrag).toBe(40_000);
    expect(lebenshaltungImJahr(a, 2045, [person], 79).betrag).toBe(70_000);
  });

  it('Hochrechnung mit der erwarteten Teuerung: 60 000 heute → 2035 bei 2 % ca. 71 706', () => {
    expect(nominalImJahr(60_000, 2035, 2026, 0.02)).toBeCloseTo(60_000 * 1.02 ** 9, 6);
    expect(Math.round(nominalImJahr(60_000, 2035, 2026, 0.02))).toBe(71_706);
    expect(nominalImJahr(60_000, 2026, 2026, 0.02)).toBe(60_000);
  });

  it('Sensitivität skaliert Grundbetrag, Phasen und Einzeljahre', () => {
    const a = ausgabenSkaliert(ausgaben({ einzeljahre: [neuesAusgabenEinzeljahr(2030, 10_000)] }), 1.1);
    expect(a.lebenshaltung).toBeCloseTo(55_000);
    expect(a.phasen[0]?.betrag).toBeCloseTo(88_000);
    expect(a.einzeljahre[0]?.betrag).toBeCloseTo(11_000);
  });
});

describe('Simulation mit Ausgabenphasen', () => {
  const h = (a: Ausgaben): Haushalt => ({
    ...standardHaushalt(regeln),
    personen: [{ ...person, wertschriften: 3_000_000, lohn: 0, stoppAlter: 0 }],
    planungsalter: 90,
    ausgaben: a,
  });

  it('Ausgaben pro Jahr folgen den Phasen (real = heutige Franken); erstes Jahr anteilig', () => {
    const e = simuliere(h(ausgaben({ einzeljahre: [neuesAusgabenEinzeljahr(2035, 100_000)] })), regeln, {
      start: { jahr: 2026, monat: 7 },
    });
    const z = (j: number) => e.zeilen.find((x) => x.jahr === j)?.ausgaben;
    expect(z(2026)).toBeCloseTo(50_000 * (6 / 12), 6);
    expect(z(2027)).toBeCloseTo(80_000, 6);
    expect(z(2031)).toBeCloseTo(80_000, 6);
    expect(z(2032)).toBeCloseTo(5_000, 6);
    expect(z(2035)).toBeCloseTo(100_000, 6);
    expect(z(2041)).toBeCloseTo(50_000, 6);
  });

  it('ohne Phasen gilt weiterhin der Einzelbetrag', () => {
    const e = simuliere(h({ ...neueAusgaben(), lebenshaltung: 45_000 }), regeln, { start: { jahr: 2026, monat: 1 } });
    expect(e.zeilen.slice(0, 10).every((z) => Math.abs(z.ausgaben - 45_000) < 1e-6)).toBe(true);
  });
});
