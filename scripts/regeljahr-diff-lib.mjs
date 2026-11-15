/**
 * Vergleicht zwei Regeldateien (src/rules/<jahr>.json) Schlüssel für Schlüssel.
 * Reine Funktionen ohne Abhängigkeiten, getestet in src/regeljahrDiff.test.ts.
 */

/** @param {unknown} json */
export function flach(json) {
  /** @type {Map<string, {value: unknown, source: unknown, stand: unknown, status: unknown}>} */
  const out = new Map();
  /** @param {unknown} o @param {string} pfad */
  const lauf = (o, pfad) => {
    if (o === null || typeof o !== 'object' || Array.isArray(o)) return;
    if ('value' in o && 'status' in o) {
      const k = /** @type {Record<string, unknown>} */ (o);
      out.set(pfad, { value: k.value, source: k.source, stand: k.stand, status: k.status });
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      if (pfad === '' && k === 'meta') continue;
      lauf(v, pfad ? `${pfad}.${k}` : k);
    }
  };
  lauf(json, '');
  return out;
}

const gleich = (/** @type {unknown} */ a, /** @type {unknown} */ b) => JSON.stringify(a) === JSON.stringify(b);

/** @param {unknown} alt @param {unknown} neu */
export function regeljahrDiff(alt, neu) {
  const a = flach(alt);
  const n = flach(neu);
  const neuHinzu = [...n.keys()].filter((k) => !a.has(k)).sort();
  const entfernt = [...a.keys()].filter((k) => !n.has(k)).sort();
  /** @type {{schluessel: string, felder: string[], alt: unknown, neu: unknown, statusAlt: unknown, statusNeu: unknown}[]} */
  const geaendert = [];
  let unveraendert = 0;
  for (const [k, va] of a) {
    const vn = n.get(k);
    if (!vn) continue;
    const felder = /** @type {const} */ (['value', 'status', 'source', 'stand']).filter((f) => !gleich(va[f], vn[f]));
    if (felder.length === 0) unveraendert++;
    else
      geaendert.push({
        schluessel: k,
        felder,
        alt: va.value,
        neu: vn.value,
        statusAlt: va.status,
        statusNeu: vn.status,
      });
  }
  geaendert.sort((x, y) => x.schluessel.localeCompare(y.schluessel));
  const offenNeu = [...n]
    .filter(([, v]) => v.status === 'offen')
    .map(([k]) => k)
    .sort();
  return { neuHinzu, entfernt, geaendert, unveraendert, offenNeu };
}

/** @param {unknown} v */
function kurz(v) {
  const s = JSON.stringify(v) ?? 'undefined';
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}

/** @param {ReturnType<typeof regeljahrDiff>} d @param {string} von @param {string} nach */
export function alsMarkdown(d, von, nach) {
  const z = [`# Regeljahr-Diff ${von} → ${nach}`, ''];
  z.push(
    `Geändert: ${d.geaendert.length}, neu: ${d.neuHinzu.length}, entfernt: ${d.entfernt.length}, unverändert: ${d.unveraendert}, offen in ${nach}: ${d.offenNeu.length}`,
    '',
  );
  if (d.geaendert.length) {
    z.push('## Geändert', '', '| Schlüssel | Felder | Wert alt | Wert neu | Status |', '|---|---|---|---|---|');
    for (const g of d.geaendert) {
      const wertAlt = g.felder.includes('value') ? kurz(g.alt) : '';
      const wertNeu = g.felder.includes('value') ? kurz(g.neu) : '';
      const status = g.statusAlt === g.statusNeu ? String(g.statusNeu) : `${g.statusAlt} → ${g.statusNeu}`;
      z.push(
        `| ${g.schluessel} | ${g.felder.join(', ')} | ${wertAlt.replaceAll('|', '\\|')} | ${wertNeu.replaceAll('|', '\\|')} | ${status} |`,
      );
    }
    z.push('');
  }
  if (d.neuHinzu.length) z.push('## Neu', '', ...d.neuHinzu.map((k) => `- ${k}`), '');
  if (d.entfernt.length) z.push('## Entfernt', '', ...d.entfernt.map((k) => `- ${k}`), '');
  if (d.offenNeu.length) z.push(`## Offen in ${nach}`, '', ...d.offenNeu.map((k) => `- ${k}`), '');
  return z.join('\n');
}
