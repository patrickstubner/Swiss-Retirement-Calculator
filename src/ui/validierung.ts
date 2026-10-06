/**
 * Zentrales Validierungsschema (Audit A1, S-01/S-03/S-04/S-05/S-08): Jeder Zahlenwert des Haushalts hat hier
 * einen Bereich, den die Eingabefelder der Oberfläche bereits erzwingen. Werte aus geteilten Links, importierten
 * Dateien und dem localStorage werden nach `normalisiere` durch `begrenze` geklemmt. Damit gibt es keine
 * nicht endlichen Zahlen, keine absurden Zeiträume (Heap-Überlauf) und keine überlangen Texte.
 *
 * Pfade: Array-Indizes stehen als `*` (z.B. `personen.*.pk.zins`). Ein Zahlenfeld ohne Eintrag wird auf
 * ±ALLGEMEIN_MAX geklemmt (Notnetz); ein Test verlangt für alle Felder der Standardwerte einen Eintrag.
 */
import { ahvWeitesterVorbezugMonate } from '../core/ahv';
import { JAHRE_NACH_MAX, JAHRE_NACH_MIN } from '../core/krisen';
import { ladeRegeln, VERFUEGBARE_JAHRE } from '../rules';

/** Höchstlänge eines Links (`#s=…`), Zeichen. Ein Link mit vollem Haushalt umfasst rund 3'000 Zeichen. */
export const MAX_HASH_LAENGE = 20_000;
/** Höchstlänge des entpackten JSON (Link, localStorage, Import), Zeichen. */
export const MAX_JSON_LAENGE = 1_000_000;
/** Höchstgrösse einer Importdatei, Bytes. */
export const MAX_IMPORT_BYTES = 1_000_000;
/** Höchstlänge von Texten (Namen, Bezeichnungen), Zeichen. */
export const MAX_TEXT = 100;
/** Notnetz für Zahlenfelder ohne eigenen Bereich. */
export const ALLGEMEIN_MAX = 1e12;

type Bereich = readonly [min: number, max: number, ganz?: true];

const JAHR_MAX = () => new Date().getFullYear();

/**
 * Untergrenze der AHV-Bezugsverschiebung (negativ = Vorbezug). Abgeleitet aus den Regeln:
 * höchstes Referenzalter in Monaten minus frühestes Übergangsalter × 12, über alle Regeljahre.
 * Eine feste −24 würde den gesetzlichen Vorbezug der Übergangsgeneration (bis 36 Monate) beim Laden kürzen.
 */
export const AHV_VERSCHIEBUNG_MIN = -Math.max(
  0,
  ...VERFUEGBARE_JAHRE.map((j) => ahvWeitesterVorbezugMonate(ladeRegeln(j).ahv)),
);

/** Bereich je Pfad; `geburtsjahr` hängt vom aktuellen Jahr ab und wird in `bereichFuer` ergänzt. */
export const GRENZEN: Readonly<Record<string, Bereich>> = {
  planungsalter: [1, 999, true],
  'ausgaben.lebenshaltung': [0, 1e8],
  'ausgaben.faktorAb75': [0, 3],
  'ausgaben.faktorAb85': [0, 5],
  'ausgaben.phasenPerson': [0, 1, true],
  'ausgaben.phasen.*.von': [0, 9999, true],
  'ausgaben.phasen.*.bis': [0, 9999, true],
  'ausgaben.phasen.*.betrag': [0, 1e8],
  'ausgaben.einzeljahre.*.jahr': [1900, 9999, true],
  'ausgaben.einzeljahre.*.betrag': [0, 1e8],
  'annahmen.renditeNominal': [-0.2, 0.3],
  'annahmen.aktienanteil': [0, 1],
  'annahmen.renditeBargeld': [-0.05, 0.2],
  'annahmen.inflation': [-0.05, 0.2],
  'annahmen.kosten': [0, 0.05],
  'annahmen.ahvAnpassungReal': [-0.05, 0.05],
  'annahmen.steuerbarerErtrag': [0, 0.2],
  'annahmen.neVerwaltungskosten': [0, 0.05],
  'krisen.autoProDekade': [0.1, 5],
  'krisen.autoStartJahr': [1900, 2200, true],
  'krisen.autoJahreNach': [-30, 60, true],
  'krisen.mcKrisenProDekade': [0, 10],
  'krisen.mcLaeufe': [50, 2000, true],
  'krisen.mcBlockLaenge': [1, 20, true],
  'krisen.auswahl.*.jahr': [1900, 2200, true],
  'krisen.auswahl.*.alter': [0, 130, true],
  'krisen.auswahl.*.person': [0, 1, true],
  'krisen.auswahl.*.jahreNach': [JAHRE_NACH_MIN, JAHRE_NACH_MAX, true],
  'krisen.auswahl.*.monat': [1, 12, true],
  'krisen.auswahl.*.eigen.rueckgang': [-0.8, -0.05],
  'krisen.auswahl.*.eigen.dauer': [1, 8, true],
  'krisen.auswahl.*.eigen.erholung': [0, 15, true],
  'steuern.einkommenSatz': [0, 0.5],
  'steuern.vermoegenPromille': [0, 20],
  'steuern.kapitalSatz': [0, 0.3],
  'wohnen.mieteMonat': [0, 1e6],
  'todesfall.person': [0, 1, true],
  'todesfall.alter': [0, 120],
  'todesfall.jahr': [1900, 2300, true],
  'todesfall.ausgabenFaktor': [0.1, 1.5],
  'todesfall.ehejahre': [0, 80],
  'staffelung.jahre': [1, 10, true],
  'entnahme.satz': [-0.2, 0.2],
  'entnahme.aktienReal': [-0.2, 0.2],
  'entnahme.obligationenReal': [-0.2, 0.2],
  'entnahme.pufferMonateStart': [0, 240],
  'entnahme.pufferMonateZiel': [0, 240],
  'entnahme.aufbauJahre': [0, 40],
  'entnahme.keinVerkaufUnter': [-0.8, 0.5],
  'entnahme.anzahl': [2, 3, true],
  'entnahme.stufen.*.abWachstum': [-1, 1],
  'entnahme.stufen.*.satz': [0, 0.2],
  'entnahme.toepfe.*.anteil': [0, 1],
  'entnahme.toepfe.*.renditeReal': [-0.5, 0.2],
  'posten.*.betragJahr': [0, 1e8],
  'posten.*.person': [0, 1, true],
  'posten.*.startAlter': [0, 999],
  'posten.*.endAlter': [0, 999],
  'posten.*.indexierung.satz': [-0.1, 0.5],
  'ereignisse.*.betrag': [-1e9, 1e9],
  'ereignisse.*.person': [0, 1, true],
  'ereignisse.*.alter': [0, 999],
  // Person
  'personen.*.geburtsmonat': [1, 12, true],
  'personen.*.frueherErwerb.jahre': [0, 50, true],
  'personen.*.frueherErwerb.lohn': [0, 1e7],
  'personen.*.lohn': [0, 1e7],
  'personen.*.lohnwachstumReal': [-0.1, 0.1],
  'personen.*.stoppAlter': [0, 120],
  'personen.*.stoppDatum.jahr': [1900, 2300, true],
  'personen.*.stoppDatum.monat': [1, 12, true],
  'personen.*.wohnsitzAusland.alter': [0, 150],
  'personen.*.wohnsitzAusland.datum.jahr': [1900, 2300, true],
  'personen.*.wohnsitzAusland.datum.monat': [1, 12, true],
  'personen.*.wohnsitzAusland.steuerSatzZielland': [0, 0.6],
  'personen.*.wohnsitzAusland.steuerSatzKapitalZielland': [0, 0.6],
  'personen.*.inChSeit': [0, 2200, true],
  'personen.*.ahv.renteMonat': [0, 10_000],
  'personen.*.ahv.mdje': [0, 1e7],
  'personen.*.ahv.beitragsjahre': [0, 50],
  'personen.*.ahv.bezugVerschiebungMonate': [AHV_VERSCHIEBUNG_MIN, 60, true],
  'personen.*.ahvSchaetzhilfe.luecken': [0, 50],
  'personen.*.ahvSchaetzhilfe.jahreCh': [0, 50],
  'personen.*.ahvSchaetzhilfe.einkommen': [0, 1e7],
  'personen.*.ahvSchaetzhilfe.ehejahre': [0, 50],
  'personen.*.ahvSchaetzhilfe.einkommenEhepartner': [0, 1e7],
  'personen.*.ahvSchaetzhilfe.erziehungsJahre': [0, 50, true],
  'personen.*.ahvSchaetzhilfe.betreuungsJahre': [0, 50, true],
  'personen.*.ahvSchaetzhilfe.auslandJahre': [0, 50],
  'personen.*.pk.guthaben': [0, 1e8],
  'personen.*.pk.bvgGuthaben': [0, 1e8],
  'personen.*.pk.sparbeitragJahr': [0, 1e6],
  'personen.*.pk.anteilArbeitnehmer': [0, 1],
  'personen.*.pk.zins': [-0.05, 0.1],
  'personen.*.pk.umwandlungssatz': [0, 0.1],
  'personen.*.pk.kapitalanteil': [0, 1],
  'personen.*.pk.fruehestesAlter': [0, 100],
  'personen.*.pk.bezugsAlter': [0, 100],
  'personen.*.saeule3a.guthaben': [0, 1e8],
  'personen.*.saeule3a.beitragJahr': [0, 1e6],
  'personen.*.saeule3a.rendite': [-0.1, 0.15],
  'personen.*.saeule3a.bezugsAlter': [0, 100],
  'personen.*.bargeld': [0, 1e9],
  'personen.*.wertschriften': [0, 1e9],
  'personen.*.freizuegigkeit.guthaben': [0, 1e8],
  'personen.*.freizuegigkeit.zins': [-0.1, 0.15],
  'personen.*.freizuegigkeit.bezugsAlter': [0, 100],
  'personen.*.sonstiges.wert': [0, 1e9],
  'personen.*.sonstiges.rendite': [-0.2, 0.3],
  'personen.*.wohneigentum.verkehrswert': [0, 1e9],
  'personen.*.wohneigentum.hypothek': [0, 1e9],
  'personen.*.wohneigentum.hypothekarzins': [0, 0.2],
  'personen.*.wohneigentum.unterhaltProzent': [0, 0.2],
  'personen.*.wohneigentum.unterhaltChf': [0, 1e7],
  'personen.*.wohneigentum.eigenmietwert': [0, 1e7],
  'personen.*.wohneigentum.mieteinnahmenMonat': [0, 1e6],
  'personen.*.wohneigentum.verkauf.datum.jahr': [1900, 2200, true],
  'personen.*.wohneigentum.verkauf.datum.monat': [1, 12, true],
  'personen.*.wohneigentum.verkauf.anlagekosten': [0, 1e9],
  'personen.*.wohneigentum.verkauf.kauf.jahr': [1900, 2200, true],
  'personen.*.wohneigentum.verkauf.kauf.monat': [1, 12, true],
  'personen.*.wohneigentum.verkauf.verkaufskostenAnteil': [0, 0.2],
  'personen.*.wohneigentum.verkauf.eigenerSatz': [0, 0.6],
  'personen.*.auslandRenten.*.betrag': [0, 1e8],
  'personen.*.auslandRenten.*.zahlungenProJahr': [1, 14, true],
  'personen.*.auslandRenten.*.wechselkursChf': [0.000001, 100_000],
  'personen.*.auslandRenten.*.startAlter': [0, 120],
  'personen.*.auslandRenten.*.indexierung.satz': [-0.1, 0.5],
  'personen.*.auslandRenten.*.wechselkursAenderung': [-0.5, 0.5],
  'personen.*.auslandRenten.*.quellensteuerSatz': [0, 1],
};

const GEBURTSJAHR = 'personen.*.geburtsjahr';
const VERBOTENE_SCHLUESSEL = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_TIEFE = 12;

/** Geburtsjahr auf 1900…laufendes Jahr klemmen (dieselbe Grenze wie `begrenze`). */
export function geburtsjahrKlemmen(x: number): number {
  return klemme(x, bereichFuer(GEBURTSJAHR));
}

function bereichFuer(pfad: string): Bereich {
  if (pfad === GEBURTSJAHR) return [1900, JAHR_MAX(), true];
  return GRENZEN[pfad] ?? [-ALLGEMEIN_MAX, ALLGEMEIN_MAX];
}

/** Nicht endliche Zahl → Untergrenze bzw. 0, sonst in den Bereich klemmen (ganzzahlig runden, falls verlangt). */
export function klemme(x: number, [min, max, ganz]: Bereich): number {
  if (!Number.isFinite(x)) return Math.min(max, Math.max(min, 0));
  const v = ganz ? Math.round(x) : x;
  return Math.min(max, Math.max(min, v));
}

/**
 * Klemmt alle Zahlen und kürzt alle Texte eines (bereits normalisierten) Haushalts. Gibt eine Kopie zurück;
 * Schlüssel wie `__proto__` werden verworfen. Nicht-Objekte bleiben unverändert.
 */
export function begrenze<T>(wert: T): T {
  return walk(wert, '', 0) as T;
}

function walk(w: unknown, pfad: string, tiefe: number): unknown {
  if (typeof w === 'number') return klemme(w, bereichFuer(pfad));
  if (typeof w === 'string') return w.length > MAX_TEXT ? w.slice(0, MAX_TEXT) : w;
  if (w === null || typeof w !== 'object' || tiefe > MAX_TIEFE) return w === null || typeof w !== 'object' ? w : null;
  if (Array.isArray(w)) return w.map((x) => walk(x, pfad ? `${pfad}.*` : '*', tiefe + 1));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(w)) {
    if (VERBOTENE_SCHLUESSEL.has(k)) continue;
    out[k] = walk((w as Record<string, unknown>)[k], pfad ? `${pfad}.${k}` : k, tiefe + 1);
  }
  return out;
}

/** Pfad-Schlüssel aller Zahlenfelder eines Objekts (für Tests: Abdeckung der Grenzen). */
export function zahlenPfade(w: unknown, pfad = '', aus: Set<string> = new Set()): Set<string> {
  if (typeof w === 'number') aus.add(pfad);
  else if (Array.isArray(w)) for (const x of w) zahlenPfade(x, pfad ? `${pfad}.*` : '*', aus);
  else if (w !== null && typeof w === 'object')
    for (const [k, v] of Object.entries(w)) zahlenPfade(v, pfad ? `${pfad}.${k}` : k, aus);
  return aus;
}
