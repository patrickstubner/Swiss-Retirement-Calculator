import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { fwBeitragNichterwerbstaetig } from './freiwilligeAhv';
import { neBeitrag } from './neBeitrag';
import { simuliere } from './simulation';
import type { Haushalt, Person, WohnsitzAusland } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };
const fw = regeln.beitraege.freiwilligeAhv;
const ne = regeln.beitraege.nichterwerbstaetige;

/** Mann Jg. 1970 (RA 65 im Juni 2035), hört Ende 2026 auf. */
function person(o: Partial<Person> = {}, w: Partial<WohnsitzAusland> | null = null): Person {
  const p = neuePerson(regeln, {
    geburtsjahr: 1970,
    geburtsmonat: 6,
    geschlecht: 'm',
    lohn: 0,
    stoppAlter: 0,
    wertschriften: 1_000_000,
  });
  p.ahv.renteMonat = 2000;
  const res = { ...p, ...o };
  if (w) {
    res.wohnsitzAusland = {
      ...p.wohnsitzAusland,
      aktiv: true,
      modus: 'datum',
      datum: { jahr: 2028, monat: 1 },
      land: 'TH',
      nationalitaet: 'CH',
      vorherVersichert5Jahre: true,
      freiwilligeAhv: false,
      ...w,
    };
  }
  return res;
}

function haushalt(personen: Person[], o: Partial<Haushalt> = {}): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    zivilstand: personen.length > 1 ? 'verheiratet' : 'alleinstehend',
    personen,
    planungsalter: 90,
    ausgaben: { lebenshaltung: 0, faktorAb75: 1, faktorAb85: 1 },
    annahmen: {
      ...h.annahmen,
      renditeNominal: 0.01,
      renditeBargeld: 0.01,
      inflation: 0.01,
      kosten: 0,
      steuerbarerErtrag: 0,
      neVerwaltungskosten: 0.03,
    },
    ...o,
  };
}

const zeile = (e: ReturnType<typeof simuliere>, jahr: number) => {
  const z = e.zeilen.find((x) => x.jahr === jahr);
  if (!z) throw new Error(`Jahr ${jahr} fehlt`);
  return z;
};

describe('Wohnsitz im Ausland und freiwillige AHV', () => {
  it('in der Schweiz: NE-Beiträge bis zum Referenzalter, keine freiwillige AHV', () => {
    const e = simuliere(haushalt([person()]), regeln, { start });
    expect(zeile(e, 2027).neBeitraege).toBeGreaterThan(0);
    expect(zeile(e, 2027).freiwilligeAhv).toBe(0);
    expect(zeile(e, 2036).neBeitraege).toBe(0);
  });

  it('Ausland ohne freiwillige AHV: keine NE-Beiträge mehr, dafür Beitragslücken in der AHV-Rente', () => {
    const ch = simuliere(haushalt([person()]), regeln, { start });
    const e = simuliere(haushalt([person({}, {})]), regeln, { start });
    expect(zeile(e, 2027).neBeitraege).toBeGreaterThan(0); // 2027 noch in der Schweiz
    expect(zeile(e, 2028).neBeitraege).toBe(0);
    expect(zeile(e, 2030).freiwilligeAhv).toBe(0);
    const info = e.personen[0];
    // Jan 2028 bis 31.12.2034 (Jahr vor dem RA-Jahr 2035) = 7 Jahre
    expect(info?.ahvLueckenAusland).toBe(7);
    expect(info?.ahvLueckenFaktor).toBeCloseTo(37 / 44, 6);
    expect(info?.ahvRenteMonatStart).toBeCloseTo((ch.personen[0]?.ahvRenteMonatStart ?? 0) * (37 / 44), 0);
    expect(info?.hinweise.join(' ')).toContain('Beitragsjahre fehlen');
  });

  it('Ausland mit freiwilliger AHV: Beiträge bis zum Referenzalter als Ausgabe, keine Lücken', () => {
    const ch = simuliere(haushalt([person()]), regeln, { start });
    const e = simuliere(haushalt([person({}, { freiwilligeAhv: true })]), regeln, { start });
    const info = e.personen[0];
    expect(info?.freiwilligeAhvAktiv).toBe(true);
    expect(info?.ahvLueckenAusland).toBe(0);
    expect(info?.ahvRenteMonatStart).toBeCloseTo(ch.personen[0]?.ahvRenteMonatStart ?? 0, 6);
    expect(zeile(e, 2028).neBeitraege).toBe(0);
    expect(zeile(e, 2030).freiwilligeAhv).toBeGreaterThan(0);
    // RA Juni 2035: Beitragspflicht bis Ende Juni 2035 → 6/12 eines Jahresbeitrags, danach nichts
    expect(zeile(e, 2035).freiwilligeAhv).toBeGreaterThan(0);
    expect(zeile(e, 2035).freiwilligeAhv).toBeLessThan(zeile(e, 2034).freiwilligeAhv);
    expect(zeile(e, 2036).freiwilligeAhv).toBe(0);
    expect(info?.freiwilligeAhvJahre.map((j) => j.jahr)).toEqual([2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
  });

  it('freiwilliger Beitrag = Tabelle aus Vermögen am 31.12. (+20× Renten) inkl. 5% VK', () => {
    // Vermögen 1 Mio., Rendite = Inflation, keine Ausgaben → Stichtagsvermögen ≈ 1 Mio. (real)
    const e = simuliere(haushalt([person({}, { freiwilligeAhv: true })]), regeln, { start });
    const z = zeile(e, 2029);
    const erwartet = fwBeitragNichterwerbstaetig(z.total + z.freiwilligeAhv, 0, false, fw);
    expect(z.freiwilligeAhv).toBeCloseTo(erwartet, 0);
  });

  it('Wohnsitz in der EU: freiwillige AHV nicht möglich → Lücken und Hinweis', () => {
    const e = simuliere(haushalt([person({}, { freiwilligeAhv: true, land: 'PT' })]), regeln, { start });
    expect(e.personen[0]?.freiwilligeAhvAktiv).toBe(false);
    expect(e.personen[0]?.ahvLueckenAusland).toBe(7);
    expect(zeile(e, 2030).freiwilligeAhv).toBe(0);
    expect(e.personen[0]?.hinweise.join(' ')).toContain('Freiwillige AHV nicht möglich');
  });
});

describe('NE-Beitrag in der Schweiz: Vermögensdefinition', () => {
  it('AHV-Rente (Vorbezug) zählt zum Renteneinkommen (×20)', () => {
    const ohne = simuliere(haushalt([person({ wertschriften: 500_000 })]), regeln, { start });
    const p = person({ wertschriften: 500_000 });
    p.ahv.bezugVerschiebungMonate = -24;
    const mit = simuliere(haushalt([p]), regeln, { start });
    // Vorbezug ab Juni 2033: 2034 volles Jahr mit Rente → höherer NE-Beitrag
    expect(zeile(mit, 2034).neBeitraege).toBeGreaterThan(zeile(ohne, 2034).neBeitraege);
  });

  it('bezogenes PK-Kapital zählt bereits im Jahr des Bezugs zum Vermögen (Stichtag 31.12.)', () => {
    const p = person({ wertschriften: 0, bargeld: 0 });
    p.pk = { ...p.pk, guthaben: 2_000_000, sparbeitragJahr: 0, kapitalanteil: 1, fruehestesAlter: 58, zins: 0.01 };
    const e = simuliere(haushalt([p]), regeln, { start });
    const info = e.personen[0];
    const bezugsJahr = info?.pkStart.jahr ?? 0;
    expect(bezugsJahr).toBe(2028);
    // Vor dem Bezug zählt das gesperrte PK-Guthaben nicht: Mindestbeitrag
    const min = neBeitrag(0, 0, false, 0.03, ne);
    expect(zeile(e, 2027).neBeitraege).toBeCloseTo(min, 6);
    // Im Bezugsjahr: Kapital (nach Steuer) ist am 31.12. Vermögen → deutlich höherer Beitrag
    expect(zeile(e, bezugsJahr).neBeitraege).toBeGreaterThan(min * 3);
  });

  it('Ehepaar: Bemessung je aus der Hälfte des ehelichen Vermögens und Renteneinkommens', () => {
    const a = person({ wertschriften: 1_000_000 });
    const b = person({ wertschriften: 1_000_000, geschlecht: 'w', name: 'B' });
    const e = simuliere(haushalt([a, b]), regeln, { start });
    const z = zeile(e, 2027);
    const jeder = neBeitrag(z.total + z.neBeitraege, 0, true, 0.03, ne);
    expect(z.neBeitraege).toBeCloseTo(2 * jeder, -1);
  });

  it('Ehepaar: Beiträge gelten als bezahlt, wenn der Ehegatte erwerbstätig ist und genug bezahlt', () => {
    const a = person({ wertschriften: 1_000_000 });
    const b = person({ wertschriften: 0, geschlecht: 'w', lohn: 100_000, stoppAlter: 65, name: 'B' });
    const e = simuliere(haushalt([a, b]), regeln, { start });
    expect(zeile(e, 2027).neBeitraege).toBe(0);
  });

  it('Ehepaar im Ausland: nicht erwerbstätige Person mit freiwilliger AHV ist befreit, wenn der Ehegatte ≥ 2020 freiwillig bezahlt', () => {
    const a = person({ wertschriften: 1_000_000 }, { freiwilligeAhv: true });
    const b = person(
      { wertschriften: 0, lohn: 100_000, stoppAlter: 65, geschlecht: 'w', name: 'B' },
      { freiwilligeAhv: true },
    );
    const e = simuliere(haushalt([a, b]), regeln, { start });
    const z = zeile(e, 2030);
    // nur der Erwerbsbeitrag von B: 10,1% des Lohns + 5% VK
    expect(e.personen[0]?.freiwilligeAhvJahre.find((j) => j.jahr === 2030)).toBeUndefined();
    expect(z.freiwilligeAhv).toBeGreaterThan(fw.befreiungEhegatte.freiwilligErwerbstaetig);
  });
});
