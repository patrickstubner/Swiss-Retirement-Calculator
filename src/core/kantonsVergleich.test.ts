import { describe, expect, it } from 'vitest';
import { standardHaushalt } from '../data/defaults';
import { KANTONE, KAPITAL_KANTONE } from '../data/kantone';
import { ladeRegeln } from '../rules';
import {
  freizuegigkeitStrategie,
  KANTONS_CODES,
  kantonsVergleich,
  kapitalSteuerQuelle,
  kapitalSteuerWohnsitz,
  sortiert,
} from './kantonsVergleich';

const regeln = ladeRegeln(2026);
const basis = standardHaushalt(regeln).steuern;

describe('Kapitalbezug Wohnsitz Schweiz (ESTV-Rechner 2026, Hauptort, ohne Kirche)', () => {
  it('deckt alle 26 Kantone ab, in Daten und Kantonsliste', () => {
    expect(KANTONS_CODES).toHaveLength(26);
    expect([...KANTONS_CODES].sort()).toEqual(KANTONE.map((k) => k.code).sort());
    expect(Object.keys(KAPITAL_KANTONE.kantone).sort()).toEqual([...KANTONS_CODES].sort());
  });

  it('trifft die ESTV-Stützpunkte bei 1 Mio. (alleinstehend) auf den Franken', () => {
    const erwartet: Record<string, number> = { AI: 30_400, ZG: 38_552, SZ: 42_750, NW: 34_095, GE: 58_069 };
    for (const [k, v] of Object.entries(erwartet))
      expect(kapitalSteuerWohnsitz(k, 1_000_000, 'alleinstehend', regeln, basis).kanton).toBeCloseTo(v, 0);
  });

  it('Plausibilität: AI ≈ 53 400 und ZH ≈ 109 500 (ohne Kirche) bei 1 Mio.; Bund 23 000', () => {
    const ai = kapitalSteuerWohnsitz('AI', 1_000_000, 'alleinstehend', regeln, basis);
    const zh = kapitalSteuerWohnsitz('ZH', 1_000_000, 'alleinstehend', regeln, basis);
    expect(ai.bund).toBe(23_000);
    expect(Math.round(ai.total)).toBe(53_400);
    expect(Math.abs(zh.total - 109_542)).toBeLessThan(2);
    expect(zh.total).toBeGreaterThan(ai.total * 2);
  });

  it('ZH und AG bleiben exakte Modelle, die übrigen 24 folgen den ESTV-Stützpunkten', () => {
    for (const k of KANTONS_CODES) {
      if (k === 'ZH' || k === 'AG') continue;
      const pts = KAPITAL_KANTONE.kantone[k]?.alleinstehend ?? [];
      for (const [b, kan] of pts) {
        if (b === undefined || kan === undefined) continue;
        expect(kapitalSteuerWohnsitz(k, b, 'alleinstehend', regeln, basis).kanton).toBeCloseTo(kan, 0);
      }
    }
  });

  it('Sortierung aufsteigend; AI ist am günstigsten, Rang 1', () => {
    const z = sortiert(kantonsVergleich(1_000_000, 'alleinstehend', regeln, basis), 'wohnsitz');
    expect(z).toHaveLength(26);
    expect(z[0]?.code).toBe('AI');
    for (let i = 1; i < z.length; i++)
      expect((z[i] as (typeof z)[number]).wohnsitz.total).toBeGreaterThanOrEqual(
        (z[i - 1] as (typeof z)[number]).wohnsitz.total,
      );
  });

  it('Verheiratete zahlen in ZH weniger (Splitting) als Alleinstehende', () => {
    const a = kapitalSteuerWohnsitz('ZH', 1_000_000, 'alleinstehend', regeln, basis).total;
    const v = kapitalSteuerWohnsitz('ZH', 1_000_000, 'verheiratet', regeln, basis).total;
    expect(v).toBeLessThan(a);
  });

  it('Betrag 0 → 0', () => {
    expect(kapitalSteuerWohnsitz('ZH', 0, 'alleinstehend', regeln, basis).total).toBe(0);
    expect(kapitalSteuerQuelle('ZG', 0, 'alleinstehend', regeln, basis).total).toBe(0);
  });
});

describe('Quellensteuer nach Sitzkanton (ESTV-Übersicht 2026)', () => {
  it('ZG 5 %, SZ 2,5 %, NW 3 % plus Bund (QStV-Teilbetragstarif: 22 775 bei 1 Mio.)', () => {
    const zg = kapitalSteuerQuelle('ZG', 1_000_000, 'alleinstehend', regeln, basis);
    expect(zg.kanton).toBeCloseTo(50_000, 6);
    expect(zg.bund).toBeCloseTo(22_775, 6); // 17 025 + 250 000 × 2,3 %
    expect(kapitalSteuerQuelle('SZ', 1_000_000, 'alleinstehend', regeln, basis).kanton).toBeCloseTo(25_000, 6);
    expect(kapitalSteuerQuelle('NW', 1_000_000, 'alleinstehend', regeln, basis).kanton).toBeCloseTo(30_000, 6);
  });

  it('die Quellensteuer hängt vom Sitz ab, die ordentliche Steuer nur vom Wohnkanton (Sitz spielt keine Rolle)', () => {
    const z = kantonsVergleich(500_000, 'alleinstehend', regeln, basis);
    const zh = z.find((x) => x.code === 'ZH');
    const zg = z.find((x) => x.code === 'ZG');
    expect(zh?.quelle.total).not.toBe(zg?.quelle.total);
    expect(zh?.wohnsitz.total).toBe(kapitalSteuerWohnsitz('ZH', 500_000, 'alleinstehend', regeln, basis).total);
  });
});

describe('Strategie «Freizügigkeit in Tiefsteuerkanton»', () => {
  it('bei Wohnsitz in der Schweiz ist die Ersparnis 0 (Art. 4b StHG), nach Wegzug positiv gegenüber ZH', () => {
    const s = freizuegigkeitStrategie(1_000_000, 'alleinstehend', regeln, basis, 'ZH', '');
    expect(s.map((x) => x.sitz)).toEqual(['ZG', 'SZ', 'NW']);
    for (const x of s) {
      expect(x.bleibtInCh.ersparnis).toBe(0);
      expect(x.nachWegzug.ersparnis).toBeGreaterThan(0);
    }
    // ZH 6 % gegen SZ 2,5 % auf 1 Mio. → 35 000
    expect(s.find((x) => x.sitz === 'SZ')?.nachWegzug.ersparnis).toBeCloseTo(35_000, 6);
    expect(s.find((x) => x.sitz === 'ZG')?.nachWegzug.ersparnis).toBeCloseTo(10_000, 6);
  });

  it('Wohnsitzverlegung vor dem Bezug wirkt nur in der Schweiz (Ordentliche Steuer)', () => {
    const s = freizuegigkeitStrategie(1_000_000, 'alleinstehend', regeln, basis, 'ZH', '');
    const zg = s.find((x) => x.sitz === 'ZG');
    expect(zg?.wohnsitzVerlegen.ersparnis).toBeGreaterThan(40_000);
  });
});
