/** Aus Textblöcken die Warteschlange der zu sprechenden Sätze bilden. Rein, ohne DOM. */
import { type Aufbereitet, bereiteAuf } from './aufbereitung';
import { teileInSaetze } from './saetze';

export interface Satz extends Aufbereitet {
  /** Anzeigetext des Satzes (Ausschnitt des Blocktextes) */
  anzeige: string;
  /** Index des Textblocks */
  block: number;
  /** Bereich [von, bis) im Blocktext */
  von: number;
  bis: number;
}

/** Sätze für die Sprachausgabe sind kürzer als beim reinen Anzeigen (Chrome bricht lange Äusserungen ab). */
export const MAX_SPRECH_SATZ = 120;
/** Obergrenzen gegen unbeabsichtigt riesige Warteschlangen. */
export const MAX_SAETZE = 4000;
export const MAX_ZEICHEN = 300_000;

const HAT_INHALT = /[\p{L}\p{N}]/u;

export function planeSaetze(bloecke: readonly string[], max = MAX_SPRECH_SATZ): Satz[] {
  const aus: Satz[] = [];
  let zeichen = 0;
  for (let b = 0; b < bloecke.length; b++) {
    const text = bloecke[b] ?? '';
    for (const r of teileInSaetze(text, max)) {
      const anzeige = text.slice(r.von, r.bis);
      const a = bereiteAuf(anzeige);
      if (!HAT_INHALT.test(a.sprech)) continue;
      zeichen += anzeige.length;
      if (aus.length >= MAX_SAETZE || zeichen > MAX_ZEICHEN) return aus;
      aus.push({ ...a, anzeige, block: b, von: r.von, bis: r.bis });
    }
  }
  return aus;
}

/** Kleinste Teilmenge eines DOM-Knotens, die `ersterIndexAb` braucht. */
export interface MitKnoten {
  segmente: readonly { knoten: unknown }[];
}

/**
 * Index des ersten Satzes, dessen Textblock im Dokument bei oder nach einer Stelle liegt
 * («ab hier vorlesen»). `istAb(knoten)` sagt für einen Textknoten, ob er zur Stelle gehört oder danach kommt.
 * Kein Treffer: 0 (von vorn).
 */
export function ersterIndexAb(
  saetze: readonly Satz[],
  bloecke: readonly MitKnoten[],
  istAb: (knoten: unknown) => boolean,
): number {
  const blockAb = bloecke.findIndex((b) => b.segmente.some((s) => istAb(s.knoten)));
  if (blockAb < 0) return 0;
  const i = saetze.findIndex((s) => s.block >= blockAb);
  return i < 0 ? 0 : i;
}
