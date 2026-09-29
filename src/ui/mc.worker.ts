/**
 * Web-Worker: rechnet die Monte-Carlo-Kurzfassung beider Versionen, ohne die Oberfläche zu blockieren.
 * Nachricht rein: {id, jahr, monat, haushalte: [effHaushaltA, effHaushaltB]}; raus: {id, ergebnisse} bzw. {id, fehler}.
 */
import { ladeRegeln } from '../rules';
import { vergleichsMonteCarlo } from './mcKern';
import type { McAnfrage, McAntwort } from './mcVergleich';

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<McAnfrage>) => void) | null;
  postMessage: (m: McAntwort) => void;
};

ctx.onmessage = (e) => {
  const { id, jahr, monat, haushalte, laeufe } = e.data;
  try {
    const regeln = ladeRegeln(jahr);
    const ergebnisse = haushalte.map((h) => vergleichsMonteCarlo(h, regeln, { jahr, monat }, laeufe));
    ctx.postMessage({ id, ergebnisse });
  } catch (x) {
    ctx.postMessage({ id, fehler: x instanceof Error ? x.message : String(x) });
  }
};
