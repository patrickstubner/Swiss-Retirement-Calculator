import { describe, expect, it } from 'vitest';
import { standardHaushalt } from '../data/defaults';
import { kantonsModellFuer } from '../data/kantone';
import { ladeRegeln } from '../rules';
import { qstKantonTarif, quellensteuerBundKapital, quellensteuerKapital, stufenSteuer } from './quellensteuer';

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

  it('progressiver Tarif: Näherung, auf die publizierte Bandbreite begrenzt', () => {
    const t = qstKantonTarif(regeln, 'BL');
    if (t?.art !== 'progressiv') throw new Error('BL sollte progressiv sein');
    for (const betrag of [10_000, 300_000, 5_000_000]) {
      const q = quellensteuerKapital(betrag, 'alleinstehend', 'BL', regeln, modell('BL'));
      expect(q.naeherung).toBe(true);
      expect(q.kanton / betrag).toBeGreaterThanOrEqual(t.min - 1e-12);
      expect(q.kanton / betrag).toBeLessThanOrEqual((t.max ?? 1) + 1e-12);
    }
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
