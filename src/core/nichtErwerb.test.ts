import { describe, expect, it } from 'vitest';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { ahvRenteSkala44 } from './ahv';
import { ahvSchaetzung } from './ahvSchaetzung';
import { nichtErwerbAnnahmen } from './nichtErwerb';
import { effektiverHaushalt, gerechnetePerson, lohnFuerBefreiung, schaetzeAhv } from './schaetzwerte';
import { simuliere } from './simulation';
import type { Haushalt, Person } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/** Erfundenes Beispiel: erwerbstätige Person A Jg. 1966, Beispielperson B Jg. 1985 nicht erwerbstätig. */
function paar(lohnMann = 90_000, o: Partial<Person> = {}): Person[] {
  const mann = neuePerson(regeln, {
    name: 'Person A',
    geburtsjahr: 1966,
    geburtsmonat: 3,
    geschlecht: 'm',
    lohn: lohnMann,
    stoppAlter: 65,
    wertschriften: 400_000,
  });
  const frau = neuePerson(regeln, {
    name: 'Person B',
    geburtsjahr: 1985,
    geburtsmonat: 8,
    geschlecht: 'w',
    erwerbsstatus: 'nichtErwerbstaetig',
    lohn: 70_000, // gespeichert, wird aber ignoriert
    stoppAlter: 64,
    ...o,
  });
  return [mann, frau];
}

function haushalt(personen: Person[]): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    zivilstand: 'verheiratet',
    personen,
    planungsalter: 90,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 50_000, faktorAb75: 1, faktorAb85: 1 },
  };
}

describe('Nicht erwerbstätige Person (z.B. Familienarbeit)', () => {
  it('Befreiungsgrenze: doppelter Mindestbeitrag 1060 / 10,6 % = 10000 Lohn', () => {
    expect(regeln.beitraege.nichterwerbstaetige.befreiungEhegatteMindestbeitrag).toBe(1060);
    expect(lohnFuerBefreiung(regeln)).toBeCloseTo(10_000, 6);
  });

  it('gerechnete Person: kein Lohn, keine Erwerbsaufgabe, keine PK/3a-Einzahlungen; Zustand bleibt', () => {
    const [, frau] = paar();
    const f = {
      ...(frau as Person),
      pk: { ...(frau as Person).pk, guthaben: 50_000, sparbeitragJahr: 5_000 },
      saeule3a: { ...(frau as Person).saeule3a, beitragJahr: 7_000, guthaben: 20_000 },
    };
    const g = gerechnetePerson(f);
    expect(g.lohn).toBe(0);
    expect(g.stoppAlter).toBe(0);
    expect(g.pk.guthaben).toBe(0);
    expect(g.pk.sparbeitragJahr).toBe(0);
    expect(g.saeule3a.beitragJahr).toBe(0);
    expect(g.saeule3a.guthaben).toBe(20_000);
    expect(f.lohn).toBe(70_000);
    const eff = effektiverHaushalt(haushalt([paar()[0] as Person, f]), regeln, start);
    expect(eff.haushalt.personen[1]?.lohn).toBe(0);
    expect(eff.werte[1]?.pkGuthaben).toBe(0);
  });

  it('AHV: Splitting mit dem Einkommen des Ehegatten (ohne eigenes Einkommen die Hälfte)', () => {
    const [mann, frau] = paar(90_000);
    const e = schaetzeAhv(gerechnetePerson(frau as Person), mann as Person, true, regeln);
    expect(e.durchschnittErwerb).toBeCloseTo(45_000, 6);
    expect(e.fehlendeJahre).toBe(0);
    expect(e.renteMonat).toBe(ahvRenteSkala44(45_000, regeln.ahv));
  });

  it('AHV: frühere Erwerbstätigkeit wird auf die Beitragsdauer verteilt', () => {
    const [mann, frau] = paar(90_000, { frueherErwerb: { jahre: 11, lohn: 60_000 } });
    const e = schaetzeAhv(frau as Person, mann as Person, true, regeln);
    const eigen = (60_000 * 11) / e.beitragsjahre;
    expect(e.durchschnittErwerb).toBeCloseTo(0.5 * eigen + 0.5 * 90_000, 6);
  });

  it('AHV: Erziehungsgutschriften (gemeinsame Kinder, hälftig) erhöhen die Rente', () => {
    const [mann, frau] = paar(40_000);
    const ohne = schaetzeAhv(frau as Person, mann as Person, true, regeln);
    const mitMann = {
      ...(mann as Person),
      ahvSchaetzhilfe: { ...(mann as Person).ahvSchaetzhilfe, erziehungsJahre: 20 },
    };
    const mit = schaetzeAhv(frau as Person, mitMann, true, regeln);
    const gutschrift = 3 * regeln.ahv.minimalrenteMonat * 12;
    expect(mit.durchschnittErziehung).toBeCloseTo((20 * gutschrift * 0.5) / mit.beitragsjahre, 6);
    expect(mit.renteMonat).toBeGreaterThan(ohne.renteMonat);
  });

  it('Betreuungsgutschriften: nicht kumulierbar, höchstens eine Gutschrift pro Beitragsjahr', () => {
    const basis = {
      geburtsjahr: 1985,
      geburtsmonat: 8,
      geschlecht: 'w' as const,
      beitragsModus: 'jahreCh' as const,
      luecken: 0,
      jahreCh: 10,
      einkommen: 0,
      ehejahre: 0,
      einkommenEhepartner: 0,
      erziehungsJahre: 8,
      ausland: false,
      auslandJahre: 0,
    };
    const e = ahvSchaetzung({ ...basis, betreuungsJahre: 8 }, regeln);
    const gutschrift = 3 * regeln.ahv.minimalrenteMonat * 12;
    expect(e.durchschnittErziehung).toBeCloseTo((10 * gutschrift) / 10, 6);
    expect(e.hinweise.some((h) => h.includes('Betreuungsgutschriften'))).toBe(true);
  });

  it('Simulation: befreit, solange der Ehegatte arbeitet; danach eigene NE-Beiträge bis zum Referenzalter', () => {
    const e = simuliere(haushalt(paar(90_000)), regeln, { start });
    const info = e.personen[1];
    expect(info).toBeDefined();
    if (!info) return;
    // Person 1 arbeitet bis März 2031 (65) → 2026–2031 befreit (mind. 1060 bezahlt), ab 2032 eigene Beiträge
    expect(info.neBefreitJahre).toContain(2026);
    expect(info.neBefreitJahre).toContain(2031);
    expect(info.neBeitraegeJahre[0]?.jahr).toBe(2032);
    // Referenzalter Jg. 1985 = 65 im August 2050 → letztes Beitragsjahr 2050
    expect(info.neBeitraegeJahre.at(-1)?.jahr).toBe(2050);
    // kein Lohn der nicht erwerbstätigen Person trotz gespeichertem Lohn
    expect(e.zeilen[0]?.lohn).toBeCloseTo(90_000, 0);
    const a = nichtErwerbAnnahmen(paar(90_000)[1] as Person, paar(90_000)[0] as Person, true, regeln, info);
    expect(a.befreiung).toBe('bisRuecktritt');
    expect(a.ruecktrittJahrEhegatte).toBe(2031);
    expect(a.warnung).toBeNull();
  });

  it('Ehegatte unter der Grenze (Lohn 8000): keine Befreiung, Hinweis auf eigene Beiträge', () => {
    const personen = paar(8_000);
    const e = simuliere(haushalt(personen), regeln, { start });
    expect(e.personen[1]?.neBefreitJahre).toEqual([]);
    expect(e.personen[1]?.neBeitraegeJahre[0]?.jahr).toBe(2026);
    const a = nichtErwerbAnnahmen(personen[1] as Person, personen[0] as Person, true, regeln, e.personen[1] ?? null);
    expect(a.befreiung).toBe('nein');
    expect(a.warnung).toContain('eigene AHV-Beiträge');
  });

  it('Solver-Vorgaben ändern nichts: nicht Erwerbstätige haben nie Lohn', () => {
    const personen = paar(90_000);
    const a = simuliere(haushalt(personen), regeln, { start, stoppAlterMonate: [65 * 12, 70 * 12] });
    const b = simuliere(haushalt(personen), regeln, { start });
    expect(a.zeilen.map((z) => z.lohn)).toEqual(b.zeilen.map((z) => z.lohn));
  });
});
