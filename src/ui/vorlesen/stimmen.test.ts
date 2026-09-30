import { describe, expect, it } from 'vitest';
import { deutscheStimmen, istDeutsch, stimmeId, waehleStimme } from './stimmen';

const v = (name: string, lang: string, lokal = true) => ({ voiceURI: name, name, lang, localService: lokal });

describe('Stimmenwahl', () => {
  it('nur deutsche Stimmen, de-CH vor de-DE vor de-AT, lokale vor Netzstimmen', () => {
    const l = deutscheStimmen([
      v('Anna', 'de-DE'),
      v('English', 'en-US'),
      v('Zoe', 'de-AT'),
      v('Vreni', 'de-CH'),
      v('Netz', 'de-CH', false),
      v('Fr', 'fr-CH'),
    ]);
    expect(l.map((x) => x.name)).toEqual(['Vreni', 'Netz', 'Anna', 'Zoe']);
  });

  it('Sprache der Seite hat Vorrang', () => {
    const l = deutscheStimmen([v('A', 'de-CH'), v('B', 'de-DE')], 'de-DE');
    expect(l[0]?.name).toBe('B');
  });

  it('Unterstrich in Sprachcodes, fehlende Felder, Duplikate', () => {
    expect(istDeutsch({ lang: 'de_CH' })).toBe(true);
    expect(istDeutsch({ lang: 'DE' })).toBe(true);
    expect(istDeutsch({ lang: 'deu-DE' })).toBe(false);
    expect(istDeutsch({})).toBe(false);
    expect(deutscheStimmen([v('A', 'de-DE'), v('A', 'de-DE')]).length).toBe(1);
    expect(deutscheStimmen([])).toEqual([]);
  });

  it('waehleStimme: gewünschte, sonst erste, sonst null', () => {
    const l = deutscheStimmen([v('A', 'de-CH'), v('B', 'de-DE')]);
    expect(waehleStimme(l, 'B')?.name).toBe('B');
    expect(waehleStimme(l, 'gibtsnicht')?.name).toBe('A');
    expect(waehleStimme(l, null)?.name).toBe('A');
    expect(waehleStimme([], 'A')).toBeNull();
  });

  it('stimmeId begrenzt die Länge', () => {
    expect(stimmeId({ voiceURI: 'x'.repeat(500) }).length).toBe(200);
    expect(stimmeId({ name: 'N', lang: 'de_CH' })).toBe('N|de-ch');
  });
});
