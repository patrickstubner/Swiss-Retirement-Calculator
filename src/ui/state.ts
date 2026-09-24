/**
 * Zustand im URL-Fragment (#s=…, lz-string-komprimiert, versioniert) und optional im
 * localStorage (nur nach Opt-in). Das Fragment wird nie an einen Server gesendet.
 */
import LZString from 'lz-string';
import type { AuslandRente, Haushalt, Indexierung, Person } from '../core/typen';
import { MAX_PLANUNGSALTER, neueAuslandRente, neuePerson, standardHaushalt } from '../data/defaults';
import type { Regeln } from '../rules';

export const SCHEMA_VERSION = 1;
const HASH_PREFIX = '#s=';
const STORAGE_KEY = 'ruhestandsrechner:zustand';
const OPTIN_KEY = 'ruhestandsrechner:speichern';

interface Gespeichert {
  v: number;
  h: Haushalt;
}

type Obj = Record<string, unknown>;
const istObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Übernimmt aus `roh` nur Felder, die im Default existieren und denselben Typ haben. */
function mische<T>(def: T, roh: unknown): T {
  if (def === null) return (typeof roh === 'number' && Number.isFinite(roh) ? roh : null) as T;
  if (Array.isArray(def)) return def;
  if (istObj(def)) {
    if (!istObj(roh)) return def;
    const out: Obj = { ...def };
    for (const k of Object.keys(def)) out[k] = mische((def as Obj)[k], roh[k]);
    return out as T;
  }
  if (typeof def === 'number') return (typeof roh === 'number' && Number.isFinite(roh) ? roh : def) as T;
  return (typeof roh === typeof def ? roh : def) as T;
}

function indexierung(roh: unknown): Indexierung {
  if (istObj(roh)) {
    if (roh.art === 'keine') return { art: 'keine' };
    if (roh.art === 'satz' && typeof roh.satz === 'number' && Number.isFinite(roh.satz))
      return { art: 'satz', satz: roh.satz };
  }
  return { art: 'teuerung' };
}

function auslandRente(roh: unknown): AuslandRente {
  const r = mische(neueAuslandRente(), roh);
  return { ...r, indexierung: indexierung(istObj(roh) ? roh.indexierung : undefined) };
}

function person(roh: unknown, regeln: Regeln, i: number): Person {
  const p = mische(neuePerson(regeln, { name: `Person ${i + 1}` }), roh);
  const renten = istObj(roh) && Array.isArray(roh.auslandRenten) ? roh.auslandRenten : [];
  return {
    ...p,
    geschlecht: p.geschlecht === 'w' ? 'w' : 'm',
    geburtsmonat: Math.min(12, Math.max(1, Math.round(p.geburtsmonat))),
    ahv: { ...p.ahv, modus: p.ahv.modus === 'skala44' ? 'skala44' : 'eingabe' },
    pk: { ...p.pk, beitragModus: p.pk.beitragModus === 'bvgMinimum' ? 'bvgMinimum' : 'eingabe' },
    auslandRenten: renten.slice(0, 10).map(auslandRente),
  };
}

/** Macht einen (evtl. fremden oder alten) Zustand robust nutzbar. */
export function normalisiere(roh: unknown, regeln: Regeln): Haushalt {
  const def = standardHaushalt(regeln);
  const h = mische(def, roh);
  const zivilstand = h.zivilstand === 'verheiratet' ? 'verheiratet' : 'alleinstehend';
  const rohPersonen = istObj(roh) && Array.isArray(roh.personen) ? roh.personen : [];
  const anzahl = zivilstand === 'verheiratet' ? 2 : 1;
  const personen = Array.from({ length: anzahl }, (_, i) =>
    rohPersonen[i] !== undefined
      ? person(rohPersonen[i], regeln, i)
      : i === 0
        ? (def.personen[0] as Person)
        : neuePerson(regeln, { name: 'Person 2', geschlecht: 'w' }),
  );
  return {
    ...h,
    zivilstand,
    personen,
    planungsalter: Math.min(MAX_PLANUNGSALTER, Math.max(1, Math.round(h.planungsalter))),
    wohnsitz: { land: 'CH', wegzug: null },
  };
}

export function kodiere(h: Haushalt): string {
  const g: Gespeichert = { v: SCHEMA_VERSION, h };
  return LZString.compressToEncodedURIComponent(JSON.stringify(g));
}

export function dekodiere(s: string, regeln: Regeln): Haushalt | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const g: unknown = JSON.parse(json);
    if (!istObj(g) || typeof g.v !== 'number') return null;
    // Migrationen für künftige Schema-Versionen hier einfügen.
    return normalisiere(g.h, regeln);
  } catch {
    return null;
  }
}

export function ausHash(hash: string, regeln: Regeln): Haushalt | null {
  return hash.startsWith(HASH_PREFIX) ? dekodiere(hash.slice(HASH_PREFIX.length), regeln) : null;
}

export function schreibeHash(h: Haushalt): void {
  const neu = `${HASH_PREFIX}${kodiere(h)}`;
  if (window.location.hash !== neu) window.history.replaceState(null, '', neu);
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const speichernAktiv = (): boolean => storage()?.getItem(OPTIN_KEY) === '1';

export function setzeSpeichern(aktiv: boolean, h: Haushalt): void {
  const s = storage();
  if (!s) return;
  if (aktiv) {
    s.setItem(OPTIN_KEY, '1');
    s.setItem(STORAGE_KEY, kodiere(h));
  } else {
    s.removeItem(OPTIN_KEY);
    s.removeItem(STORAGE_KEY);
  }
}

export function speichereLokal(h: Haushalt): void {
  if (speichernAktiv()) storage()?.setItem(STORAGE_KEY, kodiere(h));
}

/** Startzustand: URL-Fragment > localStorage (nur mit Opt-in) > Standardwerte. */
export function ladeStartzustand(regeln: Regeln): Haushalt {
  const ausUrl = ausHash(window.location.hash, regeln);
  if (ausUrl) return ausUrl;
  if (speichernAktiv()) {
    const lokal = storage()?.getItem(STORAGE_KEY);
    const h = lokal ? dekodiere(lokal, regeln) : null;
    if (h) return h;
  }
  return standardHaushalt(regeln);
}
