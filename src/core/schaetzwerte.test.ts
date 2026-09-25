import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import {
  ahvLueckenZuzug,
  detailwerte,
  effektiverHaushalt,
  SCHAETZ_FELDER,
  schaetzeAhv,
  schaetzePkGuthaben,
  schaetzePkSparbeitrag,
} from './schaetzwerte';
import type { Haushalt, Person } from './typen';

const regeln = ladeRegeln(2026);
const heute = { jahr: 2026, monat: 9 };
const R = regeln.ahv;

const person = (o: Partial<Person> = {}): Person =>
  neuePerson(regeln, { geburtsjahr: 1970, geburtsmonat: 6, geschlecht: 'm', lohn: 120000, ...o });
const haushalt = (personen: Person[], o: Partial<Haushalt> = {}): Haushalt => ({
  ...standardHaushalt(regeln),
  personen,
  zivilstand: personen.length > 1 ? 'verheiratet' : 'alleinstehend',
  ...o,
});

describe('Schätzwerte: AHV (Skala 44, Einkommen = heutiger Lohn)', () => {
  it('ohne Lücken und Lohn über dem mdJE-Maximum → Maximalrente', () => {
    const r = schaetzeAhv(person(), null, false, regeln);
    expect(r.beitragsjahre).toBe(r.vollDauer);
    expect(r.renteMonat).toBe(R.maximalrenteMonat);
  });

  it('Lohn 0 ohne Lücken → Minimalrente (Deckelung unten)', () => {
    expect(schaetzeAhv(person({ lohn: 0 }), null, false, regeln).renteMonat).toBe(R.minimalrenteMonat);
  });

  it('höherer Lohn ändert nichts mehr (Deckelung beim mdJE-Maximum)', () => {
    const a = schaetzeAhv(person({ lohn: 200000 }), null, false, regeln).renteMonat;
    const b = schaetzeAhv(person({ lohn: 1_000_000 }), null, false, regeln).renteMonat;
    expect(a).toBe(b);
  });

  it('Zuzug nach dem 20. Altersjahr → Teilrente um je 1/44 gekürzt', () => {
    // Jahrgang 1980, Frau: Beitragsbeginn 2001, Referenzalter 65 → Beitragsdauer bis 2044
    const p = person({ geburtsjahr: 1980, geburtsmonat: 3, geschlecht: 'w', lohn: 200000, inChSeit: 2010 });
    expect(ahvLueckenZuzug(p, regeln)).toBe(9);
    const r = schaetzeAhv(p, null, false, regeln);
    expect(r.beitragsjahre).toBe(35);
    expect(r.renteMonat).toBeCloseTo((R.maximalrenteMonat * 35) / 44, -1);
    // Zuzug vor dem Beitragsbeginn → keine Lücken
    expect(ahvLueckenZuzug({ ...p, inChSeit: 1995 }, regeln)).toBe(0);
    expect(ahvLueckenZuzug({ ...p, inChSeit: 0 }, regeln)).toBe(0);
  });

  it('Ehepaar: Splitting der Einkommen (je hälftig) → beide gleich hohe Renten', () => {
    const a = person({ lohn: 150000 });
    const b = person({ geburtsjahr: 1972, geschlecht: 'w', lohn: 0 });
    const ra = schaetzeAhv(a, b, true, regeln).renteMonat;
    const rb = schaetzeAhv(b, a, true, regeln).renteMonat;
    expect(ra).toBe(rb);
    expect(ra).toBeGreaterThan(R.minimalrenteMonat);
    expect(ra).toBeLessThan(R.maximalrenteMonat);
    // unverheiratet: kein Splitting
    expect(schaetzeAhv(a, b, false, regeln).renteMonat).toBe(R.maximalrenteMonat);
    expect(schaetzeAhv(b, a, false, regeln).renteMonat).toBe(R.minimalrenteMonat);
  });
});

describe('Schätzwerte: Pensionskasse (BVG-Minimum)', () => {
  it('Guthaben = verzinste BVG-Altersgutschriften ab 25 bis Vorjahr (Handrechnung)', () => {
    // Jahrgang 1996, Lohn 100'000: koordinierter Lohn 90'720 − 26'460 = 64'260; 2021–2025 je 7%
    const p = person({ geburtsjahr: 1996, lohn: 100000 });
    const gs = 64260 * 0.07;
    const z = regeln.bvg.mindestzins2026;
    let erwartet = 0;
    for (let i = 0; i < 5; i++) erwartet = erwartet * (1 + z) + gs;
    expect(schaetzePkGuthaben(p, regeln, heute)).toBe(Math.round(erwartet));
    // Sparbeitrag heute (BVG-Alter 30): 7% des koordinierten Lohns
    expect(schaetzePkSparbeitrag(p, regeln, heute)).toBe(Math.round(gs));
  });

  it('Zuzug verkürzt die Beitragsjahre; Lohn unter der Eintrittsschwelle → 0', () => {
    const p = person({ geburtsjahr: 1980, lohn: 90000 });
    const ohne = schaetzePkGuthaben(p, regeln, heute);
    const mit = schaetzePkGuthaben({ ...p, inChSeit: 2015 }, regeln, heute);
    expect(mit).toBeGreaterThan(0);
    expect(mit).toBeLessThan(ohne);
    expect(schaetzePkGuthaben(person({ lohn: 20000 }), regeln, heute)).toBe(0);
  });

  it('Umwandlungssatz-Schätzung = BVG-Mindestumwandlungssatz (6,8%)', () => {
    const e = effektiverHaushalt(haushalt([person()]), regeln, heute);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBe(0.068);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBe(regeln.bvg.mindestumwandlungssatz);
  });
});

describe('Vorrang der eigenen Eingabe', () => {
  it('ohne eigene Eingaben werden alle Schätzfelder gesetzt, der gespeicherte Zustand bleibt unverändert', () => {
    const h = haushalt([person()]);
    const kopie = JSON.stringify(h);
    const e = effektiverHaushalt(h, regeln, heute);
    expect(e.schaetzungen.map((s) => s.feld)).toEqual([...SCHAETZ_FELDER]);
    const p = e.haushalt.personen[0];
    expect(p?.ahv.renteMonat).toBe(R.maximalrenteMonat);
    expect(p?.pk.guthaben).toBe(e.werte[0]?.pkGuthaben);
    expect(p?.pk.beitragModus).toBe('bvgMinimum');
    expect(JSON.stringify(h)).toBe(kopie);
  });

  it('eigene Eingaben überschreiben die Schätzung (auch der Wert 0)', () => {
    const p = person({ manuell: { ahvRente: true, pkGuthaben: true, pkSparbeitrag: true, pkUmwandlungssatz: true } });
    p.ahv = { ...p.ahv, modus: 'eingabe', renteMonat: 1800 };
    p.pk = { ...p.pk, guthaben: 0, beitragModus: 'eingabe', sparbeitragJahr: 20000, umwandlungssatz: 0.05 };
    const e = effektiverHaushalt(haushalt([p]), regeln, heute);
    expect(e.schaetzungen).toEqual([]);
    const q = e.haushalt.personen[0];
    expect(q?.ahv.renteMonat).toBe(1800);
    expect(q?.pk.guthaben).toBe(0);
    expect(q?.pk.beitragModus).toBe('eingabe');
    expect(q?.pk.sparbeitragJahr).toBe(20000);
    expect(q?.pk.umwandlungssatz).toBe(0.05);
    // Schätzwerte bleiben zur Anzeige verfügbar («Zurücksetzen auf Schätzung»)
    expect(e.werte[0]?.ahvRente).toBe(R.maximalrenteMonat);
  });

  it('nur einzelne Felder überschrieben → Rest geschätzt', () => {
    const p = person({ manuell: { pkUmwandlungssatz: true } });
    p.pk = { ...p.pk, umwandlungssatz: 0.054 };
    const e = effektiverHaushalt(haushalt([p]), regeln, heute);
    expect(e.schaetzungen.map((s) => s.feld)).toEqual(['ahvRente', 'pkGuthaben', 'pkSparbeitrag']);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBe(0.054);
  });
});

describe('Detailwerte (Hinweis im Modus «Schnell»)', () => {
  it('Standardhaushalt hat keine Detailwerte; abweichende Detailfelder werden gezählt', () => {
    const std = standardHaushalt(regeln);
    expect(detailwerte(std, std)).toEqual([]);
    const p = person({ bargeld: 5000, manuell: { pkUmwandlungssatz: true, pkGuthaben: true } });
    const h = haushalt([p], { annahmen: { ...std.annahmen, renditeNominal: 0.02 } });
    const d = detailwerte(h, std);
    expect(d).toContain('PK-Umwandlungssatz');
    expect(d).toContain('Bargeld/Konten');
    expect(d).toContain('Annahmen (Rendite, Teuerung usw.)');
    // PK-Guthaben ist auch im Modus «Schnell» sichtbar → kein Detailwert
    expect(d).not.toContain('PK-Altersguthaben heute');
  });
});
