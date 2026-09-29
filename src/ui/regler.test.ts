import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { gemeinsamerBereich, planungsBereich, ruecktrittBereich, verschoben } from './regler';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 1 };

/** Erfundene Personen */
const person = (geburtsjahr: number, stoppAlter: number) =>
  neuePerson(regeln, { name: 'Test', geburtsjahr, geburtsmonat: 1, stoppAlter });

describe('Regler Rücktrittsalter', () => {
  it('Mitte = Eingabe, ±10 Jahre in Monaten', () => {
    const b = ruecktrittBereich(person(1980, 60), heute, regeln);
    expect(b).toEqual({ mitte: 720, min: 600, max: 840, grenzeUnten: null, grenzeOben: null });
  });

  it('Mitte bei Eingabe mit Monaten (Datum/Alter nicht ganzzahlig)', () => {
    const b = ruecktrittBereich(person(1980, 58.25), heute, regeln);
    expect(b?.mitte).toBe(699);
    expect(b?.min).toBe(579);
    expect(b?.max).toBe(819);
  });

  it('oben begrenzt auf 70 (Aufschub AHV/PK), unten auf heute', () => {
    // Jg. 1966, heute 60 J., Eingabe 65: unten 60 (heute), oben 70
    const b = ruecktrittBereich(person(1966, 65), heute, regeln);
    expect(b).toEqual({ mitte: 780, min: 720, max: 840, grenzeUnten: 'heute', grenzeOben: 'hoechstalter' });
  });

  it('bereits im Ruhestand: kein Regler', () => {
    expect(ruecktrittBereich(person(1955, 64), heute, regeln)).toBeNull();
  });

  it('gemeinsamer Regler bei unterschiedlichem Alter: Bereich = Vereinigung, Grenzen pro Person', () => {
    // A: Jg. 1966, Eingabe 65 → −60 … +60 Monate (heute 60, höchstens 70)
    // B: Jg. 1975, Eingabe 60 → −108 … +120 Monate (heute 51)
    const a = ruecktrittBereich(person(1966, 65), heute, regeln);
    const b = ruecktrittBereich(person(1975, 60), heute, regeln);
    if (!a || !b) throw new Error('Bereich fehlt');
    const g = gemeinsamerBereich([a, b]);
    // grösser als der Bereich jeder einzelnen Person: −108 … +120
    expect(g).toEqual({ mitte: 0, min: -108, max: 120, grenzeUnten: 'heute', grenzeOben: null });
    // gleich viele Jahre verschieben, A stösst bei +8 Jahren an 70
    expect(verschoben(a, 96)).toEqual({ alter: 840, begrenzt: true });
    expect(verschoben(b, 96)).toEqual({ alter: 816, begrenzt: false });
    expect(verschoben(a, -24)).toEqual({ alter: 756, begrenzt: false });
    expect(verschoben(b, -24)).toEqual({ alter: 696, begrenzt: false });
  });

  it('gemeinsamer Regler: beide nahe 70 → Bereich oben begrenzt', () => {
    const a = ruecktrittBereich(person(1962, 67), heute, regeln);
    const b = ruecktrittBereich(person(1963, 66), heute, regeln);
    if (!a || !b) throw new Error('Bereich fehlt');
    const g = gemeinsamerBereich([a, b]);
    expect(g?.max).toBe(48);
    expect(g?.grenzeOben).toBe('hoechstalter');
    expect(g?.min).toBe(-36);
    expect(g?.grenzeUnten).toBe('heute');
  });
});

describe('Regler Planungsalter', () => {
  it('Mitte = Eingabe, ±20 Jahre', () => {
    const h = { ...standardHaushalt(regeln), personen: [person(1980, 60)], planungsalter: 95 };
    expect(planungsBereich(h, heute)).toEqual({ mitte: 95, min: 75, max: 115, grenzeUnten: null, grenzeOben: null });
  });

  it('unten begrenzt auf heutiges Alter + 1 der jüngsten Person', () => {
    const h = { ...standardHaushalt(regeln), personen: [person(1950, 60), person(1955, 60)], planungsalter: 85 };
    // jüngste Person heute 71 → mindestens 72
    expect(planungsBereich(h, heute)).toMatchObject({ min: 72, max: 105, grenzeUnten: 'heutigesAlter' });
  });
});
