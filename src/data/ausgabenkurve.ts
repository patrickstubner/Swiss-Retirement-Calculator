/**
 * Empirische Ausgabenkurve im Ruhestand (Go-go / Slow-go / No-go) und Pflegeheim-Reserve.
 * Daten und Quellen: data/ausgabenkurve-2026.json, Herleitung in docs/quellen.md Abschnitt 14.
 */
import kurveJson from '../../data/ausgabenkurve-2026.json';
import type { Ausgabenkurve } from '../core/umkehr';

export interface KurvenQuelle {
  titel: string;
  url: string;
  stand: string;
}

export const AUSGABENKURVE_STAND: string = kurveJson.stand;

export const AUSGABENKURVE: Ausgabenkurve = {
  phasen: kurveJson.phasen.map((p) => ({ id: p.id, label: p.label, bisAlter: p.bisAlter, anteil: p.anteil })),
  pflegeBetragJahr: kurveJson.pflege.betragJahr,
  pflegeJahre: kurveJson.pflege.jahre,
};

export const AUSGABENKURVE_HERLEITUNG: { id: string; label: string; herleitung: string; status: string }[] = [
  ...kurveJson.phasen.map((p) => ({ id: p.id, label: p.label, herleitung: p.herleitung, status: p.status })),
  { id: 'pflege', label: 'Pflegeheim', herleitung: kurveJson.pflege.herleitung, status: kurveJson.pflege.status },
];

export const AUSGABENKURVE_QUELLEN: KurvenQuelle[] = kurveJson.quellen;
