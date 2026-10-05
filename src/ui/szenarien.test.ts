import { describe, expect, it } from 'vitest';
import { simuliere } from '../core/simulation';
import type { Haushalt, JahresZeile, SimulationsErgebnis } from '../core/typen';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { krisenOptionen } from '../data/krisen';
import { ladeRegeln } from '../rules';
import { vergleichsLaeufe, vergleichsMonteCarlo } from './mcKern';
import {
  ALTE_KEYS,
  AUS_KEY,
  bereinigeName,
  ladeLokal,
  ladeStartzustand,
  normalisiere,
  normalisiereSzenarien,
  SCHEMA_VERSION,
  SPEICHER_VERSION,
  STANDARD_NAMEN,
  STANDARD_UI,
  STORAGE_KEY,
  setzeSpeichern,
  speichereLokal,
} from './state';
import {
  exportiere,
  gemeinsamerVerlauf,
  importiere,
  kennzahlen,
  kopiere,
  legeBAn,
  loescheVersion,
  ruhestandsZeilen,
  tausche,
  ueberschreibe,
  urteil,
  vergleiche,
  zaehleUrteile,
} from './szenarien';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };

class TestSpeicher implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  schluessel() {
    return [...this.m.keys()];
  }
}

function fall(): Haushalt {
  const h = standardHaushalt(regeln);
  const p = neuePerson(regeln, {
    name: 'Person 1',
    geburtsjahr: 1966,
    geburtsmonat: 1,
    geschlecht: 'm',
    lohn: 100000,
    stoppAlter: 62,
    stoppModus: 'alter',
    bargeld: 100000,
  });
  p.wertschriften = 200000;
  p.pk = { ...p.pk, guthaben: 500000, beitragModus: 'eingabe', sparbeitragJahr: 20000, umwandlungssatz: 0.05 };
  p.saeule3a = { ...p.saeule3a, guthaben: 300000, beitragJahr: 0 };
  p.manuell = { pkGuthaben: true, pkSparbeitrag: true, pkUmwandlungssatz: true } as never;
  return { ...h, personen: [p], ausgaben: { ...h.ausgaben, lebenshaltung: 60000 } };
}
const spaeter = (h: Haushalt, alter: number, stoppModus: 'alter' = 'alter'): Haushalt => ({
  ...h,
  personen: h.personen.map((p) => ({ ...p, stoppAlter: alter, stoppModus })),
});
const sim = (h: Haushalt): SimulationsErgebnis => simuliere(h, regeln, { start: heute, krisen: krisenOptionen(h) });

describe('Versionen verwalten', () => {
  it('B startet als tiefe Kopie von A (Änderung an B ändert A nicht)', () => {
    const a = fall();
    const p = legeBAn(a);
    expect(p.b).toEqual(a);
    expect(p.b).not.toBe(a);
    (p.b.personen[0] as { stoppAlter: number }).stoppAlter = 70;
    expect(a.personen[0]?.stoppAlter).toBe(62);
    expect(p.namen).toEqual(STANDARD_NAMEN);
  });

  it('tauschen vertauscht Inhalt und Namen', () => {
    const a = fall();
    const b = { ...fall(), planungsalter: 90 };
    const t = tausche({ a, b, namen: { a: 'Früh', b: 'Spät' } });
    expect(t.a.planungsalter).toBe(90);
    expect(t.b.planungsalter).toBe(a.planungsalter);
    expect(t.namen).toEqual({ a: 'Spät', b: 'Früh' });
    // zweimal tauschen = Ausgangslage
    expect(tausche(t)).toEqual({ a, b, namen: { a: 'Früh', b: 'Spät' } });
  });

  it('kopieren überschreibt nur die Zielversion und behält deren Namen', () => {
    const a = fall();
    const b = { ...fall(), planungsalter: 90 };
    const p = { a, b, namen: { a: 'Früh', b: 'Spät' } };
    const ab = ueberschreibe(p, 'A');
    expect(ab.b).toEqual(a);
    expect(ab.a).toBe(a);
    expect(ab.namen).toEqual(p.namen);
    const ba = ueberschreibe(p, 'B');
    expect(ba.a.planungsalter).toBe(90);
    expect(ba.b).toBe(b);
  });

  it('löschen: die andere Version bleibt als einzige übrig', () => {
    const a = fall();
    const b = { ...fall(), planungsalter: 90 };
    const p = { a, b, namen: { a: 'Früh', b: 'Spät' } };
    expect(loescheVersion(p, 'A')).toEqual({ haushalt: b, name: 'Spät' });
    expect(loescheVersion(p, 'B')).toEqual({ haushalt: a, name: 'Früh' });
  });

  it('Namen: getrimmt, gekürzt, leer → Standard', () => {
    expect(bereinigeName('  Früher   Rücktritt ', 'Version A')).toBe('Früher Rücktritt');
    expect(bereinigeName('   ', 'Version A')).toBe('Version A');
    expect(bereinigeName(42, 'Version B')).toBe('Version B');
    expect(bereinigeName('x'.repeat(100), 'Version A')).toHaveLength(40);
  });
});

describe('Kennzahlen und «Was ist besser?»', () => {
  const a = fall();
  const bH = spaeter(fall(), 66);
  const ea = sim(a);
  const eb = sim(bH);

  it('gleiche Version ergibt überall «gleichwertig» und Differenz 0', () => {
    const k = kennzahlen(ea, a.planungsalter, 'real', null);
    const z = vergleiche(k, k);
    for (const r of z.filter((x) => x.a !== null)) {
      expect(r.diff).toBe(0);
      expect(r.urteil).toBe('gleich');
    }
    expect(zaehleUrteile(z)).toMatchObject({ a: 0, b: 0 });
  });

  it('Monte-Carlo-Kennzahlen fehlen, solange nicht gerechnet: kein Urteil', () => {
    const k = kennzahlen(ea, a.planungsalter, 'real', null);
    const z = vergleiche(k, k);
    expect(z.find((r) => r.id === 'erfolgsquote')).toMatchObject({ a: null, b: null, diff: null, urteil: null });
  });

  it('Endvermögen entspricht dem Ergebnis der Simulation (real und nominal)', () => {
    const real = kennzahlen(ea, a.planungsalter, 'real', null);
    const nom = kennzahlen(ea, a.planungsalter, 'nominal', null);
    expect(real.endVermoegen).toBeCloseTo(ea.endVermoegen, 6);
    expect(nom.endVermoegen).toBeCloseTo(ea.endVermoegen * (ea.zeilen.at(-1)?.indexEnde ?? 1), 6);
    expect(nom.endVermoegen).not.toBe(real.endVermoegen);
  });

  it('Steuern total = Summe aller Steuerposten der Jahreszeilen', () => {
    const k = kennzahlen(ea, a.planungsalter, 'real', null);
    const s = ea.zeilen.reduce((t, z) => t + z.steuernEinkommen + z.steuernKapital + z.steuernVermoegen, 0);
    expect(k.steuern).toBeCloseTo(s, 6);
  });

  it('späterer Rücktritt: mehr Endvermögen und Urteil B besser', () => {
    const z = vergleiche(kennzahlen(ea, a.planungsalter, 'real', null), kennzahlen(eb, bH.planungsalter, 'real', null));
    const end = z.find((r) => r.id === 'endVermoegen');
    expect(end?.diff).toBeCloseTo(eb.endVermoegen - ea.endVermoegen, 6);
    expect(eb.endVermoegen).toBeGreaterThan(ea.endVermoegen);
    expect(end?.urteil).toBe('B');
  });

  it('Urteil: hoch/tief, Toleranz, fehlende Werte', () => {
    expect(urteil(1000, 2000, 'chf', 'hoch')).toBe('B');
    expect(urteil(1000, 2000, 'chf', 'tief')).toBe('A');
    expect(urteil(1000, 1050, 'chf', 'hoch')).toBe('gleich');
    expect(urteil(0.9, 0.5, 'prozent', 'hoch')).toBe('A');
    expect(urteil(0.9, 0.9004, 'prozent', 'hoch')).toBe('gleich');
    expect(urteil(90, 95, 'alter', 'hoch')).toBe('B');
    expect(urteil(null, 5, 'alter', 'hoch')).toBeNull();
  });

  it('Verfügbar pro Jahr: Durchschnitt der Nettoeinkommen nur in den Ruhestandsjahren', () => {
    const ruhe = ruhestandsZeilen(ea.zeilen);
    expect(ruhe.length).toBeGreaterThan(0);
    expect(ruhe.every((z) => z.lohn <= 0.5)).toBe(true);
    const letzteErwerb = ea.zeilen.filter((z) => z.lohn > 0.5).at(-1);
    expect(letzteErwerb).toBeDefined();
    expect(ruhe[0]?.jahr).toBe((letzteErwerb as JahresZeile).jahr + 1);
    const k = kennzahlen(ea, a.planungsalter, 'real', null);
    expect(k.verfuegbarProJahr).not.toBeNull();
    expect(k.verfuegbarProJahr as number).toBeGreaterThan(0);
  });

  it('gemeinsamer Verlauf: Kalenderjahre beider Versionen, null ausserhalb des Horizonts', () => {
    const kurz: Haushalt = { ...fall(), planungsalter: 80 };
    const v = gemeinsamerVerlauf(ea, sim(kurz), 'real');
    expect(v.jahre).toEqual([...v.jahre].sort((x, y) => x - y));
    expect(v.a.filter((x) => x !== null).length).toBe(ea.zeilen.length);
    expect(v.b.filter((x) => x === null).length).toBeGreaterThan(0);
  });
});

describe('Monte Carlo im Vergleich', () => {
  it('Läufe begrenzt (50–500) und für gleiche Eingaben deterministisch (gleicher Seed)', () => {
    expect(vergleichsLaeufe(10)).toBe(50);
    expect(vergleichsLaeufe(5000)).toBe(500);
    const h = fall();
    const x = vergleichsMonteCarlo(h, regeln, heute, 60);
    const y = vergleichsMonteCarlo(h, regeln, heute, 60);
    expect(x).toEqual(y);
    expect(x.laeufe).toBe(60);
    expect(x.erfolgsquote).toBeGreaterThanOrEqual(0);
    expect(x.erfolgsquote).toBeLessThanOrEqual(1);
  });

  it('mehr Vermögen erhöht die Erfolgsquote nicht nach unten (gleiche Zufallspfade)', () => {
    const h = fall();
    const reicher: Haushalt = {
      ...h,
      personen: h.personen.map((p) => ({ ...p, wertschriften: p.wertschriften + 600000 })),
    };
    const x = vergleichsMonteCarlo(h, regeln, heute, 60);
    const y = vergleichsMonteCarlo(reicher, regeln, heute, 60);
    expect(y.erfolgsquote).toBeGreaterThanOrEqual(x.erfolgsquote);
  });
});

describe('Speichern der Versionen (Speicher-Version 2)', () => {
  const b = { ...fall(), planungsalter: 90 };
  const namen = { a: 'Früh', b: 'Spät' };

  it('ohne Version B ändert sich das Speicherobjekt nicht (nur Feld «szenarien» fehlt)', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: fall(), ui: STANDARD_UI });
    const obj = JSON.parse(s.getItem(STORAGE_KEY) as string);
    expect(obj.szenarien).toBeUndefined();
    expect(obj.version).toBe(SPEICHER_VERSION);
    expect(Object.keys(obj).sort()).toEqual(['app', 'gespeichertAm', 'haushalt', 'schema', 'ui', 'version']);
    const z = ladeLokal(s, regeln);
    expect(z?.szenarien).toBeUndefined();
    expect(z?.haushalt).toEqual(normalisiere(fall(), regeln));
  });

  it('Version B und Namen werden gespeichert und wieder geladen', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: fall(), ui: STANDARD_UI, szenarien: { b, namen } });
    const z = ladeLokal(s, regeln);
    expect(z?.szenarien?.namen).toEqual(namen);
    expect(z?.szenarien?.b).toEqual(normalisiere(b, regeln));
    expect(ladeStartzustand(regeln, '', s).szenarien?.namen).toEqual(namen);
  });

  it('Speicher-Version 1 (ohne B) lässt sich weiter laden', () => {
    const s = new TestSpeicher();
    s.setItem(
      STORAGE_KEY,
      JSON.stringify({
        app: 'ruhestandsrechner',
        version: 1,
        schema: SCHEMA_VERSION,
        gespeichertAm: '2026-09-01T00:00:00.000Z',
        haushalt: fall(),
        ui: STANDARD_UI,
      }),
    );
    const z = ladeLokal(s, regeln);
    expect(z?.haushalt).toEqual(normalisiere(fall(), regeln));
    expect(z?.szenarien).toBeUndefined();
  });

  it('defekter Szenario-Teil wird ignoriert, Version A bleibt', () => {
    expect(normalisiereSzenarien(undefined, regeln)).toBeUndefined();
    expect(normalisiereSzenarien('x', regeln)).toBeUndefined();
    expect(normalisiereSzenarien({ b: 5 }, regeln)).toBeUndefined();
    const r = normalisiereSzenarien({ b: {}, namen: { a: 7, b: '' } }, regeln);
    expect(r?.namen).toEqual(STANDARD_NAMEN);
    expect(r?.b).toEqual(normalisiere({}, regeln));
  });

  it('Speichern aus: alles gelöscht (auch Version B), nichts wird mehr geschrieben', () => {
    const s = new TestSpeicher();
    const z = { haushalt: fall(), ui: STANDARD_UI, szenarien: { b, namen } };
    speichereLokal(s, z);
    expect(s.getItem(STORAGE_KEY)).toContain('"szenarien"');
    setzeSpeichern(s, false, z);
    expect(s.schluessel()).toEqual([AUS_KEY]);
    speichereLokal(s, z);
    expect(s.schluessel()).toEqual([AUS_KEY]);
    expect(ladeLokal(s, regeln)).toBeNull();
    for (const k of ALTE_KEYS) expect(s.getItem(k)).toBeNull();
    // wieder an: Version B wird wieder mitgespeichert
    setzeSpeichern(s, true, z);
    expect(ladeLokal(s, regeln)?.szenarien?.namen).toEqual(namen);
  });

  it('Haushalt-Schema 12 gilt für Version A und B (Entnahmestrategie)', () => {
    expect(SCHEMA_VERSION).toBe(12);
  });
});

describe('Export und Import', () => {
  it('Rundlauf: Haushalte und Namen bleiben erhalten', () => {
    const a = fall();
    const b = { ...fall(), planungsalter: 90 };
    const text = exportiere(a, b, { a: 'Früh', b: 'Spät' }, new Date('2026-09-29T08:00:00Z'));
    const r = importiere(text, regeln);
    expect(r?.namen).toEqual({ a: 'Früh', b: 'Spät' });
    expect(r?.a).toEqual(normalisiere(a, regeln));
    expect(r?.b).toEqual(normalisiere(b, regeln));
    const d = JSON.parse(text);
    expect(d).toMatchObject({ app: 'ruhestandsrechner', typ: 'szenarien', schema: SCHEMA_VERSION });
  });

  it('fremde oder defekte Dateien werden abgelehnt', () => {
    expect(importiere('kein json', regeln)).toBeNull();
    expect(importiere('[]', regeln)).toBeNull();
    expect(importiere('{"app":"anders","typ":"szenarien","a":{},"b":{}}', regeln)).toBeNull();
    expect(importiere('{"app":"ruhestandsrechner","typ":"szenarien","a":{}}', regeln)).toBeNull();
    expect(importiere('{"app":"ruhestandsrechner","typ":"szenarien","a":{},"b":{}}', regeln)).not.toBeNull();
  });

  it('kopiere liefert eine unabhängige Kopie', () => {
    const a = fall();
    const k = kopiere(a);
    (k.personen[0] as { bargeld: number }).bargeld = 1;
    expect(a.personen[0]?.bargeld).toBe(100000);
  });
});
