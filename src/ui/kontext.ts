import type { SolverErgebnis } from '../core/solver';
import type { Haushalt, Monat, Person, SimulationsErgebnis } from '../core/typen';
import type { Regeln } from '../rules';

export type Setzer = (fn: (h: Haushalt) => Haushalt) => void;

export interface Berechnung {
  wunsch: SimulationsErgebnis | null;
  solver: SolverErgebnis | null;
  fehler: string | null;
  dauerMs: number;
}

export interface SchrittProps {
  h: Haushalt;
  setH: Setzer;
  regeln: Regeln;
  heute: Monat;
  berechnung: Berechnung;
}

export function setzePerson(setH: Setzer, i: number, fn: (p: Person) => Person): void {
  setH((h) => ({ ...h, personen: h.personen.map((p, j) => (j === i ? fn(p) : p)) }));
}

/** Alter in Monaten zu einem Zeitpunkt. */
export const alterMonate = (p: Person, m: Monat): number => (m.jahr - p.geburtsjahr) * 12 + (m.monat - p.geburtsmonat);
