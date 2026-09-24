import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { simuliere } from '../core/simulation';
import { fruehestesRuecktrittsalter } from '../core/solver';
import type { Haushalt, Monat } from '../core/typen';
import { standardHaushalt } from '../data/defaults';
import { ladeRegeln, type Regeln } from '../rules';
import { DisclaimerBanner } from './components/Disclaimer';
import { fmtAlter } from './format';
import type { Berechnung, Setzer } from './kontext';
import { Annahmen } from './schritte/Annahmen';
import { EinkommenVorsorge } from './schritte/EinkommenVorsorge';
import { Ergebnis, type SuchModus } from './schritte/Ergebnis';
import { Personen } from './schritte/Personen';
import { VermoegenAusgaben } from './schritte/VermoegenAusgaben';
import { ausHash, ladeStartzustand, schreibeHash, setzeSpeichern, speichereLokal, speichernAktiv } from './state';

const SCHRITTE = ['Personen', 'Einkommen & Vorsorge', 'Vermögen & Ausgaben', 'Annahmen', 'Ergebnis'] as const;
const KURZ = ['Personen', 'Vorsorge', 'Vermögen', 'Annahmen', 'Ergebnis'] as const;

function berechne(h: Haushalt, regeln: Regeln, heute: Monat, suchModus: SuchModus): Berechnung {
  const t0 = performance.now();
  try {
    const wunsch = simuliere(h, regeln, { start: heute });
    const person = suchModus === 'p1' && h.personen.length > 1 ? 1 : 0;
    const solver = fruehestesRuecktrittsalter(h, regeln, {
      start: heute,
      modus: suchModus === 'gemeinsam' ? 'gemeinsam' : 'person',
      person,
      maxAlter: 70,
    });
    return { wunsch, solver, fehler: null, dauerMs: performance.now() - t0 };
  } catch (e) {
    return {
      wunsch: null,
      solver: null,
      fehler: e instanceof Error ? e.message : String(e),
      dauerMs: performance.now() - t0,
    };
  }
}

export function App() {
  const heute = useMemo<Monat>(() => {
    const d = new Date();
    return { jahr: d.getFullYear(), monat: d.getMonth() + 1 };
  }, []);
  const regeln = useMemo(() => ladeRegeln(heute.jahr), [heute.jahr]);
  const [haushalt, setHaushalt] = useState<Haushalt>(() => ladeStartzustand(regeln));
  const [speichern, setSpeichernState] = useState<boolean>(() => speichernAktiv());
  const [schritt, setSchritt] = useState(0);
  const [suchModus, setSuchModus] = useState<SuchModus>('gemeinsam');
  const hauptRef = useRef<HTMLElement>(null);

  const setH: Setzer = useCallback((fn) => setHaushalt((h) => fn(h)), []);

  // Zustand ins URL-Fragment (und optional localStorage) schreiben – entprellt
  useEffect(() => {
    const t = window.setTimeout(() => {
      schreibeHash(haushalt);
      speichereLokal(haushalt);
    }, 300);
    return () => window.clearTimeout(t);
  }, [haushalt]);

  // Zurück/Vor im Browser bzw. manuell geänderter Link
  useEffect(() => {
    const onHash = () => {
      const h = ausHash(window.location.hash, regeln);
      if (h) setHaushalt(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [regeln]);

  const modus: SuchModus = haushalt.personen.length > 1 ? suchModus : 'gemeinsam';
  const verzoegert = useDeferredValue(haushalt);
  const berechnung = useMemo(() => berechne(verzoegert, regeln, heute, modus), [verzoegert, regeln, heute, modus]);

  const geheZu = (i: number) => {
    setSchritt(Math.max(0, Math.min(SCHRITTE.length - 1, i)));
    hauptRef.current?.scrollIntoView({ block: 'start' });
    window.scrollTo({ top: 0 });
  };

  const props = { h: haushalt, setH, regeln, heute, berechnung };
  const solver = berechnung.solver;
  const kurzErgebnis = berechnung.fehler
    ? 'Eingaben prüfen'
    : solver?.gefunden && solver.alterMonate !== null
      ? solver.sofort
        ? 'Rücktritt sofort möglich'
        : `Frühestens mit ${fmtAlter(solver.alterMonate)}`
      : 'Reicht nicht bis 70';

  return (
    <div className="app">
      <header className="kopf">
        <div className="kopf__inner">
          <h1>Ruhestandsrechner</h1>
          <p className="kopf__frage">Wann kann ich aufhören zu arbeiten – und reicht mein Vermögen?</p>
        </div>
      </header>
      <div className="inhalt">
        <DisclaimerBanner />
        <nav className="stepper" aria-label="Schritte">
          <ol>
            {SCHRITTE.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  className={`stepper__schritt${i === schritt ? ' stepper__schritt--aktiv' : ''}`}
                  aria-current={i === schritt ? 'step' : undefined}
                  onClick={() => geheZu(i)}
                >
                  <span className="stepper__nr">{i + 1}</span>
                  <span className="stepper__text">{KURZ[i]}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <main ref={hauptRef} className="haupt">
          <h2 className="schritt-titel">{SCHRITTE[schritt]}</h2>
          {schritt === 0 ? <Personen {...props} /> : null}
          {schritt === 1 ? <EinkommenVorsorge {...props} /> : null}
          {schritt === 2 ? <VermoegenAusgaben {...props} /> : null}
          {schritt === 3 ? (
            <Annahmen
              {...props}
              speichern={speichern}
              onSpeichern={(v) => {
                setSpeichernState(v);
                setzeSpeichern(v, haushalt);
              }}
              onZuruecksetzen={() => {
                if (window.confirm('Alle Eingaben auf die Standardwerte zurücksetzen?')) {
                  setHaushalt(standardHaushalt(regeln));
                  geheZu(0);
                }
              }}
            />
          ) : null}
          {schritt === 4 ? <Ergebnis {...props} suchModus={modus} setSuchModus={setSuchModus} /> : null}
        </main>
        <footer className="fuss">
          <p>
            Nicht-kommerzielles Projekt · Open Source (MIT) · Regelwerte Stand {regeln.meta.stand} · Keine Cookies, kein
            Tracking, keine Datenübermittlung.
          </p>
        </footer>
      </div>
      <section className="leiste" aria-label="Navigation und Kurzergebnis">
        <button
          type="button"
          className="knopf knopf--sekundaer"
          onClick={() => geheZu(schritt - 1)}
          disabled={schritt === 0}
        >
          Zurück
        </button>
        <button type="button" className="leiste__ergebnis" onClick={() => geheZu(4)} aria-live="polite">
          {kurzErgebnis}
        </button>
        <button
          type="button"
          className="knopf"
          onClick={() => geheZu(schritt + 1)}
          disabled={schritt === SCHRITTE.length - 1}
        >
          Weiter
        </button>
      </section>
    </div>
  );
}
