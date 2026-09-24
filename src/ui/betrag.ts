/**
 * Beträge mit Schweizer Tausendertrennzeichen (’, U+2019 wie Intl de-CH) – Formatieren,
 * Parsen und Cursor-Logik für die Live-Formatierung während der Eingabe. Reine Funktionen.
 */

/** Tausendertrennzeichen app-weit (typografischer Apostroph, wie Intl.NumberFormat('de-CH')). */
export const TRENNER = '’';
/** Dezimalzeichen in der Anzeige */
export const DEZIMAL = '.';

/** Trenner und Leerzeichen, die beim Parsen/Einfügen ignoriert werden. */
const IGNORIERT = /[\s'’ʼ‘`´\u00a0\u202f]/g;

/** Gruppiert eine Ziffernfolge in Dreierblöcke: «1250000» → «1’250’000» (ab 1000). */
export function gruppiere(ziffern: string): string {
  const d = ziffern.replace(/^0+(?=\d)/, '');
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, TRENNER);
}

/** Zahl mit Tausendertrennzeichen, gerundet auf `nachkomma` Stellen (Standard 0). */
export function formatBetrag(x: number, nachkomma = 0): string {
  if (!Number.isFinite(x)) return '';
  const fix = Math.abs(x).toFixed(nachkomma);
  const [ganz = '0', dez] = fix.split('.');
  const dezimal = dez ? dez.replace(/0+$/, '') : '';
  const negativ = x < 0 && Number(fix) !== 0;
  return `${negativ ? '-' : ''}${gruppiere(ganz)}${dezimal ? DEZIMAL + dezimal : ''}`;
}

export interface BetragOptionen {
  /** Nachkommastellen erlaubt */
  dezimal?: boolean;
  /** Negative Werte erlaubt */
  negativ?: boolean;
}

/**
 * Parst Beträge in üblichen Schreibweisen: «1’250’000», «1'250'000», «1 250 000»,
 * «1,250,000», «1.250.000», «1250.50», «1250,5», «-500». Gibt null bei ungültiger Eingabe
 * (leer → null). Mehrere gleiche Trenner = Tausender; ein einzelnes Komma/Punkt gefolgt von
 * genau drei Ziffern = Tausender (bei Feldern ohne Nachkommastellen auch der Punkt), sonst Dezimal.
 */
export function parseBetrag(text: string, opt: BetragOptionen = {}): number | null {
  let s = text.replace(IGNORIERT, '').replace(/[−–]/g, '-');
  if (s === '' || s === '-') return null;
  const negativ = s.startsWith('-');
  if (negativ) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;
  const punkte = (s.match(/\./g) ?? []).length;
  const kommas = (s.match(/,/g) ?? []).length;
  let norm: string;
  if (punkte > 0 && kommas > 0) {
    // Das zuletzt vorkommende Zeichen ist das Dezimalzeichen
    const dez = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const tausender = dez === '.' ? ',' : '.';
    if ((s.match(dez === '.' ? /\./g : /,/g) ?? []).length > 1) return null;
    norm = s.split(tausender).join('').replace(dez, '.');
  } else if (punkte + kommas === 0) {
    norm = s;
  } else {
    const zeichen = punkte > 0 ? '.' : ',';
    const anzahl = punkte + kommas;
    const tausenderMuster = new RegExp(`^\\d{1,3}(\\${zeichen}\\d{3})+$`);
    const alsTausender =
      anzahl > 1 ? tausenderMuster.test(s) : tausenderMuster.test(s) && (zeichen === ',' || !opt.dezimal);
    if (anzahl > 1 && !alsTausender) return null;
    norm = alsTausender ? s.split(zeichen).join('') : s.replace(zeichen, '.');
  }
  if (norm === '' || norm === '.') return null;
  const n = Number(norm);
  if (!Number.isFinite(n)) return null;
  const wert = negativ ? -n : n;
  if (wert < 0 && opt.negativ === false) return null;
  return wert;
}

/** Signifikante Zeichen: Ziffern, führendes Minus, Dezimalzeichen. */
const signifikant = (c: string): boolean => /[\d.,\-−]/.test(c);

/**
 * Bereinigt und formatiert die Eingabe während des Tippens: nur Ziffern (ggf. führendes Minus
 * und ein Dezimalzeichen), gruppiert ab 1000. Unvollständige Eingaben bleiben erhalten
 * («-», «12.»).
 */
export function formatLive(roh: string, opt: BetragOptionen = {}): string {
  let s = roh.replace(IGNORIERT, '').replace(/[−–]/g, '-');
  const negativ = opt.negativ === true && s.startsWith('-');
  s = s.replace(/-/g, '');
  let ganz = s;
  let dez: string | null = null;
  if (opt.dezimal) {
    const i = s.search(/[.,]/);
    if (i >= 0) {
      ganz = s.slice(0, i);
      dez = s.slice(i + 1).replace(/\D/g, '');
    }
  }
  ganz = ganz.replace(/\D/g, '');
  const g = ganz === '' ? (dez !== null ? '0' : '') : gruppiere(ganz);
  return `${negativ ? '-' : ''}${g}${dez !== null ? DEZIMAL + dez : ''}`;
}

/** Anzahl signifikanter Zeichen vor Position `pos`. */
export function signifikantVor(text: string, pos: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(pos, text.length); i++) if (signifikant(text[i] ?? '')) n++;
  return n;
}

/** Cursorposition im formatierten Text nach `n` signifikanten Zeichen. */
export function positionNach(formatiert: string, n: number): number {
  if (n <= 0) {
    // vor dem ersten signifikanten Zeichen bleiben
    return 0;
  }
  let gezaehlt = 0;
  for (let i = 0; i < formatiert.length; i++) {
    if (signifikant(formatiert[i] ?? '')) gezaehlt++;
    if (gezaehlt === n) return i + 1;
  }
  return formatiert.length;
}

export interface LiveErgebnis {
  text: string;
  caret: number;
}

/**
 * Verarbeitet eine Änderung im Eingabefeld: formatiert live und berechnet die neue
 * Cursorposition, sodass der Cursor hinter derselben Ziffer bleibt. Wird nur ein
 * Tausendertrenner gelöscht (Rücktaste/Entf), wird stattdessen die benachbarte Ziffer gelöscht.
 */
export function bearbeiteEingabe(
  alt: string,
  roh: string,
  caret: number,
  opt: BetragOptionen = {},
  inputType = '',
): LiveErgebnis {
  let r = roh;
  let c = caret;
  const nurTrennerGeloescht =
    roh.length === alt.length - 1 && roh.replace(IGNORIERT, '') === alt.replace(IGNORIERT, '');
  if (nurTrennerGeloescht) {
    if (inputType === 'deleteContentForward') {
      // nächstes signifikantes Zeichen ab Cursor löschen
      let i = c;
      while (i < r.length && !signifikant(r[i] ?? '')) i++;
      if (i < r.length) r = r.slice(0, i) + r.slice(i + 1);
    } else {
      // Rücktaste: signifikantes Zeichen vor dem Cursor löschen
      let i = c - 1;
      while (i >= 0 && !signifikant(r[i] ?? '')) i--;
      if (i >= 0) {
        r = r.slice(0, i) + r.slice(i + 1);
        c = i;
      }
    }
  }
  const n = signifikantVor(r, c);
  const text = formatLive(r, opt);
  // Führende Nullen/entfernte Zeichen können die Zählung verschieben → begrenzen
  const nMax = signifikantVor(text, text.length);
  return { text, caret: positionNach(text, Math.min(n, nMax)) };
}
