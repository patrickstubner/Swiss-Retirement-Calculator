import { useMemo, useState } from 'react';
import { referenzPerson, startvermoegen } from '../../core/simulation';
import type { Haushalt, SimulationsErgebnis, Toepfe } from '../../core/typen';
import { stoppAlterMonate } from '../../core/zeitpunkt';
import { wegzugsLand } from '../../data/laender';
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
    const t = (k: keyof Toepfe) => anzeige.zeilen.map((z) => z.toepfe[k]);
    const serien: Serie[] = [
      { label: 'Bargeld', werte: t('bargeld'), farbe: '#2a9d8f', fuellung: 'rgba(42,157,143,0.55)', stapel: true },
      {
        label: 'Wertschriften',
        werte: t('wertschriften'),
        farbe: '#0f4c5c',
        fuellung: 'rgba(15,76,92,0.55)',
        stapel: true,
      },
      { label: 'Sonstiges', werte: t('sonstiges'), farbe: '#8a5a44', fuellung: 'rgba(138,90,68,0.5)', stapel: true },
      {
        label: 'Wohneigentum',
        werte: t('wohneigentum'),
        farbe: '#6d597a',
        fuellung: 'rgba(109,89,122,0.45)',
        stapel: true,
      },
      {
        label: 'Freizügigkeit (gesperrt)',
        werte: t('freizuegigkeit'),
        farbe: '#f4a261',
        fuellung: 'rgba(244,162,97,0.35)',
        stapel: true,
      },
      {
        label: '3a (gesperrt)',
        werte: t('saeule3a'),
        farbe: '#e9c46a',
        fuellung: 'rgba(233,196,106,0.4)',
        stapel: true,
      },
      {
        label: 'Pensionskasse (gesperrt)',
        werte: t('pk'),
        farbe: '#e36414',
        fuellung: 'rgba(227,100,20,0.3)',
        stapel: true,
      },
    ].filter((s) => s.werte.some((v) => v > 0.5));
    if (anzeige.zeilen.some((z) => z.fehlbetrag > 0.5)) {
      serien.push({
        label: 'Fehlbetrag',
        werte: anzeige.zeilen.map((z) => -z.fehlbetrag),
        farbe: '#b3261e',
        gestrichelt: true,
      });
    }
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
              Das Vermögen reicht dann bis zum Planungsalter {h.planungsalter}
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

      {keineEingaben(h) ? (
        <p className="warnung" role="status">
          Noch keine Beträge erfasst. Alle Felder sind bewusst leer (0) – bitte Lohn, AHV-Rente, Vorsorge, Vermögen und
          Ausgaben eintragen, damit das Ergebnis aussagekräftig ist.
        </p>
      ) : null}

      {wunsch ? (
        <Karte titel="Mit Ihrem Wunsch-Rücktrittsalter">
          <p>{h.personen.map((p, i) => `${namen[i]}: ${fmtAlter(stoppAlterMonate(p))}`).join(' · ')}</p>
          {wunsch.erfolg ? (
            <p className="ok">
              ✓ Das Geld reicht jederzeit bis zum Planungsalter. Am Ende (real):{' '}
              <strong>{fmtChf(wunsch.endVermoegen)}</strong>
            </p>
          ) : (
            <p className="warnung">
              ✗ Ab {wunsch.ruinJahr} (Alter {wunsch.ruinAlter}
              {h.personen.length > 1 ? ' der jüngeren Person' : ''}) reichen die verfügbaren Mittel nicht.
            </p>
          )}
          <LiquiditaetsHinweise e={wunsch} />
        </Karte>
      ) : null}

      {chart && anzeige ? (
        <Karte titel="Vermögensverlauf" untertitel="In heutigen Franken (real), nach Vermögenstopf">
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
            beschreibung="Gestapeltes Diagramm des Vermögens pro Jahr nach Topf: Bargeld, Wertschriften, Sonstiges, Wohneigentum sowie gesperrte Freizügigkeit, Säule 3a und Pensionskasse. Die Tabelle unten enthält die Summen."
          />
          <p className="klein">
            Gestapelt: verfügbare Töpfe (unten) und gesperrte Vorsorgegelder (oben, bis zum Bezug). Die Legende zeigt
            die Einzelwerte. Wohneigentum wird erst zuletzt angetastet. Wird das PK-Guthaben als Rente bezogen,
            verschwindet es aus der Grafik und erscheint als Einkommen.
          </p>
          {szenario === 'frueh' ? <LiquiditaetsHinweise e={anzeige} /> : null}
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
                <dt>Freizügigkeit</dt>
                <dd>
                  {fmtMonat(info.freizuegigkeitStart)}: {fmtChf(info.freizuegigkeitKapital)}
                </dd>
                {summe(info.neBeitraegeJahre) > 0 ? (
                  <>
                    <dt>AHV-Beiträge als Nichterwerbstätige(r)</dt>
                    <dd>{fmtChf(summe(info.neBeitraegeJahre))} total</dd>
                  </>
                ) : null}
                {info.wegzug ? (
                  <>
                    <dt>Wohnsitz im Ausland</dt>
                    <dd>
                      ab {fmtMonat(info.wegzug)}
                      {wegzugsLand(h.personen[i]?.wohnsitzAusland.land ?? '')
                        ? ` (${wegzugsLand(h.personen[i]?.wohnsitzAusland.land ?? '')?.name})`
                        : ''}
                    </dd>
                    <dt>Freiwillige AHV</dt>
                    <dd>
                      {info.freiwilligeAhvAktiv
                        ? `${fmtChf(summe(info.freiwilligeAhvJahre))} total bis zum Referenzalter`
                        : 'nein'}
                    </dd>
                    {info.ahvLueckenAusland > 0 ? (
                      <>
                        <dt>AHV-Beitragslücken</dt>
                        <dd>
                          {info.ahvLueckenAusland} Jahre (Rente × {info.ahvLueckenFaktor.toFixed(3)})
                        </dd>
                      </>
                    ) : null}
                  </>
                ) : null}
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

const summe = (j: { betrag: number }[]): number => j.reduce((a, x) => a + x.betrag, 0);

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
                <th>davon AHV-Beiträge</th>
                <th>Verfügbar</th>
                <th>Gesperrt</th>
                <th>Total</th>
                <th>Lücke</th>
              </tr>
            </thead>
            <tbody>
              {e.zeilen.map((z) => (
                <tr key={z.jahr} className={z.fehlbetrag > 0 ? 'negativ' : undefined}>
                  <td>{z.jahr}</td>
                  <td>{z.alter[refIdx]}</td>
                  <td>
                    {fmtChf(
                      z.lohn +
                        z.ahv +
                        z.pkRente +
                        z.auslandRenten +
                        z.weitereEinnahmen +
                        z.kapitalBezuege +
                        Math.max(0, z.einmalig),
                    )}
                  </td>
                  <td>{fmtChf(z.steuernEinkommen + z.steuernKapital + z.steuernVermoegen)}</td>
                  <td>
                    {fmtChf(z.ausgaben + z.neBeitraege + z.freiwilligeAhv + z.sozialabgaben - Math.min(0, z.einmalig))}
                  </td>
                  <td>{z.neBeitraege + z.freiwilligeAhv > 0 ? fmtChf(z.neBeitraege + z.freiwilligeAhv) : '–'}</td>
                  <td>{fmtChf(z.verfuegbar - z.fehlbetrag)}</td>
                  <td>{fmtChf(z.gebunden)}</td>
                  <td>{fmtChf(z.total)}</td>
                  <td>{z.fehlbetrag > 0 ? fmtChf(z.fehlbetrag) : '–'}</td>
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

function keineEingaben(h: Haushalt): boolean {
  return (
    startvermoegen(h) === 0 &&
    h.ausgaben.lebenshaltung === 0 &&
    h.posten.length === 0 &&
    h.ereignisse.length === 0 &&
    h.personen.every(
      (p) =>
        p.lohn === 0 &&
        p.ahv.renteMonat === 0 &&
        p.pk.guthaben === 0 &&
        p.pk.sparbeitragJahr === 0 &&
        p.saeule3a.guthaben === 0 &&
        p.freizuegigkeit.guthaben === 0 &&
        p.auslandRenten.length === 0,
    )
  );
}

/** Fasst Jahre zu Bereichen zusammen: [2026, 2027, 2028, 2031] → «2026–2028, 2031». */
export function jahresBereiche(jahre: number[]): string {
  const teile: string[] = [];
  let start: number | null = null;
  let vorher: number | null = null;
  for (const j of [...jahre].sort((a, b) => a - b)) {
    if (start === null) start = j;
    else if (vorher !== null && j !== vorher + 1) {
      teile.push(start === vorher ? String(start) : `${start}–${vorher}`);
      start = j;
    }
    vorher = j;
  }
  if (start !== null && vorher !== null) teile.push(start === vorher ? String(start) : `${start}–${vorher}`);
  return teile.join(', ');
}

function LiquiditaetsHinweise({ e }: { e: SimulationsErgebnis }) {
  return (
    <>
      {e.liquiditaetsluecken.length > 0 ? (
        <p className="warnung" role="alert">
          ⚠ Liquiditätslücke {jahresBereiche(e.liquiditaetsluecken)}: Die verfügbaren Mittel reichen nicht, obwohl noch
          gesperrte Vorsorgegelder (PK, Freizügigkeit, 3a) vorhanden sind. Diese sind erst ab dem Bezugsalter
          zugänglich.
        </p>
      ) : null}
      {e.wohneigentumAngetastetJahr !== null ? (
        <p className="warnung">
          ⚠ Ab {e.wohneigentumAngetastetJahr} muss auf das Wohneigentum zurückgegriffen werden (Verkauf, Belehnung oder
          Hypothekenerhöhung nötig).
        </p>
      ) : null}
    </>
  );
}
