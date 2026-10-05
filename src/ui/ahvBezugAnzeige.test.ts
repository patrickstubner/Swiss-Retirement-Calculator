import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ahvRentenbeginn, monatBeiAlter } from '../core/ahv';
import { ladeRegeln } from '../rules';
import {
  AHV_HINWEIS_GEBURTSTAG_ERSTER,
  AHV_HINWEIS_VERGANGENHEIT,
  ahvBeginnInVergangenheit,
  ahvBezugAnzeigen,
  ahvBezugSatz,
  ahvBezugZeitpunkt,
  fmtJahreMonate,
  fmtMonatszahl,
} from './ahvBezugAnzeige';

const ahv = ladeRegeln(2026).ahv;
const ahv27 = ladeRegeln(2027).ahv;

describe('fmtJahreMonate / fmtMonatszahl', () => {
  it('Jahre und Monate, Einzahl und Mehrzahl', () => {
    expect(fmtJahreMonate(0)).toBe('0 Monate');
    expect(fmtJahreMonate(1)).toBe('1 Monat');
    expect(fmtJahreMonate(2)).toBe('2 Monate');
    expect(fmtJahreMonate(12)).toBe('1 Jahr');
    expect(fmtJahreMonate(13)).toBe('1 Jahr und 1 Monat');
    expect(fmtJahreMonate(14)).toBe('1 Jahr und 2 Monate');
    expect(fmtJahreMonate(24)).toBe('2 Jahre');
    expect(fmtJahreMonate(64 * 12 + 3)).toBe('64 Jahre und 3 Monate');
    expect(fmtJahreMonate(65 * 12)).toBe('65 Jahre');
    expect(fmtMonatszahl(1)).toBe('1 Monat');
    expect(fmtMonatszahl(24)).toBe('24 Monate');
  });
});

describe('AHV-Bezug: Zeitpunkt und Alter', () => {
  it('Mann, Referenzalter 65: Rente im Folgemonat, Alter ein Monat höher', () => {
    const z = ahvBezugZeitpunkt(1980, 6, 'm', 0, ahv);
    expect(z.art).toBe('referenzalter');
    expect(z.referenzalter).toEqual({ jahre: 65, monate: 0 });
    expect(z.erreicht).toEqual({ jahr: 2045, monat: 6 });
    expect(z.alterErreichtMonate).toBe(65 * 12);
    expect(z.beginn).toEqual({ jahr: 2045, monat: 7 });
    expect(z.beginn).toEqual(ahvRentenbeginn(1980, 6, 65 * 12, 0));
    expect(z.alterBeiBeginnMonate).toBe(65 * 12 + 1);
    expect(z.beginn).toEqual(monatBeiAlter(1980, 6, z.alterBeiBeginnMonate));
    expect(ahvBezugSatz(z)).toBe(
      'Referenzalter: 65 Jahre, erreicht im Juni 2045. Die Rente beginnt am 1. Juli 2045. Sie sind dann 65 Jahre und 1 Monat alt.',
    );
  });

  it('Vorbezug 24 und 1 Monat, Aufschub 15 Monate', () => {
    const frueh = ahvBezugZeitpunkt(1980, 6, 'm', -24, ahv);
    expect(frueh.art).toBe('vorbezug');
    expect(frueh.erreicht).toEqual({ jahr: 2043, monat: 6 });
    expect(frueh.alterErreichtMonate).toBe(63 * 12);
    expect(frueh.beginn).toEqual(ahvRentenbeginn(1980, 6, 65 * 12, -24));
    expect(frueh.beginn).toEqual({ jahr: 2043, monat: 7 });
    expect(frueh.alterBeiBeginnMonate).toBe(63 * 12 + 1);
    expect(ahvBezugSatz(frueh, 'fruehest')).toContain('24 Monate früher (frühestmöglich)');
    expect(ahvBezugSatz(frueh, 'fruehest')).toContain('1. Juli 2043');
    expect(ahvBezugSatz(frueh, 'fruehest')).toContain('63 Jahre und 1 Monat alt');

    const einMonat = ahvBezugZeitpunkt(1970, 1, 'm', -1, ahv);
    expect(einMonat.alterErreichtMonate).toBe(64 * 12 + 11);
    expect(einMonat.erreicht).toEqual({ jahr: 2034, monat: 12 });
    expect(einMonat.beginn).toEqual({ jahr: 2035, monat: 1 });
    expect(einMonat.alterBeiBeginnMonate).toBe(65 * 12);
    expect(ahvBezugSatz(einMonat)).toBe(
      'Vorbezug: 1 Monat früher. Alter 64 Jahre und 11 Monate, erreicht im Dezember 2034. Die Rente beginnt am 1. Januar 2035. Sie sind dann 65 Jahre alt.',
    );

    const aufschub = ahvBezugZeitpunkt(1980, 6, 'm', 15, ahv);
    expect(aufschub.art).toBe('aufschub');
    expect(aufschub.alterErreichtMonate).toBe(66 * 12 + 3);
    expect(aufschub.erreicht).toEqual({ jahr: 2046, monat: 9 });
    expect(aufschub.beginn).toEqual({ jahr: 2046, monat: 10 });
    expect(aufschub.alterBeiBeginnMonate).toBe(66 * 12 + 4);
    expect(aufschub.beginn).toEqual(ahvRentenbeginn(1980, 6, 65 * 12, 15));
    expect(ahvBezugSatz(aufschub)).toContain('15 Monate später');
    expect(ahvBezugSatz(aufschub)).toContain('1. Oktober 2046');
    expect(ahvBezugSatz(aufschub)).toContain('66 Jahre und 4 Monate alt');
  });

  it('Aufschub Minimum 12 und Maximum 60', () => {
    const min = ahvBezugZeitpunkt(1970, 1, 'm', 12, ahv);
    expect(min.erreicht).toEqual({ jahr: 2036, monat: 1 });
    expect(min.beginn).toEqual({ jahr: 2036, monat: 2 });
    expect(min.alterBeiBeginnMonate).toBe(66 * 12 + 1);
    expect(ahvBezugSatz(min, 'minimum')).toContain('12 Monate später (mindestens)');

    const max = ahvBezugZeitpunkt(1970, 1, 'm', 60, ahv);
    expect(max.alterErreichtMonate).toBe(70 * 12);
    expect(max.erreicht).toEqual({ jahr: 2040, monat: 1 });
    expect(max.beginn).toEqual({ jahr: 2040, monat: 2 });
    expect(max.alterBeiBeginnMonate).toBe(70 * 12 + 1);
  });

  it.each([
    [1960, 5, 64, 0, 2024, 5, 2024, 6],
    [1961, 8, 64, 3, 2025, 11, 2025, 12],
    [1962, 12, 64, 6, 2027, 6, 2027, 7],
    [1963, 2, 64, 9, 2027, 11, 2027, 12],
    [1964, 5, 65, 0, 2029, 5, 2029, 6],
    [1985, 3, 65, 0, 2050, 3, 2050, 4],
  ] as const)(
    'Frau Jg. %i, Monat %i: Referenzalter %i J. %i Mt., erreicht %i-%i, Rente ab %i-%i',
    (jahr, monat, rj, rm, ej, em, bj, bm) => {
      const z = ahvBezugZeitpunkt(jahr, monat, 'w', 0, ahv);
      expect(z.referenzalter).toEqual({ jahre: rj, monate: rm });
      expect(z.erreicht).toEqual({ jahr: ej, monat: em });
      expect(z.beginn).toEqual({ jahr: bj, monat: bm });
      expect(z.beginn).toEqual(ahvRentenbeginn(jahr, monat, rj * 12 + rm, 0));
      expect(z.alterBeiBeginnMonate).toBe(rj * 12 + rm + 1);
      expect(ahvBezugSatz(z)).toContain(`Referenzalter: ${fmtJahreMonate(rj * 12 + rm)}`);
      expect(ahvBezugSatz(z)).toContain('Sie sind dann');
    },
  );

  it('Übergang Frau: Vorbezug ab 62 (27 bzw. 36 Monate) und Aufschub über den Jahreswechsel', () => {
    const frau1961 = ahvBezugZeitpunkt(1961, 8, 'w', -27, ahv);
    expect(frau1961.referenzalter).toEqual({ jahre: 64, monate: 3 });
    expect(frau1961.alterErreichtMonate).toBe(62 * 12);
    expect(frau1961.erreicht).toEqual({ jahr: 2023, monat: 8 });
    expect(frau1961.beginn).toEqual({ jahr: 2023, monat: 9 });
    expect(frau1961.alterBeiBeginnMonate).toBe(62 * 12 + 1);
    expect(frau1961.beginn).toEqual(ahvRentenbeginn(1961, 8, 64 * 12 + 3, -27));

    const frau1964 = ahvBezugZeitpunkt(1964, 5, 'w', -36, ahv);
    expect(frau1964.referenzalterMonate).toBe(65 * 12);
    expect(frau1964.alterErreichtMonate).toBe(62 * 12);
    expect(frau1964.beginn).toEqual({ jahr: 2026, monat: 6 });
    expect(frau1964.alterBeiBeginnMonate).toBe(62 * 12 + 1);

    const dezember = ahvBezugZeitpunkt(1962, 12, 'w', -1, ahv);
    expect(dezember.referenzalter).toEqual({ jahre: 64, monate: 6 });
    expect(dezember.erreicht).toEqual({ jahr: 2027, monat: 5 });
    expect(dezember.beginn).toEqual({ jahr: 2027, monat: 6 });
    expect(dezember.alterBeiBeginnMonate).toBe(64 * 12 + 6);

    const spaet = ahvBezugZeitpunkt(1962, 12, 'w', 60, ahv);
    expect(spaet.alterErreichtMonate).toBe(69 * 12 + 6);
    expect(spaet.erreicht).toEqual({ jahr: 2032, monat: 6 });
    expect(spaet.beginn).toEqual({ jahr: 2032, monat: 7 });
    expect(spaet.alterBeiBeginnMonate).toBe(69 * 12 + 7);
  });

  it('Regeljahr 2027 ändert das Referenzalter dieser Jahrgänge nicht', () => {
    const a = ahvBezugZeitpunkt(1980, 6, 'm', -24, ahv);
    const b = ahvBezugZeitpunkt(1980, 6, 'm', -24, ahv27);
    expect(b.referenzalter).toEqual(a.referenzalter);
    expect(b.beginn).toEqual(a.beginn);
    expect(b.alterBeiBeginnMonate).toEqual(a.alterBeiBeginnMonate);
    const frau = ahvBezugZeitpunkt(1962, 12, 'w', 0, ahv27);
    expect(frau.referenzalter).toEqual({ jahre: 64, monate: 6 });
    expect(frau.beginn).toEqual({ jahr: 2027, monat: 7 });
  });
});

describe('AHV-Bezug: Texte aller drei Varianten', () => {
  it('im Referenzalter: gesetzliches Alter plus Voreinstellung für Vorbezug und Aufschub', () => {
    const a = ahvBezugAnzeigen(1980, 6, 'm', 0, ahv);
    expect(a.art).toBe('referenzalter');
    expect(a.saetze.referenzalter).toBe(
      'Referenzalter: 65 Jahre, erreicht im Juni 2045. Die Rente beginnt am 1. Juli 2045. Sie sind dann 65 Jahre und 1 Monat alt.',
    );
    expect(a.vorbezug.verschiebungMonate).toBe(-24);
    expect(a.saetze.vorbezug).toContain('24 Monate früher (frühestmöglich)');
    expect(a.saetze.vorbezug).toContain('1. Juli 2043');
    expect(a.aufschub.verschiebungMonate).toBe(12);
    expect(a.saetze.aufschub).toContain('12 Monate später (mindestens)');
    expect(a.saetze.aufschub).toContain('1. Juli 2046');
    expect(a.saetze.aufschub).toContain('66 Jahre und 1 Monat alt');
    for (const s of Object.values(a.saetze)) {
      expect(s).toContain('Sie sind dann');
      expect(s).not.toMatch(/ß/);
    }
  });

  it('gewählter Vorbezug unter dem Maximum nennt die Monate ohne «frühestmöglich»', () => {
    const a = ahvBezugAnzeigen(1980, 6, 'm', -18, ahv);
    expect(a.art).toBe('vorbezug');
    expect(a.saetze.vorbezug).toContain('18 Monate früher.');
    expect(a.saetze.vorbezug).not.toContain('frühestmöglich');
    expect(a.saetze.vorbezug).toContain('1. Januar 2044');
    expect(a.saetze.vorbezug).toContain('63 Jahre und 7 Monate alt');
    expect(a.saetze.referenzalter).toContain('65 Jahre');
    expect(a.aufschub.verschiebungMonate).toBe(12);
  });

  it('gewählter Aufschub über dem Minimum', () => {
    const a = ahvBezugAnzeigen(1961, 8, 'w', 24, ahv);
    expect(a.referenzalter.referenzalter).toEqual({ jahre: 64, monate: 3 });
    expect(a.saetze.referenzalter).toContain('64 Jahre und 3 Monate');
    expect(a.saetze.referenzalter).toContain('1. Dezember 2025');
    expect(a.saetze.aufschub).toContain('24 Monate später.');
    expect(a.saetze.aufschub).not.toContain('mindestens');
    expect(a.saetze.aufschub).toContain('1. Dezember 2027');
    expect(a.saetze.aufschub).toContain('66 Jahre und 4 Monate alt');
    expect(a.vorbezug.verschiebungMonate).toBe(-27);
    expect(a.saetze.vorbezug).toContain('27 Monate früher (frühestmöglich)');
    expect(a.saetze.vorbezug).toContain('1. September 2023');
  });
});

describe('AHV-Bezug: Hinweise Monatserster und Vergangenheit', () => {
  it('nennt den Monatsersten in einem Satz', () => {
    expect(AHV_HINWEIS_GEBURTSTAG_ERSTER).toBe('Bei Geburt am 1. eines Monats beginnt die Rente einen Monat früher.');
    expect(AHV_HINWEIS_GEBURTSTAG_ERSTER).not.toMatch(/ß/);
    expect(AHV_HINWEIS_VERGANGENHEIT).toBe('Dieser Rentenbeginn wäre bereits möglich gewesen.');
    expect(AHV_HINWEIS_VERGANGENHEIT).not.toMatch(/ß/);
  });

  it('erkennt einen Rentenbeginn vor dem aktuellen Monat', () => {
    const heute = { jahr: 2026, monat: 10 };
    expect(ahvBeginnInVergangenheit({ jahr: 2025, monat: 12 }, heute)).toBe(true);
    expect(ahvBeginnInVergangenheit({ jahr: 2026, monat: 9 }, heute)).toBe(true);
    expect(ahvBeginnInVergangenheit({ jahr: 2026, monat: 10 }, heute)).toBe(false);
    expect(ahvBeginnInVergangenheit({ jahr: 2026, monat: 11 }, heute)).toBe(false);
    const frau = ahvBezugZeitpunkt(1965, 6, 'w', -36, ahv);
    expect(frau.beginn).toEqual({ jahr: 2027, monat: 7 });
    expect(ahvBeginnInVergangenheit(frau.beginn, heute)).toBe(false);
    expect(ahvBeginnInVergangenheit(frau.beginn, { jahr: 2028, monat: 1 })).toBe(true);
  });

  it('die Oberfläche zeigt den Monatsersten einmal und die Vergangenheit je Variante', () => {
    const ui = readFileSync(resolve(__dirname, 'schritte/EinkommenVorsorge.tsx'), 'utf8');
    const anzeige = readFileSync(resolve(__dirname, 'ahvBezugAnzeige.ts'), 'utf8');
    expect(ui).toContain('hinweis={AHV_HINWEIS_GEBURTSTAG_ERSTER}');
    expect(ui).not.toContain('bezugZeit.saetze[bezugZeit.art]');
    expect(ui).toContain('AHV_HINWEIS_VERGANGENHEIT');
    expect(ui).toContain('ahvBeginnInVergangenheit');
    expect(ui).not.toContain('ahvBezugOptionLabel');
    expect(anzeige).not.toContain('ahvBezugOptionLabel');
  });
});
