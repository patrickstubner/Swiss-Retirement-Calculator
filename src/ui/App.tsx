import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { effektiverHaushalt } from '../core/schaetzwerte';
import { simuliere } from '../core/simulation';
import { fruehestesRuecktrittsalter } from '../core/solver';
import type { EingabeModus, Haushalt, Monat } from '../core/typen';
import { standardHaushalt } from '../data/defaults';
import { krisenOptionen } from '../data/krisen';
import { ladeRegeln, type Regeln, regelJahrStatus } from '../rules';
import { DisclaimerBanner } from './components/Disclaimer';
import { Segmente } from './components/Felder';
import { anzeigeName, Vergleich, VersionsMarke } from './components/Vergleich';
import { VersionenLeiste } from './components/Versionen';
import { darstellungVon } from './darstellung';
import { fmtAlter } from './format';
import type { Berechnung, Setzer } from './kontext';
import { SchrittInhalt } from './SchrittInhalt';
import type { SuchModus } from './schritte/Ergebnis';
import {
  type AppZustand,
  ausHash,
  browserSpeicher,
  entferneHash,
  ladeStartzustand,
  STANDARD_NAMEN,
  type StartQuelle,
  type SzenarienZustand,
  setzeSpeichern,
  speichereLokal,
  speichernAktiv,
  type VersionsNamen,
} from './state';
import {
  exportDateiname,
  exportiere,
  importiere,
  kopiere,
  loescheVersion,
  tausche,
  ueberschreibe,
  type VersionId,
} from './szenarien';
import { VorlesenAnbieter, VorlesenLeiste, VorlesenSeitenKopf } from './vorlesen/Vorlesen';

/**
 * Suchmodus für das früheste Rücktrittsalter: bei einem Paar mit nur einer erwerbstätigen Person
 * wird immer deren Alter gesucht (eine nicht erwerbstätige Person hört nicht auf).
 */
export function suchModusFuer(h: Haushalt, gewuenscht: SuchModus): SuchModus {
  if (h.personen.length < 2) return 'gemeinsam';
  const erw = h.personen.map((p) => p.erwerbsstatus !== 'nichtErwerbstaetig');
  if (erw[0] && !erw[1]) return 'p0';
  if (!erw[0] && erw[1]) return 'p1';
  return gewuenscht;
}

const SCHRITTE_DETAIL = ['Personen', 'Einkommen & Vorsorge', 'Vermögen & Ausgaben', 'Annahmen', 'Ergebnis'] as const;
const KURZ_DETAIL = ['Personen', 'Vorsorge', 'Vermögen', 'Annahmen', 'Ergebnis'] as const;
const SCHRITTE_SCHNELL = ['Eingaben', 'Ergebnis'] as const;

function berechne(h: Haushalt, regeln: Regeln, heute: Monat, suchModus: SuchModus): Berechnung {
  const t0 = performance.now();
  try {
    const krisen = krisenOptionen(h);
    const wunsch = simuliere(h, regeln, { start: heute, krisen });
    const person = suchModus === 'p1' && h.personen.length > 1 ? 1 : 0;
    const solver = fruehestesRuecktrittsalter(h, regeln, {
      start: heute,
      krisen,
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

/** Schätzwerte und Berechnung für EINE Version (verzögert, damit die Eingabe flüssig bleibt). Ohne Haushalt: nichts. */
function useVersion(h: Haushalt | null, regeln: Regeln, heute: Monat, suchModus: SuchModus) {
  const verzoegert = useDeferredValue(h);
  const eff = useMemo(() => (h ? effektiverHaushalt(h, regeln, heute) : null), [h, regeln, heute]);
  const effVerzoegert = useMemo(
    () => (verzoegert ? effektiverHaushalt(verzoegert, regeln, heute) : null),
    [verzoegert, regeln, heute],
  );
  const modus: SuchModus = h ? suchModusFuer(h, suchModus) : suchModus;
  const berechnung = useMemo(
    () => (effVerzoegert ? berechne(effVerzoegert.haushalt, regeln, heute, modus) : null),
    [effVerzoegert, regeln, heute, modus],
  );
  return { eff, effVerzoegert, berechnung, modus };
}

function kurzErgebnisText(berechnung: Berechnung, kurz = false): string {
  const solver = berechnung.solver;
  if (berechnung.fehler) return kurz ? 'prüfen' : 'Eingaben prüfen';
  if (solver?.gefunden && solver.alterMonate !== null) {
    if (solver.sofort) return kurz ? 'sofort' : 'Rücktritt sofort möglich';
    return kurz ? fmtAlter(solver.alterMonate) : `Frühestens mit ${fmtAlter(solver.alterMonate)}`;
  }
  return kurz ? 'reicht nicht' : 'Reicht nicht bis 70';
}

export function App() {
  const heute = useMemo<Monat>(() => {
    const d = new Date();
    return { jahr: d.getFullYear(), monat: d.getMonth() + 1 };
  }, []);
  const regeln = useMemo(() => ladeRegeln(heute.jahr), [heute.jahr]);
  const regelStatus = useMemo(() => regelJahrStatus(heute.jahr), [heute.jahr]);
  const speicher = useMemo(() => browserSpeicher(), []);
  const [start] = useState(() => ladeStartzustand(regeln, window.location.hash, speicher));
  const [haushalt, setHaushalt] = useState<Haushalt>(start.haushalt);
  // Version B (Szenario-Vergleich, Auftrag V): null = nur eine Version, die App verhält sich wie bisher
  const [haushaltB, setHaushaltB] = useState<Haushalt | null>(start.szenarien?.b ?? null);
  const [namen, setNamen] = useState<VersionsNamen>(start.szenarien?.namen ?? STANDARD_NAMEN);
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

  // Version B: Änderungen der Darstellung (Schalter im Ergebnis) gelten auch für A
  const bRef = useRef(haushaltB);
  bRef.current = haushaltB;
  const setHB: Setzer = useCallback((fn) => {
    const alt = bRef.current;
    if (!alt) return;
    const neu = fn(alt);
    bRef.current = neu;
    setHaushaltB(neu);
    if (neu.darstellung !== alt.darstellung) setHaushalt((h) => ({ ...h, darstellung: neu.darstellung }));
  }, []);
  // Die Darstellung (heutige Kaufkraft / nominal) gilt für beide Versionen gleich, sonst wären die Zahlen nicht vergleichbar
  const darstellungA = haushalt.darstellung;
  const darstellungB = haushaltB?.darstellung;
  useEffect(() => {
    if (darstellungB !== undefined && darstellungB !== darstellungA)
      setHaushaltB((b) => (b ? { ...b, darstellung: darstellungA } : b));
  }, [darstellungA, darstellungB]);
  const szenarien = useMemo<SzenarienZustand | undefined>(
    () => (haushaltB ? { b: haushaltB, namen } : undefined),
    [haushaltB, namen],
  );

  // Fragment nach dem Laden aus der Adresszeile entfernen (Daten nicht versehentlich weitergeben)
  useEffect(() => {
    entferneHash();
  }, []);

  // Ganzen Zustand im localStorage speichern (falls an) – entprellt
  useEffect(() => {
    const z: AppZustand = { haushalt, ui: { schritt, suchModus, modus: eingabeModus }, szenarien };
    if (ersterLauf.current) {
      ersterLauf.current = false;
      return;
    }
    if (!speichern || linkQuelle) return;
    const t = window.setTimeout(() => speichereLokal(speicher, z), 300);
    return () => window.clearTimeout(t);
  }, [haushalt, schritt, suchModus, eingabeModus, speichern, linkQuelle, speicher, szenarien]);

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
    setzeSpeichern(speicher, v, { haushalt, ui: { schritt, suchModus, modus: eingabeModus }, szenarien });
    if (v) setLinkQuelle(null);
  };

  const vA = useVersion(haushalt, regeln, heute, suchModus);
  const vB = useVersion(haushaltB, regeln, heute, suchModus);
  const modus = vA.modus;
  const eff = vA.eff as NonNullable<typeof vA.eff>;
  const berechnung = vA.berechnung as Berechnung;
  const vergleich = haushaltB !== null;

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
  const propsB =
    haushaltB && vB.eff && vB.berechnung
      ? { h: haushaltB, setH: setHB, regeln, heute, berechnung: vB.berechnung, eff: vB.eff, eingabeModus }
      : null;
  const kurzErgebnis =
    vergleich && vB.berechnung
      ? `A: ${kurzErgebnisText(berechnung, true)} · B: ${kurzErgebnisText(vB.berechnung, true)}`
      : kurzErgebnisText(berechnung);

  // Version B anlegen (Kopie von A), Versionen verwalten
  const legeB = () => {
    setHaushaltB(kopiere(haushalt));
    setNamen(STANDARD_NAMEN);
    setLinkQuelle(null);
  };
  const tauschen = () => {
    if (!haushaltB) return;
    const t = tausche({ a: haushalt, b: haushaltB, namen });
    setHaushalt(t.a);
    setHaushaltB(t.b);
    setNamen(t.namen);
    setLinkQuelle(null);
  };
  const kopierenVon = (von: VersionId) => {
    if (!haushaltB) return;
    const t = ueberschreibe({ a: haushalt, b: haushaltB, namen }, von);
    setHaushalt(t.a);
    setHaushaltB(t.b);
    setLinkQuelle(null);
  };
  const loeschen = (welche: VersionId) => {
    if (!haushaltB) return;
    const r = loescheVersion({ a: haushalt, b: haushaltB, namen }, welche);
    setHaushalt(r.haushalt);
    setHaushaltB(null);
    setNamen(STANDARD_NAMEN);
    setLinkQuelle(null);
  };
  const exportieren = () => {
    if (!haushaltB) return;
    const text = exportiere(haushalt, haushaltB, namen);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportDateiname();
    a.click();
    // verzögert widerrufen: sofortiges Widerrufen kann den Download in manchen Browsern abbrechen (S-17)
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importieren = (text: string): boolean => {
    const r = importiere(text, regeln);
    if (!r) return false;
    setHaushalt(r.a);
    setHaushaltB(r.b);
    setNamen(r.namen);
    setLinkQuelle(null);
    return true;
  };
  const setzeDarstellungBeide = (d: Haushalt['darstellung']) => {
    setH((h) => ({ ...h, darstellung: d }));
    setHB((h) => ({ ...h, darstellung: d }));
  };
  const schrittProps = (p: typeof props, istB: boolean) => ({
    props: p,
    schnell,
    schritt: aktSchritt,
    ergebnisSchritt,
    suchModus: istB ? vB.modus : modus,
    setSuchModus,
    zuDetail: () => {
      setEingabeModus('detailliert');
      setSchritt(1);
      window.scrollTo({ top: 0 });
    },
    onZuruecksetzen: () => {
      if (
        window.confirm(
          `Alle Eingaben${vergleich ? ` von ${istB ? 'Version B' : 'Version A'}` : ''} auf die Standardwerte zurücksetzen?`,
        )
      ) {
        if (istB) setHaushaltB(standardHaushalt(regeln));
        else {
          setHaushalt(standardHaushalt(regeln));
          setLinkQuelle(null);
        }
        if (!vergleich) geheZu(0);
      }
    },
  });

  return (
    <VorlesenAnbieter speicher={speicher} speichern={speichern}>
      <div className={`app${vergleich ? ' app--vergleich' : ''}`}>
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
                  ? 'Die Daten bleiben nur in diesem Browser (localStorage, unverschlüsselt) und werden nirgends hin gesendet. Auf gemeinsam genutzten Geräten ausschalten.'
                  : 'Aus: Es ist nichts gespeichert. Beim Schliessen der Seite gehen die Eingaben verloren.'}
            </small>
          </div>
        </section>
        <header className="kopf">
          <div className="kopf__inner">
            <h1>CH-Rentenrechner</h1>
            <p className="kopf__frage">Wann kann ich aufhören zu arbeiten – und reicht mein Vermögen?</p>
          </div>
        </header>
        <div className="inhalt">
          {regelStatus.fehlt ? (
            <div className="warnung regeljahr-banner" role="alert">
              <strong>Regeln für {regelStatus.angefragt} noch nicht erfasst.</strong> Der Rechner rechnet mit den Werten
              von {regelStatus.verwendet} (Beiträge, Renten, Steuertarife und Grenzen können sich geändert haben). Die
              Ergebnisse sind deshalb möglicherweise ungenau.
            </div>
          ) : null}
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
          <VorlesenSeitenKopf />
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
                ? 'Standard beim ersten Start: wenige Angaben, der Rest wird geschätzt (gesetzliche Werte 2026, Umwandlungssatz ohne Angabe aus dem Durchschnitt der Pensionskassen). Detailwerte gehen nicht verloren.'
                : 'Alle Felder. Leere Felder mit «geschätzt» verwenden die Schätzung des Modus «Schnell».'}
            </p>
          </div>
          {vergleich || (aktSchritt !== 0 && aktSchritt !== ergebnisSchritt) ? null : (
            <section className="vergleich-start" aria-label="Zwei Versionen vergleichen">
              <div>
                <strong>Zwei Varianten vergleichen?</strong>
                <p className="klein">
                  Legen Sie eine Version B als Kopie Ihrer Eingaben an, ändern Sie dort etwas (z.B. späterer Rücktritt
                  oder anderer Wohnkanton) und sehen Sie beide Ergebnisse nebeneinander.
                </p>
              </div>
              <button type="button" className="knopf knopf--sekundaer" onClick={legeB}>
                Version B anlegen
              </button>
            </section>
          )}
          {vergleich && propsB && vA.effVerzoegert && vB.effVerzoegert ? (
            <>
              <Vergleich
                effA={vA.effVerzoegert.haushalt}
                effB={vB.effVerzoegert.haushalt}
                wunschA={berechnung.wunsch}
                wunschB={vB.berechnung?.wunsch ?? null}
                namen={namen}
                darstellung={darstellungVon(haushalt)}
                onDarstellung={setzeDarstellungBeide}
                heute={heute}
              />
              <VersionenLeiste
                namen={namen}
                onNamen={setNamen}
                onTauschen={tauschen}
                onKopieren={kopierenVon}
                onLoeschen={loeschen}
                onExport={exportieren}
                onImport={importieren}
                speichern={speichern}
              />
            </>
          ) : null}
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
            {vergleich && propsB ? (
              <div className="versionen-spalten">
                <section
                  className="versionen-spalte versionen-spalte--a"
                  aria-label={`Eingaben ${anzeigeName(namen.a, 'A')}`}
                >
                  <h3 className="versionen-spalte__kopf">
                    <VersionsMarke id="A" /> {anzeigeName(namen.a, 'A')}
                  </h3>
                  <SchrittInhalt {...schrittProps(props, false)} />
                </section>
                <section
                  className="versionen-spalte versionen-spalte--b"
                  aria-label={`Eingaben ${anzeigeName(namen.b, 'B')}`}
                >
                  <h3 className="versionen-spalte__kopf">
                    <VersionsMarke id="B" /> {anzeigeName(namen.b, 'B')}
                  </h3>
                  <SchrittInhalt {...schrittProps(propsB, true)} />
                </section>
              </div>
            ) : (
              <SchrittInhalt {...schrittProps(props, false)} />
            )}
          </main>
          <footer className="fuss">
            <p>
              Nicht-kommerzielles Projekt · Open Source (MIT) · Regelwerte Stand {regeln.meta.stand} · Keine Cookies,
              kein Tracking, keine Datenübermittlung. Gespeichert wird nur lokal im Browser (abschaltbar ganz oben).
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
        <VorlesenLeiste />
      </div>
    </VorlesenAnbieter>
  );
}
