/**
 * Todesfall-Szenario (Schema 9). Erfundenes Paar «Person A/B», Fantasiezahlen. Regeln und Rechenbeispiele
 * aus MB 3.03 (Stand 1.1.2026), MB 3.01, Art. 19/21 BVG, Art. 24b AHVG; siehe docs/quellen.md Abschnitt 15.
 */
import { describe, expect, it } from 'vitest';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { kantonsModellFuer } from '../data/kantone';
import { ladeRegeln } from '../rules';
import { simuliere } from './simulation';
import { dbgEinkommen } from './steuern';
import {
  AUSGABEN_FAKTOR_STANDARD,
  ahvHinterlassenenAnspruch,
  bvgEhegattenAnspruch,
  hinterlassenenrenteHoeher,
  mitVerwitwetenzuschlag,
  pkEhegattenrenteJahr,
  pkInvalidenrenteJahr,
  todeszeitpunkt,
  witwenrenteMonat,
} from './todesfall';
import type { Haushalt, Todesfall } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

const tf = (o: Partial<Todesfall> = {}): Todesfall => ({
  aktiv: true,
  person: 0,
  modus: 'alter',
  alter: 80,
  jahr: 2040,
  ausgabenFaktor: 1,
  ehejahre: 30,
  kinder: false,
  splitting: false,
  ...o,
});

/**
 * Person A (Jg. 1958, 68, AHV 2520, PK-Rente 30 000 CHF/Jahr) und Person B (Jg. 1961, 65, AHV 1500, keine PK),
 * beide bereits pensioniert; Vermögen in Wertschriften, Ausgaben 60 000.
 */
function paar(o: { rendite?: number; ausgaben?: number } = {}): Haushalt {
  const h = standardHaushalt(regeln);
  const a = neuePerson(regeln, { name: 'Person A', geburtsjahr: 1958, geburtsmonat: 3, geschlecht: 'm', lohn: 0 });
  a.stoppAlter = 0;
  a.ahv = { ...a.ahv, modus: 'eingabe', renteMonat: 2520, beitragsjahre: 44 };
  a.pk = { ...a.pk, guthaben: 500_000, umwandlungssatz: 0.06, kapitalanteil: 0, fruehestesAlter: 60, bezugsAlter: 65 };
  a.wertschriften = 800_000;
  const b = neuePerson(regeln, { name: 'Person B', geburtsjahr: 1961, geburtsmonat: 9, geschlecht: 'w', lohn: 0 });
  b.stoppAlter = 0;
  b.ahv = { ...b.ahv, modus: 'eingabe', renteMonat: 1500, beitragsjahre: 44 };
  b.wertschriften = 100_000;
  return {
    ...h,
    zivilstand: 'verheiratet',
    personen: [a, b],
    planungsalter: 95,
    ausgaben: { ...neueAusgaben(), lebenshaltung: o.ausgaben ?? 60_000, faktorAb75: 1, faktorAb85: 1 },
    annahmen: { ...h.annahmen, renditeNominal: o.rendite ?? 0.03, inflation: 0.01, steuerbarerErtrag: 0.01 },
    steuern: { ...h.steuern, kanton: 'ZH', gemeinde: 'Zürich' },
    krisen: { ...h.krisen, modus: 'keine' },
  };
}

describe('Regeln mit Quellen (MB 3.03, MB 3.01, BVG)', () => {
  it('Regelwerte stehen mit Quelle in 2026.json', () => {
    expect(regeln.todesfall.ahvWitwenrenteAnteil).toBe(0.8);
    expect(regeln.todesfall.bvgEhegattenrente.anteil).toBe(0.6);
    expect(regeln.todesfall.bvgEhegattenrente.abfindungJahresrenten).toBe(3);
    expect(regeln.ahv.verwitwetenzuschlag).toBe(0.2);
  });

  it('Witwenrente = 80 % der Altersrente: MB 3.03 Anhang, Skala 44 (Beispiel Ziff. 23: 69 552 CHF → 1 790 CHF)', () => {
    // Tabelle: Altersrente 2 238 → Witwenrente 1 790 (80 % = 1 790.4); Minimum 1 260 → 1 008; Maximum 2 520 → 2 016
    expect(Math.round(witwenrenteMonat(2238, regeln))).toBe(1790);
    expect(witwenrenteMonat(1260, regeln)).toBe(1008);
    expect(witwenrenteMonat(2520, regeln)).toBe(2016);
  });

  it('AHV-Anspruch: Witwe mit 45 und 5 Ehejahren oder mit Kind; Witwer nur mit Kind (MB 3.03 Ziff. 1/3)', () => {
    expect(ahvHinterlassenenAnspruch({ geschlecht: 'w' }, 45, 5, false, regeln)).toBe(true);
    expect(ahvHinterlassenenAnspruch({ geschlecht: 'w' }, 44, 30, false, regeln)).toBe(false);
    expect(ahvHinterlassenenAnspruch({ geschlecht: 'w' }, 60, 4, false, regeln)).toBe(false);
    expect(ahvHinterlassenenAnspruch({ geschlecht: 'w' }, 30, 2, true, regeln)).toBe(true);
    expect(ahvHinterlassenenAnspruch({ geschlecht: 'm' }, 70, 40, false, regeln)).toBe(false);
    expect(ahvHinterlassenenAnspruch({ geschlecht: 'm' }, 50, 10, true, regeln)).toBe(true);
  });

  it('BVG-Anspruch (Art. 19): Kinder oder 45 Jahre und 5 Ehejahre, Frau und Mann gleich', () => {
    expect(bvgEhegattenAnspruch(45, 5, false, regeln)).toBe(true);
    expect(bvgEhegattenAnspruch(44, 30, false, regeln)).toBe(false);
    expect(bvgEhegattenAnspruch(30, 1, true, regeln)).toBe(true);
  });

  it('Verwitwetenzuschlag: 20 % der eigenen Rente, zusammen höchstens die Maximalrente (MB 3.01 Ziff. 25)', () => {
    expect(mitVerwitwetenzuschlag(2000, 2520, regeln)).toBeCloseTo(2400, 6);
    expect(mitVerwitwetenzuschlag(2300, 2520, regeln)).toBe(2520);
    expect(mitVerwitwetenzuschlag(2520, 2520, regeln)).toBe(2520);
  });

  it('Vergleich Art. 24b AHVG: Altersrente inkl. 13. Rente gegen 12 Witwenrenten (BSV/akbern-Beispiel: 12 × 1 281 < 13 × 1 184)', () => {
    expect(hinterlassenenrenteHoeher(1184, 0, 1281, regeln)).toBe(false); // 15 372 < 15 392
    expect(hinterlassenenrenteHoeher(1184, 0, 1300, regeln)).toBe(true); // 15 600 > 15 392
  });

  it('PK: 60 % der Alters- bzw. Invalidenrente (Art. 21 BVG); Invalidenrente ohne Zinsen (Art. 24)', () => {
    expect(pkEhegattenrenteJahr(30_000, regeln)).toBe(18_000);
    expect(pkInvalidenrenteJahr(500_000, 20_000, 5, 0.06)).toBeCloseTo(36_000, 6);
  });

  it('Todeszeitpunkt: Alter oder Jahr; nur bei Ehepaaren; frühestens im Startmonat', () => {
    const h = paar();
    const z = todeszeitpunkt(h, tf({ alter: 80 }), 2026 * 12);
    expect(z).toEqual({ tot: 0, lebt: 1, idx: 1958 * 12 + 2 + 80 * 12 + 1 });
    expect(todeszeitpunkt(h, tf({ modus: 'jahr', jahr: 2040, person: 1 }), 2026 * 12)?.idx).toBe(2040 * 12 + 6);
    expect(todeszeitpunkt(h, tf({ modus: 'jahr', jahr: 2020 }), 2026 * 12)?.idx).toBe(2026 * 12);
    expect(todeszeitpunkt(h, tf({ aktiv: false }), 0)).toBeNull();
    expect(todeszeitpunkt({ ...h, zivilstand: 'alleinstehend' }, tf(), 0)).toBeNull();
    expect(AUSGABEN_FAKTOR_STANDARD).toBe(0.67);
  });
});

describe('Regression: ohne Todesfall unverändert', () => {
  it('ohne Option und mit inaktivem Szenario identisch', () => {
    const h = paar();
    const a = simuliere(h, regeln, { start });
    const b = simuliere(h, regeln, { start, todesfall: tf({ aktiv: false }) });
    expect(b.zeilen).toEqual(a.zeilen);
    expect(b.endVermoegen).toBe(a.endVermoegen);
    expect(a.todesfall).toBeUndefined();
  });

  it('Tod nach dem Planungshorizont ändert nichts', () => {
    const h = paar();
    const a = simuliere(h, regeln, { start });
    const b = simuliere(h, regeln, { start, todesfall: tf({ alter: 110 }) });
    expect(b.endVermoegen).toBeCloseTo(a.endVermoegen, 6);
    expect(b.zeilen.map((z) => z.steuernEinkommen)).toEqual(a.zeilen.map((z) => z.steuernEinkommen));
  });

  it('bei einer alleinstehenden Person wirkt das Szenario nicht', () => {
    const h = { ...paar(), zivilstand: 'alleinstehend' as const, personen: [paar().personen[0] as never] };
    const a = simuliere(h, regeln, { start });
    const b = simuliere(h, regeln, { start, todesfall: tf() });
    expect(b.zeilen).toEqual(a.zeilen);
  });
});

describe('Szenario: Person A stirbt mit 80 (2038)', () => {
  const h = paar();
  const ohne = simuliere(h, regeln, { start });
  const mit = simuliere(h, regeln, { start, todesfall: tf({ person: 0, alter: 80 }) });
  const jahr = 1958 + 80; // 2038
  const zeile = (e: typeof mit, j: number) => e.zeilen.find((z) => z.jahr === j)!;

  it('Todesjahr markiert, Info gesetzt', () => {
    expect(mit.zeilen.filter((z) => z.todesjahr).map((z) => z.jahr)).toEqual([jahr]);
    expect(mit.todesfall?.ueberlebend).toBe(1);
    expect(mit.todesfall?.jahr).toBe(jahr);
    expect(mit.todesfall?.alterUeberlebend).toBe(76);
  });

  it('bis zum Todesjahr identisch', () => {
    for (const z of ohne.zeilen.filter((x) => x.jahr < jahr)) {
      expect(zeile(mit, z.jahr).vermoegen).toBeCloseTo(z.vermoegen, 4);
    }
  });

  it('AHV der überlebenden Person: Witwenrente 80 % von A (2016) > eigene Altersrente mit Zuschlag (1800)', () => {
    const info = mit.todesfall!;
    expect(info.ahvAnspruch).toBe(true);
    expect(info.ahvWitwenrenteMonat).toBeCloseTo(0.8 * 2520, 6);
    expect(info.ahvAltersrenteMonat).toBeCloseTo(1.2 * 1500, 6);
    // Ab dem Folgejahr: 12 × 2016 (keine 13. Zahlung) statt 13 × 1500-Basis
    const z = zeile(mit, jahr + 2);
    expect(z.ahv).toBeCloseTo(12 * 2016, 0);
  });

  it('PK-Ehegattenrente 60 % der laufenden Rente (nominal fix)', () => {
    expect(mit.todesfall!.pkAnspruch).toBe(true);
    // Nominal fix: 60 % der zuletzt ausgerichteten Rente, in Franken des jeweiligen Jahres
    const vor = zeile(ohne, jahr - 1);
    const nach = zeile(mit, jahr + 1);
    expect(nach.pkRente * nach.indexBeginn).toBeCloseTo(0.6 * vor.pkRente * vor.indexBeginn, 0);
  });

  it('Ausgaben sinken um den Faktor (Standard 0,67) ab dem Folgemonat', () => {
    const m = simuliere(h, regeln, { start, todesfall: tf({ ausgabenFaktor: 0.67 }) });
    expect(zeile(m, jahr + 2).lebenshaltung).toBeCloseTo(0.67 * 60_000, 4);
    expect(zeile(m, jahr - 1).lebenshaltung).toBeCloseTo(60_000, 4);
  });

  it('Steuern: Todesjahr Verheiratetentarif, danach Alleinstehendentarif (auf demselben Einkommen höher)', () => {
    const hh = { ...h, annahmen: { ...h.annahmen, steuerbarerErtrag: 0 } };
    const e = simuliere(hh, regeln, { start, todesfall: tf({ person: 0, alter: 80 }) });
    const kanton = kantonsModellFuer(hh.steuern);
    const steuer = (s: number, zs: 'verheiratet' | 'alleinstehend') =>
      dbgEinkommen(s, zs, regeln.steuern) + kanton.einkommenssteuer(s, zs);
    const vor = e.zeilen.find((z) => z.jahr === jahr - 1)!;
    const nach = e.zeilen.find((z) => z.jahr === jahr + 2)!;
    expect(vor.steuernEinkommen).toBeCloseTo(steuer(vor.ahv + vor.pkRente, 'verheiratet'), 4);
    expect(nach.steuernEinkommen).toBeCloseTo(steuer(nach.ahv + nach.pkRente, 'alleinstehend'), 4);
    // Todesjahr: noch gemeinsam veranlagt
    const tj = e.zeilen.find((z) => z.jahr === jahr)!;
    expect(tj.steuernEinkommen).toBeCloseTo(steuer(tj.ahv + tj.pkRente, 'verheiratet'), 4);
  });

  it('Endvermögen mit Todesfall niedriger als ohne (weniger Einkommen, Ausgaben unverändert)', () => {
    expect(mit.endVermoegen).toBeLessThan(ohne.endVermoegen);
  });

  it('mit tieferen Ausgaben nach dem Tod reicht das Geld länger', () => {
    const teuer = simuliere(paar({ ausgaben: 150_000 }), regeln, { start, todesfall: tf({ ausgabenFaktor: 1 }) });
    const guenstig = simuliere(paar({ ausgaben: 150_000 }), regeln, { start, todesfall: tf({ ausgabenFaktor: 0.67 }) });
    expect(guenstig.endVermoegen).toBeGreaterThan(teuer.endVermoegen);
  });
});

describe('Szenario: Person B stirbt', () => {
  it('B (Frau, ohne PK) stirbt mit 70: A behält seine Rente, die Plafonierung entfällt, der Zuschlag gilt nicht über dem Maximum', () => {
    const h = paar();
    const e = simuliere(h, regeln, { start, todesfall: tf({ person: 1, alter: 70 }) });
    const j = 1961 + 70;
    const z = e.zeilen.find((x) => x.jahr === j + 2)!;
    // A hat 2 520 = Maximalrente: Witwerrente ohne Kinder nicht möglich; Altersrente 2 520 (Zuschlag begrenzt)
    expect(e.todesfall?.ahvAnspruch).toBe(false);
    expect(z.ahv).toBeCloseTo(13 * 2520, 0);
  });

  it('Plafonierung entfällt: vor dem Tod 3 780 gedeckelt, danach nur noch eine Rente', () => {
    const h = paar();
    const ohne = simuliere(h, regeln, { start });
    // vor dem Tod von B: 2 520 + 1 500 = 4 020 > 3 780 → plafoniert
    const z0 = ohne.zeilen.find((x) => x.jahr === 2032)!;
    // Rentenzuschlag (Übergangsgeneration Jg. 1961) kommt dazu, ist aber nicht plafoniert
    expect(z0.ahv).toBeGreaterThanOrEqual(13 * 3780);
    expect(z0.ahv).toBeLessThan(13 * 3780 + 12 * 160);
  });

  it('Witwe mit 45+ und 5 Ehejahren erhält die Witwenrente, wenn sie höher ist als die eigene Altersrente', () => {
    const h = paar();
    // B (Frau) überlebt A: Witwenrente 2 016 > 1 500 × 1,2 = 1 800; Jahressumme 12 × 2 016 = 24 192 > 13 × 1 800 = 23 400
    const e = simuliere(h, regeln, { start, todesfall: tf({ person: 0, alter: 75 }) });
    expect(e.todesfall?.ahvAnspruch).toBe(true);
  });

  it('Witwer ohne Kinder: kein Anspruch; mit Kindern: Anspruch (MB 3.03 Ziff. 3)', () => {
    const h = paar();
    h.personen = [
      { ...h.personen[0]!, geschlecht: 'w' },
      { ...h.personen[1]!, geschlecht: 'm' },
    ];
    const ohneKind = simuliere(h, regeln, { start, todesfall: tf({ person: 0, alter: 75 }) });
    const mitKind = simuliere(h, regeln, { start, todesfall: tf({ person: 0, alter: 75, kinder: true }) });
    expect(ohneKind.todesfall?.ahvAnspruch).toBe(false);
    expect(mitKind.todesfall?.ahvAnspruch).toBe(true);
  });
});

describe('PK: Abfindung, Kapital, Freizügigkeit und 3a', () => {
  it('ohne Anspruch (Ehe zu kurz, keine Kinder): Abfindung von drei Jahresrenten als Kapital', () => {
    const h = paar();
    const e = simuliere(h, regeln, { start, todesfall: tf({ person: 0, alter: 75, ehejahre: 0 }) });
    // Ehejahre 0 + Zeit bis zum Tod > 5 → doch Anspruch; deshalb Tod früh
    const frueh = simuliere(h, regeln, { start, todesfall: tf({ person: 0, modus: 'jahr', jahr: 2026, ehejahre: 2 }) });
    expect(frueh.todesfall?.pkAnspruch).toBe(false);
    expect(frueh.todesfall?.pkAbfindung).toBeCloseTo(3 * frueh.todesfall!.pkEhegattenrenteJahr, 6);
    expect(e.todesfall?.pkAnspruch).toBe(true);
  });

  it('Freizügigkeit und 3a der verstorbenen Person fliessen der überlebenden Person als Kapital zu', () => {
    const h = paar();
    const a = h.personen[0]!;
    a.geburtsjahr = 1972;
    a.freizuegigkeit = { ...a.freizuegigkeit, guthaben: 100_000, bezugsAlter: 70 };
    a.saeule3a = { ...a.saeule3a, guthaben: 80_000, bezugsAlter: 70 };
    a.pk = { ...a.pk, guthaben: 0 };
    const e = simuliere(h, regeln, { start, todesfall: tf({ person: 0, modus: 'jahr', jahr: 2026 }) });
    expect(e.todesfall?.kapitalFzUnd3a).toBeCloseTo(180_000, -3);
    const z = e.zeilen[0]!;
    expect(z.kapitalBezuege).toBeGreaterThan(170_000);
    expect(z.steuernKapital).toBeGreaterThan(0);
  });
});

describe('Konsistenz mit Wohnkanton und Stiftungssitz (Schema 10)', () => {
  const mitKapital = () => {
    const h = paar();
    const a = h.personen[0]!;
    a.geburtsjahr = 1972;
    a.freizuegigkeit = { ...a.freizuegigkeit, guthaben: 100_000, bezugsAlter: 70 };
    a.saeule3a = { ...a.saeule3a, guthaben: 80_000, bezugsAlter: 70 };
    a.pk = { ...a.pk, guthaben: 0 };
    return h;
  };
  const steuerTodesjahr = (h: Haushalt) =>
    simuliere(h, regeln, { start, todesfall: tf({ person: 0, modus: 'jahr', jahr: 2026 }) }).zeilen[0]!.steuernKapital;

  it('überlebende Person wohnt in der Schweiz: ein Stiftungssitz in ZG ändert die Kapitalsteuer nicht (Art. 4b StHG)', () => {
    const ohneSitz = mitKapital();
    const mitSitz = mitKapital();
    for (const p of mitSitz.personen) {
      p.wohnsitzAusland = { ...p.wohnsitzAusland, sitzkantonVorsorge: 'ZG', sitzkantonFz: 'ZG', sitzkanton3a: 'SZ' };
    }
    expect(steuerTodesjahr(mitSitz)).toBe(steuerTodesjahr(ohneSitz));
  });

  it('der Wohnkanton bestimmt die Steuer auf das ans überlebende Ehepaar-Mitglied fliessende Kapital', () => {
    const zh = mitKapital();
    const zg = mitKapital();
    zg.steuern = { ...zg.steuern, kanton: 'ZG', gemeinde: '' };
    expect(steuerTodesjahr(zg)).toBeLessThan(steuerTodesjahr(zh));
  });

  it('lebt die überlebende Person im Ausland, gilt der Quellensteuertarif des Sitzkantons (ZG 5 % statt ZH 6 %)', () => {
    const mk = (sitz: string) => {
      const h = mitKapital();
      for (const p of h.personen)
        p.wohnsitzAusland = {
          ...p.wohnsitzAusland,
          aktiv: true,
          modus: 'datum',
          datum: { jahr: 2026, monat: 1 },
          land: 'BR',
          barauszahlung: false,
          sitzkantonVorsorge: sitz,
        };
      return h;
    };
    expect(steuerTodesjahr(mk('ZG'))).toBeLessThan(steuerTodesjahr(mk('')));
  });
});

describe('Wegzug', () => {
  it('nach dem Wegzug der überlebenden Person: Hinterlassenenrente wird weiter gerechnet, keine Ergänzungsleistungen (Hinweis)', () => {
    const h = paar();
    const b = h.personen[1]!;
    b.wohnsitzAusland = {
      ...b.wohnsitzAusland,
      aktiv: true,
      modus: 'datum',
      datum: { jahr: 2027, monat: 1 },
      land: 'PT',
    };
    const a = h.personen[0]!;
    a.wohnsitzAusland = {
      ...a.wohnsitzAusland,
      aktiv: true,
      modus: 'datum',
      datum: { jahr: 2027, monat: 1 },
      land: 'PT',
    };
    const e = simuliere(h, regeln, { start, todesfall: tf({ person: 0, alter: 75 }) });
    expect(e.todesfall?.hinweise.some((x) => x.includes('Ergänzungsleistungen'))).toBe(true);
    const z = e.zeilen.find((x) => x.jahr === 1958 + 77)!;
    expect(z.ahv).toBeGreaterThan(20_000);
  });
});

describe('Monte Carlo und Krisen bleiben konsistent', () => {
  it('mit Krisenmodell wird derselbe Todesfall gerechnet (Info gesetzt, Vermögen endlich)', () => {
    const h = paar();
    const e = simuliere(h, regeln, {
      start,
      todesfall: tf(),
      renditeModell: {
        art: 'test',
        renditeNominal: () => 0.02,
        inflation: () => 0.01,
      } as never,
    });
    expect(e.todesfall).not.toBeNull();
    expect(Number.isFinite(e.endVermoegen)).toBe(true);
  });
});
