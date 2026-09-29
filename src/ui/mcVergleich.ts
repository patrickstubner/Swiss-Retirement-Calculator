/**
 * Hook für die Monte-Carlo-Kurzfassung im Szenario-Vergleich. Die Rechnung läuft in einem Web-Worker (die Oberfläche
 * bleibt bedienbar) und startet erst, wenn sich die Eingaben eine halbe Sekunde nicht mehr geändert haben. Ohne
 * Worker-Unterstützung läuft sie verzögert im Hauptthread. Veraltete Antworten werden verworfen.
 */
import { useEffect, useRef, useState } from 'react';
import type { Haushalt, Monat } from '../core/typen';
import { ladeRegeln } from '../rules';
import { type McKurz, vergleichsLaeufe, vergleichsMonteCarlo } from './mcKern';

export interface McAnfrage {
  id: number;
  jahr: number;
  monat: number;
  haushalte: Haushalt[];
  /** Gleiche Anzahl Läufe für beide Versionen (fairer Vergleich) */
  laeufe: number;
}

export type McAntwort = { id: number; ergebnisse: McKurz[] } | { id: number; fehler: string };

export interface McStand {
  /** Ergebnisse passend zu den aktuellen Eingaben; null solange nicht gerechnet oder veraltet */
  a: McKurz | null;
  b: McKurz | null;
  laeuft: boolean;
  fehler: string | null;
}

const LEER: McStand = { a: null, b: null, laeuft: false, fehler: null };
export const MC_VERZOEGERUNG_MS = 500;

export function useVergleichsMc(a: Haushalt | null, b: Haushalt | null, heute: Monat, aktiv: boolean): McStand {
  const [stand, setStand] = useState<{ a: Haushalt; b: Haushalt; s: McStand } | null>(null);
  const zaehler = useRef(0);

  useEffect(() => {
    if (!aktiv || !a || !b) return;
    const id = ++zaehler.current;
    const laeufe = vergleichsLaeufe(Math.max(a.krisen.mcLaeufe, b.krisen.mcLaeufe));
    let worker: Worker | null = null;
    let timer: number | null = null;
    const fertig = (s: McStand) => {
      if (id === zaehler.current) setStand({ a, b, s });
    };
    const t0 = window.setTimeout(() => {
      fertig({ ...LEER, laeuft: true });
      const anfrage: McAnfrage = { id, jahr: heute.jahr, monat: heute.monat, haushalte: [a, b], laeufe };
      try {
        worker = new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e: MessageEvent<McAntwort>) => {
          const m = e.data;
          if ('fehler' in m) fertig({ ...LEER, fehler: m.fehler });
          else fertig({ a: m.ergebnisse[0] ?? null, b: m.ergebnisse[1] ?? null, laeuft: false, fehler: null });
          worker?.terminate();
        };
        worker.onerror = () => fertig({ ...LEER, fehler: 'Die Monte-Carlo-Rechnung ist fehlgeschlagen.' });
        worker.postMessage(anfrage);
      } catch {
        // Kein Worker möglich: verzögert im Hauptthread rechnen
        timer = window.setTimeout(() => {
          try {
            const regeln = ladeRegeln(heute.jahr);
            const [ra, rb] = [a, b].map((h) => vergleichsMonteCarlo(h, regeln, heute, laeufe));
            fertig({ a: ra ?? null, b: rb ?? null, laeuft: false, fehler: null });
          } catch (x) {
            fertig({ ...LEER, fehler: x instanceof Error ? x.message : String(x) });
          }
        }, 30);
      }
    }, MC_VERZOEGERUNG_MS);
    return () => {
      window.clearTimeout(t0);
      if (timer !== null) window.clearTimeout(timer);
      worker?.terminate();
      zaehler.current++;
    };
  }, [a, b, heute, aktiv]);

  if (!aktiv || !a || !b) return LEER;
  if (stand && stand.a === a && stand.b === b) return stand.s;
  return { ...LEER, laeuft: true };
}
