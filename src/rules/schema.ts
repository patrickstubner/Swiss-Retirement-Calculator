/**
 * Schema des Regel-Layers: Jeder Blattwert in rules/<jahr>.json ist ein Regelwert
 * mit Wert, Quelle, Stand und Status (verifiziert/offen).
 */
export type RegelStatus = 'verifiziert' | 'offen';

export interface Regelwert<T = unknown> {
  value: T;
  einheit?: string;
  source: string;
  stand: string;
  status: RegelStatus;
  hinweis?: string;
}

/** Wandelt eine Regel-Baumstruktur in eine reine Werte-Struktur um (nur `value`). */
export type Werte<T> = T extends { value: infer V; status: string }
  ? V
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]: Werte<T[K]> }
      : T;

export interface RegelEintrag extends Regelwert {
  /** Punkt-Pfad, z.B. "ahv.maximalrenteMonat" */
  pfad: string;
}

function istObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function istRegelwert(x: unknown): x is Regelwert {
  return istObjekt(x) && 'value' in x && 'status' in x;
}

/**
 * Prüft die Struktur einer Regeldatei. Gibt eine Liste von Fehlermeldungen zurück
 * (leer = gültig). Der Abschnitt `meta` wird nicht als Regelbaum geprüft.
 */
export function pruefeRegeln(json: unknown): string[] {
  const fehler: string[] = [];
  if (!istObjekt(json)) return ['Regeldatei ist kein Objekt'];
  const meta = json.meta;
  if (!istObjekt(meta) || typeof meta.jahr !== 'number') fehler.push('meta.jahr fehlt');

  const besuche = (knoten: unknown, pfad: string): void => {
    if (istRegelwert(knoten)) {
      if (typeof knoten.source !== 'string' || knoten.source.length === 0) fehler.push(`${pfad}: source fehlt`);
      if (typeof knoten.stand !== 'string' || knoten.stand.length === 0) fehler.push(`${pfad}: stand fehlt`);
      if (knoten.status !== 'verifiziert' && knoten.status !== 'offen')
        fehler.push(`${pfad}: ungültiger status '${String(knoten.status)}'`);
      return;
    }
    if (!istObjekt(knoten)) {
      fehler.push(`${pfad}: weder Gruppe noch Regelwert`);
      return;
    }
    for (const [k, v] of Object.entries(knoten)) besuche(v, pfad ? `${pfad}.${k}` : k);
  };

  for (const [k, v] of Object.entries(json)) {
    if (k === 'meta') continue;
    besuche(v, k);
  }
  return fehler;
}

/** Extrahiert rekursiv nur die Werte. */
export function extrahiereWerte<T>(json: T): Werte<T> {
  const walk = (knoten: unknown): unknown => {
    if (istRegelwert(knoten)) return knoten.value;
    if (istObjekt(knoten)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(knoten)) out[k] = walk(v);
      return out;
    }
    return knoten;
  };
  return walk(json) as Werte<T>;
}

/** Flache Liste aller Regelwerte (für «Wie gerechnet?» und Quellenansicht). */
export function flacheRegeln(json: unknown): RegelEintrag[] {
  const liste: RegelEintrag[] = [];
  const besuche = (knoten: unknown, pfad: string): void => {
    if (istRegelwert(knoten)) {
      liste.push({ ...knoten, pfad });
      return;
    }
    if (istObjekt(knoten)) {
      for (const [k, v] of Object.entries(knoten)) {
        if (!pfad && k === 'meta') continue;
        besuche(v, pfad ? `${pfad}.${k}` : k);
      }
    }
  };
  besuche(json, '');
  return liste;
}
