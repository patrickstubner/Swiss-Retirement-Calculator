/**
 * Satzteilung für das Vorlesen. Reine Funktion ohne DOM.
 * Liefert Bereiche im Originaltext (damit später der Satz im Dokument markiert werden kann).
 * Lange Sätze werden zusätzlich an Satzzeichen/Leerzeichen geteilt: Chrome bricht lange Äusserungen nach
 * etwa 15 Sekunden ab.
 */

export interface Bereich {
  von: number;
  bis: number;
}

/** Abkürzungen, nach denen trotz Punkt und Grossbuchstaben kein Satz endet (klein geschrieben, mit Punkt). */
const ABKUERZUNGEN = new Set([
  'z.',
  'b.',
  'd.',
  'h.',
  'u.',
  'a.',
  'ca.',
  'bzw.',
  'usw.',
  'etc.',
  'evtl.',
  'ggf.',
  'inkl.',
  'exkl.',
  'max.',
  'min.',
  'mio.',
  'mrd.',
  'tsd.',
  'nr.',
  'art.',
  'abs.',
  'ziff.',
  'lit.',
  'vgl.',
  'resp.',
  'jg.',
  'sog.',
  'std.',
  'kt.',
  'bsp.',
  'dr.',
  'prof.',
  'st.',
  'fr.',
  'mt.',
  'j.',
  'p.',
  's.',
  'ff.',
  'i.',
  'o.',
  'v.',
]);

export const MAX_SATZ = 180;

const istLeer = (c: string | undefined) => c === undefined || /\s/.test(c);
const beginntSatz = (c: string | undefined) => c !== undefined && /[\p{Lu}\p{N}«"„(\u2013\u2014]/u.test(c);
const SCHLUSS = /[»"”)\]']/;

/** Endet an Position `i` (Punkt) ein Satz? `naechster` = erstes Zeichen nach dem Leerraum. */
function punktBeendetSatz(text: string, i: number, naechster: string | undefined): boolean {
  if (naechster === undefined) return true;
  if (!beginntSatz(naechster)) return false;
  const m = /[\p{L}\p{N}]+$/u.exec(text.slice(Math.max(0, i - 12), i));
  const wort = m?.[0] ?? '';
  if (wort === '') return true;
  if (wort.length === 1 && /\p{L}/u.test(wort)) return false; // Initialen, «z. B.», «d. h.»
  if (ABKUERZUNGEN.has(`${wort.toLowerCase()}.`)) return false;
  if (/^\d{1,2}$/.test(wort) && /\p{Lu}/u.test(naechster)) return false; // Ordnungszahl: «30. Juni»
  return true;
}

/** Teilt einen zu langen Satz an Satzzeichen oder Leerzeichen. */
function teileLang(text: string, von: number, bis: number, max: number): Bereich[] {
  const teile: Bereich[] = [];
  let start = von;
  while (bis - start > max) {
    const fenster = text.slice(start, start + max + 1);
    let schnitt = -1;
    for (const re of [/[;:][ ]/g, /,[ ]/g, /[ ][–—-][ ]/g]) {
      let m: RegExpExecArray | null = re.exec(fenster);
      while (m) {
        if (m.index + m[0].length >= max * 0.4 && m.index + m[0].length <= max) schnitt = m.index + m[0].length;
        m = re.exec(fenster);
      }
      if (schnitt > 0) break;
    }
    if (schnitt <= 0) {
      const sp = fenster.lastIndexOf(' ');
      schnitt = sp > 0 ? sp + 1 : max; // ohne Leerzeichen: hart schneiden
    }
    teile.push({ von: start, bis: start + schnitt });
    start += schnitt;
  }
  teile.push({ von: start, bis });
  return teile;
}

/** Schneidet Leerraum an beiden Enden ab und liefert nur nichtleere Bereiche. */
function trimme(text: string, von: number, bis: number): Bereich | null {
  let a = von;
  let b = bis;
  while (a < b && /\s/.test(text[a] ?? '')) a++;
  while (b > a && /\s/.test(text[b - 1] ?? '')) b--;
  return a < b ? { von: a, bis: b } : null;
}

/** Teilt einen Text in Sätze (Bereiche im Originaltext), höchstens `max` Zeichen lang. */
export function teileInSaetze(text: string, max = MAX_SATZ): Bereich[] {
  const grenze = Math.max(20, Math.floor(max));
  const roh: Bereich[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i] as string;
    if (c === '\n') {
      roh.push({ von: start, bis: i });
      start = i + 1;
      i++;
      continue;
    }
    if (c === '.' || c === '!' || c === '?' || c === '…') {
      // aufeinanderfolgende Satzzeichen und schliessende Klammern gehören dazu
      let j = i + 1;
      while (j < text.length && (/[.!?…]/.test(text[j] as string) || SCHLUSS.test(text[j] as string))) j++;
      if (j >= text.length || istLeer(text[j])) {
        let k = j;
        while (k < text.length && istLeer(text[k]) && text[k] !== '\n') k++;
        const naechster = text[k] === '\n' ? undefined : text[k];
        const ende =
          c === '.' && j === i + 1
            ? punktBeendetSatz(text, i, naechster)
            : naechster === undefined || c !== '.' || punktBeendetSatz(text, i, naechster);
        if (ende) {
          roh.push({ von: start, bis: j });
          start = j;
        }
      }
      i = j;
      continue;
    }
    i++;
  }
  if (start < text.length) roh.push({ von: start, bis: text.length });

  const ergebnis: Bereich[] = [];
  for (const r of roh) {
    const t = trimme(text, r.von, r.bis);
    if (!t) continue;
    if (t.bis - t.von <= grenze) ergebnis.push(t);
    else
      for (const teil of teileLang(text, t.von, t.bis, grenze)) {
        const tt = trimme(text, teil.von, teil.bis);
        if (tt) ergebnis.push(tt);
      }
  }
  return ergebnis;
}
