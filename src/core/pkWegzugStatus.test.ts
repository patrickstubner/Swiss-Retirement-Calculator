/**
 * PK-Reglementsalter und Wegzug (Art. 2 Abs. 1bis FZG): Fallunterscheidung aus der Simulation und die
 * Statuszeile beim Feld. Erfundene Beispielperson, Fantasiezahlen.
 */
import { describe, expect, it } from 'vitest';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { pkWegzugAnzeige } from '../ui/pkWegzugText';
import { pkWegzugStatus, simuliere } from './simulation';
import type { Haushalt, Person, WohnsitzAusland } from './typen';

const regeln = ladeRegeln(2026);
const start = { jahr: 2026, monat: 1 };
const startIdx = 2026 * 12;
const grenzen = regeln.bvg.bezugsalter;

/** Jg. 1975 (heute 50), PK 250 000, Reglementsalter 58, Erwerbsaufgabe und Wegzug im gleichen Alter. */
function person(stoppAlter: number, w: Partial<WohnsitzAusland> | null, fruehestesAlter = 58): Person {
  const p = neuePerson(regeln, { name: 'Test-Person', geburtsjahr: 1975, geburtsmonat: 3, lohn: 90_000, stoppAlter });
  p.pk = { ...p.pk, guthaben: 250_000, bvgGuthaben: 100_000, fruehestesAlter };
  if (w)
    p.wohnsitzAusland = {
      ...p.wohnsitzAusland,
      aktiv: true,
      modus: 'alter',
      alter: stoppAlter,
      land: 'TH',
      barauszahlung: true,
      ...w,
    };
  return p;
}

function haushalt(p: Person): Haushalt {
  const h = standardHaushalt(regeln);
  return {
    ...h,
    personen: [p],
    planungsalter: 90,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 40_000, faktorAb75: 1, faktorAb85: 1 },
  };
}

const status = (p: Person) => pkWegzugStatus(p, Math.round(p.stoppAlter * 12), regeln, startIdx);
const text = (p: Person, name: string | null = null) => pkWegzugAnzeige(status(p), { name }, grenzen);

describe('pkWegzugStatus – gleiche Entscheidung wie die Simulation', () => {
  it('Aufhören und Wegzug mit 57 (ausserhalb EU/EFTA): Barauszahlung, Feld ohne Einfluss', () => {
    const p = person(57, {});
    const s = status(p);
    expect(s.fall).toBe('barauszahlung');
    expect(s.barVoll).toBe(true);
    expect(s.feldOhneWirkung).toBe(true);
    const a = text(p);
    expect(a.gesperrt).toBe(true);
    expect(a.text).toBe(
      'Sie hören mit 57 J. auf und ziehen weg, also vor dem frühesten Bezugsalter. Das Guthaben wird beim Wegzug bar ausbezahlt, das Feld spielt hier keine Rolle.',
    );
    // Simulation: Barauszahlung tatsächlich gerechnet, bei jedem Reglementsalter gleich
    const e58 = simuliere(haushalt(p), regeln, { start });
    const e70 = simuliere(haushalt(person(57, {}, 70)), regeln, { start });
    expect(e58.personen[0]?.barauszahlung?.pk).toBeGreaterThan(0);
    expect(e58.personen[0]?.pkWegzug).toEqual(s);
    expect(e70.endVermoegen).toBeCloseTo(e58.endVermoegen, 6);
  });

  it('Aufhören und Wegzug mit 63 nach Reglementsalter 58 (ausserhalb EU/EFTA): Pensionierung, keine Barauszahlung', () => {
    const p = person(63, {});
    const s = status(p);
    expect(s.fall).toBe('pensionierung');
    expect(s.feldOhneWirkung).toBe(false);
    expect(s.grenzeReglementsalter).toBe(63);
    const a = text(p);
    expect(a.gesperrt).toBe(false);
    expect(a.text).toBe(
      'Sie hören mit 63 J. auf und ziehen weg, also nach dem frühesten Bezugsalter 58. Das gilt als Pensionierung: Rente oder Kapital nach Reglement, keine Barauszahlung wegen Wegzug. Mit einem Reglementsalter über 63 wäre eine Barauszahlung möglich.',
    );
    const e = simuliere(haushalt(p), regeln, { start });
    expect(e.personen[0]?.barauszahlung).toBeNull();
    expect(e.personen[0]?.hinweise.some((h) => h.includes('Art. 2 Abs. 1bis FZG'))).toBe(true);
    // Mit Reglementsalter 64 wird daraus eine Barauszahlung – genau wie im Text angekündigt
    const p64 = person(63, {}, 64);
    expect(status(p64).fall).toBe('barauszahlung');
    expect(simuliere(haushalt(p64), regeln, { start }).personen[0]?.barauszahlung?.pk).toBeGreaterThan(0);
    expect(text(p64).text).toContain('Mit einem Reglementsalter von 63 oder tiefer wäre es eine Pensionierung');
    expect(text(p64).gesperrt).toBe(false);
  });

  it('Wegzug in die EU/EFTA mit 57: nur der überobligatorische Teil bar', () => {
    const p = person(57, { land: 'PT' });
    const s = status(p);
    expect(s.fall).toBe('barauszahlung');
    expect(s.euEfta).toBe(true);
    expect(s.barVoll).toBe(false);
    const a = text(p);
    expect(a.gesperrt).toBe(true);
    expect(a.text).toBe(
      'Sie hören mit 57 J. auf und ziehen weg, also vor dem frühesten Bezugsalter. Beim Wegzug wird der überobligatorische Teil bar ausbezahlt, der obligatorische Teil bleibt auf einem Freizügigkeitskonto gesperrt (EU/EFTA, Art. 25f FZG), das Feld spielt hier keine Rolle.',
    );
    const bar = simuliere(haushalt(p), regeln, { start }).personen[0]?.barauszahlung;
    expect(bar?.pkGesperrt).toBeGreaterThan(0);
    // EU/EFTA, aber nicht obligatorisch versichert: ganzes Guthaben; Liechtenstein: immer nur Überobligatorium
    expect(status(person(57, { land: 'PT', nichtObligatorischVersichert: true })).barVoll).toBe(true);
    expect(status(person(57, { land: 'LI', nichtObligatorischVersichert: true })).barVoll).toBe(false);
  });

  it('ohne Wegzug: vor dem Reglementsalter gesperrt, danach Pensionierung; Feld bleibt editierbar', () => {
    const vor = person(56, null, 60);
    expect(status(vor).fall).toBe('ohneWegzug');
    expect(text(vor)).toEqual({
      text: 'Ohne Wegzug: Sie hören mit 56 J. auf, also vor dem frühesten Bezugsalter 60. Das Guthaben bleibt bis dahin gesperrt und wird weiter verzinst, ab 60 J. Rente oder Kapital nach Reglement.',
      gesperrt: false,
    });
    const nach = person(64, null, 60);
    expect(text(nach, 'Muster-Anna').text).toBe(
      'Ohne Wegzug: Muster-Anna hört mit 64 J. auf, also nach dem frühesten Bezugsalter 60. Das gilt als Pensionierung: ab 64 J. Rente oder Kapital nach Reglement.',
    );
  });

  it('Wegzug ohne Barauszahlung und fehlendes Land', () => {
    const ohne = person(57, { barauszahlung: false });
    expect(status(ohne).fall).toBe('ohneBarauszahlung');
    expect(text(ohne).text.startsWith('Wegzug ohne Barauszahlung: Sie hören mit 57 J. auf')).toBe(true);
    expect(text(ohne).gesperrt).toBe(false);
    const fehlt = person(57, { land: '' });
    expect(status(fehlt).fall).toBe('landFehlt');
    expect(text(fehlt).gesperrt).toBe(false);
  });

  it('gesperrt nur, wenn das Reglementsalter nachweislich keine Rolle spielt', () => {
    // Wegzug mit 57, aber Weiterarbeit (im Ausland) bis 62: bei jedem Reglementsalter Barauszahlung
    const weiter = person(62, { alter: 57 });
    expect(status(weiter).feldOhneWirkung).toBe(true);
    // Wegzug mit 59 und Aufhören mit 59, Reglementsalter 62: Barauszahlung, aber mit Reglementsalter ≤ 59 nicht
    const knapp = person(59, {}, 62);
    expect(status(knapp).fall).toBe('barauszahlung');
    expect(status(knapp).feldOhneWirkung).toBe(false);
    expect(text(knapp).gesperrt).toBe(false);
    // Wegzug nach 70: auch mit dem höchsten Reglementsalter keine Barauszahlung
    const spaet = person(71, {});
    expect(text(spaet).text).toContain('auch mit dem höchsten Reglementsalter 70 nicht möglich');
  });
});
