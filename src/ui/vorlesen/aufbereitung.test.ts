import { describe, expect, it } from 'vitest';
import { anzeigeBereich, bereiteAuf, jahrZuWort, REGELN_ANZAHL, sprechZahl } from './aufbereitung';

const s = (t: string) => bereiteAuf(t).sprech;

describe('Aufbereitung für die Aussprache', () => {
  it('alle Regeln sind gültig (keine wird still ausgelassen)', () => {
    expect(REGELN_ANZAHL.aktiv).toBe(REGELN_ANZAHL.gesamt);
    expect(REGELN_ANZAHL.gesamt).toBeGreaterThan(40);
  });

  it('Beträge und Franken', () => {
    expect(s("CHF 1'250'000")).toBe('1250000 Franken');
    expect(s('CHF 800')).toBe('800 Franken');
    expect(s('Beträge in CHF')).toBe('Beträge in Franken');
    expect(s('75 Fr. pro Monat')).toBe('75 Franken pro Monat');
    expect(s('14’772.60 Franken')).toBe('14772,60 Franken');
  });

  it('Prozent, Dezimalzahlen, Bereiche', () => {
    expect(s('Zins 3.5%')).toBe('Zins 3,5 Prozent');
    expect(s('Zins 3,5 %')).toBe('Zins 3,5 Prozent');
    expect(s('Faktor 0.85')).toBe('Faktor 0,85');
    expect(s('Jg. 1961–1969')).toBe('Jahrgang neunzehnhunderteinundsechzig bis neunzehnhundertneunundsechzig');
    expect(s('50%')).toBe('50 Prozent');
  });

  it('Abkürzungen der Vorsorge werden buchstabiert, Sonderfälle als Wort', () => {
    expect(s('Die AHV und die BVG-Rente')).toBe('Die A H V und die B V G Rente');
    expect(s('EFTA-Staaten')).toBe('Efta Staaten');
    expect(s('CH-Rente')).toBe('C H Rente');
    expect(s('Ruhestandsrechner Schweiz')).toBe('Ruhestandsrechner Schweiz');
    expect(s('OFFEN')).toBe('OFFEN');
    expect(s('ESTV 2-217')).toBe('E S T V 2-217');
  });

  it('Säule 3a, Jahreszahlen, Datum', () => {
    expect(s('Säule 3a und 3b')).toBe('Säule drei a und drei b');
    expect(s('im Jahr 1969')).toBe('im Jahr neunzehnhundertneunundsechzig');
    expect(s('ab 2026')).toBe('ab 2026');
    expect(s('Stand 25.9.2026')).toBe('Stand 25. September 2026');
    expect(s('1999 Franken')).toBe('1999 Franken');
    expect(s('Dezember 1900')).toBe('Dezember neunzehnhundert');
  });

  it('Abkürzungen mit Punkt', () => {
    expect(s('z. B. Ferien')).toBe('zum Beispiel Ferien');
    expect(s('z.B. Ferien, d.h. Urlaub')).toBe('zum Beispiel Ferien, das heisst Urlaub');
    expect(s('ca. 5 Jahre, bzw. 60 Monate')).toBe('circa 5 Jahre, beziehungsweise 60 Monate');
    expect(s('Nr. 5, Art. 14 Abs. 2')).toBe('Nummer 5, Artikel 14 Absatz 2');
    expect(s('3 J. 2 Mt.')).toBe('3 Jahre 2 Monate');
    expect(s('1 J.')).toBe('1 Jahr');
    expect(s('1.2 Mio.')).toBe('1,2 Millionen');
  });

  it('Sonderzeichen, Leerraum, Emoji', () => {
    expect(s('  a \u00A0 b\n\nc  ')).toBe('a b c');
    expect(s('Er\u00ADfolgs\u00ADwahrscheinlichkeit')).toBe('Erfolgswahrscheinlichkeit');
    expect(s('«Übernehmen»')).toBe('Übernehmen');
    expect(s('Vorlesen 🔊')).toBe('Vorlesen');
    expect(s('a · b')).toBe('a, b');
    expect(s('−5 Punkte')).toBe('minus 5 Punkte');
    expect(s('≤ 60’480')).toBe('höchstens 60480');
    expect(s('1/44')).toBe('1 durch 44');
  });

  it('Randfälle: leer, nur Zeichen, sehr lang, Surrogate-Paare', () => {
    expect(s('')).toBe('');
    expect(s('   ')).toBe('');
    expect(s('...')).toBe('...');
    const lang = 'AHV '.repeat(50_000);
    const t0 = performance.now();
    expect(bereiteAuf(lang).sprech.length).toBeGreaterThan(100_000);
    expect(performance.now() - t0).toBeLessThan(5000);
    expect(s('Test 😀 Ende')).toBe('Test Ende');
    expect(s('𝒜 x')).toBe('𝒜 x');
  });

  it('Zahlenhilfen', () => {
    expect(sprechZahl("1'250.5")).toBe('1250,5');
    expect(sprechZahl('-3')).toBe('minus 3');
    expect(jahrZuWort(1969)).toBe('neunzehnhundertneunundsechzig');
    expect(jahrZuWort(1911)).toBe('neunzehnhundertelf');
    expect(jahrZuWort(1900)).toBe('neunzehnhundert');
    expect(jahrZuWort(2026)).toBe('2026');
    expect(jahrZuWort(Number.NaN)).toBe('NaN');
  });

  it('anzeigeBereich: Position im Sprechtext → Bereich im Anzeigetext', () => {
    const t = "Die AHV zahlt CHF 1'250 pro Monat.";
    const a = bereiteAuf(t);
    // «Die »
    expect(anzeigeBereich(a, t, 0)).toEqual({ von: 0, bis: 3 });
    // «A H V» → ganzes «AHV»
    const iAhv = a.sprech.indexOf('A H V');
    expect(anzeigeBereich(a, t, iAhv + 2)).toEqual({ von: t.indexOf('AHV'), bis: t.indexOf('AHV') + 3 });
    // «1250 Franken» → ganzer Betrag
    const iBetrag = a.sprech.indexOf('1250');
    const b = anzeigeBereich(a, t, iBetrag);
    expect(t.slice(b?.von, b?.bis)).toBe("CHF 1'250");
    // «pro»
    const iPro = a.sprech.indexOf('pro');
    const p = anzeigeBereich(a, t, iPro);
    expect(t.slice(p?.von, p?.bis)).toBe('pro');
    // ungültig
    expect(anzeigeBereich(a, t, -1)).toBeNull();
    expect(anzeigeBereich(a, t, 9999)).toBeNull();
    expect(anzeigeBereich(a, t, Number.NaN)).toBeNull();
  });

  it('Fuzz: nie ein Fehler, Karte bleibt im Bereich', () => {
    const zeichen = "aAzZ09 .,;:!?%'’-–/€«»\n\t\u00A0😀ä.z.B.CHFAHV3a1969";
    let seed = 12345;
    const zufall = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let n = 0; n < 500; n++) {
      const len = Math.floor(zufall() * 60);
      let t = '';
      for (let i = 0; i < len; i++) t += [...zeichen][Math.floor(zufall() * [...zeichen].length)];
      const a = bereiteAuf(t);
      for (const k of a.karte) {
        expect(k.a0).toBeGreaterThanOrEqual(0);
        expect(k.a1).toBeLessThanOrEqual(t.length);
        expect(k.s0).toBeLessThanOrEqual(a.sprech.length);
        expect(k.s1).toBeLessThanOrEqual(a.sprech.length);
      }
      for (let i = 0; i < a.sprech.length; i += 3) {
        const b = anzeigeBereich(a, t, i);
        if (b) {
          expect(b.von).toBeGreaterThanOrEqual(0);
          expect(b.bis).toBeLessThanOrEqual(t.length);
          expect(b.bis).toBeGreaterThan(b.von);
        }
      }
    }
  });
});
