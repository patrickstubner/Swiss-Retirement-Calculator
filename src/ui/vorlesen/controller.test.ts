import { describe, expect, it } from 'vitest';
import { Vorleser } from './controller';
import { FakeSynth, fakeUmgebung } from './fake';
import { planeSaetze } from './plan';

const TEXT = ['Erster Satz hier. Zweiter Satz kommt. Dritter Satz folgt.', 'Vierter Absatz. Fünfter Satz.'];

/** 12 Sätze à ca. 5 s Sprechzeit */
const LANG = [
  Array.from({ length: 12 }, (_, i) => `Dies ist der ${i + 1}. lange Satz mit genug Text für etwa fünf Sekunden.`).join(
    ' ',
  ),
];

function aufbau(synth?: FakeSynth, text: string[] = TEXT) {
  const u = fakeUmgebung(synth);
  const v = new Vorleser(u.env);
  const saetze = planeSaetze(text);
  return { ...u, v, saetze };
}

describe('Vorleser (mit Fake-speechSynthesis)', () => {
  it('spricht Satz für Satz, meldet Fortschritt und endet leer', () => {
    const { v, synth, saetze } = aufbau();
    expect(saetze.length).toBe(5);
    expect(v.start(saetze)).toBe(true);
    expect(synth.gesprochen.length).toBe(1);
    expect(synth.gesprochen[0]?.text).toBe('Erster Satz hier.');
    expect(v.ansicht().status).toBe('spielt');
    expect(v.ansicht().satz).toEqual({ block: 0, von: 0, bis: 17 });
    for (let i = 1; i < 5; i++) {
      synth.starte();
      synth.beende();
      expect(synth.gesprochen.length).toBe(i + 1);
      expect(v.ansicht().index).toBe(i);
    }
    synth.starte();
    synth.beende();
    expect(v.ansicht().status).toBe('leer');
    expect(v.ansicht().satz).toBeNull();
  });

  it('Wortgrenzen (boundary) markieren das Wort im Blocktext', () => {
    const { v, synth, saetze } = aufbau();
    v.start(saetze);
    synth.starte();
    synth.aktiv?.onboundary?.({ name: 'word', charIndex: 7 });
    const w = v.ansicht().wort;
    expect(TEXT[0]?.slice(w?.von, w?.bis)).toBe('Satz');
    // Satz-Ereignisse ignorieren
    synth.aktiv?.onboundary?.({ name: 'sentence', charIndex: 0 });
    expect(v.ansicht().wort).toEqual(w);
  });

  it('Pause bricht ab, Weiter startet denselben Satz neu (Android/Chrome-Fehler bei resume)', () => {
    const { v, synth, saetze } = aufbau();
    v.start(saetze);
    synth.beende();
    expect(v.ansicht().index).toBe(1);
    const vorher = synth.gesprochen.length;
    v.pause();
    expect(v.ansicht().status).toBe('pause');
    expect(synth.aktiv).toBeNull();
    expect(synth.abgebrochen).toBeGreaterThan(0);
    v.weiter();
    expect(v.ansicht().status).toBe('spielt');
    expect(synth.gesprochen.length).toBe(vorher + 1);
    expect(synth.gesprochen.at(-1)?.text).toBe('Zweiter Satz kommt.');
  });

  it('das end-Ereignis der abgebrochenen Äusserung schaltet nicht weiter (veraltet)', () => {
    const { v, synth, saetze } = aufbau();
    v.start(saetze);
    const alt = synth.aktiv;
    v.pause();
    alt?.onend?.();
    alt?.onerror?.({ error: 'interrupted' });
    expect(v.ansicht().index).toBe(0);
    expect(v.ansicht().status).toBe('pause');
    expect(v.ansicht().fehler).toBeNull();
  });

  it('Stopp beendet alles und räumt Timer auf', () => {
    const { v, synth, saetze, uhr } = aufbau();
    v.start(saetze);
    expect(uhr.offen()).toBe(1);
    v.stoppe();
    expect(v.ansicht().status).toBe('leer');
    expect(synth.aktiv).toBeNull();
    expect(uhr.offen()).toBe(0);
  });

  it('Sprung vor/zurück landet auf Satzgrenzen und setzt die Wiedergabe fort', () => {
    const { v, synth, saetze } = aufbau(undefined, LANG);
    v.start(saetze);
    v.springe(10);
    expect(v.ansicht().index).toBeGreaterThan(0);
    const vor = v.ansicht().index;
    expect(synth.aktiv?.text).toBe(saetze[vor]?.sprech);
    v.springe(-10);
    expect(v.ansicht().index).toBeLessThan(vor);
    v.springe(-1000);
    expect(v.ansicht().index).toBe(0);
    v.springe(10_000);
    expect(v.ansicht().status).toBe('leer');
  });

  it('Sprung in der Pause bleibt in der Pause', () => {
    const { v, saetze } = aufbau(undefined, LANG);
    v.start(saetze);
    v.pause();
    v.springe(10);
    expect(v.ansicht().status).toBe('pause');
    expect(v.ansicht().index).toBeGreaterThan(0);
  });

  it('Sprung nutzt die gemessene Sprechzeit (Kalibrierung)', () => {
    const { v, synth, saetze, uhr } = aufbau();
    v.start(saetze);
    // sehr langsame Stimme: 17 Zeichen brauchen 8 s
    synth.starte();
    uhr.vor(8000);
    synth.beende();
    const rest = v.ansicht().rest;
    expect(rest).toBeGreaterThan(0);
  });

  it('Wächter-Timer: fehlt das end-Ereignis, geht es trotzdem weiter', () => {
    const { v, synth, saetze, uhr } = aufbau();
    v.start(saetze);
    uhr.vor(60_000);
    expect(v.ansicht().index).toBe(1);
    expect(synth.gesprochen.length).toBe(2);
  });

  it('Fehler des Browsers: verständliche Meldung ohne Textinhalt, Ausgabe stoppt', () => {
    const { v, synth, saetze } = aufbau();
    v.start(saetze);
    synth.aktiv?.onerror?.({ error: 'not-allowed' });
    const a = v.ansicht();
    expect(a.status).toBe('leer');
    expect(a.fehler).toMatch(/blockiert/);
    expect(a.fehler).not.toMatch(/Erster/);
  });

  it('Tempo und Stimme wirken auf die laufende Äusserung', () => {
    const synth = new FakeSynth([
      { voiceURI: 'a', name: 'A', lang: 'de-CH', localService: true },
      { voiceURI: 'b', name: 'B', lang: 'de-DE', localService: true },
    ]);
    const { v, saetze } = aufbau(synth);
    v.start(saetze);
    expect(synth.aktiv?.rate).toBe(1);
    v.setzeTempo(1.5);
    expect(synth.aktiv?.rate).toBe(1.5);
    v.setzeStimme('b');
    expect((synth.aktiv?.voice as { name: string } | undefined)?.name).toBe('B');
    expect(synth.aktiv?.lang).toBe('de-DE');
    v.setzeStimme('gibtsnicht');
    expect(v.ansicht().stimmeId).toBe('b');
    v.setzeTempo(Number.NaN);
    expect(v.ansicht().tempo).toBe(1);
    v.setzeTempo(50);
    expect(v.ansicht().tempo).toBeLessThanOrEqual(2);
  });

  it('nur lokale deutsche Stimmen: Netz- und fremdsprachige Stimmen werden nicht angeboten', () => {
    const synth = new FakeSynth([
      { voiceURI: 'net', name: 'Netz', lang: 'de-DE', localService: false },
      { voiceURI: 'en', name: 'En', lang: 'en-US', localService: true },
    ]);
    const { v, saetze } = aufbau(synth);
    expect(v.ansicht().stimmen).toEqual([]);
    expect(v.start(saetze)).toBe(false);
    expect(synth.gesprochen.length).toBe(0);
  });

  it('Stimmen laden asynchron (voiceschanged)', () => {
    const synth = new FakeSynth([]);
    const { v } = aufbau(synth);
    expect(v.ansicht().stimmen.length).toBe(0);
    expect(v.ansicht().stimmenGeladen).toBe(false);
    synth.stimmen = [{ voiceURI: 'a', name: 'A', lang: 'de-CH', localService: true }];
    synth.melde();
    expect(v.ansicht().stimmen.length).toBe(1);
    expect(v.ansicht().stimmenGeladen).toBe(true);
  });

  it('Ansicht meldet sich bei Abonnenten; beende räumt auf', () => {
    const { v, synth, saetze } = aufbau();
    const ansichten: string[] = [];
    const ab = v.abonniere((a) => ansichten.push(a.status));
    v.start(saetze);
    v.pause();
    expect(ansichten).toEqual(['leer', 'spielt', 'pause']);
    ab();
    v.weiter();
    expect(ansichten.length).toBe(3);
    v.beende();
    expect(synth.aktiv).toBeNull();
  });

  it('start ohne Sätze und Start mit Index', () => {
    const { v, synth, saetze } = aufbau();
    expect(v.start([])).toBe(false);
    expect(v.start(saetze, 3)).toBe(true);
    expect(synth.aktiv?.text).toBe('Vierter Absatz.');
  });

  it('speak wirft: Fehlermeldung, kein Absturz', () => {
    const { v, synth, saetze } = aufbau();
    synth.speak = () => {
      throw new Error('kaputt');
    };
    v.start(saetze);
    expect(v.ansicht().status).toBe('leer');
    expect(v.ansicht().fehler).toMatch(/nicht möglich/);
  });

  it('Referenz der laufenden Äusserung wird gehalten', () => {
    const { v, saetze } = aufbau();
    v.start(saetze);
    expect(v.laufendeAeusserung()?.text).toBe('Erster Satz hier.');
  });
});
