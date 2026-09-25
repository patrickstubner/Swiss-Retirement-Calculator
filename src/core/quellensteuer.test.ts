import { describe, expect, it } from 'vitest';
import { standardHaushalt } from '../data/defaults';
import { kantonsModellFuer } from '../data/kantone';
import { ladeRegeln } from '../rules';
import {
  qstKantonTarif,
  quellensteuerBundKapital,
  quellensteuerKapital,
  quellensteuerRenteSatz,
  stufenSteuer,
  tabellenSatz,
} from './quellensteuer';

const regeln = ladeRegeln(2026);
const modell = (kanton: string) =>
  kantonsModellFuer({
    ...standardHaushalt(regeln).steuern,
    kanton,
    gemeinde: '',
    kirche: 'keine',
    eigeneSaetze: false,
  });

describe('Quellensteuer auf Vorsorgekapital (Wohnsitz im Ausland)', () => {
  it('Bund: Teilbetragstarif QStV Anhang Ziff. 3 (150 000 alleinstehend = 1 425, wie Tarif TG 2026)', () => {
    expect(quellensteuerBundKapital(150_000, 'alleinstehend', regeln)).toBeCloseTo(1425, 6);
    // 150 000 + 600 000 × 2,6 % = 17 025; darüber 2,3 % auf dem Mehrbetrag
    expect(quellensteuerBundKapital(750_000, 'alleinstehend', regeln)).toBeCloseTo(17_025, 6);
    expect(quellensteuerBundKapital(850_000, 'alleinstehend', regeln)).toBeCloseTo(17_025 + 2300, 6);
    // Verheiratete: 25 000 × (0,15 + 0,5 + 0,8) %
    expect(quellensteuerBundKapital(100_000, 'verheiratet', regeln)).toBeCloseTo(362.5, 6);
    expect(quellensteuerBundKapital(20_000, 'alleinstehend', regeln)).toBe(0);
  });

  it('flacher Kantonssatz (ZH 6 %) plus Bundesteil', () => {
    const q = quellensteuerKapital(200_000, 'alleinstehend', 'ZH', regeln, modell('ZH'));
    expect(q.kanton).toBeCloseTo(12_000, 6);
    expect(q.bund).toBeCloseTo(1425 + 50_000 * 0.026, 6);
    expect(q.total).toBeCloseTo(q.bund + q.kanton, 6);
    expect(q.naeherung).toBe(false);
  });

  it('Teilbetragstarif BS: 3 % / 4 % / 6 % / 8 %', () => {
    // 25 000 × 3 % + 25 000 × 4 % + 50 000 × 6 % + 50 000 × 8 %
    expect(quellensteuerKapital(150_000, 'alleinstehend', 'BS', regeln, undefined).kanton).toBeCloseTo(
      750 + 1000 + 3000 + 4000,
      6,
    );
    expect(
      stufenSteuer(10_000, [
        [25_000, 0.03],
        [null, 0.08],
      ]),
    ).toBeCloseTo(300, 6);
  });

  it('FR: Abzug für Verheiratete vor dem Stufentarif', () => {
    const t = qstKantonTarif(regeln, 'FR');
    expect(t?.art).toBe('stufen');
    const ledig = quellensteuerKapital(100_000, 'alleinstehend', 'FR', regeln, undefined).kanton;
    const verh = quellensteuerKapital(100_000, 'verheiratet', 'FR', regeln, undefined).kanton;
    expect(ledig).toBeCloseTo(50_000 * 0.02 + 50_000 * 0.04, 6);
    expect(verh).toBeCloseTo(50_000 * 0.02 + 40_000 * 0.04, 6);
  });

  it('SH: Satz inklusive Bundessteuer → kein separater Bundesteil', () => {
    const q = quellensteuerKapital(100_000, 'alleinstehend', 'SH', regeln, undefined);
    expect(q.bund).toBe(0);
    expect(q.kanton).toBeCloseTo(7000, 6);
  });

  it('AG exakt nach Anhang 3 QStV-AG 2026 (Satz auf dem ganzen Betrag, Bundesteil eingerechnet)', () => {
    const t = qstKantonTarif(regeln, 'AG');
    expect(t?.art).toBe('tabelle');
    // Tarif A: 149 001–154 000 → 5,9 %; Tarif B: 97 001–101 000 → 3,3 %
    const a = quellensteuerKapital(150_000, 'alleinstehend', 'AG', regeln, undefined);
    expect(a.total).toBeCloseTo(150_000 * 0.059, 6);
    expect(a.bund).toBeCloseTo(1425, 6);
    expect(a.naeherung).toBe(false);
    expect(quellensteuerKapital(100_000, 'verheiratet', 'AG', regeln, undefined).total).toBeCloseTo(3300, 6);
    // Grenzen: bis 18 000 1,0 %, ab 18 001 1,1 %; über 1 Mio. 8,8 % (A) bzw. 8,4 % (B)
    expect(quellensteuerKapital(18_000, 'alleinstehend', 'AG', regeln, undefined).total).toBeCloseTo(180, 6);
    expect(quellensteuerKapital(18_001, 'alleinstehend', 'AG', regeln, undefined).total).toBeCloseTo(18_001 * 0.011, 6);
    expect(quellensteuerKapital(2_000_000, 'alleinstehend', 'AG', regeln, undefined).total).toBeCloseTo(176_000, 6);
    expect(quellensteuerKapital(2_000_000, 'verheiratet', 'AG', regeln, undefined).total).toBeCloseTo(168_000, 6);
    // unter 1 000 im Kalenderjahr keine Quellensteuer
    expect(quellensteuerKapital(999, 'alleinstehend', 'AG', regeln, undefined).total).toBe(0);
  });

  it('übrige progressive Kantone aus den ESTV-Tarifdateien 2026 (keine Näherung mehr)', () => {
    expect(tabellenSatz('BL', 10_000, 'alleinstehend')).toBeCloseTo(0.032, 9);
    expect(tabellenSatz('VD', 3000, 'alleinstehend')).toBe(0);
    expect(tabellenSatz('VD', 3001, 'alleinstehend')).toBeCloseTo(0.0072, 9);
    expect(tabellenSatz('SO', 10_000, 'verheiratet')).toBe(0);
    expect(tabellenSatz('ZH', 10_000, 'alleinstehend')).toBeUndefined();
    for (const k of ['AG', 'BL', 'GE', 'JU', 'NE', 'SO', 'VS', 'VD']) {
      expect(qstKantonTarif(regeln, k)?.art).toBe('tabelle');
      let vorher = 0;
      for (const betrag of [5000, 50_000, 150_000, 500_000, 2_000_000]) {
        const q = quellensteuerKapital(betrag, 'alleinstehend', k, regeln, modell(k));
        expect(q.naeherung).toBe(false);
        expect(q.total / betrag).toBeLessThan(0.11);
        expect(q.total).toBeGreaterThanOrEqual(vorher);
        vorher = q.total;
      }
    }
    // TI: 3,58 % + Bundestarif (ESTV-Datei)
    const ti = quellensteuerKapital(150_000, 'alleinstehend', 'TI', regeln, undefined);
    expect(ti.total).toBeCloseTo(150_000 * 0.0358 + 1425, 6);
  });

  it('Quellensteuer auf Vorsorgerenten: Satz des Sitzkantons inkl. 1 % DBSt, VS nach Rentenhöhe', () => {
    expect(quellensteuerRenteSatz(regeln, 'ZH', 30_000)).toBeCloseTo(0.07, 9);
    expect(quellensteuerRenteSatz(regeln, 'AG', 30_000)).toBeCloseTo(0.08, 9);
    expect(quellensteuerRenteSatz(regeln, 'VS', 30_000)).toBeCloseTo(0.09, 9);
    expect(quellensteuerRenteSatz(regeln, 'VS', 60_000)).toBeCloseTo(0.15, 9);
    expect(quellensteuerRenteSatz(regeln, 'VS', 90_000)).toBeCloseTo(0.21, 9);
    expect(quellensteuerRenteSatz(regeln, '', 30_000)).toBeUndefined();
  });

  it('unbekannter Kanton: ordentliche Kapitalleistungssteuer als Näherung; 0 bei Betrag 0', () => {
    const q = quellensteuerKapital(100_000, 'alleinstehend', '', regeln, modell('ZH'));
    expect(q.naeherung).toBe(true);
    expect(q.kanton).toBeCloseTo(modell('ZH').kapitalleistungssteuer(100_000, 'alleinstehend'), 6);
    expect(quellensteuerKapital(0, 'alleinstehend', 'ZH', regeln, undefined).total).toBe(0);
  });

  it('alle 26 Kantone haben einen Tarif', () => {
    const codes = 'AG AI AR BE BL BS FR GE GL GR JU LU NE NW OW SG SH SO SZ TG TI UR VD VS ZG ZH'.split(' ');
    for (const k of codes) expect(qstKantonTarif(regeln, k), k).toBeDefined();
  });
});
