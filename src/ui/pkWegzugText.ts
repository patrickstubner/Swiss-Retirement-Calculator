import type { PkWegzugStatus } from '../core/typen';
import { fmtAlter } from './format';

/** Anrede für die Statuszeile: «Sie» bei Einzelpersonen, sonst der Name (3. Person Einzahl) */
export interface Anrede {
  /** null = «Sie» */
  name: string | null;
}

export interface PkWegzugAnzeige {
  /** Statuszeile beim Feld «frühester Bezug laut Reglement» */
  text: string;
  /** Feld nur lesbar darstellen, weil es für das Ergebnis keine Rolle spielt */
  gesperrt: boolean;
}

/**
 * Text zur Statuszeile beim PK-Reglementsalter. Die Fallunterscheidung kommt aus der Simulation
 * (`pkWegzugStatus`), hier wird nur formuliert.
 */
export function pkWegzugAnzeige(
  s: PkWegzugStatus,
  anrede: Anrede,
  grenzen: { reglementFruehestens: number; aufschubBis: number },
): PkWegzugAnzeige {
  const sie = anrede.name === null;
  const wer = sie ? 'Sie' : anrede.name;
  const hoeren = sie ? 'hören' : 'hört';
  const ziehen = sie ? 'ziehen' : 'zieht';
  const arbeiten = sie ? 'arbeiten' : 'arbeitet';
  const f = Math.round(s.fruehestesMonate / 12);
  const stopp = `${wer} ${hoeren} mit ${fmtAlter(s.stoppMonate)} auf`;
  const weg = s.wegzugMonate;

  if (s.fall === 'landFehlt')
    return {
      text: 'Für die Barauszahlung beim Wegzug fehlt noch das Land (EU/EFTA oder nicht). Bis dahin wird ohne Barauszahlung gerechnet.',
      gesperrt: false,
    };

  if (s.fall === 'ohneWegzug' || s.fall === 'ohneBarauszahlung') {
    const vorspann = s.fall === 'ohneWegzug' ? 'Ohne Wegzug: ' : 'Wegzug ohne Barauszahlung: ';
    const kern =
      s.stoppMonate < s.fruehestesMonate
        ? `${stopp}, also vor dem frühesten Bezugsalter ${f}. Das Guthaben bleibt bis dahin gesperrt und wird weiter verzinst, ab ${fmtAlter(s.bezugMonate)} Rente oder Kapital nach Reglement.`
        : `${stopp}, also ${s.stoppMonate > s.fruehestesMonate ? 'nach dem' : 'ab dem'} frühesten Bezugsalter ${f}. Das gilt als Pensionierung: ab ${fmtAlter(s.bezugMonate)} Rente oder Kapital nach Reglement.`;
    return { text: vorspann + kern, gesperrt: false };
  }

  const wm = weg ?? 0;
  const ereignis =
    Math.floor(wm / 12) === Math.floor(s.stoppMonate / 12) && wm >= s.stoppMonate
      ? `${stopp} und ${ziehen} weg`
      : `${stopp} und ${ziehen} mit ${fmtAlter(wm)} weg`;

  if (s.fall === 'barauszahlung') {
    const bar = s.barVoll
      ? 'Das Guthaben wird beim Wegzug bar ausbezahlt'
      : `Beim Wegzug wird der überobligatorische Teil bar ausbezahlt, der obligatorische Teil bleibt auf einem Freizügigkeitskonto gesperrt (${s.euEfta ? 'EU/EFTA, ' : ''}Art. 25f FZG)`;
    if (s.feldOhneWirkung) {
      const warum =
        wm < grenzen.reglementFruehestens * 12
          ? `${ereignis}, also vor dem frühesten Bezugsalter.`
          : `${wer} ${ziehen} mit ${fmtAlter(wm)} weg und ${arbeiten} danach weiter, das gilt nicht als Pensionierung.`;
      return { text: `${warum} ${bar}, das Feld spielt hier keine Rolle.`, gesperrt: true };
    }
    return {
      text: `${ereignis}, also vor dem frühesten Bezugsalter ${f}. ${bar}. Mit einem Reglementsalter von ${s.grenzeReglementsalter} oder tiefer wäre es eine Pensionierung (Rente oder Kapital nach Reglement, keine Barauszahlung).`,
      gesperrt: false,
    };
  }

  // Pensionierung: Wegzug am/nach dem PK-Bezugsalter
  const lage = wm > s.fruehestesMonate ? 'nach dem' : 'ab dem';
  const grenze =
    s.grenzeReglementsalter < grenzen.aufschubBis
      ? `Mit einem Reglementsalter über ${s.grenzeReglementsalter} wäre eine Barauszahlung möglich.`
      : `Eine Barauszahlung wäre auch mit dem höchsten Reglementsalter ${grenzen.aufschubBis} nicht möglich.`;
  return {
    text: `${ereignis}, also ${lage} frühesten Bezugsalter ${f}. Das gilt als Pensionierung: Rente oder Kapital nach Reglement, keine Barauszahlung wegen Wegzug. ${grenze}`,
    gesperrt: false,
  };
}
