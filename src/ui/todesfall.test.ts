import { describe, expect, it } from 'vitest';
import { entnahmeAusgaben } from '../core/entnahme';
import type { Haushalt, Todesfall } from '../core/typen';
import { neueAusgaben, neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import {
  einkommenVorNach,
  MATRIX_ALTER,
  todesAlterRef,
  todesfallMatrix,
  todesfallMoeglich,
  todesfallVergleich,
} from './todesfall';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };
const tf: Todesfall = {
  aktiv: true,
  person: 0,
  modus: 'alter',
  alter: 80,
  jahr: 2040,
  ausgabenFaktor: 0.67,
  ehejahre: 30,
  kinder: false,
  splitting: false,
};

function paar(): Haushalt {
  const h = standardHaushalt(regeln);
  const a = neuePerson(regeln, { name: 'Person A', geburtsjahr: 1960, geburtsmonat: 3, geschlecht: 'm', lohn: 0 });
  a.stoppAlter = 0;
  a.ahv = { ...a.ahv, modus: 'eingabe', renteMonat: 2400, beitragsjahre: 44 };
  a.pk = { ...a.pk, guthaben: 400_000, umwandlungssatz: 0.055, kapitalanteil: 0, fruehestesAlter: 60, bezugsAlter: 65 };
  a.wertschriften = 900_000;
  const b = neuePerson(regeln, { name: 'Person B', geburtsjahr: 1964, geburtsmonat: 9, geschlecht: 'w', lohn: 0 });
  b.stoppAlter = 0;
  b.ahv = { ...b.ahv, modus: 'eingabe', renteMonat: 1600, beitragsjahre: 40 };
  return {
    ...h,
    zivilstand: 'verheiratet',
    personen: [a, b],
    planungsalter: 95,
    ausgaben: { ...neueAusgaben(), lebenshaltung: 70_000, faktorAb75: 1, faktorAb85: 1 },
    steuern: { ...h.steuern, kanton: 'ZH', gemeinde: 'Zürich' },
    krisen: { ...h.krisen, modus: 'automatisch' },
    entnahme: entnahmeAusgaben(),
  };
}

describe('Todesfall-Vergleich (UI-Logik)', () => {
  it('Szenario nur für Ehepaare', () => {
    expect(todesfallMoeglich(paar())).toBe(true);
    expect(todesfallMoeglich({ ...paar(), zivilstand: 'alleinstehend' })).toBe(false);
  });

  it('vergleicht mit und ohne Todesfall bei derselben Krisen-Einstellung (Automatisch)', () => {
    const v = todesfallVergleich(paar(), regeln, heute, tf);
    expect(v.ohne.krisenJahre.length).toBeGreaterThan(0);
    expect(v.mit.krisenJahre).toEqual(v.ohne.krisenJahre);
    expect(v.mit.todesfall).toBeTruthy();
    expect(v.ohne.todesfall).toBeUndefined();
    // Person A (Jg. 1960) stirbt mit 80 im Jahr 2040; Person B (Jg. 1964) ist dann 76
    expect(todesAlterRef(v.mit, 1)).toBe(76);
    expect(v.mit.todesfall?.jahr).toBe(2040);
  });

  it('Einkommen vor/nach dem Tod: AHV und Einkommen sinken, Ausgaben sinken um den Faktor', () => {
    const v = todesfallVergleich(paar(), regeln, heute, tf);
    const e = einkommenVorNach(v.mit);
    expect(e).not.toBeNull();
    expect(e!.nachher).toBeLessThan(e!.vorher);
    expect(e!.ausgabenNachher / e!.ausgabenVorher).toBeCloseTo(0.67, 6);
  });

  it('Matrix: 2 Personen × 3 Alter, spätere Todesfälle belasten das Vermögen weniger', () => {
    const m = todesfallMatrix(paar(), regeln, heute, { ...tf, ausgabenFaktor: 1 });
    expect(m).toHaveLength(2);
    expect(m[0]).toHaveLength(MATRIX_ALTER.length);
    for (const zeile of m) for (const z of zeile) expect(Number.isFinite(z.endVermoegen)).toBe(true);
    // Person A (Jg. 1960) ist heute 66: Tod mit 70 möglich
    expect(m[0]![0]!.moeglich).toBe(true);
    // Je später A stirbt, desto mehr Endvermögen (ohne Ausgabensenkung)
    expect(m[0]![2]!.endVermoegen).toBeGreaterThanOrEqual(m[0]![0]!.endVermoegen);
  });
});

describe('Monte Carlo mit Todesfall', () => {
  it('gleicher Startwert: der Todesfall senkt die Erfolgsquote nicht ab, wenn die Ausgaben mit sinken; Fächer hat gleiche Länge', async () => {
    const { todesfallMonteCarlo } = await import('./todesfall');
    const h = { ...paar(), krisen: { ...paar().krisen, mcLaeufe: 50 } };
    const r = todesfallMonteCarlo(h, regeln, heute, tf);
    expect(r.mit.jahre).toEqual(r.ohne.jahre);
    expect(r.mit.laeufe).toBe(50);
    expect(r.mit.p50.length).toBe(r.ohne.p50.length);
    // Ohne Todesfall gleich wie ein zweiter Lauf (deterministisch)
    expect(todesfallMonteCarlo(h, regeln, heute, tf).ohne.erfolgsquote).toBe(r.ohne.erfolgsquote);
  });
});
