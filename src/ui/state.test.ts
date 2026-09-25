import { describe, expect, it } from 'vitest';
import { effektiverHaushalt } from '../core/schaetzwerte';
import { standardHaushalt } from '../data/defaults';
import { ladeRegeln } from '../rules';
import {
  ALTE_KEYS,
  AUS_KEY,
  dekodiere,
  kodiere,
  ladeLokal,
  ladeStartzustand,
  modusFuerLink,
  normalisiere,
  SPEICHER_VERSION,
  STANDARD_UI,
  STORAGE_KEY,
  setzeSpeichern,
  speichereLokal,
  speichernAktiv,
  teilenLink,
} from './state';

/** Einfacher Storage-Ersatz (Tests laufen in Node ohne localStorage). */
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

const regeln = ladeRegeln(2026);

describe('Zustand (URL-Fragment)', () => {
  it('Kodieren und Dekodieren ergibt denselben Haushalt', () => {
    const h = standardHaushalt(regeln);
    h.personen[0] = {
      ...(h.personen[0] as (typeof h.personen)[number]),
      wohneigentum: { vorhanden: true, verkehrswert: 800000, hypothek: 300000 },
    };
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
  });

  it('Ehepaar: zwei vollständig individuelle Personen', () => {
    const h = normalisiere(
      {
        zivilstand: 'verheiratet',
        personen: [
          { geburtsjahr: 1962, geschlecht: 'w' },
          { geburtsjahr: 1958, bargeld: 5 },
        ],
      },
      regeln,
    );
    expect(h.personen).toHaveLength(2);
    expect(h.personen[0]?.geschlecht).toBe('w');
    expect(h.personen[1]?.geburtsjahr).toBe(1958);
    expect(h.personen[1]?.bargeld).toBe(5);
    expect(h.personen[1]?.wohneigentum.hypothek).toBe(0);
  });

  it('migriert frühere Felder freiesVermoegen/vermoegen zu Wertschriften', () => {
    expect(
      normalisiere({ freiesVermoegen: 123000, personen: [{ geburtsjahr: 1970 }] }, regeln).personen[0]?.wertschriften,
    ).toBe(123000);
    expect(normalisiere({ personen: [{ vermoegen: 7 }] }, regeln).personen[0]?.wertschriften).toBe(7);
  });

  it('Standardwerte sind neutral (keine Beispielvermögen)', () => {
    const h = standardHaushalt(regeln);
    const p = h.personen[0];
    expect(p?.lohn).toBe(0);
    expect(p?.bargeld).toBe(0);
    expect(p?.wertschriften).toBe(0);
    expect(p?.pk.guthaben).toBe(0);
    expect(p?.saeule3a.guthaben).toBe(0);
    expect(p?.ahv.renteMonat).toBe(0);
    expect(h.ausgaben.lebenshaltung).toBe(0);
  });

  it('Posten und Ereignisse werden normalisiert', () => {
    const h = normalisiere(
      {
        posten: [{ art: 'einnahme', betragJahr: 1000, person: 5, indexierung: { art: 'satz', satz: 0.02 } }],
        ereignisse: [{ betrag: -5 }],
      },
      regeln,
    );
    expect(h.posten[0]?.art).toBe('einnahme');
    expect(h.posten[0]?.person).toBe(0);
    expect(h.posten[0]?.indexierung).toEqual({ art: 'satz', satz: 0.02 });
    expect(h.ereignisse[0]?.betrag).toBe(-5);
  });

  it('Planungsalter bis 999, Standard 120', () => {
    expect(normalisiere({}, regeln).planungsalter).toBe(120);
    expect(normalisiere({ planungsalter: 5000 }, regeln).planungsalter).toBe(999);
  });
});

describe('Speichern im Browser (localStorage)', () => {
  const ui = { schritt: 2, suchModus: 'gemeinsam' as const, modus: 'detailliert' as const };
  const mitLohn = () => {
    const h = standardHaushalt(regeln);
    (h.personen[0] as (typeof h.personen)[number]).lohn = 123456;
    return h;
  };

  it('ist standardmässig an und speichert den ganzen Zustand als EIN JSON-Objekt mit Version', () => {
    const s = new TestSpeicher();
    expect(speichernAktiv(s)).toBe(true);
    speichereLokal(s, { haushalt: mitLohn(), ui });
    expect(s.schluessel()).toEqual([STORAGE_KEY]);
    const obj = JSON.parse(s.getItem(STORAGE_KEY) ?? '{}');
    expect(obj.version).toBe(SPEICHER_VERSION);
    expect(obj.haushalt.personen[0].lohn).toBe(123456);
    expect(obj.ui).toEqual(ui);
  });

  it('stellt den Zustand beim Laden wieder her (inkl. Oberflächenzustand)', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: mitLohn(), ui });
    const z = ladeLokal(s, regeln);
    expect(z?.haushalt.personen[0]?.lohn).toBe(123456);
    expect(z?.ui).toEqual(ui);
    expect(ladeStartzustand(regeln, '', s).quelle).toBe('lokal');
  });

  it('Ausschalten löscht sofort alle Daten (auch frühere Schlüssel) und speichert nichts mehr', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: mitLohn(), ui });
    for (const k of ALTE_KEYS) s.setItem(k, 'alt');
    setzeSpeichern(s, false, { haushalt: mitLohn(), ui });
    expect(s.schluessel()).toEqual([AUS_KEY]);
    expect(s.getItem(AUS_KEY)).toBe('1');
    speichereLokal(s, { haushalt: mitLohn(), ui });
    expect(s.schluessel()).toEqual([AUS_KEY]);
    expect(speichernAktiv(s)).toBe(false);
    expect(ladeStartzustand(regeln, '', s).quelle).toBe('standard');
  });

  it('Wiedereinschalten entfernt das Merkmal «aus» und speichert sofort', () => {
    const s = new TestSpeicher();
    setzeSpeichern(s, false, { haushalt: mitLohn(), ui });
    setzeSpeichern(s, true, { haushalt: mitLohn(), ui });
    expect(s.schluessel()).toEqual([STORAGE_KEY]);
  });

  it('migriert die frühere Opt-in-Speicherung und löscht die alten Schlüssel', () => {
    const s = new TestSpeicher();
    s.setItem('ruhestandsrechner:zustand', kodiere(mitLohn()));
    s.setItem('ruhestandsrechner:speichern', '1');
    const z = ladeLokal(s, regeln);
    expect(z?.haushalt.personen[0]?.lohn).toBe(123456);
    expect(s.schluessel()).toEqual([STORAGE_KEY]);
  });

  it('ein geteilter Link hat Vorrang vor dem localStorage (die eigenen Daten bleiben erhalten)', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: mitLohn(), ui });
    const geteilt = standardHaushalt(regeln);
    (geteilt.personen[0] as (typeof geteilt.personen)[number]).lohn = 777;
    const link = teilenLink(geteilt, 'https://example.org/app/#alt');
    expect(link.startsWith('https://example.org/app/#s=')).toBe(true);
    const start = ladeStartzustand(regeln, link.slice(link.indexOf('#')), s);
    expect(start.quelle).toBe('link');
    expect(start.haushalt.personen[0]?.lohn).toBe(777);
    expect(start.lokal?.haushalt.personen[0]?.lohn).toBe(123456);
  });

  it('defekte Einträge werden ignoriert', () => {
    const s = new TestSpeicher();
    s.setItem(STORAGE_KEY, '{kaputt');
    expect(ladeLokal(s, regeln)).toBeNull();
    expect(ladeStartzustand(regeln, '', null).quelle).toBe('standard');
  });
});

describe('Neue Felder: Rücktrittsmodus und Wohnsitz im Ausland', () => {
  it('Standard: Modus Alter, kein Wegzug', () => {
    const p = standardHaushalt(regeln).personen[0];
    expect(p?.stoppModus).toBe('alter');
    expect(p?.wohnsitzAusland.aktiv).toBe(false);
  });

  it('ungültige Werte werden normalisiert', () => {
    const p = normalisiere(
      {
        personen: [
          {
            stoppModus: 'x',
            stoppDatum: { jahr: 2027.4, monat: 13 },
            wohnsitzAusland: { aktiv: true, modus: 'datum', land: 'ZZ', nationalitaet: 'foo' },
          },
        ],
      },
      regeln,
    ).personen[0];
    expect(p?.stoppModus).toBe('alter');
    expect(p?.stoppDatum).toEqual({ jahr: 2027, monat: 12 });
    expect(p?.wohnsitzAusland.modus).toBe('datum');
    expect(p?.wohnsitzAusland.land).toBe('');
    expect(p?.wohnsitzAusland.nationalitaet).toBe('CH');
  });

  it('Datum-Modus und Wegzug überstehen Kodieren/Dekodieren', () => {
    const h = standardHaushalt(regeln);
    const p = h.personen[0] as (typeof h.personen)[number];
    h.personen[0] = {
      ...p,
      stoppModus: 'datum',
      stoppDatum: { jahr: 2027, monat: 11 },
      wohnsitzAusland: { ...p.wohnsitzAusland, aktiv: true, land: 'PY', nationalitaet: 'EU', freiwilligeAhv: true },
    };
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
  });
});

describe('Eingabemodus «Schnell» / «Detailliert»', () => {
  const detailHaushalt = () => {
    const h = standardHaushalt(regeln);
    const p = h.personen[0] as (typeof h.personen)[number];
    p.lohn = 110000;
    p.inChSeit = 2008;
    p.bargeld = 20000;
    p.ahv = { ...p.ahv, modus: 'eingabe', renteMonat: 2100 };
    p.pk = { ...p.pk, umwandlungssatz: 0.052, guthaben: 350000 };
    p.manuell = { ahvRente: true, pkUmwandlungssatz: true, pkGuthaben: true };
    return h;
  };

  it('frischer Zustand startet im Modus «Schnell» (auch ohne Speicher oder mit Speichern aus)', () => {
    expect(ladeStartzustand(regeln, '', new TestSpeicher()).ui.modus).toBe('schnell');
    expect(ladeStartzustand(regeln, '', null).ui.modus).toBe('schnell');
    const aus = new TestSpeicher();
    aus.setItem(AUS_KEY, '1');
    expect(ladeStartzustand(regeln, '', aus).ui.modus).toBe('schnell');
    expect(STANDARD_UI.modus).toBe('schnell');
  });

  it('Erststart: Umwandlungssatz geschätzt (aufgeteilt), nicht als eigene Eingabe markiert', () => {
    const start = ladeStartzustand(regeln, '', new TestSpeicher());
    const p = start.haushalt.personen[0];
    expect(p?.manuell.pkUmwandlungssatz).toBeUndefined();
    const e = effektiverHaushalt(start.haushalt, regeln, { jahr: 2026, monat: 9 });
    expect(e.schaetzungen.some((x) => x.feld === 'pkUmwandlungssatz')).toBe(true);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBe(e.umwandlungssatz[0]?.satz);
  });

  it('Link ohne Detailwerte → «Schnell», auch wenn lokal «Detailliert» gespeichert ist', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: detailHaushalt(), ui: { schritt: 1, suchModus: 'gemeinsam', modus: 'detailliert' } });
    const einfach = standardHaushalt(regeln);
    const hash = teilenLink(einfach, 'https://x/').slice('https://x/'.length);
    const z = ladeStartzustand(regeln, hash, s);
    expect(z.quelle).toBe('link');
    expect(z.ui.modus).toBe('schnell');
    // BVG-Altersguthaben (nur im Modus «Detailliert» sichtbar) → Link öffnet «Detailliert»
    const p0 = einfach.personen[0] as (typeof einfach.personen)[number];
    p0.pk = { ...p0.pk, bvgGuthaben: 120000 };
    expect(modusFuerLink(einfach, regeln)).toBe('detailliert');
    expect(dekodiere(kodiere(einfach), regeln)?.personen[0]?.pk.bvgGuthaben).toBe(120000);
  });

  it('der gespeicherte Modus bleibt erhalten; frühere Zustände ohne Modus → «Detailliert»', () => {
    for (const modus of ['schnell', 'detailliert'] as const) {
      const s = new TestSpeicher();
      speichereLokal(s, { haushalt: standardHaushalt(regeln), ui: { schritt: 1, suchModus: 'gemeinsam', modus } });
      expect(ladeStartzustand(regeln, '', s).ui.modus).toBe(modus);
    }
    const s = new TestSpeicher();
    s.setItem(
      STORAGE_KEY,
      JSON.stringify({ app: 'ruhestandsrechner', version: 1, schema: 1, haushalt: {}, ui: { schritt: 2 } }),
    );
    expect(ladeLokal(s, regeln)?.ui.modus).toBe('detailliert');
  });

  it('Moduswechsel verliert keine Daten: Detailwerte überstehen Speichern im Modus «Schnell»', () => {
    const h = normalisiere(detailHaushalt(), regeln);
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: h, ui: { schritt: 2, suchModus: 'gemeinsam', modus: 'detailliert' } });
    // Wechsel zu «Schnell» (nur der Modus ändert) und wieder zurück
    const z1 = ladeLokal(s, regeln);
    speichereLokal(s, { haushalt: z1?.haushalt ?? h, ui: { schritt: 0, suchModus: 'gemeinsam', modus: 'schnell' } });
    const z2 = ladeLokal(s, regeln);
    expect(z2?.ui.modus).toBe('schnell');
    expect(z2?.haushalt).toEqual(h);
    speichereLokal(s, {
      haushalt: z2?.haushalt ?? h,
      ui: { schritt: 0, suchModus: 'gemeinsam', modus: 'detailliert' },
    });
    expect(ladeLokal(s, regeln)?.haushalt).toEqual(h);
    // «Schnell» rechnet mit den Detailwerten
    const e = effektiverHaushalt(h, regeln, { jahr: 2026, monat: 9 });
    expect(e.haushalt.personen[0]?.ahv.renteMonat).toBe(2100);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBe(0.052);
    expect(e.schaetzungen.map((x) => x.feld)).toEqual(['pkSparbeitrag']);
  });

  it('«in der Schweiz seit» und Markierungen werden normalisiert; Kodieren/Dekodieren behält sie', () => {
    const h = detailHaushalt();
    expect(dekodiere(kodiere(h), regeln)?.personen[0]?.manuell).toEqual(h.personen[0]?.manuell);
    expect(dekodiere(kodiere(h), regeln)?.personen[0]?.inChSeit).toBe(2008);
    const roh = JSON.parse(JSON.stringify(h));
    roh.personen[0].inChSeit = 'x';
    roh.personen[0].manuell = { ahvRente: true, unbekannt: true, pkGuthaben: 'ja' };
    const n = normalisiere(roh, regeln);
    expect(n.personen[0]?.inChSeit).toBe(0);
    expect(n.personen[0]?.manuell).toEqual({ ahvRente: true });
  });

  it('frühere Zustände ohne Markierungen: abweichende Werte gelten als eigene Eingabe', () => {
    const roh = JSON.parse(JSON.stringify(detailHaushalt()));
    delete roh.personen[0].manuell;
    const n = normalisiere(roh, regeln);
    expect(n.personen[0]?.manuell).toEqual({ ahvRente: true, pkGuthaben: true, pkUmwandlungssatz: true });
  });

  it('geteilter Link: «Detailliert», wenn er Detailwerte enthält, sonst «Schnell»', () => {
    const einfach = standardHaushalt(regeln);
    (einfach.personen[0] as (typeof einfach.personen)[number]).lohn = 90000;
    expect(modusFuerLink(einfach, regeln)).toBe('schnell');
    // PK-Guthaben und Umwandlungssatz sind Schnell-Felder
    const p0 = einfach.personen[0] as (typeof einfach.personen)[number];
    p0.manuell = { pkGuthaben: true, pkUmwandlungssatz: true };
    p0.pk = { ...p0.pk, guthaben: 300000, umwandlungssatz: 0.055 };
    expect(modusFuerLink(einfach, regeln)).toBe('schnell');
    expect(modusFuerLink(detailHaushalt(), regeln)).toBe('detailliert');
    const s = new TestSpeicher();
    expect(
      ladeStartzustand(regeln, teilenLink(detailHaushalt(), 'https://x/').slice('https://x/'.length), s).ui.modus,
    ).toBe('detailliert');
  });
});
