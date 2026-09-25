import { describe, expect, it } from 'vitest';
import {
  neueAusgaben,
  neueAuslandRente,
  neuePerson,
  neuerPosten,
  neuesEreignis,
  standardHaushalt,
} from '../data/defaults';
import { ladeRegeln } from '../rules';
import { entnehme, simuliere, startvermoegen, vorsorgeBezugMonate, wohneigentumNetto } from './simulation';
import { fruehestesRuecktrittsalter } from './solver';
import type { Haushalt, Person, Toepfe } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/** Testperson mit expliziten Werten (die App-Defaults sind bewusst neutral = 0). */
function person(overrides: Partial<Person> = {}): Person {
  const p = neuePerson(regeln, { geburtsjahr: 1970, geburtsmonat: 6, lohn: 100000, wertschriften: 300000 });
  p.ahv.renteMonat = 2520;
  p.pk = { ...p.pk, guthaben: 400000, sparbeitragJahr: 15000, umwandlungssatz: 0.055, fruehestesAlter: 58 };
  p.saeule3a = { ...p.saeule3a, guthaben: 80000, beitragJahr: 7258, rendite: 0.02 };
  return { ...p, ...overrides };
}

/** Person ohne jedes Einkommen und Vermögen. */
function leer(overrides: Partial<Person> = {}): Person {
  const p = neuePerson(regeln, { lohn: 0, stoppAlter: 0, ...overrides });
  return p;
}

function einfach(overrides: Partial<Haushalt> = {}): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    personen: [person()],
    planungsalter: 100,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 70000, faktorAb75: 0.9, faktorAb85: 1.1 },
    annahmen: {
      ...h.annahmen,
      renditeNominal: 0.01,
      renditeBargeld: 0.01,
      inflation: 0.01,
      kosten: 0,
      steuerbarerErtrag: 0,
    },
    ...overrides,
  };
}

const ohneAusgaben = { ...neueAusgaben(), lebenshaltung: 0, faktorAb75: 1, faktorAb85: 1 };

describe('simuliere – Grundlagen', () => {
  it('läuft bis zum Planungsalter der jüngeren Person (auch 999)', () => {
    expect(simuliere(einfach(), regeln, { start }).zeilen.at(-1)?.jahr).toBe(1970 + 100);
    expect(simuliere(einfach({ planungsalter: 999 }), regeln, { start }).zeilen.at(-1)?.jahr).toBe(1970 + 999);
  });

  it('ohne Einkommen und Vermögen, aber mit Ausgaben → Fehlbetrag im ersten Jahr', () => {
    const e = simuliere(einfach({ personen: [leer()] }), regeln, { start });
    expect(e.erfolg).toBe(false);
    expect(e.ruinJahr).toBe(2026);
    expect(e.liquiditaetsluecken).toHaveLength(0); // nichts gebunden → keine Liquiditätslücke, sondern aufgebraucht
  });

  it('bei Rendite = Inflation sinkt das Vermögen real genau um die Ausgaben (+ NE-Beiträge)', () => {
    const p = leer({ geburtsjahr: 1990, wertschriften: 1_000_000 });
    const h = einfach({
      personen: [p],
      ausgaben: { ...neueAusgaben(), lebenshaltung: 50000, faktorAb75: 1, faktorAb85: 1 },
    });
    const z = simuliere(h, regeln, { start }).zeilen[0];
    expect(z?.neBeitraege).toBeGreaterThan(0);
    expect(z?.vermoegen).toBeCloseTo(1_000_000 - 50000 - (z?.neBeitraege ?? 0), 6);
  });

  it('AHV beginnt im Monat nach dem Referenzalter und enthält die 13. Rente', () => {
    const p = leer({ geburtsjahr: 1961, geburtsmonat: 6 });
    p.ahv.renteMonat = 2520;
    const e = simuliere(einfach({ personen: [p] }), regeln, { start });
    expect(e.zeilen[0]?.ahv).toBeCloseTo(6 * 2520 * (1 + 1 / 12), 6);
    expect(e.personen[0]?.ahvStart).toEqual({ jahr: 2026, monat: 7 });
  });

  it('Ehepaar: AHV-Plafonierung auf 150% wenn beide beziehen', () => {
    const p1 = leer({ geburtsjahr: 1955 });
    const p2 = leer({ geburtsjahr: 1955, geschlecht: 'w' });
    p1.ahv.renteMonat = 2520;
    p2.ahv.renteMonat = 2520;
    const e = simuliere(einfach({ zivilstand: 'verheiratet', personen: [p1, p2] }), regeln, { start });
    expect(e.zeilen[0]?.ahv).toBeCloseTo(12 * 3780 * (1 + 1 / 12), 6);
  });

  it('PK-Rente ist nominal fix und verliert real an Wert', () => {
    const p = leer({ geburtsjahr: 1961, geburtsmonat: 1 });
    p.pk = { ...p.pk, guthaben: 100000, zins: 0, umwandlungssatz: 0.06 };
    const h = einfach({ personen: [p], annahmen: { ...einfach().annahmen, inflation: 0.02, renditeNominal: 0.02 } });
    const e = simuliere(h, regeln, { start });
    expect((e.zeilen[2]?.pkRente ?? 0) / (e.zeilen[1]?.pkRente ?? 1)).toBeCloseTo(1 / 1.02, 8);
    expect(e.personen[0]?.pkRenteJahr).toBeCloseTo(6000, 6);
  });

  it('Kapitalbezug löst Kapitalleistungssteuer aus und fliesst in die Wertschriften der Person', () => {
    const p = leer({ geburtsjahr: 1961, geburtsmonat: 1 });
    p.pk = { ...p.pk, guthaben: 500000, zins: 0, kapitalanteil: 1 };
    const h = einfach({ personen: [p], ausgaben: ohneAusgaben, annahmen: { ...einfach().annahmen, inflation: 0 } });
    const z = simuliere(h, regeln, { start }).zeilen[0];
    expect(z?.kapitalBezuege).toBeCloseTo(500000, 6);
    expect(z?.steuernKapital).toBeGreaterThan(10000);
    expect(z?.toepfe.pk).toBe(0);
    expect(z?.toepfe.wertschriften).toBeCloseTo(
      500000 - (z?.steuernKapital ?? 0) - (z?.steuernEinkommen ?? 0) - (z?.neBeitraege ?? 0),
      6,
    );
  });

  it('ausländische Rente (BRL, 13 Zahlungen) fliesst ab Startalter ein', () => {
    const p = leer({ geburtsjahr: 1960, geburtsmonat: 1 });
    p.auslandRenten = [
      { ...neueAuslandRente(), betrag: 1000, zahlungenProJahr: 13, wechselkursChf: 0.2, startAlter: 60 },
    ];
    expect(simuliere(einfach({ personen: [p] }), regeln, { start }).zeilen[0]?.auslandRenten).toBeCloseTo(2600, 6);
  });

  it('mehr Vermögen → besseres Endvermögen', () => {
    const a = simuliere(einfach({ personen: [person({ wertschriften: 100000 })] }), regeln, { start });
    const b = simuliere(einfach({ personen: [person({ wertschriften: 200000 })] }), regeln, { start });
    expect(b.endVermoegen).toBeGreaterThan(a.endVermoegen);
  });
});

describe('Vermögens-Töpfe', () => {
  it('jeder Topf hat seine eigene Rendite (Bargeld vs. Wertschriften)', () => {
    const p = leer({ geburtsjahr: 1990, bargeld: 100000, wertschriften: 100000 });
    p.ahv.bezugVerschiebungMonate = 0;
    const h = einfach({
      personen: [p],
      ausgaben: ohneAusgaben,
      annahmen: { ...einfach().annahmen, renditeBargeld: 0, renditeNominal: 0.05, inflation: 0 },
    });
    const z = simuliere(h, regeln, { start }).zeilen[0];
    // NE-Beitrag wird zuerst aus Bargeld bezahlt
    expect(z?.toepfe.wertschriften).toBeCloseTo(105000, 6);
    expect(z?.toepfe.bargeld).toBeCloseTo(100000 - (z?.neBeitraege ?? 0), 6);
  });

  it('Entnahme-Reihenfolge: Bargeld → Wertschriften → Sonstiges → Wohneigentum', () => {
    const t: Toepfe = {
      bargeld: 10,
      wertschriften: 20,
      sonstiges: 30,
      wohneigentum: 40,
      pk: 99,
      freizuegigkeit: 0,
      saeule3a: 0,
    };
    const r = entnehme([t], 45);
    expect(t).toMatchObject({ bargeld: 0, wertschriften: 0, sonstiges: 15, wohneigentum: 40, pk: 99 });
    expect(r).toEqual({ rest: 0, wohneigentum: false });
    const r2 = entnehme([t], 100);
    expect(r2.wohneigentum).toBe(true);
    expect(r2.rest).toBe(45);
    expect(t.pk).toBe(99); // gebundene Töpfe werden nie angetastet
  });

  it('Töpfe mehrerer Personen bleiben getrennt', () => {
    const p1 = leer({ geburtsjahr: 1980, wertschriften: 100000 });
    const p2 = leer({ geburtsjahr: 1980, geschlecht: 'w', bargeld: 50000 });
    const h = einfach({ zivilstand: 'verheiratet', personen: [p1, p2], ausgaben: ohneAusgaben });
    const z = simuliere(h, regeln, { start }).zeilen[0];
    expect(z?.toepfeProPerson[0]?.bargeld).toBe(0);
    expect(z?.toepfeProPerson[1]?.wertschriften).toBe(0);
  });
});

describe('Sperrfristen (Zugang zu Vorsorgegeldern)', () => {
  it('PK bleibt bis zum frühesten Bezugsalter gesperrt (Default 63) → Liquiditätslücke', () => {
    // geb. Jan. 1971: heute 55, Erwerbsaufgabe sofort, kein freies Vermögen
    const p = leer({ geburtsjahr: 1971, geburtsmonat: 1 });
    p.pk = { ...p.pk, guthaben: 800000, kapitalanteil: 1 };
    expect(p.pk.fruehestesAlter).toBe(63);
    const e = simuliere(
      einfach({ personen: [p], ausgaben: { ...neueAusgaben(), lebenshaltung: 40000, faktorAb75: 1, faktorAb85: 1 } }),
      regeln,
      {
        start,
      },
    );
    expect(e.personen[0]?.pkStart).toEqual({ jahr: 2034, monat: 1 });
    expect(e.liquiditaetsluecken[0]).toBe(2026);
    expect(e.liquiditaetsluecken).toContain(2033);
    expect(e.liquiditaetsluecken).not.toContain(2034); // Kapitalbezug mit 63 deckt den Fehlbetrag
    const z2033 = e.zeilen.find((z) => z.jahr === 2033);
    expect(z2033?.toepfe.pk).toBeGreaterThan(0);
    expect(z2033?.liquiditaetsluecke).toBe(true);
    const z2034 = e.zeilen.find((z) => z.jahr === 2034);
    expect(z2034?.toepfe.pk).toBe(0);
    expect(z2034?.fehlbetrag).toBe(0);
  });

  it('frühestes PK-Alter 58 gemäss Reglement gibt das Guthaben früher frei', () => {
    const p = leer({ geburtsjahr: 1971, geburtsmonat: 1 });
    p.pk = { ...p.pk, guthaben: 100000, fruehestesAlter: 58 };
    expect(simuliere(einfach({ personen: [p] }), regeln, { start }).personen[0]?.pkStart).toEqual({
      jahr: 2029,
      monat: 1,
    });
  });

  it('PK-Bezug spätestens mit 70, auch bei längerer Erwerbstätigkeit', () => {
    const p = person({ geburtsjahr: 1970, geburtsmonat: 1, stoppAlter: 75 });
    expect(simuliere(einfach({ personen: [p] }), regeln, { start }).personen[0]?.pkStart).toEqual({
      jahr: 2040,
      monat: 1,
    });
  });

  it('3a gesperrt bis RA−5, spätestens im RA bzw. bis RA+5 bei Erwerbstätigkeit', () => {
    const ra = 65 * 12;
    expect(vorsorgeBezugMonate(55 * 12, ra, null, 5, 5)).toBe(60 * 12);
    expect(vorsorgeBezugMonate(62 * 12, ra, null, 5, 5)).toBe(62 * 12);
    expect(vorsorgeBezugMonate(66 * 12, ra, null, 5, 5)).toBe(66 * 12);
    expect(vorsorgeBezugMonate(75 * 12, ra, null, 5, 5)).toBe(70 * 12);
    expect(vorsorgeBezugMonate(62 * 12, ra, 67, 5, 5)).toBe(65 * 12); // ohne Erwerb spätestens RA
  });

  it('3a und Freizügigkeit werden in der Simulation erst ab RA−5 frei', () => {
    const p = leer({ geburtsjahr: 1971, geburtsmonat: 1 });
    p.saeule3a = { ...p.saeule3a, guthaben: 50000 };
    p.freizuegigkeit = { ...p.freizuegigkeit, guthaben: 30000 };
    const e = simuliere(einfach({ personen: [p], ausgaben: ohneAusgaben }), regeln, { start });
    expect(e.personen[0]?.saeule3aStart).toEqual({ jahr: 2031, monat: 1 });
    expect(e.personen[0]?.freizuegigkeitStart).toEqual({ jahr: 2031, monat: 1 });
    expect(e.zeilen.find((z) => z.jahr === 2030)?.gebunden).toBeGreaterThan(0);
    expect(e.zeilen.find((z) => z.jahr === 2031)?.gebunden).toBe(0);
  });
});

describe('Wiederkehrende Posten und Einmalereignisse', () => {
  it('Einmaliger Zufluss (Erbschaft) im Jahr des Alters', () => {
    const p = leer({ geburtsjahr: 1980, geburtsmonat: 1, bargeld: 0 });
    const h = einfach({
      personen: [p],
      ausgaben: ohneAusgaben,
      ereignisse: [{ ...neuesEreignis(), betrag: 200000, alter: 50 }],
      annahmen: { ...einfach().annahmen, inflation: 0, renditeNominal: 0 },
    });
    const e = simuliere(h, regeln, { start });
    const z2029 = e.zeilen.find((z) => z.jahr === 2029);
    const z2030 = e.zeilen.find((z) => z.jahr === 2030);
    expect(z2030?.einmalig).toBe(200000);
    expect((z2030?.vermoegen ?? 0) - (z2029?.vermoegen ?? 0)).toBeGreaterThan(190000);
  });

  it('Einmaliger Abfluss (Auto) reduziert das Vermögen', () => {
    const p = leer({ geburtsjahr: 1980, geburtsmonat: 1, bargeld: 100000 });
    const h = einfach({
      personen: [p],
      ausgaben: ohneAusgaben,
      ereignisse: [{ ...neuesEreignis(), bezeichnung: 'Auto', betrag: -40000, alter: 46 }],
      annahmen: { ...einfach().annahmen, inflation: 0, renditeBargeld: 0 },
    });
    const z = simuliere(h, regeln, { start }).zeilen[0];
    expect(z?.einmalig).toBe(-40000);
    expect(z?.toepfe.bargeld).toBeCloseTo(60000 - (z?.neBeitraege ?? 0), 6);
  });

  it('Posten gelten nur zwischen Start- und Endalter', () => {
    const p = leer({ geburtsjahr: 1980, geburtsmonat: 1, wertschriften: 1_000_000 });
    const miete = { ...neuerPosten('einnahme'), betragJahr: 12000, startAlter: 47, endAlter: 49 };
    const kk = { ...neuerPosten('ausgabe'), betragJahr: 6000, startAlter: 0, endAlter: null };
    const e = simuliere(einfach({ personen: [p], ausgaben: ohneAusgaben, posten: [miete, kk] }), regeln, { start });
    const jahr = (j: number) => e.zeilen.find((z) => z.jahr === j);
    expect(jahr(2026)?.weitereEinnahmen).toBe(0); // Alter 46
    expect(jahr(2027)?.weitereEinnahmen).toBeCloseTo(12000, 6); // 47
    expect(jahr(2028)?.weitereEinnahmen).toBeCloseTo(12000, 6); // 48
    expect(jahr(2029)?.weitereEinnahmen).toBe(0); // 49 = Ende
    expect(jahr(2060)?.ausgaben).toBeCloseTo(6000, 6);
  });
});

describe('Individuelle Personen, Vermögen und Wohneigentum', () => {
  it('Startvermögen = Summe verfügbarer Töpfe inkl. Wohneigentum netto beider Personen', () => {
    const p1 = leer({
      wertschriften: 150000,
      bargeld: 50000,
      wohneigentum: { vorhanden: true, verkehrswert: 1_000_000, hypothek: 600000 },
    });
    const p2 = leer({ bargeld: 50000 });
    expect(wohneigentumNetto(p1)).toBe(400000);
    expect(wohneigentumNetto(p2)).toBe(0);
    expect(startvermoegen(einfach({ zivilstand: 'verheiratet', personen: [p1, p2] }))).toBe(650000);
  });

  it('Hypothek hat Default 0; ohne Wohneigentum zählt der Verkehrswert nicht', () => {
    const p = neuePerson(regeln);
    expect(p.wohneigentum).toEqual({ vorhanden: false, verkehrswert: 0, hypothek: 0 });
    const q = { ...p, wohneigentum: { vorhanden: false, verkehrswert: 900000, hypothek: 0 } };
    expect(wohneigentumNetto(q)).toBe(0);
    expect(wohneigentumNetto({ ...q, wohneigentum: { ...q.wohneigentum, vorhanden: true } })).toBe(900000);
  });

  it('Wohneigentum wird wie Börsenkapital verzinst (gleiche Rendite wie Wertschriften)', () => {
    const annahmen = { ...einfach().annahmen, renditeNominal: 0.05, inflation: 0 };
    const mitHaus = leer({ geburtsjahr: 1990, wohneigentum: { vorhanden: true, verkehrswert: 500000, hypothek: 0 } });
    const mitDepot = leer({ geburtsjahr: 1990, wertschriften: 500000 });
    const a = simuliere(einfach({ personen: [mitHaus], annahmen, ausgaben: ohneAusgaben }), regeln, { start });
    const b = simuliere(einfach({ personen: [mitDepot], annahmen, ausgaben: ohneAusgaben }), regeln, { start });
    expect(a.zeilen[0]?.total).toBeCloseTo(b.zeilen[0]?.total ?? 0, 6);
  });

  it('Vermögenssteuer bezieht den Nettowert des Wohneigentums ein', () => {
    const p = person({ wertschriften: 0, wohneigentum: { vorhanden: true, verkehrswert: 1_000_000, hypothek: 0 } });
    const h = einfach({
      personen: [p],
      steuern: {
        ...standardHaushalt(regeln).steuern,
        eigeneSaetze: true,
        einkommenSatz: 0,
        vermoegenPromille: 3,
        kapitalSatz: 0,
      },
    });
    expect(simuliere(h, regeln, { start }).zeilen[0]?.steuernVermoegen).toBeCloseTo(3000, 6);
  });

  it('Jede Person hat eigenes Geschlecht/Jahrgang → eigenes Referenzalter und eigene Vorsorge', () => {
    const frau = person({ geburtsjahr: 1962, geburtsmonat: 3, geschlecht: 'w', lohn: 60000 });
    frau.pk = { ...frau.pk, umwandlungssatz: 0.05, guthaben: 200000, kapitalanteil: 0.5 };
    const mann = person({ geburtsjahr: 1964, geburtsmonat: 3, geschlecht: 'm', lohn: 120000 });
    mann.pk = { ...mann.pk, umwandlungssatz: 0.06, guthaben: 500000, kapitalanteil: 0 };
    const e = simuliere(einfach({ zivilstand: 'verheiratet', personen: [frau, mann] }), regeln, { start });
    expect(e.personen[0]?.referenzalterMonate).toBe(64 * 12 + 6);
    expect(e.personen[1]?.referenzalterMonate).toBe(65 * 12);
    expect(e.personen[0]?.pkKapital).toBeGreaterThan(0);
    expect(e.personen[1]?.pkKapital).toBe(0);
    expect(e.personen[1]?.pkRenteJahr).toBeGreaterThan(e.personen[0]?.pkRenteJahr ?? 0);
  });
});

describe('fruehestesRuecktrittsalter', () => {
  const opt = { start, modus: 'gemeinsam' as const, person: 0, maxAlter: 70 };

  it('findet ein Alter, und einen Monat früher reicht es nicht', () => {
    const h = einfach({ planungsalter: 95 });
    const s = fruehestesRuecktrittsalter(h, regeln, opt);
    expect(s.gefunden).toBe(true);
    expect(s.ergebnis?.erfolg).toBe(true);
    const frueher = simuliere(h, regeln, { start, stoppAlterMonate: [(s.alterMonate ?? 0) - 1] });
    expect(frueher.erfolg).toBe(false);
  });

  it('sehr grosses Vermögen → sofort möglich', () => {
    const s = fruehestesRuecktrittsalter(einfach({ personen: [person({ wertschriften: 50_000_000 })] }), regeln, opt);
    expect(s.sofort).toBe(true);
  });

  it('unbezahlbare Ausgaben → nicht gefunden', () => {
    const s = fruehestesRuecktrittsalter(
      einfach({ ausgaben: { ...neueAusgaben(), lebenshaltung: 1_000_000, faktorAb75: 1, faktorAb85: 1 } }),
      regeln,
      opt,
    );
    expect(s.gefunden).toBe(false);
  });

  it('Ehepaar gemeinsam: Stopp am selben Datum', () => {
    const p1 = person({ geburtsjahr: 1970, geburtsmonat: 1 });
    const p2 = person({ geburtsjahr: 1972, geburtsmonat: 1, geschlecht: 'w', lohn: 60000 });
    const s = fruehestesRuecktrittsalter(
      einfach({ zivilstand: 'verheiratet', personen: [p1, p2], planungsalter: 95 }),
      regeln,
      opt,
    );
    expect(s.gefunden).toBe(true);
    const [a1, a2] = s.stoppAlterMonate ?? [];
    expect((a1 ?? 0) - (a2 ?? 0)).toBe(24);
  });
});

describe('Ausländische Renten: Wechselkursszenario und Quellensteuer', () => {
  it('Abwertung reduziert die Rente real, Quellensteuer den Nettozufluss', () => {
    const p = neuePerson(regeln, { geburtsjahr: 1960, geburtsmonat: 1, lohn: 0, stoppAlter: 0 });
    p.auslandRenten = [
      {
        ...neueAuslandRente(),
        betrag: 1000,
        zahlungenProJahr: 12,
        wechselkursChf: 1,
        startAlter: 60,
        wechselkursAenderung: -0.1,
        quellensteuerSatz: 0.2,
      },
    ];
    const e = simuliere(einfach({ personen: [p] }), regeln, { start });
    expect(e.zeilen[0]?.auslandRenten).toBeCloseTo(12000 * 0.8, 6);
    expect(e.zeilen[1]?.auslandRenten).toBeCloseTo(12000 * 0.9 * 0.8, 6);
  });
});
