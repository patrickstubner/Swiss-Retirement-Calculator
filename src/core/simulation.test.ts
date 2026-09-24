import { describe, expect, it } from 'vitest';
import { neueAuslandRente, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { simuliere, startvermoegen, wohneigentumNetto } from './simulation';
import { fruehestesRuecktrittsalter } from './solver';
import type { Haushalt } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

function einfach(overrides: Partial<Haushalt> = {}): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    planungsalter: 100,
    annahmen: { ...h.annahmen, renditeNominal: 0.01, inflation: 0.01, kosten: 0, steuerbarerErtrag: 0 },
    steuern: { ...h.steuern, einkommenSatz: 0, vermoegenPromille: 0, kapitalSatz: 0 },
    ...overrides,
  };
}

function mitVermoegen(v: number, overrides: Partial<Haushalt> = {}): Haushalt {
  const h = einfach(overrides);
  return { ...h, personen: h.personen.map((p, i) => (i === 0 ? { ...p, vermoegen: v } : p)) };
}

describe('simuliere – Grundlagen', () => {
  it('läuft bis zum Planungsalter der jüngeren Person', () => {
    const h = einfach();
    const e = simuliere(h, regeln, { start });
    expect(e.zeilen[0]?.jahr).toBe(2026);
    expect(e.zeilen.at(-1)?.jahr).toBe(1970 + 100);
  });

  it('Planungsalter 999 wird akzeptiert', () => {
    const h = einfach({ planungsalter: 999 });
    const e = simuliere(h, regeln, { start });
    expect(e.zeilen.at(-1)?.jahr).toBe(1970 + 999);
  });

  it('ohne Einkommen und Vermögen, aber mit Ausgaben → Ruin im ersten Jahr', () => {
    const p = neuePerson(regeln, { lohn: 0, stoppAlter: 0 });
    p.ahv.renteMonat = 0;
    p.pk.guthaben = 0;
    p.pk.sparbeitragJahr = 0;
    p.saeule3a.guthaben = 0;
    p.saeule3a.beitragJahr = 0;
    p.vermoegen = 0;
    const h = einfach({ personen: [p] });
    const e = simuliere(h, regeln, { start });
    expect(e.erfolg).toBe(false);
    expect(e.ruinJahr).toBe(2026);
  });

  it('bei Rendite = Inflation und ohne Einnahmen sinkt das Vermögen real genau um die Ausgaben', () => {
    const p = neuePerson(regeln, { lohn: 0, stoppAlter: 0, geburtsjahr: 1990 });
    p.ahv.renteMonat = 0;
    p.pk.guthaben = 0;
    p.saeule3a.guthaben = 0;
    p.vermoegen = 1_000_000;
    const h = einfach({
      personen: [p],
      ausgaben: { lebenshaltung: 50000, faktorAb75: 1, faktorAb85: 1 },
    });
    const e = simuliere(h, regeln, { start });
    // NE-Beiträge fallen an (nicht erwerbstätig, unter RA)
    const z = e.zeilen[0];
    expect(z?.neBeitraege).toBeGreaterThan(0);
    expect(z?.vermoegen).toBeCloseTo(1_000_000 - 50000 - (z?.neBeitraege ?? 0), 6);
  });

  it('AHV beginnt im Monat nach dem Referenzalter und enthält die 13. Rente', () => {
    // Mann geb. Juni 1961: RA Juni 2026, Rente ab Juli 2026 → 6 Monatsrenten + 1/12 davon
    const p = neuePerson(regeln, { geburtsjahr: 1961, geburtsmonat: 6, lohn: 0, stoppAlter: 0 });
    p.pk.guthaben = 0;
    p.saeule3a.guthaben = 0;
    const h = einfach({ personen: [p] });
    const e = simuliere(h, regeln, { start });
    expect(e.zeilen[0]?.ahv).toBeCloseTo(6 * 2520 * (1 + 1 / 12), 6);
    expect(e.personen[0]?.ahvStart).toEqual({ jahr: 2026, monat: 7 });
  });

  it('Ehepaar: AHV-Plafonierung auf 150% wenn beide beziehen', () => {
    const p1 = neuePerson(regeln, { geburtsjahr: 1955, lohn: 0, stoppAlter: 0 });
    const p2 = neuePerson(regeln, { geburtsjahr: 1955, geschlecht: 'w', lohn: 0, stoppAlter: 0 });
    for (const p of [p1, p2]) {
      p.pk.guthaben = 0;
      p.saeule3a.guthaben = 0;
    }
    const h = einfach({ zivilstand: 'verheiratet', personen: [p1, p2] });
    const e = simuliere(h, regeln, { start });
    expect(e.zeilen[0]?.ahv).toBeCloseTo(12 * 3780 * (1 + 1 / 12), 6);
  });

  it('PK-Rente ist nominal fix und verliert real an Wert', () => {
    const p = neuePerson(regeln, { geburtsjahr: 1961, geburtsmonat: 1, lohn: 0, stoppAlter: 0 });
    p.ahv.renteMonat = 0;
    p.pk.guthaben = 100000;
    p.pk.zins = 0;
    p.pk.umwandlungssatz = 0.06;
    p.saeule3a.guthaben = 0;
    const h = einfach({ personen: [p], annahmen: { ...einfach().annahmen, inflation: 0.02, renditeNominal: 0.02 } });
    const e = simuliere(h, regeln, { start });
    const r1 = e.zeilen[1]?.pkRente ?? 0;
    const r2 = e.zeilen[2]?.pkRente ?? 0;
    expect(r2 / r1).toBeCloseTo(1 / 1.02, 8);
    expect(e.personen[0]?.pkRenteJahr).toBeCloseTo(6000, 6);
  });

  it('Kapitalbezug löst Kapitalleistungssteuer aus', () => {
    const p = neuePerson(regeln, { geburtsjahr: 1966, geburtsmonat: 1, lohn: 0, stoppAlter: 0 });
    p.ahv.renteMonat = 0;
    p.pk.guthaben = 500000;
    p.pk.zins = 0;
    p.pk.kapitalanteil = 1;
    p.saeule3a.guthaben = 0;
    const h = einfach({ personen: [p], annahmen: { ...einfach().annahmen, inflation: 0 } });
    const e = simuliere(h, regeln, { start });
    // 60. Geburtstag im Jan 2026 → Bezug 2026 (Alter ≥ 58)
    expect(e.zeilen[0]?.kapitalBezuege).toBeCloseTo(500000, 6);
    expect(e.zeilen[0]?.steuernKapital).toBeGreaterThan(10000);
  });

  it('ausländische Rente (BRL, 13 Zahlungen) fliesst ab Startalter ein', () => {
    const p = neuePerson(regeln, { geburtsjahr: 1960, geburtsmonat: 1, lohn: 0, stoppAlter: 0 });
    p.ahv.renteMonat = 0;
    p.pk.guthaben = 0;
    p.saeule3a.guthaben = 0;
    p.auslandRenten = [
      { ...neueAuslandRente(), betrag: 1000, zahlungenProJahr: 13, wechselkursChf: 0.2, startAlter: 60 },
    ];
    const h = einfach({ personen: [p] });
    const e = simuliere(h, regeln, { start });
    expect(e.zeilen[0]?.auslandRenten).toBeCloseTo(2600, 6);
  });

  it('mehr Vermögen → nie schlechteres Endvermögen', () => {
    const a = simuliere(mitVermoegen(100000), regeln, { start });
    const b = simuliere(mitVermoegen(200000), regeln, { start });
    expect(b.endVermoegen).toBeGreaterThan(a.endVermoegen);
  });
});

describe('fruehestesRuecktrittsalter', () => {
  it('findet ein Alter, und ein Jahr früher reicht es nicht', () => {
    const h = einfach({ planungsalter: 95 });
    const s = fruehestesRuecktrittsalter(h, regeln, { start, modus: 'gemeinsam', person: 0, maxAlter: 70 });
    expect(s.gefunden).toBe(true);
    const a = s.alterMonate ?? 0;
    expect(s.ergebnis?.erfolg).toBe(true);
    const frueher = simuliere(h, regeln, { start, stoppAlterMonate: [a - 1] });
    expect(frueher.erfolg).toBe(false);
  });

  it('sehr grosses Vermögen → sofort möglich', () => {
    const s = fruehestesRuecktrittsalter(mitVermoegen(50_000_000), regeln, {
      start,
      modus: 'gemeinsam',
      person: 0,
      maxAlter: 70,
    });
    expect(s.sofort).toBe(true);
  });

  it('unbezahlbare Ausgaben → nicht gefunden', () => {
    const s = fruehestesRuecktrittsalter(
      einfach({ ausgaben: { lebenshaltung: 1_000_000, faktorAb75: 1, faktorAb85: 1 } }),
      regeln,
      { start, modus: 'gemeinsam', person: 0, maxAlter: 70 },
    );
    expect(s.gefunden).toBe(false);
  });

  it('Ehepaar gemeinsam: Stopp am selben Datum', () => {
    const p1 = neuePerson(regeln, { geburtsjahr: 1970, geburtsmonat: 1 });
    const p2 = neuePerson(regeln, { geburtsjahr: 1972, geburtsmonat: 1, geschlecht: 'w', lohn: 60000 });
    const h = einfach({ zivilstand: 'verheiratet', personen: [p1, p2], planungsalter: 95 });
    const s = fruehestesRuecktrittsalter(h, regeln, { start, modus: 'gemeinsam', person: 0, maxAlter: 70 });
    expect(s.gefunden).toBe(true);
    const [a1, a2] = s.stoppAlterMonate ?? [];
    expect((a1 ?? 0) - (a2 ?? 0)).toBe(24);
  });
});

describe('Individuelle Personen, Vermögen und Wohneigentum', () => {
  it('Startvermögen = Summe freies Vermögen + Wohneigentum netto beider Personen', () => {
    const p1 = neuePerson(regeln, {
      vermoegen: 200000,
      wohneigentum: { vorhanden: true, verkehrswert: 1_000_000, hypothek: 600000 },
    });
    const p2 = neuePerson(regeln, { vermoegen: 50000 });
    const h = einfach({ zivilstand: 'verheiratet', personen: [p1, p2] });
    expect(wohneigentumNetto(p1)).toBe(400000);
    expect(wohneigentumNetto(p2)).toBe(0);
    expect(startvermoegen(h)).toBe(650000);
  });

  it('Hypothek hat Default 0; ohne Wohneigentum zählt der Verkehrswert nicht', () => {
    const p = neuePerson(regeln);
    expect(p.wohneigentum).toEqual({ vorhanden: false, verkehrswert: 0, hypothek: 0 });
    const q = { ...p, wohneigentum: { vorhanden: false, verkehrswert: 900000, hypothek: 0 } };
    expect(wohneigentumNetto(q)).toBe(0);
    expect(wohneigentumNetto({ ...q, wohneigentum: { ...q.wohneigentum, vorhanden: true } })).toBe(900000);
  });

  it('Wohneigentum wird wie Börsenkapital verzinst (gleiche Rendite)', () => {
    const basis = (p: ReturnType<typeof neuePerson>) => {
      p.lohn = 0;
      p.stoppAlter = 0;
      p.ahv.renteMonat = 0;
      p.pk.guthaben = 0;
      p.saeule3a.guthaben = 0;
      return p;
    };
    const annahmen = { ...einfach().annahmen, renditeNominal: 0.05, inflation: 0 };
    const ausgaben = { lebenshaltung: 0, faktorAb75: 1, faktorAb85: 1 };
    const mitHaus = basis(
      neuePerson(regeln, {
        geburtsjahr: 1990,
        vermoegen: 0,
        wohneigentum: { vorhanden: true, verkehrswert: 500000, hypothek: 0 },
      }),
    );
    const mitDepot = basis(neuePerson(regeln, { geburtsjahr: 1990, vermoegen: 500000 }));
    const a = simuliere(einfach({ personen: [mitHaus], annahmen, ausgaben }), regeln, { start });
    const b = simuliere(einfach({ personen: [mitDepot], annahmen, ausgaben }), regeln, { start });
    expect(a.zeilen[0]?.vermoegen).toBeCloseTo(b.zeilen[0]?.vermoegen ?? 0, 6);
  });

  it('Vermögenssteuer bezieht den Nettowert des Wohneigentums ein', () => {
    const p = neuePerson(regeln, {
      vermoegen: 0,
      wohneigentum: { vorhanden: true, verkehrswert: 1_000_000, hypothek: 0 },
    });
    const h = einfach({
      personen: [p],
      steuern: { kanton: 'ZH', einkommenSatz: 0, vermoegenPromille: 3, kapitalSatz: 0 },
    });
    const e = simuliere(h, regeln, { start });
    expect(e.zeilen[0]?.steuernVermoegen).toBeCloseTo(3000, 6);
  });

  it('Jede Person hat eigenes Geschlecht/Jahrgang → eigenes Referenzalter und eigene Vorsorge', () => {
    const frau = neuePerson(regeln, { geburtsjahr: 1962, geburtsmonat: 3, geschlecht: 'w', lohn: 60000 });
    frau.pk.umwandlungssatz = 0.05;
    frau.pk.guthaben = 200000;
    frau.pk.kapitalanteil = 0.5;
    const mann = neuePerson(regeln, { geburtsjahr: 1964, geburtsmonat: 3, geschlecht: 'm', lohn: 120000 });
    mann.pk.umwandlungssatz = 0.06;
    mann.pk.guthaben = 500000;
    mann.pk.kapitalanteil = 0;
    const e = simuliere(einfach({ zivilstand: 'verheiratet', personen: [frau, mann] }), regeln, { start });
    expect(e.personen[0]?.referenzalterMonate).toBe(64 * 12 + 6);
    expect(e.personen[1]?.referenzalterMonate).toBe(65 * 12);
    expect(e.personen[0]?.pkKapital).toBeGreaterThan(0);
    expect(e.personen[1]?.pkKapital).toBe(0);
    expect(e.personen[1]?.pkRenteJahr).toBeGreaterThan(e.personen[0]?.pkRenteJahr ?? 0);
  });
});
