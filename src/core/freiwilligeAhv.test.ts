import { describe, expect, it } from 'vitest';
import { neuePerson } from '../data/defaults';
import { WEGZUGS_LAENDER } from '../data/laender';
import { ladeRegeln } from '../rules';
import { ahvFruehestesBezugsalter } from './ahv';
import {
  fwBefreitDurchEhegatte,
  fwBeitragErwerbstaetig,
  fwBeitragNichterwerbstaetig,
  fwBeitragTabelle,
  fwBemessung,
  pruefeFreiwilligeAhv,
} from './freiwilligeAhv';
import type { Person, WohnsitzAusland } from './typen';

const regeln = ladeRegeln(2026);
const fw = regeln.beitraege.freiwilligeAhv;

function wegzieher(w: Partial<WohnsitzAusland> = {}, o: Partial<Person> = {}): Person {
  const p = neuePerson(regeln, { geburtsjahr: 1970, geburtsmonat: 6, ...o });
  return {
    ...p,
    wohnsitzAusland: {
      ...p.wohnsitzAusland,
      aktiv: true,
      modus: 'alter',
      alter: 58,
      land: 'TH',
      nationalitaet: 'CH',
      vorherVersichert5Jahre: true,
      freiwilligeAhv: true,
      ...w,
    },
  };
}

describe('Freiwillige AHV/IV – Beiträge (Art. 13b VFV, Stand 1.1.2025, Beträge 2026)', () => {
  it('Beitragstabelle Nichterwerbstätige: Minimum, Stufen, Maximum', () => {
    expect(fwBeitragTabelle(0, fw)).toBe(1010);
    expect(fwBeitragTabelle(599_999, fw)).toBe(1010);
    expect(fwBeitragTabelle(600_000, fw)).toBe(1111);
    expect(fwBeitragTabelle(649_999, fw)).toBe(1111);
    expect(fwBeitragTabelle(650_000, fw)).toBe(1212);
    expect(fwBeitragTabelle(1_750_000, fw)).toBe(3434);
    expect(fwBeitragTabelle(1_800_000, fw)).toBeCloseTo(3585.5, 6);
    expect(fwBeitragTabelle(8_950_000, fw)).toBe(25250);
    expect(fwBeitragTabelle(50_000_000, fw)).toBe(25250);
  });

  it('inkl. 5% Verwaltungskosten: Minimum 1060.50, Maximum 26512.50', () => {
    expect(fwBeitragNichterwerbstaetig(0, 0, false, fw)).toBeCloseTo(1060.5, 6);
    expect(fwBeitragNichterwerbstaetig(20_000_000, 0, false, fw)).toBeCloseTo(26512.5, 6);
  });

  it('Bemessung: Vermögen + 20 × Renteneinkommen, Verheiratete je die Hälfte', () => {
    expect(fwBemessung(400_000, 30_000, false, fw)).toBe(1_000_000);
    expect(fwBemessung(400_000, 30_000, true, fw)).toBe(500_000);
    expect(fwBeitragTabelle(fwBemessung(400_000, 30_000, false, fw), fw)).toBe(1111 + 101 * 8);
  });

  it('Erwerbstätige: 10,1% des Erwerbseinkommens, mindestens 1010 (+5% VK)', () => {
    expect(fwBeitragErwerbstaetig(100_000, fw)).toBeCloseTo(10_100 * 1.05, 6);
    expect(fwBeitragErwerbstaetig(5_000, fw)).toBeCloseTo(1010 * 1.05, 6);
  });

  it('Befreiung durch den Ehegatten (doppelter Mindestbeitrag bzw. 1060 obligatorisch)', () => {
    expect(fwBefreitDurchEhegatte(2020, 0, fw)).toBe(true);
    expect(fwBefreitDurchEhegatte(2019, 0, fw)).toBe(false);
    expect(fwBefreitDurchEhegatte(0, 1060, fw)).toBe(true);
    expect(fwBefreitDurchEhegatte(0, 1000, fw)).toBe(false);
  });
});

describe('Freiwillige AHV/IV – Voraussetzungen (Art. 2 AHVG, Art. 7–8 VFV)', () => {
  it('Schweizer Bürger, Thailand, 5 Jahre versichert, vor dem Referenzalter → berechtigt', () => {
    const r = pruefeFreiwilligeAhv(wegzieher(), regeln);
    expect(r.berechtigt).toBe(true);
    expect(r.landEuEfta).toBe(false);
    expect(r.hinweise.join(' ')).toContain('innert 1 Jahr');
  });

  it('EU/EFTA-Staatsangehörige sind ebenfalls berechtigt', () => {
    expect(pruefeFreiwilligeAhv(wegzieher({ nationalitaet: 'EU', land: 'PA' }), regeln).berechtigt).toBe(true);
  });

  it('andere Staatsangehörigkeit → nicht berechtigt', () => {
    const r = pruefeFreiwilligeAhv(wegzieher({ nationalitaet: 'andere' }), regeln);
    expect(r.berechtigt).toBe(false);
    expect(r.gruende.join(' ')).toContain('EU- oder EFTA');
  });

  it.each(['PT', 'ES', 'IT', 'CY', 'MT'])('Wohnsitz in der EU (%s) → nicht berechtigt', (land) => {
    const r = pruefeFreiwilligeAhv(wegzieher({ land }), regeln);
    expect(r.berechtigt).toBe(false);
    expect(r.landEuEfta).toBe(true);
  });

  it.each(['PA', 'PY', 'PH', 'TH', 'AE'])('Wohnsitz ausserhalb EU/EFTA (%s) → berechtigt', (land) => {
    expect(pruefeFreiwilligeAhv(wegzieher({ land }), regeln).berechtigt).toBe(true);
  });

  it('ohne 5 Jahre Versicherung unmittelbar vorher → nicht berechtigt', () => {
    expect(pruefeFreiwilligeAhv(wegzieher({ vorherVersichert5Jahre: false }), regeln).berechtigt).toBe(false);
  });

  it('Wegzug nach dem Referenzalter → nicht nötig/nicht möglich', () => {
    const r = pruefeFreiwilligeAhv(wegzieher({ alter: 66 }), regeln);
    expect(r.berechtigt).toBe(false);
    expect(r.vorReferenzalter).toBe(false);
  });

  it('ohne Land → Hinweis, Land zu wählen', () => {
    expect(pruefeFreiwilligeAhv(wegzieher({ land: '' }), regeln).gruende).toContain('Bitte das Wohnsitzland wählen.');
  });
});

describe('Länderliste und EU/EFTA-Kennzeichen', () => {
  it('EU/EFTA-Kennzeichen der Länderdaten stimmt mit der Staatenliste in den Regeln überein', () => {
    const eu = new Set<string>(fw.euEftaStaaten);
    for (const l of WEGZUGS_LAENDER) {
      if (l.code === 'XE' || l.code === 'XX') continue;
      expect(eu.has(l.code), l.code).toBe(l.euEfta);
    }
  });

  it('enthält die geforderten Länder', () => {
    const codes = WEGZUGS_LAENDER.map((l) => l.code);
    for (const c of ['CY', 'MT', 'PT', 'ES', 'IT', 'PA', 'PY', 'PH', 'TH', 'AE']) expect(codes).toContain(c);
  });
});

describe('Frühestes AHV-Bezugsalter (abgeleitet, keine Eingabe)', () => {
  it('63 für Männer und Frauen ab Jg. 1970, 62 für Frauen Jg. 1961–1969', () => {
    expect(ahvFruehestesBezugsalter(1969, 'w', regeln.ahv)).toBe(62);
    expect(ahvFruehestesBezugsalter(1961, 'w', regeln.ahv)).toBe(62);
    expect(ahvFruehestesBezugsalter(1970, 'w', regeln.ahv)).toBe(63);
    expect(ahvFruehestesBezugsalter(1960, 'w', regeln.ahv)).toBe(63);
    expect(ahvFruehestesBezugsalter(1969, 'm', regeln.ahv)).toBe(63);
  });
});
