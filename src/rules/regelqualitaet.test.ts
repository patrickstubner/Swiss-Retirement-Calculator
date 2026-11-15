// Regel-Prüftests T-02 und T-03 (docs/testplan): jede Regeländerung muss
// belegt sein, und Schlüssel bleiben über Regeljahre hinweg stabil.
import { describe, expect, it } from 'vitest';
import json2026 from './2026.json';
import json2027 from './2027.json';

type Knoten = { value: unknown; source?: unknown; stand?: unknown; status?: unknown };

function eintraege(json: unknown): [string, Knoten][] {
  const out: [string, Knoten][] = [];
  const lauf = (o: unknown, pfad: string) => {
    if (o === null || typeof o !== 'object') return;
    if ('value' in o && 'status' in o) {
      out.push([pfad, o as Knoten]);
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

// Verifizierte Werte, die bewusst mit Gesetzes- oder Formularzitat statt URL
// belegt sind. Neue Einträge nur mit Begründung im PR.
const VERIFIZIERT_OHNE_URL = new Set([
  'bvg.teilbezugMaxSchritte', // Art. 13a, 13b BVG
  'bvg.einkaufSperrfristJahre', // Art. 79b Abs. 3 BVG
  'steuern.dbgAbzugProKind', // VKP AS 2025 579 (nur 2026)
  'steuern.dbgTarifAuchFuerKapital', // ESTV Formular 58c
  'steuern.quellensteuer.rentenBund', // Art. 95/96 Abs. 2 DBG
]);

// Schlüssel mit Jahreszahl sind nur erlaubt, wenn das Jahr Teil des
// Sachverhalts ist (Reform, einmalige Anpassung), nicht der Geltungsjahr-Wert.
const JAHR_IM_SCHLUESSEL_ERLAUBT = new Set([
  'ahv.rentenanpassung2027', // einmalige Anpassung
  'ahv.reformAhv2030', // Reformpaket
  'langlebigkeit.anteilHundertjaehrigeJg1967', // Geburtsjahrgang
]);

const REGELWERKE: [number, unknown][] = [
  [2026, json2026],
  [2027, json2027],
];

describe.each(REGELWERKE)('Regelqualität %i', (_jahr, json) => {
  const alle = eintraege(json);

  it('findet Regelwerte', () => {
    expect(alle.length).toBeGreaterThan(100);
  });

  it('T-02: jeder Wert hat source, stand und gültigen status', () => {
    const fehler = alle
      .filter(
        ([, k]) =>
          typeof k.source !== 'string' ||
          k.source.trim() === '' ||
          typeof k.stand !== 'string' ||
          k.stand.trim() === '' ||
          (k.status !== 'verifiziert' && k.status !== 'offen'),
      )
      .map(([p]) => p);
    expect(fehler).toEqual([]);
  });

  it('T-02: verifizierte Werte haben einen Stand und eine https-Quelle (oder stehen auf der Ausnahmeliste)', () => {
    const fehler = alle
      .filter(([, k]) => k.status === 'verifiziert')
      .filter(([p, k]) => {
        const standOk = typeof k.stand === 'string' && k.stand.trim() !== '–';
        const urlOk = typeof k.source === 'string' && /https:\/\/\S+/.test(k.source);
        return !standOk || (!urlOk && !VERIFIZIERT_OHNE_URL.has(p));
      })
      .map(([p]) => p);
    expect(fehler).toEqual([]);
  });

  it('T-03: keine Jahreszahl im Schlüssel ausser Ausnahmeliste', () => {
    const fehler = alle.map(([p]) => p).filter((p) => /(19|20)\d\d/.test(p) && !JAHR_IM_SCHLUESSEL_ERLAUBT.has(p));
    expect(fehler).toEqual([]);
  });
});

describe('Regelqualität über Jahre', () => {
  it('Ausnahmelisten enthalten nur existierende Schlüssel', () => {
    const schluessel = new Set(REGELWERKE.flatMap(([, j]) => eintraege(j).map(([p]) => p)));
    for (const s of [...VERIFIZIERT_OHNE_URL, ...JAHR_IM_SCHLUESSEL_ERLAUBT]) expect(schluessel.has(s), s).toBe(true);
  });

  it('beide Regeljahre haben dieselben Schlüssel', () => {
    const a = eintraege(json2026)
      .map(([p]) => p)
      .sort();
    const b = eintraege(json2027)
      .map(([p]) => p)
      .sort();
    expect(b).toEqual(a);
  });
});
