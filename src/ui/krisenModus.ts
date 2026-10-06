/**
 * Wechsel des Krisenmodus in der Karte «Krisen».
 * «Individuell» mit leerer Liste übernimmt sofort die automatischen Krisen (Ausgleich ein).
 * Eine schon gefüllte Liste bleibt. Die Rechnung selbst ändert diese Funktion nicht.
 */
import type { KrisenAuswahl, KrisenEinstellungen, KrisenModus } from '../core/typen';

export function krisenNachModuswechsel(
  k: KrisenEinstellungen,
  modus: KrisenModus,
  uebernahme: readonly KrisenAuswahl[],
): { krisen: KrisenEinstellungen; hinweis: string | null } {
  if (modus !== 'individuell' || k.auswahl.length > 0) {
    return { krisen: { ...k, modus }, hinweis: null };
  }
  if (uebernahme.length === 0) {
    return {
      krisen: { ...k, modus },
      hinweis: 'Im Planungshorizont liegt keine automatische Krise.',
    };
  }
  return {
    krisen: { ...k, modus, auswahl: [...uebernahme], ausgleich: true },
    hinweis: null,
  };
}
