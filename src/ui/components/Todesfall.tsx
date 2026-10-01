/**
 * Todesfall-Szenario «Was passiert, wenn eine Person stirbt?»: Wahl der Person und des Zeitpunkts, Vergleich mit
 * dem Plan ohne Todesfall (Vermögensverlauf, Geld reicht bis, Endvermögen, Einkommen vor/nach dem Tod),
 * Jahrestabelle mit Todesjahr-Markierung, Monte Carlo und die Matrix «Wer stirbt zuerst und wann?».
 */
import { useMemo, useState } from 'react';
import type { MonteCarloErgebnis } from '../../core/montecarlo';
import { inDarstellung } from '../../core/nominal';
import { AUSGABEN_FAKTOR_STANDARD } from '../../core/todesfall';
import type { Haushalt, Monat, Todesfall } from '../../core/typen';
import { neuesTodesfall } from '../../data/defaults';
import type { Regeln } from '../../rules';
import { chfKurz, darstellungVon, endBetrag, inFranken, vermoegenReihe } from '../darstellung';
import { chartFarbe, mitAlpha } from '../farben';
import { fmtChf, fmtProzent } from '../format';
import type { Setzer } from '../kontext';
import {
  einkommenVorNach,
  MATRIX_ALTER,
  type MatrixZelle,
  todesAlterRef,
  todesfallMatrix,
  todesfallMoeglich,
  todesfallMonteCarlo,
  todesfallVergleich,
} from '../todesfall';
import { LinienChart, type Serie } from './Chart';
import { Faecher } from './Faecher';
import { AuswahlFeld, Schalter, Segmente, ZahlFeld } from './Felder';
import { JahresUebersicht } from './JahresUebersicht';
import { Karte } from './Karte';
import { ScrollTabelle } from './ScrollTabelle';

interface Props {
  h: Haushalt;
  setH: Setzer;
  /** Haushalt mit Schätzwerten */
  effH: Haushalt;
  regeln: Regeln;
  heute: Monat;
  namen: string[];
  refIdx: number;
}

const bis = (a: number | null, plan: number) => (a === null ? `${plan}+` : String(a));

export function TodesfallKarte({ h, setH, effH, regeln, heute, namen, refIdx }: Props) {
  const tf: Todesfall = h.todesfall ?? neuesTodesfall(heute.jahr + 15);
  const moeglich = todesfallMoeglich(h);
  const dar = darstellungVon(h);
  const setze = (fn: (t: Todesfall) => Todesfall) =>
    setH((x) => ({ ...x, todesfall: fn(x.todesfall ?? neuesTodesfall()) }));
  const [mc, setMc] = useState<{ ohne: MonteCarloErgebnis; mit: MonteCarloErgebnis } | null>(null);
  const [mcLaeuft, setMcLaeuft] = useState(false);
  const [matrix, setMatrix] = useState<MatrixZelle[][] | null>(null);
  const [matrixLaeuft, setMatrixLaeuft] = useState(false);
  const aktiv = moeglich && tf.aktiv;

  const v = useMemo(
    () => (aktiv ? todesfallVergleich(effH, regeln, heute, tf) : null),
    [aktiv, effH, regeln, heute, tf],
  );
  const anzeige = useMemo(
    () => (v ? { ohne: inDarstellung(v.ohne, dar), mit: inDarstellung(v.mit, dar) } : null),
    [v, dar],
  );
  const vn = useMemo(() => (anzeige ? einkommenVorNach(anzeige.mit) : null), [anzeige]);
  const chart = useMemo(() => {
    if (!v) return null;
    const x = v.mit.zeilen.map((z) => z.alter[refIdx] ?? 0);
    const serien: Serie[] = [
      {
        label: 'Ohne Todesfall',
        werte: vermoegenReihe(v.ohne, dar),
        farbe: chartFarbe('band'),
        gestrichelt: true,
      },
      {
        label: 'Mit Todesfall',
        werte: vermoegenReihe(v.mit, dar),
        farbe: chartFarbe('haupt'),
        fuellung: mitAlpha(chartFarbe('haupt'), 0.1),
      },
    ];
    return { x, serien };
  }, [v, dar, refIdx]);
  const todesAlter = v ? todesAlterRef(v.mit, refIdx) : null;

  const rechneMc = () => {
    setMcLaeuft(true);
    setTimeout(() => {
      try {
        setMc(todesfallMonteCarlo(effH, regeln, heute, tf));
      } finally {
        setMcLaeuft(false);
      }
    }, 30);
  };
  const rechneMatrix = () => {
    setMatrixLaeuft(true);
    setTimeout(() => {
      try {
        setMatrix(todesfallMatrix(effH, regeln, heute, tf));
      } finally {
        setMatrixLaeuft(false);
      }
    }, 30);
  };
  const veraltet = () => {
    setMc(null);
    setMatrix(null);
  };
  const aendere = (fn: (t: Todesfall) => Todesfall) => {
    veraltet();
    setze(fn);
  };

  const info = v?.mit.todesfall ?? null;
  const tot = info ? (namen[info.verstorben] ?? 'Person') : '';
  const lebt = info ? (namen[info.ueberlebend] ?? 'Person') : '';

  return (
    <Karte
      titel="Todesfall: Was passiert, wenn eine Person stirbt?"
      untertitel="Modell für Ehepaare: Eine Person stirbt zum gewählten Zeitpunkt. Die App rechnet Renten, Vorsorgekapital, Ausgaben und Steuern der überlebenden Person und vergleicht mit Ihrem Plan ohne Todesfall."
    >
      {!moeglich ? (
        <p className="klein">
          Das Szenario gibt es nur für Ehepaare (zwei Personen, Zivilstand «verheiratet»). Stellen Sie unter «Personen»
          den Zivilstand ein.
        </p>
      ) : (
        <>
          <Schalter
            label="Todesfall-Szenario rechnen"
            checked={tf.aktiv}
            onChange={(a) => aendere((t) => ({ ...t, aktiv: a }))}
          />
          {tf.aktiv ? (
            <>
              <AuswahlFeld<number>
                label="Wer stirbt?"
                value={tf.person}
                optionen={h.personen.map((_, i) => ({ value: i, label: namen[i] ?? `Person ${i + 1}` }))}
                onChange={(person) => aendere((t) => ({ ...t, person }))}
              />
              <Segmente<'alter' | 'jahr'>
                label="Zeitpunkt"
                value={tf.modus}
                optionen={[
                  { value: 'alter', label: 'Im Alter' },
                  { value: 'jahr', label: 'Im Jahr' },
                ]}
                onChange={(modus) => aendere((t) => ({ ...t, modus }))}
              />
              {tf.modus === 'alter' ? (
                <ZahlFeld
                  label={`Alter von ${namen[tf.person] ?? 'der Person'} beim Tod`}
                  value={tf.alter}
                  min={0}
                  max={120}
                  nachkomma={0}
                  einheit="Jahre"
                  onChange={(alter) => aendere((t) => ({ ...t, alter }))}
                />
              ) : (
                <ZahlFeld
                  label="Todesjahr"
                  value={tf.jahr}
                  min={heute.jahr}
                  max={2300}
                  nachkomma={0}
                  onChange={(jahr) => aendere((t) => ({ ...t, jahr }))}
                />
              )}
              <ZahlFeld
                label="Ausgaben der überlebenden Person"
                hinweis={`Faktor auf die geplante Lebenshaltung. Standard ${AUSGABEN_FAKTOR_STANDARD.toLocaleString('de-CH')}: modifizierte OECD-Äquivalenzskala des BFS (erste Person 1,0, weitere 0,5 → 1,0 / 1,5). Das ist eine Näherung (OFFEN): Wohnkosten und Fixkosten sinken oft weniger. Mit 1 bleiben die Ausgaben gleich.`}
                value={tf.ausgabenFaktor}
                min={0.1}
                max={1.5}
                nachkomma={2}
                onChange={(ausgabenFaktor) => aendere((t) => ({ ...t, ausgabenFaktor }))}
              />
              <ZahlFeld
                label="Ehejahre heute"
                hinweis="Für die Ansprüche: AHV-Witwenrente und PK-Ehegattenrente verlangen Kinder oder mindestens 45 Jahre Alter und 5 Ehejahre (MB 3.03 Ziff. 1; Art. 19 BVG)."
                value={tf.ehejahre}
                min={0}
                max={80}
                nachkomma={0}
                einheit="Jahre"
                onChange={(ehejahre) => aendere((t) => ({ ...t, ehejahre }))}
              />
              <Schalter
                label="Die überlebende Person hat Kinder mit Anspruch auf Waisenrente"
                hinweis="Mit Kindern besteht Anspruch auf Witwen- bzw. Witwerrente unabhängig von Alter und Ehedauer. Waisenrenten selbst sind nicht gerechnet."
                checked={tf.kinder}
                onChange={(kinder) => aendere((t) => ({ ...t, kinder }))}
              />
              <Schalter
                label="AHV-Splitting berücksichtigen (Ehe über das ganze Erwerbsleben)"
                hinweis="Nach dem Tod werden die Einkommen der Ehejahre geteilt (MB 3.01 Ziff. 18). Näherung: die überlebende Person erhält den Durchschnitt beider Renten. Aus = nur die eigene Rente (vorsichtig)."
                checked={tf.splitting}
                onChange={(splitting) => aendere((t) => ({ ...t, splitting }))}
              />
            </>
          ) : null}
        </>
      )}

      {aktiv && v && anzeige && info ? (
        <>
          <div className="kennzahlen kennzahlen--vier" role="status">
            <div>
              <span className="kennzahl__wert">{bis(v.ohne.ruinAlter, effH.planungsalter)}</span>
              <span className="kennzahl__text">Geld reicht bis Alter, ohne Todesfall</span>
            </div>
            <div>
              <span className="kennzahl__wert">{bis(v.mit.ruinAlter, effH.planungsalter)}</span>
              <span className="kennzahl__text">Geld reicht bis Alter, mit Todesfall</span>
            </div>
            <div>
              <span className="kennzahl__wert">{fmtChf(endBetrag(v.ohne, dar))}</span>
              <span className="kennzahl__text">Endvermögen ohne Todesfall ({chfKurz(dar)})</span>
            </div>
            <div>
              <span className="kennzahl__wert">{fmtChf(endBetrag(v.mit, dar))}</span>
              <span className="kennzahl__text">Endvermögen mit Todesfall ({chfKurz(dar)})</span>
            </div>
          </div>
          <p className={v.mit.erfolg ? 'ok' : 'warnung'}>
            {v.mit.erfolg
              ? `✓ Auch mit dem Tod von ${tot} (Alter ${info.alterVerstorben}, ${info.jahr}) reicht das Geld bis zum Planungsalter. Differenz Endvermögen: ${fmtChf(endBetrag(v.mit, dar) - endBetrag(v.ohne, dar))}.`
              : `✗ Mit dem Tod von ${tot} reicht das Geld nur bis Alter ${v.mit.ruinAlter ?? '–'} (Referenzperson), Jahr ${v.mit.ruinJahr}.`}
          </p>

          {vn ? (
            <ScrollTabelle label="Einkommen und Ausgaben vor und nach dem Todesfall (Tabelle, scrollbar)">
              <table className="vergleich-tabelle">
                <caption>
                  Einkommen und Ausgaben pro Jahr vor und nach dem Todesfall ({inFranken(dar)}; Jahr {vn.jahrVorher}{' '}
                  bzw. {vn.jahrNachher})
                </caption>
                <thead>
                  <tr>
                    <th scope="col"> </th>
                    <th scope="col">Vorher</th>
                    <th scope="col">Nachher</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">AHV</th>
                    <td>{fmtChf(vn.ahvVorher)}</td>
                    <td>{fmtChf(vn.ahvNachher)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Pensionskassen-Rente</th>
                    <td>{fmtChf(vn.pkVorher)}</td>
                    <td>{fmtChf(vn.pkNachher)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Einkommen total</th>
                    <td>{fmtChf(vn.vorher)}</td>
                    <td>{fmtChf(vn.nachher)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Geplante Ausgaben</th>
                    <td>{fmtChf(vn.ausgabenVorher)}</td>
                    <td>{fmtChf(vn.ausgabenNachher)}</td>
                  </tr>
                </tbody>
              </table>
            </ScrollTabelle>
          ) : (
            <p className="klein">
              Vor- und Nachher-Vergleich: Der Todesfall liegt zu nahe am Anfang oder Ende des Planungszeitraums.
            </p>
          )}

          <ul className="todes-erklaerung">
            <li>
              <strong>AHV:</strong>{' '}
              {info.ahvAnspruch
                ? `${lebt} hat Anspruch auf eine Witwen-/Witwerrente von ${fmtChf(info.ahvWitwenrenteMonat)} pro Monat (80 % der Rente von ${tot}, 12 Zahlungen). Eigene Altersrente inkl. Verwitwetenzuschlag: ${fmtChf(info.ahvAltersrenteMonat)} pro Monat (mit 13. Rente). Ausbezahlt wird die Leistung mit der höheren Jahressumme (Art. 24b AHVG), nicht beides.`
                : `${lebt} hat keinen Anspruch auf eine Witwen-/Witwerrente. Es zählt die eigene Altersrente: ${fmtChf(info.ahvAltersrenteMonat)} pro Monat ohne Plafonierung, inkl. 20 % Verwitwetenzuschlag (höchstens die Maximalrente).`}{' '}
              Die Plafonierung von 150 % für Ehepaare entfällt.
            </li>
            <li>
              <strong>Pensionskasse:</strong>{' '}
              {info.pkEhegattenrenteJahr > 0
                ? info.pkAnspruch
                  ? `Ehegattenrente von ${fmtChf(info.pkEhegattenrenteJahr)} pro Jahr (60 % der Alters- bzw. Invalidenrente, Art. 21 BVG); sie wird nicht der Teuerung angepasst.`
                  : `Kein Anspruch auf eine Ehegattenrente (Art. 19 BVG); stattdessen einmalige Abfindung von ${fmtChf(info.pkAbfindung)} (drei Jahresrenten).`
                : 'Keine laufende PK-Rente der verstorbenen Person. Wurde das PK-Guthaben als Kapital bezogen, liegt es im Vermögen und bleibt der überlebenden Person (Erbschaft unter Ehegatten).'}
            </li>
            {info.kapitalFzUnd3a > 0 ? (
              <li>
                <strong>Freizügigkeit und Säule 3a:</strong> {fmtChf(info.kapitalFzUnd3a)} von {tot} gehen als Kapital
                an {lebt} (Ehegatte ist erstbegünstigt) und werden als Kapitalleistung besteuert.
              </li>
            ) : null}
            <li>
              <strong>Steuern:</strong> Im Todesjahr wird das Ehepaar noch gemeinsam veranlagt, ab dem Folgejahr gilt
              der Tarif für Alleinstehende. Erbschaftssteuer unter Ehegatten fällt in ZH und AG nicht an.
            </li>
            <li>
              <strong>Ausgaben:</strong> ab dem Folgemonat mal {tf.ausgabenFaktor.toLocaleString('de-CH')}.
            </li>
            {info.hinweise.map((t) => (
              <li key={t} className="warnung">
                {t}
              </li>
            ))}
          </ul>

          {chart ? (
            <LinienChart
              x={chart.x}
              xLabel={h.personen.length > 1 ? `Alter ${namen[refIdx]}` : 'Alter'}
              serien={chart.serien}
              markierungen={
                todesAlter === null ? undefined : [{ von: todesAlter - 1, bis: todesAlter, label: `† ${tot}` }]
              }
              hoehe={260}
              beschreibung={`Verfügbares Vermögen am Jahresende ${inFranken(dar)}: gestrichelt der Plan ohne Todesfall, ausgezogen mit Todesfall. Das hinterlegte Jahr ist das Todesjahr.`}
            />
          ) : null}
          <p className="klein">
            Vermögen {inFranken(dar)}, mit und ohne Todesfall. Gerechnet mit derselben Krisen-Einstellung wie das übrige
            Ergebnis.
          </p>

          <JahresUebersicht
            e={anzeige.mit}
            darstellung={dar}
            namen={namen}
            refIdx={refIdx}
            startMonat={heute.monat}
            titel="Jahrestabelle mit Todesfall"
            dateiname="ruhestand-todesfall"
            markierungen={
              todesAlter === null ? undefined : [{ von: todesAlter - 1, bis: todesAlter, label: `† ${tot}` }]
            }
          />

          <h3 className="unter-titel">Monte Carlo mit Todesfall</h3>
          {mc ? (
            <>
              <div className="kennzahlen" role="status">
                <div>
                  <span className="kennzahl__wert">{fmtProzent(mc.ohne.erfolgsquote, 0)}</span>
                  <span className="kennzahl__text">Erfolgsquote ohne Todesfall</span>
                </div>
                <div>
                  <span className="kennzahl__wert">{fmtProzent(mc.mit.erfolgsquote, 0)}</span>
                  <span className="kennzahl__text">Erfolgsquote mit Todesfall</span>
                </div>
              </div>
              <Faecher
                m={mc.mit}
                x={mc.mit.jahre.map((j) => j - (effH.personen[refIdx]?.geburtsjahr ?? 0))}
                xLabel={h.personen.length > 1 ? `Alter ${namen[refIdx]}` : 'Alter'}
                darstellung={dar}
                planungsalter={effH.planungsalter}
                markierungen={
                  todesAlter === null ? undefined : [{ von: todesAlter - 1, bis: todesAlter, label: `† ${tot}` }]
                }
                text="Mit Todesfall."
              />
              <p className="klein">
                {mc.mit.laeufe} Läufe mit denselben zufälligen Krisenpfaden wie ohne Todesfall (gleicher Startwert),
                damit der Unterschied allein vom Todesfall kommt.
              </p>
            </>
          ) : (
            <>
              <p className="klein">
                Rechnet den Todesfall in jedem Monte-Carlo-Lauf ({h.krisen.mcLaeufe} Läufe, Methode wie unter «Krisen»).
                Das dauert einige Sekunden.
              </p>
              <button type="button" className="knopf knopf--sekundaer" onClick={rechneMc} disabled={mcLaeuft}>
                {mcLaeuft ? 'Rechnet …' : 'Monte Carlo mit Todesfall rechnen'}
              </button>
            </>
          )}

          <h3 className="unter-titel">Wer stirbt zuerst und wann?</h3>
          {matrix ? (
            <ScrollTabelle label="Wer stirbt zuerst und wann (Tabelle, scrollbar)">
              <table className="vergleich-tabelle">
                <caption>
                  Geld reicht bis Alter ({namen[refIdx]}, jüngere Person) – Endvermögen in Klammern ({inFranken(dar)})
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Es stirbt …</th>
                    {MATRIX_ALTER.map((a) => (
                      <th key={a} scope="col">
                        mit {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((zeile, i) => (
                    <tr key={namen[i] ?? i}>
                      <th scope="row">{namen[i]}</th>
                      {zeile.map((z, k) => (
                        <td key={MATRIX_ALTER[k]}>
                          {z.moeglich ? (
                            <>
                              <strong>{bis(z.reichtBis, effH.planungsalter)}</strong>{' '}
                              <span className="klein">({fmtChf(z.endVermoegen)})</span>
                            </>
                          ) : (
                            '–'
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="klein">
                Beträge in heutigen Franken. «–»: Dieses Alter liegt in der Vergangenheit. Alle anderen Einstellungen
                (Ausgabenfaktor, Ehejahre, Kinder, Splitting) gelten in jeder Zelle.
              </p>
            </ScrollTabelle>
          ) : (
            <button type="button" className="knopf knopf--sekundaer" onClick={rechneMatrix} disabled={matrixLaeuft}>
              {matrixLaeuft ? 'Rechnet …' : 'Matrix berechnen (A/B stirbt mit 70, 80, 90)'}
            </button>
          )}
        </>
      ) : null}

      <details className="aufklapp-innen">
        <summary>Was gerechnet wird – und was nicht</summary>
        <ul>
          <li>
            <strong>Modell, keine Beratung.</strong> Die Regeln stammen aus MB 3.03 und 3.01 (AHV, Stand 1.1.2026), Art.
            19–21 BVG, Art. 24b AHVG und Steuerrecht ZH/DBG; Quellen mit Stand in «Quellen» (docs/quellen.md). Ihr
            Pensionskassen-Reglement kann mehr bieten (z.B. Todesfallkapital, Leistungen für Konkubinatspartner).
          </li>
          <li>
            Die Witwen-/Witwerrente der AHV beträgt 80 % der Altersrente der verstorbenen Person. Sie erlischt bei
            Wiederverheiratung (nicht gerechnet). Es gibt keine 13. Witwenrente; die höhere Jahressumme aus Altersrente
            inkl. 13. Rente und 12 Hinterlassenenrenten gilt.
          </li>
          <li>
            <strong>Ausland:</strong> Die AHV-Hinterlassenenrente wird bei Wohnsitz im Ausland für Schweizer und
            Staatsangehörige von EU/EFTA und Abkommensstaaten weiter bezahlt. Ergänzungsleistungen gibt es nur in der
            Schweiz.
          </li>
          <li>
            Nicht gerechnet: Waisenrenten, Wiederverheiratung, Erbteile von Kindern (Pflichtteile), Güterrecht,
            Elterntarif für Verwitwete mit Kindern, Todesfallkapital nach Reglement, Reform der Hinterlassenenrenten
            (noch nicht in Kraft).
          </li>
        </ul>
      </details>
    </Karte>
  );
}
