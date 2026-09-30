/**
 * Zeitschätzung und Sprungberechnung für «10 Sekunden zurück/vor». Reine Funktionen.
 *
 * Die Web Speech API kann nicht auf eine Zeit springen und meldet keine Gesamtdauer. Die Dauer eines Satzes wird
 * deshalb aus der Zeichenzahl des Sprechtexts geschätzt (Zeichen pro Sekunde je Tempo) und laufend an der
 * gemessenen Dauer schon gelesener Sätze kalibriert. Gesprungen wird nur auf Satzanfänge.
 */

/** Sprechgeschwindigkeit bei Tempo 1 (Zeichen pro Sekunde), Ausgangswert vor der ersten Messung. */
export const START_ZEICHEN_PRO_SEKUNDE = 14;
export const MIN_ZEICHEN_PRO_SEKUNDE = 6;
export const MAX_ZEICHEN_PRO_SEKUNDE = 30;
/** Sätze unter diesen Grenzen sind zu kurz für eine brauchbare Messung. */
const MIN_MESS_ZEICHEN = 20;
const MIN_MESS_SEKUNDEN = 0.8;
/** Gewicht der neuen Messung im gleitenden Mittel. */
const ALPHA = 0.3;

const klemme = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const endlich = (x: number, ersatz: number) => (Number.isFinite(x) ? x : ersatz);

/** Geschätzte Sprechdauer in Sekunden. `cpsBasis` = kalibrierte Zeichen pro Sekunde bei Tempo 1. */
export function schaetzeDauer(zeichen: number, tempo: number, cpsBasis = START_ZEICHEN_PRO_SEKUNDE): number {
  const z = Math.max(0, endlich(zeichen, 0));
  const t = klemme(endlich(tempo, 1), 0.1, 10);
  const cps =
    klemme(endlich(cpsBasis, START_ZEICHEN_PRO_SEKUNDE), MIN_ZEICHEN_PRO_SEKUNDE, MAX_ZEICHEN_PRO_SEKUNDE) * t;
  // Pause zwischen Sätzen: etwa 0,25 s, bei höherem Tempo kürzer
  return z / cps + 0.25 / t;
}

/**
 * Neue Kalibrierung aus einer Messung (gleitendes Mittel). Zu kurze oder unplausible Messungen ändern nichts.
 * Rückgabe: neue Zeichen pro Sekunde bei Tempo 1.
 */
export function kalibriere(cpsBasis: number, zeichen: number, sekunden: number, tempo: number): number {
  const alt = klemme(endlich(cpsBasis, START_ZEICHEN_PRO_SEKUNDE), MIN_ZEICHEN_PRO_SEKUNDE, MAX_ZEICHEN_PRO_SEKUNDE);
  if (!(zeichen >= MIN_MESS_ZEICHEN) || !(sekunden >= MIN_MESS_SEKUNDEN) || !(tempo > 0)) return alt;
  const gemessen = zeichen / sekunden / tempo;
  if (!Number.isFinite(gemessen)) return alt;
  return klemme(alt * (1 - ALPHA) + gemessen * ALPHA, MIN_ZEICHEN_PRO_SEKUNDE, MAX_ZEICHEN_PRO_SEKUNDE);
}

/**
 * Zielsatz für einen Sprung um `delta` Sekunden.
 *
 * @param dauern geschätzte Dauer je Satz
 * @param index aktueller Satz
 * @param fortschritt Sekunden seit Beginn des aktuellen Satzes (wird auf dessen Dauer begrenzt)
 * @param delta negativ = zurück, positiv = vor
 * @returns Index des Satzes, bei dem weitergelesen wird; `dauern.length` = über das Ende hinaus (fertig)
 */
export function sprungZiel(dauern: readonly number[], index: number, fortschritt: number, delta: number): number {
  const n = dauern.length;
  if (n === 0) return 0;
  const i = Math.min(Math.max(0, Math.trunc(endlich(index, 0))), n - 1);
  const d = endlich(delta, 0);
  const summeVor = dauern.slice(0, i).reduce((s, x) => s + Math.max(0, endlich(x, 0)), 0);
  const imSatz = Math.min(Math.max(0, endlich(fortschritt, 0)), Math.max(0, dauern[i] ?? 0));
  const ziel = summeVor + imSatz + d;
  if (ziel <= 0) return 0;

  // Satz suchen, der die Zielzeit enthält (kein Treffer = hinter dem Ende)
  let start = 0;
  let treffer = n;
  for (let k = 0; k < n; k++) {
    const dauer = Math.max(0, endlich(dauern[k] ?? 0, 0));
    if (ziel < start + dauer) {
      treffer = k;
      break;
    }
    start += dauer;
  }
  if (d > 0) {
    // vorwärts: mindestens ein Satz weiter
    return Math.min(n, Math.max(treffer, i + 1));
  }
  if (d < 0) {
    // zurück: höchstens der aktuelle Satz (dann von vorn), nie hinter den aktuellen
    return Math.min(treffer, i);
  }
  return i;
}
