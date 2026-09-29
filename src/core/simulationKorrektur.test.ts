/**
 * Korrekturen aus der Korrektheitsprüfung (Erfundene Beispielpersonen, Fantasiezahlen):
 * 1. Erstes Teiljahr: Einkommenssteuer nach dem Tarif des hochgerechneten Jahreseinkommens,
 *    Vermögensertrag nur für die simulierten Monate.
 * 2. Liegenschaft in der Schweiz nach dem Wegzug: weiterhin Vermögenssteuer im Kanton
 *    (§ 4 Abs. 1 lit. b, § 5 Abs. 2, § 6 StG ZH; Art. 4 Abs. 1 StHG) zum Satz des gesamten Vermögens.
 */
import { describe, expect, it } from 'vitest';
import { neueAusgaben, neuePerson, neuesWohneigentum, standardHaushalt } from '../data/defaults';
import { kantonsModellFuer } from '../data/kantone';
import { ladeRegeln } from '../rules';
import { simuliere } from './simulation';
import { dbgEinkommen } from './steuern';
import type { Haushalt, Person } from './typen';

const regeln = ladeRegeln(2026);

function haushalt(p: Person, o: Partial<Haushalt> = {}): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    personen: [p],
    planungsalter: 90,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 0, faktorAb75: 1, faktorAb85: 1 },
    steuern: { ...h.steuern, kanton: 'ZH', gemeinde: 'Zürich' },
    ...o,
  };
}

describe('Erstes Teiljahr (Start im Oktober)', () => {
  /** «Beispiel-Person», Lohn 120 000, Wertschriften 800 000, keine Vorsorge. */
  const p = neuePerson(regeln, {
    name: 'Beispiel-Person',
    geburtsjahr: 1975,
    geburtsmonat: 3,
    lohn: 120_000,
    stoppAlter: 65,
    wertschriften: 800_000,
  });
  const h = haushalt(p);
  const jan = simuliere(h, regeln, { start: { jahr: 2026, monat: 1 } }).zeilen[0];
  const okt = simuliere(h, regeln, { start: { jahr: 2026, monat: 10 } }).zeilen[0];

  it('Einkommenssteuer = 3/12 der Jahressteuer (Tarif des Jahreseinkommens, nicht von 3 Monatslöhnen)', () => {
    expect(jan?.steuernEinkommen).toBeGreaterThan(10_000);
    expect(okt?.steuernEinkommen).toBeCloseTo(((jan?.steuernEinkommen ?? 0) * 3) / 12, -1);
  });

  it('Vermögensertrag nur für 3 Monate: ohne Lohn ebenfalls 3/12 der Jahressteuer', () => {
    const q = { ...p, lohn: 0, stoppAlter: 0 };
    const hq = haushalt(q, { annahmen: { ...h.annahmen, steuerbarerErtrag: 0.05 } });
    const j = simuliere(hq, regeln, { start: { jahr: 2026, monat: 1 } }).zeilen[0];
    const o = simuliere(hq, regeln, { start: { jahr: 2026, monat: 10 } }).zeilen[0];
    // Jahresertrag 40 000 → steuerbar; Teiljahr darf nicht den ganzen Jahresertrag besteuern
    expect(j?.steuernEinkommen).toBeGreaterThan(1_000);
    expect(o?.steuernEinkommen).toBeCloseTo(((j?.steuernEinkommen ?? 0) * 3) / 12, -1);
    // Kontrolle mit den Tarifen: 40 000 steuerbar (Bund + ZH), davon 3/12
    const zh = kantonsModellFuer(hq.steuern);
    const erwartet =
      (dbgEinkommen(40_000, 'alleinstehend', regeln.steuern) + zh.einkommenssteuer(40_000, 'alleinstehend')) / 4;
    expect(o?.steuernEinkommen).toBeCloseTo(erwartet, -1);
  });
});

describe('Liegenschaft in der Schweiz nach dem Wegzug', () => {
  /** Rentnerin ohne Lohn, Wertschriften 600 000, Wohneigentum 1 200 000 mit Hypothek 400 000, Wegzug nach Portugal. */
  function person(mitHaus: boolean, datum = { jahr: 2028, monat: 1 }): Person {
    const p = neuePerson(regeln, {
      name: 'Beispiel-Rentnerin',
      geburtsjahr: 1958,
      geburtsmonat: 4,
      geschlecht: 'w',
      lohn: 0,
      stoppAlter: 0,
      wertschriften: 600_000,
    });
    p.wohneigentum = neuesWohneigentum(regeln, { vorhanden: mitHaus, verkehrswert: 1_200_000, hypothek: 400_000 });
    p.wohnsitzAusland = { ...p.wohnsitzAusland, aktiv: true, modus: 'datum', datum, land: 'PT', barauszahlung: false };
    return p;
  }
  const start = { jahr: 2026, monat: 1 };
  const zh = kantonsModellFuer({ ...standardHaushalt(regeln).steuern, kanton: 'ZH', gemeinde: 'Zürich' });

  it('ohne Liegenschaft: keine Schweizer Vermögenssteuer mehr (Portugal ohne Vermögenssteuer)', () => {
    const e = simuliere(haushalt(person(false)), regeln, { start });
    expect(e.zeilen.find((z) => z.jahr === 2029)?.steuernVermoegen).toBe(0);
  });

  it('mit Liegenschaft: Vermögenssteuer auf dem Nettowert zum Satz des gesamten Vermögens (§ 6 StG ZH)', () => {
    const e = simuliere(haushalt(person(true)), regeln, { start });
    const vorjahr = e.zeilen.find((z) => z.jahr === 2028);
    const z = e.zeilen.find((x) => x.jahr === 2029);
    const total = vorjahr?.vermoegen ?? 0;
    const haus = vorjahr?.toepfe.wohneigentum ?? 0;
    expect(haus).toBeGreaterThan(800_000);
    const erwartet = (zh.vermoegenssteuer(total, 'alleinstehend') / total) * haus;
    expect(z?.steuernVermoegen).toBeGreaterThan(0);
    expect(z?.steuernVermoegen).toBeCloseTo(erwartet, 0);
    expect(e.personen[0]?.hinweise.some((x) => x.startsWith('Liegenschaft in der Schweiz nach dem Wegzug'))).toBe(true);
  });

  it('Wegzug Mitte Jahr: 6 Monate Steuer auf allem, 6 Monate nur auf der Liegenschaft', () => {
    const e = simuliere(haushalt(person(true, { jahr: 2028, monat: 7 })), regeln, { start });
    const vorjahr = e.zeilen.find((z) => z.jahr === 2027);
    const z = e.zeilen.find((x) => x.jahr === 2028);
    const total = vorjahr?.vermoegen ?? 0;
    const haus = vorjahr?.toepfe.wohneigentum ?? 0;
    const voll = zh.vermoegenssteuer(total, 'alleinstehend');
    expect(z?.steuernVermoegen).toBeCloseTo(voll / 2 + ((voll / total) * haus) / 2, 0);
  });
});
