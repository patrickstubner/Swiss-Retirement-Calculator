import { describe, expect, it } from 'vitest';
import { EIGENE_KRISE_ID, type Krise } from '../core/krisen';
import { KRISEN, type KrisenSchwere, krisenNachSchwere, krisenSchwere } from '../data/krisen';
import {
  HAUSPREIS_ANZEIGE_AB,
  KRISEN_KATALOG_OPTIONEN,
  krisenAktienEndeText,
  krisenErholungText,
  krisenExtremText,
  krisenHauspreisText,
  krisenKatalogOptionen,
  krisenOptionLabel,
  krisenPhasenText,
  krisenTiefpunktText,
} from './krisenSchwereText';

describe('Texte der Krisenauswahl', () => {
  it('die Optionszeile nennt Rückgang, Name und höchstens einen Zusatz', () => {
    const optionen = krisenKatalogOptionen();
    expect(optionen.map((o) => o.value)).toEqual([...krisenNachSchwere().map((k) => k.id), EIGENE_KRISE_ID]);
    expect(KRISEN_KATALOG_OPTIONEN.map((o) => o.label)).toEqual(optionen.map((o) => o.label));
    expect(Object.isFrozen(KRISEN_KATALOG_OPTIONEN)).toBe(true);
    expect(optionen.map((o) => o.label)).toEqual([
      '-62.7% · extrem · Japan-Krise 1990',
      '-55.2% · Häuser -10% · Ölkrise 1973',
      '-51.9% · extrem · Grosse Depression 1929',
      '-47.2% · extrem · Stagflation 1973',
      '-43.2% · Dotcom 2000',
      '-36.1% · Finanzkrise 2007',
      '-28.5% · Schwarzer Montag 1987',
      '-23.5% · Häuser -31.8% · Immobilienkrise CH 1990',
      '-18.8% · nicht erholt · Zinsschock 2022',
      '-7.9% · Eurokrise 2011',
      'Covid 2020',
      'Eigene Krise (Annahme)',
    ]);
    for (const o of optionen) {
      expect(o.label).not.toContain('Tiefpunkt');
      expect(o.label).not.toContain('Katalogphase');
      expect(o.label.split(' · ').length).toBeLessThanOrEqual(3);
    }
    const ids = optionen.map((o) => o.value);
    expect(ids.indexOf('immobilienCh1990')).toBeLessThan(ids.indexOf('zinsschock2022'));
  });

  it('der eine Zusatz folgt extrem, dann nicht erholt, dann Häuser ab −1 %', () => {
    const vorlage = KRISEN.find((k) => k.id === 'oelkrise1973') as Krise;
    const s = krisenSchwere(vorlage, 'CHE') as KrisenSchwere;
    expect(krisenOptionLabel(vorlage, s)).toBe('-55.2% · Häuser -10% · Ölkrise 1973');
    expect(krisenOptionLabel(vorlage, { ...s, dauerArt: 'offen' })).toBe('-55.2% · nicht erholt · Ölkrise 1973');
    expect(krisenOptionLabel({ ...vorlage, id: 'nurExtrem' }, s)).toBe('-55.2% · extrem · Ölkrise 1973');
    expect(HAUSPREIS_ANZEIGE_AB).toBe(-0.01);
  });

  it('der Kasten trägt Katalogphase, Aktien-Tiefpunkt, Hauspreise und die Lücke 2022', () => {
    const covid = krisenSchwere(KRISEN.find((k) => k.id === 'covid2020') as Krise, 'CHE');
    const japan = krisenSchwere(KRISEN.find((k) => k.id === 'japan1990') as Krise, 'JPN');
    const oel = krisenSchwere(KRISEN.find((k) => k.id === 'oelkrise1973') as Krise, 'CHE');
    const immo = krisenSchwere(KRISEN.find((k) => k.id === 'immobilienCh1990') as Krise, 'CHE');
    const zins = krisenSchwere(KRISEN.find((k) => k.id === 'zinsschock2022') as Krise, 'CHE');
    const dotcom = krisenSchwere(KRISEN.find((k) => k.id === 'dotcom2000') as Krise, 'CHE');
    expect(covid && krisenTiefpunktText(covid)).toContain('keiner');
    const ohne = { ausgleich: false, renditeNominal: 0.07 };
    const mit = {
      ausgleich: true,
      renditeNominal: 0.07,
      hauspreisAusgeglichen: 0.0556,
      wertschriftenAusgeglichen: 0.0479,
    };
    expect(covid && krisenPhasenText(covid, ohne)).toBe(
      'Die App spielt nur die Katalogphase (1 Jahr) ab, danach gilt Ihre Renditeannahme (7%).',
    );
    expect(covid && krisenPhasenText(covid, mit)).toBe(
      'Die App spielt nur die Katalogphase (1 Jahr) ab, danach gelten die ausgeglichenen Renditen (Wertschriften 4.79%, Hauspreise 5.56%).',
    );
    expect(covid && krisenErholungText(covid)).toContain('kein Einbruch');
    expect(covid && krisenAktienEndeText(covid)).toBe('+4.8%');
    expect(covid && krisenHauspreisText(covid, ohne)).toBe('kein Rückgang in den Jahreswerten');
    expect(japan && krisenErholungText(japan)).toBe('nicht erholt');
    expect(japan && krisenTiefpunktText(japan)).toBe('nach ca. 14 Jahren');
    expect(japan && krisenHauspreisText(japan)).toBe('real max. -32.9% (Peak-to-Trough)');
    expect(japan && krisenExtremText('japan1990')).toBe('extrem (nicht in «Automatisch»)');
    expect(krisenExtremText('oelkrise1973')).toBeNull();
    expect(oel && krisenErholungText(oel)).toContain('wird nicht abgespielt');
    expect(oel && krisenHauspreisText(oel)).toBe('real max. -10% (Peak-to-Trough)');
    expect(immo && krisenHauspreisText(immo)).toBe('real max. -31.8% (Peak-to-Trough)');
    expect(immo && krisenAktienEndeText(immo)).toBe('+181.7%');
    expect(zins && krisenHauspreisText(zins, ohne)).toBe(
      'keine Jahresdaten 2022; die Rechnung nutzt Ihre Renditeannahme (7%).',
    );
    expect(zins && krisenHauspreisText(zins, mit)).toBe(
      'keine Jahresdaten 2022; die Rechnung nutzt die ausgeglichene Hauspreisrendite (5.56%).',
    );
    expect(dotcom && krisenHauspreisText(dotcom)).toBe('kein Rückgang über 1 %');
  });

  it('die Optionszeile enthält keine HTML-Zeichen aus dem Katalognamen', () => {
    for (const krise of KRISEN) {
      const s = krisenSchwere(krise, krise.land);
      expect(s).not.toBeNull();
      if (!s) continue;
      const label = krisenOptionLabel(krise, s);
      expect(label).not.toContain('<');
      expect(label).not.toContain('>');
    }
  });
});
