import { describe, expect, it } from 'vitest';
import { neuePerson, standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import {
  ahvLueckenZuzug,
  detailwerte,
  effektiverHaushalt,
  mitUmwandlungssatz,
  SCHAETZ_FELDER,
  schaetzeAhv,
  schaetzePkGuthaben,
  schaetzePkSparbeitrag,
  schaetzeUmwandlungssatz,
  umwandlungssatzGeschaetztMitGuthaben,
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
});

describe('Schätzwerte: Umwandlungssatz aufgeteilt (Obligatorium 6,8% / Rest umhüllender Durchschnitt)', () => {
  const OBL = regeln.bvg.mindestumwandlungssatz;
  const UEB = regeln.bvg.umwandlungssatzUmhuellendDurchschnitt;
  const mitGuthaben = (o: Partial<Person>, guthaben: number, bvgGuthaben = 0): Person => {
    const p = person({ ...o, manuell: { pkGuthaben: true } });
    p.pk = { ...p.pk, guthaben, bvgGuthaben };
    return p;
  };

  it('Regelwerte: 6,8% (Art. 14 BVG) und 5,17% (OAK BV 2025), mit Quelle', () => {
    expect(OBL).toBe(0.068);
    expect(UEB).toBe(0.0517);
    expect(UEB).toBeLessThan(OBL);
  });

  it('ohne eigenes PK-Guthaben (Schätzung aus BVG-Gutschriften) → ganz obligatorisch → 6,8%', () => {
    const e = effektiverHaushalt(haushalt([person()]), regeln, heute);
    const u = e.umwandlungssatz[0];
    expect(u?.anteilObligatorium).toBeCloseTo(1, 9);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBeCloseTo(OBL, 9);
    expect(e.werte[0]?.pkUmwandlungssatz).toBeCloseTo(OBL, 9);
  });

  it('Handrechnung: BVG-Altersguthaben laut Vorsorgeausweis, ohne weitere Beiträge (Lohn 0)', () => {
    // 100'000 von 400'000 obligatorisch, beide gleich verzinst → Anteil bleibt 25%
    const u = schaetzeUmwandlungssatz(mitGuthaben({ lohn: 0 }, 400000, 100000), regeln, heute, 400000, null, 0.01);
    expect(u.anteilObligatorium).toBeCloseTo(0.25, 9);
    expect(u.satz).toBeCloseTo(0.25 * OBL + 0.75 * UEB, 9);
    expect(u.bvgGuthabenEingegeben).toBe(true);
    expect(u.bvgGuthabenHeute).toBe(100000);
  });

  it('kein obligatorischer Teil (Lohn 0, keine Angabe) → nur der umhüllende Durchschnitt', () => {
    const u = schaetzeUmwandlungssatz(mitGuthaben({ lohn: 0 }, 300000), regeln, heute, 300000, null, 0.01);
    expect(u.anteilObligatorium).toBe(0);
    expect(u.satz).toBeCloseTo(UEB, 9);
  });

  it('BVG-Guthaben grösser als das Guthaben → auf das Guthaben begrenzt (6,8%)', () => {
    const u = schaetzeUmwandlungssatz(mitGuthaben({ lohn: 0 }, 50000, 80000), regeln, heute, 50000, null, 0.01);
    expect(u.bvgGuthabenHeute).toBe(50000);
    expect(u.satz).toBeCloseTo(OBL, 9);
  });

  it('BVG-Anteil aus Lohn/Alter geschätzt, bis zum Referenzalter hochgerechnet; mehr Guthaben → tieferer Satz', () => {
    // Jg. 1970, Lohn 120'000: BVG-Guthaben heute geschätzt aus Mindestgutschriften
    const bvgHeute = schaetzePkGuthaben(person(), regeln, heute);
    const klein = effektiverHaushalt(haushalt([mitGuthaben({}, bvgHeute * 1.2)]), regeln, heute).umwandlungssatz[0];
    const gross = effektiverHaushalt(haushalt([mitGuthaben({}, bvgHeute * 4)]), regeln, heute).umwandlungssatz[0];
    expect(klein?.bvgGuthabenHeute).toBe(bvgHeute);
    expect(klein?.bvgGuthabenEingegeben).toBe(false);
    // künftige BVG-Mindestbeiträge sind ganz obligatorisch → Anteil im Referenzalter grösser als heute
    expect(klein?.anteilObligatorium).toBeGreaterThan(1 / 1.2);
    expect(klein?.anteilObligatorium).toBeLessThan(1);
    expect(gross?.satz).toBeLessThan(klein?.satz ?? 0);
    for (const u of [klein, gross]) {
      expect(u?.satz).toBeGreaterThan(UEB);
      expect(u?.satz).toBeLessThan(OBL);
      expect(u?.satz).toBeCloseTo(OBL * (u?.anteilObligatorium ?? 0) + UEB * (1 - (u?.anteilObligatorium ?? 0)), 12);
    }
  });

  it('eingegebener Sparbeitrag über dem BVG-Minimum senkt den obligatorischen Anteil', () => {
    const p = mitGuthaben({}, 500000);
    const bvgMin = schaetzeUmwandlungssatz(p, regeln, heute, 500000, null, 0.01);
    const hoch = schaetzeUmwandlungssatz(p, regeln, heute, 500000, 40000, 0.01);
    expect(hoch.anteilObligatorium).toBeLessThan(bvgMin.anteilObligatorium);
  });

  it('Satz laut Vorsorgeausweis hat immer Vorrang (auch mit BVG-Guthaben-Angabe)', () => {
    const p = mitUmwandlungssatz(mitGuthaben({}, 800000, 200000), 0.049);
    const e = effektiverHaushalt(haushalt([p]), regeln, heute);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBe(0.049);
    expect(e.schaetzungen.some((s) => s.feld === 'pkUmwandlungssatz')).toBe(false);
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
    expect(d).toContain('Bargeld/Konten');
    expect(d).toContain('Annahmen (Rendite, Teuerung usw.)');
    // PK-Guthaben und Umwandlungssatz sind auch im Modus «Schnell» sichtbar → keine Detailwerte
    expect(d).not.toContain('PK-Altersguthaben heute');
    expect(d).not.toContain('PK-Umwandlungssatz');
    expect(detailwerte(haushalt([person({ manuell: { pkSparbeitrag: true } })]), std)).toContain('PK-Sparbeitrag');
  });
});

describe('Umwandlungssatz laut Vorsorgeausweis (Schnell und Detailliert, gleicher Zustand)', () => {
  it('Eingabe setzt die eigene Eingabe; leer/0 → zurück zur aufgeteilten Schätzung', () => {
    const p = mitUmwandlungssatz(person(), 0.054);
    expect(p.manuell.pkUmwandlungssatz).toBe(true);
    expect(p.pk.umwandlungssatz).toBe(0.054);
    expect(effektiverHaushalt(haushalt([p]), regeln, heute).haushalt.personen[0]?.pk.umwandlungssatz).toBe(0.054);
    const leer = mitUmwandlungssatz(p, 0);
    expect(leer.manuell.pkUmwandlungssatz).toBeUndefined();
    const e = effektiverHaushalt(haushalt([leer]), regeln, heute);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBe(e.umwandlungssatz[0]?.satz);
    expect(e.schaetzungen.some((s) => s.feld === 'pkUmwandlungssatz')).toBe(true);
    // andere Markierungen bleiben erhalten
    const q = mitUmwandlungssatz(person({ manuell: { pkGuthaben: true } }), 0.05);
    expect(mitUmwandlungssatz(q, Number.NaN).manuell).toEqual({ pkGuthaben: true });
  });

  it('Hinweis «Satz vom Vorsorgeausweis eintragen» nur bei geschätztem Satz und vorhandenem PK-Guthaben', () => {
    const p = person();
    const eff = effektiverHaushalt(haushalt([p]), regeln, heute).haushalt.personen[0];
    expect(umwandlungssatzGeschaetztMitGuthaben(p, eff)).toBe(true);
    const mit = mitUmwandlungssatz(p, 0.055);
    expect(umwandlungssatzGeschaetztMitGuthaben(mit, eff)).toBe(false);
    const ohnePk = person({ lohn: 0 });
    const effOhne = effektiverHaushalt(haushalt([ohnePk]), regeln, heute).haushalt.personen[0];
    expect(umwandlungssatzGeschaetztMitGuthaben(ohnePk, effOhne)).toBe(false);
  });

  it('BVG-Altersguthaben (Detailfeld) zählt als Detailwert, solange der Satz geschätzt wird', () => {
    const std = standardHaushalt(regeln);
    const p = person();
    p.pk = { ...p.pk, bvgGuthaben: 150000 };
    expect(detailwerte(haushalt([p]), std)).toContain('BVG-Altersguthaben (Obligatorium)');
    expect(detailwerte(haushalt([mitUmwandlungssatz(p, 0.05)]), std)).not.toContain(
      'BVG-Altersguthaben (Obligatorium)',
    );
  });
});
