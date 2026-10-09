import { describe, expect, it } from 'vitest';
import { EIGENE_KRISE_ID } from '../core/krisen';
import { KRISEN, krisenNachSchwere, krisenSchwere } from '../data/krisen';
import {
  KRISEN_KATALOG_OPTIONEN,
  krisenAktienEndeText,
  krisenErholungText,
  krisenHauspreisText,
  krisenKatalogOptionen,
  krisenOptionLabel,
  krisenPhasenText,
  krisenTiefpunktText,
} from './krisenSchwereText';

describe('Texte der Krisenauswahl', () => {
  it('Optionen folgen dem Aktienrückgang und die eigene Krise steht am Ende', () => {
    const optionen = krisenKatalogOptionen();
    expect(optionen.map((o) => o.value)).toEqual([...krisenNachSchwere().map((k) => k.id), EIGENE_KRISE_ID]);
    expect(KRISEN_KATALOG_OPTIONEN.map((o) => o.value)).toEqual(optionen.map((o) => o.value));
    expect(Object.isFrozen(KRISEN_KATALOG_OPTIONEN)).toBe(true);
    expect(optionen.at(-1)).toEqual({ value: EIGENE_KRISE_ID, label: 'Eigene Krise (Annahme)' });
    const japan = optionen.find((o) => o.value === 'japan1990');
    expect(japan?.label.startsWith('-62.7%')).toBe(true);
    expect(japan?.label).toContain('Japan-Krise 1990');
    expect(japan?.label).toContain('extrem');
    expect(japan?.label).toContain('Tiefpunkt nach ca. 14 J.');
    expect(japan?.label).toContain('Katalogphase 14 J.');
    expect(japan?.label).toContain('nicht erholt');
    expect(japan?.label).toContain('Hauspreise real max. -32.9%');
    expect(japan?.label).not.toContain('Dauer');
    expect(japan?.label).not.toContain('endete im Plus');
    const covid = optionen.find((o) => o.value === 'covid2020');
    expect(covid?.label).toContain('Aktien am Phasenende +4.8%');
    expect(covid?.label).toContain('Katalogphase 1 J.');
    expect(covid?.label).not.toContain('Tiefpunkt');
    expect(covid?.label).not.toContain('endete im Plus');
    const immo = optionen.find((o) => o.value === 'immobilienCh1990');
    expect(immo?.label).toContain('Aktien am Phasenende +181.7%');
    expect(immo?.label).toContain('Hauspreise real max. -31.8%');
    expect(immo?.label).toContain('Katalogphase 8 J.');
    expect(immo?.label).toContain('Tiefpunkt nach ca. 1 J.');
    expect(immo?.label).not.toContain('endete im Plus');
    const zins = optionen.find((o) => o.value === 'zinsschock2022');
    expect(zins?.label).toContain('nicht erholt');
    expect(zins?.label).toContain('Katalogphase 1 J.');
    expect(zins?.label).not.toContain('Hauspreise');
    const oel = optionen.find((o) => o.value === 'oelkrise1973');
    expect(oel?.label).toContain('Aktien historisch nach 13 J. erholt');
    expect(oel?.label).toContain('Hauspreise real max. -10%');
    expect(oel?.label).not.toContain('extrem');
    const ids = optionen.map((o) => o.value);
    expect(ids.indexOf('immobilienCh1990')).toBeLessThan(ids.indexOf('zinsschock2022'));
    expect(ids.indexOf('immobilienCh1990')).toBeLessThan(ids.indexOf('eurokrise2011'));
  });

  it('Infozeile trennt Katalogphase, historische Erholung und Hauspreise', () => {
    const covid = krisenSchwere(KRISEN.find((k) => k.id === 'covid2020') as (typeof KRISEN)[number], 'CHE');
    const japan = krisenSchwere(KRISEN.find((k) => k.id === 'japan1990') as (typeof KRISEN)[number], 'JPN');
    const oel = krisenSchwere(KRISEN.find((k) => k.id === 'oelkrise1973') as (typeof KRISEN)[number], 'CHE');
    const immo = krisenSchwere(KRISEN.find((k) => k.id === 'immobilienCh1990') as (typeof KRISEN)[number], 'CHE');
    const zins = krisenSchwere(KRISEN.find((k) => k.id === 'zinsschock2022') as (typeof KRISEN)[number], 'CHE');
    expect(covid && krisenTiefpunktText(covid)).toContain('keiner');
    expect(covid && krisenPhasenText(covid)).toBe(
      'Die App spielt nur die Katalogphase (1 Jahr) ab, danach gilt Ihre Renditeannahme.',
    );
    expect(covid && krisenErholungText(covid)).toContain('kein Einbruch');
    expect(covid && krisenAktienEndeText(covid)).toBe('+4.8%');
    expect(covid && krisenHauspreisText(covid)).toBe('kein Rückgang in den Jahreswerten');
    expect(japan && krisenErholungText(japan)).toBe('nicht erholt');
    expect(japan && krisenPhasenText(japan)).toContain('Katalogphase (14 Jahre)');
    expect(japan && krisenTiefpunktText(japan)).toBe('nach ca. 14 Jahren');
    expect(japan && krisenHauspreisText(japan)).toBe('real max. -32.9% (Peak-to-Trough)');
    expect(oel && krisenErholungText(oel)).toContain('nach 13 Jahren wieder auf dem Vorkrisenniveau');
    expect(oel && krisenErholungText(oel)).toContain('wird nicht abgespielt');
    expect(oel && krisenPhasenText(oel)).toContain('Katalogphase (2 Jahre)');
    expect(oel && krisenTiefpunktText(oel)).toBe('nach ca. 2 Jahren');
    expect(immo && krisenErholungText(immo)).toContain('innerhalb der Katalogphase');
    expect(immo && krisenAktienEndeText(immo)).toBe('+181.7%');
    expect(immo && krisenHauspreisText(immo)).toBe('real max. -31.8% (Peak-to-Trough)');
    expect(zins && krisenErholungText(zins)).toBe('nicht erholt');
    expect(zins && krisenHauspreisText(zins)).toBeNull();
  });

  it('die Optionszeile enthält keine HTML-Zeichen aus dem Katalognamen', () => {
    for (const krise of KRISEN) {
      const s = krisenSchwere(krise, krise.land);
      expect(s).not.toBeNull();
      if (!s) continue;
      const label = krisenOptionLabel(krise, s);
      expect(label).not.toContain('<');
      expect(label).not.toContain('>');
      expect(label).not.toContain('Dauer');
    }
  });
});
