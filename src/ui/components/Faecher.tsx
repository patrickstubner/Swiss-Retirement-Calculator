/**
 * Monte-Carlo-Fächer: 10., 25., 50., 75. und 90. Perzentil des verfügbaren Vermögens pro Jahr, zwei
 * Bänder (80 % und 50 % der Läufe), Erfolgsquote und «mit X % Wahrscheinlichkeit reicht das Geld bis Alter Y».
 */
import { type MonteCarloErgebnis, reichtBisAlter } from '../../core/montecarlo';
import type { Darstellung } from '../../core/nominal';
import { mcBaender } from '../darstellung';
import { chartFarbe } from '../farben';
import { fmtProzent } from '../format';
import { type Band, LinienChart, type Markierung, type Serie } from './Chart';

export const FAECHER = {
  p90: 'Sehr gut (90. Perzentil)',
  p75: 'Gut (75.)',
  p50: 'Mittlerer Fall (Median)',
  p25: 'Schlecht (25.)',
  p10: 'Sehr schlecht (10. Perzentil)',
} as const;

/** Serien und Bänder für den Fächer (optional mit zusätzlicher Linie, z.B. «Ihr Szenario»). */
export function faecherSerien(
  m: MonteCarloErgebnis,
  d: Darstellung,
  zusatz?: Serie,
): { serien: Serie[]; baender: Band[] } {
  const b = mcBaender(m, d);
  const serien: Serie[] = [
    { label: FAECHER.p90, werte: b.p90, farbe: chartFarbe('band'), gestrichelt: true },
    { label: FAECHER.p75, werte: b.p75, farbe: chartFarbe('band') },
    { label: FAECHER.p50, werte: b.p50, farbe: chartFarbe('median') },
    { label: FAECHER.p25, werte: b.p25, farbe: chartFarbe('negativ') },
    { label: FAECHER.p10, werte: b.p10, farbe: chartFarbe('negativ'), gestrichelt: true },
  ];
  if (zusatz) serien.push(zusatz);
  return {
    serien,
    baender: [
      { oben: FAECHER.p90, unten: FAECHER.p10, fuellung: chartFarbe('bandFlaeche') },
      { oben: FAECHER.p75, unten: FAECHER.p25, fuellung: chartFarbe('bandKern') },
    ],
  };
}

/** Satz «Mit 90 % Wahrscheinlichkeit reicht das Geld bis Alter 93 …» */
export function reichtSatz(m: MonteCarloErgebnis, w: number, planungsalter: number): string {
  const a = reichtBisAlter(m, w);
  return a === null
    ? `Mit ${fmtProzent(w, 0)} Wahrscheinlichkeit reicht das Geld bis zum Planungsalter ${planungsalter}.`
    : `Mit ${fmtProzent(w, 0)} Wahrscheinlichkeit reicht das Geld mindestens bis Alter ${a}.`;
}

export function Faecher({
  m,
  x,
  xLabel,
  darstellung,
  planungsalter,
  zusatz,
  markierungen,
  hoehe = 260,
  text,
}: {
  m: MonteCarloErgebnis;
  x: number[];
  xLabel: string;
  darstellung: Darstellung;
  planungsalter: number;
  zusatz?: Serie;
  markierungen?: Markierung[];
  hoehe?: number;
  /** Zusatz für die Textbeschreibung (Screenreader) */
  text?: string;
}) {
  const { serien, baender } = faecherSerien(m, darstellung, zusatz);
  return (
    <>
      <LinienChart
        x={x}
        xLabel={xLabel}
        serien={serien}
        baender={baender}
        markierungen={markierungen}
        hoehe={hoehe}
        beschreibung={`Fächer aus ${m.laeufe} Monte-Carlo-Läufen, verfügbares Vermögen ${darstellung === 'nominal' ? 'in Franken des jeweiligen Jahres' : 'in heutigen Franken'}: helle Fläche 10. bis 90. Perzentil (8 von 10 Läufen), dunkle Fläche 25. bis 75. Perzentil (die mittlere Hälfte), Linie Median.${text ? ` ${text}` : ''} Erfolgsquote ${fmtProzent(m.erfolgsquote, 0)}. ${reichtSatz(m, 0.9, planungsalter)}`}
      />
      <ul className="faecher-saetze">
        <li>
          <strong>Erfolgsquote {fmtProzent(m.erfolgsquote, 0)}</strong>: In so vielen der {m.laeufe} Läufe reicht das
          Geld bis zum Planungsalter {planungsalter}.
        </li>
        {[0.9, 0.75, 0.5].map((w) => (
          <li key={w}>{reichtSatz(m, w, planungsalter)}</li>
        ))}
      </ul>
      <p className="klein">
        Helle Fläche: 8 von 10 Läufen liegen darin (10. bis 90. Perzentil). Dunkle Fläche: die mittlere Hälfte (25. bis
        75. Perzentil). Die Linien verbinden pro Jahr die jeweiligen Perzentile; ein einzelner Lauf verläuft meist
        zwischen ihnen hin und her.
      </p>
    </>
  );
}
