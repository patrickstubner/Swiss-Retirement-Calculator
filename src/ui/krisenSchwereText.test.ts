import { describe, expect, it } from 'vitest';
import { EIGENE_KRISE_ID } from '../core/krisen';
import { KRISEN, krisenNachSchwere, krisenSchwere } from '../data/krisen';
import { krisenDauerText, krisenKatalogOptionen, krisenOptionLabel, krisenTiefpunktText } from './krisenSchwereText';

describe('Texte der Krisenauswahl', () => {
  it('Optionen folgen der Schwere und die eigene Krise steht am Ende', () => {
    const optionen = krisenKatalogOptionen();
    expect(optionen.map((o) => o.value)).toEqual([...krisenNachSchwere().map((k) => k.id), EIGENE_KRISE_ID]);
    expect(optionen.at(-1)).toEqual({ value: EIGENE_KRISE_ID, label: 'Eigene Krise (Annahme)' });
    const japan = optionen.find((o) => o.value === 'japan1990');
    expect(japan?.label.startsWith('-62.7%')).toBe(true);
    expect(japan?.label).toContain('Japan-Krise 1990');
    expect(japan?.label).toContain('extrem');
    expect(japan?.label).toContain('Tiefpunkt nach ca. 14 J.');
    expect(japan?.label).toContain('Dauer 14 J.');
    expect(japan?.label).not.toContain('endete im Plus');
    const covid = optionen.find((o) => o.value === 'covid2020');
    expect(covid?.label).toContain('endete im Plus: +');
    expect(covid?.label).not.toContain('Tiefpunkt');
    const immo = optionen.find((o) => o.value === 'immobilienCh1990');
    expect(immo?.label).toContain('endete im Plus: +');
    expect(immo?.label).toContain('Tiefpunkt nach ca. 1 J.');
    const oel = optionen.find((o) => o.value === 'oelkrise1973');
    expect(oel?.label).not.toContain('(extrem)');
  });

  it('Infozeile nennt Jahreswerte ehrlich und unterscheidet Erholung, offene Reihe und Plus', () => {
    const covid = krisenSchwere(KRISEN.find((k) => k.id === 'covid2020') as (typeof KRISEN)[number], 'CHE');
    const japan = krisenSchwere(KRISEN.find((k) => k.id === 'japan1990') as (typeof KRISEN)[number], 'JPN');
    const oel = krisenSchwere(KRISEN.find((k) => k.id === 'oelkrise1973') as (typeof KRISEN)[number], 'CHE');
    expect(covid && krisenTiefpunktText(covid)).toContain('keiner');
    expect(covid && krisenDauerText(covid)).toContain('Katalogphase');
    expect(japan && krisenDauerText(japan)).toContain('nicht wieder erreicht');
    expect(japan && krisenTiefpunktText(japan)).toBe('nach ca. 14 Jahren');
    expect(oel && krisenDauerText(oel)).toContain('bis zum Vorkrisenniveau');
    expect(oel && krisenDauerText(oel)).toContain('Katalogphase');
    expect(oel && krisenTiefpunktText(oel)).toBe('nach ca. 2 Jahren');
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
