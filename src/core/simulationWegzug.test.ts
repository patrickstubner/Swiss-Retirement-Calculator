/**
 * Barauszahlung bei endgültigem Wegzug (Art. 5 Abs. 1 lit. a FZG, Art. 25f FZG,
 * Art. 3 Abs. 2 lit. d BVV 3) und Quellensteuer. Erfundene Beispielperson, Fantasiezahlen.
 */
import { describe, expect, it } from 'vitest';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { quellensteuerBundKapital, quellensteuerKapital } from './quellensteuer';
import { obligatoriumsAnteilBei } from './schaetzwerte';
import { simuliere } from './simulation';
import type { Haushalt, Person, WohnsitzAusland } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/** «Beispiel-Person», Jg. 1980 (heute 45), ohne Lohn, PK 300 000 (davon BVG 120 000), FZ 20 000, 3a 50 000. */
function person(w: Partial<WohnsitzAusland> | null, o: Partial<Person> = {}): Person {
  const p = neuePerson(regeln, {
    name: 'Beispiel-Person',
    geburtsjahr: 1980,
    geburtsmonat: 6,
    lohn: 0,
    stoppAlter: 0,
    wertschriften: 500_000,
  });
  p.ahv.renteMonat = 2000;
  p.pk = { ...p.pk, guthaben: 300_000, bvgGuthaben: 120_000, kapitalanteil: 0, fruehestesAlter: 60 };
  p.freizuegigkeit = { ...p.freizuegigkeit, guthaben: 20_000 };
  p.saeule3a = { ...p.saeule3a, guthaben: 50_000 };
  const res = { ...p, ...o };
  if (w)
    res.wohnsitzAusland = {
      ...p.wohnsitzAusland,
      aktiv: true,
      modus: 'datum',
      datum: { jahr: 2028, monat: 1 },
      land: 'TH',
      barauszahlung: true,
      ...w,
    };
  return res;
}

function haushalt(p: Person, kanton = 'ZH'): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    personen: [p],
    planungsalter: 90,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 30_000, faktorAb75: 1, faktorAb85: 1 },
    steuern: { ...h.steuern, kanton },
  };
}

const zeile = (e: ReturnType<typeof simuliere>, jahr: number) => {
  const z = e.zeilen.find((x) => x.jahr === jahr);
  if (!z) throw new Error(`Jahr ${jahr} fehlt`);
  return z;
};

describe('Barauszahlung bei Wegzug – ausserhalb EU/EFTA', () => {
  it('gibt PK, Freizügigkeit und 3a mit 47 frei (vor 58, trotz Reglementsalter 60) – keine PK-Rente', () => {
    const e = simuliere(haushalt(person({})), regeln, { start });
    const info = e.personen[0];
    const bar = info?.barauszahlung;
    expect(bar?.monat).toEqual({ jahr: 2028, monat: 1 });
    expect(bar?.voll).toBe(true);
    expect(bar?.pkGesperrt).toBe(0);
    expect(bar?.pk).toBeGreaterThan(300_000 * 0.97);
    expect(bar?.freizuegigkeit).toBeGreaterThan(19_000);
    expect(bar?.saeule3a).toBeGreaterThan(49_000);
    expect(info?.pkStart).toEqual({ jahr: 2028, monat: 1 });
    expect(info?.pkRenteJahr).toBe(0);
    const z = zeile(e, 2028);
    expect(z.kapitalBezuege).toBeCloseTo((bar?.pk ?? 0) + (bar?.freizuegigkeit ?? 0) + (bar?.saeule3a ?? 0), 0);
    expect(z.gebunden).toBe(0);
    expect(e.zeilen.every((x) => x.pkRente === 0)).toBe(true);
    expect(info?.hinweise.some((t) => t.includes('Erwerbsaufgabe vor dem frühesten PK-Bezugsalter'))).toBe(false);
  });

  it('ohne Wegzug bzw. mit ausgeschalteter Barauszahlung bleibt alles bis zum Reglementsalter gesperrt', () => {
    for (const p of [person(null), person({ barauszahlung: false })]) {
      const e = simuliere(haushalt(p), regeln, { start });
      expect(e.personen[0]?.barauszahlung).toBeNull();
      expect(zeile(e, 2028).kapitalBezuege).toBe(0);
      expect(e.personen[0]?.pkStart.jahr).toBe(1980 + 60);
    }
  });

  it('Wegzug in der Vergangenheit: Freigabe ab heute', () => {
    const e = simuliere(haushalt(person({ datum: { jahr: 2020, monat: 3 } })), regeln, { start });
    expect(e.personen[0]?.barauszahlung?.monat).toEqual(start);
  });

  it('ohne Zielland keine Barauszahlung, mit Hinweis', () => {
    const e = simuliere(haushalt(person({ land: '' })), regeln, { start });
    expect(e.personen[0]?.barauszahlung).toBeNull();
    expect(e.personen[0]?.hinweise.some((t) => t.includes('bitte das Land wählen'))).toBe(true);
  });

  it('Wegzug erst nach dem Reglementsalter: Altersleistung, keine Barauszahlung der PK', () => {
    const p = person({}, { geburtsjahr: 1965 }); // heute 60, Reglement 60
    const e = simuliere(haushalt(p), regeln, { start });
    expect(e.personen[0]?.barauszahlung?.pk ?? 0).toBe(0);
    expect(e.personen[0]?.hinweise.some((t) => t.includes('Art. 2 Abs. 1bis FZG'))).toBe(true);
  });
});

describe('Barauszahlung bei Wegzug – EU/EFTA (Art. 25f FZG)', () => {
  it('nur das Überobligatorium wird bar ausbezahlt; das Obligatorium bleibt als Freizügigkeit gesperrt', () => {
    const e = simuliere(haushalt(person({ land: 'PT' })), regeln, { start });
    const info = e.personen[0];
    const bar = info?.barauszahlung;
    expect(bar?.euEfta).toBe(true);
    expect(bar?.voll).toBe(false);
    // ohne Lohn keine Gutschriften → Anteil = 120 000 / 300 000
    expect(bar?.anteilObligatorium).toBeCloseTo(0.4, 6);
    const total = (bar?.pk ?? 0) + (bar?.pkGesperrt ?? 0);
    expect((bar?.pkGesperrt ?? 0) / total).toBeCloseTo(0.4, 6);
    expect(bar?.freizuegigkeit).toBe(0); // bestehendes FZ-Guthaben bleibt gesperrt
    expect(bar?.saeule3a).toBeGreaterThan(49_000); // 3a: Art. 25f betrifft nur das BVG-Guthaben
    const z = zeile(e, 2028);
    expect(z.kapitalBezuege).toBeCloseTo((bar?.pk ?? 0) + (bar?.saeule3a ?? 0), 0);
    expect(z.toepfe.freizuegigkeit).toBeGreaterThan(bar?.pkGesperrt ?? 0);
    // Freizügigkeit (inkl. gesperrtem Obligatorium) frühestens 5 Jahre vor dem Referenzalter
    expect(info?.freizuegigkeitStart.jahr).toBe(1980 + 60);
    expect(e.zeilen.every((x) => x.pkRente === 0)).toBe(true);
  });

  it('«im neuen Land nicht obligatorisch versichert»: Vollbezug inkl. Freizügigkeit', () => {
    const e = simuliere(haushalt(person({ land: 'PT', nichtObligatorischVersichert: true })), regeln, { start });
    const bar = e.personen[0]?.barauszahlung;
    expect(bar?.voll).toBe(true);
    expect(bar?.pkGesperrt).toBe(0);
    expect(bar?.freizuegigkeit).toBeGreaterThan(19_000);
    expect(zeile(e, 2028).gebunden).toBe(0);
  });

  it('obligatoriumsAnteilBei: Gutschriften bis zum Wegzugsjahr erhöhen den BVG-Anteil', () => {
    const p = person(null, { lohn: 80_000 });
    p.pk = { ...p.pk, sparbeitragJahr: 0 };
    const a2026 = obligatoriumsAnteilBei(p, regeln, start, 2026, 0.01);
    const a2030 = obligatoriumsAnteilBei(p, regeln, start, 2030, 0.01);
    expect(a2026).toBeCloseTo(0.4, 6);
    expect(a2030).toBeGreaterThan(a2026);
    expect(a2030).toBeLessThanOrEqual(1);
  });
});

describe('Besteuerung der Barauszahlung: Quellensteuer statt Kapitalleistungssteuer des Wohnkantons', () => {
  it('Bund (QStV-Tarif) + Sitzkanton der Vorsorgeeinrichtung (SZ 2,5 %)', () => {
    const e = simuliere(haushalt(person({ sitzkantonVorsorge: 'SZ' })), regeln, { start });
    const z = zeile(e, 2028);
    const k = z.kapitalBezuege;
    const erwartet = quellensteuerBundKapital(k, 'alleinstehend', regeln) + k * 0.025;
    expect(z.steuernKapital).toBeCloseTo(erwartet, 2);
    expect(e.personen[0]?.quellensteuerKapital).toBeCloseTo(erwartet, 2);
    expect(e.personen[0]?.hinweise.some((t) => t.includes('Thailand: Quellensteuer rückforderbar'))).toBe(true);
  });

  it('ohne Sitzkanton gilt der Wohnkanton (ZH 6 %)', () => {
    const e = simuliere(haushalt(person({})), regeln, { start });
    const z = zeile(e, 2028);
    const q = quellensteuerKapital(z.kapitalBezuege, 'alleinstehend', 'ZH', regeln, undefined);
    expect(z.steuernKapital).toBeCloseTo(q.total, 2);
  });

  it('Kapitalbezug vor dem Wegzug bleibt bei der ordentlichen Kapitalleistungssteuer', () => {
    // Wegzug erst mit 62, ordentlicher Bezug mit 60 in der Schweiz
    const p = person({ datum: { jahr: 2042, monat: 7 } });
    const e = simuliere(haushalt(p), regeln, { start });
    expect(e.personen[0]?.barauszahlung).toBeNull();
    expect(e.personen[0]?.quellensteuerKapital).toBe(0);
  });
});

describe('Steuern nach dem Wegzug (Zielland statt Schweizer Einkommens-/Vermögenssteuer)', () => {
  const ohneBar = { barauszahlung: false };
  it('VAE: ab dem Wegzug keine Einkommens- und Vermögenssteuer mehr', () => {
    const e = simuliere(haushalt(person({ ...ohneBar, land: 'AE' })), regeln, { start });
    expect(zeile(e, 2027).steuernVermoegen).toBeGreaterThan(0);
    expect(zeile(e, 2029).steuernEinkommen).toBe(0);
    expect(zeile(e, 2029).steuernVermoegen).toBe(0);
    expect(e.personen[0]?.zielland?.jahr).toBe(2028);
  });

  it('Land ohne Modell (anderes Land): weiter Schweizer Steuern, mit eigenem Satz das Zielland', () => {
    const ch = simuliere(haushalt(person({ ...ohneBar, land: 'XX' })), regeln, { start });
    expect(zeile(ch, 2029).steuernVermoegen).toBeGreaterThan(0);
    expect(ch.personen[0]?.hinweise.some((x) => x.includes('kein Steuermodell'))).toBe(true);
    const eigen = simuliere(haushalt(person({ ...ohneBar, land: 'XX', steuerSatzZielland: 0.1 })), regeln, { start });
    expect(zeile(eigen, 2029).steuernVermoegen).toBe(0);
    expect(zeile(eigen, 2029).steuernEinkommen).toBeGreaterThan(0);
  });

  it('Wegzugsjahr anteilig: Wegzug per 1. Juli halbiert die Schweizer Vermögenssteuer', () => {
    const ganz = simuliere(haushalt(person(null)), regeln, { start });
    const halb = simuliere(haushalt(person({ ...ohneBar, land: 'AE', datum: { jahr: 2028, monat: 7 } })), regeln, {
      start,
    });
    expect(zeile(halb, 2028).steuernVermoegen).toBeCloseTo(zeile(ganz, 2028).steuernVermoegen / 2, 0);
  });

  it('PK-Rente nach Wegzug in die VAE: Schweizer Quellensteuer des Sitzkantons (ZH 7 %)', () => {
    const p = person({ ...ohneBar, land: 'AE', datum: { jahr: 2026, monat: 1 } });
    const e = simuliere(haushalt(p), regeln, { start });
    const info = e.personen[0];
    expect(info?.pkRenteJahr).toBeGreaterThan(0);
    // ab Reglementsalter 60 (2040): Rente × 7 %
    expect(zeile(e, 2045).steuernEinkommen).toBeCloseTo(zeile(e, 2045).pkRente * 0.07, 6);
    expect(info?.quellensteuerRente).toBeGreaterThan(0);
  });

  it('Portugal: keine Quellensteuer auf der PK-Rente, dafür IRS', () => {
    const p = person({ ...ohneBar, land: 'PT', datum: { jahr: 2026, monat: 1 } });
    const e = simuliere(haushalt(p), regeln, { start });
    expect(e.personen[0]?.quellensteuerRente).toBe(0);
    expect(zeile(e, 2050).steuernEinkommen).toBeGreaterThan(0);
  });

  it('Rückforderung der Kapital-Quellensteuer: Italien 5 % statt Quellensteuer; ohne bekannten Satz keine Rückforderung', () => {
    const it5 = simuliere(
      haushalt(person({ land: 'IT', qstKapitalRueckforderung: true, nichtObligatorischVersichert: true })),
      regeln,
      { start },
    );
    const i = it5.personen[0];
    const kapital =
      (i?.barauszahlung?.pk ?? 0) + (i?.barauszahlung?.freizuegigkeit ?? 0) + (i?.barauszahlung?.saeule3a ?? 0);
    expect(i?.quellensteuerKapitalRueckforderung).toBeGreaterThan(0);
    expect(i?.quellensteuerKapital).toBe(0);
    expect(i?.kapitalSteuerZielland).toBeCloseTo(kapital * 0.05, 0);
    const pt = simuliere(haushalt(person({ land: 'PT', qstKapitalRueckforderung: true })), regeln, { start });
    expect(pt.personen[0]?.quellensteuerKapital).toBeGreaterThan(0);
    expect(pt.personen[0]?.hinweise.some((x) => x.includes('Rückforderung nicht gerechnet'))).toBe(true);
    const ptEigen = simuliere(
      haushalt(
        person({
          land: 'PT',
          qstKapitalRueckforderung: true,
          steuerSatzKapitalZielland: 0.02,
          nichtObligatorischVersichert: true,
        }),
      ),
      regeln,
      { start },
    );
    expect(ptEigen.personen[0]?.kapitalSteuerZielland).toBeCloseTo(kapital * 0.02, 0);
    // VAE: laut ESTV 2-217 nicht rückforderbar
    const ae = simuliere(haushalt(person({ land: 'AE', qstKapitalRueckforderung: true })), regeln, { start });
    expect(ae.personen[0]?.quellensteuerKapitalRueckforderung).toBe(0);
  });
});

describe('Liechtenstein (Art. 25f Abs. 1 lit. c FZG)', () => {
  it('Obligatorium bleibt immer gesperrt, auch mit «nicht obligatorisch versichert»', () => {
    const e = simuliere(haushalt(person({ land: 'LI', nichtObligatorischVersichert: true })), regeln, { start });
    const bar = e.personen[0]?.barauszahlung;
    expect(bar?.voll).toBe(false);
    expect(bar?.pkGesperrt).toBeGreaterThan(0);
    // 3a trotzdem ganz frei (BSV-Mitteilungen Nr. 96 Rz 567)
    expect(bar?.saeule3a).toBeGreaterThan(49_000);
  });
});
