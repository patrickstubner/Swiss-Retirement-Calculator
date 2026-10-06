/**
 * Interaktive Auswertung: Regler für Rücktrittsalter, Ausgaben, Rendite, Teuerung und Krise.
 * Die Neuberechnung läuft im Web-Worker (ohne die Eingaben zu verändern, bis «Übernehmen»), Kennzahlen,
 * Vermögensverlauf mit Bandbreite (Monte Carlo) und Szenarien nebeneinander.
 * Gerechnet wird mit denselben Funktionen wie im übrigen Ergebnis (simuliere, Solver, Monte Carlo).
 */
import { useDeferredValue, useId, useMemo, useState } from 'react';
import type { Darstellung } from '../../core/nominal';
import type { SolverErgebnis } from '../../core/solver';
import type { Haushalt, KrisenModus, Monat, Person, SimulationsErgebnis } from '../../core/typen';
import { letzterArbeitsmonat } from '../../core/zeitpunkt';
import { neueKrisenAuswahl } from '../../data/defaults';
import { STANDARD_KRISEN_PRO_DEKADE } from '../../data/krisen';
import type { Regeln } from '../../rules';
import { chfKurz, darstellungVon, endBetrag, inFranken, vermoegenReihe } from '../darstellung';
import { chartFarbe } from '../farben';
import { fmtAlter, fmtChf, fmtKompakt, fmtMonat, fmtProzent } from '../format';
import type { Setzer } from '../kontext';
import { krisenAbschnitte, krisenText } from '../krisenGrafik';
import type { McEinstellung } from '../mcKern';
import { useVollMc } from '../mcVergleich';
import { auswertungRechnung, type SzenarioZeile, szenarioEingaben } from '../rechnungKern';
import { useRechnung } from '../rechnungLauf';
import { type Bereich, gemeinsamerBereich, planungsBereich, ruecktrittBereich, verschoben } from '../regler';
import { VorlesenKnoepfe } from '../vorlesen/Vorlesen';
import { LinienChart, type Serie } from './Chart';
import { Faecher } from './Faecher';
import { Segmente } from './Felder';

export type SuchModusA = 'gemeinsam' | 'p0' | 'p1';

/** Was-wäre-wenn-Werte; null = wie eingegeben */
export interface WasWaere {
  /** Rücktrittsalter je Person in Monaten */
  alter: (number | null)[];
  /** Gemeinsamer Regler: Verschiebung in Monaten (nur Anzeige; wirksam sind `alter`) */
  verschiebung: number | null;
  planungsalter: number | null;
  ausgaben: number | null;
  rendite: number | null;
  teuerung: number | null;
  krise: KrisenModus | null;
}

export const KEIN_WAS_WAERE: WasWaere = {
  alter: [null, null],
  verschiebung: null,
  planungsalter: null,
  ausgaben: null,
  rendite: null,
  teuerung: null,
  krise: null,
};

const STANDARD_KRISE = 'finanzkrise2007';

/** Rücktritt (Alter in Monaten) übernehmen; bei Datumseingabe bleibt es ein Datum. */
function mitRuecktritt(p: Person, monate: number): Person {
  if (p.stoppModus === 'datum') return { ...p, stoppDatum: letzterArbeitsmonat(p, monate) };
  return { ...p, stoppModus: 'alter', stoppAlter: monate / 12 };
}

/** Überträgt die Regler auf einen Haushalt (für die Rechnung bzw. zum Übernehmen). */
export function mitWasWaere(h: Haushalt, w: WasWaere, jahr: number): Haushalt {
  const personen = h.personen.map((p, i) => {
    const a = w.alter[i];
    return a === null || a === undefined ? p : mitRuecktritt(p, a);
  });
  const modus = w.krise ?? h.krisen.modus;
  const auswahl =
    modus === 'individuell' && h.krisen.auswahl.length === 0
      ? [neueKrisenAuswahl(STANDARD_KRISE, 'CHE', jahr + 1)]
      : h.krisen.auswahl;
  return {
    ...h,
    personen,
    planungsalter: w.planungsalter ?? h.planungsalter,
    ausgaben: w.ausgaben === null ? h.ausgaben : { ...h.ausgaben, lebenshaltung: w.ausgaben },
    annahmen: {
      ...h.annahmen,
      renditeNominal: w.rendite ?? h.annahmen.renditeNominal,
      inflation: w.teuerung ?? h.annahmen.inflation,
    },
    krisen: modus === h.krisen.modus && auswahl === h.krisen.auswahl ? h.krisen : { ...h.krisen, modus, auswahl },
  };
}

export interface Kennzahlen {
  wunsch: SimulationsErgebnis;
  solver: SolverErgebnis;
}

/** Rechnet Wunsch-Rücktritt und frühestes Alter (gleich wie die Suche der Seite). */
export function rechne(h: Haushalt, regeln: Regeln, start: Monat, modus: SuchModusA): Kennzahlen {
  return auswertungRechnung(h, regeln, start, modus);
}

function reichtBis(e: SimulationsErgebnis, planungsalter: number): string {
  return e.erfolg ? `${planungsalter}+` : String(e.ruinAlter ?? '–');
}

function vermoegenMitAlter(e: SimulationsErgebnis, ref: number, alter: number, d: Darstellung): number | null {
  const z = e.zeilen.find((x) => x.alter[ref] === alter);
  return z ? z.vermoegen * (d === 'nominal' ? z.indexEnde : 1) : null;
}

const fmtVerschiebung = (m: number): string =>
  m === 0 ? '±0 (wie eingegeben)' : `${m > 0 ? '+' : '−'}${fmtAlter(Math.abs(m))}`;
const fmtVerschiebungKurz = (m: number): string => (m === 0 ? '0' : fmtVerschiebung(m));

const GRENZ_TEXT: Record<string, string> = {
  heute: 'frühestens heute',
  hoechstalter: 'spätestens 70 (AHV- und PK-Aufschub höchstens bis 70)',
  heutigesAlter: 'mindestens heutiges Alter + 1',
  maximum: 'Höchstwert',
};

function Regler({
  label,
  wert,
  min,
  max,
  schritt,
  anzeige,
  geaendert,
  onChange,
  skala,
  hinweis,
  mitte,
}: {
  label: string;
  wert: number;
  min: number;
  max: number;
  schritt: number;
  anzeige: string;
  geaendert: boolean;
  onChange: (v: number) => void;
  /** Beschriftung links / rechts unter dem Regler (Grenzen) */
  skala?: [string, string];
  hinweis?: string | null;
  /** Position der Eingabe (Markierung) */
  mitte?: number;
}) {
  const id = useId();
  const listId = `${id}-mitte`;
  const hinweisId = `${id}-hinweis`;
  return (
    <div className={`regler${geaendert ? ' regler--geaendert' : ''}`}>
      <div className="regler__kopf">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{anzeige}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={schritt}
        value={wert}
        disabled={min >= max}
        aria-valuetext={anzeige}
        aria-describedby={hinweis ? hinweisId : undefined}
        list={mitte !== undefined ? listId : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {mitte !== undefined ? (
        <datalist id={listId}>
          <option value={mitte} />
        </datalist>
      ) : null}
      {skala ? (
        <div className="regler__skala" aria-hidden="true">
          <span>{skala[0]}</span>
          <span>{skala[1]}</span>
        </div>
      ) : null}
      {hinweis ? (
        <small id={hinweisId} className="regler__hinweis">
          {hinweis}
        </small>
      ) : null}
    </div>
  );
}

/** Text zu den Grenzen eines Bereichs, z.B. «Begrenzt: spätestens 70 (…)» */
function grenzHinweis(b: Bereich): string | null {
  const g = [b.grenzeUnten, b.grenzeOben].filter((x): x is NonNullable<typeof x> => x !== null);
  return g.length > 0 ? `begrenzt: ${g.map((x) => GRENZ_TEXT[x]).join('; ')}.` : null;
}

interface Props {
  h: Haushalt;
  setH: Setzer;
  effH: Haushalt;
  regeln: Regeln;
  heute: Monat;
  suchModus: SuchModusA;
  namen: string[];
  refIdx: number;
}

export function Auswertung({ h, setH, effH, regeln, heute, suchModus, namen, refIdx }: Props) {
  const [w, setW] = useState<WasWaere>(KEIN_WAS_WAERE);
  const [gemeinsam, setGemeinsam] = useState(true);
  const geaendert =
    w.alter.some((a) => a !== null && a !== undefined) ||
    w.planungsalter !== null ||
    w.ausgaben !== null ||
    w.rendite !== null ||
    w.teuerung !== null ||
    w.krise !== null;
  const hw = useMemo(() => mitWasWaere(effH, w, heute.jahr), [effH, w, heute.jahr]);
  const hwVerz = useDeferredValue(hw);
  const ausVorlage = useMemo(
    () => ({
      art: 'auswertung' as const,
      id: 0,
      jahr: heute.jahr,
      monat: heute.monat,
      haushalt: hwVerz,
      suchModus,
    }),
    [hwVerz, heute, suchModus],
  );
  const ausStand = useRechnung(ausVorlage, (m) => (m.art === 'auswertung' ? m.kennzahlen : undefined));
  const k = ausStand.wert;
  const ausLaeuft = ausStand.laeuft || (k === null && ausStand.fehler === null);
  // Monte Carlo (wiederkehrende Krisen) für Erfolgswahrscheinlichkeit und Bandbreite – etwas verzögert
  const mcEingabe = useDeferredValue(hwVerz);
  const mcEinstellung = useMemo<McEinstellung>(
    () => ({
      art: 'wiederkehrend',
      laeufe: 150,
      seed: 20260927,
      krisenProDekade: mcEingabe.krisen.mcKrisenProDekade ?? STANDARD_KRISEN_PRO_DEKADE,
      blockLaenge: 5,
      bootstrapLand: 'CHE',
    }),
    [mcEingabe.krisen.mcKrisenProDekade],
  );
  // Läuft im Web-Worker (Ersatz im Hauptthread ohne Worker); die Oberfläche bleibt bedienbar
  const mc = useVollMc(mcEingabe, heute, mcEinstellung).ergebnis;

  const abschnitte = useMemo(() => (k ? krisenAbschnitte(k.wunsch, refIdx) : []), [k, refIdx]);
  const dar = darstellungVon(h);
  const chart = useMemo(() => {
    if (!k) return null;
    const x = k.wunsch.zeilen.map((z) => z.alter[refIdx] ?? 0);
    const ihr: Serie = { label: 'Ihr Szenario', werte: vermoegenReihe(k.wunsch, dar), farbe: chartFarbe('haupt') };
    return { x, ihr, mitMc: mc !== null && mc.jahre.length === x.length };
  }, [k, mc, refIdx, dar]);

  // Rücktrittsregler: nur erwerbstätige Personen, die noch nicht im Ruhestand sind
  const bereiche = effH.personen.map((p) =>
    p.erwerbsstatus === 'nichtErwerbstaetig' ? null : ruecktrittBereich(p, heute, regeln),
  );
  const mitRegler = bereiche.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
  const zweiRegler = mitRegler.length > 1;
  const gemeinsamAktiv = zweiRegler && gemeinsam;
  const gBereich = gemeinsamerBereich(bereiche.filter((b): b is Bereich => b !== null));
  const pBereich = planungsBereich(effH, heute);
  const personAnzeige = (i: number, monate: number) => {
    const p = effH.personen[i];
    if (!p) return fmtAlter(monate);
    return p.stoppModus === 'datum'
      ? `${fmtAlter(monate)} · letzter Arbeitsmonat ${fmtMonat(letzterArbeitsmonat(p, monate))}`
      : fmtAlter(monate);
  };
  const setzeVerschiebung = (d: number) =>
    setW((x) => ({
      ...x,
      verschiebung: d === 0 ? null : d,
      alter: bereiche.map((b) => (b && d !== 0 ? verschoben(b, d).alter : null)),
    }));
  const gemeinsamText = () => {
    const d = w.verschiebung ?? 0;
    return mitRegler
      .map((i) => {
        const b = bereiche[i] as Bereich;
        const v = verschoben(b, d);
        return `${namen[i]}: ${fmtAlter(v.alter)}${v.begrenzt ? ` (bleibt an der Grenze: ${d < 0 ? GRENZ_TEXT.heute : 'spätestens 70'})` : ''}`;
      })
      .join(' · ');
  };

  const basisAusgaben = effH.ausgaben.lebenshaltung;
  const ausgabenMax = Math.max(20_000, Math.ceil((basisAusgaben * 2) / 1000) * 1000);
  const krisenModus = w.krise ?? h.krisen.modus;

  const uebernehmen = () => {
    setH((x) => mitWasWaere(x, w, heute.jahr));
    setW(KEIN_WAS_WAERE);
  };

  return (
    <section className="karte karte--auswertung" aria-labelledby="auswertung-titel">
      <div className="karte__kopf">
        <h2 id="auswertung-titel">Was wäre, wenn …?</h2>
        <VorlesenKnoepfe titel="Was wäre, wenn" />
      </div>
      <p className="karte__untertitel">
        Schieben Sie die Regler – das Ergebnis wird neu gerechnet. Ihre Eingaben bleiben unverändert, bis Sie
        «Übernehmen» wählen.
      </p>
      {ausLaeuft ? (
        <p className="info" role="status">
          {k ? 'Wird neu gerechnet …' : 'Rechnet …'}
        </p>
      ) : null}
      {k ? (
        <div className="kennzahlen kennzahlen--vier" role="status" aria-live="polite">
          <div>
            <span className="kennzahl__wert">{reichtBis(k.wunsch, hw.planungsalter)}</span>
            <span className="kennzahl__text">Geld reicht bis Alter</span>
          </div>
          <div>
            <span className="kennzahl__wert">{mc ? fmtProzent(mc.erfolgsquote, 0) : '…'}</span>
            <span className="kennzahl__text">Erfolgs&shy;wahrscheinlichkeit mit wiederkehrenden Krisen</span>
          </div>
          <div>
            <span className="kennzahl__wert">
              {k.solver.gefunden && k.solver.alterMonate !== null
                ? k.solver.sofort
                  ? 'sofort'
                  : fmtAlter(k.solver.alterMonate)
                : 'über 70'}
            </span>
            <span className="kennzahl__text">Frühestes Rücktrittsalter</span>
          </div>
          <div>
            <span className="kennzahl__wert">{fmtKompakt(endBetrag(k.wunsch, dar))}</span>
            <span className="kennzahl__text">Vermögen am Ende ({chfKurz(dar)})</span>
          </div>
        </div>
      ) : ausLaeuft ? null : (
        <p className="warnung">Berechnung nicht möglich – bitte Eingaben prüfen.</p>
      )}

      <div className="regler-gruppe">
        {zweiRegler ? (
          <div className="regler-umschalter">
            <Segmente<'gemeinsam' | 'einzeln'>
              label="Rücktritt verschieben"
              value={gemeinsam ? 'gemeinsam' : 'einzeln'}
              optionen={[
                { value: 'gemeinsam', label: 'Gemeinsam' },
                { value: 'einzeln', label: 'Pro Person' },
              ]}
              onChange={(v) => {
                setGemeinsam(v === 'gemeinsam');
                setW((x) => ({ ...x, alter: [null, null], verschiebung: null }));
              }}
            />
          </div>
        ) : null}
        {gemeinsamAktiv && gBereich ? (
          <Regler
            key="ruecktritt-gemeinsam"
            label="Rücktritt beider um"
            wert={w.verschiebung ?? 0}
            min={gBereich.min}
            max={gBereich.max}
            schritt={1}
            mitte={0}
            anzeige={fmtVerschiebung(w.verschiebung ?? 0)}
            geaendert={w.verschiebung !== null}
            skala={[fmtVerschiebungKurz(gBereich.min), fmtVerschiebungKurz(gBereich.max)]}
            hinweis={`Neu: ${gemeinsamText()} · Bereich ${fmtVerschiebungKurz(gBereich.min)} bis ${fmtVerschiebungKurz(gBereich.max)}${gBereich.grenzeUnten || gBereich.grenzeOben ? ` – ${grenzHinweis(gBereich)}` : ' (±10 Jahre).'}`}
            onChange={setzeVerschiebung}
          />
        ) : (
          mitRegler.map((i) => {
            const b = bereiche[i] as Bereich;
            const wert = w.alter[i] ?? b.mitte;
            return (
              <Regler
                key={`ruecktritt-${i === 0 ? 'a' : 'b'}`}
                label={mitRegler.length > 1 || h.personen.length > 1 ? `Rücktritt ${namen[i]}` : 'Rücktrittsalter'}
                wert={wert}
                min={b.min}
                max={b.max}
                schritt={1}
                mitte={b.mitte}
                anzeige={personAnzeige(i, wert)}
                geaendert={w.alter[i] !== null && w.alter[i] !== undefined}
                skala={[fmtAlter(b.min), fmtAlter(b.max)]}
                hinweis={`Eingabe: ${fmtAlter(b.mitte)} · ${grenzHinweis(b) ?? 'Bereich ±10 Jahre.'}`}
                onChange={(v) =>
                  setW((x) => ({
                    ...x,
                    alter: [0, 1].map((j) => (j === i ? (v === b.mitte ? null : v) : (x.alter[j] ?? null))),
                  }))
                }
              />
            );
          })
        )}
        {h.personen.some((p) => p.erwerbsstatus !== 'nichtErwerbstaetig') && mitRegler.length === 0 ? (
          <p className="klein">Rücktritt: bereits im Ruhestand, kein Regler.</p>
        ) : null}
        <Regler
          label="Planungsalter (Lebensende)"
          wert={w.planungsalter ?? pBereich.mitte}
          min={pBereich.min}
          max={pBereich.max}
          schritt={1}
          mitte={pBereich.mitte}
          anzeige={`${w.planungsalter ?? pBereich.mitte} Jahre`}
          geaendert={w.planungsalter !== null}
          skala={[`${pBereich.min}`, `${pBereich.max}`]}
          hinweis={`Eingabe: ${pBereich.mitte}${h.personen.length > 1 ? ` (Alter ${namen[refIdx]})` : ''} · ${grenzHinweis(pBereich) ?? 'Bereich ±20 Jahre.'}`}
          onChange={(v) => setW((x) => ({ ...x, planungsalter: v === pBereich.mitte ? null : v }))}
        />
        <Regler
          label="Ausgaben pro Jahr (heute)"
          wert={w.ausgaben ?? basisAusgaben}
          min={0}
          max={ausgabenMax}
          schritt={1000}
          anzeige={fmtChf(w.ausgaben ?? basisAusgaben)}
          geaendert={w.ausgaben !== null}
          onChange={(v) => setW((x) => ({ ...x, ausgaben: v }))}
        />
        <Regler
          label="Rendite Börse (nominal)"
          wert={w.rendite ?? effH.annahmen.renditeNominal}
          min={0}
          max={0.1}
          schritt={0.0025}
          anzeige={fmtProzent(w.rendite ?? effH.annahmen.renditeNominal, 2)}
          geaendert={w.rendite !== null}
          onChange={(v) => setW((x) => ({ ...x, rendite: v }))}
        />
        <Regler
          label="Teuerung"
          wert={w.teuerung ?? effH.annahmen.inflation}
          min={0}
          max={0.05}
          schritt={0.0025}
          anzeige={fmtProzent(w.teuerung ?? effH.annahmen.inflation, 2)}
          geaendert={w.teuerung !== null}
          onChange={(v) => setW((x) => ({ ...x, teuerung: v }))}
        />
        <p className="krisen-sprung">
          <a href="#krisen">Krisen einstellen</a>
          {'. '}
          {krisenModus === 'keine'
            ? 'Derzeit keine Krise: jedes Jahr gilt Ihre Renditeannahme (Standard wäre «Automatisch»).'
            : krisenModus === 'automatisch'
              ? 'Derzeit automatisch: normale historische Krisen im Abstand gemäss Häufigkeit. Häufigkeit und Beginn stehen in der Karte «Krisen».'
              : h.krisen.auswahl.length === 0
                ? 'Derzeit individuell, die Liste ist leer. In der Karte «Krisen» eine Krise hinzufügen oder die automatischen Krisen übernehmen.'
                : `Derzeit individuell mit ${h.krisen.auswahl.length} ${h.krisen.auswahl.length === 1 ? 'Eintrag' : 'Einträgen'} in der Karte «Krisen».`}
        </p>
      </div>
      {geaendert ? (
        <div className="knopf-reihe">
          <button
            type="button"
            className="knopf knopf--sekundaer"
            onClick={() => {
              setW(KEIN_WAS_WAERE);
            }}
          >
            Zurücksetzen
          </button>
          <button type="button" className="knopf" onClick={uebernehmen}>
            Übernehmen
          </button>
        </div>
      ) : null}

      {chart ? (
        <>
          <h3 className="unter-titel">Vermögensverlauf mit Bandbreite</h3>
          <p className="klein">Verfügbares Vermögen {inFranken(dar)}.</p>
          {mc && chart.mitMc ? (
            <Faecher
              m={mc}
              x={chart.x}
              xLabel={h.personen.length > 1 ? `Alter ${namen[refIdx]}` : 'Alter'}
              darstellung={dar}
              planungsalter={hw.planungsalter}
              zusatz={chart.ihr}
              markierungen={abschnitte}
              text={`Linie «Ihr Szenario»: Ihre Annahmen.${abschnitte.length > 0 ? ` Farbig hinterlegte Krisenjahre: ${krisenText(abschnitte)}.` : ''}`}
            />
          ) : (
            <LinienChart
              x={chart.x}
              xLabel={h.personen.length > 1 ? `Alter ${namen[refIdx]}` : 'Alter'}
              serien={[chart.ihr]}
              markierungen={abschnitte}
              hoehe={260}
              beschreibung={`Verfügbares Vermögen ${inFranken(dar)} in Ihrem Szenario.`}
            />
          )}
          {abschnitte.length > 0 ? (
            <p className="krisen-legende">
              <span className="krisen-legende__farbe" aria-hidden="true" /> Krisenjahre in «Ihr Szenario»:{' '}
              {krisenText(abschnitte)}
            </p>
          ) : null}
          <p className="klein">
            Linie «Ihr Szenario»: Ihre Annahmen
            {krisenModus === 'automatisch'
              ? ' mit der automatischen Krisenfolge'
              : krisenModus === 'individuell'
                ? ' mit Ihren Krisen'
                : ''}
            . Fächer: {mc?.laeufe ?? 150} Monte-Carlo-Läufe mit zufällig verteilten historischen Krisen (
            {(h.krisen.mcKrisenProDekade ?? STANDARD_KRISEN_PRO_DEKADE).toLocaleString('de-CH')} pro Dekade).
          </p>
        </>
      ) : null}

      <SzenarioVergleich
        hw={hwVerz}
        darstellung={dar}
        heute={heute}
        suchModus={suchModus}
        refIdx={refIdx}
        xLabel={h.personen.length > 1 ? `Alter ${namen[refIdx]}` : 'Alter'}
      />
    </section>
  );
}

const SZENARIO_FARBEN = ['haupt', 'negativ', 'band', 'pk'] as const;

/** Szenarien nebeneinander: Ihr Szenario, Krise ja/nein, alles Kapital, alles Rente. */
export function SzenarioVergleich({
  hw,
  heute,
  suchModus,
  refIdx,
  xLabel,
  darstellung = 'real',
}: {
  hw: Haushalt;
  darstellung?: Darstellung;
  heute: Monat;
  suchModus: SuchModusA;
  refIdx: number;
  xLabel: string;
}) {
  const szenarioVorlage = useMemo(
    () => ({
      art: 'szenarien' as const,
      id: 0,
      jahr: heute.jahr,
      monat: heute.monat,
      eingaben: szenarioEingaben(hw, heute.jahr),
      suchModus,
    }),
    [hw, heute, suchModus],
  );
  const szenarioStand = useRechnung(szenarioVorlage, (m): SzenarioZeile[] | undefined =>
    m.art === 'szenarien' ? m.zeilen : undefined,
  );
  const szenarien = szenarioStand.wert ?? [];
  const szenarioLaeuft = szenarioStand.laeuft || (szenarioStand.wert === null && szenarioStand.fehler === null);

  const grafik = useMemo(() => {
    const erste = szenarien[0]?.k;
    if (!erste) return null;
    const x = erste.wunsch.zeilen.map((z) => z.alter[refIdx] ?? 0);
    const serien: Serie[] = [];
    szenarien.forEach((s, i) => {
      if (!s.k || s.k.wunsch.zeilen.length !== x.length) return;
      serien.push({
        label: s.name,
        werte: vermoegenReihe(s.k.wunsch, darstellung),
        farbe: chartFarbe(SZENARIO_FARBEN[i % SZENARIO_FARBEN.length] ?? 'haupt'),
        ...(i > 1 ? { gestrichelt: true } : {}),
      });
    });
    // Krisenjahre aus dem Szenario mit Krise (Ihr Szenario oder die Krisen-Variante)
    const mitKrise = szenarien.slice(0, 2).find((s) => s.k && s.k.wunsch.krisenJahre.length > 0);
    const abschnitte = mitKrise?.k ? krisenAbschnitte(mitKrise.k.wunsch, refIdx) : [];
    return { x, serien, abschnitte, krisenVon: mitKrise?.name ?? '' };
  }, [szenarien, refIdx, darstellung]);
  const anzahl = szenarien.length;
  const titel = `${anzahl === 4 ? 'Vier' : anzahl === 3 ? 'Drei' : 'Zwei'} Varianten Ihres Plans im Vergleich`;

  if (szenarien.length === 0) {
    return szenarioLaeuft ? (
      <p className="info" role="status">
        Varianten werden gerechnet …
      </p>
    ) : null;
  }

  return (
    <>
      {szenarioLaeuft ? (
        <p className="info" role="status">
          Varianten werden neu gerechnet …
        </p>
      ) : null}
      <h3 className="unter-titel">{titel}</h3>
      <p className="klein">
        Jede Linie ist Ihr Plan mit genau einer Änderung, ohne Zufall gerechnet: So sehen Sie, wie stark{' '}
        {szenarien[1]?.name === 'Ohne Krise' ? 'die Krisen' : 'eine Finanzkrise beim Rücktritt'}
        {anzahl > 2 ? ' und die Wahl Kapital oder Rente bei der Pensionskasse' : ''} Ihr verfügbares Vermögen{' '}
        {inFranken(darstellung)} verändern.
      </p>
      <div className="szenarien">
        {szenarien.map((s) => (
          <section key={s.name} className="szenario" aria-label={s.name}>
            <h4>{s.name}</h4>
            {s.k ? (
              <dl>
                <dt>Reicht bis Alter</dt>
                <dd className={s.k.wunsch.erfolg ? 'ok' : 'negativ'}>{reichtBis(s.k.wunsch, s.planungsalter)}</dd>
                <dt>Frühester Rücktritt</dt>
                <dd>
                  {s.k.solver.gefunden && s.k.solver.alterMonate !== null
                    ? s.k.solver.sofort
                      ? 'sofort'
                      : fmtAlter(s.k.solver.alterMonate)
                    : 'über 70'}
                </dd>
                <dt>Vermögen mit 85</dt>
                <dd>{fmtKompakt(vermoegenMitAlter(s.k.wunsch, refIdx, 85, darstellung) ?? 0)}</dd>
                <dt>Am Ende</dt>
                <dd>{fmtKompakt(endBetrag(s.k.wunsch, darstellung))}</dd>
              </dl>
            ) : (
              <p className="klein">nicht berechenbar</p>
            )}
          </section>
        ))}
      </div>
      {grafik && grafik.serien.length > 1 ? (
        <>
          <LinienChart
            x={grafik.x}
            xLabel={xLabel}
            serien={grafik.serien}
            markierungen={grafik.abschnitte}
            hoehe={240}
            beschreibung={`Verfügbares Vermögen der Varianten ${inFranken(darstellung)}: ${grafik.serien.map((s) => s.label).join(', ')}.${grafik.abschnitte.length > 0 ? ` Farbig hinterlegt die Krisenjahre aus «${grafik.krisenVon}»: ${krisenText(grafik.abschnitte)}.` : ''}`}
          />
          {grafik.abschnitte.length > 0 ? (
            <p className="krisen-legende">
              <span className="krisen-legende__farbe" aria-hidden="true" /> Krisenjahre aus «{grafik.krisenVon}»:{' '}
              {krisenText(grafik.abschnitte)}
            </p>
          ) : null}
        </>
      ) : null}
      <p className="klein">
        Gleiche Eingaben und Regler wie oben; geändert ist nur die Spalte. Anders als der Fächer oben zeigt diese Grafik
        keine Wahrscheinlichkeiten, sondern je Variante einen einzigen Verlauf. «PK ganz als Kapital/Rente» ändert den
        Kapitalanteil der Pensionskasse aller Personen (Steuern und Umwandlungssatz wie sonst).
      </p>
    </>
  );
}
