/**
 * Text-Aufbereitung für die Aussprache (Vorlesen). Reine Funktion ohne DOM.
 *
 * Der Anzeigetext bleibt unverändert; für die Stimme entsteht ein zweiter Text («Sprechtext»), in dem
 * Abkürzungen, Zahlen und Zeichen ausgeschrieben sind. Damit das gelesene Wort im Text hervorgehoben werden kann,
 * merkt sich das Ergebnis, welche Stellen ersetzt wurden (`karte`) und übersetzt eine Position im Sprechtext
 * zurück auf die Position im Anzeigetext (`anzeigeBereich`).
 */

export interface Ersetzung {
  /** Bereich im Anzeigetext [a0, a1) */
  a0: number;
  a1: number;
  /** Bereich im Sprechtext [s0, s1) */
  s0: number;
  s1: number;
}

export interface Aufbereitet {
  sprech: string;
  karte: Ersetzung[];
}

const B0 = '(?<![\\p{L}\\p{N}])';
const B1 = '(?![\\p{L}\\p{N}])';
const APOS = "[’']";

/** Zahl für die Stimme: Tausenderapostroph weg, Dezimalpunkt zu Komma. */
export const sprechZahl = (s: string): string => s.replace(/[’']/g, '').replace('.', ',').replace(/^[−-]/, 'minus ');

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

const EINER = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const ZEHNER = ['', '', 'zwanzig', 'dreissig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
const TEENS = [
  'zehn',
  'elf',
  'zwölf',
  'dreizehn',
  'vierzehn',
  'fünfzehn',
  'sechzehn',
  'siebzehn',
  'achtzehn',
  'neunzehn',
];

/** 0–99 als Wort («neunundsechzig»). */
function unter100(n: number): string {
  if (n === 0) return '';
  if (n < 10) return n === 1 ? 'eins' : (EINER[n] ?? '');
  if (n < 20) return TEENS[n - 10] ?? '';
  const z = Math.floor(n / 10);
  const e = n % 10;
  return e === 0 ? (ZEHNER[z] ?? '') : `${EINER[e] ?? ''}und${ZEHNER[z] ?? ''}`;
}

/** Jahreszahl 1100–1999 als «neunzehnhundertneunundsechzig» (sonst unverändert). */
export function jahrZuWort(jahr: number): string {
  if (!Number.isInteger(jahr) || jahr < 1100 || jahr > 1999) return String(jahr);
  const h = Math.floor(jahr / 100);
  const rest = jahr % 100;
  return `${TEENS[h - 10] ?? ''}hundert${unter100(rest)}`;
}

/** Grossgeschriebene Wörter, die als Wort und nicht Buchstabe für Buchstabe gesprochen werden. */
const ALS_WORT = new Set(['EFTA', 'NATO', 'UNO', 'AHVG']);

const buchstabiert = (w: string) => [...w].join(' ');

type Regel = [RegExp, (m: RegExpExecArray) => string];
type RegelRoh = [RegExp | null, (m: RegExpExecArray) => string];

/**
 * Regex zur Laufzeit bauen: Ältere Browser (z.B. Safari < 16.4) kennen kein Lookbehind. Als Literal wäre das ein
 * SyntaxError beim Laden des ganzen Bundles; so fällt nur diese eine Regel weg.
 */
const r = (quelle: string): RegExp | null => {
  try {
    return new RegExp(quelle, 'uy');
  } catch {
    return null;
  }
};

const abk = (muster: string, text: string): RegelRoh => [r(`${B0}${muster}`), () => text];

const REGELN_ROH: RegelRoh[] = [
  // unsichtbare Zeichen (weiche Trennung usw.)
  [r(String.raw`[\u00AD\u200B-\u200D\uFEFF]+`), () => ''],
  // Emoji, Pfeile und Zierzeichen
  [r(String.raw`\s*[\p{Extended_Pictographic}\u2190-\u21FF\u2600-\u27BF]+\s*`), () => ' '],
  // Beträge: «CHF 1'250» → «1250 Franken»
  [r(`${B0}CHF\\s?(-?\\d[\\d’']*(?:[.,]\\d+)?)`), (m) => `${sprechZahl(m[1] ?? '')} Franken`],
  [r(`${B0}CHF${B1}`), () => 'Franken'],
  [r(`${B0}Fr\\./Mt\\.`), () => 'Franken pro Monat'],
  [r(`${B0}Fr\\./J\\.`), () => 'Franken pro Jahr'],
  [r(String.raw`(?<=\d\s?)Fr\.`), () => 'Franken'],
  [r(String.raw`(?<=\d\s?)€`), () => 'Euro'],
  [r(String.raw`€`), () => 'Euro'],
  // Zeiträume: «1 J.» / «3 J. 2 Mt.»
  [r(String.raw`(?<![\p{N}])1\s?J\.`), () => '1 Jahr'],
  [r(String.raw`(?<=\d\s?)J\.`), () => 'Jahre'],
  [r(String.raw`(?<![\p{N}])1\s?Mt\.`), () => '1 Monat'],
  [r(String.raw`(?<=\d\s?)Mt\.`), () => 'Monate'],
  // Abkürzungen mit Punkt
  abk('z\\.\\s?B\\.', 'zum Beispiel'),
  abk('d\\.\\s?h\\.', 'das heisst'),
  abk('u\\.\\s?a\\.', 'unter anderem'),
  abk('i\\.\\s?d\\.\\s?R\\.', 'in der Regel'),
  abk('p\\.\\s?a\\.', 'pro Jahr'),
  abk('v\\.\\s?a\\.', 'vor allem'),
  abk('z\\.\\s?T\\.', 'zum Teil'),
  abk('o\\.\\s?ä\\.', 'oder ähnliches'),
  abk('ca\\.', 'circa'),
  abk('bzw\\.', 'beziehungsweise'),
  abk('usw\\.', 'und so weiter'),
  abk('etc\\.', 'et cetera'),
  abk('evtl\\.', 'eventuell'),
  abk('ggf\\.', 'gegebenenfalls'),
  abk('inkl\\.', 'inklusive'),
  abk('exkl\\.', 'exklusive'),
  abk('max\\.', 'maximal'),
  abk('min\\.', 'minimal'),
  abk('Mio\\.', 'Millionen'),
  abk('Mrd\\.', 'Milliarden'),
  abk('Tsd\\.', 'Tausend'),
  abk('Nr\\.', 'Nummer'),
  abk('Art\\.', 'Artikel'),
  abk('Abs\\.', 'Absatz'),
  abk('Ziff\\.', 'Ziffer'),
  abk('lit\\.', 'Buchstabe'),
  abk('vgl\\.', 'vergleiche'),
  abk('resp\\.', 'respektive'),
  abk('Jg\\.', 'Jahrgang'),
  abk('sog\\.', 'sogenannte'),
  abk('Std\\.', 'Stunden'),
  abk('Kt\\.', 'Kanton'),
  abk('Bsp\\.', 'Beispiel'),
  // «Säule 3a» / «3b»
  [r(`${B0}3([ab])${B1}`), (m) => `drei ${m[1] ?? ''}`],
  // Prozent
  [r(String.raw`(?<![\p{N}.,’'])(-?\d[\d’']*(?:[.,]\d+)?)\s?%`), (m) => `${sprechZahl(m[1] ?? '')} Prozent`],
  [r(String.raw`%`), () => ' Prozent'],
  // Bereiche «1961–1969»
  [r(String.raw`(?<=\d)[–—](?=\d)`), () => ' bis '],
  // Tausenderapostroph: «1'250'000»
  [
    r(`${B0}(\\d{1,3}(?:${APOS}\\d{3})+)(?:([.,])(\\d+))?`),
    (m) => `${(m[1] ?? '').replace(/[’']/g, '')}${m[3] ? `,${m[3]}` : ''}`,
  ],
  // Datum «25.9.2026» → «25. September 2026»
  [
    r(String.raw`(?<![\p{N}.])(0?[1-9]|[12]\d|3[01])\.(0?[1-9]|1[0-2])\.(\d{4})(?![\p{N}])`),
    (m) => `${Number(m[1])}. ${MONATE[Number(m[2]) - 1] ?? ''} ${m[3] ?? ''}`,
  ],
  // Jahreszahlen 1100–1999 ohne Trennzeichen (Beträge haben im Text immer Tausenderapostroph)
  [
    r(String.raw`(?<![\p{N}.,’'-])(1[1-9]\d{2})(?![\p{N}]|[.,]\d|\s?(?:Franken|CHF|Fr\.|Prozent|%|€))`),
    (m) => jahrZuWort(Number(m[1])),
  ],
  // Dezimalzahlen «3.5» → «3,5»; Datumsangaben «25.9.2026» bleiben unverändert
  [r(String.raw`(?<![\p{N}.,])(\d+)\.(\d+)(?![\p{N}]|\.\d)`), (m) => `${m[1] ?? ''},${m[2] ?? ''}`],
  // Brüche «1/44»
  [r(String.raw`(?<=\d)\/(?=\d)`), () => ' durch '],
  // Vorzeichen
  [r(String.raw`(?<![\p{L}\p{N}])[−-](?=\d)`), () => 'minus '],
  // Grossgeschriebene Abkürzungen: «AHV» → «A H V»; «CH-Rente» → «C H Rente»
  [
    r(`${B0}([A-ZÄÖÜ]{2,4})-(?=\\p{L})|${B0}([A-ZÄÖÜ]{2,4})${B1}`),
    (m) => {
      const w = m[1] ?? m[2] ?? '';
      return ALS_WORT.has(w)
        ? `${w.charAt(0)}${w.slice(1).toLowerCase()}${m[1] ? ' ' : ''}`
        : `${buchstabiert(w)}${m[1] ? ' ' : ''}`;
    },
  ],
  // Zeichen
  [r(String.raw`[«»"“”„‚‘’…]+`), () => ''],
  [r(String.raw`\s?[×]\s?`), () => ' mal '],
  [r(String.raw`\s?[·•]\s?`), () => ', '],
  [r(String.raw`\s?≤\s?`), () => ' höchstens '],
  [r(String.raw`\s?≥\s?`), () => ' mindestens '],
  [r(String.raw`\s?&\s?`), () => ' und '],
  [r(String.raw`\s?=\s?`), () => ' gleich '],
  [r(String.raw`(?<=\s)\+(?=\s?\d)`), () => 'plus'],
  [r(String.raw`\/`), () => ' '],
  [r(String.raw`[*_#\x60~^|<>{}[\]]+`), () => ' '],
  // Leerraum (auch geschützte Leerzeichen) auf ein Leerzeichen
  [r(String.raw`[\s\u00A0\u202F]{2,}|[\u00A0\u202F\t\n\r]`), () => ' '],
];

/** Regeln, deren Regex der Browser kennt (sonst fällt nur diese Regel weg). */
const REGELN: Regel[] = REGELN_ROH.filter((x): x is Regel => x[0] !== null);

/** Für Tests: alle Regeln müssen in diesem Browser gebaut werden können. */
export const REGELN_ANZAHL = { gesamt: REGELN_ROH.length, aktiv: REGELN.length };

/**
 * Bereitet einen Anzeigetext für die Sprachausgabe auf.
 * Läuft in linearer Zeit pro Zeichen (Anzahl Regeln konstant); für sehr lange Texte vorher in Sätze teilen.
 */
export function bereiteAuf(text: string): Aufbereitet {
  let sprech = '';
  const karte: Ersetzung[] = [];
  let i = 0;
  while (i < text.length) {
    let getroffen = false;
    for (const [re, fn] of REGELN) {
      re.lastIndex = i;
      const m = re.exec(text);
      if (m && m[0].length > 0) {
        const ers = fn(m);
        if (ers !== m[0]) karte.push({ a0: i, a1: i + m[0].length, s0: sprech.length, s1: sprech.length + ers.length });
        sprech += ers;
        i += m[0].length;
        getroffen = true;
        break;
      }
    }
    if (!getroffen) {
      // ganzes Code-Point kopieren (Surrogate-Paare nicht zerreissen)
      const cp = text.codePointAt(i) ?? 0;
      const ch = String.fromCodePoint(cp);
      sprech += ch;
      i += ch.length;
    }
  }
  // Anfang und Ende kürzen; die Karte verschiebt sich um den entfernten Vorlauf
  const lead = sprech.length - sprech.trimStart().length;
  const fertig = sprech.trim();
  const verschoben = karte
    .map((k) => ({ ...k, s0: Math.max(0, k.s0 - lead), s1: Math.min(fertig.length, Math.max(0, k.s1 - lead)) }))
    .filter((k) => k.s1 > k.s0 || k.s0 < fertig.length);
  return { sprech: fertig, karte: verschoben };
}

/**
 * Übersetzt eine Position im Sprechtext (z.B. `charIndex` eines boundary-Ereignisses) in einen Bereich im
 * Anzeigetext. Liegt sie in einem ersetzten Stück, wird das ganze Stück zurückgegeben, sonst das Wort ab dieser
 * Stelle (bis zum nächsten Leerzeichen oder zur nächsten Ersetzung).
 */
export function anzeigeBereich(
  a: Aufbereitet,
  anzeige: string,
  sprechIndex: number,
): { von: number; bis: number } | null {
  if (!Number.isFinite(sprechIndex) || sprechIndex < 0 || sprechIndex >= Math.max(a.sprech.length, 1)) return null;
  let last: Ersetzung | null = null;
  for (const k of a.karte) {
    if (k.s0 <= sprechIndex) last = k;
    else break;
  }
  let von: number;
  if (last && last.s1 > last.s0 && sprechIndex < last.s1) return { von: last.a0, bis: last.a1 };
  if (last) von = last.a1 + (sprechIndex - last.s1);
  else von = sprechIndex;
  if (von >= anzeige.length) return null;
  const naechste = a.karte.find((k) => k.a0 > von)?.a0 ?? anzeige.length;
  let bis = von;
  while (bis < naechste && !/\s/.test(anzeige[bis] ?? ' ')) bis++;
  if (bis === von) bis = Math.min(von + 1, anzeige.length);
  return { von, bis };
}
