import { describe, expect, it } from 'vitest';
import { AUS_KEY, loescheLokal, VORLESEN_KEY } from '../state';
import { bereinige, ladeEinstellungen, STANDARD_EINSTELLUNGEN, speichereEinstellungen } from './einstellungen';

class TestSpeicher implements Storage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('Vorlese-Einstellungen', () => {
  it('speichert nur bei aktivem Speichern und lädt wieder', () => {
    const s = new TestSpeicher();
    speichereEinstellungen(s, { tempo: 1.3, stimme: 'abc' });
    expect(ladeEinstellungen(s)).toEqual({ tempo: 1.3, stimme: 'abc' });
    s.setItem(AUS_KEY, '1');
    speichereEinstellungen(s, { tempo: 0.7, stimme: 'neu' });
    expect(s.getItem(VORLESEN_KEY)).toContain('abc'); // nicht überschrieben
    expect(ladeEinstellungen(s)).toEqual(STANDARD_EINSTELLUNGEN); // bei «aus» nichts laden
  });

  it('ohne Speicher passiert nichts', () => {
    expect(() => speichereEinstellungen(null, { tempo: 1, stimme: null })).not.toThrow();
    expect(ladeEinstellungen(null)).toEqual(STANDARD_EINSTELLUNGEN);
  });

  it('Ausschalten des Speicherns löscht die Einstellungen mit', () => {
    const s = new TestSpeicher();
    speichereEinstellungen(s, { tempo: 1.5, stimme: 'x' });
    loescheLokal(s);
    expect(s.getItem(VORLESEN_KEY)).toBeNull();
  });

  it('bereinigt fremde und böse Werte', () => {
    expect(bereinige(null)).toEqual(STANDARD_EINSTELLUNGEN);
    expect(bereinige('x')).toEqual(STANDARD_EINSTELLUNGEN);
    expect(bereinige({ tempo: 99, stimme: 5 })).toEqual(STANDARD_EINSTELLUNGEN);
    expect(bereinige({ tempo: Number.NaN, stimme: 'x'.repeat(201) })).toEqual(STANDARD_EINSTELLUNGEN);
    expect(bereinige({ tempo: 1.15, stimme: '<img src=x onerror=alert(1)>' })).toEqual({
      tempo: 1.15,
      stimme: '<img src=x onerror=alert(1)>',
    });
    const s = new TestSpeicher();
    s.setItem(VORLESEN_KEY, '{kaputt');
    expect(ladeEinstellungen(s)).toEqual(STANDARD_EINSTELLUNGEN);
    s.setItem(VORLESEN_KEY, 'x'.repeat(5000));
    expect(ladeEinstellungen(s)).toEqual(STANDARD_EINSTELLUNGEN);
  });

  it('enthält nie Texte oder Eingabewerte', () => {
    const s = new TestSpeicher();
    speichereEinstellungen(s, { tempo: 1, stimme: 'Anna' });
    expect(Object.keys(JSON.parse(s.getItem(VORLESEN_KEY) ?? '{}')).sort()).toEqual(['stimme', 'tempo']);
  });
});
