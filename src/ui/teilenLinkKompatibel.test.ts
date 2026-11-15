// Vorbereitung RR-7 (nur Tests, kein Produktcode): hält das heutige Verhalten von
// Teilen-Links fest, damit ein späteres Feld «r» (Regeljahr) und ein Hinweis bei
// neueren Schemata rückwärtskompatibel eingeführt werden können.
import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import { standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { dekodiere, kodiere, SCHEMA_VERSION } from './state';

const regeln = ladeRegeln(2026);
const roh = (g: unknown) => LZString.compressToEncodedURIComponent(JSON.stringify(g));

describe('Teilen-Link: Kompatibilität (Charakterisierung)', () => {
  it('heutiger Link enthält nur v und h, kein Regeljahr', () => {
    const g = JSON.parse(LZString.decompressFromEncodedURIComponent(kodiere(standardHaushalt(regeln))));
    expect(Object.keys(g).sort()).toEqual(['h', 'v']);
    expect(g.v).toBe(SCHEMA_VERSION);
  });

  it('ein zusätzliches Feld r (künftiges Regeljahr) wird ignoriert, der Haushalt bleibt gleich', () => {
    const h = standardHaushalt(regeln);
    expect(dekodiere(roh({ v: SCHEMA_VERSION, r: 2027, h }), regeln)).toEqual(dekodiere(kodiere(h), regeln));
  });

  it('IST-Verhalten: Link mit neuerem Schema (v > SCHEMA_VERSION) wird still geladen, ohne Hinweis', () => {
    const h = standardHaushalt(regeln);
    expect(dekodiere(roh({ v: SCHEMA_VERSION + 1, h }), regeln)).not.toBeNull();
  });

  it('Link ohne Versionsnummer wird abgelehnt', () => {
    expect(dekodiere(roh({ h: standardHaushalt(regeln) }), regeln)).toBeNull();
  });
});
