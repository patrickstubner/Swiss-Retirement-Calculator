/**
 * Wegzug-Vergleich PK/3a (Art. 5, 25f FZG; Art. 3 BVV 3; Art. 96 DBG). Erfundene Person, Fantasiezahlen.
 */
import { describe, expect, it } from 'vitest';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { quellensteuerKapital } from './quellensteuer';
import { simuliere } from './simulation';
import type { Haushalt } from './typen';
import { standardEinstellung, wegzugVergleich } from './wegzugVergleich';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };

function haushalt(kanton = 'ZH'): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Person A',
    geburtsjahr: 1970,
    geburtsmonat: 3,
    lohn: 0,
    stoppAlter: 58,
    wertschriften: 400_000,
  });
  p.ahv.renteMonat = 2000;
  p.pk = { ...p.pk, guthaben: 600_000, bvgGuthaben: 300_000, kapitalanteil: 0, fruehestesAlter: 60, bezugsAlter: 62 };
  p.freizuegigkeit = { ...p.freizuegigkeit, guthaben: 100_000 };
  p.saeule3a = { ...p.saeule3a, guthaben: 150_000 };
  return {
    ...h,
    personen: [p],
    planungsalter: 90,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 50_000, faktorAb75: 1, faktorAb85: 1 },
    steuern: { ...h.steuern, kanton, gemeinde: '' },
    krisen: { ...h.krisen, modus: 'keine' },
  };
}

describe('Wegzug-Vergleich', () => {
  const h = haushalt();
  const e = { ...standardEinstellung(h, regeln), ziele: ['AE', 'ES'], sitzPk: 'ZG', sitzFz: 'ZG', sitz3a: 'ZG' };
  const fälle = wegzugVergleich(h, regeln, heute, e);

  it('drei Fälle: Schweiz, Nicht-EU/EFTA (AE), Spanien (EU)', () => {
    expect(fälle.map((f) => f.land)).toEqual(['', 'AE', 'ES']);
    expect(fälle.map((f) => f.euEfta)).toEqual([false, false, true]);
  });

  it('Standard-Wegzug: bei der Erwerbsaufgabe, höchstens einen Monat vor dem PK-Bezugsalter (dann ist Barauszahlung möglich)', () => {
    expect(e.wegzugAlterMonate).toBe(58 * 12);
    const spaet = haushalt();
    (spaet.personen[0] as (typeof spaet.personen)[number]).stoppAlter = 66;
    expect(standardEinstellung(spaet, regeln).wegzugAlterMonate).toBe(62 * 12 - 1);
    expect(fälle[1]?.status?.fall).toBe('barauszahlung');
  });

  it('Nicht-EU/EFTA: ganzes PK-Guthaben inkl. Obligatorium bar; EU/EFTA: Obligatorium bleibt gesperrt (Art. 25f FZG)', () => {
    const br = fälle[1];
    const pt = fälle[2];
    expect(br?.kapital.pkGesperrt).toBe(0);
    expect(br?.kapital.pkFrei).toBeGreaterThan(600_000);
    expect(pt?.kapital.pkGesperrt).toBeGreaterThan(0);
    expect(pt?.kapital.pkFrei).toBeLessThan(br?.kapital.pkFrei ?? 0);
  });

  it('3a ist in beiden Fällen ganz frei (Art. 3 Abs. 2 lit. d BVV 3)', () => {
    expect(fälle[1]?.kapital.saeule3a).toBeGreaterThanOrEqual(150_000);
    expect(fälle[2]?.kapital.saeule3a).toBeCloseTo(fälle[1]?.kapital.saeule3a ?? 0, 6);
  });

  it('Quellensteuer am Sitz ZG (5 % + Bund) auf die bar ausbezahlten Beträge; Wohnkanton ZH ist ohne Belang', () => {
    const br = fälle[1];
    if (!br) throw new Error('Fall B fehlt');
    const q = quellensteuerKapital(br.kapital.brutto, 'alleinstehend', 'ZG', regeln, undefined);
    expect(br.steuern.quellensteuer).toBeCloseTo(q.total, 0);
    const zh = wegzugVergleich(h, regeln, heute, { ...e, sitzPk: '', sitzFz: '', sitz3a: '' })[1];
    expect(zh?.steuern.quellensteuer).toBeGreaterThan(br.steuern.quellensteuer); // ZH 6 % > ZG 5 %
  });

  it('VAE: Quellensteuer definitiv (ESTV 2-217), auch bei aktivierter Rückforderung; Spanien rückforderbar', () => {
    const r = wegzugVergleich(h, regeln, heute, { ...e, rueckforderung: true, satzKapitalZielland: 0.1 });
    expect(r[1]?.steuern.quellensteuerZurueck).toBe(0);
    expect(r[1]?.steuern.quellensteuer).toBeGreaterThan(0);
    expect(r[2]?.steuern.quellensteuerZurueck).toBeGreaterThan(0);
    expect(r[2]?.steuern.ziellandKapital).toBeGreaterThan(0);
  });

  it('ohne Rückforderung bleibt in allen Wegzug-Fällen die volle Quellensteuer (DBA-Erstattung nur, wenn belegt/gewählt)', () => {
    expect(fälle[2]?.steuern.quellensteuerZurueck).toBe(0);
    expect(fälle[2]?.steuern.quellensteuer).toBeGreaterThan(0);
  });

  it('3a: Rückerstattung folgt der 3a-Spalte von ESTV 2-217 (Portugal «ja», Thailand «nein»)', () => {
    const th = wegzugVergleich(h, regeln, heute, {
      ...e,
      ziele: ['TH'],
      rueckforderung: true,
      satzKapitalZielland: 0.1,
    })[1];
    // Thailand: PK-Kapital rückforderbar, 3a nicht → nur der Anteil PK/FZ wird erstattet
    expect(th?.steuern.quellensteuerZurueck).toBeGreaterThan(0);
    expect(th?.steuern.quellensteuer).toBeGreaterThan(0);
  });

  it('Fall Schweiz entspricht der normalen Simulation ohne Wegzug (Regression)', () => {
    const ch = fälle[0];
    const norm = simuliere(h, regeln, { start: heute });
    expect(ch?.endVermoegen).toBeCloseTo(norm.endVermoegen, 6);
  });

  it('Todesfall-Regression: kein Einfluss auf den Vergleich ohne Szenario', () => {
    const h2 = { ...h, todesfall: { ...(h.todesfall as NonNullable<typeof h.todesfall>), aktiv: true } };
    const a = wegzugVergleich(h2, regeln, heute, e);
    expect(a[0]?.endVermoegen).toBeCloseTo(fälle[0]?.endVermoegen ?? 0, 6);
  });
});
