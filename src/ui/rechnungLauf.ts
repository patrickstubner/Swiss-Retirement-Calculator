/**
 * Startet Suche, Sensitivität oder Szenarien in einem Web-Worker. Fällt der Worker aus, rechnet
 * dieselbe Funktion verzögert im Hauptthread. Abbrechen beendet den Worker sofort; eine Meldung
 * danach wird verworfen, damit eine neuere Eingabe die ältere nicht überschreibt.
 */
import { useEffect, useRef, useState } from 'react';
import { bearbeiteRechnung, type RechnungNachricht, type RechnungRueckmeldung } from './rechnungKern';

export interface RechnungLauf {
  abbrechen: () => void;
}

/** Verzögerung vor dem Ersatz im Hauptthread, damit die Oberfläche zuerst «Rechnet …» zeigen kann. */
export const RECHNUNG_ERSATZ_VERZOEGERUNG_MS = 30;

export function workerMoeglich(): boolean {
  return typeof Worker !== 'undefined';
}

export function starteRechnung(
  nachricht: RechnungNachricht,
  rueckmeldung: (m: RechnungRueckmeldung) => void,
): RechnungLauf {
  let beendet = false;
  let worker: Worker | null = null;
  let timer: number | null = null;
  const melde = (m: RechnungRueckmeldung) => {
    if (beendet) return;
    beendet = true;
    worker?.terminate();
    worker = null;
    rueckmeldung(m);
  };
  const imHauptthread = () => {
    timer = setTimeout(() => bearbeiteRechnung(nachricht, melde), RECHNUNG_ERSATZ_VERZOEGERUNG_MS) as unknown as number;
  };
  if (workerMoeglich()) {
    try {
      worker = new Worker(new URL('./rechnung.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<RechnungRueckmeldung>) => melde(e.data);
      worker.onerror = () => {
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

export interface RechnungStand<T> {
  wert: T | null;
  /** true, solange die aktuelle Eingabe noch nicht zurück ist */
  laeuft: boolean;
  fehler: string | null;
}

/**
 * Rechnung zu einer memoisierten Nachricht (`id` wird ersetzt). Eine neue Nachricht bricht die laufende ab.
 * Das letzte Ergebnis bleibt stehen, bis das neue da ist.
 */
export function useRechnung<T>(
  vorlage: RechnungNachricht | null,
  lies: (m: RechnungRueckmeldung) => T | undefined,
): RechnungStand<T> {
  const [wert, setWert] = useState<T | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const seq = useRef(0);
  const liesRef = useRef(lies);
  liesRef.current = lies;

  useEffect(() => {
    if (!vorlage) {
      setWert(null);
      setLaeuft(false);
      setFehler(null);
      return;
    }
    const id = ++seq.current;
    setLaeuft(true);
    setFehler(null);
    const lauf = starteRechnung({ ...vorlage, id }, (m) => {
      if (m.id !== id || id !== seq.current) return;
      if (m.art === 'fehler') {
        setFehler(m.fehler);
        setWert(null);
        setLaeuft(false);
        return;
      }
      const v = liesRef.current(m);
      if (v === undefined) return;
      setWert(v);
      setLaeuft(false);
    });
    return () => {
      seq.current++;
      lauf.abbrechen();
    };
  }, [vorlage]);

  return { wert, laeuft, fehler };
}
