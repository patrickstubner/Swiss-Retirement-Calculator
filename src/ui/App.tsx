import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { effektiverHaushalt } from '../core/schaetzwerte';
import { simuliere } from '../core/simulation';
import { fruehestesRuecktrittsalter } from '../core/solver';
import type { EingabeModus, Haushalt, Monat } from '../core/typen';
import { standardHaushalt } from '../data/defaults';
import { ladeRegeln, type Regeln } from '../rules';
import { DisclaimerBanner } from './components/Disclaimer';
import { Segmente } from './components/Felder';
import { fmtAlter } from './format';
import type { Berechnung, Setzer } from './kontext';
import { Annahmen } from './schritte/Annahmen';
import { EinkommenVorsorge } from './schritte/EinkommenVorsorge';
import { Ergebnis, type SuchModus } from './schritte/Ergebnis';
import { Personen } from './schritte/Personen';
import { SchnellEingaben } from './schritte/SchnellEingaben';
import { VermoegenAusgaben } from './schritte/VermoegenAusgaben';
import {
  type AppZustand,
  ausHash,
  browserSpeicher,
  entferneHash,
  ladeStartzustand,
  type StartQuelle,
  setzeSpeichern,
  speichereLokal,
  speichernAktiv,
} from './state';

const SCHRITTE_DETAIL = ['Personen', 'Einkommen & Vorsorge', 'Vermögen & Ausgaben', 'Annahmen', 'Ergebnis'] as const;
const KURZ_DETAIL = ['Personen', 'Vorsorge', 'Vermögen', 'Annahmen', 'Ergebnis'] as const;
const SCHRITTE_SCHNELL = ['Eingaben', 'Ergebnis'] as const;

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
  const speicher = useMemo(() => browserSpeicher(), []);
  const [start] = useState(() => ladeStartzustand(regeln, window.location.hash, speicher));
  const [haushalt, setHaushalt] = useState<Haushalt>(start.haushalt);
  const [speichern, setSpeichernState] = useState<boolean>(() => speichernAktiv(speicher));
  const [schritt, setSchritt] = useState(start.ui.schritt);
  const [suchModus, setSuchModus] = useState<SuchModus>(start.ui.suchModus);
  const [eingabeModus, setEingabeModus] = useState<EingabeModus>(start.ui.modus);
  // Geteilter Link: erst speichern, wenn übernommen oder geändert (die eigenen Daten bleiben sonst unberührt)
  const [linkQuelle, setLinkQuelle] = useState<{ quelle: StartQuelle; lokal: AppZustand | null } | null>(() =>
    start.quelle === 'link' ? { quelle: 'link', lokal: start.lokal } : null,
  );
  const hauptRef = useRef<HTMLElement>(null);
  const ersterLauf = useRef(true);

  const setH: Setzer = useCallback((fn) => {
    setHaushalt((h) => fn(h));
    setLinkQuelle(null);
  }, []);

  // Fragment nach dem Laden aus der Adresszeile entfernen (Daten nicht versehentlich weitergeben)
  useEffect(() => {
    entferneHash();
  }, []);

  // Ganzen Zustand im localStorage speichern (falls an) – entprellt
  useEffect(() => {
    const z: AppZustand = { haushalt, ui: { schritt, suchModus, modus: eingabeModus } };
    if (ersterLauf.current) {
      ersterLauf.current = false;
      return;
    }
    if (!speichern || linkQuelle) return;
    const t = window.setTimeout(() => speichereLokal(speicher, z), 300);
    return () => window.clearTimeout(t);
  }, [haushalt, schritt, suchModus, eingabeModus, speichern, linkQuelle, speicher]);

  // Manuell eingefügter oder geänderter Link (#s=…)
  useEffect(() => {
    const onHash = () => {
      const h = ausHash(window.location.hash, regeln);
      if (!h) return;
      setHaushalt(h);
      setLinkQuelle((alt) => ({ quelle: 'link', lokal: alt?.lokal ?? null }));
      entferneHash();
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [regeln]);

  const onSpeichern = (v: boolean) => {
    setSpeichernState(v);
    setzeSpeichern(speicher, v, { haushalt, ui: { schritt, suchModus, modus: eingabeModus } });
    if (v) setLinkQuelle(null);
  };

  const modus: SuchModus = haushalt.personen.length > 1 ? suchModus : 'gemeinsam';
  const verzoegert = useDeferredValue(haushalt);
  // Schätzwerte für Felder ohne eigene Eingabe (core/schaetzwerte.ts); gerechnet wird mit dem effektiven Haushalt
  const eff = useMemo(() => effektiverHaushalt(haushalt, regeln, heute), [haushalt, regeln, heute]);
  const effVerzoegert = useMemo(() => effektiverHaushalt(verzoegert, regeln, heute), [verzoegert, regeln, heute]);
  const berechnung = useMemo(
    () => berechne(effVerzoegert.haushalt, regeln, heute, modus),
    [effVerzoegert, regeln, heute, modus],
  );

  const schnell = eingabeModus === 'schnell';
  const SCHRITTE: readonly string[] = schnell ? SCHRITTE_SCHNELL : SCHRITTE_DETAIL;
  const KURZ: readonly string[] = schnell ? SCHRITTE_SCHNELL : KURZ_DETAIL;
  const ergebnisSchritt = SCHRITTE.length - 1;
  const aktSchritt = Math.min(schritt, ergebnisSchritt);

  const wechsleModus = (m: EingabeModus) => {
    if (m === eingabeModus) return;
    // Eingaben bleiben erhalten; auf dem Ergebnis bleiben, sonst zum ersten Schritt
    const warErgebnis = aktSchritt === ergebnisSchritt;
    setEingabeModus(m);
    setSchritt(warErgebnis ? (m === 'schnell' ? SCHRITTE_SCHNELL.length : SCHRITTE_DETAIL.length) - 1 : 0);
  };

  const geheZu = (i: number) => {
    setSchritt(Math.max(0, Math.min(SCHRITTE.length - 1, i)));
    hauptRef.current?.scrollIntoView({ block: 'start' });
    window.scrollTo({ top: 0 });
  };

  const props = { h: haushalt, setH, regeln, heute, berechnung, eff, eingabeModus };
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
      <section className="speicherleiste" aria-label="Speichern im Browser">
        <div className="speicherleiste__inner">
          <label className="speicherleiste__schalter">
            <input
              type="checkbox"
              role="switch"
              aria-checked={speichern}
              checked={speichern}
              disabled={speicher === null}
              onChange={(e) => onSpeichern(e.target.checked)}
            />
            <span>Eingaben im Browser speichern</span>
          </label>
          <small className="speicherleiste__hinweis">
            {speicher === null
              ? 'Speichern ist in diesem Browser nicht möglich.'
              : speichern
                ? 'Die Daten bleiben nur in diesem Browser (localStorage) und werden nirgends hin gesendet.'
                : 'Aus: Es ist nichts gespeichert. Beim Schliessen der Seite gehen die Eingaben verloren.'}
          </small>
        </div>
      </section>
      <header className="kopf">
        <div className="kopf__inner">
          <h1>Ruhestandsrechner</h1>
          <p className="kopf__frage">Wann kann ich aufhören zu arbeiten – und reicht mein Vermögen?</p>
        </div>
      </header>
      <div className="inhalt">
        {linkQuelle ? (
          <div className="info link-banner" role="status">
            <p>
              <strong>Eingaben aus einem geteilten Link geladen.</strong>{' '}
              {speichern
                ? 'Ihre im Browser gespeicherten Eingaben bleiben unverändert, bis Sie übernehmen oder etwas ändern.'
                : ''}
            </p>
            <div className="link-banner__knoepfe">
              <button type="button" className="knopf" onClick={() => setLinkQuelle(null)}>
                Übernehmen
              </button>
              {linkQuelle.lokal ? (
                <button
                  type="button"
                  className="knopf knopf--sekundaer"
                  onClick={() => {
                    const l = linkQuelle.lokal;
                    if (!l) return;
                    setHaushalt(l.haushalt);
                    setSchritt(l.ui.schritt);
                    setSuchModus(l.ui.suchModus);
                    setEingabeModus(l.ui.modus);
                    setLinkQuelle(null);
                  }}
                >
                  Meine gespeicherten Eingaben laden
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <DisclaimerBanner />
        <div className="moduswahl">
          <Segmente<EingabeModus>
            label="Eingabe"
            value={eingabeModus}
            optionen={[
              { value: 'schnell', label: 'Schnell' },
              { value: 'detailliert', label: 'Detailliert' },
            ]}
            onChange={wechsleModus}
          />
          <p className="klein">
            {schnell
              ? 'Wenige Angaben, der Rest wird aus den gesetzlichen Werten geschätzt. Detailwerte gehen nicht verloren.'
              : 'Alle Felder. Leere Felder mit «geschätzt» verwenden die Schätzung des Modus «Schnell».'}
          </p>
        </div>
        <nav className={`stepper${schnell ? ' stepper--kurz' : ''}`} aria-label="Schritte">
          <ol>
            {SCHRITTE.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  className={`stepper__schritt${i === aktSchritt ? ' stepper__schritt--aktiv' : ''}`}
                  aria-current={i === aktSchritt ? 'step' : undefined}
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
          <h2 className="schritt-titel">{SCHRITTE[aktSchritt]}</h2>
          {schnell && aktSchritt === 0 ? <SchnellEingaben {...props} /> : null}
          {!schnell && aktSchritt === 0 ? <Personen {...props} /> : null}
          {!schnell && aktSchritt === 1 ? <EinkommenVorsorge {...props} /> : null}
          {!schnell && aktSchritt === 2 ? <VermoegenAusgaben {...props} /> : null}
          {!schnell && aktSchritt === 3 ? (
            <Annahmen
              {...props}
              onZuruecksetzen={() => {
                if (window.confirm('Alle Eingaben auf die Standardwerte zurücksetzen?')) {
                  setHaushalt(standardHaushalt(regeln));
                  setLinkQuelle(null);
                  geheZu(0);
                }
              }}
            />
          ) : null}
          {aktSchritt === ergebnisSchritt ? (
            <Ergebnis
              {...props}
              suchModus={modus}
              setSuchModus={setSuchModus}
              zuDetail={() => {
                setEingabeModus('detailliert');
                setSchritt(1);
                window.scrollTo({ top: 0 });
              }}
            />
          ) : null}
        </main>
        <footer className="fuss">
          <p>
            Nicht-kommerzielles Projekt · Open Source (MIT) · Regelwerte Stand {regeln.meta.stand} · Keine Cookies, kein
            Tracking, keine Datenübermittlung. Gespeichert wird nur lokal im Browser (abschaltbar ganz oben).
          </p>
        </footer>
      </div>
      <section className="leiste" aria-label="Navigation und Kurzergebnis">
        <button
          type="button"
          className="knopf knopf--sekundaer"
          onClick={() => geheZu(aktSchritt - 1)}
          disabled={aktSchritt === 0}
        >
          Zurück
        </button>
        <button type="button" className="leiste__ergebnis" onClick={() => geheZu(ergebnisSchritt)} aria-live="polite">
          {kurzErgebnis}
        </button>
        <button
          type="button"
          className="knopf"
          onClick={() => geheZu(aktSchritt + 1)}
          disabled={aktSchritt === ergebnisSchritt}
        >
          Weiter
        </button>
      </section>
    </div>
  );
}
