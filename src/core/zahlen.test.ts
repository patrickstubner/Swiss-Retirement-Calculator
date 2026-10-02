/** SEC-02: Core-Eingänge sind NaN-/Infinity-sicher. */
import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import {
  ahv13,
  ahvAufschubZuschlag,
  ahvMdjeAusRente,
  ahvPlafonierung,
  ahvRentenzuschlag,
  ahvRenteSkala44,
  ahvTeilrente,
  mdjeTabellenwert,
  monatBeiAlter,
} from './ahv';
import { bvgAltersgutschrift, bvgKoordinierterLohn, pkLeistung, pkProjektion } from './bvg';
import { realerBetrag } from './indexierung';
import { bandTarif, interpoliereSatz, interpoliereSteuer } from './kantonsTarife';
import { beitragAusTabelle, neBeitrag, neBemessung } from './neBeitrag';
import { quellensteuerBundKapital, stufenSteuer } from './quellensteuer';
import { realeNettorendite } from './renditen';
import { simuliere } from './simulation';
import { dbgEinkommen, dbgKapital, rundeEinkommen, wendeTarifAn } from './steuern';
import { endlich, ersteNichtEndlicheZahl } from './zahlen';

const regeln = ladeRegeln(2026);
const UNGUELTIG = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

describe('endlich / ersteNichtEndlicheZahl', () => {
  it('ersetzt NaN und ±Infinity, lässt endliche Zahlen unverändert', () => {
    for (const x of UNGUELTIG) expect(endlich(x)).toBe(0);
    expect(endlich(Number.NaN, 7)).toBe(7);
    expect(endlich(-3.5)).toBe(-3.5);
    expect(endlich(0)).toBe(0);
  });
  it('findet den Pfad der ersten nicht endlichen Zahl', () => {
    expect(ersteNichtEndlicheZahl({ a: 1, b: [2, { c: Number.NaN }] }, 'x')).toBe('x.b[1].c');
    expect(ersteNichtEndlicheZahl({ a: 1, f: () => Number.NaN, s: 'x', n: null })).toBeNull();
    expect(ersteNichtEndlicheZahl(Number.POSITIVE_INFINITY)).toBe('(Wert)');
  });
});

describe('reine Rechenfunktionen liefern bei NaN/Infinity nie NaN oder Infinity', () => {
  const endlichOk = (x: number) => expect(Number.isFinite(x), String(x)).toBe(true);
  const ahv = regeln.ahv;
  const bvg = regeln.bvg;
  const st = regeln.steuern;

  for (const u of UNGUELTIG) {
    it(`Eingabe ${u}`, () => {
      endlichOk(ahvRenteSkala44(u, ahv));
      endlichOk(ahvRenteSkala44(u, ahv, false));
      endlichOk(mdjeTabellenwert(u, ahv));
      endlichOk(ahvMdjeAusRente(u, ahv));
      endlichOk(ahvTeilrente(u, 30, ahv));
      endlichOk(ahvTeilrente(2000, u, ahv));
      endlichOk(ahvRentenzuschlag(1965, 'w', u, 0, 30, ahv));
      endlichOk(ahvRentenzuschlag(1965, 'w', 70000, 0, u, ahv));
      for (const x of ahvPlafonierung(u, 2000, ahv)) endlichOk(x);
      for (const x of ahvPlafonierung(2000, u, ahv)) endlichOk(x);
      endlichOk(ahv13(u, 2026, ahv));
      endlichOk(ahv13(24000, u, ahv));
      endlichOk(bvgKoordinierterLohn(u, bvg));
      endlichOk(bvgAltersgutschrift(u, 50, 65, bvg));
      endlichOk(bvgAltersgutschrift(100000, u, 65, bvg));
      endlichOk(pkProjektion(u, [1000, 1000], 0.01));
      endlichOk(pkProjektion(100000, [u, 1000], 0.01));
      endlichOk(pkProjektion(100000, [1000], u));
      endlichOk(pkLeistung(u, 0.05, 0.5).kapital);
      endlichOk(pkLeistung(100000, u, 0.5).renteJahr);
      endlichOk(pkLeistung(100000, 0.05, u).renteJahr);
      endlichOk(rundeEinkommen(u, st));
      endlichOk(wendeTarifAn(u, st.dbgTarifAlleinstehend));
      endlichOk(dbgEinkommen(u, 'alleinstehend', st));
      endlichOk(dbgEinkommen(100000, 'verheiratet', st, u));
      endlichOk(dbgKapital(u, 'verheiratet', st));
      endlichOk(neBemessung(u, 0, true, regeln.beitraege.nichterwerbstaetige));
      endlichOk(neBemessung(0, u, false, regeln.beitraege.nichterwerbstaetige));
      endlichOk(beitragAusTabelle(u, regeln.beitraege.nichterwerbstaetige.tabelle));
      endlichOk(neBeitrag(u, u, true, u, regeln.beitraege.nichterwerbstaetige));
      endlichOk(
        stufenSteuer(u, [
          [1000, 0.01],
          [null, 0.02],
        ]),
      );
      endlichOk(quellensteuerBundKapital(u, 'alleinstehend', regeln));
      endlichOk(
        bandTarif(u, [
          [1000, 1],
          [null, 2],
        ]),
      );
      endlichOk(
        interpoliereSteuer(u, [
          [1000, 10],
          [2000, 30],
        ]),
      );
      endlichOk(interpoliereSatz(u, { '1000': 1, '2000': 2 }));
      endlichOk(realeNettorendite(u, 0.01, 0.02));
      endlichOk(realeNettorendite(0.07, u, u));
      endlichOk(realerBetrag(u, { art: 'keine' }, 3, 1.1));
      endlichOk(realerBetrag(1000, { art: 'satz', satz: u }, u, u));
    });
  }

  it('gültige Eingaben ändern sich nicht (Stichproben)', () => {
    expect(ahvRenteSkala44(90720, ahv)).toBe(2520);
    expect(ahvRenteSkala44(15120, ahv)).toBe(1260);
    expect(ahvTeilrente(2000, 22, ahv)).toBeCloseTo(1000, 6);
    expect(dbgEinkommen(100000, 'alleinstehend', st)).toBeGreaterThan(0);
    expect(pkProjektion(100000, [1000, 1000], 0.01)).toBeCloseTo(100000 * 1.01 * 1.01 + 1000 * 1.01 + 1000, 6);
    expect(pkLeistung(100000, 0.05, 0.5)).toEqual({ kapital: 50000, renteJahr: 2500 });
  });

  it('Datumsfunktionen weisen nicht endliche Eingaben mit RangeError ab', () => {
    expect(() => monatBeiAlter(Number.NaN, 1, 780)).toThrow(RangeError);
    expect(() => monatBeiAlter(1970, Number.POSITIVE_INFINITY, 780)).toThrow(RangeError);
    expect(() => monatBeiAlter(1970, 1, Number.NaN)).toThrow(RangeError);
    expect(monatBeiAlter(1970, 6, 780)).toEqual({ jahr: 2035, monat: 6 });
  });

  it('bestehende Abweisungen bleiben (Aufschub/Vorbezug mit NaN)', () => {
    expect(() => ahvAufschubZuschlag(Number.NaN, ahv)).toThrow(RangeError);
  });
});

describe('simuliere weist nicht endliche Eingaben ab', () => {
  const start = { jahr: 2026, monat: 1 };
  const basis = () => {
    const h = standardHaushalt(regeln);
    h.personen = [neuePerson(regeln, { geburtsjahr: 1965, geburtsmonat: 3, lohn: 100000, wertschriften: 200000 })];
    return h;
  };

  it('gültiger Haushalt rechnet ohne NaN', () => {
    const e = simuliere(basis(), regeln, { start });
    expect(e.zeilen.length).toBeGreaterThan(0);
    for (const z of e.zeilen) expect(Number.isFinite(z.vermoegen)).toBe(true);
  });

  for (const u of UNGUELTIG) {
    it(`NaN/Infinity im Vermögen (${u}) → klare Fehlermeldung mit Pfad`, () => {
      const h = basis();
      (h.personen[0] as { wertschriften: number }).wertschriften = u;
      expect(() => simuliere(h, regeln, { start })).toThrow(
        /keine endliche Zahl: haushalt\.personen\[0\]\.wertschriften/,
      );
    });
  }

  it('nicht endliche Annahmen, Ausgaben und Optionen werden abgewiesen', () => {
    const a = basis();
    a.annahmen = { ...a.annahmen, renditeNominal: Number.NaN };
    expect(() => simuliere(a, regeln, { start })).toThrow(/annahmen\.renditeNominal/);
    const b = basis();
    b.ausgaben = { ...b.ausgaben, lebenshaltung: Number.POSITIVE_INFINITY };
    expect(() => simuliere(b, regeln, { start })).toThrow(/ausgaben\.lebenshaltung/);
    expect(() => simuliere(basis(), regeln, { start: { jahr: Number.NaN, monat: 1 } })).toThrow(
      /optionen\.start\.jahr/,
    );
    expect(() => simuliere(basis(), regeln, { start, stoppAlterMonate: [Number.NaN] })).toThrow(/stoppAlterMonate/);
  });
});
