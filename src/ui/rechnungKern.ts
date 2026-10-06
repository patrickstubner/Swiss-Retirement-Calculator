/**
 * Wunsch-Rechnung, Suche nach dem frühesten Rücktrittsalter, Sensitivität und die Szenarien der
 * Ergebnis-Seite. Dieselben Funktionen laufen im Web-Worker (`rechnung.worker.ts`) und, falls kein
 * Worker möglich ist, im Hauptthread. Deshalb bleiben die Zahlen gleich.
 */
import type { Schaetzung } from '../core/schaetzwerte';
import { type SensitivitaetErgebnis, sensitivitaet } from '../core/sensitivitaet';
import { simuliere } from '../core/simulation';
import { fruehestesRuecktrittsalter, type SolverErgebnis } from '../core/solver';
import type { Haushalt, Monat, SimulationsErgebnis } from '../core/typen';
import { neueKrisenAuswahl } from '../data/defaults';
import { krisenOptionen } from '../data/krisen';
import { ladeRegeln, type Regeln } from '../rules';
import type { Berechnung } from './kontext';

export type RechnungSuchModus = 'gemeinsam' | 'p0' | 'p1';

const STANDARD_KRISE = 'finanzkrise2007';

export interface AuswertungKennzahlen {
  wunsch: SimulationsErgebnis;
  solver: SolverErgebnis;
}

export interface SzenarioEingabe {
  name: string;
  haushalt: Haushalt;
}

export interface SzenarioZeile {
  name: string;
  k: AuswertungKennzahlen | null;
  planungsalter: number;
}

export type RechnungNachricht =
  | {
      art: 'suche';
      id: number;
      jahr: number;
      monat: number;
      haushalt: Haushalt;
      suchModus: RechnungSuchModus;
    }
  | {
      art: 'genauigkeit';
      id: number;
      jahr: number;
      monat: number;
      haushalt: Haushalt;
      schaetzungen: Schaetzung[];
      suchModus: RechnungSuchModus;
    }
  | {
      art: 'auswertung';
      id: number;
      jahr: number;
      monat: number;
      haushalt: Haushalt;
      suchModus: RechnungSuchModus;
    }
  | {
      art: 'szenarien';
      id: number;
      jahr: number;
      monat: number;
      eingaben: SzenarioEingabe[];
      suchModus: RechnungSuchModus;
    };

export type RechnungRueckmeldung =
  | { art: 'suche'; id: number; berechnung: Berechnung }
  | { art: 'genauigkeit'; id: number; ergebnis: SensitivitaetErgebnis }
  | { art: 'auswertung'; id: number; kennzahlen: AuswertungKennzahlen }
  | { art: 'szenarien'; id: number; zeilen: SzenarioZeile[] }
  | { art: 'fehler'; id: number; fehler: string };

function personIndex(h: Haushalt, suchModus: RechnungSuchModus): number {
  return suchModus === 'p1' && h.personen.length > 1 ? 1 : 0;
}

/** Wunsch-Rücktritt und frühestes Alter, wie bisher `App.berechne`. */
export function seitenSuche(h: Haushalt, regeln: Regeln, heute: Monat, suchModus: RechnungSuchModus): Berechnung {
  const t0 = performance.now();
  try {
    const krisen = krisenOptionen(h);
    const wunsch = simuliere(h, regeln, { start: heute, krisen });
    const person = personIndex(h, suchModus);
    const solver = fruehestesRuecktrittsalter(h, regeln, {
      start: heute,
      krisen,
      modus: suchModus === 'gemeinsam' ? 'gemeinsam' : 'person',
      person,
      maxAlter: 70,
    });
    return { wunsch, solver, fehler: null, dauerMs: performance.now() - t0 };
  } catch (e) {
    return {
      wunsch: null,
      solver: null,
      fehler: e instanceof Error ? e.message : String(e),
      dauerMs: performance.now() - t0,
    };
  }
}

/** Sensitivität wie die Karte «Genauigkeit»: ohne Krisenoption, dieselbe Suche. */
export function seitenGenauigkeit(
  h: Haushalt,
  schaetzungen: readonly Schaetzung[],
  regeln: Regeln,
  heute: Monat,
  suchModus: RechnungSuchModus,
): SensitivitaetErgebnis {
  return sensitivitaet(h, schaetzungen, regeln, {
    start: heute,
    modus: suchModus === 'gemeinsam' ? 'gemeinsam' : 'person',
    person: personIndex(h, suchModus),
  });
}

/** «Was wäre, wenn»: Wunsch-Rücktritt und frühestes Alter. */
export function auswertungRechnung(
  h: Haushalt,
  regeln: Regeln,
  start: Monat,
  modus: RechnungSuchModus,
): AuswertungKennzahlen {
  const krisen = krisenOptionen(h);
  const wunsch = simuliere(h, regeln, { start, krisen });
  const solver = fruehestesRuecktrittsalter(h, regeln, {
    start,
    krisen,
    modus: modus === 'gemeinsam' ? 'gemeinsam' : 'person',
    person: personIndex(h, modus),
    maxAlter: 70,
  });
  return { wunsch, solver };
}

/**
 * Szenarien nebeneinander: Ihr Szenario, Krise ja/nein, und bei Pensionskasse alles Kapital / alles Rente.
 * Gleiche Liste wie bisher in der Auswertung.
 */
export function szenarioEingaben(hw: Haushalt, heuteJahr: number): SzenarioEingabe[] {
  const mitKrise = krisenOptionen(hw) !== undefined;
  const krisenVariante: Haushalt = mitKrise
    ? { ...hw, krisen: { ...hw.krisen, modus: 'keine' } }
    : {
        ...hw,
        krisen: {
          ...hw.krisen,
          modus: 'individuell',
          auswahl: [neueKrisenAuswahl(STANDARD_KRISE, 'CHE', heuteJahr + 1)],
        },
      };
  const pkMix = (anteil: number): Haushalt => ({
    ...hw,
    personen: hw.personen.map((p) => ({ ...p, pk: { ...p.pk, kapitalanteil: anteil } })),
  });
  const liste: SzenarioEingabe[] = [
    { name: 'Ihr Szenario', haushalt: hw },
    { name: mitKrise ? 'Ohne Krise' : 'Finanzkrise beim Rücktritt', haushalt: krisenVariante },
  ];
  if (hw.personen.some((p) => p.pk.guthaben > 0 || p.pk.sparbeitragJahr > 0)) {
    liste.push({ name: 'PK ganz als Kapital', haushalt: pkMix(1) }, { name: 'PK ganz als Rente', haushalt: pkMix(0) });
  }
  return liste;
}

export function szenarienRechnung(
  eingaben: readonly SzenarioEingabe[],
  regeln: Regeln,
  heute: Monat,
  suchModus: RechnungSuchModus,
): SzenarioZeile[] {
  return eingaben.map((s) => {
    try {
      return {
        name: s.name,
        k: auswertungRechnung(s.haushalt, regeln, heute, suchModus),
        planungsalter: s.haushalt.planungsalter,
      };
    } catch {
      return { name: s.name, k: null, planungsalter: s.haushalt.planungsalter };
    }
  });
}

/**
 * Alles, was die Ergebnis-Seite bei einer Neuberechnung anstösst: Wunsch und Suche, Sensitivität,
 * «Was wäre, wenn» und die Szenarien. Nacheinander, damit ein Test die Summe messen kann.
 * Die Seite selbst verteilt dieselben Aufrufe auf Web-Worker.
 */
export function ganzeSeitenrechnung(
  h: Haushalt,
  schaetzungen: readonly Schaetzung[],
  regeln: Regeln,
  heute: Monat,
  suchModus: RechnungSuchModus,
): {
  suche: Berechnung;
  sens: SensitivitaetErgebnis;
  auswertung: AuswertungKennzahlen;
  szenarien: SzenarioZeile[];
  dauerMs: number;
} {
  const t0 = performance.now();
  const suche = seitenSuche(h, regeln, heute, suchModus);
  const sens = seitenGenauigkeit(h, schaetzungen, regeln, heute, suchModus);
  const auswertung = auswertungRechnung(h, regeln, heute, suchModus);
  const szenarien = szenarienRechnung(szenarioEingaben(h, heute.jahr), regeln, heute, suchModus);
  return { suche, sens, auswertung, szenarien, dauerMs: performance.now() - t0 };
}

/** Eine Anfrage bearbeiten. Gleiche Stelle für den Worker und den Ersatz im Hauptthread. */
export function bearbeiteRechnung(n: RechnungNachricht, senden: (m: RechnungRueckmeldung) => void): void {
  try {
    const regeln = ladeRegeln(n.jahr);
    const heute: Monat = { jahr: n.jahr, monat: n.monat };
    if (n.art === 'suche') {
      senden({ art: 'suche', id: n.id, berechnung: seitenSuche(n.haushalt, regeln, heute, n.suchModus) });
    } else if (n.art === 'genauigkeit') {
      senden({
        art: 'genauigkeit',
        id: n.id,
        ergebnis: seitenGenauigkeit(n.haushalt, n.schaetzungen, regeln, heute, n.suchModus),
      });
    } else if (n.art === 'auswertung') {
      senden({
        art: 'auswertung',
        id: n.id,
        kennzahlen: auswertungRechnung(n.haushalt, regeln, heute, n.suchModus),
      });
    } else {
      senden({
        art: 'szenarien',
        id: n.id,
        zeilen: szenarienRechnung(n.eingaben, regeln, heute, n.suchModus),
      });
    }
  } catch (x) {
    senden({ art: 'fehler', id: n.id, fehler: x instanceof Error ? x.message : String(x) });
  }
}
