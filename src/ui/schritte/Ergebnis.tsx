import { useMemo, useState } from 'react';
import { referenzPerson } from '../../core/simulation';
import type { SimulationsErgebnis } from '../../core/typen';
import { regelEintraege } from '../../rules';
import { LinienChart, type Serie } from '../components/Chart';
import { DisclaimerVoll } from '../components/Disclaimer';
import { Segmente } from '../components/Felder';
import { Karte } from '../components/Karte';
import { fmtAlter, fmtChf, fmtMonat, fmtProzent } from '../format';
import type { SchrittProps } from '../kontext';
import { VEREINFACHUNGEN } from '../texte';

export type SuchModus = 'gemeinsam' | 'p0' | 'p1';

interface Props extends SchrittProps {
  suchModus: SuchModus;
  setSuchModus: (m: SuchModus) => void;
}

export function Ergebnis({ h, berechnung, heute, suchModus, setSuchModus }: Props) {
  const [szenario, setSzenario] = useState<'wunsch' | 'frueh'>('wunsch');
  const { wunsch, solver, fehler } = berechnung;
  const ref = referenzPerson(h.personen);
  const namen = h.personen.map((p, i) => p.name || `Person ${i + 1}`);
  const suchPerson = suchModus === 'p1' ? 1 : 0;

  const anzeige: SimulationsErgebnis | null = szenario === 'frueh' && solver?.ergebnis ? solver.ergebnis : wunsch;

  const chart = useMemo(() => {
    if (!anzeige) return null;
    const x = anzeige.zeilen.map((z) => z.alter[ref] ?? 0);
    const serien: Serie[] = [
      {
        label: 'Freies Vermögen',
        werte: anzeige.zeilen.map((z) => z.vermoegen),
        farbe: '#0f4c5c',
        fuellung: 'rgba(15,76,92,0.12)',
      },
      {
        label: 'inkl. PK und 3a',
        werte: anzeige.zeilen.map((z) => z.vermoegen + z.pkGuthaben + z.saeule3aGuthaben),
        farbe: '#e36414',
      },
    ];
    return { x, serien };
  }, [anzeige, ref]);

  if (fehler) {
    return (
      <Karte titel="Ergebnis">
        <p className="warnung">Berechnung nicht möglich: {fehler}</p>
      </Karte>
    );
  }

  return (
    <>
      <section className="karte karte--ergebnis" aria-live="polite">
        <h2>Frühestes Rücktrittsalter</h2>
        {h.personen.length > 1 ? (
          <Segmente
            label="Gesucht für"
            value={suchModus}
            optionen={[
              { value: 'gemeinsam', label: 'Gemeinsam' },
              { value: 'p0', label: `Nur ${namen[0]}` },
              { value: 'p1', label: `Nur ${namen[1]}` },
            ]}
            onChange={setSuchModus}
          />
        ) : null}
        {solver?.gefunden && solver.alterMonate !== null ? (
          <>
            <p className="gross">{solver.sofort ? 'Sofort möglich' : fmtAlter(solver.alterMonate)}</p>
            <p>
              {h.personen.length > 1
                ? suchModus === 'gemeinsam'
                  ? `Alter von ${namen[0]}; beide hören am selben Datum auf (${namen[1]}: ${fmtAlter(solver.stoppAlterMonate?.[1] ?? 0)}).`
                  : `Alter von ${namen[suchPerson]}; die andere Person hört wie eingegeben auf.`
                : null}{' '}
              Das freie Vermögen reicht dann bis zum Planungsalter {h.planungsalter}
              {h.personen.length > 1 ? ' (der jüngeren Person)' : ''}.
            </p>
          </>
        ) : (
          <p className="gross gross--negativ">Nicht bis 70</p>
        )}
        {!solver?.gefunden ? (
          <p>
            Selbst mit Erwerbsaufgabe mit 70 reicht das Vermögen mit diesen Annahmen nicht bis zum Planungsalter{' '}
            {h.planungsalter}. Prüfen Sie Ausgaben, Planungshorizont oder Annahmen.
          </p>
        ) : null}
      </section>

      {wunsch ? (
        <Karte titel="Mit Ihrem Wunsch-Rücktrittsalter">
          <p>{h.personen.map((p, i) => `${namen[i]}: ${fmtAlter(Math.round(p.stoppAlter * 12))}`).join(' · ')}</p>
          {wunsch.erfolg ? (
            <p className="ok">
              ✓ Das freie Vermögen reicht bis zum Planungsalter. Am Ende (real):{' '}
              <strong>{fmtChf(wunsch.endVermoegen)}</strong>
            </p>
          ) : (
            <p className="warnung">
              ✗ Das freie Vermögen ist im Jahr {wunsch.ruinJahr} aufgebraucht (Alter {wunsch.ruinAlter}
              {h.personen.length > 1 ? ' der jüngeren Person' : ''}).
            </p>
          )}
        </Karte>
      ) : null}

      {chart && anzeige ? (
        <Karte titel="Vermögensverlauf" untertitel="In heutigen Franken (real)">
          {solver?.ergebnis ? (
            <Segmente
              label="Szenario"
              value={szenario}
              optionen={[
                { value: 'wunsch', label: 'Wunschalter' },
                { value: 'frueh', label: 'Frühestes Alter' },
              ]}
              onChange={setSzenario}
            />
          ) : null}
          <LinienChart
            x={chart.x}
            xLabel={h.personen.length > 1 ? `Alter ${namen[ref]}` : 'Alter'}
            serien={chart.serien}
            beschreibung="Diagramm: freies Vermögen und Vermögen inklusive Pensionskasse und Säule 3a pro Jahr. Die Tabelle unten enthält dieselben Werte."
          />
          <JahresTabelle e={anzeige} refIdx={ref} />
        </Karte>
      ) : null}

      {anzeige ? (
        <Karte
          titel="Renten und Kapital"
          untertitel={szenario === 'frueh' ? 'Szenario frühestes Alter' : 'Szenario Wunschalter'}
        >
          {anzeige.personen.map((info, i) => (
            <div key={namen[i]} className="unterkarte">
              <h3>{namen[i]}</h3>
              <dl className="fakten">
                <dt>Referenzalter</dt>
                <dd>{fmtAlter(info.referenzalterMonate)}</dd>
                <dt>AHV ab</dt>
                <dd>
                  {fmtMonat(info.ahvStart)}
                  {info.ahvFaktor !== 1
                    ? ` (${info.ahvFaktor < 1 ? 'Kürzung' : 'Zuschlag'} ${fmtProzent(Math.abs(1 - info.ahvFaktor))})`
                    : ''}
                </dd>
                <dt>AHV-Rente</dt>
                <dd>{fmtChf(info.ahvRenteMonatStart)} / Mt. + 13. Rente</dd>
                <dt>PK-Bezug</dt>
                <dd>{fmtMonat(info.pkStart)}</dd>
                <dt>PK-Rente</dt>
                <dd>{fmtChf(info.pkRenteJahr)} / Jahr</dd>
                <dt>PK-Kapital</dt>
                <dd>{fmtChf(info.pkKapital)}</dd>
                <dt>3a-Bezug</dt>
                <dd>
                  {fmtMonat(info.saeule3aStart)}: {fmtChf(info.saeule3aKapital)}
                </dd>
              </dl>
              {h.zivilstand === 'verheiratet' ? (
                <p className="klein">
                  AHV-Renten beider Ehegatten zusammen höchstens 150% der Maximalrente (Plafonierung).
                </p>
              ) : null}
              {info.hinweise.map((t) => (
                <p key={t} className="warnung">
                  {t}
                </p>
              ))}
            </div>
          ))}
          <p className="klein">
            Werte in heutigen Franken im Zeitpunkt des Bezugs. Stand der Berechnung: {fmtMonat(heute)}.
          </p>
        </Karte>
      ) : null}

      <details className="karte aufklapp">
        <summary>Wie gerechnet? Vereinfachungen</summary>
        <ul>
          {VEREINFACHUNGEN.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="klein">
          {berechnung.solver?.simulationen ?? 0} Simulationen in {Math.round(berechnung.dauerMs)} ms.
        </p>
      </details>

      <QuellenListe jahr={heute.jahr} />
      <DisclaimerVoll />
    </>
  );
}

function JahresTabelle({ e, refIdx }: { e: SimulationsErgebnis; refIdx: number }) {
  const [offen, setOffen] = useState(false);
  return (
    <details className="aufklapp" onToggle={(ev) => setOffen((ev.target as HTMLDetailsElement).open)}>
      <summary>Tabelle pro Jahr</summary>
      {offen ? (
        <div className="tabelle-scroll">
          <table>
            <thead>
              <tr>
                <th>Jahr</th>
                <th>Alter</th>
                <th>Einnahmen</th>
                <th>Steuern</th>
                <th>Ausgaben</th>
                <th>Vermögen</th>
              </tr>
            </thead>
            <tbody>
              {e.zeilen.map((z) => (
                <tr key={z.jahr} className={z.vermoegen < 0 ? 'negativ' : undefined}>
                  <td>{z.jahr}</td>
                  <td>{z.alter[refIdx]}</td>
                  <td>{fmtChf(z.lohn + z.ahv + z.pkRente + z.auslandRenten + z.kapitalBezuege)}</td>
                  <td>{fmtChf(z.steuernEinkommen + z.steuernKapital + z.steuernVermoegen)}</td>
                  <td>{fmtChf(z.ausgaben + z.neBeitraege + z.sozialabgaben)}</td>
                  <td>{fmtChf(z.vermoegen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </details>
  );
}

function QuellenListe({ jahr }: { jahr: number }) {
  const eintraege = useMemo(() => regelEintraege(jahr), [jahr]);
  const offen = eintraege.filter((e) => e.status === 'offen').length;
  return (
    <details className="karte aufklapp">
      <summary>
        Quellen und Regelwerte {jahr} ({eintraege.length} Werte, davon {offen} offen)
      </summary>
      <ul className="quellen">
        {eintraege.map((e) => (
          <li key={e.pfad}>
            <span className={`status status--${e.status}`}>{e.status}</span> <code>{e.pfad}</code>
            <br />
            <small>
              {e.stand} –{' '}
              {e.source.split(' ; ').map((s) => (
                <QuelleLink key={s} text={s} />
              ))}
              {e.hinweis ? ` – ${e.hinweis}` : ''}
            </small>
          </li>
        ))}
      </ul>
    </details>
  );
}

function QuelleLink({ text }: { text: string }) {
  const url = text.match(/https?:\/\/\S+/)?.[0];
  if (!url) return <span>{text} </span>;
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    /* URL unverändert anzeigen */
  }
  const rest = text.replace(url, '').trim();
  return (
    <span>
      {rest ? `${rest} ` : ''}
      <a href={url} target="_blank" rel="noreferrer noopener">
        {host}
      </a>{' '}
    </span>
  );
}
