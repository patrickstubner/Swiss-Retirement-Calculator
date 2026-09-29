import { useDeferredValue, useMemo, useState } from 'react';
import { type Darstellung, inDarstellung } from '../../core/nominal';
import { ahvLueckenZuzug, umwandlungssatzGeschaetztMitGuthaben } from '../../core/schaetzwerte';
import { sensitivitaet } from '../../core/sensitivitaet';
import { referenzPerson, startvermoegen } from '../../core/simulation';
import type { Haushalt, PersonInfo, SimulationsErgebnis, Toepfe } from '../../core/typen';
import { stoppAlterMonate } from '../../core/zeitpunkt';
import { kriseNach } from '../../data/krisen';
import { wegzugsLand } from '../../data/laender';
import { regelEintraege } from '../../rules';
import { Auswertung } from '../components/Auswertung';
import { LinienChart, type Serie } from '../components/Chart';
import { DisclaimerVoll } from '../components/Disclaimer';
import { Segmente } from '../components/Felder';
import { JahresUebersicht } from '../components/JahresUebersicht';
import { KantoneKarte } from '../components/Kantone';
import { Karte } from '../components/Karte';
import { KrisenKarte, MonteCarloKarte } from '../components/Krisen';
import { StaffelungKarte } from '../components/Staffelung';
import { TodesfallKarte } from '../components/Todesfall';
import { UmkehrKarte } from '../components/Umkehr';
import { WegzugVergleichKarte } from '../components/WegzugVergleich';
import { DARSTELLUNG_OPTIONEN, darstellungVon, endBetrag, inFranken } from '../darstellung';
import { chartFarbe, mitAlpha } from '../farben';
import { fmtAlter, fmtChf, fmtMonat, fmtProzent } from '../format';
import type { SchrittProps } from '../kontext';
import { krisenAbschnitte, krisenText } from '../krisenGrafik';
import { UWS_GESCHAETZT, uwsKurz, VEREINFACHUNGEN } from '../texte';

export type SuchModus = 'gemeinsam' | 'p0' | 'p1';

interface Props extends SchrittProps {
  suchModus: SuchModus;
  setSuchModus: (m: SuchModus) => void;
  /** Zum Modus «Detailliert» wechseln (Vorsorge-Schritt) */
  zuDetail: () => void;
}

export function Ergebnis({ h, setH, berechnung, heute, suchModus, setSuchModus, eff, regeln, zuDetail }: Props) {
  const [szenario, setSzenario] = useState<'wunsch' | 'frueh'>('wunsch');
  const { wunsch, solver, fehler } = berechnung;
  const ref = referenzPerson(h.personen);
  const namen = h.personen.map((p, i) => p.name || `Person ${i + 1}`);
  const suchPerson = suchModus === 'p1' ? 1 : 0;
  const neAnzahl = h.personen.filter((p) => p.erwerbsstatus === 'nichtErwerbstaetig').length;

  const dar = darstellungVon(h);
  const anzeigeReal: SimulationsErgebnis | null = szenario === 'frueh' && solver?.ergebnis ? solver.ergebnis : wunsch;
  // Anzeige in der gewählten Darstellung (nominal: mit der Teuerung des gerechneten Pfads)
  const anzeige = useMemo(() => (anzeigeReal ? inDarstellung(anzeigeReal, dar) : null), [anzeigeReal, dar]);

  const abschnitte = useMemo(() => (anzeige ? krisenAbschnitte(anzeige, ref) : []), [anzeige, ref]);
  const chart = useMemo(() => {
    if (!anzeige) return null;
    const x = anzeige.zeilen.map((z) => z.alter[ref] ?? 0);
    const t = (k: keyof Toepfe) => anzeige.zeilen.map((z) => z.toepfe[k]);
    const serien: Serie[] = [
      {
        label: 'Bargeld',
        werte: t('bargeld'),
        farbe: chartFarbe('bargeld'),
        fuellung: mitAlpha(chartFarbe('bargeld'), 0.55),
        stapel: true,
      },
      {
        label: 'Wertschriften',
        werte: t('wertschriften'),
        farbe: chartFarbe('wertschriften'),
        fuellung: mitAlpha(chartFarbe('wertschriften'), 0.55),
        stapel: true,
      },
      {
        label: 'Sonstiges',
        werte: t('sonstiges'),
        farbe: chartFarbe('sonstiges'),
        fuellung: mitAlpha(chartFarbe('sonstiges'), 0.5),
        stapel: true,
      },
      {
        label: 'Wohneigentum',
        werte: t('wohneigentum'),
        farbe: chartFarbe('wohneigentum'),
        fuellung: mitAlpha(chartFarbe('wohneigentum'), 0.45),
        stapel: true,
      },
      {
        label: 'Freizügigkeit (gesperrt)',
        werte: t('freizuegigkeit'),
        farbe: chartFarbe('freizuegigkeit'),
        fuellung: mitAlpha(chartFarbe('freizuegigkeit'), 0.35),
        stapel: true,
      },
      {
        label: '3a (gesperrt)',
        werte: t('saeule3a'),
        farbe: chartFarbe('saeule3a'),
        fuellung: mitAlpha(chartFarbe('saeule3a'), 0.4),
        stapel: true,
      },
      {
        label: 'Pensionskasse (gesperrt)',
        werte: t('pk'),
        farbe: chartFarbe('pk'),
        fuellung: mitAlpha(chartFarbe('pk'), 0.3),
        stapel: true,
      },
    ].filter((s) => s.werte.some((v) => v > 0.5));
    if (anzeige.zeilen.some((z) => z.fehlbetrag > 0.5)) {
      serien.push({
        label: 'Fehlbetrag',
        werte: anzeige.zeilen.map((z) => -z.fehlbetrag),
        farbe: chartFarbe('negativ'),
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
        {h.krisen.modus === 'automatisch' ? (
          <p className="krisen-hinweis">
            Mit Krisen (automatisch): normale historische Krisen im Abstand gemäss Häufigkeit
          </p>
        ) : h.krisen.modus === 'individuell' && h.krisen.auswahl.length > 0 ? (
          <p className="krisen-hinweis">
            Mit Ihren Krisen: {h.krisen.auswahl.map((a) => kriseNach(a.id)?.name ?? a.id).join(', ')}
          </p>
        ) : null}
        {neAnzahl > 0 ? (
          <p className="klein">
            {neAnzahl === h.personen.length
              ? 'Niemand ist erwerbstätig: es gibt kein Rücktrittsalter zu suchen. Massgebend ist, ob das Vermögen reicht.'
              : `${namen[h.personen.findIndex((p) => p.erwerbsstatus === 'nichtErwerbstaetig')]} ist nicht erwerbstätig – gesucht wird das Rücktrittsalter von ${namen[suchPerson]}.`}
          </p>
        ) : null}
        {h.personen.length > 1 && neAnzahl === 0 ? (
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
        <div className="darstellung-umschalter">
          <Segmente<Darstellung>
            label="Beträge anzeigen"
            value={dar}
            optionen={DARSTELLUNG_OPTIONEN}
            onChange={(d) => setH((x) => ({ ...x, darstellung: d }))}
          />
          <p className="klein">
            {dar === 'nominal'
              ? 'Alle Beträge, Grafiken und Tabellen in Franken des jeweiligen Jahres – so, wie sie später auf dem Konto stehen (mit Teuerung, in Krisenjahren der historischen).'
              : 'Alle Beträge, Grafiken und Tabellen in heutigen Franken: was man sich heute dafür kaufen kann.'}
          </p>
        </div>
      </section>

      {keineEingaben(h) ? (
        <p className="warnung" role="status">
          Noch keine Beträge erfasst. Alle Felder sind bewusst leer (0) – bitte Lohn, AHV-Rente, Vorsorge, Vermögen und
          Ausgaben eintragen, damit das Ergebnis aussagekräftig ist.
        </p>
      ) : null}

      {wunsch ? (
        <Auswertung
          h={h}
          setH={setH}
          effH={eff.haushalt}
          regeln={regeln}
          heute={heute}
          suchModus={suchModus}
          namen={namen}
          refIdx={ref}
        />
      ) : null}

      {wunsch ? (
        <UmkehrKarte h={h} setH={setH} effH={eff.haushalt} regeln={regeln} heute={heute} namen={namen} />
      ) : null}

      {wunsch ? (
        <TodesfallKarte
          h={h}
          setH={setH}
          effH={eff.haushalt}
          regeln={regeln}
          heute={heute}
          namen={namen}
          refIdx={ref}
        />
      ) : null}

      <KantoneKarte h={h} regeln={regeln} />

      {wunsch ? <WegzugVergleichKarte h={h} effH={eff.haushalt} regeln={regeln} heute={heute} namen={namen} /> : null}

      {wunsch ? (
        <StaffelungKarte h={h} setH={setH} effH={eff.haushalt} regeln={regeln} heute={heute} namen={namen} />
      ) : null}

      {wunsch ? (
        <Karte titel="Mit Ihrem Wunsch-Rücktrittsalter">
          <p>{h.personen.map((p, i) => `${namen[i]}: ${fmtAlter(stoppAlterMonate(p))}`).join(' · ')}</p>
          {wunsch.erfolg ? (
            <p className="ok">
              ✓ Das Geld reicht jederzeit bis zum Planungsalter. Am Ende ({inFranken(dar)}):{' '}
              <strong>{fmtChf(endBetrag(wunsch, dar))}</strong>
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

      {wunsch ? (
        <GenauigkeitKarte
          h={h}
          eff={eff}
          regeln={regeln}
          heute={heute}
          suchModus={suchModus}
          namen={namen}
          zuDetail={zuDetail}
        />
      ) : null}

      {chart && anzeige ? (
        <Karte
          titel="Vermögensverlauf"
          untertitel={`${dar === 'nominal' ? 'In Franken des jeweiligen Jahres (nominal)' : 'In heutigen Franken (real)'}, nach Vermögenstopf`}
        >
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
            markierungen={abschnitte}
            beschreibung={`Gestapeltes Diagramm des Vermögens pro Jahr nach Topf: Bargeld, Wertschriften, Sonstiges, Wohneigentum sowie gesperrte Freizügigkeit, Säule 3a und Pensionskasse. Die Tabelle unten enthält die Summen.${abschnitte.length > 0 ? ` Farbig hinterlegte Krisenjahre: ${krisenText(abschnitte)}.` : ''}`}
          />
          {abschnitte.length > 0 ? (
            <p className="krisen-legende">
              <span className="krisen-legende__farbe" aria-hidden="true" /> Krisenjahre: {krisenText(abschnitte)}. So
              sehen Sie, wie das Vermögen einbricht und sich danach erholt.
            </p>
          ) : null}
          <p className="klein">
            Gestapelt: verfügbare Töpfe (unten) und gesperrte Vorsorgegelder (oben, bis zum Bezug). Die Legende zeigt
            die Einzelwerte. Wohneigentum wird erst zuletzt angetastet. Wird das PK-Guthaben als Rente bezogen,
            verschwindet es aus der Grafik und erscheint als Einkommen.
          </p>
          {szenario === 'frueh' ? <LiquiditaetsHinweise e={anzeige} /> : null}
          <JahresUebersicht
            e={anzeige}
            darstellung={dar}
            namen={namen}
            refIdx={ref}
            markierungen={abschnitte}
            startMonat={heute.monat}
            dateiname={szenario === 'frueh' ? 'ruhestand-fruehestes-alter' : 'ruhestand-wunschalter'}
          />
        </Karte>
      ) : null}

      <KrisenKarte
        h={h}
        setH={setH}
        effH={eff.haushalt}
        regeln={regeln}
        heute={heute}
        wunsch={wunsch}
        refIdx={ref}
        namen={namen}
      />
      <MonteCarloKarte h={h} setH={setH} effH={eff.haushalt} regeln={regeln} heute={heute} refIdx={ref} namen={namen} />

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
                <dd>
                  {fmtMonat(info.pkStart)}
                  {info.barauszahlung && (info.barauszahlung.pk > 0 || info.barauszahlung.pkGesperrt > 0)
                    ? ' (Barauszahlung bei Wegzug)'
                    : ''}
                </dd>
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
                {info.verkauf ? (
                  <>
                    <dt>Verkauf Liegenschaft</dt>
                    <dd>
                      {fmtMonat(info.verkauf.monat)}: Preis {fmtChf(info.verkauf.preis)}, Hypothek{' '}
                      {fmtChf(info.verkauf.hypothek)}, Grundstückgewinnsteuer {fmtChf(info.verkauf.steuer)} (
                      {fmtProzent(info.verkauf.steuerSatz)} des Gewinns, {info.verkauf.besitzjahre} Besitzjahre,{' '}
                      {GGST_ART[info.verkauf.steuerArt]}) – Nettoerlös {fmtChf(info.verkauf.erloes)} in die
                      Wertschriften
                    </dd>
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
                    {info.barauszahlung ? (
                      <>
                        <dt>Barauszahlung bei Wegzug</dt>
                        <dd>
                          {fmtChf(
                            info.barauszahlung.pk + info.barauszahlung.freizuegigkeit + info.barauszahlung.saeule3a,
                          )}{' '}
                          ab {fmtMonat(info.barauszahlung.monat)}
                          {info.barauszahlung.pkGesperrt > 0
                            ? `; ${fmtChf(info.barauszahlung.pkGesperrt)} Obligatorium gesperrt (EU/EFTA)`
                            : ''}
                        </dd>
                      </>
                    ) : null}
                    {info.quellensteuerKapital > 0 ? (
                      <>
                        <dt>Quellensteuer auf Kapital</dt>
                        <dd>{fmtChf(info.quellensteuerKapital)} total (Näherung, ohne DBA-Rückforderung)</dd>
                      </>
                    ) : null}
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
            Werte{' '}
            {dar === 'nominal'
              ? 'in Franken des jeweiligen Jahres (mit der Teuerung bis zum Bezug)'
              : 'in heutigen Franken'}{' '}
            im Zeitpunkt des Bezugs. Stand der Berechnung: {fmtMonat(heute)}.
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

const GGST_ART: Record<NonNullable<PersonInfo['verkauf']>['steuerArt'], string> = {
  ZH: 'Tarif ZH',
  AG: 'Tarif AG',
  eigenerSatz: 'eigener Satz',
  naeherungZH: 'Näherung Tarif ZH',
};

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

function GenauigkeitKarte({
  h,
  eff,
  regeln,
  heute,
  suchModus,
  namen,
  zuDetail,
}: Pick<Props, 'h' | 'eff' | 'regeln' | 'heute' | 'suchModus' | 'zuDetail'> & { namen: string[] }) {
  const effD = useDeferredValue(eff);
  const sens = useMemo(() => {
    try {
      return sensitivitaet(effD.haushalt, effD.schaetzungen, regeln, {
        start: heute,
        modus: suchModus === 'gemeinsam' ? 'gemeinsam' : 'person',
        person: suchModus === 'p1' && effD.haushalt.personen.length > 1 ? 1 : 0,
      });
    } catch {
      return null;
    }
  }, [effD, regeln, heute, suchModus]);
  const mehrere = h.personen.length > 1;
  const zuzug = h.personen.map((p) => ahvLueckenZuzug(p, regeln));
  const uwsGeschaetzt = namen.filter((_, i) => {
    const p = h.personen[i];
    return p ? umwandlungssatzGeschaetztMitGuthaben(p, eff.haushalt.personen[i]) : false;
  });
  return (
    <Karte titel="Genauigkeit" untertitel="Welche Werte geschätzt sind und wo sich genauere Angaben lohnen">
      {eff.schaetzungen.length > 0 ? (
        <>
          <p>
            <strong>
              {eff.schaetzungen.length} {eff.schaetzungen.length === 1 ? 'Wert ist' : 'Werte sind'} geschätzt
            </strong>{' '}
            (dazu die Standardannahmen für Rendite und Teuerung):
          </p>
          <ul className="liste">
            {eff.schaetzungen.map((s) => (
              <li key={`${s.person}-${s.feld}`}>
                {s.label}
                {mehrere ? ` (${namen[s.person]})` : ''}:{' '}
                {s.feld === 'pkUmwandlungssatz'
                  ? uwsKurz(s.wert, eff.umwandlungssatz[s.person])
                  : s.feld === 'ahvRente'
                    ? `${fmtChf(s.wert)}/Monat`
                    : s.feld === 'pkSparbeitrag'
                      ? `BVG-Minimum (heute ${fmtChf(s.wert)}/Jahr)`
                      : fmtChf(s.wert)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="ok">Keine geschätzten Werte – nur die Standardannahmen für Rendite und Teuerung.</p>
      )}
      {uwsGeschaetzt.length > 0 ? (
        <p className="info" role="status">
          {UWS_GESCHAETZT} {mehrere ? `Betrifft: ${uwsGeschaetzt.join(', ')}. ` : ''}
          Feld «Umwandlungssatz laut Vorsorgeausweis».
        </p>
      ) : null}
      {h.personen.map((p, i) =>
        (zuzug[i] ?? 0) > 0 ? (
          <p key={`zuzug-${namen[i]}`} className="warnung">
            AHV-Lücken {mehrere ? `${namen[i]}: ` : ''}Zuzug {p.inChSeit} → ca. {zuzug[i]} fehlende Beitragsjahre
            {p.manuell.ahvRente
              ? ' (in der eingegebenen AHV-Rente hoffentlich berücksichtigt)'
              : ' (in der Schätzung berücksichtigt)'}
            . Frühere Auslandsjahre erhöhen die Schweizer Rente nicht – eine ausländische Rente (z.B. Brasilien) separat
            erfassen.
          </p>
        ) : p.inChSeit === 0 && p.auslandRenten.length > 0 && !p.manuell.ahvRente ? (
          <p key={`zuzug-${namen[i]}`} className="warnung">
            {mehrere ? `${namen[i]}: ` : ''}Eine ausländische Rente ist erfasst, aber kein Zuzugsjahr. Falls Sie nach
            dem 20. Altersjahr in die Schweiz gekommen sind, «In der Schweiz seit» angeben – jedes fehlende Jahr kürzt
            die AHV-Rente um rund 1/44.
          </p>
        ) : null,
      )}
      {sens ? (
        <>
          <h3>Wo sich Genauigkeit lohnt</h3>
          <p className="klein">
            Wirkung einer ungünstigen Abweichung auf das früheste Rücktrittsalter und auf das Vermögen mit{' '}
            {sens.vergleichsAlter} ({mehrere ? 'jüngere Person, ' : ''}Wunschalter). Grösste Wirkung zuerst.
          </p>
          <ol className="sens-liste">
            {sens.zeilen.map((z) => (
              <li key={z.id}>
                <strong>{z.label}</strong>{' '}
                <span className="badge-geschaetzt">
                  {z.id === 'rendite'
                    ? 'Annahme'
                    : z.id === 'ausgaben'
                      ? 'Ihre Eingabe'
                      : z.geschaetzt
                        ? 'geschätzt'
                        : 'Ihre Eingabe'}
                </span>
                <span className="sens-wirkung">
                  {z.variante}: frühestes Alter{' '}
                  {z.deltaAlterMonate === null
                    ? 'nicht mehr bis 70'
                    : z.deltaAlterMonate === 0
                      ? 'unverändert'
                      : fmtMonateDelta(z.deltaAlterMonate)}
                  , Vermögen mit {sens.vergleichsAlter}: {z.deltaVermoegen >= 0 ? '+' : '−'}
                  {fmtChf(Math.abs(z.deltaVermoegen))}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {eff.schaetzungen.length > 0 ? (
        <button type="button" className="knopf knopf--sekundaer" onClick={zuDetail}>
          Geschätzte Werte genauer erfassen (Detailliert)
        </button>
      ) : null}
      <p className="klein">
        Genauere Werte: AHV-Rente aus der Rentenvorausberechnung der Ausgleichskasse, PK-Werte aus dem Vorsorgeausweis.
        Alle Annahmen stehen unten unter «Wie gerechnet? Vereinfachungen».
      </p>
    </Karte>
  );
}

/** Differenz in Monaten, z.B. «+1 J. 3 Mt.» oder «−5 Mt.» */
export function fmtMonateDelta(m: number): string {
  const vz = m > 0 ? '+' : '−';
  const a = Math.abs(Math.round(m));
  const j = Math.floor(a / 12);
  const r = a - j * 12;
  return `${vz}${j > 0 ? `${j} J.${r > 0 ? ' ' : ''}` : ''}${r > 0 ? `${r} Mt.` : ''}`;
}
