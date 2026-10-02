/**
 * Regeljahr 2027 (Vorbereitung): Nur amtlich bestätigte Werte sind «verifiziert»; alles andere führt den Wert 2026
 * fort und ist «offen». Quelle: EFD-Vorabdruck der Verordnung über die kalte Progression (VKP), Teuerung 0.47 %.
 */
import { describe, expect, it } from 'vitest';
import { dbgEinkommen, wendeTarifAn } from '../core/steuern';
import json2027 from './2027.json';
import { anzahlFortgeschrieben, ladeRegeln, pruefeRegeln, regelEintraege, regelJahrStatus } from './index';

const r26 = ladeRegeln(2026);
const r27 = ladeRegeln(2027);

describe('rules/2027.json', () => {
  it('ist strukturell gültig und wird für 2027 geladen, 2026 bleibt unverändert', () => {
    expect(pruefeRegeln(json2027)).toEqual([]);
    expect(r27.meta.jahr).toBe(2027);
    expect(r26.meta.jahr).toBe(2026);
    expect(regelJahrStatus(2027).fehlt).toBe(false);
    expect(regelJahrStatus(2028)).toEqual({ angefragt: 2028, verwendet: 2027, fehlt: true });
  });

  it('DBG-Tarif Alleinstehende 2027: Stützpunkte laut VKP-Vorabdruck', () => {
    const t = r27.steuern.dbgTarifAlleinstehend;
    expect(wendeTarifAn(15300, t)).toBe(0);
    expect(wendeTarifAn(33400, t)).toBeCloseTo(139.35, 6);
    expect(wendeTarifAn(43700, t)).toBeCloseTo(229.95, 6);
    expect(wendeTarifAn(58300, t)).toBeCloseTo(615.35, 6);
    expect(wendeTarifAn(76500, t)).toBeCloseTo(1155.85, 6);
    expect(wendeTarifAn(82400, t)).toBeCloseTo(1506.3, 6);
    expect(wendeTarifAn(109400, t)).toBeCloseTo(3288.3, 6);
    expect(wendeTarifAn(142200, t)).toBeCloseTo(6174.7, 6);
    expect(wendeTarifAn(185900, t)).toBeCloseTo(10981.7, 6);
    expect(wendeTarifAn(797400, t)).toBeCloseTo(91699.7, 6);
    expect(wendeTarifAn(797500, t)).toBeCloseTo(91712.5, 6);
  });

  it('DBG-Tarif Verheiratete 2027: Stützpunkte laut VKP-Vorabdruck', () => {
    const t = r27.steuern.dbgTarifVerheiratet;
    const punkte: [number, number][] = [
      [29900, 0],
      [53700, 238],
      [61600, 396],
      [79500, 933],
      [95400, 1569],
      [109200, 2259],
      [121200, 2979],
      [131100, 3672],
      [139100, 4312],
      [145000, 4843],
      [149000, 5243],
      [151100, 5474],
      [153100, 5714],
      [945900, 108778],
      [946000, 108790],
    ];
    for (const [e, steuer] of punkte) expect(wendeTarifAn(e, t), String(e)).toBeCloseTo(steuer, 6);
  });

  it('Plausibilität: Stufenbasis ≈ Steuer der Vorstufe an der Grenze (amtliche Basiswerte sind gerundet, Toleranz 0.05)', () => {
    for (const t of [r27.steuern.dbgTarifAlleinstehend, r27.steuern.dbgTarifVerheiratet]) {
      for (let i = 1; i < t.stufen.length; i++) {
        const vor = t.stufen[i - 1];
        const s = t.stufen[i];
        if (!vor || !s) throw new Error('Stufe fehlt');
        expect(vor.basis + ((s.ab - vor.ab) / 100) * (vor.satz * 100)).toBeCloseTo(s.basis, 1);
      }
    }
  });

  it('Kinderermässigung 264 (2026: 263) wirkt in dbgEinkommen', () => {
    expect(r27.steuern.dbgAbzugProKind).toBe(264);
    expect(r26.steuern.dbgAbzugProKind).toBe(263);
    const ohne = dbgEinkommen(100000, 'verheiratet', r27.steuern, 0);
    const mit = dbgEinkommen(100000, 'verheiratet', r27.steuern, 2);
    expect(ohne - mit).toBeCloseTo(528, 2);
  });

  it('Teuerungsausgleich: Steuer 2027 ≤ Steuer 2026 bei gleichem Einkommen', () => {
    for (const e of [40000, 80000, 120000, 200000]) {
      expect(dbgEinkommen(e, 'alleinstehend', r27.steuern)).toBeLessThanOrEqual(
        dbgEinkommen(e, 'alleinstehend', r26.steuern),
      );
      expect(dbgEinkommen(e, 'verheiratet', r27.steuern)).toBeLessThanOrEqual(
        dbgEinkommen(e, 'verheiratet', r26.steuern),
      );
    }
  });

  it('nicht beschlossene Grössen führen 2026 fort und sind «offen» (keine erfundenen Werte)', () => {
    expect(r27.ahv.minimalrenteMonat).toBe(r26.ahv.minimalrenteMonat);
    expect(r27.ahv.maximalrenteMonat).toBe(r26.ahv.maximalrenteMonat);
    expect(r27.saeule3a.maxMitPk).toBe(r26.saeule3a.maxMitPk);
    expect(r27.saeule3a.maxOhnePk).toBe(r26.saeule3a.maxOhnePk);
    expect(r27.bvg.eintrittsschwelle).toBe(r26.bvg.eintrittsschwelle);
    expect(r27.bvg.koordinationsabzug).toBe(r26.bvg.koordinationsabzug);
    expect(r27.beitraege.alvHoechstlohn).toBe(r26.beitraege.alvHoechstlohn);
    const offen = new Set(
      regelEintraege(2027)
        .filter((e) => e.status === 'offen')
        .map((e) => e.pfad),
    );
    for (const p of [
      'ahv.maximalrenteMonat',
      'ahv.minimalrenteMonat',
      'saeule3a.maxMitPk',
      'saeule3a.maxOhnePk',
      'bvg.eintrittsschwelle',
      'bvg.koordinationsabzug',
      'bvg.obereGrenzeJahreslohn',
      'bvg.mindestzins2027',
      'ahv.rentenanpassung2027',
      'steuern.quellensteuer.kapitalBundAlleinstehend',
      'steuern.quellensteuer.kapitalBundVerheiratet',
    ])
      expect(offen.has(p), p).toBe(true);
    for (const p of ['steuern.dbgTarifAlleinstehend', 'steuern.dbgTarifVerheiratet', 'steuern.dbgAbzugProKind'])
      expect(offen.has(p), p).toBe(false);
  });

  it('QStV-Kapitalsätze 125–150k: Wert 2026 fortgeschrieben, Abweichung im Vorabdruck dokumentiert', () => {
    const al = r27.steuern.quellensteuer.kapitalBundAlleinstehend.find((s) => s.bis === 150000);
    const ve = r27.steuern.quellensteuer.kapitalBundVerheiratet.find((s) => s.bis === 150000);
    expect(al?.satz).toBe(0.0195);
    expect(ve?.satz).toBe(0.0175);
    const e = regelEintraege(2027).find((x) => x.pfad === 'steuern.quellensteuer.kapitalBundAlleinstehend');
    expect(e?.hinweis).toContain('1,90 %');
  });

  it('jeder fortgeschriebene Wert trägt Quelle, Stand und den Hinweis «Fortgeschrieben»', () => {
    const n = anzahlFortgeschrieben(2027);
    expect(n).toBeGreaterThan(20);
    expect(anzahlFortgeschrieben(2026)).toBe(0);
    for (const e of regelEintraege(2027).filter((x) => (x.hinweis ?? '').includes('Fortgeschrieben'))) {
      expect(e.status, e.pfad).toBe('offen');
      expect(e.source.length, e.pfad).toBeGreaterThan(0);
    }
  });

  it('Quellen der neuen DBG-Werte nennen die amtliche Seite und den Abrufstand', () => {
    for (const p of ['steuern.dbgTarifAlleinstehend', 'steuern.dbgTarifVerheiratet', 'steuern.dbgAbzugProKind']) {
      const e = regelEintraege(2027).find((x) => x.pfad === p);
      expect(e?.source).toContain('https://www.efd.admin.ch/');
      expect(e?.stand).toContain('02.10.2026');
    }
  });
});
