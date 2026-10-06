/**
 * Unsichtbare Zeichen in frei eingegebenen Namen (N-01).
 * Formatzeichen (unter anderem U+202E, Zeichen mit Null-Breite, U+FEFF),
 * Privatnutzung, Nichtzeichen sowie die Zeilentrenner U+2028 und U+2029.
 */
const UNSICHTBAR = /[\p{Cf}\p{Co}\p{Cn}\u2028\u2029]/gu;

/** Entfernt Format-, Privat- und Nichtzeichen sowie U+2028/U+2029. */
export function ohneUnsichtbareZeichen(s: string): string {
  return s.replace(UNSICHTBAR, '');
}

/**
 * Anzeigename: unsichtbare Zeichen, C0-Steuerzeichen und DEL weg, höchstens `max` Zeichen.
 * `klammern`: spitze Klammern zusätzlich entfernen (Krisennamen). Leerzeichen bleiben.
 */
export function filterAnzeigename(roh: string, max: number, klammern = false): string {
  let out = '';
  for (const ch of ohneUnsichtbareZeichen(roh)) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 31 || c === 127) continue;
    if (klammern && (ch === '<' || ch === '>')) continue;
    out += ch;
    if (out.length >= max) break;
  }
  return out;
}
