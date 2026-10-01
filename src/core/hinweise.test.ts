import { describe, expect, it } from 'vitest';
import { neuePerson, neuesWohneigentum, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { anlagekostenFehlen, eingabeHinweise, kantonFehltHinweis, nurEinePersonWegzug } from './hinweise';
import type { Haushalt } from './typen';

const regeln = ladeRegeln(2026);

function paar(): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    zivilstand: 'verheiratet',
    personen: [
      neuePerson(regeln, { name: 'Beispiel A', geburtsjahr: 1970 }),
      neuePerson(regeln, { name: 'Beispiel B', geburtsjahr: 1972, geschlecht: 'w' }),
    ],
  };
}

describe('Hinweise zu Eingaben', () => {
  it('nur eine Person zieht weg: Hinweis nennt die bleibende Person', () => {
    const h = paar();
    expect(nurEinePersonWegzug(h)).toBeNull();
    const a = h.personen[0];
    if (!a) throw new Error('Person fehlt');
    h.personen[0] = { ...a, wohnsitzAusland: { ...a.wohnsitzAusland, aktiv: true } };
    const t = nurEinePersonWegzug(h);
    expect(t).toContain('Beispiel B wohnt weiter in der Schweiz');
    expect(t).toContain('AHV-Regeln');
  });

  it('beide ziehen weg oder Einzelperson: kein Hinweis', () => {
    const h = paar();
    h.personen = h.personen.map((p) => ({ ...p, wohnsitzAusland: { ...p.wohnsitzAusland, aktiv: true } }));
    expect(nurEinePersonWegzug(h)).toBeNull();
    const e = standardHaushalt(regeln);
    expect(nurEinePersonWegzug(e)).toBeNull();
  });

  it('fehlender Kanton: nur mit Wegzug, Kapitalbezug oder Verkauf', () => {
    const h = paar();
    expect(kantonFehltHinweis(h)).toBeNull();
    const a = h.personen[0];
    if (!a) throw new Error('Person fehlt');
    h.personen[0] = { ...a, pk: { ...a.pk, guthaben: 100_000 } };
    expect(kantonFehltHinweis(h)).toContain('Kapitalbezug');
    expect(kantonFehltHinweis({ ...h, steuern: { ...h.steuern, kanton: 'ZH' } })).toBeNull();
    expect(kantonFehltHinweis({ ...h, steuern: { ...h.steuern, eigeneSaetze: true } })).toBeNull();
  });

  it('Hausverkauf ohne Anlagekosten', () => {
    const h = paar();
    const a = h.personen[0];
    if (!a) throw new Error('Person fehlt');
    const w = neuesWohneigentum(regeln, { vorhanden: true, verkehrswert: 800_000 });
    h.personen[0] = { ...a, wohneigentum: { ...w, verkauf: { ...w.verkauf, aktiv: true, anlagekosten: 0 } } };
    expect(anlagekostenFehlen(h)).toEqual(['Beispiel A']);
    expect(eingabeHinweise(h).some((t) => t.includes('Anlagekosten'))).toBe(true);
    h.personen[0] = { ...a, wohneigentum: { ...w, verkauf: { ...w.verkauf, aktiv: true, anlagekosten: 500_000 } } };
    expect(anlagekostenFehlen(h)).toEqual([]);
  });
});
