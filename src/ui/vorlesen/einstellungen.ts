/**
 * Einstellungen des Vorlesens (Tempo, Stimme). Sie werden nur gespeichert, wenn der Schalter
 * «Eingaben im Browser speichern» an ist; beim Ausschalten löscht `loescheLokal` (state.ts) den Schlüssel mit.
 */
import { AUS_KEY, VORLESEN_KEY } from '../state';
import { STANDARD_TEMPO, TEMPI } from './controller';

export interface VorleseEinstellungen {
  tempo: number;
  stimme: string | null;
}

export const STANDARD_EINSTELLUNGEN: VorleseEinstellungen = { tempo: STANDARD_TEMPO, stimme: null };

const speichernAn = (s: Storage | null) => s !== null && s.getItem(AUS_KEY) !== '1';

/** Prüft ein unbekanntes Objekt: nur bekannte Tempi und kurze Stimmen-Kennungen. */
export function bereinige(roh: unknown): VorleseEinstellungen {
  if (typeof roh !== 'object' || roh === null) return STANDARD_EINSTELLUNGEN;
  const o = roh as Record<string, unknown>;
  const tempo =
    typeof o.tempo === 'number' && (TEMPI as readonly number[]).includes(o.tempo) ? o.tempo : STANDARD_TEMPO;
  const stimme = typeof o.stimme === 'string' && o.stimme.length > 0 && o.stimme.length <= 200 ? o.stimme : null;
  return { tempo, stimme };
}

export function ladeEinstellungen(s: Storage | null): VorleseEinstellungen {
  if (!s || !speichernAn(s)) return STANDARD_EINSTELLUNGEN;
  try {
    const t = s.getItem(VORLESEN_KEY);
    if (t === null || t.length > 2000) return STANDARD_EINSTELLUNGEN;
    return bereinige(JSON.parse(t));
  } catch {
    return STANDARD_EINSTELLUNGEN;
  }
}

/** Speichert nur, wenn der Speichern-Schalter an ist; sonst passiert nichts. */
export function speichereEinstellungen(s: Storage | null, e: VorleseEinstellungen): void {
  if (!s || !speichernAn(s)) return;
  try {
    s.setItem(VORLESEN_KEY, JSON.stringify(bereinige(e)));
  } catch {
    // Speicher voll oder gesperrt: Einstellung geht verloren, kein Fehler für den Nutzer
  }
}
