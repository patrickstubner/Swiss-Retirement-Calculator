/**
 * Hinweis im Modus «Schnell»: Mit welchen Annahmen gerechnet wird (Rendite, Teuerung, Kosten) und was das real
 * bedeutet. Der Schnellmodus hat keine eigenen Annahmen: er teilt `haushalt.annahmen` mit «Detailliert».
 */

import type { Annahmen } from '../../core/typen';
import { ANNAHMEN_STANDARD } from '../../data/defaults';
import { fmtProzent } from '../format';

/** Reale Nettorendite der Börsenanlagen nach Kosten und Teuerung (wie in der Rechnung). */
export const realNetto = (a: Pick<Annahmen, 'renditeNominal' | 'kosten' | 'inflation'>): number =>
  (1 + a.renditeNominal - a.kosten) / (1 + a.inflation) - 1;

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
    </section>
  );
}
