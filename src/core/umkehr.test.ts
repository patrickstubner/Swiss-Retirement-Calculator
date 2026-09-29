import { describe, expect, it } from 'vitest';
import { AUSGABENKURVE } from '../data/ausgabenkurve';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { KRISEN_DATEN, krisenOptionen, mcKrisenPool } from '../data/krisen';
import { ladeRegeln } from '../rules';
import { lebenshaltungImJahr } from './ausgaben';
import { monteCarlo } from './montecarlo';
import { simuliere, startvermoegen } from './simulation';
import type { Haushalt } from './typen';
import {
  ausgabenPhasen,
  kurvenAnteil,
  mitUmkehrAusgaben,
  phasenAbHeute,
  type UmkehrEinstellung,
  umkehrrechnung,
  zielVermoegen,
} from './umkehr';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };

/** Erfundenes Beispiel: Person Jg. 1960 (im Ruhestand), 1,2 Mio. Wertschriften, AHV 2'200/Monat */
function haushalt(): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Muster',
    geburtsjahr: 1960,
    geburtsmonat: 4,
    lohn: 0,
    wertschriften: 1_200_000,
  });
  return {
    ...h,
    personen: [{ ...p, ahv: { ...p.ahv, renteMonat: 2_200 }, manuell: { ...p.manuell, ahvRente: true } }],
    ausgaben: { ...h.ausgaben, lebenshaltung: 60_000 },
    planungsalter: 95,
  };
}

const basisE = (x: Partial<UmkehrEinstellung> = {}): UmkehrEinstellung => ({
  variante: 'konstant',
  kurve: AUSGABENKURVE,
  pflege: false,
  ziel: { art: 'betrag', betrag: 0 },
  methode: { art: 'deterministisch' },
  ...x,
});

describe('Ausgabenkurve', () => {
  it('Anteile Go-go 100 %, Slow-go 85 %, No-go 75 % nach Alter', () => {
    expect(kurvenAnteil(AUSGABENKURVE, 66)).toBe(1);
    expect(kurvenAnteil(AUSGABENKURVE, 74)).toBe(1);
    expect(kurvenAnteil(AUSGABENKURVE, 75)).toBe(0.85);
    expect(kurvenAnteil(AUSGABENKURVE, 84)).toBe(0.85);
    expect(kurvenAnteil(AUSGABENKURVE, 85)).toBe(0.75);
    expect(kurvenAnteil(AUSGABENKURVE, 110)).toBe(0.75);
  });

  it('baut Phasen nach Alter der Referenzperson, Pflege mit Vorrang', () => {
    const h = haushalt();
    const e = basisE({ variante: 'kurve', pflege: true });
    const hh = mitUmkehrAusgaben(h, 80_000, e);
    const betrag = (alter: number) => lebenshaltungImJahr(hh.ausgaben, 1960 + alter, hh.personen, alter).betrag;
    expect(betrag(70)).toBe(80_000);
    expect(betrag(80)).toBeCloseTo(68_000, 6);
    expect(betrag(90)).toBeCloseTo(60_000, 6);
    // Pflege: die letzten 2 Jahre vor dem Planungsalter 95 → Alter 93 und 94
    expect(betrag(93)).toBeCloseTo(60_000 + AUSGABENKURVE.pflegeBetragJahr, 6);
    expect(betrag(94)).toBeCloseTo(60_000 + AUSGABENKURVE.pflegeBetragJahr, 6);
    expect(betrag(95)).toBeCloseTo(60_000, 6);
    expect(hh.ausgaben.faktorAb75).toBe(1);
    // Konstant: eine Phase
    expect(ausgabenPhasen(h, 50_000, basisE())).toHaveLength(1);
  });

  it('Phasen zum Übernehmen beginnen beim heutigen Alter, Beträge auf 100 gerundet', () => {
    const ph = phasenAbHeute(haushalt(), 71_234, basisE({ variante: 'kurve' }), 2026);
    expect(ph.map((p) => [p.von, p.bis])).toEqual([
      [66, 74],
      [75, 84],
      [85, null],
    ]);
    expect(ph.map((p) => p.betrag)).toEqual([71_200, 60_500, 53_400]);
  });

  it('Ziel: Betrag oder Kaufkraft ± g pro Jahr', () => {
    expect(zielVermoegen({ art: 'betrag', betrag: 100_000 }, 2e6, 30)).toBe(100_000);
    expect(zielVermoegen({ art: 'wachstum', rate: 0 }, 2e6, 30)).toBe(2e6);
    expect(zielVermoegen({ art: 'wachstum', rate: 0.001 }, 2e6, 30)).toBeCloseTo(2e6 * 1.001 ** 30, 4);
    expect(zielVermoegen({ art: 'wachstum', rate: -0.01 }, 2e6, 10)).toBeCloseTo(2e6 * 0.99 ** 10, 4);
  });
});

describe('Umkehrrechnung deterministisch', () => {
  it('findet die Grenze: knapp darunter reicht es, knapp darüber nicht', () => {
    const h = haushalt();
    const r = umkehrrechnung(h, regeln, start, basisE());
    expect(r.erreichbar).toBe(true);
    expect(r.basis).toBeGreaterThan(40_000);
    expect(r.basis % 100).toBe(0);
    const unten = simuliere(mitUmkehrAusgaben(h, r.basis, basisE()), regeln, { start });
    const oben = simuliere(mitUmkehrAusgaben(h, r.basis + 200, basisE()), regeln, { start });
    expect(unten.erfolg).toBe(true);
    expect(oben.erfolg).toBe(false);
    expect(r.phasen).toHaveLength(1);
    expect(r.phasen[0]?.monat).toBeCloseTo(r.basis / 12, 6);
  });

  it('Ziel «Kaufkraft erhalten» erlaubt weniger Ausgaben als «Rest 0», das Endvermögen erreicht das Startvermögen', () => {
    const h = haushalt();
    const null0 = umkehrrechnung(h, regeln, start, basisE());
    const kk = umkehrrechnung(h, regeln, start, basisE({ ziel: { art: 'wachstum', rate: 0 } }));
    expect(kk.basis).toBeLessThan(null0.basis);
    expect(kk.zielReal).toBeCloseTo(startvermoegen(h), 6);
    expect(kk.ergebnis.endVermoegen).toBeGreaterThanOrEqual(kk.zielReal - 1);
    const plus = umkehrrechnung(h, regeln, start, basisE({ ziel: { art: 'wachstum', rate: 0.001 } }));
    expect(plus.basis).toBeLessThanOrEqual(kk.basis);
  });

  it('Kurve: Go-go-Betrag über dem konstanten Betrag; Pflege senkt ihn', () => {
    const h = haushalt();
    const k = umkehrrechnung(h, regeln, start, basisE());
    const kurve = umkehrrechnung(h, regeln, start, basisE({ variante: 'kurve' }));
    const pflege = umkehrrechnung(h, regeln, start, basisE({ variante: 'kurve', pflege: true }));
    expect(kurve.basis).toBeGreaterThan(k.basis);
    expect(pflege.basis).toBeLessThan(kurve.basis);
    expect(kurve.phasen.map((p) => p.label)).toEqual(AUSGABENKURVE.phasen.map((p) => p.label));
    expect(pflege.phasen.find((p) => p.pflege)?.vonAlter).toBe(93);
    expect(pflege.phasen.find((p) => p.pflege)?.bisAlter).toBe(94);
    // Pflege mitten im No-go: No-go wird geteilt
    const mitte = umkehrrechnung(h, regeln, start, basisE({ variante: 'kurve', pflege: true, pflegeAb: 88 }));
    expect(mitte.phasen.map((p) => [p.vonAlter, p.bisAlter, p.pflege])).toEqual([
      [66, 74, false],
      [75, 84, false],
      [85, 87, false],
      [88, 89, true],
      [90, 95, false],
    ]);
  });

  it('bezieht das Krisenszenario ein (Automatisch: weniger als ohne Krise)', () => {
    const h = haushalt();
    const ohne = umkehrrechnung(h, regeln, start, basisE());
    const hk: Haushalt = { ...h, krisen: { ...h.krisen, modus: 'automatisch' } };
    const mit = umkehrrechnung(
      h,
      regeln,
      start,
      basisE({ methode: { art: 'deterministisch', krisen: krisenOptionen(hk) } }),
    );
    expect(mit.basis).not.toBe(ohne.basis);
    const e = simuliere(mitUmkehrAusgaben(h, mit.basis, basisE()), regeln, { start, krisen: krisenOptionen(hk) });
    expect(e.erfolg).toBe(true);
  });

  it('meldet «nicht erreichbar», wenn selbst ohne Lebenshaltung das Ziel verfehlt wird', () => {
    const r = umkehrrechnung(haushalt(), regeln, start, basisE({ ziel: { art: 'betrag', betrag: 1e9 } }));
    expect(r.erreichbar).toBe(false);
    expect(r.basis).toBe(0);
  });
});

describe('Umkehrrechnung Monte Carlo', () => {
  it('erreicht die Mindestquote beim gefundenen Betrag, bei höherem nicht', () => {
    const h = haushalt();
    const einstellung = {
      art: 'wiederkehrend' as const,
      laeufe: 40,
      seed: 5,
      krisenProDekade: 0.74,
      blockLaenge: 5,
      bootstrapLand: 'CHE' as const,
    };
    const pool = mcKrisenPool();
    const methode = { art: 'montecarlo' as const, quote: 0.9, einstellung, daten: KRISEN_DATEN, pool };
    const r = umkehrrechnung(h, regeln, start, basisE({ methode }));
    expect(r.erreichbar).toBe(true);
    expect(r.quote).toBeGreaterThanOrEqual(0.9);
    const q = (b: number) =>
      monteCarlo(mitUmkehrAusgaben(h, b, basisE()), regeln, start, einstellung, KRISEN_DATEN, pool).erfolgsquote;
    expect(q(r.basis)).toBeGreaterThanOrEqual(0.9);
    expect(q(r.basis + 1_000)).toBeLessThan(0.9);
    // 90 % Sicherheit verlangt weniger als die deterministische Rechnung ohne Krise
    expect(r.basis).toBeLessThan(umkehrrechnung(h, regeln, start, basisE()).basis);
  });
});
