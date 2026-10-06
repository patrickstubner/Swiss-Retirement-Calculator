import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import { csvFeld } from '../core/jahresTabelle';
import { simuliere } from '../core/simulation';
import type { Haushalt } from '../core/typen';
import {
  neueAusgabenPhase,
  neueAuslandRente,
  neueKrisenAuswahl,
  neuePerson,
  neuerPosten,
  neuesAusgabenEinzeljahr,
  neuesEreignis,
  standardHaushalt,
} from '../data/defaults';
import { ladeRegeln } from '../rules';
import { ausHash, dekodiere, kodiere, normalisiere } from './state';
import { exportiere, importiere } from './szenarien';
import { AHV_VERSCHIEBUNG_MIN, begrenze, GRENZEN, klemme, MAX_HASH_LAENGE, zahlenPfade } from './validierung';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };

/** Deterministischer Zufall (mulberry32), damit Fuzz-Tests reproduzierbar sind. */
function zufall(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXTREM = [0, -1, 1, 5, -0.9, 400, 1e8, -1e8, 1e9, 1e12, 1e300, -1e300, Number.MAX_VALUE, 1969, 3000, 0.5];

/** Ersetzt zufällig ausgewählte Zahlen eines Objekts durch Extremwerte, Strings, null, NaN usw. */
function verderbe(w: unknown, r: () => number, wahrsch: number): unknown {
  if (typeof w === 'number') {
    if (r() > wahrsch) return w;
    const x = r();
    if (x < 0.7) return EXTREM[Math.floor(r() * EXTREM.length)];
    if (x < 0.8) return String(w);
    if (x < 0.9) return null;
    return { x: 1 };
  }
  if (Array.isArray(w)) return w.map((v) => verderbe(v, r, wahrsch));
  if (w !== null && typeof w === 'object')
    return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, verderbe(v, r, wahrsch)]));
  return w;
}

function pruefeEndlich(w: unknown, pfad = ''): void {
  if (typeof w === 'number') {
    if (!Number.isFinite(w)) throw new Error(`nicht endlich: ${pfad}`);
  } else if (Array.isArray(w)) for (const [i, v] of w.entries()) pruefeEndlich(v, `${pfad}[${i}]`);
  else if (w !== null && typeof w === 'object')
    for (const [k, v] of Object.entries(w)) pruefeEndlich(v, `${pfad}.${k}`);
}

function vollerHaushalt(): Haushalt {
  const h = standardHaushalt(regeln);
  const p = h.personen[0] ?? neuePerson(regeln, {});
  return {
    ...h,
    zivilstand: 'verheiratet',
    personen: [
      { ...p, auslandRenten: [neueAuslandRente()] },
      neuePerson(regeln, { name: 'Person 2', geschlecht: 'w', auslandRenten: [neueAuslandRente()] }),
    ],
    posten: [neuerPosten('ausgabe'), neuerPosten('einnahme')],
    ereignisse: [neuesEreignis()],
    ausgaben: { ...h.ausgaben, phasen: [neueAusgabenPhase(60, 70)], einzeljahre: [neuesAusgabenEinzeljahr(2030)] },
    krisen: { ...h.krisen, auswahl: [neueKrisenAuswahl('', 'CHE', 2030)] },
  };
}

describe('Validierungsschema: Abdeckung', () => {
  it('jedes Zahlenfeld des vollständigen Haushalts hat einen Bereich (Ausnahme: Geburtsjahr, dynamisch)', () => {
    const pfade = zahlenPfade(vollerHaushalt());
    const fehlend = [...pfade].filter((p) => !(p in GRENZEN) && p !== 'personen.*.geburtsjahr');
    expect(fehlend).toEqual([]);
  });

  it('jeder Eintrag der Tabelle hat min ≤ max', () => {
    for (const [pfad, [min, max]] of Object.entries(GRENZEN)) expect(min, pfad).toBeLessThanOrEqual(max);
  });

  it('AHV-Bezugsverschiebung reicht bis zum weitesten gesetzlichen Vorbezug', () => {
    const bereich = GRENZEN['personen.*.ahv.bezugVerschiebungMonate'];
    expect(bereich).toEqual([AHV_VERSCHIEBUNG_MIN, 60, true]);
    expect(AHV_VERSCHIEBUNG_MIN).toBe(-36);
    if (!bereich) throw new Error('Bereich fehlt');
    expect(klemme(-36, bereich)).toBe(-36);
    expect(klemme(-48, bereich)).toBe(-36);
    // Standardperson ist männlich, Jahrgang 1970: höchstens 24 Monate. −36 und −100 werden darauf gekürzt.
    const n = normalisiere({ personen: [{ ahv: { bezugVerschiebungMonate: -36 } }] }, regeln);
    expect(n.personen[0]?.ahv.bezugVerschiebungMonate).toBe(-24);
    const geklemmt = normalisiere({ personen: [{ ahv: { bezugVerschiebungMonate: -100 } }] }, regeln);
    expect(geklemmt.personen[0]?.ahv.bezugVerschiebungMonate).toBe(-24);
    // Frau der Übergangsgeneration, Kohorte 1965: −36 bleibt zulässig.
    const frau = normalisiere(
      { personen: [{ geburtsjahr: 1965, geschlecht: 'w', ahv: { bezugVerschiebungMonate: -36 } }] },
      regeln,
    );
    expect(frau.personen[0]?.ahv.bezugVerschiebungMonate).toBe(-36);
  });

  it('klemme: NaN/Infinity → im Bereich, Ganzzahlen werden gerundet', () => {
    expect(klemme(Number.NaN, [1, 9])).toBe(1);
    expect(klemme(Number.POSITIVE_INFINITY, [0, 9])).toBe(0);
    expect(klemme(1e300, [0, 9])).toBe(9);
    expect(klemme(3.6, [0, 9, true])).toBe(4);
  });
});

describe('S-01: Geburtsjahr und Zahlenfelder', () => {
  it('Geburtsjahr 1e8 wird auf den erlaubten Bereich geklemmt, Simulation läuft', () => {
    const h = vollerHaushalt();
    const p0 = h.personen[0] as (typeof h.personen)[number];
    const roh = { ...h, personen: [{ ...p0, geburtsjahr: 1e8 }], zivilstand: 'alleinstehend' };
    const n = normalisiere(roh, regeln);
    expect(n.personen[0]?.geburtsjahr).toBe(new Date().getFullYear());
    expect(() => simuliere(n, regeln, { start: heute })).not.toThrow();
  });

  it('Geburtsjahr unter 1900, negativ, NaN, String', () => {
    for (const g of [-5, 0, 1899, Number.NaN, '1980abc', null]) {
      const n = normalisiere({ personen: [{ geburtsjahr: g }] }, regeln);
      const j = n.personen[0]?.geburtsjahr as number;
      expect(j).toBeGreaterThanOrEqual(1900);
      expect(j).toBeLessThanOrEqual(new Date().getFullYear());
    }
  });

  it('Beispiele aus dem Audit: negatives Vermögen, Kapitalanteil 5, Inflation -0.9, Beitragsjahre 400', () => {
    const n = normalisiere(
      {
        annahmen: { inflation: -0.9 },
        ausgaben: { lebenshaltung: -50_000 },
        personen: [{ wertschriften: -1e6, pk: { kapitalanteil: 5 }, ahv: { renteMonat: -500, beitragsjahre: 400 } }],
      },
      regeln,
    );
    const p = n.personen[0];
    expect(n.annahmen.inflation).toBe(-0.05);
    expect(n.ausgaben.lebenshaltung).toBe(0);
    expect(p?.wertschriften).toBe(0);
    expect(p?.pk.kapitalanteil).toBe(1);
    expect(p?.ahv.renteMonat).toBe(0);
    expect(p?.ahv.beitragsjahre).toBe(50);
  });

  it('1e300 ergibt endliche Werte', () => {
    const n = normalisiere(
      { personen: [{ wertschriften: 1e300, lohn: 1e300 }], ausgaben: { lebenshaltung: 1e300 } },
      regeln,
    );
    pruefeEndlich(n);
    expect(n.personen[0]?.wertschriften).toBe(1e9);
  });

  it('Texte werden gekürzt (S-05)', () => {
    const n = normalisiere(
      { personen: [{ name: 'x'.repeat(1_000_000) }], posten: [{ bezeichnung: 'y'.repeat(5000) }] },
      regeln,
    );
    expect(n.personen[0]?.name.length).toBe(100);
    expect(n.posten[0]?.bezeichnung.length).toBe(100);
  });

  it('gültige Standardwerte bleiben unverändert (Idempotenz)', () => {
    const h = vollerHaushalt();
    const einmal = normalisiere(h, regeln);
    expect(normalisiere(einmal, regeln)).toEqual(einmal);
    const std = standardHaushalt(regeln);
    expect(normalisiere(std, regeln)).toEqual(std);
  });
});

describe('S-03: Fuzz-Tests (kein NaN, keine Exception, endliche Ergebnisse, Schranken eingehalten)', () => {
  it('600 verdorbene Haushalte: normalisiere liefert endliche Zahlen in den Bereichen, simuliere wirft nicht', () => {
    const r = zufall(12345);
    const basis = vollerHaushalt();
    let ausserhalb = 0;
    for (let i = 0; i < 600; i++) {
      const roh = verderbe(basis, r, i % 3 === 0 ? 0.6 : 0.15);
      const n = normalisiere(roh, regeln);
      pruefeEndlich(n);
      const pfade = zahlenPfade(n);
      // jede Zahl innerhalb ihres Bereichs
      const pruefe = (w: unknown, pfad: string) => {
        if (typeof w === 'number') {
          const b = GRENZEN[pfad];
          if (b && (w < b[0] || w > b[1])) ausserhalb++;
        } else if (Array.isArray(w)) for (const v of w) pruefe(v, pfad ? `${pfad}.*` : '*');
        else if (w && typeof w === 'object')
          for (const [k, v] of Object.entries(w)) pruefe(v, pfad ? `${pfad}.${k}` : k);
      };
      pruefe(n, '');
      expect(pfade.size).toBeGreaterThan(50);
      const e = simuliere(n, regeln, { start: heute });
      expect(e.zeilen.length).toBeLessThan(1300);
      for (const z of e.zeilen) expect(Number.isFinite(z.vermoegen)).toBe(true);
    }
    expect(ausserhalb).toBe(0);
  }, 60_000);

  it('Kodieren → Dekodieren mit verdorbenen Werten bleibt stabil', () => {
    const r = zufall(777);
    const basis = vollerHaushalt();
    for (let i = 0; i < 200; i++) {
      const roh = verderbe(basis, r, 0.3);
      const s = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 11, h: roh }));
      const h = dekodiere(s, regeln);
      if (h) {
        pruefeEndlich(h);
        expect(() => simuliere(h, regeln, { start: heute })).not.toThrow();
      }
    }
  });

  it('zufällige Zeichenketten und JSON-Formen stürzen nicht ab', () => {
    const r = zufall(99);
    for (let i = 0; i < 300; i++) {
      const s = Array.from({ length: Math.floor(r() * 300) }, () => String.fromCharCode(Math.floor(r() * 255))).join(
        '',
      );
      expect(() => ausHash(`#s=${s}`, regeln)).not.toThrow();
      expect(() => importiere(s, regeln)).not.toThrow();
    }
    for (const x of [
      null,
      1,
      'a',
      [],
      [[]],
      { personen: 5 },
      { personen: [null, 3, 'x'] },
      { posten: 'x' },
      { krisen: [] },
    ]) {
      expect(() => normalisiere(x, regeln)).not.toThrow();
    }
  });
});

describe('Prototype Pollution', () => {
  it('__proto__, constructor, prototype in Link, Import und Speicher ändern Object.prototype nicht', () => {
    const boese =
      '{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":2}},"personen":[{"__proto__":{"polluted":3},"constructor":{"prototype":{"polluted":4}}}],"annahmen":{"__proto__":{"polluted":5}}}';
    const n = normalisiere(JSON.parse(boese), regeln);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((n as unknown as Record<string, unknown>).polluted).toBeUndefined();
    const b = begrenze(JSON.parse(boese));
    expect(Object.keys(b)).not.toContain('__proto__');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const s = LZString.compressToEncodedURIComponent(`{"v":11,"h":${boese}}`);
    expect(dekodiere(s, regeln)).not.toBeNull();
    const datei = `{"app":"ruhestandsrechner","typ":"szenarien","a":${boese},"b":${boese}}`;
    expect(importiere(datei, regeln)).not.toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('S-04/S-08: Längenlimits', () => {
  it('zu langer Link wird verworfen', () => {
    expect(dekodiere('A'.repeat(MAX_HASH_LAENGE + 1), regeln)).toBeNull();
  });

  it('Link mit vollem Haushalt passt in das Limit', () => {
    expect(kodiere(vollerHaushalt()).length).toBeLessThan(MAX_HASH_LAENGE / 2);
  });

  it('Zip-Bomb-artiger Link (entpackt über 1 MB) wird verworfen', () => {
    const gross = LZString.compressToEncodedURIComponent(`{"v":11,"h":{"x":"${'a'.repeat(3_000_000)}"}}`);
    expect(gross.length).toBeLessThan(MAX_HASH_LAENGE);
    expect(dekodiere(gross, regeln)).toBeNull();
    // Zeitlimit grosszügig: das Entpacken von 3 MB dauert auf langsamen CI-Rechnern sonst nahe an 5 s (flaky).
  }, 60_000);

  it('zu grosser Import wird verworfen, normaler Export lässt sich importieren', () => {
    const h = vollerHaushalt();
    const text = exportiere(h, h, { a: 'A', b: 'B' });
    expect(importiere(text, regeln)).not.toBeNull();
    expect(importiere(`${text}${' '.repeat(1_000_001)}`, regeln)).toBeNull();
  });
});

describe('Guard in simuliere (A2)', () => {
  it('Zeitraum über 1200 Jahre wird mit klarer Meldung abgewiesen', () => {
    const h = vollerHaushalt();
    const roh = { ...h, planungsalter: 999 } as Haushalt;
    const p = { ...(roh.personen[0] as Haushalt['personen'][number]), geburtsjahr: 1e6 };
    roh.personen = [p, roh.personen[1] as Haushalt['personen'][number]];
    expect(() => simuliere(roh, regeln, { start: heute })).toThrow(/Zeitraum zu lang/);
    expect(() => simuliere({ ...roh, planungsalter: Number.NaN }, regeln, { start: heute })).toThrow();
  });
});

describe('S-06: CSV-Formel-Injection', () => {
  it('führendes = + - @ Tab CR wird neutralisiert', () => {
    for (const z of ['=1+1', '+SUMME(A1)', '-2+3', '@BEFEHL', '\tx', '\rx']) {
      const f = csvFeld(z);
      expect(f.replace(/^"/, '').startsWith("'")).toBe(true);
    }
  });

  it('normaler Text bleibt, Sonderzeichen werden gequotet', () => {
    expect(csvFeld('Alter')).toBe('Alter');
    expect(csvFeld('Betrag (CHF)')).toBe('Betrag (CHF)');
    expect(csvFeld('a;b')).toBe('"a;b"');
    expect(csvFeld('a"b')).toBe('"a""b"');
    expect(csvFeld('a\rb')).toBe('"a\rb"');
  });
});
