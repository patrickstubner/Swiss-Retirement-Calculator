/**
 * Zahlenschutz an den Eingängen des Rechenkerns (Audit SEC-02).
 * Die Oberfläche klemmt Eingaben, aber direkte Aufrufe (Tests, Skripte, künftige Importe) sollen weder NaN noch
 * Infinity weiterreichen: Reine Rechenfunktionen ersetzen nicht endliche Eingaben durch einen sicheren Ersatzwert,
 * die Simulation weist nicht endliche Eingaben mit einer klaren Fehlermeldung ab.
 */

/** Endliche Zahl, sonst `ersatz` (NaN, Infinity und −Infinity zählen als ungültig). */
export function endlich(x: number, ersatz = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : ersatz;
}

/** Pfad der ersten nicht endlichen Zahl in einer Struktur aus Objekten, Listen und Zahlen; sonst null. */
export function ersteNichtEndlicheZahl(wert: unknown, pfad = '', tiefe = 0): string | null {
  if (typeof wert === 'number') return Number.isFinite(wert) ? null : pfad || '(Wert)';
  if (wert === null || typeof wert !== 'object' || tiefe > 12) return null;
  if (Array.isArray(wert)) {
    for (let i = 0; i < wert.length; i++) {
      const f = ersteNichtEndlicheZahl(wert[i], `${pfad}[${i}]`, tiefe + 1);
      if (f) return f;
    }
    return null;
  }
  for (const [k, v] of Object.entries(wert)) {
    const f = ersteNichtEndlicheZahl(v, pfad ? `${pfad}.${k}` : k, tiefe + 1);
    if (f) return f;
  }
  return null;
}
