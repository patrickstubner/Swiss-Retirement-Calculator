/**
 * Web-Worker: rechnet Monte-Carlo-Aufgaben (Szenario-Vergleich und volle Rechnung mit Fortschritt), ohne die
 * Oberfläche zu blockieren. Nachrichten: siehe `McNachricht` / `McRueckmeldung` in `mcKern.ts`. Abbrechen geschieht
 * durch Beenden des Workers (`terminate`) auf der Seite der Oberfläche.
 */
import { bearbeiteMcNachricht, type McNachricht, type McRueckmeldung } from './mcKern';

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<McNachricht>) => void) | null;
  postMessage: (m: McRueckmeldung) => void;
};

ctx.onmessage = (e) => bearbeiteMcNachricht(e.data, (m) => ctx.postMessage(m));
