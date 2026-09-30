/**
 * Vorlesen: Knöpfe je Abschnitt, Schalter für die ganze Seite und Bedienleiste (Play/Pause, Stopp, ±10 s,
 * Tempo, Stimme). Nutzt nur die Sprachausgabe des Browsers (Web Speech API); es wird nichts übertragen.
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type Ansicht, SPRUNG_SEKUNDEN, TEMPI, type Umgebung, Vorleser } from './controller';
import { type Block, type KnotenLike, sammleBloecke } from './dom';
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen';
import { bereichFuer, loescheHervorhebung, scrolleSichtbar, setzeHervorhebung } from './hervorhebung';
import { ersterIndexAb, planeSaetze } from './plan';

interface Kontext {
  /** Sprachausgabe im Browser vorhanden und mindestens eine lokale deutsche Stimme */
  bereit: boolean;
  /** Ein Abschnitt (Element) vorlesen */
  liesAbschnitt(el: Element): void;
  /** Ab dem Abschnitt bis zum Ende der Seite vorlesen */
  liesAb(el: Element): void;
  /** Ganze Seite */
  liesSeite(): void;
  ansicht: Ansicht | null;
  /** Steuerung (nur solange Sprachausgabe vorhanden ist) */
  steuerung: Vorleser | null;
}

const Leer: Kontext = {
  bereit: false,
  liesAbschnitt: () => {},
  liesAb: () => {},
  liesSeite: () => {},
  ansicht: null,
  steuerung: null,
};
const VorleseKontext = createContext<Kontext>(Leer);

const unterstuetzt = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  typeof (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance === 'function';

function browserUmgebung(): Umgebung {
  return {
    synth: window.speechSynthesis as unknown as Umgebung['synth'],
    neueAeusserung: (text) => new SpeechSynthesisUtterance(text) as unknown as ReturnType<Umgebung['neueAeusserung']>,
    jetzt: () => performance.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    loescheTimer: (id) => window.clearTimeout(id as number),
    seitenSprache: document.documentElement.lang || 'de-CH',
  };
}

/** Seitenwurzel, die «ganze Seite» und «ab hier» umfasst. */
const seitenWurzel = () => document.querySelector('.inhalt');

export function VorlesenAnbieter({
  speicher,
  speichern,
  children,
}: {
  speicher: Storage | null;
  /** Wert des Schalters «Eingaben im Browser speichern» */
  speichern: boolean;
  children: ReactNode;
}) {
  const [ansicht, setAnsicht] = useState<Ansicht | null>(null);
  const vorleser = useRef<Vorleser | null>(null);
  const bloecke = useRef<Block[]>([]);

  // Vorleser erzeugen (nur wenn der Browser Sprachausgabe hat)
  useEffect(() => {
    if (!unterstuetzt()) return;
    const v = new Vorleser(browserUmgebung());
    vorleser.current = v;
    const e = ladeEinstellungen(speicher);
    v.ladeEinstellungen(e.tempo, e.stimme);
    const ab = v.abonniere(setAnsicht);
    const t = window.setTimeout(() => v.markiereGeladen(), 1500);
    return () => {
      window.clearTimeout(t);
      ab();
      v.beende();
      vorleser.current = null;
      loescheHervorhebung();
    };
  }, [speicher]);

  // Änderungen an Tempo/Stimme sichern (nur bei aktivem Speichern)
  const stimmeRef = useRef<string | null>(null);
  const tempoRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ansicht) return;
    if (ansicht.tempo === tempoRef.current && ansicht.stimmeId === stimmeRef.current) return;
    const erstes = tempoRef.current === null;
    tempoRef.current = ansicht.tempo;
    stimmeRef.current = ansicht.stimmeId;
    if (erstes || !speichern) return; // Ausgangswerte nicht schreiben
    speichereEinstellungen(speicher, { tempo: ansicht.tempo, stimme: ansicht.stimmeId });
  }, [ansicht, speicher, speichern]);

  // Platz für die Leiste unten schaffen (Attribut am Wurzelelement, von React nicht verwaltet)
  const aktiv = !!ansicht && ansicht.status !== 'leer';
  const startElement = useRef<Element | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute('data-vorlesen-aktiv', aktiv);
    if (!aktiv) {
      // Fokus zurück zum Auslöser, falls er beim Schliessen der Leiste verloren gegangen ist
      const a = document.activeElement;
      const el = startElement.current;
      if ((a === null || a === document.body) && el instanceof HTMLElement && el.isConnected)
        el.focus({ preventScroll: true });
      startElement.current = null;
      return;
    }
    // Höhe der unteren Navigationsleiste messen (CSSOM, kein Inline-Style im HTML: CSP bleibt unverändert)
    const messen = () => {
      const h = document.querySelector('.leiste')?.getBoundingClientRect().height;
      if (h) root.style.setProperty('--leiste-hoehe', `${Math.ceil(h)}px`);
    };
    messen();
    window.addEventListener('resize', messen);
    return () => {
      window.removeEventListener('resize', messen);
      root.removeAttribute('data-vorlesen-aktiv');
      root.style.removeProperty('--leiste-hoehe');
    };
  }, [aktiv]);

  // Hervorhebung nachführen
  useEffect(() => {
    if (!ansicht || ansicht.status === 'leer' || !ansicht.satz) {
      loescheHervorhebung();
      return;
    }
    const block = bloecke.current[ansicht.satz.block];
    if (!block) return;
    const satz = bereichFuer(block, ansicht.satz.von, ansicht.satz.bis);
    const wort = ansicht.wort ? bereichFuer(block, ansicht.wort.von, ansicht.wort.bis) : null;
    setzeHervorhebung(satz, wort);
    if (satz && ansicht.status === 'spielt') scrolleSichtbar(wort ?? satz);
  }, [ansicht]);

  const lies = useCallback((wurzel: Element | null, ab?: Element) => {
    const v = vorleser.current;
    if (!v || !wurzel) return;
    startElement.current = document.activeElement;
    const b = sammleBloecke(wurzel as unknown as KnotenLike);
    bloecke.current = b;
    const saetze = planeSaetze(b.map((x) => x.text));
    let index = 0;
    if (ab) {
      const ende = ab.compareDocumentPosition.bind(ab);
      index = ersterIndexAb(saetze, b, (k) => {
        const pos = ende(k as Node);
        return (
          k === ab ||
          (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 ||
          (pos & Node.DOCUMENT_POSITION_CONTAINED_BY) !== 0
        );
      });
    }
    v.start(saetze, index);
  }, []);

  const kontext = useMemo<Kontext>(
    () => ({
      bereit: !!ansicht && ansicht.stimmen.length > 0,
      ansicht,
      steuerung: vorleser.current,
      liesAbschnitt: (el) => lies(el),
      liesAb: (el) => lies(seitenWurzel(), el),
      liesSeite: () => lies(seitenWurzel()),
    }),
    [ansicht, lies],
  );

  return <VorleseKontext.Provider value={kontext}>{children}</VorleseKontext.Provider>;
}

export const useVorlesen = () => useContext(VorleseKontext);

/** Knöpfe «Vorlesen» und «ab hier» im Kopf eines Abschnitts. Sie lesen den umgebenden `section`/`details`. */
export function VorlesenKnoepfe({ titel }: { titel: string }) {
  const k = useVorlesen();
  if (!k.bereit) return null;
  const abschnitt = (e: { currentTarget: Element }) => e.currentTarget.closest('section, details') ?? e.currentTarget;
  return (
    <span className="vorlesen-knoepfe" data-vorlesen="aus">
      <button
        type="button"
        className="vorlesen-knopf"
        aria-label={`Abschnitt «${titel}» vorlesen`}
        onClick={(e) => k.liesAbschnitt(abschnitt(e))}
      >
        <span aria-hidden="true">▶</span> Vorlesen
      </button>
      <button
        type="button"
        className="vorlesen-knopf vorlesen-knopf--leise"
        aria-label={`Ab «${titel}» bis zum Ende der Seite vorlesen`}
        onClick={(e) => k.liesAb(abschnitt(e))}
      >
        ab hier
      </button>
    </span>
  );
}

/** Zeile unter dem Seitenkopf: «Ganze Seite vorlesen» oder Hinweis, wenn keine passende Stimme da ist. */
export function VorlesenSeitenKopf() {
  const k = useVorlesen();
  if (!k.ansicht) return null; // Sprachausgabe fehlt: nichts anzeigen
  if (!k.bereit) {
    if (!k.ansicht.stimmenGeladen) return null;
    return (
      <p className="vorlesen-hinweis klein" role="note">
        Vorlesen ist auf diesem Gerät nicht verfügbar: Es wurde keine lokale deutsche Stimme gefunden. Aus
        Datenschutzgründen werden keine Online-Stimmen verwendet.
      </p>
    );
  }
  return (
    <div className="vorlesen-kopf" data-vorlesen="aus">
      <button type="button" className="knopf knopf--sekundaer" onClick={k.liesSeite}>
        <span aria-hidden="true">🔊</span> Ganze Seite vorlesen
      </button>
    </div>
  );
}

const fmtRest = (s: number) => {
  const r = Math.round(s);
  return r < 60 ? `${r} s` : `${Math.floor(r / 60)} min ${String(r % 60).padStart(2, '0')} s`;
};

/** Bedienleiste, erscheint nur während des Vorlesens (fest unten, über der Navigationsleiste). */
export function VorlesenLeiste() {
  const k = useVorlesen();
  const a = k.ansicht;
  const tempoId = useId();
  const stimmeId = useId();
  const [mehr, setMehr] = useState(false);
  const leer = !a || a.status === 'leer';
  // Einstellungen beim nächsten Start wieder eingeklappt
  useEffect(() => {
    if (leer) setMehr(false);
  }, [leer]);
  if (!a || a.status === 'leer') {
    return a?.fehler ? (
      <div className="vorlesen-leiste vorlesen-leiste--fehler" role="alert" data-vorlesen="aus">
        {a.fehler}
      </div>
    ) : null;
  }
  const v = k.steuerung;
  if (!v) return null;
  const spielt = a.status === 'spielt';
  return (
    // biome-ignore lint/a11y/useSemanticElements: Region mit Werkzeugleiste, Tastatur-Kürzel siehe onKeyDown
    <section
      className="vorlesen-leiste"
      aria-label="Vorlesen"
      data-vorlesen="aus"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          v.stoppe();
        }
      }}
    >
      <div className="vorlesen-leiste__reihe" role="toolbar" aria-label="Vorlesen steuern">
        <button
          type="button"
          className="vorlesen-knopf vorlesen-knopf--rund"
          aria-label={`${SPRUNG_SEKUNDEN} Sekunden zurück (geschätzt, zum Satzanfang)`}
          title={`${SPRUNG_SEKUNDEN} Sekunden zurück (geschätzt, springt zum Satzanfang)`}
          onClick={() => v.springe(-SPRUNG_SEKUNDEN)}
        >
          <span aria-hidden="true">−10 s</span>
        </button>
        <button
          type="button"
          className="knopf vorlesen-knopf--haupt"
          aria-label={spielt ? 'Pause' : 'Weiterlesen'}
          onClick={() => v.umschalten()}
        >
          <span aria-hidden="true">{spielt ? '❚❚' : '▶'}</span>
        </button>
        <button
          type="button"
          className="vorlesen-knopf vorlesen-knopf--rund"
          aria-label={`${SPRUNG_SEKUNDEN} Sekunden vor (geschätzt, zum Satzanfang)`}
          title={`${SPRUNG_SEKUNDEN} Sekunden vor (geschätzt, springt zum Satzanfang)`}
          onClick={() => v.springe(SPRUNG_SEKUNDEN)}
        >
          <span aria-hidden="true">+10 s</span>
        </button>
        <button
          type="button"
          className="vorlesen-knopf vorlesen-knopf--rund"
          aria-label="Stopp"
          onClick={() => v.stoppe()}
        >
          <span aria-hidden="true">■</span>
        </button>
        <button
          type="button"
          className="vorlesen-knopf vorlesen-knopf--rund"
          aria-expanded={mehr}
          aria-label="Tempo und Stimme"
          onClick={() => setMehr((x) => !x)}
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
      <p className="vorlesen-leiste__status klein">
        <span role="status">{spielt ? 'Vorlesen läuft' : 'Pausiert'}</span>
        <span aria-hidden="true">
          {' '}
          · Satz {a.index + 1} von {a.total} · noch ca. {fmtRest(a.rest)} · ±10 s geschätzt
        </span>
      </p>
      {mehr ? (
        <div className="vorlesen-leiste__optionen">
          <label htmlFor={tempoId}>Tempo</label>
          <select id={tempoId} value={a.tempo} onChange={(e) => v.setzeTempo(Number(e.target.value))}>
            {TEMPI.map((t) => (
              <option key={t} value={t}>
                {t === 1 ? 'Normal (1×)' : `${String(t).replace('.', ',')}×`}
              </option>
            ))}
          </select>
          <label htmlFor={stimmeId}>Stimme</label>
          <select id={stimmeId} value={a.stimmeId ?? ''} onChange={(e) => v.setzeStimme(e.target.value)}>
            {a.stimmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.lang})
              </option>
            ))}
          </select>
          <p className="klein vorlesen-leiste__hilfe">
            «±10 s» ist geschätzt: Die Sprachausgabe des Browsers kann nicht auf die Sekunde springen, es wird zum
            nächsten Satzanfang gesprungen. Esc beendet das Vorlesen.
          </p>
        </div>
      ) : null}
    </section>
  );
}
