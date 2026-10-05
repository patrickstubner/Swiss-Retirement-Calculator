/**
 * Regeljahr 2027: Amtlich beschlossen am 2.10.2026 (AHV/IV/EO, BVG-Grenzen, Säule 3a) plus DBG-Vorabdruck.
 * Was nicht beschlossen ist, führt den Wert 2026 fort und ist «offen» (Hinweis «Fortgeschrieben»).
 * Die Skala-44-Tabelle ist aus Art. 34 abgeleitet und «offen», ohne «Fortgeschrieben».
 */
import { describe, expect, it } from 'vitest';
import { ahvRenteSkala44 } from '../core/ahv';
import { beitragAusTabelle, neBeitragTabelle } from '../core/neBeitrag';
import { dbgEinkommen, wendeTarifAn } from '../core/steuern';
import json2027 from './2027.json';
import {
  anzahlFortgeschrieben,
  ladeRegeln,
  pruefeRegeln,
  regelEintraege,
  regelJahrStatus,
  regeljahrBanner,
} from './index';

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

  it('AHV, BVG und Säule 3a 2027: beschlossene Beträge, Quellen mit Abrufstand', () => {
    expect(r27.ahv.minimalrenteMonat).toBe(1280);
    expect(r27.ahv.maximalrenteMonat).toBe(2560);
    expect(r27.ahv.plafondEhepaarFaktor * r27.ahv.maximalrenteMonat).toBe(3840);
    expect(r27.ahv.rentenformel.mdjeMinimum).toBe(15360);
    expect(r27.ahv.rentenformel.mdjeMaximum).toBe(92160);
    expect(r27.beitraege.mindestbeitrag).toBe(541);
    expect(r27.beitraege.sinkendeSkalaSelbststaendig).toEqual({ untereGrenze: 10300, obereGrenze: 61500 });
    expect(r27.beitraege.freiwilligeAhv.mindestbeitrag).toBe(1030);
    expect(r27.beitraege.nichterwerbstaetige.befreiungEhegatteMindestbeitrag).toBe(1082);
    expect(r27.beitraege.freiwilligeAhv.befreiungEhegatte).toEqual({
      freiwilligErwerbstaetig: 2060,
      obligatorischErwerbstaetig: 1082,
    });
    expect(r27.ahv.elLebensbedarf).toEqual({ alleinstehend: 21000, ehepaar: 31500 });
    expect(r27.bvg.eintrittsschwelle).toBe(23040);
    expect(r27.bvg.koordinationsabzug).toBe(26880);
    expect(r27.bvg.obereGrenzeJahreslohn).toBe(92160);
    expect(r27.bvg.koordinierterLohnMin).toBe(3840);
    expect(r27.bvg.koordinierterLohnMax).toBe(92160 - 26880);
    expect(r27.bvg.maxVersicherbarerLohn).toBe(92160 * 10);
    expect(r27.saeule3a.maxMitPk).toBe(7373);
    expect(r27.saeule3a.maxOhnePk).toBe(36864);
    expect(r27.ahv.uebergangKuerzung.map((s) => s.mdjeBis)).toEqual([61440, 76800, null]);
    expect(r27.ahv.rentenzuschlagUebergang.stufen.map((s) => s.mdjeBis)).toEqual([61440, 76800, null]);
    expect(r27.ahv.vorbezugKuerzung).toEqual(r26.ahv.vorbezugKuerzung);
    expect(r27.ahv.aufschubZuschlag).toEqual(r26.ahv.aufschubZuschlag);
    expect(r27.ahv.uebergangKuerzung.map((s) => s.saetzeProJahr)).toEqual(
      r26.ahv.uebergangKuerzung.map((s) => s.saetzeProJahr),
    );
    for (const p of [
      'ahv.minimalrenteMonat',
      'ahv.maximalrenteMonat',
      'beitraege.mindestbeitrag',
      'beitraege.sinkendeSkalaSelbststaendig',
      'beitraege.freiwilligeAhv.mindestbeitrag',
      'bvg.eintrittsschwelle',
      'bvg.koordinierterLohnMax',
      'bvg.maxVersicherbarerLohn',
      'saeule3a.maxMitPk',
      'saeule3a.maxOhnePk',
      'ahv.neueVorbezugsAufschubsaetze',
      'ahv.rentenanpassung2027',
    ]) {
      const e = regelEintraege(2027).find((x) => x.pfad === p);
      expect(e?.status, p).toBe('verifiziert');
      expect(e?.stand, p).toContain('05.10.2026');
      expect(e?.source.length, p).toBeGreaterThan(0);
      expect(e?.hinweis ?? '', p).not.toContain('Fortgeschrieben');
    }
    const saetze = regelEintraege(2027).find((x) => x.pfad === 'ahv.neueVorbezugsAufschubsaetze');
    expect(saetze?.hinweis).toContain('unverändert');
    expect(saetze?.hinweis).toContain('AHV 21');
    expect(saetze?.source).toContain('https://sozialversicherungen.admin.ch/de/d/18438/download');
  });

  it('Beitragstabelle Nichterwerbstätige: AHVV-Schwellen und Summe AHV+IV+EO', () => {
    const t = r27.beitraege.nichterwerbstaetige.tabelle;
    expect(t.untergrenze).toBe(360000);
    expect(t.grenzeStufe2).toBe(1760000);
    // Art. 28 AHVV (nur AHV) und sinngemässe IV-/EO-Anteile 14/87 bzw. 5/87
    const ahvStart = 539.4;
    const start = ahvStart + (ahvStart * 14) / 87 + (ahvStart * 5) / 87;
    expect(t.beitragAbUntergrenze).toBeCloseTo(start, 8);
    expect(t.zuschlagStufe1).toBe(87 + 14 + 5);
    expect(t.zuschlagStufe2).toBeCloseTo(130.5 + 21 + 7.5, 8);
    expect(t.maximalbeitrag).toBe(22200 + 3550 + 1300);
    const ne = r27.beitraege.nichterwerbstaetige;
    expect(neBeitragTabelle(0, ne)).toBe(541);
    expect(neBeitragTabelle(359999, ne)).toBe(541);
    expect(neBeitragTabelle(360000, ne)).toBeCloseTo(657.2, 8);
    expect(neBeitragTabelle(1760000, ne)).toBeCloseTo(3625.2, 8);
    expect(neBeitragTabelle(9110000, ne)).toBeCloseTo(26998.2, 6);
    expect(neBeitragTabelle(9160000, ne)).toBe(27050);
    expect(neBeitragTabelle(20000000, ne)).toBe(27050);
  });

  it('freiwillige AHV/IV: Tabelle aus VFV Art. 13b (erste Schwelle 610 000, nicht 360 000)', () => {
    const fw = r27.beitraege.freiwilligeAhv;
    const t = fw.tabelleNichterwerbstaetige;
    expect(t.untergrenze).toBe(610000);
    expect(t.grenzeStufe2).toBe(1760000);
    expect(t.maximalbeitrag).toBe(25750);
    expect(beitragAusTabelle(0, t)).toBe(1030);
    expect(beitragAusTabelle(609999, t)).toBe(1030);
    expect(beitragAusTabelle(610000, t)).toBeCloseTo(1131.2, 8);
    expect(beitragAusTabelle(1760000, t)).toBeCloseTo(3454.2, 8);
    expect(beitragAusTabelle(9110000, t)).toBeCloseTo(25724.7, 6);
    expect(beitragAusTabelle(9160000, t)).toBe(25750);
  });

  it('Skala 44: Formel und abgeleitete Tabelle, amtliche Publikation noch offen', () => {
    expect(r27.ahv.rententabelleStufe).toBe(1536);
    expect(r27.ahv.rententabelleSkala44).toHaveLength(51);
    expect(r27.ahv.rententabelleSkala44[0]).toEqual([15360, 1280]);
    expect(r27.ahv.rententabelleSkala44[50]).toEqual([92160, 2560]);
    r27.ahv.rententabelleSkala44.forEach(([mdje, rente], i) => {
      if (mdje === undefined || rente === undefined) throw new Error('Stufe fehlt');
      expect(mdje).toBe(15360 + i * 1536);
      expect(ahvRenteSkala44(mdje, r27.ahv)).toBe(rente);
    });
    for (const [mdje, rente] of r27.ahv.rententabelleReferenz) {
      if (mdje === undefined || rente === undefined) throw new Error('Stufe fehlt');
      expect(ahvRenteSkala44(mdje, r27.ahv)).toBe(rente);
    }
    for (const p of ['ahv.rententabelleStufe', 'ahv.rententabelleReferenz', 'ahv.rententabelleSkala44']) {
      const e = regelEintraege(2027).find((x) => x.pfad === p);
      expect(e?.status, p).toBe('offen');
      expect(e?.hinweis, p).not.toContain('Fortgeschrieben');
      expect(e?.hinweis, p).toContain('Rententabellen 2027');
      expect(e?.source, p).toContain('fedlex.admin.ch');
    }
  });

  it('nicht beschlossene Grössen führen 2026 fort und sind «offen»', () => {
    expect(r27.beitraege.alvHoechstlohn).toBe(r26.beitraege.alvHoechstlohn);
    expect(r27.bvg.mindestzins2027).toBe(0.0175);
    const offen = new Set(
      regelEintraege(2027)
        .filter((e) => e.status === 'offen')
        .map((e) => e.pfad),
    );
    for (const p of [
      'bvg.mindestzins2027',
      'ahv.rententabelleSkala44',
      'steuern.quellensteuer.kapitalBundAlleinstehend',
      'steuern.quellensteuer.kapitalBundVerheiratet',
      'beitraege.alvHoechstlohn',
    ])
      expect(offen.has(p), p).toBe(true);
    for (const p of [
      'ahv.minimalrenteMonat',
      'ahv.maximalrenteMonat',
      'saeule3a.maxMitPk',
      'saeule3a.maxOhnePk',
      'bvg.eintrittsschwelle',
      'bvg.koordinationsabzug',
      'bvg.obereGrenzeJahreslohn',
      'ahv.rentenanpassung2027',
      'ahv.neueVorbezugsAufschubsaetze',
      'steuern.dbgTarifAlleinstehend',
      'steuern.dbgTarifVerheiratet',
      'steuern.dbgAbzugProKind',
    ])
      expect(offen.has(p), p).toBe(false);
    const zins = regelEintraege(2027).find((x) => x.pfad === 'bvg.mindestzins2027');
    expect(zins?.hinweis).not.toContain('Fortgeschrieben');
    expect(zins?.hinweis).toContain('Empfehlung');
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
    expect(n).toBe(8);
    expect(anzahlFortgeschrieben(2026)).toBe(0);
    for (const e of regelEintraege(2027).filter((x) => (x.hinweis ?? '').includes('Fortgeschrieben'))) {
      expect(e.status, e.pfad).toBe('offen');
      expect(e.source.length, e.pfad).toBeGreaterThan(0);
    }
  });

  it('Banner ab 2027: erfasst gegen teilweise, ab 2028 noch nicht erfasst', () => {
    const teilweise = regeljahrBanner(2027);
    expect(teilweise?.rolle).toBe('status');
    expect(teilweise?.stark).toContain('teilweise erfasst');
    expect(teilweise?.rest).toContain('AHV-Renten');
    expect(teilweise?.rest).toContain('BVG-Grenzbeträge');
    expect(teilweise?.rest).toContain('Säule 3a');
    expect(teilweise?.rest).toContain('BVG-Mindestzins');
    expect(teilweise?.rest).toContain('Quellensteuer');
    expect(teilweise?.rest).toContain('kantonale Tarife');
    expect(teilweise?.rest).toContain('Rententabelle');
    expect(teilweise?.rest).toContain('8 Werte');
    const fehlt = regeljahrBanner(2028);
    expect(fehlt?.rolle).toBe('alert');
    expect(fehlt?.stark).toContain('noch nicht erfasst');
    expect(fehlt?.rest).toContain('2027');
    expect(regeljahrBanner(2026)).toBeNull();
  });

  it('Quellen der neuen DBG-Werte nennen die amtliche Seite und den Abrufstand', () => {
    for (const p of ['steuern.dbgTarifAlleinstehend', 'steuern.dbgTarifVerheiratet', 'steuern.dbgAbzugProKind']) {
      const e = regelEintraege(2027).find((x) => x.pfad === p);
      expect(e?.source).toContain('https://www.efd.admin.ch/');
      expect(e?.stand).toContain('02.10.2026');
    }
  });
});
