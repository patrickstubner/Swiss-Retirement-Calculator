import { describe, expect, it } from 'vitest';
import {
  agEinfacheEinkommenssteuer,
  agEinfacheKapitalsteuer,
  agModell,
  bandTarif,
  interpoliereSatz,
  naeherungsModell,
  zhEinfacheEinkommenssteuer,
  zhEinfacheKapitalsteuer,
  zhEinfacheVermoegenssteuer,
  zhModell,
} from '../core/kantonsTarife';
import type { KantonSteuerEingabe } from '../core/typen';
import { gemeindenVon, KANTONE, KANTONS_DATEN, kantonNach, kantonsModellFuer } from './kantone';

const zh = KANTONS_DATEN.zh;
const ag = KANTONS_DATEN.ag;
const eingabe = (o: Partial<KantonSteuerEingabe>): KantonSteuerEingabe => ({
  kanton: '',
  gemeinde: '',
  kirche: 'keine',
  eigeneSaetze: false,
  einkommenSatz: 0,
  vermoegenPromille: 0,
  kapitalSatz: 0,
  ...o,
});

describe('Kantonsliste', () => {
  it('enthält alle 26 Kantone genau einmal; ZH und AG exakt, übrige Näherung', () => {
    expect(KANTONE).toHaveLength(26);
    expect(new Set(KANTONE.map((k) => k.code)).size).toBe(26);
    expect(kantonNach('ZH')?.status).toBe('exakt');
    expect(kantonNach('AG')?.status).toBe('exakt');
    expect(
      KANTONE.filter((k) => k.status === 'exakt')
        .map((k) => k.code)
        .sort(),
    ).toEqual(['AG', 'ZH']);
  });
  it('Gemeinden: ZH 160, AG 196, andere Kantone keine', () => {
    expect(gemeindenVon('ZH')).toHaveLength(160);
    expect(gemeindenVon('AG')).toHaveLength(196);
    expect(gemeindenVon('BE')).toHaveLength(0);
  });
});

describe('bandTarif', () => {
  it('rechnet Bandbreiten nacheinander', () => {
    expect(
      bandTarif(15000, [
        [10000, 0],
        [null, 10],
      ]),
    ).toBe(500);
    expect(bandTarif(-5, [[null, 10]])).toBe(0);
  });
});

/** Referenzfälle aus docs/kantone.md (ESTV-Steuerrechner 2026, frankengenau). */
describe('Zürich exakt (ESTV-Rechner 2026, Stadt Zürich, ohne Kirche)', () => {
  const stadt = zhModell(zh, 'Zürich', 'keine');
  it('Einkommen 100000 verheiratet: einfache Steuer 4743 → Staat 4506 + Gemeinde 5644', () => {
    expect(zhEinfacheEinkommenssteuer(100000, 'verheiratet', zh)).toBe(4743);
    expect(stadt.einkommenssteuer(100000, 'verheiratet')).toBe(4506 + 5644 + 48); // + Personalsteuer 2 × 24
  });
  it('Vermögen 500000 verheiratet: einfache Steuer 218', () => {
    expect(zhEinfacheVermoegenssteuer(500000, 'verheiratet', zh)).toBe(218);
  });
  it('Kapital 500000 verheiratet: 2%-Minimum → Staat 9500 + Gemeinde 11900', () => {
    expect(zhEinfacheKapitalsteuer(500000, 'verheiratet', zh)).toBe(10000);
    expect(stadt.kapitalleistungssteuer(500000, 'verheiratet')).toBe(9500 + 11900);
  });
  it('Kapital 2 Mio. verheiratet: Satz 4,743% → Staat 90117 + Gemeinde 112883', () => {
    expect(stadt.kapitalleistungssteuer(2_000_000, 'verheiratet')).toBe(90117 + 112883);
  });
  it('stimmt mit dem ESTV-Referenzraster (Kanton + Gemeinde) überein', () => {
    const ref = KANTONS_DATEN.kantone.find((k) => k.code === 'ZH');
    for (const z of ['ledig', 'verheiratet'] as const) {
      for (const p of ref?.referenzEstv2026.raster[z] ?? []) {
        const zs = z === 'ledig' ? 'alleinstehend' : 'verheiratet';
        expect(stadt.einkommenssteuer(p.steuerbaresEinkommen, zs) - p.personalsteuer).toBeCloseTo(
          p.einkommenKantonGemeinde,
          -1,
        );
        expect(stadt.vermoegenssteuer(p.steuerbaresVermoegen, zs)).toBeCloseTo(p.vermoegenKantonGemeinde, -1);
      }
    }
  });
  it('Gemeinde- und Kirchensteuerfuss werden berücksichtigt', () => {
    const mitKirche = zhModell(zh, 'Zürich', 'reformiert');
    expect(mitKirche.einkommenssteuer(100000, 'verheiratet')).toBe(4506 + 5644 + Math.round(4743 * 0.1) + 48);
    const guenstig = zhModell(zh, 'Zumikon', 'keine');
    expect(guenstig.einkommenssteuer(100000, 'verheiratet')).toBeLessThan(
      stadt.einkommenssteuer(100000, 'verheiratet'),
    );
  });
});

describe('Aargau exakt (ESTV-Rechner 2026, Aarau)', () => {
  it('Einkommen 100000 verheiratet, reformiert: einfach 4768 → Kanton 4911, Gemeinde 4577, Kirche 715', () => {
    expect(agEinfacheEinkommenssteuer(100000, 'verheiratet', ag)).toBe(4768);
    expect(agModell(ag, 'Aarau', 'reformiert').einkommenssteuer(100000, 'verheiratet')).toBe(4911 + 4577 + 715);
  });
  it('Einkommen 80000 ledig: einfache Steuer 5038', () => {
    expect(agEinfacheEinkommenssteuer(80000, 'alleinstehend', ag)).toBe(5038);
  });
  it('Kapital 500000 verheiratet: einfach 13353 → Kanton 13754', () => {
    expect(agEinfacheKapitalsteuer(500000, 'verheiratet', ag)).toBe(13353);
    expect(Math.round(13353 * 1.03)).toBe(13754);
  });
  it('Kapital 500000 ledig: einfach 14773', () => {
    expect(agEinfacheKapitalsteuer(500000, 'alleinstehend', ag)).toBe(14773);
  });
  it('Vermögen: Freibetrag 260000 (verheiratet) → darunter keine Steuer', () => {
    expect(agModell(ag, 'Aarau', 'keine').vermoegenssteuer(250000, 'verheiratet')).toBe(0);
    expect(agModell(ag, 'Aarau', 'keine').vermoegenssteuer(500000, 'verheiratet')).toBeGreaterThan(0);
  });
});

describe('Näherung übrige Kantone (ESTV-Referenzraster Hauptort)', () => {
  const be = KANTONS_DATEN.kantone.find((k) => k.code === 'BE');
  it('trifft die Stützpunkte genau und interpoliert dazwischen', () => {
    if (!be) throw new Error('BE fehlt');
    const m = naeherungsModell(be);
    const p = be.referenzEstv2026.raster.ledig[1];
    expect(m.einkommenssteuer(p?.steuerbaresEinkommen ?? 0, 'alleinstehend')).toBeCloseTo(
      (p?.einkommenKantonGemeinde ?? 0) + (p?.personalsteuer ?? 0),
      6,
    );
    const a = m.einkommenssteuer(100000, 'alleinstehend');
    const b = m.einkommenssteuer(150000, 'alleinstehend');
    const mitte = m.einkommenssteuer(125000, 'alleinstehend');
    expect(mitte).toBeGreaterThan(a);
    expect(mitte).toBeLessThan(b);
    expect(m.kapitalleistungssteuer(500000, 'verheiratet')).toBeCloseTo(500000 * 0.05497, 6);
  });
  it('Kapitalsatz ausserhalb der Stützpunkte konstant', () => {
    expect(interpoliereSatz(50, { '100': 2, '200': 4 })).toBe(2);
    expect(interpoliereSatz(150, { '100': 2, '200': 4 })).toBe(3);
    expect(interpoliereSatz(500, { '100': 2, '200': 4 })).toBe(4);
  });
  it('für alle 24 Näherungs-Kantone vorhanden und monoton', () => {
    for (const k of KANTONE.filter((x) => x.status === 'naeherung')) {
      const m = kantonsModellFuer(eingabe({ kanton: k.code }));
      expect(m.id).toBe(`${k.code}-naeherung`);
      expect(m.einkommenssteuer(200000, 'verheiratet')).toBeGreaterThan(m.einkommenssteuer(100000, 'verheiratet'));
      expect(m.kapitalleistungssteuer(500000, 'alleinstehend')).toBeGreaterThan(0);
    }
  });
});

describe('Modellwahl', () => {
  it('ohne Kanton oder mit «eigene Sätze» → effektive Sätze', () => {
    expect(kantonsModellFuer(eingabe({})).id).toBe('effektiv');
    expect(kantonsModellFuer(eingabe({ kanton: 'ZH', eigeneSaetze: true })).id).toBe('effektiv');
  });
  it('ZH/AG mit Gemeinde, Standard = Hauptort', () => {
    expect(kantonsModellFuer(eingabe({ kanton: 'ZH' })).id).toBe('ZH-Zürich');
    expect(kantonsModellFuer(eingabe({ kanton: 'ZH', gemeinde: 'Winterthur' })).id).toBe('ZH-Winterthur');
    expect(kantonsModellFuer(eingabe({ kanton: 'AG', gemeinde: 'Baden' })).id).toBe('AG-Baden');
    expect(kantonsModellFuer(eingabe({ kanton: 'AG', gemeinde: 'Gibtsnicht' })).id).toBe('AG-Aarau');
  });
});
