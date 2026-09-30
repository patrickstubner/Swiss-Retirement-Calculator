/**
 * Sammeln der vorlesbaren Textblöcke aus dem Dokument.
 *
 * Gelesen werden nur Erklär-, Hinweis- und Ergebnistexte: keine Formularelemente (also auch keine Eingabewerte),
 * keine Schaltflächen, Tabellen, Grafiken und keine versteckten Elemente. Die Funktion arbeitet nur lesend und
 * erwartet nur eine kleine Teilmenge der DOM-Schnittstelle (`KnotenLike`), damit sie ohne Browser testbar ist.
 */

export interface KnotenLike {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly childNodes: ArrayLike<KnotenLike>;
  readonly data?: string;
  getAttribute?(name: string): string | null;
  hasAttribute?(name: string): boolean;
  checkVisibility?(opt?: Record<string, boolean>): boolean;
}

export interface Segment {
  knoten: KnotenLike;
  /** Beginn dieses Textknotens im Blocktext */
  start: number;
  ende: number;
}

export interface Block {
  text: string;
  segmente: Segment[];
}

const ELEMENT = 1;
const TEXT = 3;

/** Elemente, deren Inhalt nie vorgelesen wird. */
const AUSGESCHLOSSEN = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'OPTGROUP',
  'DATALIST',
  'BUTTON',
  'LABEL',
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'CANVAS',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'AUDIO',
  'VIDEO',
  'TABLE',
  'NAV',
]);

/** Elemente, die einen neuen Textblock beginnen und beenden. */
const BLOCK = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BR',
  'DD',
  'DETAILS',
  'DIALOG',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'SUMMARY',
  'UL',
]);

const attr = (k: KnotenLike, n: string): string | null => (k.getAttribute ? k.getAttribute(n) : null);
const hat = (k: KnotenLike, n: string): boolean => (k.hasAttribute ? k.hasAttribute(n) : attr(k, n) !== null);

/** Ist das Element vom Vorlesen ausgenommen? */
export function istAusgeschlossen(k: KnotenLike): boolean {
  const name = k.nodeName.toUpperCase();
  if (AUSGESCHLOSSEN.has(name)) return true;
  if (hat(k, 'hidden') || hat(k, 'inert')) return true;
  if (attr(k, 'aria-hidden') === 'true') return true;
  if (attr(k, 'data-vorlesen') === 'aus') return true;
  const rolle = attr(k, 'role');
  if (rolle === 'img' || rolle === 'presentation' || rolle === 'none' || rolle === 'toolbar') return true;
  if (attr(k, 'contenteditable') === 'true') return true;
  return false;
}

const sichtbarStandard = (k: KnotenLike): boolean => {
  if (typeof k.checkVisibility !== 'function') return true;
  try {
    return k.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true, contentVisibilityAuto: true });
  } catch {
    return true;
  }
};

export interface SammelOptionen {
  /** Sichtbarkeitsprüfung (Standard: `checkVisibility`, falls vorhanden) */
  sichtbar?: (k: KnotenLike) => boolean;
  /** Höchstzahl Zeichen insgesamt (Schutz gegen riesige Seiten) */
  maxZeichen?: number;
}

/** Sammelt die vorlesbaren Textblöcke unterhalb von `wurzel` in Dokumentreihenfolge. */
export function sammleBloecke(wurzel: KnotenLike, opt: SammelOptionen = {}): Block[] {
  const sichtbar = opt.sichtbar ?? sichtbarStandard;
  const maxZeichen = opt.maxZeichen ?? 400_000;
  const bloecke: Block[] = [];
  let text = '';
  let segmente: Segment[] = [];
  let gesamt = 0;

  const leeren = () => {
    if (segmente.length > 0 && /\S/.test(text)) bloecke.push({ text, segmente });
    text = '';
    segmente = [];
  };

  const gehe = (k: KnotenLike, tiefe: number): void => {
    if (gesamt > maxZeichen || tiefe > 200) return;
    if (k.nodeType === TEXT) {
      const d = k.data ?? '';
      if (d === '') return;
      if (text === '' && !/\S/.test(d)) return;
      segmente.push({ knoten: k, start: text.length, ende: text.length + d.length });
      text += d;
      gesamt += d.length;
      return;
    }
    if (k.nodeType !== ELEMENT) return;
    if (istAusgeschlossen(k) || !sichtbar(k)) return;
    const name = k.nodeName.toUpperCase();
    const istBlock =
      BLOCK.has(name) || /(^|\s)kennzahl__/.test(attr(k, 'class') ?? '') || hat(k, 'data-vorlesen-block');
    if (istBlock) leeren();
    // geschlossene Aufklappbereiche: nur die Überschrift (summary)
    const nurSummary = name === 'DETAILS' && !hat(k, 'open');
    for (let i = 0; i < k.childNodes.length; i++) {
      const kind = k.childNodes[i];
      if (!kind) continue;
      if (nurSummary && kind.nodeName.toUpperCase() !== 'SUMMARY') continue;
      gehe(kind, tiefe + 1);
    }
    if (istBlock) leeren();
  };

  gehe(wurzel, 0);
  leeren();
  return bloecke;
}

/** Position im Blocktext → Textknoten und Offset darin (für DOM-Bereiche). */
export function positionImBlock(
  block: Block,
  pos: number,
  ende = false,
): { knoten: KnotenLike; offset: number } | null {
  const segs = block.segmente;
  for (const s of segs) {
    // am Ende darf die Position auf dem Ende des Segments liegen, am Anfang erst im nächsten
    if (pos >= s.start && (ende ? pos <= s.ende : pos < s.ende)) return { knoten: s.knoten, offset: pos - s.start };
  }
  const letztes = segs[segs.length - 1];
  return letztes && pos >= letztes.ende ? { knoten: letztes.knoten, offset: letztes.ende - letztes.start } : null;
}
