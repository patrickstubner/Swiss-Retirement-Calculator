/**
 * Hook für die Monte-Carlo-Kurzfassung im Szenario-Vergleich. Die Rechnung läuft in einem Web-Worker (die Oberfläche
 * bleibt bedienbar) und startet erst, wenn sich die Eingaben eine halbe Sekunde nicht mehr geändert haben. Ohne
 * Worker-Unterstützung läuft sie verzögert im Hauptthread. Veraltete Antworten werden verworfen.
 */
import { useEffect, useRef, useState } from 'react';
import type { MonteCarloErgebnis } from '../core/montecarlo';
import type { Haushalt, Monat } from '../core/typen';
import { type McEinstellung, type McKurz, vergleichsLaeufe } from './mcKern';
import { starteMc } from './mcLauf';

export interface McAnfrage {
  id: number;
  jahr: number;
  monat: number;
  haushalte: Haushalt[];
  /** Gleiche Anzahl Läufe für beide Versionen (fairer Vergleich) */
  laeufe: number;
}

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
    let lauf: { abbrechen: () => void } | null = null;
    const fertig = (s: McStand) => {
      if (id === zaehler.current) setStand({ a, b, s });
    };
    const t0 = window.setTimeout(() => {
      fertig({ ...LEER, laeuft: true });
      lauf = starteMc(
        { art: 'vergleich', id, jahr: heute.jahr, monat: heute.monat, haushalte: [a, b], laeufe },
        (m) => {
          if (m.art === 'vergleich')
            fertig({ a: m.ergebnisse[0] ?? null, b: m.ergebnisse[1] ?? null, laeuft: false, fehler: null });
          else if (m.art === 'fehler') fertig({ ...LEER, fehler: m.fehler });
        },
      );
    }, MC_VERZOEGERUNG_MS);
    return () => {
      window.clearTimeout(t0);
      lauf?.abbrechen();
      zaehler.current++;
    };
  }, [a, b, heute, aktiv]);

  if (!aktiv || !a || !b) return LEER;
  if (stand && stand.a === a && stand.b === b) return stand.s;
  return { ...LEER, laeuft: true };
}

export interface VollStand {
  /** Ergebnis passend zu den aktuellen Eingaben; null solange nicht gerechnet, veraltet oder abgebrochen */
  ergebnis: MonteCarloErgebnis | null;
  laeuft: boolean;
  /** 0–1, nur während der Rechnung */
  fortschritt: number;
  abgebrochen: boolean;
  fehler: string | null;
  abbrechen: () => void;
  neuStarten: () => void;
}

export const MC_VOLL_VERZOEGERUNG_MS = 250;

/**
 * Volle Monte-Carlo-Rechnung im Web-Worker mit Fortschritt und Abbruch. `einstellung = null` heisst «aus».
 * `haushalt` und `einstellung` müssen stabil sein (useMemo / useDeferredValue), sonst startet jede Darstellung neu.
 */
export function useVollMc(haushalt: Haushalt, heute: Monat, einstellung: McEinstellung | null): VollStand {
  type Intern = {
    h: Haushalt;
    e: McEinstellung;
    ergebnis: MonteCarloErgebnis | null;
    fortschritt: number;
    abgebrochen: boolean;
    fehler: string | null;
  };
  const [intern, setIntern] = useState<Intern | null>(null);
  const [nochmal, setNochmal] = useState(0);
  const aktuell = useRef<{ abbrechen: () => void } | null>(null);
  const zaehler = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `nochmal` löst bewusst einen erneuten Start aus
  useEffect(() => {
    if (!einstellung) return;
    const id = ++zaehler.current;
    const setze = (t: Partial<Intern>) => {
      if (id === zaehler.current)
        setIntern((alt) => ({
          h: haushalt,
          e: einstellung,
          ergebnis: null,
          fortschritt: 0,
          abgebrochen: false,
          fehler: null,
          ...(alt && alt.h === haushalt && alt.e === einstellung ? alt : {}),
          ...t,
        }));
    };
    const t0 = window.setTimeout(() => {
      setze({ ergebnis: null, fortschritt: 0, abgebrochen: false, fehler: null });
      aktuell.current = starteMc(
        { art: 'voll', id, jahr: heute.jahr, monat: heute.monat, haushalt, einstellung },
        (m) => {
          if (m.art === 'fortschritt') setze({ fortschritt: m.fertig / m.von });
          else if (m.art === 'voll') setze({ ergebnis: m.ergebnis, fortschritt: 1 });
          else if (m.art === 'fehler') setze({ fehler: m.fehler });
        },
      );
    }, MC_VOLL_VERZOEGERUNG_MS);
    return () => {
      window.clearTimeout(t0);
      aktuell.current?.abbrechen();
      aktuell.current = null;
      zaehler.current++;
    };
  }, [haushalt, heute, einstellung, nochmal]);

  const abbrechen = () => {
    aktuell.current?.abbrechen();
    aktuell.current = null;
    zaehler.current++;
    if (einstellung)
      setIntern({ h: haushalt, e: einstellung, ergebnis: null, fortschritt: 0, abgebrochen: true, fehler: null });
  };
  const neuStarten = () => setNochmal((n) => n + 1);

  const passt = einstellung !== null && intern !== null && intern.h === haushalt && intern.e === einstellung;
  const i = passt ? intern : null;
  return {
    ergebnis: i?.ergebnis ?? null,
    laeuft: einstellung !== null && !i?.ergebnis && !i?.abgebrochen && !i?.fehler,
    fortschritt: i?.fortschritt ?? 0,
    abgebrochen: i?.abgebrochen ?? false,
    fehler: i?.fehler ?? null,
    abbrechen,
    neuStarten,
  };
}
