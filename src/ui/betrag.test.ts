import { describe, expect, it } from 'vitest';
import { bearbeiteEingabe, formatBetrag, formatLive, gruppiere, parseBetrag, positionNach, TRENNER } from './betrag';
import { fmtChf, fmtZahl } from './format';

const T = TRENNER;

describe('Tausendertrennzeichen: Formatieren', () => {
  it('ab 1000 mit Apostroph, darunter ohne', () => {
    expect(formatBetrag(999)).toBe('999');
    expect(formatBetrag(1000)).toBe(`1${T}000`);
    expect(formatBetrag(1_250_000)).toBe(`1${T}250${T}000`);
    expect(formatBetrag(-25_000)).toBe(`-25${T}000`);
    expect(formatBetrag(0)).toBe('0');
    expect(formatBetrag(1234.5, 2)).toBe(`1${T}234.5`);
    expect(formatBetrag(-0.4)).toBe('0');
    expect(gruppiere('0001234')).toBe(`1${T}234`);
  });

  it('Ergebnisanzeigen verwenden dasselbe Zeichen', () => {
    expect(fmtZahl(1_250_000)).toBe(`1${T}250${T}000`);
    expect(fmtChf(26512.5)).toBe(`CHF 26${T}513`);
    expect(fmtChf(-1500)).toBe(`CHF -1${T}500`);
    expect(T).toBe('\u2019');
  });
});

describe('Tausendertrennzeichen: Parsen (inkl. Einfügen)', () => {
  it.each([
    ['1’250’000', 1_250_000],
    ["1'250'000", 1_250_000],
    ['1 250 000', 1_250_000],
    ['1\u00a0250\u00a0000', 1_250_000],
    ['1,250,000', 1_250_000],
    ['1.250.000', 1_250_000],
    ['1,250', 1250],
    ['1250', 1250],
    ['  42 ', 42],
    ['1’250.50', 1250.5],
    ['1.250,50', 1250.5],
    ['1,250.50', 1250.5],
    ['12,5', 12.5],
    ['-500', -500],
    ['−1’000', -1000],
  ])('«%s» → %d', (text, wert) => {
    expect(parseBetrag(text, { dezimal: true, negativ: true })).toBe(wert);
  });

  it('Punkt mit drei Ziffern: Tausender ohne Nachkommastellen, sonst Dezimal', () => {
    expect(parseBetrag('1.250', { dezimal: false })).toBe(1250);
    expect(parseBetrag('1.250', { dezimal: true })).toBe(1.25);
  });

  it('leer und ungültig', () => {
    expect(parseBetrag('')).toBeNull();
    expect(parseBetrag('-')).toBeNull();
    expect(parseBetrag('abc')).toBeNull();
    expect(parseBetrag('1.2.3')).toBeNull();
    expect(parseBetrag('-5', { negativ: false })).toBeNull();
  });
});

describe('Live-Formatierung und Cursor', () => {
  it('formatiert während des Tippens und behält unvollständige Eingaben', () => {
    expect(formatLive('1250000')).toBe(`1${T}250${T}000`);
    expect(formatLive(`1${T}25`)).toBe('125');
    expect(formatLive('12a3')).toBe('123');
    expect(formatLive('-12', { negativ: true })).toBe('-12');
    expect(formatLive('-12', { negativ: false })).toBe('12');
    expect(formatLive('-', { negativ: true })).toBe('-');
    expect(formatLive('1234.', { dezimal: true })).toBe(`1${T}234.`);
    expect(formatLive('1234,56', { dezimal: true })).toBe(`1${T}234.56`);
    expect(formatLive('1234.56', { dezimal: false })).toBe(`123${T}456`);
    expect(formatLive('')).toBe('');
  });

  it('Tippen am Ende: Trenner erscheint ab der vierten Ziffer, Cursor bleibt am Ende', () => {
    const r = bearbeiteEingabe('999', '9999', 4);
    expect(r.text).toBe(`9${T}999`);
    expect(r.caret).toBe(5);
  });

  it('Tippen in der Mitte: Cursor bleibt hinter der eingefügten Ziffer', () => {
    // «1’2|50» + «3» → «12’3|50»
    const r = bearbeiteEingabe(`1${T}250`, `1${T}2350`, 4);
    expect(r.text).toBe(`12${T}350`);
    expect(r.caret).toBe(4);
  });

  it('Löschen unter 1000: Trenner verschwindet', () => {
    const r = bearbeiteEingabe(`1${T}000`, `1${T}00`, 5);
    expect(r.text).toBe('100');
    expect(r.caret).toBe(3);
  });

  it('Rücktaste direkt hinter einem Trenner löscht die Ziffer davor', () => {
    // «12’|345» Rücktaste → Rohtext «12|345» → Ziffer «2» löschen → «1|345»
    const r = bearbeiteEingabe(`12${T}345`, '12345', 2, {}, 'deleteContentBackward');
    expect(r.text).toBe(`1${T}345`);
    expect(r.caret).toBe(1);
  });

  it('Entf direkt vor einem Trenner löscht die Ziffer danach', () => {
    // «12|’345» Entf → Rohtext «12|345» → «3» löschen → «12|45» → «1’2|45»
    const r = bearbeiteEingabe(`12${T}345`, '12345', 2, {}, 'deleteContentForward');
    expect(r.text).toBe('1245'.replace(/^(\d)/, `$1${T}`));
    expect(r.caret).toBe(3);
  });

  it('Einfügen mitten im Text, Cursor hinter dem eingefügten Block', () => {
    const r = bearbeiteEingabe('', '1 250 000', 9);
    expect(r.text).toBe(`1${T}250${T}000`);
    expect(r.caret).toBe(9);
  });

  it('positionNach: 0 → Anfang, zu gross → Ende', () => {
    expect(positionNach(`1${T}000`, 0)).toBe(0);
    expect(positionNach(`1${T}000`, 1)).toBe(1);
    expect(positionNach(`1${T}000`, 2)).toBe(3);
    expect(positionNach(`1${T}000`, 99)).toBe(5);
  });
});
