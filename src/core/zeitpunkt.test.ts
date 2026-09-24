import { describe, expect, it } from 'vitest';
import { neuePerson } from '../data/defaults';
import { ladeRegeln } from '../rules';
import type { Person } from './typen';
import { alterImMonat, letzterArbeitsmonat, monatBeiAlterMonate, stoppAlterMonate, wegzugIndex } from './zeitpunkt';

const regeln = ladeRegeln(2026);
const person = (o: Partial<Person> = {}): Person => neuePerson(regeln, { geburtsjahr: 1969, geburtsmonat: 1, ...o });

describe('Rücktritt per Alter oder Datum', () => {
  it('Modus Alter: Jahre + Monate', () => {
    expect(stoppAlterMonate(person({ stoppModus: 'alter', stoppAlter: 60 + 3 / 12 }))).toBe(723);
  });

  it('Modus Datum: «per Ende Dezember 2026» bei Geburt Januar 1969 → 58 Jahre', () => {
    const p = person({ stoppModus: 'datum', stoppDatum: { jahr: 2026, monat: 12 } });
    expect(stoppAlterMonate(p)).toBe(58 * 12);
  });

  it('Modus Datum: «per Ende November 2027» → Alter in Jahren und Monaten', () => {
    // Geburt Januar 1969 → erster Monat ohne Lohn Dezember 2027 = 58 J. 11 Mt.
    const p = person({ stoppModus: 'datum', stoppDatum: { jahr: 2027, monat: 11 } });
    expect(stoppAlterMonate(p)).toBe(58 * 12 + 11);
    const q = person({
      geburtsjahr: 1966,
      geburtsmonat: 6,
      stoppModus: 'datum',
      stoppDatum: { jahr: 2027, monat: 11 },
    });
    expect(stoppAlterMonate(q)).toBe(61 * 12 + 6);
  });

  it('Datum ↔ Alter sind zueinander konsistent (Umschalten verliert nichts)', () => {
    const p = person({ geburtsjahr: 1972, geburtsmonat: 9, stoppModus: 'alter', stoppAlter: 62 + 5 / 12 });
    const m = stoppAlterMonate(p);
    const letzter = letzterArbeitsmonat(p, m);
    expect(letzter).toEqual({ jahr: 2035, monat: 1 });
    expect(stoppAlterMonate({ ...p, stoppModus: 'datum', stoppDatum: letzter })).toBe(m);
  });

  it('der Modus wird im Zustand gespeichert: stoppAlter wird im Datum-Modus ignoriert', () => {
    const p = person({ stoppModus: 'datum', stoppAlter: 70, stoppDatum: { jahr: 2029, monat: 12 } });
    expect(stoppAlterMonate(p)).toBe(61 * 12);
  });

  it('Datum vor der Geburt ergibt nie ein negatives Alter', () => {
    expect(stoppAlterMonate(person({ stoppModus: 'datum', stoppDatum: { jahr: 1960, monat: 1 } }))).toBe(0);
  });

  it('Hilfsfunktionen Alter ↔ Monat', () => {
    const p = person({ geburtsjahr: 1970, geburtsmonat: 6 });
    expect(alterImMonat(p, { jahr: 2035, monat: 6 })).toBe(65 * 12);
    expect(monatBeiAlterMonate(p, 65 * 12 + 1)).toEqual({ jahr: 2035, monat: 7 });
  });

  it('Wegzug per Alter oder Datum', () => {
    const p = person({ geburtsjahr: 1970, geburtsmonat: 6 });
    expect(wegzugIndex(p)).toBeNull();
    const a = { ...p, wohnsitzAusland: { ...p.wohnsitzAusland, aktiv: true, modus: 'alter' as const, alter: 60 } };
    expect(wegzugIndex(a)).toBe(2030 * 12 + 5);
    const d = {
      ...a,
      wohnsitzAusland: { ...a.wohnsitzAusland, modus: 'datum' as const, datum: { jahr: 2028, monat: 3 } },
    };
    expect(wegzugIndex(d)).toBe(2028 * 12 + 2);
  });
});
