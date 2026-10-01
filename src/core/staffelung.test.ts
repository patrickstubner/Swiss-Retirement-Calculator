/**
 * Staffelung der Kapitalbezüge (Art. 38 DBG; Art. 3 BVV 3; Art. 16 und 12 FZV; Art. 13a BVG). Erfundene Personen.
 */
import { describe, expect, it } from 'vitest';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { simuliere, staffelZeitplan } from './simulation';
import { mitStaffelung, staffelVarianten } from './staffelung';
import type { Haushalt } from './typen';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };

function haushalt(kanton = 'ZH', verheiratet = false): Haushalt {
  const h = standardHaushalt(regeln);
  const a = neuePerson(regeln, {
    name: 'Person A',
    geburtsjahr: 1966,
    geburtsmonat: 3,
    geschlecht: 'm',
    lohn: 0,
    stoppAlter: 62,
    wertschriften: 300_000,
  });
  a.ahv.renteMonat = 2200;
  a.pk = { ...a.pk, guthaben: 500_000, kapitalanteil: 0, fruehestesAlter: 60 };
  a.freizuegigkeit = { ...a.freizuegigkeit, guthaben: 200_000 };
  a.saeule3a = { ...a.saeule3a, guthaben: 300_000 };
  const personen = [a];
  if (verheiratet) {
    const b = neuePerson(regeln, {
      name: 'Person B',
      geburtsjahr: 1967,
      geburtsmonat: 5,
      geschlecht: 'w',
      stoppAlter: 62,
      lohn: 0,
    });
    b.ahv.renteMonat = 1800;
    b.saeule3a = { ...b.saeule3a, guthaben: 200_000 };
    personen.push(b);
  }
  return {
    ...h,
    zivilstand: verheiratet ? 'verheiratet' : 'alleinstehend',
    personen,
    planungsalter: 90,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 50_000, faktorAb75: 1, faktorAb85: 1 },
    // Annahmen fix (unabhängig vom Standard), damit die Tests die Regeln prüfen und nicht den Standardwert
    annahmen: { ...h.annahmen, renditeNominal: 0.04, inflation: 0.01 },
    steuern: { ...h.steuern, kanton, gemeinde: '' },
    krisen: { ...h.krisen, modus: 'keine' },
  };
}

const kapSteuer = (h: Haushalt) =>
  simuliere(h, regeln, { start: heute }).zeilen.reduce((s, z) => s + z.steuernKapital, 0);

describe('Zeitplan der Staffelung', () => {
  it('ohne Staffelung ein Bezug am ordentlichen Zeitpunkt', () => {
    expect(staffelZeitplan(780, 720, 840, 1)).toEqual({ anzahl: 1, erster: 780 });
  });
  it('zuerst nach hinten (Aufschub nur mit Erwerb), dann nach vorne im Fenster (5 Jahre vor dem Referenzalter)', () => {
    // RA = 780; Bezug bei Erwerbsaufgabe 780: kein Aufschub, 5 Jahre nach vorne
    expect(staffelZeitplan(780, 720, 780, 5)).toEqual({ anzahl: 5, erster: 732 });
    // mit Aufschubfenster bis 840: 5 Bezüge ab 780
    expect(staffelZeitplan(780, 720, 840, 5)).toEqual({ anzahl: 5, erster: 780 });
    // Bezug bei 738: nach hinten bis 780 (3 Schritte), dazu ab 720 zurück (1 Schritt)
    expect(staffelZeitplan(738, 720, 780, 5)).toEqual({ anzahl: 5, erster: 726 });
  });
  it('nie vor dem Fenster und nie vor heute', () => {
    expect(staffelZeitplan(725, 720, 780, 5).erster).toBeGreaterThanOrEqual(720);
    expect(staffelZeitplan(780, 720, 780, 5, 760).erster).toBeGreaterThanOrEqual(760);
  });
  it('das Jahr einer anderen Kapitalleistung wird gemieden, wenn dahinter Platz ist', () => {
    const geburtIdx = 1966 * 12;
    const z = staffelZeitplan(780, 720, 840, 3, 0, [Math.floor((geburtIdx + 780) / 12)], geburtIdx);
    expect(Math.floor((geburtIdx + z.erster) / 12)).toBeGreaterThan(Math.floor((geburtIdx + 780) / 12));
  });
});

describe('Staffelung in der Simulation', () => {
  it('Regression: ohne Staffelung (fehlend oder inaktiv) ist alles bitgleich', () => {
    const h = haushalt();
    const roh = simuliere({ ...h, staffelung: undefined }, regeln, { start: heute });
    const aus = simuliere(mitStaffelung(h, 1), regeln, { start: heute });
    const inaktiv = simuliere({ ...h, staffelung: { aktiv: false, jahre: 5, pk: true, fz: true, s3a: true } }, regeln, {
      start: heute,
    });
    expect(JSON.stringify(aus)).toBe(JSON.stringify(roh));
    expect(JSON.stringify(inaktiv)).toBe(JSON.stringify(roh));
  });

  it('gleiches Kapital, weniger Steuer: 3a und Freizügigkeit über mehrere Jahre', () => {
    const h = haushalt();
    const eins = simuliere(mitStaffelung(h, 1), regeln, { start: heute });
    const drei = simuliere(mitStaffelung(h, 3), regeln, { start: heute });
    const kap = (e: typeof eins) => e.zeilen.reduce((s, z) => s + z.kapitalBezuege, 0);
    // später bezogenes Kapital wird bis zum Bezug weiter verzinst (real leicht negativ bei 1 % Nominalzins): ±1 %
    expect(Math.abs(kap(drei) - kap(eins))).toBeLessThan(kap(eins) * 0.01);
    const st = (e: typeof eins) => e.zeilen.reduce((s, z) => s + z.steuernKapital, 0);
    expect(st(drei)).toBeLessThan(st(eins));
    // mehr Jahre → nie mehr Steuer
    expect(kapSteuer(mitStaffelung(h, 5))).toBeLessThanOrEqual(kapSteuer(mitStaffelung(h, 3)) + 1);
  });

  it('die Bezüge verteilen sich auf n verschiedene Kalenderjahre (3a: n Konten)', () => {
    const h = haushalt();
    h.personen[0]!.freizuegigkeit.guthaben = 0;
    const e = simuliere(mitStaffelung(h, 3, { fz: false }), regeln, { start: heute });
    const jahre = e.zeilen.filter((z) => z.kapitalBezuege > 1).map((z) => z.jahr);
    expect(jahre.length).toBe(3);
    expect(jahre[1]).toBe((jahre[0] ?? 0) + 1);
    // 300'000 gleichmässig (plus Zins bis zum Bezug)
    const bezuege = e.zeilen.filter((z) => z.kapitalBezuege > 1).map((z) => z.kapitalBezuege);
    for (const b of bezuege) expect(Math.abs(b - (bezuege[0] ?? 0))).toBeLessThan((bezuege[0] ?? 0) * 0.1);
  });

  it('Freizügigkeit: höchstens zwei Einrichtungen (Art. 12 FZV) – auch bei 5 Jahren nur zwei Bezüge', () => {
    const h = haushalt();
    h.personen[0]!.saeule3a.guthaben = 0;
    const e = simuliere(mitStaffelung(h, 5), regeln, { start: heute });
    expect(e.zeilen.filter((z) => z.kapitalBezuege > 1).length).toBe(2);
    expect(e.personen[0]?.hinweise.join(' ')).toMatch(/höchstens 2 Einrichtungen/);
  });

  it('PK-Kapital nur mit Schalter und höchstens drei Schritte (Art. 13a Abs. 2 BVG)', () => {
    const h = haushalt();
    h.personen[0]!.pk.kapitalanteil = 1;
    h.personen[0]!.saeule3a.guthaben = 0;
    h.personen[0]!.freizuegigkeit.guthaben = 0;
    const ohne = simuliere(mitStaffelung(h, 5, { pk: false }), regeln, { start: heute });
    expect(ohne.zeilen.filter((z) => z.kapitalBezuege > 1).length).toBe(1);
    const mit = simuliere(mitStaffelung(h, 5, { pk: true }), regeln, { start: heute });
    expect(mit.zeilen.filter((z) => z.kapitalBezuege > 1).length).toBe(3);
    expect(kapSteuer(mitStaffelung(h, 3, { pk: true }))).toBeLessThan(kapSteuer(mitStaffelung(h, 1, { pk: true })));
    expect(mit.personen[0]?.hinweise.join(' ')).toMatch(/Teilpensionierung/);
  });

  it('PK-Rente bleibt bei Teilbezügen als Summe erhalten (Kapitalanteil < 1)', () => {
    const h = haushalt();
    h.personen[0]!.pk.kapitalanteil = 0.5;
    const eins = simuliere(mitStaffelung(h, 1, { pk: true }), regeln, { start: heute });
    const drei = simuliere(mitStaffelung(h, 3, { pk: true }), regeln, { start: heute });
    // später bezogene Teile werden bis dahin weiter verzinst (Zins minus Teuerung): in derselben Grössenordnung
    const r1 = eins.personen[0]?.pkRenteJahr ?? 0;
    expect(Math.abs((drei.personen[0]?.pkRenteJahr ?? 0) - r1)).toBeLessThan(r1 * 0.05);
  });

  it('Ehepaar: Bezüge beider Personen im selben Jahr werden zusammengerechnet – die Staffelung wirkt trotzdem', () => {
    const h = haushalt('ZH', true);
    expect(kapSteuer(mitStaffelung(h, 3))).toBeLessThan(kapSteuer(mitStaffelung(h, 1)));
  });

  it('kein Effekt bei erfasstem Wegzug (Quellensteuer, Barauszahlung): Bezug in einem Schritt', () => {
    const h = haushalt();
    const p = h.personen[0]!;
    p.wohnsitzAusland = {
      ...p.wohnsitzAusland,
      aktiv: true,
      modus: 'alter',
      alter: 61,
      land: 'BR',
      barauszahlung: true,
    };
    const a = simuliere(mitStaffelung(h, 1), regeln, { start: heute });
    const b = simuliere(mitStaffelung(h, 4), regeln, { start: heute });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('Staffelung ohne 3a-Konto/Freizügigkeit ändert nichts', () => {
    const h = haushalt();
    h.personen[0]!.saeule3a.guthaben = 0;
    h.personen[0]!.freizuegigkeit.guthaben = 0;
    const a = simuliere(mitStaffelung(h, 1), regeln, { start: heute });
    const b = simuliere(mitStaffelung(h, 4), regeln, { start: heute });
    expect(b.zeilen.map((z) => z.steuernKapital)).toEqual(a.zeilen.map((z) => z.steuernKapital));
  });
});

describe('Vergleich der Varianten', () => {
  it('Ersparnis relativ zur Basis mit einem Bezug; nie negativ bei mehr Jahren', () => {
    const v = staffelVarianten(haushalt(), regeln, heute);
    expect(v[0]?.jahre).toBe(1);
    expect(v[0]?.ersparnis).toBe(0);
    expect(v.at(-1)?.ersparnis ?? 0).toBeGreaterThan(0);
    for (const x of v) expect(x.ersparnis).toBeGreaterThanOrEqual(-1);
    expect(v[2]?.bezuege.length).toBeGreaterThan(v[0]?.bezuege.length ?? 0);
  });
});
