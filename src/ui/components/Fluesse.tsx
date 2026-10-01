/**
 * Karte «Zu- und Abflüsse»: was fliesst wann als Kapital und als laufende Rente zu (Zeitleiste), was fliesst
 * wann und warum ab (gestapelte Jahresgrafik mit Jahr zum Antippen und Tabelle), dazu die Entnahmerate.
 * Die Logik steht in core/fluesse.ts; hier nur Darstellung. Alle Texte sind feste Zeichenketten bzw.
 * React-Text (kein HTML-Einschleusen); Nutzereingaben (Namen, Bezeichnungen) erscheinen nur als Text.
 */
import { useId, useMemo, useState } from 'react';
import {
  ABFLUSS_GRUPPEN,
  ABFLUSS_INFO,
  type Ereignis,
  entnahmeKennzahl,
  flussJahre,
  gruppenBetrag,
  ZUFLUSS_IDS,
  ZUFLUSS_INFO,
} from '../../core/fluesse';
import type { Darstellung } from '../../core/nominal';
import { inDarstellung } from '../../core/nominal';
import { startToepfeHaushalt, startvermoegen } from '../../core/simulation';
import type { Haushalt, SimulationsErgebnis } from '../../core/typen';
import { chfKurz, inFranken } from '../darstellung';
import { type ChartFarbe, chartFarbe } from '../farben';
import { fmtChf, fmtKompakt, fmtProzent, MONATSNAMEN } from '../format';
import { Karte } from './Karte';

const FARBEN: ChartFarbe[] = ['abfl1', 'abfl2', 'abfl3', 'abfl4', 'abfl5', 'abfl6', 'abfl7', 'abfl8', 'abfl9'];

export function datumText(ev: { jahr: number; monat: number | null }): string {
  return ev.monat ? `${MONATSNAMEN[ev.monat - 1] ?? ev.monat} ${ev.jahr}` : String(ev.jahr);
}

interface Props {
  /** Ergebnis in heutigen Franken (Rechnung) */
  real: SimulationsErgebnis;
  /** Wirksamer Haushalt der Rechnung (mit Schätzwerten) */
  h: Haushalt;
  dar: Darstellung;
  refIdx: number;
  startMonat: number;
  ereignisse: Ereignis[];
}

export function FlussKarte({ real, h, dar, refIdx, startMonat, ereignisse }: Props) {
  const anzeige = useMemo(() => inDarstellung(real, dar), [real, dar]);
  const start = useMemo(() => startvermoegen(h), [h]);
  const jahre = useMemo(() => flussJahre(anzeige.zeilen, start, refIdx), [anzeige, start, refIdx]);
  const kennzahl = useMemo(
    () => entnahmeKennzahl(real.zeilen, startToepfeHaushalt(h), startMonat),
    [real, h, startMonat],
  );
  const erstZeile = kennzahl ? anzeige.zeilen.find((z) => z.jahr === kennzahl.jahr) : undefined;
  const f = dar === 'nominal' && erstZeile ? erstZeile.indexBeginn : 1;

  const kapital = ereignisse.filter((e) => e.typ === 'kapital');
  const laufend = ereignisse.filter((e) => e.typ === 'laufend');
  const summeKapital = kapital.reduce((s, e) => s + (e.betrag ?? 0), 0);

  return (
    <Karte
      titel="Zu- und Abflüsse"
      untertitel={`Was wann als Kapital und als laufende Rente zufliesst und was wann warum abfliesst, ${inFranken(dar)}`}
    >
      <Entnahme kennzahl={kennzahl} faktor={f} dar={dar} />
      <Zufluesse kapital={kapital} laufend={laufend} summeKapital={summeKapital} dar={dar} />
      <Abfluesse jahre={jahre} dar={dar} />
    </Karte>
  );
}

function Entnahme({
  kennzahl,
  faktor,
  dar,
}: {
  kennzahl: ReturnType<typeof entnahmeKennzahl>;
  faktor: number;
  dar: Darstellung;
}) {
  if (!kennzahl)
    return <p className="klein">Entnahmerate: nicht berechenbar (kein volles Jahr ohne Erwerbseinkommen).</p>;
  const { erst } = kennzahl;
  const pr = (x: number | null) => (x === null ? '–' : fmtProzent(x, 1));
  return (
    <>
      <h3 className="unter-titel">Entnahmerate</h3>
      <div className="fluss-kennzahl">
        <div>
          <strong>{pr(erst.rateInvestiert)}</strong>
          <span>vom investierten Vermögen ({kennzahl.jahr})</span>
        </div>
        <div>
          <strong>{pr(erst.rateGesamt)}</strong>
          <span>vom Gesamtvermögen ({kennzahl.jahr})</span>
        </div>
      </div>
      <p className="klein">
        Im ersten vollen Jahr ohne Erwerbseinkommen ({kennzahl.jahr}) fehlen {fmtChf(erst.entnahme * faktor)} (
        {chfKurz(dar)}): Ausgaben, Steuern und Abgaben abzüglich Renten und anderer Einnahmen. Das wird dem Vermögen
        entnommen. Durchschnitt über alle Ruhestandsjahre: {pr(kennzahl.durchschnittInvestiert)} bzw.{' '}
        {pr(kennzahl.durchschnittGesamt)}.
        {kennzahl.hoechste
          ? ` Höchste Rate (investiertes Vermögen): ${pr(kennzahl.hoechste.rate)} im Jahr ${kennzahl.hoechste.jahr}.`
          : ''}
      </p>
      <details className="aufklapp">
        <summary>Was bedeutet die Entnahmerate?</summary>
        <ul>
          <li>
            <strong>Investiertes Vermögen:</strong> Bargeld, Wertschriften und Sonstiges, ohne gesperrte Vorsorge (PK,
            Freizügigkeit, 3a) und ohne das Haus. Kapitalbezüge und Hausverkauf des Jahres zählen dazu, weil sie in dem
            Jahr investierbar werden. Diese Rate ist die Kennzahl für «reicht das Geld an der Börse».
          </li>
          <li>
            <strong>Gesamtvermögen:</strong> zusätzlich gesperrte Vorsorge und Wohneigentum (netto nach Hypothek). Die
            Rate ist kleiner, weil das Haus und gesperrte Gelder nicht für laufende Ausgaben bereitstehen.
          </li>
          <li>
            Eine Entnahmerate unter etwa 4 % pro Jahr gilt oft als Faustregel für ein langes Ruhestandsleben. Das ist
            eine Faustregel, keine Garantie; sie hängt von Rendite, Teuerung und Krisen ab.
          </li>
        </ul>
      </details>
    </>
  );
}

function Zufluesse({
  kapital,
  laufend,
  summeKapital,
  dar,
}: {
  kapital: Ereignis[];
  laufend: Ereignis[];
  summeKapital: number;
  dar: Darstellung;
}) {
  return (
    <>
      <h3 className="unter-titel">Zuflüsse: Kapital, das zum Vermögen kommt</h3>
      {kapital.length === 0 ? (
        <p className="klein">Keine Kapitalzuflüsse im Planungszeitraum (kein PK-, 3a- oder Hauserlös als Kapital).</p>
      ) : (
        <div className="tabelle-scroll">
          <table className="fluss-tabelle">
            <caption>
              Kapitalzuflüsse mit Datum ({chfKurz(dar)}); Summe {fmtChf(summeKapital)}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="links">
                  Datum
                </th>
                <th scope="col" className="links">
                  Quelle
                </th>
                <th scope="col">Betrag</th>
                <th scope="col" className="links">
                  Erklärung
                </th>
              </tr>
            </thead>
            <tbody>
              {kapital.map((e) => (
                <tr key={`${e.art}-${e.jahr}-${e.titel}`}>
                  <th scope="row">{datumText(e)}</th>
                  <td className="links">{e.titel}</td>
                  <td>{e.betrag === null ? '–' : fmtChf(e.betrag)}</td>
                  <td className="erklaerung">
                    {e.text}
                    {e.steuer !== undefined && e.steuer > 0.5 ? ` Steuer darauf: ${fmtChf(e.steuer)}.` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3 className="unter-titel">Zuflüsse: laufende Renten und Einkommen</h3>
      {laufend.length === 0 ? (
        <p className="klein">Keine laufenden Renten erfasst.</p>
      ) : (
        <div className="tabelle-scroll">
          <table className="fluss-tabelle">
            <caption>Laufende Zuflüsse pro Jahr ({chfKurz(dar)}, im Startjahr)</caption>
            <thead>
              <tr>
                <th scope="col" className="links">
                  Ab
                </th>
                <th scope="col" className="links">
                  Quelle
                </th>
                <th scope="col">Pro Jahr</th>
                <th scope="col">Bis</th>
                <th scope="col" className="links">
                  Erklärung
                </th>
              </tr>
            </thead>
            <tbody>
              {laufend.map((e) => (
                <tr key={`${e.art}-${e.jahr}-${e.titel}`}>
                  <th scope="row">{datumText(e)}</th>
                  <td className="links">{e.titel}</td>
                  <td>{e.betrag === null ? '–' : fmtChf(e.betrag)}</td>
                  <td>{e.bisJahr ? e.bisJahr : 'lebenslang'}</td>
                  <td className="erklaerung">{e.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className="aufklapp">
        <summary>Was zählt als Zufluss?</summary>
        <dl className="fluss-detail">
          {ZUFLUSS_IDS.map((id) => (
            <div key={id}>
              <dt>{ZUFLUSS_INFO[id].label}</dt>
              <dd>
                {ZUFLUSS_INFO[id].was} {ZUFLUSS_INFO[id].wann} {ZUFLUSS_INFO[id].warum}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}

const B = 360;
const H = 230;
const RAND = { l: 44, r: 6, o: 8, u: 22 };

function Abfluesse({ jahre, dar }: { jahre: ReturnType<typeof flussJahre>; dar: Darstellung }) {
  const reglerId = useId();
  const [sel, setSel] = useState<number | null>(null);
  const farben = ABFLUSS_GRUPPEN.map((_, i) => chartFarbe(FARBEN[i] ?? 'abfl9'));
  const summen = jahre.map((j) => ABFLUSS_GRUPPEN.reduce((s, g) => s + gruppenBetrag(j, g), 0));
  const max = Math.max(1, ...summen) * 1.05;
  const n = Math.max(1, jahre.length);
  const plotB = B - RAND.l - RAND.r;
  const plotH = H - RAND.o - RAND.u;
  const bw = plotB / n;
  const y = (v: number) => RAND.o + plotH - (v / max) * plotH;
  const selIdx = Math.min(Math.max(sel ?? 0, 0), n - 1);
  const gewaehlt = jahre[selIdx];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const xTicks = jahre.filter((j, i) => i === 0 || j.jahr % 10 === 0);
  const aktiveGruppen = ABFLUSS_GRUPPEN.map((g, i) => ({ g, i })).filter(({ g }) =>
    jahre.some((j) => gruppenBetrag(j, g) > 0.5),
  );
  if (jahre.length === 0) return null;
  return (
    <>
      <h3 className="unter-titel">Abflüsse pro Jahr</h3>
      <p className="klein">
        Was jedes Jahr ausgegeben bzw. bezahlt wird ({chfKurz(dar)}). Jahr antippen oder mit dem Regler wählen: darunter
        steht, was es im Detail ist.
      </p>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Tastaturalternative sind der Regler und die Tabelle */}
      <svg
        className="fluss-balken"
        viewBox={`0 0 ${B} ${H}`}
        role="img"
        aria-label={`Gestapelte Balken der Abflüsse pro Jahr ${inFranken(dar)}: ${aktiveGruppen.map(({ g }) => g.label).join(', ')}. Alle Werte stehen in der Tabelle darunter.`}
        onClick={(ev) => {
          const r = ev.currentTarget.getBoundingClientRect();
          const px = ((ev.clientX - r.left) / Math.max(1, r.width)) * B - RAND.l;
          setSel(Math.min(n - 1, Math.max(0, Math.floor(px / bw))));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={RAND.l} x2={B - RAND.r} y1={y(t)} y2={y(t)} stroke={chartFarbe('gitter')} strokeWidth="1" />
            <text x={RAND.l - 4} y={y(t) + 3} textAnchor="end">
              {fmtKompakt(t)}
            </text>
          </g>
        ))}
        {jahre.map((j, i) => {
          let oben = 0;
          return (
            <g key={j.jahr}>
              {ABFLUSS_GRUPPEN.map((g, gi) => {
                const v = gruppenBetrag(j, g);
                if (v <= 0.5) return null;
                const y0 = y(oben);
                oben += v;
                return (
                  <rect
                    key={g.id}
                    x={RAND.l + i * bw + 0.3}
                    width={Math.max(1, bw - 0.6)}
                    y={y(oben)}
                    height={Math.max(0, y0 - y(oben))}
                    fill={farben[gi]}
                  />
                );
              })}
              {i === selIdx ? (
                <rect
                  x={RAND.l + i * bw - 0.5}
                  width={bw + 1}
                  y={RAND.o}
                  height={plotH}
                  fill="none"
                  stroke={chartFarbe('achse')}
                  strokeWidth="1.5"
                />
              ) : null}
            </g>
          );
        })}
        {xTicks.map((j) => (
          <text key={j.jahr} x={RAND.l + jahre.indexOf(j) * bw + bw / 2} y={H - 6} textAnchor="middle">
            {j.jahr}
          </text>
        ))}
      </svg>
      <ul className="fluss-legende">
        {aktiveGruppen.map(({ g, i }) => (
          <li key={g.id}>
            <span className="fluss-legende__farbe" style={{ background: farben[i] }} aria-hidden="true" />
            {g.label}
          </li>
        ))}
      </ul>
      <label htmlFor={reglerId} className="klein">
        Jahr wählen: <strong>{gewaehlt?.jahr}</strong> (Alter {gewaehlt?.alter})
      </label>
      <input
        id={reglerId}
        className="fluss-jahr-regler"
        type="range"
        min={0}
        max={n - 1}
        step={1}
        value={selIdx}
        onChange={(ev) => setSel(Number(ev.target.value))}
      />
      {gewaehlt ? <JahrDetail j={gewaehlt} dar={dar} /> : null}
      <details className="aufklapp">
        <summary>Tabelle: Abflüsse aller Jahre</summary>
        <div className="tabelle-scroll tabelle-fix">
          <table className="jahrestabelle fluss-tabelle">
            <caption>Abflüsse pro Jahr ({chfKurz(dar)})</caption>
            <thead>
              <tr>
                <th scope="col">Jahr</th>
                {aktiveGruppen.map(({ g }) => (
                  <th key={g.id} scope="col">
                    {g.label}
                  </th>
                ))}
                <th scope="col">Summe</th>
              </tr>
            </thead>
            <tbody>
              {jahre.map((j, i) => (
                <tr key={j.jahr} className={i === selIdx ? 'todesjahr' : undefined}>
                  <th scope="row">{j.jahr}</th>
                  {aktiveGruppen.map(({ g }) => {
                    const v = gruppenBetrag(j, g);
                    return <td key={g.id}>{v < 0.5 ? '–' : fmtChf(v)}</td>;
                  })}
                  <td>{fmtChf(summen[i] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="aufklapp">
        <summary>Bilanz: Zuflüsse − Abflüsse = Veränderung des Vermögens</summary>
        <p className="klein">
          Vermögen = verfügbare Töpfe (Bargeld, Wertschriften, Sonstiges, Wohneigentum netto) ohne gesperrte Vorsorge.
          Zuflüsse sind Einnahmen, Kapital und Erträge, Abflüsse Ausgaben, Steuern und Abgaben. Der Hausverkauf
          verschiebt nur Geld vom Haus in die Wertschriften: als Abfluss zählen Verkaufskosten und Steuer.
          {dar === 'nominal'
            ? ' In der nominalen Darstellung bleibt eine Differenz «Teuerung auf dem Bestand» (Vermögen wird am Jahresende, Flüsse werden zu Jahresbeginn umgerechnet).'
            : ''}
        </p>
        <div className="tabelle-scroll tabelle-fix">
          <table className="jahrestabelle fluss-tabelle">
            <caption>Jahresbilanz ({chfKurz(dar)})</caption>
            <thead>
              <tr>
                <th scope="col">Jahr</th>
                <th scope="col">Zuflüsse</th>
                <th scope="col">Abflüsse</th>
                {dar === 'nominal' ? <th scope="col">Teuerung auf Bestand</th> : null}
                <th scope="col">Veränderung</th>
                <th scope="col">Vermögen Ende Jahr</th>
              </tr>
            </thead>
            <tbody>
              {jahre.map((j) => (
                <tr key={j.jahr}>
                  <th scope="row">{j.jahr}</th>
                  <td>{fmtChf(j.summeZufluss)}</td>
                  <td>{fmtChf(j.summeAbfluss)}</td>
                  {dar === 'nominal' ? <td>{fmtChf(j.umrechnung)}</td> : null}
                  <td>{fmtChf(j.vermoegenDelta)}</td>
                  <td>{fmtChf(j.vermoegenEnde)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function JahrDetail({ j, dar }: { j: ReturnType<typeof flussJahre>[number]; dar: Darstellung }) {
  const posten = Object.entries(j.abfluesse)
    .filter(([, v]) => v > 0.5)
    .sort((a, b) => b[1] - a[1]) as [keyof typeof ABFLUSS_INFO, number][];
  return (
    <div className="unterkarte" aria-live="polite">
      <h4>
        {j.jahr}: {fmtChf(j.summeAbfluss)} Abflüsse ({chfKurz(dar)})
      </h4>
      {posten.length === 0 ? (
        <p className="klein">Keine Abflüsse in diesem Jahr.</p>
      ) : (
        <dl className="fluss-detail">
          {posten.map(([id, v]) => (
            <div key={id}>
              <dt>
                {ABFLUSS_INFO[id].label}: {fmtChf(v)}
              </dt>
              <dd>
                {ABFLUSS_INFO[id].was} {ABFLUSS_INFO[id].wann} {ABFLUSS_INFO[id].warum}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Tabelle der nummerierten Marker der Vermögensgrafik (Alternative zur Grafik) */
export function MarkerTabelle({
  gruppen,
  dar,
}: {
  gruppen: { jahr: number; nr: number; ereignisse: Ereignis[] }[];
  dar: Darstellung;
}) {
  if (gruppen.length === 0) return null;
  return (
    <details className="aufklapp" open>
      <summary>Ereignisse in der Grafik ({gruppen.length})</summary>
      <div className="tabelle-scroll">
        <table className="fluss-tabelle marker-tabelle">
          <caption>Nummerierte Marker der Vermögensgrafik ({chfKurz(dar)})</caption>
          <thead>
            <tr>
              <th scope="col" className="nr">
                Nr.
              </th>
              <th scope="col" className="links">
                Datum
              </th>
              <th scope="col" className="links">
                Ereignis
              </th>
              <th scope="col">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {gruppen.flatMap((g) =>
              g.ereignisse.map((e, i) => (
                <tr key={`${g.nr}-${e.art}-${e.titel}`}>
                  {i === 0 ? (
                    <th scope="row" className="nr" rowSpan={g.ereignisse.length}>
                      {g.nr}
                    </th>
                  ) : null}
                  <td className="links">{datumText(e)}</td>
                  <td className="erklaerung">
                    <strong>{e.titel}.</strong> {e.text}
                    {e.steuer !== undefined && e.steuer > 0.5 ? ` Steuer: ${fmtChf(e.steuer)}.` : ''}
                  </td>
                  <td>{e.betrag === null ? '–' : fmtChf(e.betrag)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
