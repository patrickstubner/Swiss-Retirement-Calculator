/**
 * Szenario-Vergleich A/B: Kennzahlen beider Versionen mit Differenz und «Was ist besser?», gemeinsames Diagramm des
 * verfügbaren Vermögens. Farben: A blau (ausgezogen, Kreis), B orange (gestrichelt, Quadrat) – die Unterscheidung
 * hängt nie allein an der Farbe. Die Monte-Carlo-Kennzahlen kommen aus einem Web-Worker (`mcVergleich.ts`).
 */
import { useMemo } from 'react';
import type { Darstellung } from '../../core/nominal';
import type { Haushalt, Monat, SimulationsErgebnis } from '../../core/typen';
import { DARSTELLUNG_OPTIONEN, inFranken } from '../darstellung';
import { chartFarbe } from '../farben';
import { fmtChf, fmtZahl } from '../format';
import { useVergleichsMc } from '../mcVergleich';
import {
  bereinigeName,
  type Einheit,
  gemeinsamerVerlauf,
  type Kennzahlen,
  kennzahlen,
  STANDARD_NAMEN,
  type Urteil,
  type VergleichsZeile,
  type VersionId,
  type VersionsNamen,
  vergleiche,
  zaehleUrteile,
} from '../szenarien';
import { LinienChart, type Serie } from './Chart';
import { Segmente } from './Felder';
import { Karte } from './Karte';
import { ScrollTabelle } from './ScrollTabelle';

interface Props {
  /** Haushalte mit Schätzwerten (für Monte Carlo), verzögert wie die Berechnung */
  effA: Haushalt;
  effB: Haushalt;
  wunschA: SimulationsErgebnis | null;
  wunschB: SimulationsErgebnis | null;
  namen: VersionsNamen;
  darstellung: Darstellung;
  onDarstellung: (d: Darstellung) => void;
  heute: Monat;
}

/** Kennzeichen der Version: Buchstabe in Kreis (A) bzw. Quadrat (B), in der Farbe der Version. */
export function VersionsMarke({ id }: { id: VersionId }) {
  return (
    <span className={`vmarke vmarke--${id === 'A' ? 'a' : 'b'}`} aria-hidden="true">
      {id}
    </span>
  );
}

export const anzeigeName = (n: string, id: VersionId): string =>
  bereinigeName(n, id === 'A' ? STANDARD_NAMEN.a : STANDARD_NAMEN.b);

/** Zahl mit Vorzeichen (+/−), Rundung je Einheit. */
export function fmtDiff(v: number, e: Einheit): string {
  const vz = v > 0 ? '+' : v < 0 ? '−' : '±';
  const a = Math.abs(v);
  if (e === 'chf') return `${vz}${fmtChf(a)}`;
  if (e === 'prozent') return `${vz}${(a * 100).toLocaleString('de-CH', { maximumFractionDigits: 1 })} Prozentpunkte`;
  return `${vz}${a.toLocaleString('de-CH', { maximumFractionDigits: 1 })} Jahre`;
}

export function fmtWert(v: number | null, e: Einheit): string {
  if (v === null) return '–';
  if (e === 'chf') return fmtChf(v);
  if (e === 'prozent') return `${(v * 100).toLocaleString('de-CH', { maximumFractionDigits: 1 })}%`;
  return `${fmtZahl(Math.round(v * 10) / 10)} J.`;
}

function urteilText(u: Urteil | null, namen: VersionsNamen): string {
  if (u === null) return '–';
  if (u === 'gleich') return 'gleichwertig';
  return `${u === 'A' ? anzeigeName(namen.a, 'A') : anzeigeName(namen.b, 'B')} besser`;
}

function UrteilZelle({ u, namen }: { u: Urteil | null; namen: VersionsNamen }) {
  return (
    <span className="urteil">
      {u === 'A' || u === 'B' ? <VersionsMarke id={u} /> : null}
      {urteilText(u, namen)}
    </span>
  );
}

export function Vergleich({ effA, effB, wunschA, wunschB, namen, darstellung, onDarstellung, heute }: Props) {
  const mc = useVergleichsMc(effA, effB, heute, wunschA !== null && wunschB !== null);
  const zeilen = useMemo<VergleichsZeile[] | null>(() => {
    if (!wunschA || !wunschB) return null;
    const ka: Kennzahlen = kennzahlen(wunschA, effA.planungsalter, darstellung, mc.a);
    const kb: Kennzahlen = kennzahlen(wunschB, effB.planungsalter, darstellung, mc.b);
    return vergleiche(ka, kb);
  }, [wunschA, wunschB, effA.planungsalter, effB.planungsalter, darstellung, mc.a, mc.b]);
  const verlauf = useMemo(
    () => (wunschA && wunschB ? gemeinsamerVerlauf(wunschA, wunschB, darstellung) : null),
    [wunschA, wunschB, darstellung],
  );
  const nameA = anzeigeName(namen.a, 'A');
  const nameB = anzeigeName(namen.b, 'B');
  const serien = useMemo<Serie[]>(() => {
    if (!verlauf) return [];
    return [
      {
        label: `${nameA} (blau, ausgezogen)`,
        werte: verlauf.a,
        farbe: chartFarbe('versionA'),
      },
      {
        label: `${nameB} (orange, gestrichelt)`,
        werte: verlauf.b,
        farbe: chartFarbe('versionB'),
        gestrichelt: true,
      },
    ];
  }, [verlauf, nameA, nameB]);

  const z = zeilen ? zaehleUrteile(zeilen) : null;

  return (
    <Karte
      titel="Vergleich der Versionen"
      untertitel={
        <>
          Beide Versionen rechnen mit derselben Simulation (Wunsch-Rücktritt, gleiche Regeln und Zufallspfade). Beträge{' '}
          {inFranken(darstellung)}.
        </>
      }
    >
      <div id="vergleich">
        <Segmente<Darstellung>
          label="Darstellung der Beträge"
          value={darstellung}
          optionen={DARSTELLUNG_OPTIONEN}
          onChange={onDarstellung}
        />
        {!zeilen || !verlauf ? (
          <p className="warnung" role="alert">
            Für mindestens eine Version lässt sich nicht rechnen. Bitte die Eingaben prüfen.
          </p>
        ) : (
          <>
            <p className="vergleich-fazit" role="status" aria-live="polite">
              {z && z.a + z.b > 0 ? (
                <>
                  {z.a > 0 ? (
                    <span className="urteil">
                      <VersionsMarke id="A" />
                      {nameA}: besser bei {z.a}
                    </span>
                  ) : null}
                  {z.b > 0 ? (
                    <span className="urteil">
                      <VersionsMarke id="B" />
                      {nameB}: besser bei {z.b}
                    </span>
                  ) : null}
                  {z.gleich > 0 ? <span className="urteil">gleichwertig bei {z.gleich}</span> : null}
                  {` (von ${zeilen?.length ?? 0} Kennzahlen).`}
                </>
              ) : (
                'Die Versionen unterscheiden sich in keiner Kennzahl.'
              )}
            </p>
            <ScrollTabelle label="Kennzahlen der Versionen (Tabelle, scrollbar)" className="versionen-tabelle-box">
              <table className="vergleich-tabelle versionen-tabelle">
                <caption>Kennzahlen im Vergleich (Differenz = B minus A)</caption>
                <thead>
                  <tr>
                    <th scope="col">Kennzahl</th>
                    <th scope="col" className="num">
                      <VersionsMarke id="A" /> {nameA}
                    </th>
                    <th scope="col" className="num">
                      <VersionsMarke id="B" /> {nameB}
                    </th>
                    <th scope="col" className="num">
                      Differenz
                    </th>
                    <th scope="col">Besser</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{r.label}</th>
                      <td className="num" data-label={`${nameA} (A)`}>
                        {r.id === 'erfolgsquote' || r.id === 'reichtBisAlterMc'
                          ? mcWert(r, 'a', mc)
                          : fmtWert(r.a, r.einheit)}
                      </td>
                      <td className="num" data-label={`${nameB} (B)`}>
                        {r.id === 'erfolgsquote' || r.id === 'reichtBisAlterMc'
                          ? mcWert(r, 'b', mc)
                          : fmtWert(r.b, r.einheit)}
                      </td>
                      <td className="num" data-label="Differenz (B minus A)">
                        {r.diff === null ? '–' : fmtDiff(r.diff, r.einheit)}
                      </td>
                      <td data-label="Besser">
                        <UrteilZelle u={r.urteil} namen={namen} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTabelle>
            {mc.laeuft ? (
              <p className="klein" role="status">
                Monte Carlo rechnet im Hintergrund …
              </p>
            ) : mc.fehler ? (
              <p className="warnung" role="alert">
                {mc.fehler}
              </p>
            ) : mc.a ? (
              <p className="klein">
                Monte Carlo: je {mc.a.laeufe} Läufe pro Version, gleiche Zufallspfade. «Besser» heisst hier nur: mehr
                Endvermögen, weniger Steuern, mehr Einkommen, höhere Erfolgsquote bzw. Geld reicht länger. Wie Sie diese
                Kennzahlen gewichten, entscheiden Sie.
              </p>
            ) : null}
            <LinienChart
              x={verlauf.jahre}
              xLabel="Jahr"
              xGanzzahl
              serien={serien}
              hoehe={260}
              beschreibung={`Verfügbares Vermögen am Jahresende ${inFranken(darstellung)}: ${nameA} blau ausgezogen, ${nameB} orange gestrichelt.`}
            />
            <p className="klein">
              Diagramm: verfügbares Vermögen am Jahresende. {nameA} blau und ausgezogen, {nameB} orange und gestrichelt.
              Modellrechnung, keine Beratung.
            </p>
          </>
        )}
      </div>
    </Karte>
  );
}

function mcWert(r: VergleichsZeile, v: 'a' | 'b', mc: { laeuft: boolean; fehler: string | null }): string {
  const w = r[v];
  if (w !== null) return fmtWert(w, r.einheit);
  return mc.laeuft ? 'rechnet …' : '–';
}
