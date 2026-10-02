/**
 * Hinweis im Modus «Schnell»: Mit welchen Annahmen gerechnet wird (Rendite, Teuerung, Kosten) und was das real
 * bedeutet. Der Schnellmodus hat keine eigenen Annahmen: er teilt `haushalt.annahmen` mit «Detailliert».
 */

import { RICHTWERT_BIS, RICHTWERT_VON, type Richtwert, richtwerte } from '../../core/richtwerte';
import type { Annahmen } from '../../core/typen';
import { ANNAHMEN_STANDARD } from '../../data/defaults';
import { KRISEN_DATEN } from '../../data/krisen';
import { fmtProzent } from '../format';
import { ScrollTabelle } from './ScrollTabelle';

/** Reale Nettorendite der Börsenanlagen nach Kosten und Teuerung (wie in der Rechnung). */
export const realNetto = (a: Pick<Annahmen, 'renditeNominal' | 'kosten' | 'inflation'>): number =>
  (1 + a.renditeNominal - a.kosten) / (1 + a.inflation) - 1;

const RICHTWERTE_CHE: readonly Richtwert[] = richtwerte(KRISEN_DATEN, 'CHE');
const RICHTWERTE_USA: readonly Richtwert[] = richtwerte(KRISEN_DATEN, 'USA');
const anteilText = (w: number) =>
  w === 1 ? '100 % Aktien' : w === 0 ? '0 % Aktien (nur Obligationen)' : `${Math.round(w * 100)} % Aktien`;

/**
 * Einordnung der Standardrendite: belegte Spanne für Aktien und Hinweis, dass sie mit Obligationenanteil sinkt.
 * Zahlen: JST R6 (aus den App-Daten gerechnet), UBS Global Investment Returns Yearbook 2025 (DMS), MSCI-Factsheet.
 * Quellen und Stand: docs/quellen.md, Abschnitt 20.
 */
export function RenditeEinordnung({ ausfuehrlich = false }: { ausfuehrlich?: boolean }) {
  const che = RICHTWERTE_CHE[0];
  const usa = RICHTWERTE_USA[0];
  return (
    <>
      <p className="klein">
        7 % nominal passt zu einem Portfolio aus <strong>100 % Aktien</strong>: Schweizer Aktien erzielten 1900–2020
        rund {fmtProzent(che?.nominal ?? Number.NaN)} pro Jahr in CHF, US-Aktien rund{' '}
        {fmtProzent(usa?.nominal ?? Number.NaN)} in USD (Jordà-Schularick-Taylor, vor Kosten und Steuern). Die Spanne
        ist gross: Seit 2000 erzielte der MSCI World netto 7.53 % pro Jahr in USD (29.12.2000 bis 31.8.2026, MSCI), die
        globalen Aktien des UBS Global Investment Returns Yearbook 2025 real 3.5 % pro Jahr (2000–2024). Für US-Aktien
        nennt das Yearbook im durchschnittlichen Jahr real 8.5 %; als Jahresrendite über die Jahre (geometrisch) sind es
        laut JST real rund 6.7 %. Eine Garantie gibt es nicht.{' '}
        <strong>Mit Obligationenanteil sinkt die erwartete Rendite</strong>; passen Sie den Wert bei weniger Aktien an
        (Schritt «Annahmen»).
      </p>
      {ausfuehrlich ? (
        <details className="aufklapp">
          <summary>Orientierung: Aktienanteil und historische Rendite</summary>
          <ScrollTabelle label="Aktienanteil und historische Rendite (Tabelle)">
            <table className="fluss-tabelle">
              <caption>
                Historische nominale Jahresrendite {RICHTWERT_VON}–{RICHTWERT_BIS}, geometrisches Mittel, vor Kosten
                (Rückschau, keine Prognose)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Aktienanteil</th>
                  <th scope="col">Schweiz (CHF)</th>
                  <th scope="col">USA (USD)</th>
                </tr>
              </thead>
              <tbody>
                {RICHTWERTE_CHE.map((r, i) => (
                  <tr key={r.aktienanteil}>
                    <th scope="row">{anteilText(r.aktienanteil)}</th>
                    <td>{fmtProzent(r.nominal)}</td>
                    <td>{fmtProzent(RICHTWERTE_USA[i]?.nominal ?? Number.NaN)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTabelle>
          <p className="klein">
            Obligationen: Staatsanleihen laut JST (Schweiz real rund 2 % pro Jahr, UBS-Yearbook: Eidgenossen real knapp
            über 2 %). Die US-Zahlen sind in USD; in CHF umgerechnet (Wechselkurs) ist die Rendite eine andere, die Höhe
            ist hier <strong>nicht belegt (OFFEN)</strong>. Nach Anlagekosten und Steuern bleibt weniger. Die Teuerung
            betrug in der Schweiz seit 1900 im Mittel 2.1 % pro Jahr (UBS-Yearbook 2025).
          </p>
        </details>
      ) : null}
    </>
  );
}

export function AnnahmenSchnellHinweis({ a }: { a: Annahmen }) {
  const istStandard =
    a.renditeNominal === ANNAHMEN_STANDARD.renditeNominal && a.inflation === ANNAHMEN_STANDARD.inflation;
  return (
    <section className="info annahmen-schnell" aria-labelledby="annahmen-schnell-titel">
      <p id="annahmen-schnell-titel">
        <strong>
          Annahmen im Schnellmodus: Rendite {fmtProzent(a.renditeNominal)} nominal, Teuerung {fmtProzent(a.inflation)};
          im Modus «Detailliert» änderbar.
        </strong>
      </p>
      <p>
        Nach Anlagekosten ({fmtProzent(a.kosten)}) und Teuerung bleiben real{' '}
        <strong>{fmtProzent(realNetto(a), 2)}</strong> Nettorendite pro Jahr auf den Wertschriften. Die Rendite gilt für
        alle Wertschriften; Bargeld verzinst sich mit {fmtProzent(a.renditeBargeld)}.
      </p>
      {!istStandard ? (
        <p className="klein">
          Diese Werte weichen vom Standard ({fmtProzent(ANNAHMEN_STANDARD.renditeNominal)} Rendite,{' '}
          {fmtProzent(ANNAHMEN_STANDARD.inflation)} Teuerung) ab, weil sie bereits gespeichert oder im Modus
          «Detailliert» geändert wurden.
        </p>
      ) : null}
      <p className="klein">
        {fmtProzent(ANNAHMEN_STANDARD.renditeNominal)} nominal ist eine Annahme, keine Garantie: Renditen schwanken von
        Jahr zu Jahr stark und können über lange Zeit tiefer liegen. Der Krisenmodus bleibt eingeschaltet (historische
        Krisen, die normalen Jahre werden so erhöht, dass der Durchschnitt Ihrer Annahme entspricht). Prüfen Sie das
        Ergebnis auch mit einer tieferen Rendite (Regler «Was wäre, wenn» im Ergebnis).
      </p>
      <RenditeEinordnung />
    </section>
  );
}
