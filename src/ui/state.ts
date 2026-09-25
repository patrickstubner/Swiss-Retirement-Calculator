/**
 * App-Zustand:
 * - localStorage (Standard: an): der ganze Zustand als EIN JSON-Objekt unter `STORAGE_KEY`
 *   mit Schema-Version. Beim Ausschalten werden dieser und alle früheren Schlüssel sofort
 *   gelöscht; übrig bleibt nur das Merkmal «aus» (`AUS_KEY`, ohne Finanzdaten).
 * - Teilen per Link: Zustand im URL-Fragment (#s=…, lz-string-komprimiert). Das Fragment wird
 *   nie an einen Server gesendet. Ein geteilter Link hat Vorrang vor dem localStorage.
 */
import LZString from 'lz-string';
import { ahvRenteSkala44, ahvTeilrente } from '../core/ahv';
import { detailwerte, SCHAETZ_FELDER } from '../core/schaetzwerte';
import type {
  Ausgaben,
  AuslandRente,
  BetragEinheit,
  EingabeModus,
  Haushalt,
  Indexierung,
  Monat,
  Person,
  PostenArt,
  SchaetzFeld,
} from '../core/typen';
import {
  MAX_PLANUNGSALTER,
  neueAusgabenPhase,
  neueAuslandRente,
  neuePerson,
  neuerPosten,
  neuesAusgabenEinzeljahr,
  neuesEreignis,
  standardHaushalt,
} from '../data/defaults';
import { kantonNach } from '../data/kantone';
import { wegzugsLand } from '../data/laender';
import type { Regeln } from '../rules';

/**
 * Version des Haushalt-Schemas (URL-Fragment und localStorage).
 * 2: Ausgabenphasen und Einzeljahr-Abweichungen (`ausgaben.phasen`, `ausgaben.einzeljahre`,
 *    `ausgaben.phasenBezug`, `ausgaben.phasenPerson`); Version 1 wird ohne Phasen übernommen.
 */
export const SCHEMA_VERSION = 2;
const HASH_PREFIX = '#s=';
/** Einziger Schlüssel mit Daten (ganzer Zustand als JSON). */
export const STORAGE_KEY = 'ruhestandsrechner:v1';
/** Merkmal «Speichern ausgeschaltet» (enthält keine Finanzdaten). */
export const AUS_KEY = 'ruhestandsrechner:speichern-aus';
/** Schlüssel früherer Versionen (Opt-in-Speicherung), werden migriert bzw. gelöscht. */
export const ALTE_KEYS = ['ruhestandsrechner:zustand', 'ruhestandsrechner:speichern'] as const;
/** Version des gespeicherten JSON-Objekts. */
export const SPEICHER_VERSION = 1;

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

function monat(m: Monat): Monat {
  return { jahr: Math.round(m.jahr), monat: Math.min(12, Math.max(1, Math.round(m.monat))) };
}

/**
 * Selbst eingegebene Werte. Zustände ohne `manuell` (vor dem Modus «Schnell») werden
 * übernommen: Werte ungleich dem Standard gelten als eigene Eingabe.
 */
function manuellAus(roh: unknown, p: Person, regeln: Regeln): Partial<Record<SchaetzFeld, true>> {
  const out: Partial<Record<SchaetzFeld, true>> = {};
  if (istObj(roh) && istObj(roh.manuell)) {
    const m = roh.manuell;
    for (const f of SCHAETZ_FELDER) if (m[f] === true) out[f] = true;
    return out;
  }
  if (p.ahv.renteMonat > 0) out.ahvRente = true;
  if (p.pk.guthaben > 0) out.pkGuthaben = true;
  if (p.pk.sparbeitragJahr > 0) out.pkSparbeitrag = true;
  if (Math.abs(p.pk.umwandlungssatz - regeln.bvg.mindestumwandlungssatz) > 1e-9) out.pkUmwandlungssatz = true;
  return out;
}

function person(roh: unknown, regeln: Regeln, i: number): Person {
  const p = mische(neuePerson(regeln, { name: `Person ${i + 1}` }), roh);
  const renten = istObj(roh) && Array.isArray(roh.auslandRenten) ? roh.auslandRenten : [];
  const w = p.wohnsitzAusland;
  return {
    ...p,
    geschlecht: p.geschlecht === 'w' ? 'w' : 'm',
    geburtsmonat: Math.min(12, Math.max(1, Math.round(p.geburtsmonat))),
    stoppModus: p.stoppModus === 'datum' ? 'datum' : 'alter',
    stoppDatum: monat(p.stoppDatum),
    wohnsitzAusland: {
      ...w,
      modus: w.modus === 'datum' ? 'datum' : 'alter',
      datum: monat(w.datum),
      land: wegzugsLand(w.land) ? w.land : '',
      nationalitaet: w.nationalitaet === 'EU' || w.nationalitaet === 'andere' ? w.nationalitaet : 'CH',
      sitzkantonVorsorge: kantonNach(w.sitzkantonVorsorge) ? w.sitzkantonVorsorge : '',
    },
    // Frühere Modi (Skala-44-Schätzung, BVG-Minimum) werden in direkte Eingaben überführt.
    ahv: {
      ...p.ahv,
      modus: 'eingabe',
      renteMonat:
        p.ahv.modus === 'skala44'
          ? Math.round(ahvTeilrente(ahvRenteSkala44(p.ahv.mdje, regeln.ahv), p.ahv.beitragsjahre, regeln.ahv))
          : p.ahv.renteMonat,
    },
    ahvSchaetzhilfe: {
      ...p.ahvSchaetzhilfe,
      beitragsModus: p.ahvSchaetzhilfe.beitragsModus === 'jahreCh' ? 'jahreCh' : 'luecken',
    },
    pk: { ...p.pk, beitragModus: 'eingabe' },
    auslandRenten: renten.slice(0, 10).map(auslandRente),
    inChSeit: p.inChSeit > 0 ? Math.min(2200, Math.max(1900, Math.round(p.inChSeit))) : 0,
  };
}

/** Macht einen (evtl. fremden oder alten) Zustand robust nutzbar. */
function personMitManuell(roh: unknown, regeln: Regeln, i: number): Person {
  const p = person(roh, regeln, i);
  return { ...p, manuell: manuellAus(roh, p, regeln) };
}

const ganzzahl = (x: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(x)));
const einheit = (x: unknown): BetragEinheit => (x === 'monat' ? 'monat' : 'jahr');

/** Ausgabenphasen/Einzeljahre (Schema 2); ältere Zustände haben keine → leere Listen. */
function normalisiereAusgaben(a: Ausgaben, roh: unknown, anzahl: number): Ausgaben {
  const r = istObj(roh) ? roh : {};
  const phasen = (Array.isArray(r.phasen) ? r.phasen : []).slice(0, 30).map((x) => {
    const ph = mische(neueAusgabenPhase(0, null), x);
    const von = ganzzahl(ph.von, 0, 9999);
    const bis = ph.bis === null ? null : Math.max(von, ganzzahl(ph.bis, 0, 9999));
    return { ...ph, von, bis, betrag: Math.max(0, ph.betrag), einheit: einheit(istObj(x) ? x.einheit : undefined) };
  });
  const gesehen = new Set<number>();
  const einzeljahre = (Array.isArray(r.einzeljahre) ? r.einzeljahre : [])
    .slice(0, 60)
    .map((x) => {
      const e = mische(neuesAusgabenEinzeljahr(0), x);
      return {
        ...e,
        jahr: ganzzahl(e.jahr, 1900, 9999),
        betrag: Math.max(0, e.betrag),
        einheit: einheit(istObj(x) ? x.einheit : undefined),
      };
    })
    .filter((e) => {
      if (gesehen.has(e.jahr)) return false;
      gesehen.add(e.jahr);
      return true;
    });
  return {
    ...a,
    phasenBezug: a.phasenBezug === 'alter' ? 'alter' : 'jahr',
    phasenPerson: ganzzahl(a.phasenPerson, 0, anzahl - 1),
    phasen,
    einzeljahre,
  };
}

export function normalisiere(roh: unknown, regeln: Regeln): Haushalt {
  const def = standardHaushalt(regeln);
  const h = mische(def, roh);
  const zivilstand = h.zivilstand === 'verheiratet' ? 'verheiratet' : 'alleinstehend';
  const rohPersonen = istObj(roh) && Array.isArray(roh.personen) ? roh.personen : [];
  const anzahl = zivilstand === 'verheiratet' ? 2 : 1;
  const personen = Array.from({ length: anzahl }, (_, i) =>
    rohPersonen[i] !== undefined
      ? personMitManuell(rohPersonen[i], regeln, i)
      : i === 0
        ? (def.personen[0] as Person)
        : neuePerson(regeln, { name: 'Person 2', geschlecht: 'w' }),
  );
  // Migrationen früherer Versionen: gemeinsames `freiesVermoegen` bzw. `vermoegen` pro Person → Wertschriften
  personen.forEach((p, i) => {
    const r = rohPersonen[i];
    if (istObj(r) && typeof r.vermoegen === 'number' && !('wertschriften' in r))
      personen[i] = { ...p, wertschriften: Math.max(0, r.vermoegen) };
  });
  const p0 = rohPersonen[0];
  if (istObj(roh) && typeof roh.freiesVermoegen === 'number' && personen[0] && !(istObj(p0) && 'wertschriften' in p0)) {
    personen[0] = { ...personen[0], wertschriften: Math.max(0, roh.freiesVermoegen) };
  }
  const posten = (istObj(roh) && Array.isArray(roh.posten) ? roh.posten : []).slice(0, 50).map((x) => {
    const art: PostenArt = istObj(x) && x.art === 'einnahme' ? 'einnahme' : 'ausgabe';
    const po = mische(neuerPosten(art), x);
    return {
      ...po,
      art,
      person: Math.min(anzahl - 1, Math.max(0, Math.round(po.person))),
      indexierung: indexierung(istObj(x) ? x.indexierung : undefined),
    };
  });
  const ereignisse = (istObj(roh) && Array.isArray(roh.ereignisse) ? roh.ereignisse : []).slice(0, 50).map((x) => {
    const ev = mische(neuesEreignis(), x);
    return { ...ev, person: Math.min(anzahl - 1, Math.max(0, Math.round(ev.person))) };
  });
  const ausgaben = normalisiereAusgaben(h.ausgaben, istObj(roh) ? roh.ausgaben : undefined, anzahl);
  const rohSteuern = istObj(roh) && istObj(roh.steuern) ? roh.steuern : {};
  const kirchen = ['reformiert', 'katholisch', 'christkatholisch'] as const;
  const steuern = {
    ...h.steuern,
    kirche: kirchen.find((k) => k === h.steuern.kirche) ?? ('keine' as const),
    // Frühere Versionen kannten nur eigene Sätze: diese beibehalten
    eigeneSaetze:
      'eigeneSaetze' in rohSteuern
        ? h.steuern.eigeneSaetze
        : h.steuern.einkommenSatz > 0 || h.steuern.vermoegenPromille > 0 || h.steuern.kapitalSatz > 0,
  };
  return {
    ...h,
    zivilstand,
    personen,
    posten,
    ereignisse,
    ausgaben,
    steuern,
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
    // Schema 1 → 2: Ausgabenphasen fehlen und werden in normalisiere() als leere Listen ergänzt.
    return normalisiere(g.h, regeln);
  } catch {
    return null;
  }
}

export function ausHash(hash: string, regeln: Regeln): Haushalt | null {
  return hash.startsWith(HASH_PREFIX) ? dekodiere(hash.slice(HASH_PREFIX.length), regeln) : null;
}

/** Link zum Teilen: aktuelle Adresse ohne Fragment + #s=… */
export function teilenLink(h: Haushalt, basis: string): string {
  return `${basis.split('#')[0]}${HASH_PREFIX}${kodiere(h)}`;
}

/** Entfernt das Fragment aus der Adresszeile (nach dem Laden eines geteilten Links). */
export function entferneHash(): void {
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

// ---------------------------------------------------------------------------------------
// localStorage

export type SuchModusZustand = 'gemeinsam' | 'p0' | 'p1';

/** Oberflächenzustand, der zusammen mit dem Haushalt gespeichert wird. */
export interface UiZustand {
  schritt: number;
  suchModus: SuchModusZustand;
  /** Eingabemodus; neu: «schnell», bisher gespeicherte Zustände: «detailliert» */
  modus: EingabeModus;
}

export interface AppZustand {
  haushalt: Haushalt;
  ui: UiZustand;
}

/** Aufbau des gespeicherten JSON-Objekts. */
interface SpeicherObjekt {
  app: 'ruhestandsrechner';
  version: number;
  /** Version des Haushalt-Schemas (wie im URL-Fragment) */
  schema: number;
  gespeichertAm: string;
  haushalt: Haushalt;
  ui: UiZustand;
}

export const STANDARD_UI: UiZustand = { schritt: 0, suchModus: 'gemeinsam', modus: 'schnell' };

function ui(roh: unknown): UiZustand {
  if (!istObj(roh)) return { ...STANDARD_UI, modus: 'detailliert' };
  const schritt = typeof roh.schritt === 'number' && Number.isFinite(roh.schritt) ? Math.round(roh.schritt) : 0;
  const suchModus = roh.suchModus === 'p0' || roh.suchModus === 'p1' ? roh.suchModus : 'gemeinsam';
  // Gespeicherte Zustände ohne Modus stammen aus der Zeit vor «Schnell» → Detailansicht beibehalten
  const modus: EingabeModus = roh.modus === 'schnell' ? 'schnell' : 'detailliert';
  return { schritt: Math.min(4, Math.max(0, schritt)), suchModus, modus };
}

/** Modus für einen geteilten Link: Detailansicht, wenn der Link Detailwerte enthält. */
export function modusFuerLink(h: Haushalt, regeln: Regeln): EingabeModus {
  return detailwerte(h, standardHaushalt(regeln)).length > 0 ? 'detailliert' : 'schnell';
}

export function browserSpeicher(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Speichern ist standardmässig an; aus nur, wenn das Merkmal «aus» gesetzt ist. */
export const speichernAktiv = (s: Storage | null): boolean => s !== null && s.getItem(AUS_KEY) !== '1';

/** Löscht alle gespeicherten Daten (aktueller und frühere Schlüssel). */
export function loescheLokal(s: Storage | null): void {
  if (!s) return;
  for (const k of [STORAGE_KEY, ...ALTE_KEYS]) s.removeItem(k);
}

export function speichereLokal(s: Storage | null, z: AppZustand): void {
  if (!s || !speichernAktiv(s)) return;
  const obj: SpeicherObjekt = {
    app: 'ruhestandsrechner',
    version: SPEICHER_VERSION,
    schema: SCHEMA_VERSION,
    gespeichertAm: new Date().toISOString(),
    haushalt: z.haushalt,
    ui: z.ui,
  };
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Speicher voll oder gesperrt: ignorieren (die App funktioniert auch ohne)
  }
}

/**
 * Liest den gespeicherten Zustand. Migriert einmalig die frühere Opt-in-Speicherung
 * (lz-komprimiert unter `ruhestandsrechner:zustand`) und löscht die alten Schlüssel.
 */
export function ladeLokal(s: Storage | null, regeln: Regeln): AppZustand | null {
  if (!s || !speichernAktiv(s)) return null;
  const roh = s.getItem(STORAGE_KEY);
  if (roh) {
    try {
      const obj: unknown = JSON.parse(roh);
      if (istObj(obj) && typeof obj.version === 'number' && istObj(obj.haushalt)) {
        // Migrationen künftiger Speicher-Versionen hier einfügen.
        return { haushalt: normalisiere(obj.haushalt, regeln), ui: ui(obj.ui) };
      }
    } catch {
      // defekter Eintrag → ignorieren
    }
    return null;
  }
  const alt = s.getItem(ALTE_KEYS[0]);
  if (alt) {
    const h = dekodiere(alt, regeln);
    for (const k of ALTE_KEYS) s.removeItem(k);
    if (h) {
      const z: AppZustand = { haushalt: h, ui: { ...STANDARD_UI, modus: 'detailliert' } };
      speichereLokal(s, z);
      return z;
    }
  }
  return null;
}

/** Schalter «Eingaben im Browser speichern». Aus: sofort alles löschen und nur das Merkmal merken. */
export function setzeSpeichern(s: Storage | null, aktiv: boolean, z: AppZustand): void {
  if (!s) return;
  if (aktiv) {
    s.removeItem(AUS_KEY);
    speichereLokal(s, z);
  } else {
    loescheLokal(s);
    s.setItem(AUS_KEY, '1');
  }
}

export type StartQuelle = 'link' | 'lokal' | 'standard';

export interface Start extends AppZustand {
  quelle: StartQuelle;
  /** Beim Start aus einem Link: der im Browser gespeicherte Zustand (falls vorhanden) */
  lokal: AppZustand | null;
}

/** Startzustand: geteilter Link (#s=…) > localStorage (falls an) > Standardwerte. */
export function ladeStartzustand(regeln: Regeln, hash: string, s: Storage | null): Start {
  const lokal = ladeLokal(s, regeln);
  const ausUrl = ausHash(hash, regeln);
  if (ausUrl)
    return { haushalt: ausUrl, ui: { ...STANDARD_UI, modus: modusFuerLink(ausUrl, regeln) }, quelle: 'link', lokal };
  if (lokal) return { ...lokal, quelle: 'lokal', lokal };
  return { haushalt: standardHaushalt(regeln), ui: STANDARD_UI, quelle: 'standard', lokal: null };
}
