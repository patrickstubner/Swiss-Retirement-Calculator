import { afterEach, describe, expect, it, vi } from 'vitest';
import { effektiverHaushalt } from '../core/schaetzwerte';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { bearbeiteRechnung, type RechnungNachricht, type RechnungRueckmeldung, seitenSuche } from './rechnungKern';
import { starteRechnung } from './rechnungLauf';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 1 };

function haushalt() {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: '',
    geburtsjahr: 1980,
    geburtsmonat: 3,
    lohn: 80_000,
    stoppAlter: 65,
    wertschriften: 250_000,
  });
  return { ...h, personen: [p], planungsalter: 90 };
}

function nachricht(): RechnungNachricht {
  const eff = effektiverHaushalt(haushalt(), regeln, heute);
  return { art: 'suche', id: 4, jahr: 2026, monat: 1, haushalt: eff.haushalt, suchModus: 'gemeinsam' };
}

afterEach(() => vi.unstubAllGlobals());

describe('Rechnung im Worker: Abbruch und Ersatz', () => {
  it('ohne Worker: dasselbe Ergebnis im Hauptthread', async () => {
    vi.stubGlobal('Worker', undefined);
    const n = nachricht();
    const direkt = seitenSuche(n.art === 'suche' ? n.haushalt : haushalt(), regeln, heute, 'gemeinsam');
    const m = await new Promise<RechnungRueckmeldung>((fertig) => {
      starteRechnung(n, fertig);
    });
    expect(m.art).toBe('suche');
    if (m.art === 'suche') {
      expect(m.berechnung.wunsch?.endVermoegen).toBe(direkt.wunsch?.endVermoegen);
      expect(m.berechnung.solver?.alterMonate).toBe(direkt.solver?.alterMonate);
      expect(m.berechnung.fehler).toBeNull();
    }
  });

  it('Abbrechen beendet den Worker und verwirft spätere Meldungen', () => {
    const beendet = vi.fn();
    type Dummy = { onmessage: ((e: { data: RechnungRueckmeldung }) => void) | null };
    const halter: { w: Dummy | null } = { w: null };
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: ((e: { data: RechnungRueckmeldung }) => void) | null = null;
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
    const lauf = starteRechnung(nachricht(), rueck);
    const antwort: RechnungRueckmeldung = {
      art: 'suche',
      id: 4,
      berechnung: { wunsch: null, solver: null, fehler: null, dauerMs: 0 },
    };
    halter.w?.onmessage?.({ data: antwort });
    expect(rueck).toHaveBeenCalledTimes(1);
    lauf.abbrechen();
    expect(beendet).toHaveBeenCalled();
    halter.w?.onmessage?.({ data: antwort });
    expect(rueck).toHaveBeenCalledTimes(1);
  });

  it('eine ungültige Suche wird als Fehler gemeldet und nicht geworfen', () => {
    const meldungen: RechnungRueckmeldung[] = [];
    expect(() =>
      bearbeiteRechnung(
        { art: 'suche', id: 2, jahr: 2026, monat: 1, haushalt: null as never, suchModus: 'gemeinsam' },
        (m) => meldungen.push(m),
      ),
    ).not.toThrow();
    const m = meldungen.at(-1);
    expect(m?.art === 'suche' ? m.berechnung.fehler : '').toBeTruthy();
    expect(m?.art === 'suche' ? m.berechnung.wunsch : null).toBeNull();
  });
});
