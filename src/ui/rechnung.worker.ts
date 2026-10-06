/**
 * Web-Worker für Suche, Sensitivität, «Was wäre, wenn» und die Szenarien. Die Oberfläche bleibt
 * bedienbar. Abbrechen geschieht durch Beenden des Workers.
 */
import { bearbeiteRechnung, type RechnungNachricht, type RechnungRueckmeldung } from './rechnungKern';

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<RechnungNachricht>) => void) | null;
  postMessage: (m: RechnungRueckmeldung) => void;
};

ctx.onmessage = (e) => bearbeiteRechnung(e.data, (m) => ctx.postMessage(m));
