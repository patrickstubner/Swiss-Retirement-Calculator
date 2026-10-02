/** Versionsregel: Jeder Pull Request erhöht die Version in package.json gegenüber dem Zielzweig (SemVer, ohne Zusätze). */

const MUSTER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Zerlegt «major.minor.patch» in drei Zahlen; null bei ungültiger Form. */
export function parseVersion(text) {
  const m = typeof text === 'string' ? MUSTER.exec(text.trim()) : null;
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** -1, 0 oder 1; null, wenn eine Version ungültig ist. */
export function vergleicheVersion(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}

/**
 * Prüft die Version eines PR gegen die Version des Zielzweigs.
 * @returns {{ ok: boolean, meldung: string }}
 */
export function pruefeVersionsErhoehung(basis, kopf) {
  if (!parseVersion(kopf))
    return { ok: false, meldung: `Version im PR ist ungültig (erwartet major.minor.patch): ${String(kopf)}` };
  if (!parseVersion(basis)) return { ok: false, meldung: `Version im Zielzweig ist ungültig: ${String(basis)}` };
  const v = vergleicheVersion(kopf, basis);
  if (v === 1) return { ok: true, meldung: `Version erhöht: ${basis} → ${kopf}` };
  if (v === 0)
    return {
      ok: false,
      meldung: `Version in package.json nicht erhöht (weiterhin ${kopf}). Patch-Stelle erhöhen (bei grösseren Änderungen Minor-Stelle), siehe CONTRIBUTING.md.`,
    };
  return { ok: false, meldung: `Version im PR (${kopf}) ist kleiner als im Zielzweig (${basis}).` };
}
