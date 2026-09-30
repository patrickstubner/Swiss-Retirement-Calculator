import { describe, expect, it } from 'vitest';
import { MAX_SATZ, teileInSaetze } from './saetze';

const teile = (t: string, max?: number) => teileInSaetze(t, max).map((b) => t.slice(b.von, b.bis));

describe('Satzteilung', () => {
  it('einfache Sätze', () => {
    expect(teile('Erster Satz. Zweiter Satz! Dritter? Vierter.')).toEqual([
      'Erster Satz.',
      'Zweiter Satz!',
      'Dritter?',
      'Vierter.',
    ]);
  });

  it('Abkürzungen mit Punkt trennen nicht', () => {
    expect(teile('Sie erhalten z. B. eine Rente. Danach kommt Nr. 5 dran.')).toEqual([
      'Sie erhalten z. B. eine Rente.',
      'Danach kommt Nr. 5 dran.',
    ]);
    expect(teile('Das ist d. h. ein Test. Weiter ca. Fünf Jahre.')).toEqual([
      'Das ist d. h. ein Test.',
      'Weiter ca. Fünf Jahre.',
    ]);
    expect(teile('Art. 14 Abs. 2 BVG gilt. Ende.')).toEqual(['Art. 14 Abs. 2 BVG gilt.', 'Ende.']);
  });

  it('Dezimalzahlen, Datum und Ordnungszahlen trennen nicht', () => {
    expect(teile('Der Satz beträgt 3.5 Prozent. Danach 1.2 Mio. Franken.')).toEqual([
      'Der Satz beträgt 3.5 Prozent.',
      'Danach 1.2 Mio. Franken.',
    ]);
    expect(teile('Stand 25.9.2026 gilt. Am 30. Juni ist Stichtag.')).toEqual([
      'Stand 25.9.2026 gilt.',
      'Am 30. Juni ist Stichtag.',
    ]);
  });

  it('Zeilenumbruch beendet einen Satz, mehrere Satzzeichen und Anführungszeichen gehören dazu', () => {
    expect(teile('Ohne Punkt\nNächste Zeile')).toEqual(['Ohne Punkt', 'Nächste Zeile']);
    expect(teile('Wirklich?! Ja… Nein.')).toEqual(['Wirklich?!', 'Ja…', 'Nein.']);
    expect(teile('Er sagte «Ende.» Dann ging er.')).toEqual(['Er sagte «Ende.»', 'Dann ging er.']);
  });

  it('kein Satzende bei Punkt vor Kleinbuchstaben', () => {
    expect(teile('Datei v1.2 und mehr. Ok.')).toEqual(['Datei v1.2 und mehr.', 'Ok.']);
    expect(teile('bzw. kleiner Text weiter.')).toEqual(['bzw. kleiner Text weiter.']);
  });

  it('leer, nur Leerraum, nur Satzzeichen', () => {
    expect(teile('')).toEqual([]);
    expect(teile('   \n  ')).toEqual([]);
    expect(teile('...')).toEqual(['...']);
  });

  it('lange Sätze werden geteilt (höchstens max Zeichen), Bereiche decken den Text ohne Überlappung ab', () => {
    const lang = `${'Dies ist ein langer Teil, '.repeat(30)}Schluss.`;
    const bereiche = teileInSaetze(lang, 100);
    expect(bereiche.length).toBeGreaterThan(5);
    let letztes = 0;
    for (const b of bereiche) {
      expect(b.bis - b.von).toBeLessThanOrEqual(100);
      expect(b.von).toBeGreaterThanOrEqual(letztes);
      letztes = b.bis;
    }
    expect(lang.slice(bereiche[0]?.von, bereiche.at(-1)?.bis).replace(/\s+/g, ' ')).toBe(lang);
  });

  it('ein Wort ohne Leerzeichen wird hart geschnitten', () => {
    const t = 'x'.repeat(1000);
    const b = teileInSaetze(t, 100);
    expect(b.length).toBe(10);
    expect(b.every((x) => x.bis - x.von <= 100)).toBe(true);
  });

  it('sehr langer Text in vernünftiger Zeit', () => {
    const t = 'Ein normaler Satz mit Zahl 3.5 und z. B. Abkürzung. '.repeat(20_000);
    const t0 = performance.now();
    const b = teileInSaetze(t);
    expect(b.length).toBe(20_000);
    expect(performance.now() - t0).toBeLessThan(3000);
  });

  it('Standardgrenze', () => {
    expect(MAX_SATZ).toBeGreaterThan(50);
    const b = teileInSaetze('a '.repeat(500));
    expect(b.every((x) => x.bis - x.von <= MAX_SATZ)).toBe(true);
  });

  it('Fuzz: Bereiche liegen im Text, sind nicht leer und geordnet', () => {
    const z = [...'aAz . , ; ! ? … \n «»(z.B.)3.5'];
    let seed = 7;
    const r = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let n = 0; n < 500; n++) {
      let t = '';
      for (let i = 0, l = Math.floor(r() * 300); i < l; i++) t += z[Math.floor(r() * z.length)];
      const b = teileInSaetze(t, 40);
      let letztes = 0;
      for (const x of b) {
        expect(x.von).toBeGreaterThanOrEqual(letztes);
        expect(x.bis).toBeGreaterThan(x.von);
        expect(x.bis).toBeLessThanOrEqual(t.length);
        expect(x.bis - x.von).toBeLessThanOrEqual(40);
        letztes = x.bis;
      }
    }
  });
});
