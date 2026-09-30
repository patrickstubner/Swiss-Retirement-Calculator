/**
 * Hervorhebung des gelesenen Satzes und Wortes und Mitscrollen (nur Browser).
 *
 * Es wird nie HTML erzeugt oder eingefügt: Hervorhebung über die CSS Custom Highlight API (`CSS.highlights`),
 * die den DOM nicht verändert. Fehlt sie (ältere Browser), wird stattdessen am umgebenden Element das Attribut
 * `data-vorlesen-aktiv` gesetzt (das React nicht verwaltet).
 */
import { type Block, positionImBlock } from './dom';

export const HL_SATZ = 'vorlesen-satz';
export const HL_WORT = 'vorlesen-wort';

interface HighlightRegistry {
  set(name: string, h: unknown): void;
  delete(name: string): void;
}
type HighlightKonstruktor = new (...r: Range[]) => unknown;

const registry = (): HighlightRegistry | null => {
  const c = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  return c?.highlights ?? null;
};
const Highlight = (): HighlightKonstruktor | null =>
  (globalThis as { Highlight?: HighlightKonstruktor }).Highlight ?? null;

/** Bereich [von, bis) des Blocks als DOM-Range; null bei veraltetem DOM. */
export function bereichFuer(block: Block, von: number, bis: number): Range | null {
  const a = positionImBlock(block, von);
  const b = positionImBlock(block, bis, true);
  if (!a || !b) return null;
  const ka = a.knoten as unknown as Node;
  const kb = b.knoten as unknown as Node;
  if (!ka.isConnected || !kb.isConnected) return null;
  try {
    const r = document.createRange();
    r.setStart(ka, a.offset);
    r.setEnd(kb, b.offset);
    return r;
  } catch {
    return null; // Text hat sich inzwischen geändert
  }
}

let markiert: Element | null = null;

export function loescheHervorhebung(): void {
  registry()?.delete(HL_SATZ);
  registry()?.delete(HL_WORT);
  if (markiert) {
    markiert.removeAttribute('data-vorlesen-aktiv');
    markiert = null;
  }
}

export function setzeHervorhebung(satz: Range | null, wort: Range | null): void {
  const reg = registry();
  const H = Highlight();
  if (reg && H) {
    if (satz) reg.set(HL_SATZ, new H(satz));
    else reg.delete(HL_SATZ);
    if (wort) reg.set(HL_WORT, new H(wort));
    else reg.delete(HL_WORT);
    return;
  }
  // Rückfall: Absatz markieren
  const el = satz ? (satz.startContainer.parentElement ?? null) : null;
  if (el === markiert) return;
  markiert?.removeAttribute('data-vorlesen-aktiv');
  markiert = el;
  markiert?.setAttribute('data-vorlesen-aktiv', '');
}

/** Scrollt, wenn der Satz ausserhalb des sichtbaren Bereichs liegt (über der Kante oder hinter der unteren Leiste). */
export function scrolleSichtbar(r: Range): void {
  const rect = r.getBoundingClientRect();
  if (rect.height === 0 && rect.width === 0) return;
  const leiste = document.querySelector('.leiste')?.getBoundingClientRect().top ?? window.innerHeight;
  const oben = 12;
  const unten = Math.min(window.innerHeight, leiste) - 16;
  if (rect.top >= oben && rect.bottom <= unten) return;
  const ziel = oben + (unten - oben) * 0.3;
  const reduziert = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  window.scrollBy({ top: rect.top - ziel, behavior: reduziert ? 'auto' : 'smooth' });
}
