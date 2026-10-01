/**
 * Krisenszenarien im Ergebnis: historische Krisen abspielen, Monte Carlo mit wiederkehrenden
 * Krisen und die historische Krisenhäufigkeit pro Dekade (JST R6).
 */
import { useDeferredValue, useMemo } from 'react';
import { datenVollstaendig, type KrisenLand, krisenPfad, maxRealerRueckgang } from '../../core/krisen';
import { monteCarlo } from '../../core/montecarlo';
import { simuliere } from '../../core/simulation';
import type {
  Haushalt,
  KrisenAuswahl,
  KrisenEinstellungen,
  KrisenModus,
  Monat,
  SimulationsErgebnis,
} from '../../core/typen';
import { neueKrisenAuswahl } from '../../data/defaults';
import {
  AUTO_KRISEN,
  autoHaeufigkeit,
  autoNormal,
  autoVersatz,
  HAEUFIGKEIT,
  KRISEN,
  KRISEN_DATEN,
  KRISEN_DATEN_STAND,
  kriseNach,
  krisenAbstand,
  krisenOptionen,
  LAND_NAMEN,
  mcKrisenPool,
  STANDARD_KRISEN_PRO_DEKADE,
  standardErsteKrise,
} from '../../data/krisen';
import type { Regeln } from '../../rules';
import { darstellungVon, endBetrag, inFranken } from '../darstellung';
import { fmtChf, fmtProzent } from '../format';
import type { Setzer } from '../kontext';
import { krisenAbschnitte, krisenText } from '../krisenGrafik';
import { Faecher } from './Faecher';
import { AuswahlFeld, Schalter, Segmente, ZahlFeld } from './Felder';
import { Karte } from './Karte';
import { ScrollTabelle } from './ScrollTabelle';

const LAENDER: readonly KrisenLand[] = ['CHE', 'USA', 'JPN'];
const BASIS0 = { renditeNominal: 0, renditeBargeld: 0, inflation: 0 };

function setzeKrisen(setH: Setzer, fn: (k: KrisenEinstellungen) => KrisenEinstellungen) {
  setH((h) => ({ ...h, krisen: fn(h.krisen) }));
}

const fmtJahre = (x: number) => x.toLocaleString('de-CH', { maximumFractionDigits: 1 });
const fmtDek = (x: number) => x.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** ISO-Datum → 27.9.2026 */
const fmtStand = (iso: string) => {
  const [j, m, t] = iso.split('-');
  return `${Number(t)}.${Number(m)}.${j}`;
};

interface Props {
  h: Haushalt;
  setH: Setzer;
  /** effektiver Haushalt (mit Schätzwerten) */
  effH: Haushalt;
  regeln: Regeln;
  heute: Monat;
  /** Wunsch-Rücktritt mit Krise (falls aktiv) */
  wunsch: SimulationsErgebnis | null;
  refIdx: number;
  namen: string[];
}

export function KrisenKarte({ h, setH, effH, regeln, heute, wunsch, refIdx, namen }: Props) {
  const k = h.krisen;
  const aktiv = krisenOptionen(effH) !== undefined;
  // Vergleich ohne Krise (gleiche Eingaben)
  const ohne = useMemo(
    () => (aktiv ? simuliere({ ...effH, krisen: { ...effH.krisen, modus: 'keine' } }, regeln, { start: heute }) : null),
    [aktiv, effH, regeln, heute],
  );
  const abschnitte = useMemo(() => (wunsch ? krisenAbschnitte(wunsch, refIdx) : []), [wunsch, refIdx]);
  const rate = autoHaeufigkeit(k);
  const standardJahr = standardErsteKrise(rate);
  // Ausgleich über den eigenen Planungshorizont (aus der Simulation mit Wunsch-Rücktritt)
  const normal = k.modus === 'automatisch' ? (wunsch?.krisenNormal ?? null) : null;
  const umlauf = k.modus === 'automatisch' ? autoNormal(effH) : null;
  const horizont = wunsch ? `${wunsch.zeilen[0]?.jahr ?? heute.jahr}–${wunsch.zeilen.at(-1)?.jahr ?? ''}` : '';
  const erwName =
    namen[
      Math.max(
        0,
        h.personen.findIndex((p) => p.erwerbsstatus !== 'nichtErwerbstaetig'),
      )
    ];

  const setzeAuswahl = (i: number, fn: (a: KrisenAuswahl) => KrisenAuswahl) =>
    setzeKrisen(setH, (kr) => ({ ...kr, auswahl: kr.auswahl.map((a, j) => (j === i ? fn(a) : a)) }));

  return (
    <Karte
      titel="Krisen"
      untertitel="Wie wirken Börsenkrisen auf Ihr Vermögen? Die App spielt die echten Jahresrenditen und die Teuerung historischer Krisenjahre ab. Die Wahl gilt für das ganze Ergebnis."
    >
      <Segmente<KrisenModus>
        label="Krisenmodus"
        value={k.modus}
        optionen={[
          { value: 'keine', label: 'Keine Krise' },
          { value: 'automatisch', label: 'Auto\u00admatisch' },
          { value: 'individuell', label: 'Indi\u00adviduell' },
        ]}
        onChange={(modus) =>
          setzeKrisen(setH, (kr) => ({
            ...kr,
            modus,
            auswahl:
              modus === 'individuell' && kr.auswahl.length === 0
                ? [neueKrisenAuswahl('finanzkrise2007', 'CHE', heute.jahr + 1)]
                : kr.auswahl,
          }))
        }
      />
      {k.modus === 'keine' ? (
        <p className="klein">
          Jedes Jahr gilt Ihre Renditeannahme – ein glatter, eher zu schöner Verlauf. Standard ist «Automatisch»
          (realistischer).
        </p>
      ) : null}

      {k.modus === 'automatisch' ? (
        <>
          <p className="klein">
            Standard für neue Berechnungen. Die App legt die «normalen» Krisen der Geschichte der Reihe nach in die
            Zukunft: {AUTO_KRISEN.map((x) => x.kurz).join(', ')} – danach wieder von vorne. Die Grosse Depression, die
            Stagflation 1973–81 und Japan ab 1990 gelten als extrem; sie sind nur bei «Individuell» wählbar.
          </p>
          <ZahlFeld
            label="Krisen pro 10 Jahre"
            hinweis={`Standard ${fmtDek(STANDARD_KRISEN_PRO_DEKADE)}: so oft fielen Schweizer Aktien real um 20 % oder mehr (1900–2020, JST). Das heisst im Schnitt alle ${fmtJahre(krisenAbstand(STANDARD_KRISEN_PRO_DEKADE))} Jahre eine Krise.`}
            value={rate}
            min={0.1}
            max={5}
            nachkomma={2}
            onChange={(v) => setzeKrisen(setH, (kr) => ({ ...kr, autoProDekade: v }))}
          />
          <Segmente<'jahr' | 'nachRuecktritt'>
            label="Erste Krise"
            value={k.autoStartArt}
            optionen={[
              { value: 'jahr', label: 'Im Kalenderjahr' },
              { value: 'nachRuecktritt', label: 'Nach dem Rücktritt' },
            ]}
            onChange={(autoStartArt) => setzeKrisen(setH, (kr) => ({ ...kr, autoStartArt }))}
          />
          {k.autoStartArt === 'jahr' ? (
            <ZahlFeld
              label="Kalenderjahr der ersten Krise"
              hinweis={`Standard ${standardJahr}: letzte Krise der Liste (Zinsschock 2022) plus ein mittlerer Abstand von ${fmtJahre(krisenAbstand(rate))} Jahren, gerundet. So läuft der historische Rhythmus weiter.`}
              value={k.autoStartJahr ?? standardJahr}
              min={1900}
              max={2200}
              nachkomma={0}
              onChange={(j) =>
                setzeKrisen(setH, (kr) => ({
                  ...kr,
                  autoStartJahr: Math.round(j) === standardJahr ? null : Math.round(j),
                }))
              }
            />
          ) : (
            <ZahlFeld
              label="Jahre nach dem Rücktritt"
              hinweis={`0 = im Jahr des Rücktritts von ${erwName}. Das ist ein Stresstest: Eine Krise gleich nach dem Rücktritt trifft am härtesten.`}
              value={k.autoJahreNach}
              min={-30}
              max={60}
              nachkomma={0}
              einheit="Jahre"
              onChange={(j) => setzeKrisen(setH, (kr) => ({ ...kr, autoJahreNach: Math.round(j) }))}
            />
          )}
          {normal ? (
            <p className="klein">
              Die Krisenjahre ersetzen Ihre Renditeannahme – sie kommen nicht noch dazu. Damit der Durchschnitt Ihrer
              Annahme entspricht, rechnet die App in normalen Jahren mit{' '}
              <strong>{fmtProzent(normal.wertschriften, 2)}</strong> statt {fmtProzent(effH.annahmen.renditeNominal, 2)}{' '}
              (Wertschriften, Ihr Mix) und mit <strong>{fmtProzent(normal.wohneigentum, 2)}</strong> (Hauspreise). So
              entspricht der reale Durchschnitt über Ihren Planungszeitraum ({horizont}) genau Ihrer Annahme – mit den
              Krisen, die in diesen Zeitraum fallen.
              {umlauf
                ? ` Zum Vergleich: Ausgleich über einen ganzen Umlauf der Liste (${autoVersatz(AUTO_KRISEN.length, rate)} Jahre) wären ${fmtProzent(umlauf.wertschriften, 2)}.`
                : ''}
            </p>
          ) : null}
        </>
      ) : null}

      {k.modus === 'individuell' ? (
        <>
          <p className="klein">
            Legen Sie selbst fest, welche Krise wann beginnt – auch die extremen. Das ist ein Stresstest: Die Krisen
            ersetzen die Renditeannahme in diesen Jahren, die übrigen Jahre bleiben unverändert.
          </p>
          {k.auswahl.map((a, i) => {
            const krise = kriseNach(a.id);
            if (!krise) return null;
            const pfad = krisenPfad(krise, a.land, h.annahmen.aktienanteil, KRISEN_DATEN, BASIS0);
            const dd = maxRealerRueckgang(pfad);
            const lander = LAENDER.filter((l) => datenVollstaendig(krise, l, KRISEN_DATEN));
            const teuerung = pfad.reduce((s, p) => s * (1 + p.teuerung), 1) - 1;
            return (
              <div key={a.uid} className="unterkarte krise">
                <AuswahlFeld
                  label={k.auswahl.length > 1 ? `Krise ${i + 1}` : 'Krise'}
                  value={a.id}
                  optionen={KRISEN.map((x) => ({
                    value: x.id,
                    label: AUTO_KRISEN.includes(x) ? x.name : `${x.name} (extrem)`,
                  }))}
                  onChange={(id) => setzeAuswahl(i, (x) => ({ ...x, id, land: kriseNach(id)?.land ?? x.land }))}
                />
                <p className="klein">{krise.beschreibung}</p>
                <AuswahlFeld<KrisenLand>
                  label="Daten aus"
                  value={lander.includes(a.land) ? a.land : krise.land}
                  optionen={lander.map((l) => ({ value: l, label: LAND_NAMEN[l] }))}
                  onChange={(land) => setzeAuswahl(i, (x) => ({ ...x, land }))}
                />
                <Segmente<KrisenAuswahl['startArt']>
                  label="Beginn"
                  value={a.startArt}
                  optionen={[
                    { value: 'jahr', label: 'Kalender\u00adjahr' },
                    { value: 'alter', label: 'Alter' },
                    { value: 'nachRuecktritt', label: 'Nach Rücktritt' },
                  ]}
                  onChange={(startArt) => setzeAuswahl(i, (x) => ({ ...x, startArt }))}
                />
                {a.startArt === 'jahr' ? (
                  <ZahlFeld
                    label="Kalenderjahr des Krisenbeginns"
                    value={a.jahr}
                    min={1900}
                    max={2200}
                    nachkomma={0}
                    onChange={(jahr) => setzeAuswahl(i, (x) => ({ ...x, jahr: Math.round(jahr) }))}
                  />
                ) : a.startArt === 'alter' ? (
                  <>
                    {h.personen.length > 1 ? (
                      <AuswahlFeld<string>
                        label="Alter von"
                        value={String(a.person)}
                        optionen={h.personen.map((_p, j) => ({ value: String(j), label: namen[j] ?? '' }))}
                        onChange={(v) => setzeAuswahl(i, (x) => ({ ...x, person: Number(v) }))}
                      />
                    ) : null}
                    <ZahlFeld
                      label="Alter bei Krisenbeginn"
                      hinweis={`Die Krise beginnt im Kalenderjahr, in dem ${namen[a.person] ?? namen[0]} dieses Alter erreicht.`}
                      value={a.alter}
                      min={0}
                      max={130}
                      nachkomma={0}
                      einheit="Jahre"
                      onChange={(v) => setzeAuswahl(i, (x) => ({ ...x, alter: Math.round(v) }))}
                    />
                  </>
                ) : (
                  <ZahlFeld
                    label="Jahre nach dem Rücktritt"
                    hinweis={`0 = im Jahr des Rücktritts von ${erwName}.`}
                    value={a.jahreNach}
                    min={-30}
                    max={60}
                    nachkomma={0}
                    einheit="Jahre"
                    onChange={(j) => setzeAuswahl(i, (x) => ({ ...x, jahreNach: Math.round(j) }))}
                  />
                )}
                <p className="klein">
                  {krise.von === krise.bis ? krise.von : `${krise.von}–${krise.bis}`}, Daten {LAND_NAMEN[a.land]}: Ihr
                  Mix ({fmtProzent(h.annahmen.aktienanteil, 0)} Aktien) verliert real bis zu{' '}
                  <strong>{fmtProzent(-dd, 0)}</strong>; Teuerung total {fmtProzent(teuerung, 0)}.
                </p>
                <button
                  type="button"
                  className="knopf knopf--sekundaer"
                  onClick={() => setzeKrisen(setH, (kr) => ({ ...kr, auswahl: kr.auswahl.filter((_, j) => j !== i) }))}
                >
                  Krise entfernen
                </button>
              </div>
            );
          })}
          {k.auswahl.length < 8 ? (
            <button
              type="button"
              className="knopf knopf--sekundaer"
              onClick={() =>
                setzeKrisen(setH, (kr) => ({
                  ...kr,
                  auswahl: [
                    ...kr.auswahl,
                    { ...neueKrisenAuswahl('dotcom2000', 'CHE', heute.jahr + 1), jahreNach: 10 },
                  ],
                }))
              }
            >
              Weitere Krise hinzufügen
            </button>
          ) : null}
          {k.auswahl.length === 0 ? (
            <p className="warnung">Die Liste ist leer – es wird ohne Krise gerechnet.</p>
          ) : null}
        </>
      ) : null}

      {k.modus !== 'keine' ? (
        <>
          <AktienanteilFeld h={h} setH={setH} />
          {wunsch && ohne ? (
            <div className="vergleich" role="status">
              <div>
                <h3>Ohne Krise</h3>
                <p>{ohne.erfolg ? 'Reicht bis zum Planungsalter' : `Reicht bis ${ohne.ruinJahr}`}</p>
                <p className="klein">Am Ende: {fmtChf(endBetrag(ohne, darstellungVon(h)))}</p>
              </div>
              <div>
                <h3>{k.modus === 'automatisch' ? 'Mit Krisen (automatisch)' : 'Mit Ihren Krisen'}</h3>
                <p className={wunsch.erfolg ? 'ok' : 'negativ'}>
                  {wunsch.erfolg
                    ? 'Reicht bis zum Planungsalter'
                    : `Reicht bis ${wunsch.ruinJahr} (Alter ${wunsch.ruinAlter})`}
                </p>
                <p className="klein">Am Ende: {fmtChf(endBetrag(wunsch, darstellungVon(h)))}</p>
              </div>
            </div>
          ) : null}
          {abschnitte.length > 0 ? (
            <p className="krisen-legende">
              <span className="krisen-legende__farbe" aria-hidden="true" /> Krisen in Ihrer Rechnung:{' '}
              {krisenText(abschnitte)}. Im Vermögensverlauf farbig hinterlegt.
            </p>
          ) : aktiv ? (
            <p className="warnung">Die Krisenjahre liegen ausserhalb des Planungszeitraums.</p>
          ) : null}
        </>
      ) : null}
      <details className="aufklapp-innen">
        <summary>Wie wird gerechnet?</summary>
        <ul className="klein">
          <li>
            Wertschriften: Aktienanteil × Aktienrendite + Rest × Obligationenrendite des Krisenjahres (Gesamtrendite mit
            Dividenden/Zinsen, in Landeswährung, ohne Währungseffekt). Bargeld: Geldmarktzins. Wohneigentum: Veränderung
            der Hauspreise (falls vorhanden, sonst Ihre Annahme).
          </li>
          <li>
            Die Krisenrenditen ersetzen in den Krisenjahren Ihre Annahme. «Automatisch»: Die normalen Jahre werden so
            erhöht, dass der reale Durchschnitt von heute bis zum Planungsalter Ihrer Annahme entspricht (Wertschriften
            und Hauspreise je separat) – Krisen werden also nicht doppelt gezählt, wenn Ihre Annahme ein langfristiger
            Durchschnitt ist. «Individuell» ist ein Stresstest: Die übrigen Jahre bleiben unverändert.
          </li>
          <li>
            Teuerung des Krisenjahres: Ausgaben steigen mit, PK-Renten nicht (sie verlieren real an Wert). AHV-Renten
            werden vereinfacht voll an die Teuerung angepasst.
          </li>
          <li>Anlagekosten werden wie sonst abgezogen. Überschneiden sich zwei Krisen, gilt die später beginnende.</li>
          <li>
            Jahresdaten: Einbrüche innerhalb eines Jahres (z.B. März 2020) sind nicht sichtbar. Quelle:
            Jordà-Schularick-Taylor Macrohistory Database R6 (CC BY-NC-SA 4.0), Schweiz 2021–2024 SNB-Datenportal und
            BFS. Stand {fmtStand(KRISEN_DATEN_STAND)}.
          </li>
        </ul>
      </details>
      <HaeufigkeitTabelle />
    </Karte>
  );
}

export function AktienanteilFeld({ h, setH }: { h: Haushalt; setH: Setzer }) {
  return (
    <ZahlFeld
      label="Aktienanteil Ihrer Wertschriften"
      hinweis="Ihre Annahme; der Rest gilt als Obligationen. Nur für Krisen und Monte Carlo."
      value={h.annahmen.aktienanteil}
      prozent
      nachkomma={0}
      min={0}
      max={1}
      onChange={(v) => setH((x) => ({ ...x, annahmen: { ...x.annahmen, aktienanteil: v } }))}
    />
  );
}

/** Historische Krisenhäufigkeit pro Dekade (JST R6, eigene Auszählung). */
export function HaeufigkeitTabelle() {
  const ganz = '1871-2020';
  const neu = '1950-2020';
  const land = (iso: string, p: string) => HAEUFIGKEIT.laender[iso]?.[p];
  const welt = (p: string) => HAEUFIGKEIT.welt[p]?.mittelLaender;
  const zeilen: { label: string; werte: (p: string) => [number, number, number] | null }[] = [
    {
      label: 'Schweiz',
      werte: (p) => {
        const x = land('CHE', p);
        return x ? [x.real20.proDekade, x.real30.proDekade, x.banken.proDekade] : null;
      },
    },
    {
      label: 'USA',
      werte: (p) => {
        const x = land('USA', p);
        return x ? [x.real20.proDekade, x.real30.proDekade, x.banken.proDekade] : null;
      },
    },
    {
      label: 'Ø 18 Länder',
      werte: (p) => {
        const x = welt(p);
        return x ? [x.real20, x.real30, x.banken] : null;
      },
    },
  ];
  return (
    <details className="aufklapp-innen">
      <summary>Wie oft gab es Krisen? (pro 10 Jahre)</summary>
      {[ganz, neu].map((p) => (
        <ScrollTabelle
          key={p}
          label={
            p === ganz
              ? 'Krisenhäufigkeit, ganze Periode (Tabelle, scrollbar)'
              : 'Krisenhäufigkeit seit 1950 (Tabelle, scrollbar)'
          }
        >
          <table>
            <caption>{p === ganz ? 'Ganze Periode (Aktien Schweiz ab 1900, USA ab 1872)' : 'Seit 1950'}</caption>
            <thead>
              <tr>
                <th scope="col">Pro Dekade</th>
                <th scope="col">Aktien real −20 %</th>
                <th scope="col">Aktien real −30 %</th>
                <th scope="col">Bankenkrisen</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => {
                const w = z.werte(p);
                return (
                  <tr key={z.label}>
                    <th scope="row">{z.label}</th>
                    <td>{w ? fmtDek(w[0]) : '–'}</td>
                    <td>{w ? fmtDek(w[1]) : '–'}</td>
                    <td>{w ? fmtDek(w[2]) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollTabelle>
      ))}
      <p className="klein">
        Gezählt: Der reale Aktien-Gesamtertragsindex (mit Dividenden, nach Teuerung, Jahresendwerte) fällt um mindestens
        20 % bzw. 30 % unter den letzten Höchststand; eine Krise endet mit einem neuen Höchststand. Bankenkrisen: Beginn
        einer systemischen Bankenkrise nach Jordà-Schularick-Taylor (Variable crisisJST). Ø 18 Länder: Durchschnitt der
        Länder der JST-Datenbank. Jahresdaten zeigen kurze Einbrüche nicht, die Zahlen sind eher Untergrenzen. Quelle:
        JST Macrohistory Database R6, eigene Auszählung, Stand {fmtStand(HAEUFIGKEIT.stand)}.
      </p>
      <p className="klein">
        Faustregel: In der Schweiz fielen Aktien real etwa alle 12 bis 14 Jahre um 20 % oder mehr (0.74 bzw. 0.85 pro
        Dekade), im Durchschnitt der 18 Länder etwa alle 16 bis 20 Jahre. Einbrüche von 30 % oder mehr: Schweiz etwa
        alle 20 Jahre, 18 Länder etwa alle 22 bis 28 Jahre.
      </p>
    </details>
  );
}

interface McProps {
  h: Haushalt;
  setH: Setzer;
  effH: Haushalt;
  regeln: Regeln;
  heute: Monat;
  refIdx: number;
  namen: string[];
}

export function MonteCarloKarte({ h, setH, effH, regeln, heute, refIdx, namen }: McProps) {
  const k = h.krisen;
  const pool = useMemo(() => mcKrisenPool(), []);
  const rate = k.mcKrisenProDekade ?? STANDARD_KRISEN_PRO_DEKADE;
  const eingabe = useDeferredValue({ effH, k, rate });
  const erg = useMemo(() => {
    if (!eingabe.k.mcAktiv) return null;
    return monteCarlo(
      eingabe.effH,
      regeln,
      heute,
      {
        art: eingabe.k.mcArt,
        laeufe: eingabe.k.mcLaeufe,
        seed: 20260927,
        krisenProDekade: eingabe.rate,
        blockLaenge: eingabe.k.mcBlockLaenge,
        bootstrapLand: 'CHE',
      },
      KRISEN_DATEN,
      pool,
    );
  }, [eingabe, regeln, heute, pool]);

  const x = useMemo(() => {
    if (!erg) return null;
    const geb = effH.personen[refIdx]?.geburtsjahr ?? 0;
    return erg.jahre.map((j) => j - geb);
  }, [erg, effH, refIdx]);
  const dar = darstellungVon(h);

  return (
    <Karte
      titel="Wiederkehrende Krisen (Monte Carlo)"
      untertitel="Realistischer: Krisen kommen immer wieder, niemand weiss wann. Die App rechnet Ihren Wunsch-Rücktritt viele Male mit zufällig verteilten Krisen durch."
    >
      <Schalter
        label="Monte-Carlo-Rechnung anzeigen"
        checked={k.mcAktiv}
        onChange={(v) => setzeKrisen(setH, (kr) => ({ ...kr, mcAktiv: v }))}
      />
      {k.mcAktiv ? (
        <>
          <Segmente<'wiederkehrend' | 'bootstrap'>
            label="Methode"
            value={k.mcArt}
            optionen={[
              { value: 'wiederkehrend', label: 'Ihre Annahmen + Krisen' },
              { value: 'bootstrap', label: 'Nur Geschichte Schweiz' },
            ]}
            onChange={(mcArt) => setzeKrisen(setH, (kr) => ({ ...kr, mcArt }))}
          />
          {k.mcArt === 'wiederkehrend' ? (
            <ZahlFeld
              label="Krisen pro 10 Jahre"
              hinweis={`Standard ${fmtDek(STANDARD_KRISEN_PRO_DEKADE)}: so oft fielen Schweizer Aktien real um 20 % oder mehr (1900–2020, JST). Gezogen wird zufällig eine der «normalen» Krisen (wie bei «Automatisch»).`}
              value={rate}
              min={0}
              max={10}
              nachkomma={2}
              onChange={(v) => setzeKrisen(setH, (kr) => ({ ...kr, mcKrisenProDekade: v }))}
            />
          ) : (
            <ZahlFeld
              label="Blocklänge"
              hinweis="Es werden zusammenhängende Jahresblöcke aus der Schweizer Geschichte 1900–2024 gezogen (Aktien, Obligationen, Geldmarkt, Teuerung). Ihre Renditeannahme gilt hier nicht."
              value={k.mcBlockLaenge}
              min={1}
              max={20}
              nachkomma={0}
              einheit="Jahre"
              onChange={(v) => setzeKrisen(setH, (kr) => ({ ...kr, mcBlockLaenge: Math.round(v) }))}
            />
          )}
          <AktienanteilFeld h={h} setH={setH} />
          {erg ? (
            <>
              <div className="kennzahlen" role="status">
                <div>
                  <span className="kennzahl__wert">{fmtProzent(erg.erfolgsquote, 0)}</span>
                  <span className="kennzahl__text">
                    Erfolgs­wahrscheinlichkeit: Das Geld reicht bis zum Planungsalter
                  </span>
                </div>
                <div>
                  <span className="kennzahl__wert">
                    {erg.reichtBisAlterP10 === null ? `${h.planungsalter}+` : erg.reichtBisAlterP10}
                  </span>
                  <span className="kennzahl__text">Bis zu diesem Alter reicht das Geld in 9 von 10 Fällen</span>
                </div>
              </div>
              {x ? (
                <Faecher
                  m={erg}
                  x={x}
                  xLabel={h.personen.length > 1 ? `Alter ${namen[refIdx]}` : 'Alter'}
                  darstellung={dar}
                  planungsalter={effH.planungsalter}
                />
              ) : null}
              <p className="klein">
                {erg.laeufe} Läufe
                {k.mcArt === 'wiederkehrend' ? `, im Schnitt ${fmtDek(erg.krisenMittel)} Krisen pro Lauf` : ''}. Werte{' '}
                {inFranken(dar)}
                {dar === 'nominal' ? ' (jeder Lauf mit seiner eigenen Teuerung umgerechnet)' : ''}. Bei «Ihre Annahmen +
                Krisen» ersetzen die Krisenjahre Ihre Annahme; die normalen Jahre sind so erhöht, dass im Erwartungswert
                über Ihren Planungszeitraum (Krisen am Ende abgeschnitten) Ihre Annahme herauskommt (keine
                Doppelzählung).
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </Karte>
  );
}
