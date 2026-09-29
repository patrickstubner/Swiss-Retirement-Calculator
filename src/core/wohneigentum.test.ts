/**
 * Wohneigentum (Schema 7): Hebel auf dem Verkehrswert, separate Wohnkosten, Miete, Vermietung nach dem
 * Wegzug, Eigenmietwert bis 2028 und Verkauf mit Grundstückgewinnsteuer. Erfundene Beispielpersonen.
 */
import { describe, expect, it } from 'vitest';
import { neueAusgaben, neuePerson, neuesWohneigentum, neuesWohnen, standardHaushalt } from '../data/defaults';
import { KRISEN_DATEN, kriseNach, krisenOptionen } from '../data/krisen';
import { ladeRegeln } from '../rules';
import { ggstZH } from './grundstueckgewinn';
import type { Krise, KrisenOptionen } from './krisen';
import { simuliere } from './simulation';
import type { Haushalt, Person, Wohneigentum } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };
const KOSTEN = 0.005;

/** Pensionierte Beispielperson ohne Einkommen, Jg. 1950 (keine AHV-Beiträge mehr) */
function person(w: Partial<Wohneigentum> = {}, o: Partial<Person> = {}): Person {
  return neuePerson(regeln, {
    name: 'Beispiel',
    geburtsjahr: 1950,
    stoppAlter: 0,
    wertschriften: 100_000,
    wohneigentum: neuesWohneigentum(regeln, { vorhanden: true, verkehrswert: 1_000_000, hypothek: 400_000, ...w }),
    ...o,
  });
}

/** Ohne Steuern (effektive Sätze 0) und ohne Lebenshaltung – nur die Wohnrechnung wirkt */
function haushalt(p: Person, o: Partial<Haushalt> = {}): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    personen: [p],
    planungsalter: 90,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 0 },
    steuern: { ...h.steuern, eigeneSaetze: true, einkommenSatz: 0, vermoegenPromille: 0, kapitalSatz: 0 },
    annahmen: { ...h.annahmen, renditeNominal: 0.04, inflation: 0.01, kosten: KOSTEN, steuerbarerErtrag: 0 },
    krisen: { ...h.krisen, modus: 'keine' },
    ...o,
  };
}

const real = (nom: number, infl: number) => (1 + nom - KOSTEN) / (1 + infl) - 1;

describe('Hebel: Hauspreise wirken auf den ganzen Verkehrswert', () => {
  it('ohne Krise und ohne separate Wohnkosten rechnet alles wie bisher (Nettowert × Rendite)', () => {
    const mitHypo = simuliere(haushalt(person()), regeln, { start });
    const netto = simuliere(haushalt(person({ verkehrswert: 600_000, hypothek: 0 })), regeln, { start });
    mitHypo.zeilen.forEach((z, t) => {
      expect(z.toepfe.wohneigentum).toBeCloseTo(netto.zeilen[t]?.toepfe.wohneigentum ?? 0, 4);
    });
    expect(mitHypo.zeilen[0]?.toepfe.wohneigentum).toBeCloseTo(600_000 * (1 + real(0.04, 0.01)), 4);
  });

  it('in einem Krisenjahr verliert der Nettowert mit Hypothek mehr (Verkehrswert × Krise − Hypothek × normal)', () => {
    const krise = kriseNach('immobilienCh1990') as Krise;
    const opt: KrisenOptionen = {
      wahl: [{ krise, land: 'CHE', start: { art: 'jahr', jahr: 2027 } }],
      daten: KRISEN_DATEN,
      aktienanteil: 0.5,
    };
    const hist = KRISEN_DATEN.CHE.get(krise.von);
    if (!hist || hist.immobilien === null || hist.teuerung === null) throw new Error('Daten fehlen');
    const e = simuliere(haushalt(person()), regeln, { start, krisen: opt });
    const z0 = e.zeilen[0];
    const z1 = e.zeilen[1];
    if (!z0 || !z1) throw new Error('Zeilen fehlen');
    const V0 = 1_000_000 * (1 + real(0.04, 0.01));
    const H0 = 400_000 * (1 + real(0.04, 0.01));
    expect(z0.toepfe.wohneigentum).toBeCloseTo(V0 - H0, 4);
    const erwartet = V0 * (1 + real(hist.immobilien, hist.teuerung)) - H0 * (1 + real(0.04, hist.teuerung));
    expect(z1.toepfe.wohneigentum).toBeCloseTo(erwartet, 4);
    // ohne Hebel (nur Nettowert) wäre der Rückgang kleiner
    const ohneHebel = (V0 - H0) * (1 + real(hist.immobilien, hist.teuerung));
    if (hist.immobilien < 0.04) expect(z1.toepfe.wohneigentum).toBeLessThan(ohneHebel);
  });

  it('«Automatisch»: pauschale Hypothek wächst mit der Annahme, nicht mit der erhöhten Rendite der normalen Jahre', () => {
    const h = haushalt(person(), { krisen: { ...standardHaushalt(regeln).krisen, modus: 'automatisch' } });
    const e = simuliere(h, regeln, { start, krisen: krisenOptionen(h) });
    const normal = e.krisenNormal?.wohneigentum;
    if (normal === undefined) throw new Error('Ausgleich fehlt');
    expect(normal).toBeGreaterThan(0.04);
    const V0 = 1_000_000 * (1 + real(normal, 0.01));
    const H0 = 400_000 * (1 + real(0.04, 0.01));
    expect(e.zeilen[0]?.toepfe.wohneigentum).toBeCloseTo(V0 - H0, 4);
  });
});

describe('Separate Wohnkosten', () => {
  const sep = { wohnen: { ...neuesWohnen(), separat: true } };

  it('Standard: aus – Hypothekarzins und Unterhalt fliessen nicht in die Rechnung', () => {
    const e = simuliere(haushalt(person({ hypothekarzins: 0.02, unterhaltProzent: 0.01 })), regeln, { start });
    expect(e.zeilen.every((z) => z.wohnkosten === 0)).toBe(true);
  });

  it('Hypothekarzins auf der nominal fixen Hypothek, Unterhalt in % des Verkehrswerts oder in CHF', () => {
    const e = simuliere(haushalt(person({ hypothekarzins: 0.02, unterhaltProzent: 0.01 }), sep), regeln, { start });
    expect(e.zeilen[0]?.wohnkosten).toBeCloseTo(400_000 * 0.02 + 1_000_000 * 0.01, 4);
    const V1 = 1_000_000 * (1 + real(0.04, 0.01));
    expect(e.zeilen[1]?.wohnkosten).toBeCloseTo((400_000 / 1.01) * 0.02 + V1 * 0.01, 4);
    // Hypothek nominal fix: real sinkt sie mit der Teuerung, der Nettowert steigt entsprechend
    expect(e.zeilen[0]?.toepfe.wohneigentum).toBeCloseTo(V1 - 400_000 / 1.01, 4);
    const chf = simuliere(
      haushalt(person({ hypothekarzins: 0, unterhaltArt: 'chf', unterhaltChf: 12_000 }), sep),
      regeln,
      { start },
    );
    expect(chf.zeilen[3]?.wohnkosten).toBeCloseTo(12_000, 6);
  });

  it('Miete (heutige Franken) für Mieter bis zum Wegzug; danach über die Ausgaben im Zielland', () => {
    const p = neuePerson(regeln, {
      geburtsjahr: 1950,
      stoppAlter: 0,
      wertschriften: 1_000_000,
      wohnsitzAusland: {
        ...neuePerson(regeln).wohnsitzAusland,
        aktiv: true,
        modus: 'datum',
        datum: { jahr: 2031, monat: 1 },
        land: 'PT',
        barauszahlung: false,
      },
    });
    const e = simuliere(haushalt(p, { wohnen: { separat: true, mieteMonat: 2_000 } }), regeln, { start });
    expect(e.zeilen.find((z) => z.jahr === 2030)?.wohnkosten).toBeCloseTo(24_000, 6);
    expect(e.zeilen.find((z) => z.jahr === 2031)?.wohnkosten).toBe(0);
    const aus = simuliere(haushalt(p, { wohnen: { separat: false, mieteMonat: 2_000 } }), regeln, { start });
    expect(aus.zeilen[0]?.wohnkosten).toBe(0);
  });
});

describe('Verkauf der Liegenschaft', () => {
  const verkauf = (o: Partial<Wohneigentum['verkauf']> = {}): Partial<Wohneigentum> => ({
    verkauf: {
      ...neuesWohneigentum(regeln).verkauf,
      aktiv: true,
      zeitpunkt: 'datum',
      datum: { jahr: 2030, monat: 6 },
      anlagekosten: 600_000,
      kauf: { jahr: 2006, monat: 1 },
      verkaufskostenAnteil: 0.02,
      ...o,
    },
  });
  const zh = (p: Person, o: Partial<Haushalt> = {}) => {
    const h = haushalt(p, o);
    return { ...h, steuern: { ...h.steuern, kanton: 'ZH', gemeinde: 'Zürich', eigeneSaetze: false } };
  };

  it('ZH: Grundstückgewinnsteuer nach § 225 StG auf dem nominalen Gewinn, Hypothek zurück, Erlös in die Wertschriften', () => {
    const e = simuliere(zh(person(verkauf())), regeln, { start });
    const v = e.personen[0]?.verkauf;
    if (!v) throw new Error('kein Verkauf');
    const preisReal = 1_000_000 * (1 + real(0.04, 0.01)) ** 5;
    const preisNom = preisReal * 1.01 ** 5;
    expect(v.preisNominal).toBeCloseTo(preisNom, 2);
    expect(v.besitzjahre).toBe(24);
    const gewinn = preisNom * 0.98 - 600_000;
    expect(v.gewinnNominal).toBeCloseTo(gewinn, 2);
    expect(v.steuerNominal).toBeCloseTo(ggstZH(gewinn, 24, 293, regeln), 2);
    expect(v.steuerArt).toBe('ZH');
    expect(v.erloes).toBeCloseTo(preisReal * 0.98 - v.steuer - v.hypothek, 2);
    const z2030 = e.zeilen.find((z) => z.jahr === 2030);
    const z2031 = e.zeilen.find((z) => z.jahr === 2031);
    expect(z2030?.grundstueckgewinnsteuer).toBeCloseTo(v.steuer, 6);
    expect(z2030?.toepfe.wohneigentum).toBe(0);
    expect(z2031?.toepfe.wohneigentum).toBe(0);
    expect(v.hypothek).toBeCloseTo(400_000 * (1 + real(0.04, 0.01)) ** 5, 2);
  });

  it('Miete ab dem Verkaufsmonat, Hypothekarzins und Unterhalt bis dahin', () => {
    const p = person({ hypothekarzins: 0.02, unterhaltArt: 'chf', unterhaltChf: 12_000, ...verkauf() });
    const e = simuliere(zh(p, { wohnen: { separat: true, mieteMonat: 3_000 } }), regeln, { start });
    const z = e.zeilen.find((x) => x.jahr === 2030);
    const hypo2030 = 400_000 / 1.01 ** 4;
    expect(z?.wohnkosten).toBeCloseTo(5 * ((hypo2030 * 0.02) / 12 + 1_000) + 7 * 3_000, 4);
    expect(e.zeilen.find((x) => x.jahr === 2032)?.wohnkosten).toBeCloseTo(36_000, 6);
  });

  it('auch nach dem Wegzug fällt die Grundstückgewinnsteuer in der Schweiz an (Belegenheit)', () => {
    const p = person(verkauf({ zeitpunkt: 'wegzug' }), {
      wohnsitzAusland: {
        ...neuePerson(regeln).wohnsitzAusland,
        aktiv: true,
        modus: 'datum',
        datum: { jahr: 2031, monat: 3 },
        land: 'PT',
        barauszahlung: false,
      },
    });
    const e = simuliere(zh(p), regeln, { start });
    const v = e.personen[0]?.verkauf;
    expect(v?.monat).toEqual({ jahr: 2031, monat: 3 });
    expect(v?.steuer).toBeGreaterThan(0);
  });

  it('AG exakt nach § 109 StG AG, übrige Kantone als Näherung gekennzeichnet', () => {
    const ag = haushalt(person(verkauf()));
    const eAg = simuliere(
      { ...ag, steuern: { ...ag.steuern, kanton: 'AG', gemeinde: 'Aarau', eigeneSaetze: false } },
      regeln,
      { start },
    );
    const v = eAg.personen[0]?.verkauf;
    expect(v?.steuerArt).toBe('AG');
    expect(v?.steuerNominal).toBeCloseTo((v?.gewinnNominal ?? 0) * 0.06, 2);
    const be = haushalt(person(verkauf()));
    const eBe = simuliere(
      { ...be, steuern: { ...be.steuern, kanton: 'BE', gemeinde: '', eigeneSaetze: false } },
      regeln,
      { start },
    );
    expect(eBe.personen[0]?.verkauf?.steuerArt).toBe('naeherungZH');
    expect(eBe.personen[0]?.hinweise.some((x) => x.includes('Näherung mit dem Tarif des Kantons Zürich'))).toBe(true);
  });

  it('ohne Verkauf und ohne separate Wohnkosten bleibt das Ergebnis unverändert gegenüber Schema 6', () => {
    const alt = simuliere(haushalt(person()), regeln, { start });
    const neu = simuliere(haushalt(person(verkauf({ aktiv: false }))), regeln, { start });
    expect(neu.endVermoegen).toBeCloseTo(alt.endVermoegen, 6);
    expect(neu.personen[0]?.verkauf).toBeNull();
  });
});

describe('Steuern auf der Liegenschaft', () => {
  const zhSep = (p: Person) => {
    const h = haushalt(p, { wohnen: { separat: true, mieteMonat: 0 } });
    return {
      ...h,
      steuern: { ...h.steuern, kanton: 'ZH', gemeinde: 'Zürich', eigeneSaetze: false },
      annahmen: { ...h.annahmen, steuerbarerErtrag: 0.02 },
    };
  };

  it('Eigenmietwert (minus Zins und Unterhalt) bis Ende 2028 steuerbar, ab 2029 nicht mehr', () => {
    const ohne = simuliere(zhSep(person({ hypothekarzins: 0.01 })), regeln, { start });
    const mit = simuliere(zhSep(person({ hypothekarzins: 0.01, eigenmietwert: 30_000 })), regeln, { start });
    const j = (e: typeof ohne, jahr: number) => e.zeilen.find((z) => z.jahr === jahr)?.steuernEinkommen ?? 0;
    expect(j(mit, 2028)).toBeGreaterThan(j(ohne, 2028) + 1_000);
    expect(j(mit, 2029)).toBeCloseTo(j(ohne, 2029), 6);
  });

  it('Vermietung nach dem Wegzug: Mieteinnahmen fliessen zu, sind in der Schweiz steuerbar', () => {
    const wegzug = {
      ...neuePerson(regeln).wohnsitzAusland,
      aktiv: true,
      modus: 'datum' as const,
      datum: { jahr: 2027, monat: 1 },
      land: 'PT',
      barauszahlung: false,
    };
    const leer = simuliere(zhSep(person({ hypothekarzins: 0.01 }, { wohnsitzAusland: wegzug })), regeln, { start });
    const verm = simuliere(
      zhSep(
        person(
          { hypothekarzins: 0.01, nachWegzug: 'vermietet', mieteinnahmenMonat: 3_000 },
          { wohnsitzAusland: wegzug },
        ),
      ),
      regeln,
      { start },
    );
    const z = (e: typeof leer) => e.zeilen.find((x) => x.jahr === 2030);
    expect(z(verm)?.mieteinnahmen).toBeCloseTo(36_000, 6);
    expect(z(leer)?.mieteinnahmen).toBe(0);
    expect((z(verm)?.steuernEinkommen ?? 0) - (z(leer)?.steuernEinkommen ?? 0)).toBeGreaterThan(1_000);
  });
});
