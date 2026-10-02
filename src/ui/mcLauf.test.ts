import { afterEach, describe, expect, it, vi } from 'vitest';
import { monteCarlo } from '../core/montecarlo';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { KRISEN_DATEN, mcKrisenPool } from '../data/krisen';
import { ladeRegeln } from '../rules';
import { bearbeiteMcNachricht, type McNachricht, type McRueckmeldung, vollMonteCarlo } from './mcKern';
import { starteMc } from './mcLauf';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 1 };

/** Erfundenes Beispiel */
function haushalt() {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Muster',
    geburtsjahr: 1970,
    geburtsmonat: 6,
    lohn: 90_000,
    stoppAlter: 63,
    wertschriften: 500_000,
  });
  return { ...h, personen: [p], planungsalter: 92 };
}

const einstellung = {
  art: 'wiederkehrend' as const,
  laeufe: 60,
  seed: 20260927,
  krisenProDekade: 1,
  blockLaenge: 5,
  bootstrapLand: 'CHE' as const,
};

afterEach(() => vi.unstubAllGlobals());

describe('Monte Carlo: Worker-Nachrichten und Ersatz im Hauptthread', () => {
  it('Fortschritt ändert das Ergebnis nicht (gleicher Seed, gleiche Zahlen wie direkt)', () => {
    const h = haushalt();
    const direkt = monteCarlo(h, regeln, heute, einstellung, KRISEN_DATEN, mcKrisenPool());
    const stand: number[] = [];
    const mitFortschritt = vollMonteCarlo(h, regeln, heute, einstellung, (fertig, von) => {
      expect(von).toBe(60);
      stand.push(fertig);
    });
    expect(mitFortschritt).toEqual(direkt);
    expect(stand.at(-1)).toBe(60);
    expect(stand.length).toBeGreaterThan(1);
    expect([...stand].sort((a, b) => a - b)).toEqual(stand);
  });

  it('bearbeiteMcNachricht (Worker-Code) liefert dasselbe wie die direkte Rechnung', () => {
    const h = haushalt();
    const direkt = monteCarlo(h, regeln, heute, einstellung, KRISEN_DATEN, mcKrisenPool());
    const meldungen: McRueckmeldung[] = [];
    bearbeiteMcNachricht({ art: 'voll', id: 7, jahr: heute.jahr, monat: heute.monat, haushalt: h, einstellung }, (m) =>
      meldungen.push(m),
    );
    const letzte = meldungen.at(-1);
    expect(letzte?.art).toBe('voll');
    expect(letzte && 'ergebnis' in letzte ? letzte.ergebnis : null).toEqual(direkt);
    expect(meldungen.every((m) => m.id === 7)).toBe(true);
    expect(meldungen.some((m) => m.art === 'fortschritt')).toBe(true);
  });

  it('Nachrichten überstehen die Strukturkopie des Workers (structuredClone) mit gleichem Ergebnis', () => {
    const h = haushalt();
    const n: McNachricht = { art: 'voll', id: 1, jahr: 2026, monat: 1, haushalt: h, einstellung };
    const a: McRueckmeldung[] = [];
    const b: McRueckmeldung[] = [];
    bearbeiteMcNachricht(n, (m) => a.push(m));
    bearbeiteMcNachricht(structuredClone(n), (m) => b.push(structuredClone(m)));
    expect(b.at(-1)).toEqual(a.at(-1));
  });

  it('Fehler werden gemeldet statt geworfen', () => {
    const meldungen: McRueckmeldung[] = [];
    bearbeiteMcNachricht({ art: 'voll', id: 2, jahr: 2026, monat: 1, haushalt: null as never, einstellung }, (m) =>
      meldungen.push(m),
    );
    expect(meldungen.at(-1)?.art).toBe('fehler');
  });

  it('ohne Worker (Fallback): gleiches Ergebnis im Hauptthread, Fortschritt kommt an', async () => {
    vi.stubGlobal('Worker', undefined);
    const h = haushalt();
    const direkt = monteCarlo(h, regeln, heute, einstellung, KRISEN_DATEN, mcKrisenPool());
    const meldungen: McRueckmeldung[] = [];
    await new Promise<void>((fertig) => {
      starteMc({ art: 'voll', id: 3, jahr: 2026, monat: 1, haushalt: h, einstellung }, (m) => {
        meldungen.push(m);
        if (m.art === 'voll' || m.art === 'fehler') fertig();
      });
    });
    const letzte = meldungen.at(-1);
    expect(letzte && 'ergebnis' in letzte ? letzte.ergebnis : null).toEqual(direkt);
    expect(meldungen.some((m) => m.art === 'fortschritt')).toBe(true);
  });

  it('Worker-Start wirft (z. B. blockiert): Fallback im Hauptthread mit gleichem Ergebnis', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('blockiert');
        }
      },
    );
    const h = haushalt();
    const direkt = monteCarlo(h, regeln, heute, einstellung, KRISEN_DATEN, mcKrisenPool());
    const letzte = await new Promise<McRueckmeldung>((fertig) => {
      starteMc({ art: 'voll', id: 4, jahr: 2026, monat: 1, haushalt: h, einstellung }, (m) => {
        if (m.art !== 'fortschritt') fertig(m);
      });
    });
    expect(letzte.art === 'voll' ? letzte.ergebnis : null).toEqual(direkt);
  });

  it('Worker meldet onerror: einmaliger Fallback im Hauptthread', async () => {
    let instanz: { onerror: (() => void) | null } | null = null;
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: unknown = null;
        onerror: (() => void) | null = null;
        constructor() {
          instanz = this;
        }
        postMessage() {
          queueMicrotask(() => this.onerror?.());
        }
        terminate() {}
      },
    );
    const h = haushalt();
    const direkt = monteCarlo(h, regeln, heute, einstellung, KRISEN_DATEN, mcKrisenPool());
    const letzte = await new Promise<McRueckmeldung>((fertig) => {
      starteMc({ art: 'voll', id: 5, jahr: 2026, monat: 1, haushalt: h, einstellung }, (m) => {
        if (m.art !== 'fortschritt') fertig(m);
      });
    });
    expect(instanz).not.toBeNull();
    expect(letzte.art === 'voll' ? letzte.ergebnis : null).toEqual(direkt);
  });

  it('Abbrechen beendet den Worker und liefert danach keine Meldung mehr', () => {
    const beendet = vi.fn();
    type Dummy = { onmessage: ((e: { data: McRueckmeldung }) => void) | null };
    const halter: { w: Dummy | null } = { w: null };
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: ((e: { data: McRueckmeldung }) => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {
          halter.w = this;
        }
        postMessage() {}
        terminate() {
          beendet();
        }
      },
    );
    const rueck = vi.fn();
    const lauf = starteMc({ art: 'voll', id: 6, jahr: 2026, monat: 1, haushalt: haushalt(), einstellung }, rueck);
    halter.w?.onmessage?.({ data: { art: 'fortschritt', id: 6, fertig: 10, von: 60 } });
    expect(rueck).toHaveBeenCalledTimes(1);
    lauf.abbrechen();
    expect(beendet).toHaveBeenCalled();
    halter.w?.onmessage?.({ data: { art: 'fortschritt', id: 6, fertig: 20, von: 60 } });
    expect(rueck).toHaveBeenCalledTimes(1);
  });

  it('Vergleich: Worker-Nachricht rechnet beide Versionen wie bisher', () => {
    const h = haushalt();
    const meldungen: McRueckmeldung[] = [];
    bearbeiteMcNachricht({ art: 'vergleich', id: 8, jahr: 2026, monat: 1, haushalte: [h, h], laeufe: 50 }, (m) =>
      meldungen.push(m),
    );
    const m = meldungen.at(-1);
    expect(m?.art).toBe('vergleich');
    if (m?.art === 'vergleich') {
      expect(m.ergebnisse).toHaveLength(2);
      expect(m.ergebnisse[0]).toEqual(m.ergebnisse[1]);
    }
  });
});
