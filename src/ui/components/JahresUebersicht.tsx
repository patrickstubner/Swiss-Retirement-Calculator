/**
 * Vermögen (linke Achse) und geplante Ausgaben (rechte Achse) pro Jahr, dazu die Jahrestabelle mit
 * Einnahmen, Ausgaben und Steuern (erste Spalte fix, horizontal scrollbar) und CSV-Export.
 * Erwartet das Ergebnis bereits in der gewählten Darstellung (`inDarstellung`).
 */
import { useMemo, useState } from 'react';
import { jahresCsv, jahresSpalten, sichtbareSpalten } from '../../core/jahresTabelle';
import type { Darstellung } from '../../core/nominal';
import type { SimulationsErgebnis } from '../../core/typen';
import { inFranken } from '../darstellung';
import { chartFarbe, mitAlpha } from '../farben';
import { fmtChf } from '../format';
import { LinienChart, type Markierung, type Serie } from './Chart';

/** Löst im Browser den Download einer Textdatei aus. */
function herunterladen(name: string, inhalt: string) {
  const blob = new Blob([inhalt], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function JahresUebersicht({
  e,
  darstellung,
  namen,
  refIdx,
  markierungen,
  dateiname = 'ruhestand-jahrestabelle',
  titel = 'Vermögen und geplante Ausgaben',
  startMonat = 1,
}: {
  e: SimulationsErgebnis;
  darstellung: Darstellung;
  namen: string[];
  refIdx: number;
  markierungen?: Markierung[];
  dateiname?: string;
  titel?: string;
  /** Erster gerechneter Monat (1–12): das angebrochene erste Jahr wird in der Grafik auf 12 Monate hochgerechnet */
  startMonat?: number;
}) {
  const [offen, setOffen] = useState(false);
  const chart = useMemo(() => {
    const x = e.zeilen.map((z) => z.alter[refIdx] ?? 0);
    // Ausgaben pro ganzes Jahr: das angebrochene Startjahr hochrechnen (sonst Knick am Anfang)
    const f0 = 12 / Math.max(1, 13 - Math.min(12, Math.max(1, startMonat)));
    const proJahr = (i: number, v: number) => (i === 0 ? v * f0 : v);
    const serien: Serie[] = [
      {
        label: 'Vermögen Ende Jahr (links)',
        werte: e.zeilen.map((z) => z.vermoegen),
        farbe: chartFarbe('haupt'),
        fuellung: mitAlpha(chartFarbe('haupt'), 0.12),
      },
      {
        label: 'Geplante Ausgaben (rechts)',
        werte: e.zeilen.map((z, i) => proJahr(i, z.lebenshaltung)),
        farbe: chartFarbe('pk'),
        rechts: true,
      },
    ];
    if (e.zeilen.some((z) => Math.abs(z.ausgaben - z.lebenshaltung) > 0.5)) {
      serien.push({
        label: 'Alle Ausgaben inkl. Wohnkosten (rechts)',
        werte: e.zeilen.map((z, i) => proJahr(i, z.ausgaben)),
        farbe: chartFarbe('pk'),
        gestrichelt: true,
        rechts: true,
      });
    }
    return { x, serien };
  }, [e, refIdx, startMonat]);
  const mitTod = e.zeilen.some((z) => z.todesjahr);
  const spalten = useMemo(() => sichtbareSpalten(jahresSpalten(namen, mitTod), e), [namen, e, mitTod]);
  const einheit = darstellung === 'nominal' ? 'CHF nominal' : 'CHF heute';
  const exportieren = () =>
    herunterladen(
      `${dateiname}-${darstellung === 'nominal' ? 'nominal' : 'heutige-franken'}.csv`,
      jahresCsv(jahresSpalten(namen, mitTod), e, einheit),
    );
  const xLabel = namen.length > 1 ? `Alter ${namen[refIdx]}` : 'Alter';

  return (
    <div className="jahres-uebersicht">
      <h3 className="unter-titel">{titel}</h3>
      <p className="klein">
        Vermögen am Jahresende auf der linken Achse, Ausgaben pro Jahr auf der rechten Achse – beides{' '}
        {inFranken(darstellung)}.
        {startMonat > 1
          ? ' Das angebrochene erste Jahr ist in der Grafik auf ein ganzes Jahr hochgerechnet (Tabelle: tatsächliche Beträge).'
          : ''}
      </p>
      <LinienChart
        x={chart.x}
        xLabel={xLabel}
        serien={chart.serien}
        markierungen={markierungen}
        hoehe={260}
        beschreibung={`Verfügbares Vermögen am Jahresende (linke Achse) und geplante Ausgaben pro Jahr (rechte Achse) ${inFranken(darstellung)}. Die Tabelle darunter enthält alle Werte.`}
      />
      <details className="aufklapp" onToggle={(ev) => setOffen((ev.target as HTMLDetailsElement).open)}>
        <summary>Jahrestabelle: Einnahmen, Ausgaben, Steuern</summary>
        {offen ? (
          <>
            <p className="klein">
              Alle Beträge {inFranken(darstellung)}
              {darstellung === 'nominal' ? ' (Flüsse mit dem Stand zu Jahresbeginn, Vermögen am Jahresende)' : ''}.
              Seitlich wischen für weitere Spalten; Spalten ohne Werte sind ausgeblendet (im CSV enthalten).
              Vermögenserträge: Zinsen, Dividenden und Kursänderungen auf Bargeld, Wertschriften und Sonstigem nach
              Kosten{darstellung === 'real' ? ' und Teuerung' : ''}. Erwerb brutto; Beiträge an AHV, PK und 3a separat.
            </p>
            <div className="tabelle-scroll tabelle-fix">
              <table className="jahrestabelle">
                <thead>
                  <tr>
                    {spalten.map((s) => (
                      <th key={s.id} scope="col">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {e.zeilen.map((z) => (
                    <tr
                      key={z.jahr}
                      className={
                        `${z.fehlbetrag > 0.5 ? 'negativ' : ''}${z.todesjahr ? ' todesjahr' : ''}`.trim() || undefined
                      }
                    >
                      {spalten.map((s, i) =>
                        i === 0 ? (
                          <th key={s.id} scope="row">
                            {z.jahr}
                            {z.todesjahr ? (
                              <span className="todes-marker" title="Todesjahr" role="img" aria-label="Todesjahr">
                                {' †'}
                              </span>
                            ) : null}
                          </th>
                        ) : (
                          <td key={s.id}>
                            {s.betrag ? (Math.abs(s.wert(z)) < 0.5 ? '–' : fmtChf(s.wert(z))) : s.wert(z)}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </details>
      <div className="knopf-reihe">
        <button type="button" className="knopf knopf--sekundaer" onClick={exportieren}>
          Tabelle als CSV herunterladen
        </button>
      </div>
    </div>
  );
}
