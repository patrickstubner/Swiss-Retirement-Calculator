/**
 * Startet eine Monte-Carlo-Aufgabe in einem Web-Worker (Oberfläche bleibt bedienbar) und kennt den Ersatz im
 * Hauptthread, falls kein Worker möglich ist (Browser ohne Worker, blockierte Worker-Datei, Fehler beim Start).
 * Beide Wege rufen dieselbe Funktion `bearbeiteMcNachricht` auf, daher sind die Ergebnisse bei gleichem Seed gleich.
 *
 * Abbrechen: `abbrechen()` beendet den Worker sofort. Im Ersatz im Hauptthread lässt sich nur der noch nicht
 * gestartete Lauf abbrechen (die Rechnung selbst ist dort nicht unterbrechbar).
 */
import { bearbeiteMcNachricht, type McNachricht, type McRueckmeldung } from './mcKern';

export interface McLauf {
  abbrechen: () => void;
}

/** Verzögerung vor dem Ersatz im Hauptthread, damit die Oberfläche zuerst „Rechnet …“ zeigen kann */
export const MC_ERSATZ_VERZOEGERUNG_MS = 30;

export function workerMoeglich(): boolean {
  return typeof Worker !== 'undefined';
}

export function starteMc(nachricht: McNachricht, rueckmeldung: (m: McRueckmeldung) => void): McLauf {
  let beendet = false;
  let worker: Worker | null = null;
  let timer: number | null = null;
  const melde = (m: McRueckmeldung) => {
    if (beendet) return;
    if (m.art !== 'fortschritt') {
      beendet = true;
      worker?.terminate();
      worker = null;
    }
    rueckmeldung(m);
  };
  const imHauptthread = () => {
    timer = setTimeout(() => bearbeiteMcNachricht(nachricht, melde), MC_ERSATZ_VERZOEGERUNG_MS) as unknown as number;
  };
  if (workerMoeglich()) {
    try {
      worker = new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<McRueckmeldung>) => melde(e.data);
      worker.onerror = () => {
        // Worker konnte nicht laufen (z. B. Datei blockiert): einmalig im Hauptthread weiterrechnen
        worker?.terminate();
        worker = null;
        if (!beendet) imHauptthread();
      };
      worker.postMessage(nachricht);
    } catch {
      worker = null;
      imHauptthread();
    }
  } else {
    imHauptthread();
  }
  return {
    abbrechen: () => {
      beendet = true;
      worker?.terminate();
      worker = null;
      if (timer !== null) clearTimeout(timer);
    },
  };
}
